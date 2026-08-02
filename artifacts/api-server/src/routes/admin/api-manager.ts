import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, apiIntegrationsTable, apiIntegrationLogsTable } from "@workspace/db";
import { encryptConfig, decryptConfig } from "../../lib/encrypt";
import { API_CATALOG, SENSITIVE_FALLBACK, type ApiDefinition } from "./api-catalog";

const router: IRouter = Router();

// ── helpers ───────────────────────────────────────────────────────────────────

function catalogBySlug(slug: string): ApiDefinition | undefined {
  return API_CATALOG.find(a => a.slug === slug);
}

function sensitiveKeys(def: ApiDefinition): Set<string> {
  return new Set(def.fields.filter(f => f.sensitive).map(f => f.key));
}

/** Mask sensitive fields in decrypted config before sending to client */
function maskConfig(config: Record<string, string>, def: ApiDefinition): Record<string, string> {
  const sens = sensitiveKeys(def);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(config)) {
    out[k] = sens.has(k) ? (v ? SENSITIVE_FALLBACK : "") : v;
  }
  return out;
}

async function addLog(slug: string, action: string, ok: boolean, message: string) {
  try {
    await db.insert(apiIntegrationLogsTable).values({ slug, action, ok, message });
    // Keep only last 200 logs per slug to avoid unbounded growth
    const old = await db.select({ id: apiIntegrationLogsTable.id })
      .from(apiIntegrationLogsTable)
      .where(eq(apiIntegrationLogsTable.slug, slug))
      .orderBy(desc(apiIntegrationLogsTable.createdAt))
      .offset(200);
    if (old.length) {
      for (const row of old) {
        await db.delete(apiIntegrationLogsTable).where(eq(apiIntegrationLogsTable.id, row.id));
      }
    }
  } catch { /* non-fatal */ }
}

// ── Test connection implementations ───────────────────────────────────────────

async function runTest(slug: string, config: Record<string, string>): Promise<{ ok: boolean; message: string }> {
  const timeout = AbortSignal.timeout?.(8000) ?? AbortSignal.any([]);

  try {
    switch (slug) {
      case "openai": {
        if (!config.api_key) return { ok: false, message: "API key not set" };
        const r = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${config.api_key}` },
          signal: timeout,
        });
        if (r.ok) {
          const d = await r.json() as { data?: unknown[] };
          return { ok: true, message: `Connected — ${d.data?.length ?? "?"} models available` };
        }
        const e = await r.json() as { error?: { message?: string } };
        return { ok: false, message: e.error?.message ?? `HTTP ${r.status}` };
      }

      case "anthropic": {
        if (!config.api_key) return { ok: false, message: "API key not set" };
        const r = await fetch("https://api.anthropic.com/v1/models", {
          headers: { "x-api-key": config.api_key, "anthropic-version": "2023-06-01" },
          signal: timeout,
        });
        if (r.ok) return { ok: true, message: "Connected — Anthropic API accessible" };
        const e = await r.json() as { error?: { message?: string } };
        return { ok: false, message: e.error?.message ?? `HTTP ${r.status}` };
      }

      case "stripe": {
        const key = config.secret_key;
        if (!key) return { ok: false, message: "Secret key not set" };
        const r = await fetch("https://api.stripe.com/v1/balance", {
          headers: { Authorization: `Bearer ${key}` },
          signal: timeout,
        });
        if (r.ok) return { ok: true, message: "Connected — Stripe balance retrieved" };
        const e = await r.json() as { error?: { message?: string } };
        return { ok: false, message: e.error?.message ?? `HTTP ${r.status}` };
      }

      case "razorpay": {
        if (!config.key_id || !config.key_secret) return { ok: false, message: "Key ID and Key Secret required" };
        const auth = Buffer.from(`${config.key_id}:${config.key_secret}`).toString("base64");
        const r = await fetch("https://api.razorpay.com/v1/payments?count=1", {
          headers: { Authorization: `Basic ${auth}` },
          signal: timeout,
        });
        if (r.ok) return { ok: true, message: "Connected — Razorpay API accessible" };
        return { ok: false, message: `HTTP ${r.status}: Invalid credentials` };
      }

      case "google_maps":
      case "google_geocoding": {
        if (!config.api_key) return { ok: false, message: "API key not set" };
        const r = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=Mumbai&key=${encodeURIComponent(config.api_key)}`,
          { signal: timeout },
        );
        const d = await r.json() as { status: string; error_message?: string };
        if (d.status === "OK" || d.status === "ZERO_RESULTS") return { ok: true, message: "Connected — Google Maps API working" };
        return { ok: false, message: `${d.status}: ${d.error_message ?? "Check API key and restrictions"}` };
      }

      case "twilio": {
        if (!config.account_sid || !config.auth_token) return { ok: false, message: "Account SID and Auth Token required" };
        const auth = Buffer.from(`${config.account_sid}:${config.auth_token}`).toString("base64");
        const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.account_sid}.json`, {
          headers: { Authorization: `Basic ${auth}` },
          signal: timeout,
        });
        if (r.ok) {
          const d = await r.json() as { friendly_name?: string };
          return { ok: true, message: `Connected — Account: ${d.friendly_name ?? config.account_sid}` };
        }
        return { ok: false, message: `HTTP ${r.status}: Invalid credentials` };
      }

      case "whatsapp_waba": {
        if (!config.system_token) return { ok: false, message: "System User Token not set" };
        const pid = config.phone_number_id ?? "me";
        const r = await fetch(`https://graph.facebook.com/v18.0/${pid}`, {
          headers: { Authorization: `Bearer ${config.system_token}` },
          signal: timeout,
        });
        if (r.ok) return { ok: true, message: "Connected — WhatsApp Business API accessible" };
        const e = await r.json() as { error?: { message?: string } };
        return { ok: false, message: e.error?.message ?? `HTTP ${r.status}` };
      }

      case "aws_s3": {
        if (!config.access_key_id || !config.secret_access_key) return { ok: false, message: "Access Key ID and Secret required" };
        return { ok: true, message: "Credentials are set (AWS SDK connection not tested here)" };
      }

      case "ocr_space": {
        if (!config.api_key) return { ok: false, message: "API key not set" };
        // Ping OCR.space with a minimal base64 image
        const r = await fetch("https://api.ocr.space/parse/image", {
          method: "POST",
          headers: { apikey: config.api_key, "Content-Type": "application/x-www-form-urlencoded" },
          body: "base64Image=data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7&language=eng",
          signal: timeout,
        });
        if (r.ok) return { ok: true, message: "Connected — OCR.space API accessible" };
        return { ok: false, message: `HTTP ${r.status}: Check API key` };
      }

      default: {
        // Generic: check if any sensitive field is set
        const def = catalogBySlug(slug);
        const sens = def ? sensitiveKeys(def) : new Set<string>();
        const hasKey = [...sens].some(k => !!config[k]) || !!config.api_key || !!config.secret_key;
        return hasKey
          ? { ok: true,  message: "API key is set — live connection not verified for this provider" }
          : { ok: false, message: "No API key configured" };
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `Error: ${msg}` };
  }
}

// ── GET /admin/api-integrations — full catalogue with DB status ───────────────

router.get("/admin/api-integrations", async (_req, res): Promise<void> => {
  const rows = await db.select().from(apiIntegrationsTable);
  const bySlug = new Map(rows.map(r => [r.slug, r]));

  const result = API_CATALOG.map(def => {
    const row = bySlug.get(def.slug);
    const config = row ? maskConfig(decryptConfig(row.configEnc), def) : {};
    return {
      slug:          def.slug,
      name:          def.name,
      category:      def.category,
      description:   def.description,
      badge:         def.badge ?? null,
      testable:      def.testable ?? false,
      fields:        def.fields,
      enabled:       row?.enabled ?? false,
      status:        row?.status ?? "untested",
      statusMessage: row?.statusMessage ?? null,
      lastUsedAt:    row?.lastUsedAt ?? null,
      config,
    };
  });

  res.json(result);
});

// ── GET /admin/api-integrations/:slug ─────────────────────────────────────────

router.get("/admin/api-integrations/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params as { slug: string };
  const def = catalogBySlug(slug);
  if (!def) { res.status(404).json({ error: "Unknown API slug" }); return; }

  const [row] = await db.select().from(apiIntegrationsTable)
    .where(eq(apiIntegrationsTable.slug, slug)).limit(1);
  const config = row ? maskConfig(decryptConfig(row.configEnc), def) : {};

  res.json({
    slug: def.slug, name: def.name, category: def.category,
    description: def.description, badge: def.badge ?? null,
    testable: def.testable ?? false, fields: def.fields,
    enabled:       row?.enabled ?? false,
    status:        row?.status ?? "untested",
    statusMessage: row?.statusMessage ?? null,
    lastUsedAt:    row?.lastUsedAt ?? null,
    config,
  });
});

// ── PUT /admin/api-integrations/:slug — save config ───────────────────────────

router.put("/admin/api-integrations/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params as { slug: string };
  const def = catalogBySlug(slug);
  if (!def) { res.status(404).json({ error: "Unknown API slug" }); return; }

  const body = req.body as {
    enabled?: boolean;
    config?: Record<string, string>;
  };

  // Load existing
  const [existing] = await db.select().from(apiIntegrationsTable)
    .where(eq(apiIntegrationsTable.slug, slug)).limit(1);
  const existingConfig = existing ? decryptConfig(existing.configEnc) : {};

  // Merge: sensitive fields — keep existing if incoming value is blank or placeholder
  const sens = sensitiveKeys(def);
  const newConfig = { ...existingConfig };
  for (const [k, v] of Object.entries(body.config ?? {})) {
    if (sens.has(k)) {
      if (v && v !== SENSITIVE_FALLBACK) newConfig[k] = v;      // update
      else if (v === "") delete newConfig[k];                    // clear
      // else keep existing
    } else {
      if (v === "") delete newConfig[k];
      else newConfig[k] = v;
    }
  }

  const enc = encryptConfig(newConfig);
  const enabled = body.enabled !== undefined ? body.enabled : (existing?.enabled ?? false);

  await db.insert(apiIntegrationsTable)
    .values({ slug, enabled, configEnc: enc, status: existing?.status ?? "untested",
              statusMessage: existing?.statusMessage, lastUsedAt: existing?.lastUsedAt })
    .onConflictDoUpdate({
      target: apiIntegrationsTable.slug,
      set: { enabled, configEnc: enc, updatedAt: new Date() },
    });

  const [updated] = await db.select().from(apiIntegrationsTable)
    .where(eq(apiIntegrationsTable.slug, slug)).limit(1);
  const maskedConfig = maskConfig(decryptConfig(updated.configEnc), def);
  res.json({ ok: true, config: maskedConfig, enabled: updated.enabled });
});

// ── POST /admin/api-integrations/:slug/toggle ─────────────────────────────────

router.post("/admin/api-integrations/:slug/toggle", async (req, res): Promise<void> => {
  const { slug } = req.params as { slug: string };
  const def = catalogBySlug(slug);
  if (!def) { res.status(404).json({ error: "Unknown API slug" }); return; }

  const { enabled } = req.body as { enabled: boolean };

  await db.insert(apiIntegrationsTable)
    .values({ slug, enabled, configEnc: "", status: "untested" })
    .onConflictDoUpdate({
      target: apiIntegrationsTable.slug,
      set: { enabled, updatedAt: new Date() },
    });

  res.json({ ok: true, enabled });
});

// ── POST /admin/api-integrations/:slug/test ───────────────────────────────────

router.post("/admin/api-integrations/:slug/test", async (req, res): Promise<void> => {
  const { slug } = req.params as { slug: string };
  const def = catalogBySlug(slug);
  if (!def) { res.status(404).json({ error: "Unknown API slug" }); return; }

  const [row] = await db.select().from(apiIntegrationsTable)
    .where(eq(apiIntegrationsTable.slug, slug)).limit(1);
  const config = row ? decryptConfig(row.configEnc) : {};

  const result = await runTest(slug, config);

  // Persist status + lastUsedAt
  await db.insert(apiIntegrationsTable)
    .values({
      slug, enabled: row?.enabled ?? false, configEnc: row?.configEnc ?? "",
      status: result.ok ? "ok" : "error", statusMessage: result.message,
      lastUsedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: apiIntegrationsTable.slug,
      set: { status: result.ok ? "ok" : "error", statusMessage: result.message,
             lastUsedAt: new Date(), updatedAt: new Date() },
    });

  await addLog(slug, "test", result.ok, result.message);
  res.json(result);
});

// ── DELETE /admin/api-integrations/:slug/field/:field — clear one field ───────

router.delete("/admin/api-integrations/:slug/field/:field", async (req, res): Promise<void> => {
  const { slug, field } = req.params as { slug: string; field: string };
  const def = catalogBySlug(slug);
  if (!def) { res.status(404).json({ error: "Unknown API slug" }); return; }

  const [row] = await db.select().from(apiIntegrationsTable)
    .where(eq(apiIntegrationsTable.slug, slug)).limit(1);
  if (!row) { res.json({ ok: true }); return; }

  const config = decryptConfig(row.configEnc);
  delete config[field];
  await db.update(apiIntegrationsTable)
    .set({ configEnc: encryptConfig(config), updatedAt: new Date() })
    .where(eq(apiIntegrationsTable.slug, slug));

  res.json({ ok: true });
});

// ── GET /admin/api-integrations/:slug/logs ────────────────────────────────────

router.get("/admin/api-integrations/:slug/logs", async (req, res): Promise<void> => {
  const { slug } = req.params as { slug: string };
  const logs = await db.select().from(apiIntegrationLogsTable)
    .where(eq(apiIntegrationLogsTable.slug, slug))
    .orderBy(desc(apiIntegrationLogsTable.createdAt))
    .limit(50);
  res.json(logs);
});

export default router;

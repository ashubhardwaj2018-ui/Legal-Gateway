/**
 * WhatsApp CRM Integration — Admin Routes
 * Provider abstraction: starts with WhatsApp Web fallback.
 * Set whatsapp_provider in site_settings to switch to WABA/Twilio/etc.
 */
import { Router, type IRouter } from "express";
import { eq, desc, asc, and, ilike, gte, sql } from "drizzle-orm";
import crypto from "crypto";
import {
  db,
  whatsappTemplatesTable, whatsappMessagesTable, whatsappTriggersTable,
  consultationsTable, siteSettingsTable,
} from "@workspace/db";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(siteSettingsTable);
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

/** Clean a phone number: keep digits + leading +, max 15 chars. */
function cleanNumber(raw: string): string {
  return raw.replace(/[\s\-().]/g, "").replace(/[^\d+]/g, "").slice(0, 15);
}

/** Return a whatsapp.me link (WhatsApp Web fallback). */
function buildWaWebUrl(number: string, message: string): string {
  const clean = cleanNumber(number).replace(/^\+/, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

/** Replace {{Placeholder}} tokens with context values. */
function resolvePlaceholders(body: string, ctx: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => ctx[key] ?? `{{${key}}}`);
}

/** Build a placeholder context from lead + settings. */
async function buildContext(leadId: number | null, settings: Record<string, string>): Promise<Record<string, string>> {
  const base: Record<string, string> = {
    CompanyName:     settings.firm_name ?? settings.site_name ?? "Vakil & Co.",
    Website:         settings.site_url ?? "",
    CompanyWhatsApp: settings.company_whatsapp ?? settings.phone_primary ?? "",
    SupportEmail:    settings.email_primary ?? "",
  };
  if (leadId) {
    const [lead] = await db.select().from(consultationsTable).where(eq(consultationsTable.id, leadId)).limit(1);
    if (lead) {
      base.ClientName      = lead.name;
      base.LeadID          = String(lead.id);
      base.ServiceName     = lead.serviceInterest ?? "";
      base.AssignedEmployee = lead.assignedTo ?? "";
    }
  }
  return base;
}

/** Store a message record and optionally update lead's lastWhatsappMessage. */
async function storeMessage(params: {
  leadId?: number; toNumber: string; fromNumber?: string;
  message: string; templateId?: number; templateName?: string;
  senderType?: string; senderName?: string; senderId?: number;
  status?: string; provider?: string; isBulk?: boolean; bulkBatchId?: string;
}) {
  const [msg] = await db.insert(whatsappMessagesTable).values({
    leadId: params.leadId ?? null,
    toNumber: params.toNumber,
    fromNumber: params.fromNumber ?? null,
    message: params.message,
    templateId: params.templateId ?? null,
    templateName: params.templateName ?? null,
    senderType: params.senderType ?? "employee",
    senderName: params.senderName ?? null,
    senderId: params.senderId ?? null,
    direction: "outgoing",
    status: params.status ?? "sent",
    provider: params.provider ?? "web",
    isBulk: params.isBulk ?? false,
    bulkBatchId: params.bulkBatchId ?? null,
  }).returning();

  // Update lead's last message snapshot
  if (params.leadId) {
    await db.update(consultationsTable).set({
      lastWhatsappMessage: params.message.slice(0, 200),
      lastWhatsappDate: new Date(),
    }).where(eq(consultationsTable.id, params.leadId));
  }
  return msg;
}

// ── Templates ─────────────────────────────────────────────────────────────────

router.get("/admin/whatsapp/templates", async (_req, res): Promise<void> => {
  const templates = await db.select().from(whatsappTemplatesTable)
    .orderBy(asc(whatsappTemplatesTable.name));
  res.json(templates);
});

router.post("/admin/whatsapp/templates", async (req, res): Promise<void> => {
  const { name, category, body, createdBy } = req.body as {
    name?: string; category?: string; body?: string; createdBy?: string;
  };
  if (!name?.trim() || !body?.trim()) {
    res.status(400).json({ error: "name and body are required" }); return;
  }
  const [t] = await db.insert(whatsappTemplatesTable).values({
    name: name.trim(), category: category ?? "general", body: body.trim(),
    createdBy: createdBy ?? null,
  }).returning();
  res.status(201).json(t);
});

router.put("/admin/whatsapp/templates/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, category, body, isActive } = req.body as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  if (name)     update.name = String(name).trim();
  if (category) update.category = String(category);
  if (body)     update.body = String(body).trim();
  if (isActive !== undefined) update.isActive = Boolean(isActive);
  const [t] = await db.update(whatsappTemplatesTable).set(update).where(eq(whatsappTemplatesTable.id, id)).returning();
  if (!t) { res.status(404).json({ error: "Template not found" }); return; }
  res.json(t);
});

router.delete("/admin/whatsapp/templates/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(whatsappTemplatesTable).where(eq(whatsappTemplatesTable.id, id));
  res.json({ ok: true });
});

// ── Preview template with placeholders ───────────────────────────────────────

router.post("/admin/whatsapp/templates/:id/preview", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const leadId = parseInt(String(req.body.leadId ?? ""), 10);
  const [t] = await db.select().from(whatsappTemplatesTable).where(eq(whatsappTemplatesTable.id, id)).limit(1);
  if (!t) { res.status(404).json({ error: "Template not found" }); return; }
  const settings = await getSettings();
  const ctx = await buildContext(isNaN(leadId) ? null : leadId, settings);
  const resolved = resolvePlaceholders(t.body, { ...ctx, ...(req.body.extra ?? {}) });
  res.json({ resolved, original: t.body });
});

// ── Message History ───────────────────────────────────────────────────────────

router.get("/admin/whatsapp/messages", async (req, res): Promise<void> => {
  const leadId = parseInt(String(req.query.leadId ?? ""), 10);
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = 50;
  const offset = (page - 1) * limit;

  const where = isNaN(leadId)
    ? undefined
    : eq(whatsappMessagesTable.leadId, leadId);

  const msgs = await db.select().from(whatsappMessagesTable)
    .where(where)
    .orderBy(desc(whatsappMessagesTable.createdAt))
    .limit(limit).offset(offset);

  res.json(msgs);
});

// ── Send a WhatsApp Message ───────────────────────────────────────────────────
// Returns a waUrl (WhatsApp Web) when no API is configured.
// Set site_settings.whatsapp_provider = "waba"|"twilio" for real sending.

router.post("/admin/whatsapp/send", async (req, res): Promise<void> => {
  const {
    leadId, toNumber, message, templateId, templateName,
    senderName, senderId, extra,
  } = req.body as {
    leadId?: number; toNumber?: string; message?: string; templateId?: number;
    templateName?: string; senderName?: string; senderId?: number;
    extra?: Record<string, string>;
  };

  // Resolve destination number — use leadId if no number provided
  let destination = toNumber ?? "";
  let resolvedLeadId: number | undefined = leadId;

  if (!destination && leadId) {
    const [lead] = await db.select().from(consultationsTable).where(eq(consultationsTable.id, leadId)).limit(1);
    if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }
    destination = cleanNumber(lead.whatsapp ?? lead.phone ?? "");
    if (!destination) { res.status(400).json({ error: "Lead has no WhatsApp/phone number" }); return; }
  }
  if (!destination) { res.status(400).json({ error: "toNumber or leadId required" }); return; }

  const settings = await getSettings();
  const ctx = await buildContext(resolvedLeadId ?? null, settings);

  // Build final message text
  let finalMessage = message ?? "";
  if (templateId) {
    const [tmpl] = await db.select().from(whatsappTemplatesTable).where(eq(whatsappTemplatesTable.id, templateId)).limit(1);
    if (tmpl) finalMessage = resolvePlaceholders(tmpl.body, { ...ctx, ...(extra ?? {}) });
  }
  if (!finalMessage.trim()) { res.status(400).json({ error: "message is required" }); return; }

  const provider = settings.whatsapp_provider ?? "web";
  const fromNumber = settings.company_whatsapp ?? settings.phone_primary ?? "";

  // Store the message
  const msg = await storeMessage({
    leadId: resolvedLeadId, toNumber: destination, fromNumber,
    message: finalMessage, templateId, templateName,
    senderType: "employee", senderName, senderId,
    status: provider === "web" ? "sent" : "pending",
    provider,
  });

  // WhatsApp Web fallback (always generated — frontend opens in new tab)
  const waUrl = buildWaWebUrl(destination, finalMessage);

  // TODO: When provider !== "web", call the respective API here and update status.
  // The provider abstraction is in place — add SDK calls per provider as needed.

  res.json({ ok: true, message: msg, waUrl, provider });
});

// ── Bulk Send ─────────────────────────────────────────────────────────────────

router.post("/admin/whatsapp/bulk", async (req, res): Promise<void> => {
  const {
    filter, templateId, message: customMessage, senderName, senderId, extra,
  } = req.body as {
    filter?: { status?: string; service?: string; city?: string; state?: string; leadIds?: number[] };
    templateId?: number; message?: string;
    senderName?: string; senderId?: number; extra?: Record<string, string>;
  };

  // Resolve template body
  let templateBody = customMessage ?? "";
  let templateName: string | undefined;
  if (templateId) {
    const [tmpl] = await db.select().from(whatsappTemplatesTable).where(eq(whatsappTemplatesTable.id, templateId)).limit(1);
    if (tmpl) { templateBody = tmpl.body; templateName = tmpl.name; }
  }
  if (!templateBody.trim()) { res.status(400).json({ error: "message or templateId required" }); return; }

  // Fetch matching leads
  let leadsQuery = db.select().from(consultationsTable);
  // TypeScript: build where conditions
  const conditions = [];
  if (filter?.status)     conditions.push(eq(consultationsTable.status, filter.status));
  if (filter?.service)    conditions.push(ilike(consultationsTable.serviceInterest, `%${filter.service}%`));
  if (filter?.city)       conditions.push(ilike(consultationsTable.city ?? "", `%${filter.city}%`));
  if (filter?.state)      conditions.push(ilike(consultationsTable.state ?? "", `%${filter.state}%`));

  const leads = (filter?.leadIds?.length)
    ? await db.select().from(consultationsTable).where(sql`${consultationsTable.id} = ANY(${filter.leadIds})`)
    : await db.select().from(consultationsTable).where(conditions.length ? and(...conditions as Parameters<typeof and>) : undefined);

  const settings = await getSettings();
  const provider = settings.whatsapp_provider ?? "web";
  const fromNumber = settings.company_whatsapp ?? settings.phone_primary ?? "";
  const batchId = crypto.randomUUID();

  const results: Array<{ leadId: number; name: string; number: string; waUrl: string }> = [];
  let skipped = 0;

  for (const lead of leads) {
    const destination = cleanNumber(lead.whatsapp ?? lead.phone ?? "");
    if (!destination) { skipped++; continue; }

    const ctx = {
      ClientName:       lead.name,
      LeadID:           String(lead.id),
      ServiceName:      lead.serviceInterest ?? "",
      AssignedEmployee: lead.assignedTo ?? "",
      CompanyName:      settings.firm_name ?? "Vakil & Co.",
      Website:          settings.site_url ?? "",
      CompanyWhatsApp:  settings.company_whatsapp ?? "",
      SupportEmail:     settings.email_primary ?? "",
      ...(extra ?? {}),
    };
    const finalMessage = resolvePlaceholders(templateBody, ctx);

    await storeMessage({
      leadId: lead.id, toNumber: destination, fromNumber,
      message: finalMessage, templateId, templateName,
      senderType: "employee", senderName, senderId,
      status: "sent", provider, isBulk: true, bulkBatchId: batchId,
    });

    results.push({ leadId: lead.id, name: lead.name, number: destination, waUrl: buildWaWebUrl(destination, finalMessage) });
  }

  res.json({ ok: true, batchId, sent: results.length, skipped, results });
});

// ── Triggers Configuration ────────────────────────────────────────────────────

router.get("/admin/whatsapp/triggers", async (_req, res): Promise<void> => {
  const triggers = await db.select().from(whatsappTriggersTable).orderBy(asc(whatsappTriggersTable.event));
  res.json(triggers);
});

router.put("/admin/whatsapp/triggers/:event", async (req, res): Promise<void> => {
  const event = String(req.params.event ?? "");
  const { isEnabled, templateId } = req.body as { isEnabled?: boolean; templateId?: number | null };

  const existing = await db.select().from(whatsappTriggersTable).where(eq(whatsappTriggersTable.event, event)).limit(1);
  const update: Record<string, unknown> = {};
  if (isEnabled !== undefined) update.isEnabled = isEnabled;
  if (templateId !== undefined) update.templateId = templateId;

  if (existing.length) {
    const [t] = await db.update(whatsappTriggersTable).set(update).where(eq(whatsappTriggersTable.event, event)).returning();
    res.json(t);
  } else {
    const [t] = await db.insert(whatsappTriggersTable).values({ event, isEnabled: isEnabled ?? false, templateId: templateId ?? null }).returning();
    res.json(t);
  }
});

// ── Dashboard Stats ───────────────────────────────────────────────────────────

router.get("/admin/whatsapp/dashboard", async (_req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    sentToday, totalMessages, failed, templates, triggers,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(whatsappMessagesTable)
      .where(and(gte(whatsappMessagesTable.createdAt, today), eq(whatsappMessagesTable.direction, "outgoing"))),
    db.select({ count: sql<number>`count(*)::int` }).from(whatsappMessagesTable),
    db.select({ count: sql<number>`count(*)::int` }).from(whatsappMessagesTable)
      .where(eq(whatsappMessagesTable.status, "failed")),
    db.select({ count: sql<number>`count(*)::int` }).from(whatsappTemplatesTable)
      .where(eq(whatsappTemplatesTable.isActive, true)),
    db.select({ count: sql<number>`count(*)::int` }).from(whatsappTriggersTable)
      .where(eq(whatsappTriggersTable.isEnabled, true)),
  ]);

  // Recent messages for activity feed
  const recentMessages = await db.select().from(whatsappMessagesTable)
    .orderBy(desc(whatsappMessagesTable.createdAt)).limit(10);

  res.json({
    sentToday:       sentToday[0]?.count ?? 0,
    totalMessages:   totalMessages[0]?.count ?? 0,
    failedMessages:  failed[0]?.count ?? 0,
    activeTemplates: templates[0]?.count ?? 0,
    activeTriggers:  triggers[0]?.count ?? 0,
    recentMessages,
  });
});

// ── Trigger fire (internal helper exported for use in other routes) ───────────

// ── Test Provider Connection ──────────────────────────────────────────────────

router.post("/admin/whatsapp/test-connection", async (_req, res): Promise<void> => {
  const settings = await getSettings();
  const provider  = (settings.whatsapp_provider ?? "web").toLowerCase();
  const apiKey    = settings.whatsapp_api_key ?? "";
  const phoneId   = settings.whatsapp_phone_number_id ?? "";

  // Web / WhatsApp Web — no credentials needed
  if (provider === "web") {
    res.json({ ok: true, provider, message: "WhatsApp Web mode is active. No API credentials are required — staff send via web.whatsapp.com." });
    return;
  }

  // Validate credentials are present for all API providers
  if (!apiKey) {
    res.json({ ok: false, provider, message: "API Key / Token is not configured. Please enter your credentials and save before testing." });
    return;
  }

  // WABA (Meta Cloud API) — lightweight phone number lookup
  if (provider === "waba") {
    if (!phoneId) {
      res.json({ ok: false, provider, message: "Phone Number ID is required for WABA. Please save your settings first." });
      return;
    }
    try {
      const url = `https://graph.facebook.com/v18.0/${phoneId}?access_token=${encodeURIComponent(apiKey)}`;
      const r = await fetch(url, { method: "GET", signal: AbortSignal.timeout(8000) });
      const body = await r.json() as Record<string, unknown>;
      if (r.ok && body.id) {
        res.json({ ok: true, provider, message: `WABA connected ✓ — Phone Number ID ${phoneId} verified via Meta Graph API.` });
      } else {
        const err = (body.error as Record<string, string> | undefined)?.message ?? "Unexpected response from Meta API.";
        res.json({ ok: false, provider, message: `WABA error: ${err}` });
      }
    } catch (e: unknown) {
      res.json({ ok: false, provider, message: `Connection to Meta API failed: ${e instanceof Error ? e.message : "network error"}` });
    }
    return;
  }

  // Twilio — verify credentials via account fetch
  if (provider === "twilio") {
    // apiKey expected as "AccountSID:AuthToken"
    const [accountSid, authToken] = apiKey.split(":");
    if (!accountSid || !authToken) {
      res.json({ ok: false, provider, message: "For Twilio, enter your credentials as AccountSID:AuthToken in the API Key field." });
      return;
    }
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`;
      const r = await fetch(url, {
        headers: { Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64") },
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) {
        const body = await r.json() as Record<string, unknown>;
        res.json({ ok: true, provider, message: `Twilio connected ✓ — Account ${body.friendly_name ?? accountSid} is active.` });
      } else {
        res.json({ ok: false, provider, message: `Twilio authentication failed (HTTP ${r.status}). Check your Account SID and Auth Token.` });
      }
    } catch (e: unknown) {
      res.json({ ok: false, provider, message: `Connection to Twilio failed: ${e instanceof Error ? e.message : "network error"}` });
    }
    return;
  }

  // 360dialog
  if (provider === "360dialog") {
    try {
      const r = await fetch("https://waba.360dialog.io/v1/configs/webhook", {
        headers: { "D360-API-KEY": apiKey, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      res.json(r.ok
        ? { ok: true,  provider, message: "360dialog API key is valid ✓" }
        : { ok: false, provider, message: `360dialog returned HTTP ${r.status}. Check your API key.` });
    } catch (e: unknown) {
      res.json({ ok: false, provider, message: `Connection to 360dialog failed: ${e instanceof Error ? e.message : "network error"}` });
    }
    return;
  }

  // Gupshup / Interakt / other — just confirm credentials are present
  res.json({
    ok: true,
    provider,
    message: `${provider} credentials are saved. A live test message is required to verify delivery for this provider.`,
  });
});

export async function fireWhatsAppTrigger(event: string, leadId: number, extra?: Record<string, string>) {
  try {
    const [trigger] = await db.select().from(whatsappTriggersTable)
      .where(and(eq(whatsappTriggersTable.event, event), eq(whatsappTriggersTable.isEnabled, true)))
      .limit(1);
    if (!trigger) return; // trigger disabled

    const [lead] = await db.select().from(consultationsTable).where(eq(consultationsTable.id, leadId)).limit(1);
    if (!lead) return;

    const destination = cleanNumber(lead.whatsapp ?? lead.phone ?? "");
    if (!destination) return;

    const settings = await getSettings();
    const ctx = await buildContext(leadId, settings);

    let messageBody = "";
    let templateName: string | undefined;
    if (trigger.templateId) {
      const [tmpl] = await db.select().from(whatsappTemplatesTable)
        .where(eq(whatsappTemplatesTable.id, trigger.templateId)).limit(1);
      if (tmpl) { messageBody = tmpl.body; templateName = tmpl.name; }
    }
    if (!messageBody) return; // no template assigned

    const finalMessage = resolvePlaceholders(messageBody, { ...ctx, ...(extra ?? {}) });

    await storeMessage({
      leadId, toNumber: destination,
      fromNumber: settings.company_whatsapp ?? "",
      message: finalMessage, templateId: trigger.templateId ?? undefined,
      templateName, senderType: "system", senderName: "CRM Auto",
      status: "sent", provider: settings.whatsapp_provider ?? "web",
    });
  } catch { /* non-fatal */ }
}

export default router;

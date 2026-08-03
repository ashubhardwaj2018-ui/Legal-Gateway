import { Router, type IRouter } from "express";
import { eq, desc, ilike, and } from "drizzle-orm";
import crypto from "crypto";
import nodemailer from "nodemailer";
import {
  db, portalAccessRequestsTable, portalTokensTable,
  consultationsTable, siteSettingsTable,
} from "@workspace/db";
import type { AuthenticatedRequest } from "./auth";

const router: IRouter = Router();

function generateToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(siteSettingsTable);
  const m: Record<string, string> = {};
  for (const r of rows) m[r.key] = r.value;
  return m;
}

// ── GET /admin/portal-access — list all requests ──────────────────────────────

router.get("/admin/portal-access", async (req, res): Promise<void> => {
  const rows = await db.select().from(portalAccessRequestsTable)
    .orderBy(desc(portalAccessRequestsTable.createdAt));
  res.json(rows);
});

// ── GET /admin/portal-access/count — pending badge count ──────────────────────

router.get("/admin/portal-access/count", async (_req, res): Promise<void> => {
  const rows = await db.select().from(portalAccessRequestsTable)
    .where(eq(portalAccessRequestsTable.status, "pending"));
  res.json({ count: rows.length });
});

// ── POST /admin/portal-access/:id/approve — approve + send magic link ─────────

router.post("/admin/portal-access/:id/approve", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [request] = await db.select().from(portalAccessRequestsTable)
    .where(eq(portalAccessRequestsTable.id, id)).limit(1);
  if (!request) { res.status(404).json({ error: "Request not found" }); return; }
  if (request.status !== "pending") {
    res.status(400).json({ error: "Request is not pending" }); return;
  }

  const actorName = String((req as AuthenticatedRequest).adminUser?.username ?? "Admin");

  // Mark approved
  await db.update(portalAccessRequestsTable)
    .set({ status: "approved", reviewedBy: actorName, reviewedAt: new Date() })
    .where(eq(portalAccessRequestsTable.id, id));

  // Generate magic link token
  const email = request.email.toLowerCase().trim();
  await db.delete(portalTokensTable).where(eq(portalTokensTable.email, email));
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(portalTokensTable).values({ email, token, expiresAt });

  const cfg = await getSettings();
  const appUrl = process.env.APP_URL ?? `https://${process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost"}`;
  const link = `${appUrl}/portal/dashboard?token=${token}`;

  let emailSent = false;
  if (cfg.email_smtp_host) {
    try {
      const transporter = nodemailer.createTransport({
        host: cfg.email_smtp_host,
        port: parseInt(cfg.email_smtp_port ?? "587", 10),
        secure: cfg.email_smtp_secure === "true",
        auth: { user: cfg.email_smtp_user, pass: cfg.email_smtp_pass },
      });
      const firmName = cfg.firm_name ?? "Legal Filing India";
      await transporter.sendMail({
        from: `"${cfg.email_from_name ?? firmName}" <${cfg.email_from_email ?? cfg.email_smtp_user}>`,
        to: email,
        subject: `Your Portal Access Has Been Approved — ${firmName}`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
<div style="background:#0f2044;padding:28px 32px;border-radius:12px 12px 0 0">
  <h1 style="color:#c9a227;margin:0;font-size:20px">${firmName}</h1>
  <p style="color:#ffffff99;margin:4px 0 0;font-size:13px">Client Portal Access Approved</p>
</div>
<div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px">
  <p style="font-size:16px;color:#333">Hello${request.name ? ` ${request.name}` : ""},</p>
  <p style="color:#555">Your request to access the ${firmName} client portal has been <strong style="color:#16a34a">approved</strong>. Click the button below to log in — the link is valid for <strong>24 hours</strong>.</p>
  <div style="text-align:center;margin:28px 0">
    <a href="${link}" style="display:inline-block;background:#0f2044;color:#c9a227;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:bold;font-size:15px">Access My Portal →</a>
  </div>
  <p style="font-size:12px;color:#aaa">Or paste: <a href="${link}" style="color:#0f2044;word-break:break-all">${link}</a></p>
  <p style="font-size:12px;color:#ccc;margin-top:24px">If you did not request portal access, ignore this email.</p>
</div></div>`,
      });
      emailSent = true;
    } catch { /* SMTP not configured or failed */ }
  }

  res.json({ ok: true, emailSent, link });
});

// ── GET /admin/portal-access/:id/link — get (or regenerate) the access link ───

router.get("/admin/portal-access/:id/link", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [request] = await db.select().from(portalAccessRequestsTable)
    .where(eq(portalAccessRequestsTable.id, id)).limit(1);
  if (!request) { res.status(404).json({ error: "Request not found" }); return; }
  if (request.status !== "approved") { res.status(400).json({ error: "Request is not approved" }); return; }

  const email = request.email.toLowerCase().trim();

  // Reuse existing non-expired token, or generate a fresh one
  const [existing] = await db.select().from(portalTokensTable)
    .where(eq(portalTokensTable.email, email)).limit(1);

  let token: string;
  if (existing && new Date(existing.expiresAt) > new Date()) {
    token = existing.token;
  } else {
    await db.delete(portalTokensTable).where(eq(portalTokensTable.email, email));
    token = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.insert(portalTokensTable).values({ email, token, expiresAt });
  }

  const appUrl = process.env.APP_URL ?? `https://${process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost"}`;
  const link = `${appUrl}/portal/dashboard?token=${token}`;
  res.json({ link });
});

// ── POST /admin/portal-access/:id/reject — reject request ─────────────────────

router.post("/admin/portal-access/:id/reject", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [request] = await db.select().from(portalAccessRequestsTable)
    .where(eq(portalAccessRequestsTable.id, id)).limit(1);
  if (!request) { res.status(404).json({ error: "Request not found" }); return; }

  const actorName = String((req as AuthenticatedRequest).adminUser?.username ?? "Admin");

  await db.update(portalAccessRequestsTable)
    .set({ status: "rejected", reviewedBy: actorName, reviewedAt: new Date() })
    .where(eq(portalAccessRequestsTable.id, id));

  res.json({ ok: true });
});

// ── DELETE /admin/portal-access/:id — remove a request ────────────────────────

router.delete("/admin/portal-access/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(portalAccessRequestsTable)
    .where(eq(portalAccessRequestsTable.id, id));
  res.json({ ok: true });
});

export default router;

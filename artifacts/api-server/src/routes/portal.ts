import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, desc, ilike } from "drizzle-orm";
import crypto from "crypto";
import nodemailer from "nodemailer";
import {
  db, portalTokensTable, portalMessagesTable,
  consultationsTable, invoicesTable, siteSettingsTable,
} from "@workspace/db";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(siteSettingsTable);
  const m: Record<string, string> = {};
  for (const r of rows) m[r.key] = r.value;
  return m;
}

async function verifyPortalToken(token: string): Promise<{ email: string } | null> {
  const [row] = await db.select().from(portalTokensTable)
    .where(and(eq(portalTokensTable.token, token)));
  if (!row) return null;
  if (new Date(row.expiresAt) < new Date()) return null;
  return { email: row.email };
}

async function portalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = (req.headers["x-portal-token"] as string) ?? (req.query.token as string);
  if (!token) { res.status(401).json({ error: "Portal token required" }); return; }
  const session = await verifyPortalToken(token);
  if (!session) { res.status(401).json({ error: "Invalid or expired token. Please request a new access link." }); return; }
  (req as Request & { portalEmail: string }).portalEmail = session.email;
  next();
}

// ── Request Access (sends magic link) ────────────────────────────────────────

router.post("/portal/request-access", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email) { res.status(400).json({ error: "Email required" }); return; }

  // Check email exists in consultations
  const leads = await db.select().from(consultationsTable)
    .where(ilike(consultationsTable.email, email.trim())).limit(1);
  if (leads.length === 0) {
    // Return success anyway (don't leak if email exists)
    res.json({ ok: true, hint: "If your email is registered, you will receive an access link." });
    return;
  }

  // Revoke old tokens
  const existing = await db.select().from(portalTokensTable)
    .where(eq(portalTokensTable.email, email.toLowerCase().trim()));
  for (const old of existing) {
    await db.delete(portalTokensTable).where(eq(portalTokensTable.id, old.id));
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await db.insert(portalTokensTable).values({
    email: email.toLowerCase().trim(),
    token,
    expiresAt,
  });

  const cfg = await getSettings();
  const appUrl = process.env.APP_URL ?? `https://${process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost"}`;
  const link = `${appUrl}/portal/dashboard?token=${token}`;

  // Try sending email
  let emailSent = false;
  if (cfg.email_smtp_host) {
    try {
      const transporter = nodemailer.createTransport({
        host: cfg.email_smtp_host,
        port: parseInt(cfg.email_smtp_port ?? "587", 10),
        secure: cfg.email_smtp_secure === "true",
        auth: { user: cfg.email_smtp_user, pass: cfg.email_smtp_pass },
      });
      const firmName = cfg.firm_name ?? "Vakil & Co.";
      await transporter.sendMail({
        from: `"${cfg.email_from_name ?? firmName}" <${cfg.email_from_email ?? cfg.email_smtp_user}>`,
        to: email,
        subject: `Your Secure Portal Access — ${firmName}`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
<div style="background:#0f2044;padding:28px 32px;border-radius:12px 12px 0 0">
  <h1 style="color:#c9a227;margin:0;font-size:20px">${firmName}</h1>
  <p style="color:#ffffff99;margin:4px 0 0;font-size:13px">Client Portal Access</p>
</div>
<div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px">
  <p style="font-size:16px;color:#333">Hello,</p>
  <p style="color:#555">Here is your secure, one-time login link for the ${firmName} client portal. This link is valid for <strong>24 hours</strong>.</p>
  <div style="text-align:center;margin:28px 0">
    <a href="${link}" style="display:inline-block;background:#0f2044;color:#c9a227;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:bold;font-size:15px">Access My Portal →</a>
  </div>
  <p style="font-size:12px;color:#aaa">Or paste this URL in your browser:<br/><a href="${link}" style="color:#0f2044;word-break:break-all">${link}</a></p>
  <p style="font-size:12px;color:#ccc;margin-top:24px">If you did not request this, you can safely ignore this email.</p>
</div></div>`,
      });
      emailSent = true;
    } catch (_) { /* SMTP error — fall through to token in response */ }
  }

  res.json({
    ok: true,
    emailSent,
    // In dev / no SMTP: return token so user can test immediately
    ...(!emailSent ? { devToken: token, devLink: link } : {}),
    hint: emailSent
      ? "Access link sent to your email. Check your inbox (and spam folder)."
      : "Email sending is not configured. Use the link below to access your portal.",
  });
});

// ── Verify Token ──────────────────────────────────────────────────────────────

router.get("/portal/verify", async (req, res): Promise<void> => {
  const token = req.query.token as string | undefined;
  if (!token) { res.status(400).json({ error: "Token required" }); return; }
  const session = await verifyPortalToken(token);
  if (!session) { res.status(401).json({ error: "Invalid or expired token" }); return; }

  // Mark used
  await db.update(portalTokensTable).set({ usedAt: new Date() })
    .where(eq(portalTokensTable.token, token));

  const leads = await db.select().from(consultationsTable)
    .where(ilike(consultationsTable.email, session.email))
    .orderBy(desc(consultationsTable.createdAt)).limit(1);

  res.json({
    ok: true,
    email: session.email,
    name: leads[0]?.name ?? session.email.split("@")[0],
    company: leads[0]?.company ?? null,
  });
});

// ── Client: Cases ─────────────────────────────────────────────────────────────

router.get("/portal/cases", portalAuth, async (req, res): Promise<void> => {
  const email = (req as Request & { portalEmail: string }).portalEmail;
  const cases = await db.select().from(consultationsTable)
    .where(ilike(consultationsTable.email, email))
    .orderBy(desc(consultationsTable.createdAt));
  res.json(cases.map(c => ({
    id: c.id, service: c.serviceInterest, status: c.status,
    priority: c.priority, assignedTo: c.assignedTo,
    nextFollowUp: c.nextFollowUp,
    notes: c.notes, createdAt: c.createdAt,
    message: c.message,
  })));
});

// ── Client: Invoices ──────────────────────────────────────────────────────────

router.get("/portal/invoices", portalAuth, async (req, res): Promise<void> => {
  const email = (req as Request & { portalEmail: string }).portalEmail;
  const invs = await db.select().from(invoicesTable)
    .where(and(ilike(invoicesTable.clientEmail, email), eq(invoicesTable.type, "invoice")))
    .orderBy(desc(invoicesTable.createdAt));
  res.json(invs.map(i => ({
    id: i.id, number: i.number, status: i.status,
    subtotal: i.subtotal, gstAmount: i.gstAmount, total: i.total,
    paidAmount: i.paidAmount, dueDate: i.dueDate,
    items: i.items, notes: i.notes, createdAt: i.createdAt,
  })));
});

// ── Client: Send Message ──────────────────────────────────────────────────────

router.post("/portal/message", portalAuth, async (req, res): Promise<void> => {
  const email = (req as Request & { portalEmail: string }).portalEmail;
  const { subject, message, clientName } = req.body as Record<string, string>;
  if (!subject || !message) { res.status(400).json({ error: "Subject and message required" }); return; }

  await db.insert(portalMessagesTable).values({
    clientEmail: email, clientName: clientName ?? null, subject, message,
  });
  res.status(201).json({ ok: true });
});

// ── Client: Message History ───────────────────────────────────────────────────

router.get("/portal/messages", portalAuth, async (req, res): Promise<void> => {
  const email = (req as Request & { portalEmail: string }).portalEmail;
  const msgs = await db.select().from(portalMessagesTable)
    .where(eq(portalMessagesTable.clientEmail, email))
    .orderBy(desc(portalMessagesTable.createdAt));
  res.json(msgs);
});

// ── Admin: View Portal Messages ───────────────────────────────────────────────

router.get("/admin/portal/messages", async (_req, res): Promise<void> => {
  const msgs = await db.select().from(portalMessagesTable)
    .orderBy(desc(portalMessagesTable.createdAt));
  res.json(msgs);
});

router.patch("/admin/portal/messages/:id/read", async (req, res): Promise<void> => {
  await db.update(portalMessagesTable)
    .set({ isRead: "true" })
    .where(eq(portalMessagesTable.id, parseInt(req.params.id, 10)));
  res.json({ ok: true });
});

// ── Admin: Generate Portal Link for a Lead ────────────────────────────────────

router.post("/admin/portal/generate-link/:leadId", async (req, res): Promise<void> => {
  const leadId = parseInt(req.params.leadId, 10);
  const [lead] = await db.select().from(consultationsTable).where(eq(consultationsTable.id, leadId));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }
  if (!lead.email) { res.status(400).json({ error: "Lead has no email address" }); return; }

  // Revoke old tokens for this email
  await db.delete(portalTokensTable).where(eq(portalTokensTable.email, lead.email.toLowerCase()));

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await db.insert(portalTokensTable).values({ email: lead.email.toLowerCase(), token, expiresAt });

  const appUrl = process.env.APP_URL ?? `https://${process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost"}`;
  const link = `${appUrl}/portal/dashboard?token=${token}`;

  res.json({ ok: true, link, token, email: lead.email, expiresAt });
});

export default router;

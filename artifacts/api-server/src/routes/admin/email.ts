import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, ilike, and } from "drizzle-orm";
import nodemailer from "nodemailer";
import { requirePermission } from "./auth";
import { db, emailTemplatesTable, emailLogsTable, siteSettingsTable, consultationsTable, invoicesTable } from "@workspace/db";

const router: IRouter = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getSmtpSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(siteSettingsTable);
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

function renderTemplate(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

function buildVars(settings: Record<string, string>, lead?: Record<string, unknown>, inv?: Record<string, unknown>): Record<string, string> {
  return {
    firm_name: settings.firm_name ?? "Vakil & Co.",
    firm_email: settings.email ?? "",
    firm_phone: settings.phone ?? "",
    firm_address: settings.address ?? "",
    client_name: String(lead?.name ?? inv?.clientName ?? ""),
    client_email: String(lead?.email ?? inv?.clientEmail ?? ""),
    client_company: String(lead?.company ?? ""),
    invoice_number: String(inv?.number ?? ""),
    invoice_total: inv?.total ? `₹${parseFloat(String(inv.total)).toLocaleString("en-IN")}` : "",
    invoice_due: String(inv?.dueDate ?? ""),
    service_name: String(lead?.serviceInterest ?? ""),
    year: String(new Date().getFullYear()),
  };
}

const TRACKING_PIXEL = (logId: number) =>
  `<img src="${process.env.APP_URL ?? ""}/api/admin/email/logs/${logId}/track" width="1" height="1" alt="" style="display:block;border:0" />`;

// ── Default Templates ─────────────────────────────────────────────────────────

const DEFAULT_TEMPLATES = [
  {
    name: "Invoice Email",
    subject: "Invoice {{invoice_number}} from {{firm_name}}",
    type: "invoice",
    htmlBody: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333">
<div style="background:#0f2044;padding:24px 32px;border-radius:12px 12px 0 0">
  <h1 style="color:#c9a227;margin:0;font-size:22px">{{firm_name}}</h1>
  <p style="color:#fff;opacity:.7;margin:4px 0 0;font-size:13px">Legal Services</p>
</div>
<div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:0">
  <p style="font-size:16px">Dear <strong>{{client_name}}</strong>,</p>
  <p>Please find attached your invoice <strong>{{invoice_number}}</strong>.</p>
  <div style="background:#f9f9f9;border-radius:8px;padding:20px;margin:20px 0;text-align:center">
    <div style="font-size:13px;color:#888;margin-bottom:4px">Total Amount Due</div>
    <div style="font-size:32px;font-weight:bold;color:#0f2044">{{invoice_total}}</div>
    <div style="font-size:12px;color:#aaa;margin-top:4px">Due by {{invoice_due}}</div>
  </div>
  <p>Please make payment at your earliest convenience. For any questions, feel free to reach out.</p>
  <p style="margin-top:32px;font-size:13px;color:#888">Warm regards,<br><strong>{{firm_name}}</strong><br>{{firm_phone}} | {{firm_email}}</p>
</div>
<div style="background:#f3f4f6;padding:12px 32px;border-radius:0 0 12px 12px;text-align:center;font-size:11px;color:#999">
  © {{year}} {{firm_name}} · All rights reserved
</div>
</div>`,
  },
  {
    name: "Quotation Email",
    subject: "Quotation from {{firm_name}} — {{service_name}}",
    type: "quotation",
    htmlBody: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333">
<div style="background:#0f2044;padding:24px 32px;border-radius:12px 12px 0 0">
  <h1 style="color:#c9a227;margin:0;font-size:22px">{{firm_name}}</h1>
  <p style="color:#fff;opacity:.7;margin:4px 0 0;font-size:13px">Legal Services</p>
</div>
<div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:0">
  <p style="font-size:16px">Dear <strong>{{client_name}}</strong>,</p>
  <p>Thank you for your interest in our <strong>{{service_name}}</strong> services. Please find the attached quotation prepared exclusively for you.</p>
  <p>Our team is happy to discuss the scope, timeline, and pricing in detail. Please feel free to call or email us.</p>
  <div style="margin:24px 0;padding:16px 24px;border-left:4px solid #c9a227;background:#fffdf0">
    <p style="margin:0;font-style:italic;color:#555">"We are committed to delivering reliable and cost-effective legal solutions tailored to your needs."</p>
  </div>
  <p style="margin-top:32px;font-size:13px;color:#888">Warm regards,<br><strong>{{firm_name}}</strong><br>{{firm_phone}} | {{firm_email}}</p>
</div>
<div style="background:#f3f4f6;padding:12px 32px;border-radius:0 0 12px 12px;text-align:center;font-size:11px;color:#999">
  © {{year}} {{firm_name}} · All rights reserved
</div>
</div>`,
  },
  {
    name: "Payment Reminder",
    subject: "Payment Reminder — Invoice {{invoice_number}}",
    type: "reminder",
    htmlBody: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333">
<div style="background:#0f2044;padding:24px 32px;border-radius:12px 12px 0 0">
  <h1 style="color:#c9a227;margin:0;font-size:22px">Payment Reminder</h1>
  <p style="color:#fff;opacity:.7;margin:4px 0 0;font-size:13px">{{firm_name}}</p>
</div>
<div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:0">
  <p style="font-size:16px">Dear <strong>{{client_name}}</strong>,</p>
  <p>This is a gentle reminder that invoice <strong>{{invoice_number}}</strong> for <strong>{{invoice_total}}</strong> is due for payment.</p>
  <div style="background:#fff8f0;border:1px solid #fed7aa;border-radius:8px;padding:16px 24px;margin:20px 0">
    <p style="margin:0;color:#92400e;font-size:14px">⚠️ Please ensure payment is made by <strong>{{invoice_due}}</strong> to avoid any late fees.</p>
  </div>
  <p>If you have already made the payment, please disregard this message. For any queries, please contact us.</p>
  <p style="margin-top:32px;font-size:13px;color:#888">Regards,<br><strong>{{firm_name}}</strong><br>{{firm_phone}} | {{firm_email}}</p>
</div>
<div style="background:#f3f4f6;padding:12px 32px;border-radius:0 0 12px 12px;text-align:center;font-size:11px;color:#999">
  © {{year}} {{firm_name}} · All rights reserved
</div>
</div>`,
  },
  {
    name: "Welcome Email",
    subject: "Welcome to {{firm_name}} — We're glad to have you",
    type: "welcome",
    htmlBody: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333">
<div style="background:#0f2044;padding:24px 32px;border-radius:12px 12px 0 0">
  <h1 style="color:#c9a227;margin:0;font-size:22px">Welcome to {{firm_name}}</h1>
  <p style="color:#fff;opacity:.7;margin:4px 0 0;font-size:13px">Your Trusted Legal Partner</p>
</div>
<div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:0">
  <p style="font-size:16px">Dear <strong>{{client_name}}</strong>,</p>
  <p>Thank you for reaching out to us. We have received your enquiry and our team will get in touch with you shortly.</p>
  <p>At {{firm_name}}, we specialise in providing comprehensive legal services including trademark registration, company formation, GST compliance, property matters, and more.</p>
  <p>In the meantime, feel free to browse our services or call us for an immediate consultation.</p>
  <p style="margin-top:32px;font-size:13px;color:#888">Warm regards,<br><strong>{{firm_name}}</strong><br>{{firm_phone}} | {{firm_email}}</p>
</div>
<div style="background:#f3f4f6;padding:12px 32px;border-radius:0 0 12px 12px;text-align:center;font-size:11px;color:#999">
  © {{year}} {{firm_name}} · All rights reserved
</div>
</div>`,
  },
  {
    name: "Follow-up Email",
    subject: "Following up — {{service_name}} at {{firm_name}}",
    type: "followup",
    htmlBody: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333">
<div style="background:#0f2044;padding:24px 32px;border-radius:12px 12px 0 0">
  <h1 style="color:#c9a227;margin:0;font-size:22px">Following Up</h1>
  <p style="color:#fff;opacity:.7;margin:4px 0 0;font-size:13px">{{firm_name}}</p>
</div>
<div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:0">
  <p style="font-size:16px">Dear <strong>{{client_name}}</strong>,</p>
  <p>I hope this message finds you well. I wanted to follow up regarding your enquiry about <strong>{{service_name}}</strong>.</p>
  <p>We would love to assist you further and answer any questions you may have. Please let us know a convenient time for a call or meeting.</p>
  <p>We look forward to hearing from you.</p>
  <p style="margin-top:32px;font-size:13px;color:#888">Warm regards,<br><strong>{{firm_name}}</strong><br>{{firm_phone}} | {{firm_email}}</p>
</div>
<div style="background:#f3f4f6;padding:12px 32px;border-radius:0 0 12px 12px;text-align:center;font-size:11px;color:#999">
  © {{year}} {{firm_name}} · All rights reserved
</div>
</div>`,
  },
];

async function seedTemplates() {
  const [existing] = await db.select().from(emailTemplatesTable).limit(1);
  if (!existing) {
    await db.insert(emailTemplatesTable).values(DEFAULT_TEMPLATES);
  }
}

// ── SMTP Settings ─────────────────────────────────────────────────────────────

router.get("/admin/email/settings", async (_req, res): Promise<void> => {
  const cfg = await getSmtpSettings();
  res.json({
    host: cfg.email_smtp_host ?? "",
    port: cfg.email_smtp_port ?? "587",
    secure: cfg.email_smtp_secure ?? "false",
    user: cfg.email_smtp_user ?? "",
    pass: cfg.email_smtp_pass ? "••••••••" : "",
    fromName: cfg.email_from_name ?? cfg.firm_name ?? "Vakil & Co.",
    fromEmail: cfg.email_from_email ?? cfg.email ?? "",
    replyTo: cfg.email_reply_to ?? "",
  });
});

router.put("/admin/email/settings", async (req, res): Promise<void> => {
  const { host, port, secure, user, pass, fromName, fromEmail, replyTo } = req.body as Record<string, string>;
  const kvs = [
    ["email_smtp_host", host ?? ""],
    ["email_smtp_port", port ?? "587"],
    ["email_smtp_secure", secure ?? "false"],
    ["email_smtp_user", user ?? ""],
    ["email_from_name", fromName ?? ""],
    ["email_from_email", fromEmail ?? ""],
    ["email_reply_to", replyTo ?? ""],
  ];
  if (pass && pass !== "••••••••") kvs.push(["email_smtp_pass", pass]);
  for (const [key, value] of kvs) {
    await db.insert(siteSettingsTable).values({ key, value }).onConflictDoUpdate({ target: siteSettingsTable.key, set: { value } });
  }
  res.json({ ok: true });
});

router.post("/admin/email/settings/test", async (req, res): Promise<void> => {
  const { toEmail } = req.body as { toEmail?: string };
  if (!toEmail) { res.status(400).json({ error: "Recipient email required" }); return; }
  const cfg = await getSmtpSettings();
  const host = cfg.email_smtp_host;
  if (!host) { res.status(400).json({ error: "SMTP not configured" }); return; }
  try {
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(cfg.email_smtp_port ?? "587", 10),
      secure: cfg.email_smtp_secure === "true",
      auth: { user: cfg.email_smtp_user, pass: cfg.email_smtp_pass },
    });
    await transporter.verify();
    await transporter.sendMail({
      from: `"${cfg.email_from_name ?? "Vakil & Co."}" <${cfg.email_from_email ?? cfg.email_smtp_user}>`,
      to: toEmail,
      subject: "✅ Test Email — SMTP Working",
      html: "<p>Your SMTP configuration is working correctly. This is a test email from <b>Vakil & Co. ERP</b>.</p>",
    });
    res.json({ ok: true, message: "Test email sent successfully" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: msg });
  }
});

// ── Templates ─────────────────────────────────────────────────────────────────

router.get("/admin/email/templates", async (_req, res): Promise<void> => {
  await seedTemplates();
  const templates = await db.select().from(emailTemplatesTable).orderBy(emailTemplatesTable.type);
  res.json(templates);
});

router.post("/admin/email/templates", async (req, res): Promise<void> => {
  const { name, subject, htmlBody, type } = req.body as Record<string, string>;
  if (!name || !subject || !htmlBody) { res.status(400).json({ error: "name, subject, htmlBody required" }); return; }
  const [t] = await db.insert(emailTemplatesTable).values({ name, subject, htmlBody, type: type ?? "custom" }).returning();
  res.status(201).json(t);
});

router.put("/admin/email/templates/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { name, subject, htmlBody, type, isActive } = req.body as Record<string, string | boolean>;
  const [t] = await db.update(emailTemplatesTable)
    .set({ name: String(name ?? ""), subject: String(subject ?? ""), htmlBody: String(htmlBody ?? ""), type: String(type ?? "custom"), isActive: Boolean(isActive !== false), updatedAt: new Date() })
    .where(eq(emailTemplatesTable.id, id)).returning();
  if (!t) { res.status(404).json({ error: "Not found" }); return; }
  res.json(t);
});

router.delete("/admin/email/templates/:id", async (req, res): Promise<void> => {
  await db.delete(emailTemplatesTable).where(eq(emailTemplatesTable.id, parseInt(req.params.id, 10)));
  res.sendStatus(204);
});

// ── Send Email ────────────────────────────────────────────────────────────────

async function sendEmail(opts: { toEmail: string; toName?: string; subject: string; htmlBody: string; type: string; templateId?: number; leadId?: number; invoiceId?: number }) {
  const cfg = await getSmtpSettings();
  if (!cfg.email_smtp_host) throw new Error("SMTP not configured. Please update Email Settings.");

  const [logRow] = await db.insert(emailLogsTable).values({
    toEmail: opts.toEmail, toName: opts.toName ?? null, subject: opts.subject,
    type: opts.type, status: "queued", templateId: opts.templateId ?? null,
    leadId: opts.leadId ?? null, invoiceId: opts.invoiceId ?? null,
  }).returning();

  const fullHtml = opts.htmlBody + TRACKING_PIXEL(logRow.id);

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.email_smtp_host,
      port: parseInt(cfg.email_smtp_port ?? "587", 10),
      secure: cfg.email_smtp_secure === "true",
      auth: { user: cfg.email_smtp_user, pass: cfg.email_smtp_pass },
    });
    const info = await transporter.sendMail({
      from: `"${cfg.email_from_name ?? "Vakil & Co."}" <${cfg.email_from_email ?? cfg.email_smtp_user}>`,
      to: opts.toName ? `"${opts.toName}" <${opts.toEmail}>` : opts.toEmail,
      replyTo: cfg.email_reply_to || undefined,
      subject: opts.subject,
      html: fullHtml,
    });
    await db.update(emailLogsTable).set({ status: "sent", messageId: info.messageId, sentAt: new Date() }).where(eq(emailLogsTable.id, logRow.id));
    return { ok: true, logId: logRow.id, messageId: info.messageId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Send failed";
    await db.update(emailLogsTable).set({ status: "failed", errorMsg: msg }).where(eq(emailLogsTable.id, logRow.id));
    throw new Error(msg);
  }
}

router.post("/admin/email/send", requirePermission("email", "send"), async (req, res): Promise<void> => {
  const { toEmail, toName, subject, htmlBody, type, templateId, leadId, invoiceId } = req.body as Record<string, string | number | undefined>;
  if (!toEmail || !subject) { res.status(400).json({ error: "toEmail and subject are required" }); return; }

  // Resolve variables
  const cfg = await getSmtpSettings();
  let lead: Record<string, unknown> | undefined;
  let inv: Record<string, unknown> | undefined;
  if (leadId) { const r = await db.select().from(consultationsTable).where(eq(consultationsTable.id, Number(leadId))); lead = r[0] as Record<string, unknown>; }
  if (invoiceId) { const r = await db.select().from(invoicesTable).where(eq(invoicesTable.id, Number(invoiceId))); inv = r[0] as Record<string, unknown>; }
  const vars = buildVars(cfg, lead, inv);

  const rendered = renderTemplate(String(htmlBody ?? ""), vars);
  const renderedSubject = renderTemplate(String(subject), vars);

  try {
    const result = await sendEmail({ toEmail: String(toEmail), toName: toName ? String(toName) : undefined, subject: renderedSubject, htmlBody: rendered, type: String(type ?? "custom"), templateId: templateId ? Number(templateId) : undefined, leadId: leadId ? Number(leadId) : undefined, invoiceId: invoiceId ? Number(invoiceId) : undefined });
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Send failed" });
  }
});

router.post("/admin/email/send-invoice/:id", requirePermission("email", "send"), async (req, res): Promise<void> => {
  const invoiceId = parseInt(req.params.id, 10);
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
  if (!inv || !inv.clientEmail) { res.status(400).json({ error: "Invoice not found or no client email" }); return; }

  const cfg = await getSmtpSettings();
  const lead = inv.leadId ? (await db.select().from(consultationsTable).where(eq(consultationsTable.id, inv.leadId)))[0] : undefined;
  const vars = buildVars(cfg, lead as Record<string, unknown>, inv as unknown as Record<string, unknown>);

  const [tmpl] = await db.select().from(emailTemplatesTable).where(and(eq(emailTemplatesTable.type, "invoice"), eq(emailTemplatesTable.isActive, true))).limit(1);
  const subject = renderTemplate(tmpl?.subject ?? "Invoice {{invoice_number}} from {{firm_name}}", vars);
  const html = renderTemplate(tmpl?.htmlBody ?? "<p>Please find your invoice attached.</p>", vars);

  try {
    const result = await sendEmail({ toEmail: inv.clientEmail, toName: inv.clientName, subject, htmlBody: html, type: "invoice", templateId: tmpl?.id, invoiceId });
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Send failed" });
  }
});

// ── Logs ──────────────────────────────────────────────────────────────────────

router.get("/admin/email/logs", async (req, res): Promise<void> => {
  const { status, type, search } = req.query as Record<string, string | undefined>;
  const conds = [];
  if (status) conds.push(eq(emailLogsTable.status, status));
  if (type) conds.push(eq(emailLogsTable.type, type));
  if (search) conds.push(ilike(emailLogsTable.toEmail, `%${search}%`));
  const rows = conds.length
    ? await db.select().from(emailLogsTable).where(and(...conds as [ReturnType<typeof eq>])).orderBy(desc(emailLogsTable.createdAt)).limit(200)
    : await db.select().from(emailLogsTable).orderBy(desc(emailLogsTable.createdAt)).limit(200);
  res.json(rows);
});

router.get("/admin/email/logs/:id/track", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [log] = await db.select().from(emailLogsTable).where(eq(emailLogsTable.id, id));
  if (log && !log.openedAt) {
    await db.update(emailLogsTable).set({ openedAt: new Date() }).where(eq(emailLogsTable.id, id));
  }
  // Return 1x1 transparent GIF
  const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store");
  res.end(gif);
});

router.delete("/admin/email/logs/:id", async (req, res): Promise<void> => {
  await db.delete(emailLogsTable).where(eq(emailLogsTable.id, parseInt(req.params.id, 10)));
  res.sendStatus(204);
});

export default router;

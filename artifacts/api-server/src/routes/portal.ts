import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, and, desc, ilike, asc } from "drizzle-orm";
import crypto from "crypto";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import {
  db, portalTokensTable, portalMessagesTable,
  consultationsTable, invoicesTable, siteSettingsTable,
  quotationsTable, invoicePaymentsTable,
  portalDocumentsTable, portalChatMessagesTable,
  leadAssignmentsTable, leadTimelineTable, leadActivitiesTable,
  adminUsersTable, portalAccessRequestsTable,
} from "@workspace/db";
import { createNotification } from "./admin/notifications";

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

type PortalRequest = Request & { portalEmail: string };

async function portalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = (req.headers["x-portal-token"] as string) ?? (req.query.token as string);
  if (!token) { res.status(401).json({ error: "Portal token required" }); return; }
  const session = await verifyPortalToken(token);
  if (!session) { res.status(401).json({ error: "Invalid or expired token. Please request a new access link." }); return; }
  (req as PortalRequest).portalEmail = session.email;
  next();
}

/** Notify all employees assigned to a lead.
 *  Falls back to all active admins when the lead has no specific assignees,
 *  so client actions are never silently dropped on unassigned cases. */
async function notifyAssignees(leadId: number, type: string, title: string, body: string, link: string) {
  try {
    const assignments = await db.select()
      .from(leadAssignmentsTable)
      .where(and(eq(leadAssignmentsTable.leadId, leadId), eq(leadAssignmentsTable.status, "active")));

    if (assignments.length > 0) {
      for (const a of assignments) {
        await createNotification({ recipientId: a.assignedToId, recipientType: "employee", type, title, body, entityType: "lead", entityId: leadId, link });
      }
    } else {
      // No assignees — fall back to all active admins so the action is not lost
      const admins = await db.select({ id: adminUsersTable.id }).from(adminUsersTable);
      for (const admin of admins) {
        await createNotification({
          recipientId: admin.id, recipientType: "admin",
          type, title: `[Unassigned] ${title}`, body, entityType: "lead", entityId: leadId, link,
        });
      }
    }
  } catch { /* non-fatal */ }
}

// SSE rooms shared with the admin portal router via a global Map.
// We use a declared global so both portal.ts and portal-admin.ts can access
// the same room references without a circular module dependency.
declare const global: { _portalChatRooms?: Map<number, Set<Response>> };

function getPortalChatRooms(): Map<number, Set<Response>> {
  if (!global._portalChatRooms) global._portalChatRooms = new Map();
  return global._portalChatRooms;
}

function broadcastChatMessage(leadId: number, data: object) {
  const rooms = getPortalChatRooms();
  const clients = rooms.get(leadId);
  if (!clients) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { clients.delete(res); }
  }
}

// Upload directory for portal documents
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "portal");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Request Access (creates a pending request for admin approval) ─────────────

router.post("/portal/request-access", async (req, res): Promise<void> => {
  const { email, name, phone, message } = req.body as {
    email?: string; name?: string; phone?: string; message?: string;
  };
  if (!email) { res.status(400).json({ error: "Email required" }); return; }

  const normalised = email.toLowerCase().trim();

  // Check the email exists as a lead/consultation
  const leads = await db.select().from(consultationsTable)
    .where(ilike(consultationsTable.email, normalised)).limit(1);
  if (leads.length === 0) {
    // Return the same generic message to avoid email enumeration
    res.json({ ok: true, requested: true, hint: "Your request has been submitted. We'll review it and send you access if approved." });
    return;
  }

  // If there's already a pending request for this email, don't duplicate
  const existing = await db.select({ id: portalAccessRequestsTable.id, status: portalAccessRequestsTable.status })
    .from(portalAccessRequestsTable)
    .where(and(
      ilike(portalAccessRequestsTable.email, normalised),
      eq(portalAccessRequestsTable.status, "pending"),
    )).limit(1);

  if (existing.length === 0) {
    await db.insert(portalAccessRequestsTable).values({
      email: normalised,
      name: name?.trim() || leads[0]?.name || null,
      phone: phone?.trim() || leads[0]?.phone || null,
      message: message?.trim() || null,
      status: "pending",
    });
  }

  res.json({
    ok: true,
    requested: true,
    hint: "Your request has been submitted. Our team will review it and send you an access link shortly.",
  });
});

// ── Verify Token ──────────────────────────────────────────────────────────────

router.get("/portal/verify", async (req, res): Promise<void> => {
  const token = req.query.token as string | undefined;
  if (!token) { res.status(400).json({ error: "Token required" }); return; }
  const session = await verifyPortalToken(token);
  if (!session) { res.status(401).json({ error: "Invalid or expired token" }); return; }

  await db.update(portalTokensTable).set({ usedAt: new Date() }).where(eq(portalTokensTable.token, token));

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
  const email = (req as PortalRequest).portalEmail;
  const cases = await db.select().from(consultationsTable)
    .where(ilike(consultationsTable.email, email))
    .orderBy(desc(consultationsTable.createdAt));
  res.json(cases.map(c => ({
    id: c.id, name: c.name, service: c.serviceInterest, status: c.status,
    priority: c.priority, assignedTo: c.assignedTo,
    nextFollowUp: c.nextFollowUp, notes: c.notes,
    createdAt: c.createdAt, message: c.message,
  })));
});

// ── Client: Case Timeline ─────────────────────────────────────────────────────
// Returns client-safe timeline entries (no internal employee details).

router.get("/portal/cases/:id/timeline", portalAuth, async (req, res): Promise<void> => {
  const email = (req as PortalRequest).portalEmail;
  const caseId = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(caseId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  // Verify this case belongs to the requesting client
  const [c] = await db.select({ id: consultationsTable.id, email: consultationsTable.email })
    .from(consultationsTable).where(eq(consultationsTable.id, caseId)).limit(1);
  if (!c || c.email.toLowerCase() !== email.toLowerCase()) {
    res.status(403).json({ error: "Access denied" }); return;
  }

  const [timeline, activities] = await Promise.all([
    db.select().from(leadTimelineTable)
      .where(eq(leadTimelineTable.leadId, caseId))
      .orderBy(asc(leadTimelineTable.createdAt)),
    db.select().from(leadActivitiesTable)
      .where(eq(leadActivitiesTable.leadId, caseId))
      .orderBy(asc(leadActivitiesTable.createdAt)),
  ]);

  // Client-safe: hide internal notes, anonymise actor names to first name only
  const safeTimeline = timeline
    .filter(t => !["internal_note", "note_added"].includes(t.actionType))
    .map(t => ({
      id: t.id,
      type: "timeline",
      actionType: t.actionType,
      description: t.description,
      // Show only first name of actor
      actor: t.actorName.split(" ")[0],
      createdAt: t.createdAt,
    }));

  const safeActivities = activities
    .filter(a => !["note_added", "internal"].includes(a.type))
    .map(a => ({
      id: a.id,
      type: "activity",
      actionType: a.type,
      description: a.description,
      actor: "System",
      createdAt: a.createdAt,
    }));

  const merged = [...safeTimeline, ...safeActivities]
    .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());

  res.json(merged);
});

// ── Client: Quotations ────────────────────────────────────────────────────────

router.get("/portal/quotations", portalAuth, async (req, res): Promise<void> => {
  const email = (req as PortalRequest).portalEmail;
  const rows = await db.select().from(quotationsTable)
    .where(ilike(quotationsTable.clientEmail, email))
    .orderBy(desc(quotationsTable.createdAt));
  res.json(rows.map(q => ({
    id: q.id, quotationNumber: q.quotationNumber,
    clientName: q.clientName, items: q.items,
    subtotal: q.subtotal, taxPercent: q.taxPercent,
    taxAmount: q.taxAmount, total: q.total,
    status: q.status, notes: q.notes,
    validityDays: q.validityDays, sentAt: q.sentAt,
    acceptedAt: q.acceptedAt, rejectedAt: q.rejectedAt,
    rejectedReason: q.rejectedReason, createdAt: q.createdAt,
  })));
});

router.patch("/portal/quotations/:id/accept", portalAuth, async (req, res): Promise<void> => {
  const email = (req as PortalRequest).portalEmail;
  const qid = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(qid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [q] = await db.select().from(quotationsTable)
    .where(and(eq(quotationsTable.id, qid), ilike(quotationsTable.clientEmail, email)));
  if (!q) { res.status(404).json({ error: "Quotation not found" }); return; }
  if (q.status !== "sent") { res.status(400).json({ error: "Only sent quotations can be accepted" }); return; }

  const [updated] = await db.update(quotationsTable)
    .set({ status: "accepted", acceptedAt: new Date() })
    .where(eq(quotationsTable.id, qid)).returning();

  // Find the lead for this client email to notify assignees
  const leads = await db.select({ id: consultationsTable.id })
    .from(consultationsTable).where(ilike(consultationsTable.email, email)).limit(1);
  if (leads[0]) {
    await notifyAssignees(leads[0].id, "quotation_accepted", "Quotation Accepted",
      `Client ${q.clientName} accepted quotation ${q.quotationNumber}`,
      "/admin/leads");
  }

  res.json(updated);
});

router.patch("/portal/quotations/:id/reject", portalAuth, async (req, res): Promise<void> => {
  const email = (req as PortalRequest).portalEmail;
  const qid = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(qid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { reason } = req.body as { reason?: string };

  const [q] = await db.select().from(quotationsTable)
    .where(and(eq(quotationsTable.id, qid), ilike(quotationsTable.clientEmail, email)));
  if (!q) { res.status(404).json({ error: "Quotation not found" }); return; }
  if (q.status !== "sent") { res.status(400).json({ error: "Only sent quotations can be rejected" }); return; }

  const [updated] = await db.update(quotationsTable)
    .set({ status: "rejected", rejectedAt: new Date(), rejectedReason: reason ?? null })
    .where(eq(quotationsTable.id, qid)).returning();

  const leads = await db.select({ id: consultationsTable.id })
    .from(consultationsTable).where(ilike(consultationsTable.email, email)).limit(1);
  if (leads[0]) {
    await notifyAssignees(leads[0].id, "quotation_rejected", "Quotation Rejected",
      `Client ${q.clientName} rejected quotation ${q.quotationNumber}${reason ? `: ${reason}` : ""}`,
      "/admin/leads");
  }

  res.json(updated);
});

// ── Client: Invoices ──────────────────────────────────────────────────────────

router.get("/portal/invoices", portalAuth, async (req, res): Promise<void> => {
  const email = (req as PortalRequest).portalEmail;
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

router.post("/portal/invoices/:id/pay", portalAuth, async (req, res): Promise<void> => {
  const email = (req as PortalRequest).portalEmail;
  const invId = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(invId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [inv] = await db.select().from(invoicesTable)
    .where(and(eq(invoicesTable.id, invId), ilike(invoicesTable.clientEmail, email)));
  if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (inv.status === "paid") { res.status(400).json({ error: "Invoice already paid" }); return; }

  const total = parseFloat(inv.total ?? "0");
  const alreadyPaid = parseFloat(inv.paidAmount ?? "0");
  const outstanding = total - alreadyPaid;

  if (outstanding <= 0) {
    res.status(400).json({ error: "Invoice is already fully paid" }); return;
  }

  const { mode, transactionId, notes } = req.body as { mode?: string; transactionId?: string; notes?: string };

  // Record the payment for the outstanding balance
  await db.insert(invoicePaymentsTable).values({
    invoiceId: invId,
    amount: String(outstanding),
    mode: mode ?? "online",
    transactionId: transactionId ?? null,
    // "payment_confirmed" status means: client attested payment, staff must verify before treating as settled
    notes: notes ?? "Client confirmed payment via portal — pending staff verification",
    paidAt: new Date().toISOString().slice(0, 10),
  });

  // Accumulate paidAmount correctly: add outstanding to what was already paid
  const newPaidAmount = alreadyPaid + outstanding; // equals total for full payment
  await db.update(invoicesTable)
    .set({ status: "payment_confirmed", paidAmount: String(newPaidAmount) })
    .where(eq(invoicesTable.id, invId));

  // Notify assignees if we can find the lead
  if (inv.leadId) {
    await notifyAssignees(inv.leadId, "payment_confirmed", "Payment Confirmed",
      `Client confirmed payment of ₹${outstanding.toLocaleString("en-IN")} for invoice ${inv.number} — please verify`,
      "/admin/invoices");
  }

  res.json({ ok: true, amount: outstanding, newPaidAmount, total });
});

// ── Client: Documents ─────────────────────────────────────────────────────────

router.get("/portal/documents", portalAuth, async (req, res): Promise<void> => {
  const email = (req as PortalRequest).portalEmail;
  const leadId = parseInt(String(req.query.leadId ?? ""), 10);
  if (isNaN(leadId)) { res.status(400).json({ error: "leadId required" }); return; }

  // Verify ownership
  const [c] = await db.select({ id: consultationsTable.id })
    .from(consultationsTable)
    .where(and(eq(consultationsTable.id, leadId), ilike(consultationsTable.email, email)))
    .limit(1);
  if (!c) { res.status(403).json({ error: "Access denied" }); return; }

  // Return all docs for this lead (both client-uploaded and firm-sent)
  const docs = await db.select().from(portalDocumentsTable)
    .where(eq(portalDocumentsTable.leadId, leadId))
    .orderBy(desc(portalDocumentsTable.uploadedAt));
  res.json(docs);
});

router.post("/portal/documents", portalAuth, async (req, res): Promise<void> => {
  const email = (req as PortalRequest).portalEmail;
  const leadId = parseInt(String(req.body.leadId ?? req.query.leadId ?? ""), 10);
  if (isNaN(leadId)) { res.status(400).json({ error: "leadId required" }); return; }

  // Verify ownership
  const [c] = await db.select({ id: consultationsTable.id })
    .from(consultationsTable)
    .where(and(eq(consultationsTable.id, leadId), ilike(consultationsTable.email, email)))
    .limit(1);
  if (!c) { res.status(403).json({ error: "Access denied" }); return; }

  // Handle base64 file upload with strict server-side validation
  const { fileName, mimeType, fileData } = req.body as {
    fileName?: string; mimeType?: string; fileData?: string;
  };
  if (!fileName || !fileData) { res.status(400).json({ error: "fileName and fileData required" }); return; }

  // Validate MIME type allowlist
  const ALLOWED_MIME_TYPES = new Set([
    "application/pdf", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/jpeg", "image/png", "image/webp", "text/plain",
  ]);
  const declaredMime = mimeType ?? "application/octet-stream";
  if (!ALLOWED_MIME_TYPES.has(declaredMime)) {
    res.status(415).json({ error: "File type not allowed. Accepted: PDF, Word, Excel, Images, Plain text." }); return;
  }

  // Decode and enforce 10 MB hard limit
  let buf: Buffer;
  try { buf = Buffer.from(fileData, "base64"); } catch {
    res.status(400).json({ error: "Invalid file data" }); return;
  }
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  if (buf.length > MAX_FILE_BYTES) {
    res.status(413).json({ error: "File too large. Maximum size is 10 MB." }); return;
  }

  // Safe filename: strip any path separators, limit extension
  const safeBase = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  const safeName = `${Date.now()}_${safeBase}`;
  const filePath = path.resolve(UPLOAD_DIR, safeName);
  // Confirm path stays within UPLOAD_DIR after resolution
  if (!filePath.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) {
    res.status(400).json({ error: "Invalid filename" }); return;
  }

  fs.writeFileSync(filePath, buf);

  let doc;
  try {
    [doc] = await db.insert(portalDocumentsTable).values({
      leadId,
      clientEmail: email.toLowerCase(),
      fileName: safeBase,
      fileUrl: `/api/portal/documents/files/${safeName}`,
      fileSize: buf.length,
      mimeType: declaredMime,
      direction: "client_to_firm",
    }).returning();
  } catch (err) {
    // Clean up file if DB insert fails
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    throw err;
  }

  await notifyAssignees(leadId, "portal_document", "Client Uploaded Document",
    `Client uploaded document: ${safeBase}`,
    `/admin/leads`);

  res.status(201).json(doc);
});

// Serve uploaded portal files — client only.
// Authorization: the portal_documents record for this filename MUST belong
// to a lead owned by the authenticated client email. This prevents one
// client from accessing another client's files by guessing the filename.
router.get("/portal/documents/files/:filename", portalAuth, async (req, res): Promise<void> => {
  const email = (req as PortalRequest).portalEmail;
  const rawName = String(req.params.filename ?? "");
  const basename = path.basename(rawName);
  if (!basename || basename !== rawName) { res.status(400).json({ error: "Invalid filename" }); return; }

  // Look up the document record by stored URL (any direction)
  const fileUrl = `/api/portal/documents/files/${basename}`;
  const [doc] = await db.select().from(portalDocumentsTable)
    .where(eq(portalDocumentsTable.fileUrl, fileUrl))
    .limit(1);
  if (!doc) { res.status(403).json({ error: "Access denied" }); return; }

  // Verify the lead belongs to the requesting client's email (defence in depth)
  const [lead] = await db.select({ id: consultationsTable.id })
    .from(consultationsTable)
    .where(and(eq(consultationsTable.id, doc.leadId), ilike(consultationsTable.email, email)))
    .limit(1);
  if (!lead) { res.status(403).json({ error: "Access denied" }); return; }

  const filePath = path.resolve(UPLOAD_DIR, basename);
  if (!filePath.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "File not found" }); return; }
  res.sendFile(filePath);
});

// ── Client: Portal Chat ───────────────────────────────────────────────────────

router.get("/portal/chat/messages", portalAuth, async (req, res): Promise<void> => {
  const email = (req as PortalRequest).portalEmail;
  const leadId = parseInt(String(req.query.leadId ?? ""), 10);
  if (isNaN(leadId)) { res.status(400).json({ error: "leadId required" }); return; }

  const [c] = await db.select({ id: consultationsTable.id })
    .from(consultationsTable)
    .where(and(eq(consultationsTable.id, leadId), ilike(consultationsTable.email, email)))
    .limit(1);
  if (!c) { res.status(403).json({ error: "Access denied" }); return; }

  const msgs = await db.select().from(portalChatMessagesTable)
    .where(eq(portalChatMessagesTable.leadId, leadId))
    .orderBy(asc(portalChatMessagesTable.createdAt));
  res.json(msgs);
});

router.post("/portal/chat/message", portalAuth, async (req, res): Promise<void> => {
  const email = (req as PortalRequest).portalEmail;
  const { leadId, message, senderName } = req.body as {
    leadId?: number; message?: string; senderName?: string;
  };
  if (!leadId || !message?.trim()) { res.status(400).json({ error: "leadId and message required" }); return; }

  const [c] = await db.select({ id: consultationsTable.id, name: consultationsTable.name })
    .from(consultationsTable)
    .where(and(eq(consultationsTable.id, leadId), ilike(consultationsTable.email, email)))
    .limit(1);
  if (!c) { res.status(403).json({ error: "Access denied" }); return; }

  const [msg] = await db.insert(portalChatMessagesTable).values({
    leadId,
    clientEmail: email.toLowerCase(),
    senderType: "client",
    senderName: senderName ?? c.name ?? email.split("@")[0],
    message: message.trim(),
  }).returning();

  broadcastChatMessage(leadId, { type: "message", data: msg });

  await notifyAssignees(leadId, "portal_chat", "New Client Message",
    `${msg.senderName}: ${message.slice(0, 100)}`,
    `/admin/leads`);

  res.status(201).json(msg);
});

// SSE endpoint for real-time portal chat (client side)
router.get("/portal/chat/sse", portalAuth, async (req, res): Promise<void> => {
  const email = (req as PortalRequest).portalEmail;
  const leadId = parseInt(String(req.query.leadId ?? ""), 10);
  if (isNaN(leadId)) { res.status(400).end(); return; }

  const [c] = await db.select({ id: consultationsTable.id })
    .from(consultationsTable)
    .where(and(eq(consultationsTable.id, leadId), ilike(consultationsTable.email, email)))
    .limit(1);
  if (!c) { res.status(403).end(); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const rooms = getPortalChatRooms();
  if (!rooms.has(leadId)) rooms.set(leadId, new Set());
  const room = rooms.get(leadId)!;
  room.add(res);

  res.write("data: {\"type\":\"connected\"}\n\n");

  const hb = setInterval(() => {
    try { res.write(":heartbeat\n\n"); } catch { clearInterval(hb); room.delete(res); }
  }, 25000);

  req.on("close", () => { clearInterval(hb); room.delete(res); });
});

// ── Client: Profile ───────────────────────────────────────────────────────────

router.get("/portal/profile", portalAuth, async (req, res): Promise<void> => {
  const email = (req as PortalRequest).portalEmail;
  const [lead] = await db.select({
    name: consultationsTable.name,
    email: consultationsTable.email,
    phone: consultationsTable.phone,
    whatsapp: consultationsTable.whatsapp,
    company: consultationsTable.company,
    city: consultationsTable.city,
    state: consultationsTable.state,
  }).from(consultationsTable)
    .where(ilike(consultationsTable.email, email))
    .orderBy(desc(consultationsTable.createdAt))
    .limit(1);
  if (!lead) { res.status(404).json({ error: "Profile not found" }); return; }
  res.json(lead);
});

router.patch("/portal/profile", portalAuth, async (req, res): Promise<void> => {
  const email = (req as PortalRequest).portalEmail;
  const { name, phone, whatsapp, company, city, state } = req.body as Record<string, string>;
  if (!name?.trim()) { res.status(400).json({ error: "Name is required" }); return; }
  await db.update(consultationsTable)
    .set({
      name: name.trim(),
      ...(phone !== undefined   ? { phone:    phone.trim()    } : {}),
      ...(whatsapp !== undefined? { whatsapp: whatsapp.trim() } : {}),
      ...(company !== undefined ? { company:  company.trim()  } : {}),
      ...(city !== undefined    ? { city:     city.trim()     } : {}),
      ...(state !== undefined   ? { state:    state.trim()    } : {}),
    })
    .where(ilike(consultationsTable.email, email));
  res.json({ ok: true });
});

// ── Client: Messages (legacy, kept for backwards compat) ──────────────────────

router.post("/portal/message", portalAuth, async (req, res): Promise<void> => {
  const email = (req as PortalRequest).portalEmail;
  const { subject, message, clientName } = req.body as Record<string, string>;
  if (!subject || !message) { res.status(400).json({ error: "Subject and message required" }); return; }
  await db.insert(portalMessagesTable).values({ clientEmail: email, clientName: clientName ?? null, subject, message });
  res.status(201).json({ ok: true });
});

router.get("/portal/messages", portalAuth, async (req, res): Promise<void> => {
  const email = (req as PortalRequest).portalEmail;
  const msgs = await db.select().from(portalMessagesTable)
    .where(eq(portalMessagesTable.clientEmail, email))
    .orderBy(desc(portalMessagesTable.createdAt));
  res.json(msgs);
});

export default router;

import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { createNotification } from "./notifications";
import { fireWhatsAppTrigger } from "./whatsapp";
import type { AuthenticatedRequest } from "./auth";
import { eq, ilike, and, desc, count, asc } from "drizzle-orm";
import { db, invoicesTable, invoicePaymentsTable, sharedDocumentTokensTable } from "@workspace/db";

const router: IRouter = Router();

const TYPE_PREFIX: Record<string, string> = {
  invoice: "INV", quotation: "QUO", proforma: "PRO",
  po: "PO", credit_note: "CN", debit_note: "DN", receipt: "REC",
};

async function generateNumber(type: string): Promise<string> {
  const prefix = TYPE_PREFIX[type] ?? "INV";
  const year = new Date().getFullYear();
  const [{ value }] = await db.select({ value: count() }).from(invoicesTable).where(eq(invoicesTable.type, type));
  const num = String(Number(value) + 1).padStart(4, "0");
  return `${prefix}-${year}-${num}`;
}

function computeTotals(items: Array<{ qty: number; rate: number; gstRate: number }>, discount: number, discountType: string) {
  let subtotal = 0;
  let gstAmount = 0;
  for (const item of items) {
    const base = (item.qty ?? 0) * (item.rate ?? 0);
    subtotal += base;
    gstAmount += base * (item.gstRate ?? 0) / 100;
  }
  const discAmt = discountType === "percent" ? subtotal * discount / 100 : discount;
  const total = subtotal + gstAmount - discAmt;
  return { subtotal: subtotal.toFixed(2), gstAmount: gstAmount.toFixed(2), total: Math.max(0, total).toFixed(2) };
}

router.get("/admin/invoices", async (req, res): Promise<void> => {
  const { search, type, status } = req.query as Record<string, string | undefined>;
  const conditions = [];
  if (search) conditions.push(ilike(invoicesTable.clientName, `%${search}%`));
  if (type) conditions.push(eq(invoicesTable.type, type));
  if (status) conditions.push(eq(invoicesTable.status, status));
  const where = conditions.length ? and(...conditions as [ReturnType<typeof eq>, ...ReturnType<typeof eq>[]]) : undefined;
  const rows = where
    ? await db.select().from(invoicesTable).where(where).orderBy(desc(invoicesTable.createdAt))
    : await db.select().from(invoicesTable).orderBy(desc(invoicesTable.createdAt));
  res.json(rows);
});

router.get("/admin/invoices/stats", async (_req, res): Promise<void> => {
  const all = await db.select().from(invoicesTable);
  let totalAmt = 0, paidAmt = 0, overdueCount = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (const inv of all) {
    totalAmt += parseFloat(inv.total ?? "0");
    paidAmt += parseFloat(inv.paidAmount ?? "0");
    if (inv.dueDate && inv.dueDate < today && inv.status !== "paid" && inv.status !== "cancelled") overdueCount++;
  }
  res.json({
    totalInvoices: all.length,
    totalAmount: totalAmt.toFixed(2),
    paidAmount: paidAmt.toFixed(2),
    pendingAmount: (totalAmt - paidAmt).toFixed(2),
    overdueCount,
  });
});

router.post("/admin/invoices", async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  if (!body.clientName) { res.status(400).json({ error: "Client name required" }); return; }

  const type = String(body.type ?? "invoice");
  const items = Array.isArray(body.items) ? body.items as Array<{ qty: number; rate: number; gstRate: number }> : [];
  const discount = parseFloat(String(body.discount ?? "0")) || 0;
  const discountType = String(body.discountType ?? "fixed");
  const { subtotal, gstAmount, total } = computeTotals(items, discount, discountType);
  const number = await generateNumber(type);

  const [inv] = await db.insert(invoicesTable).values({
    number,
    type,
    status: "draft",
    clientName: String(body.clientName),
    clientEmail: body.clientEmail ? String(body.clientEmail) : null,
    clientPhone: body.clientPhone ? String(body.clientPhone) : null,
    clientAddress: body.clientAddress ? String(body.clientAddress) : null,
    clientGST: body.clientGST ? String(body.clientGST) : null,
    clientState: body.clientState ? String(body.clientState) : null,
    leadId: body.leadId ? Number(body.leadId) : null,
    items,
    subtotal,
    discount: String(discount),
    discountType,
    gstAmount,
    total,
    paidAmount: "0",
    dueDate: body.dueDate ? String(body.dueDate) : null,
    notes: body.notes ? String(body.notes) : null,
    terms: body.terms ? String(body.terms) : null,
  }).returning();

  // Notify the actor who created the invoice (admin or employee)
  const actorReq = req as AuthenticatedRequest;
  const actorId = typeof actorReq.adminUser?.userId === "number" ? actorReq.adminUser.userId : null;
  const actorType = (actorReq.adminUser?.userType as string) === "employee" ? "employee" : "admin";
  if (actorId) {
    await createNotification({
      recipientId: actorId,
      recipientType: actorType,
      type: "invoice_generated",
      title: `${type === "quotation" ? "Quotation" : "Invoice"} #${number} Created`,
      body: `For ${String(body.clientName)} — ₹${total}`,
      entityType: "invoice",
      entityId: inv.id,
      link: `/admin/invoices`,
    });
  }

  res.status(201).json(inv);
});

router.get("/admin/invoices/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!inv) { res.status(404).json({ error: "Not found" }); return; }
  res.json(inv);
});

router.patch("/admin/invoices/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const body = req.body as Record<string, unknown>;

  const updates: Partial<typeof invoicesTable.$inferInsert> = {};
  if (body.status !== undefined) {
    updates.status = String(body.status);
    if (body.status === "sent") updates.sentAt = new Date();
  }
  if (body.clientName !== undefined) updates.clientName = String(body.clientName);
  if (body.clientEmail !== undefined) updates.clientEmail = body.clientEmail ? String(body.clientEmail) : null;
  if (body.clientPhone !== undefined) updates.clientPhone = body.clientPhone ? String(body.clientPhone) : null;
  if (body.clientAddress !== undefined) updates.clientAddress = body.clientAddress ? String(body.clientAddress) : null;
  if (body.clientGST !== undefined) updates.clientGST = body.clientGST ? String(body.clientGST) : null;
  if (body.clientState !== undefined) updates.clientState = body.clientState ? String(body.clientState) : null;
  if (body.dueDate !== undefined) updates.dueDate = body.dueDate ? String(body.dueDate) : null;
  if (body.notes !== undefined) updates.notes = body.notes ? String(body.notes) : null;
  if (body.terms !== undefined) updates.terms = body.terms ? String(body.terms) : null;

  if (body.items !== undefined) {
    const items = Array.isArray(body.items) ? body.items as Array<{ qty: number; rate: number; gstRate: number }> : [];
    const discount = parseFloat(String(body.discount ?? "0")) || 0;
    const discountType = String(body.discountType ?? "fixed");
    const { subtotal, gstAmount, total } = computeTotals(items, discount, discountType);
    updates.items = items;
    updates.subtotal = subtotal;
    updates.discount = String(discount);
    updates.discountType = discountType;
    updates.gstAmount = gstAmount;
    updates.total = total;
  }
  updates.updatedAt = new Date();

  const [inv] = await db.update(invoicesTable).set(updates).where(eq(invoicesTable.id, id)).returning();
  if (!inv) { res.status(404).json({ error: "Not found" }); return; }
  if (updates.status === "sent" && inv.leadId) {
    fireWhatsAppTrigger("invoice_sent", inv.leadId, { InvoiceNo: inv.number, Amount: String(inv.total) }).catch(() => {});
  }
  res.json(inv);
});

router.delete("/admin/invoices/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(invoicePaymentsTable).where(eq(invoicePaymentsTable.invoiceId, id));
  const [del] = await db.delete(invoicesTable).where(eq(invoicesTable.id, id)).returning();
  if (!del) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

// ── POST /admin/invoices/:id/share-link ──────────────────────────────────────
// Generate (or reuse) a 30-day public token for this invoice.
router.post("/admin/invoices/:id/share-link", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [inv] = await db.select({ id: invoicesTable.id }).from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }

  const token     = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const [row] = await db
    .insert(sharedDocumentTokensTable)
    .values({ token, docType: "invoice", docId: String(id), expiresAt })
    .returning();

  res.json({ token: row.token, expiresAt: row.expiresAt });
});

router.get("/admin/invoices/:id/payments", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const payments = await db.select().from(invoicePaymentsTable)
    .where(eq(invoicePaymentsTable.invoiceId, id))
    .orderBy(asc(invoicePaymentsTable.createdAt));
  res.json(payments);
});

router.post("/admin/invoices/:id/payments", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const body = req.body as Record<string, string>;
  if (!body.amount || parseFloat(body.amount) <= 0) { res.status(400).json({ error: "Valid amount required" }); return; }

  const [pmt] = await db.insert(invoicePaymentsTable).values({
    invoiceId: id,
    amount: String(parseFloat(body.amount).toFixed(2)),
    mode: body.mode ?? "cash",
    transactionId: body.transactionId ?? null,
    notes: body.notes ?? null,
    paidAt: body.paidAt ?? new Date().toISOString().slice(0, 10),
  }).returning();

  const allPayments = await db.select().from(invoicePaymentsTable).where(eq(invoicePaymentsTable.invoiceId, id));
  const totalPaid = allPayments.reduce((s, p) => s + parseFloat(p.amount), 0);
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  const invTotal = parseFloat(inv?.total ?? "0");
  const newStatus = totalPaid >= invTotal ? "paid" : totalPaid > 0 ? "partial" : inv?.status ?? "sent";

  await db.update(invoicesTable)
    .set({ paidAmount: totalPaid.toFixed(2), status: newStatus, updatedAt: new Date() })
    .where(eq(invoicesTable.id, id));

  // Notify the actor who recorded the payment
  const pmtReq = req as AuthenticatedRequest;
  const pmtActorId = typeof pmtReq.adminUser?.userId === "number" ? pmtReq.adminUser.userId : null;
  const pmtActorType = (pmtReq.adminUser?.userType as string) === "employee" ? "employee" : "admin";
  if (pmtActorId && inv) {
    await createNotification({
      recipientId: pmtActorId,
      recipientType: pmtActorType,
      type: "payment_received",
      title: "Payment Recorded",
      body: `₹${body.amount} received for Invoice #${inv.number}`,
      entityType: "invoice",
      entityId: id,
      link: `/admin/invoices`,
    });
  }

  res.status(201).json(pmt);
});

export default router;

import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { eq, desc } from "drizzle-orm";
import { db, quotationsTable, sharedDocumentTokensTable } from "@workspace/db";
import { requirePermission } from "./auth";
import { fireWhatsAppTrigger } from "./whatsapp";
import {
  CreateQuotationBody,
  UpdateQuotationBody,
  UpdateQuotationParams,
  GetQuotationParams,
  SendQuotationParams,
} from "@workspace/api-zod";

function generateQuotationNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(10000 + Math.random() * 90000);
  return `VAKIL-${year}-${random}`;
}

function calcTotals(items: Array<{ quantity: number; unitPrice: number }>, taxPercent: number) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = Math.round(subtotal * taxPercent / 100);
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

const router: IRouter = Router();

router.get("/admin/quotations", async (_req, res): Promise<void> => {
  const results = await db.select().from(quotationsTable).orderBy(desc(quotationsTable.createdAt));
  res.json(results);
});

router.post("/admin/quotations", async (req, res): Promise<void> => {
  const parsed = CreateQuotationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const taxPercent = parsed.data.taxPercent ?? 18;
  const { subtotal, taxAmount, total } = calcTotals(parsed.data.items, taxPercent);

  const [result] = await db
    .insert(quotationsTable)
    .values({
      quotationNumber: generateQuotationNumber(),
      clientName: parsed.data.clientName,
      clientEmail: parsed.data.clientEmail,
      clientPhone: parsed.data.clientPhone ?? null,
      clientCompany: parsed.data.clientCompany ?? null,
      items: parsed.data.items,
      subtotal,
      taxPercent,
      taxAmount,
      total,
      notes: parsed.data.notes ?? null,
      validityDays: parsed.data.validityDays,
      status: "draft",
    })
    .returning();

  res.status(201).json(result);
});

router.get("/admin/quotations/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramsParsed = GetQuotationParams.safeParse({ id: parseInt(rawId, 10) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [result] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, paramsParsed.data.id));
  if (!result) {
    res.status(404).json({ error: "Quotation not found" });
    return;
  }
  res.json(result);
});

router.patch("/admin/quotations/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramsParsed = UpdateQuotationParams.safeParse({ id: parseInt(rawId, 10) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const parsed = UpdateQuotationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };

  if (parsed.data.items) {
    const taxPercent = parsed.data.taxPercent ?? 18;
    const { subtotal, taxAmount, total } = calcTotals(parsed.data.items, taxPercent);
    updateData.subtotal = subtotal;
    updateData.taxAmount = taxAmount;
    updateData.total = total;
  }

  const [result] = await db
    .update(quotationsTable)
    .set(updateData)
    .where(eq(quotationsTable.id, paramsParsed.data.id))
    .returning();

  if (!result) {
    res.status(404).json({ error: "Quotation not found" });
    return;
  }
  res.json(result);
});

router.post("/admin/quotations/:id/send", requirePermission("quotations", "send"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramsParsed = SendQuotationParams.safeParse({ id: parseInt(rawId, 10) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [result] = await db
    .update(quotationsTable)
    .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
    .where(eq(quotationsTable.id, paramsParsed.data.id))
    .returning();
  if (!result) {
    res.status(404).json({ error: "Quotation not found" });
    return;
  }
  if ((result as Record<string, unknown>).leadId) {
    fireWhatsAppTrigger("quotation_sent", (result as Record<string, unknown>).leadId as number, {
      QuotationNo: (result as Record<string, unknown>).quotationNumber as string ?? "",
    }).catch(() => {});
  }
  res.json(result);
});

// ── POST /admin/quotations/:id/share-link ────────────────────────────────────
// Generate a 30-day public token for this quotation.
router.post("/admin/quotations/:id/share-link", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [quot] = await db.select({ id: quotationsTable.id }).from(quotationsTable).where(eq(quotationsTable.id, id));
  if (!quot) { res.status(404).json({ error: "Quotation not found" }); return; }

  const token     = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [row] = await db
    .insert(sharedDocumentTokensTable)
    .values({ token, docType: "quotation", docId: String(id), expiresAt })
    .returning();

  res.json({ token: row.token, expiresAt: row.expiresAt });
});

export default router;

import { Router } from "express";
import { eq, lt } from "drizzle-orm";
import { db, sharedDocumentTokensTable, invoicesTable, quotationsTable, siteSettingsTable } from "@workspace/db";

const publicDocRouter = Router();

const PUBLIC_DOC_SETTING_KEYS = [
  "site_name", "site_tagline", "phone_primary", "email_primary",
  "address", "gst_number", "logo_url",
  "bank_name", "bank_account_no", "bank_ifsc", "bank_upi", "pan_number",
];

// ── GET /public/doc/:token ────────────────────────────────────────────────────
// No authentication required — returns document data for the signed token.
// Expired tokens return 410 Gone. Unknown tokens return 404.

publicDocRouter.get("/public/doc/:token", async (req, res): Promise<void> => {
  const { token } = req.params as { token: string };

  // Delete expired tokens lazily (best-effort, non-blocking)
  db.delete(sharedDocumentTokensTable)
    .where(lt(sharedDocumentTokensTable.expiresAt, new Date()))
    .catch(() => {});

  const [record] = await db
    .select()
    .from(sharedDocumentTokensTable)
    .where(eq(sharedDocumentTokensTable.token, token))
    .limit(1);

  if (!record) {
    res.status(404).json({ error: "Link not found or already expired" });
    return;
  }
  if (record.expiresAt < new Date()) {
    res.status(410).json({ error: "This link has expired" });
    return;
  }

  const docId = parseInt(record.docId, 10);

  // Fetch the document
  let doc: Record<string, unknown> | null = null;
  if (record.docType === "invoice") {
    const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, docId));
    doc = inv as Record<string, unknown> ?? null;
  } else if (record.docType === "quotation") {
    const [quot] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, docId));
    doc = quot as Record<string, unknown> ?? null;
  }

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  // Fetch firm settings for branded rendering
  const stored = await db.select().from(siteSettingsTable);
  const settingsMap = new Map(stored.map(s => [s.key, s.value]));
  const settings: Record<string, string> = {};
  for (const key of PUBLIC_DOC_SETTING_KEYS) {
    settings[key] = settingsMap.get(key) ?? "";
  }

  res.json({
    docType: record.docType,
    doc,
    settings,
    expiresAt: record.expiresAt,
  });
});

export default publicDocRouter;

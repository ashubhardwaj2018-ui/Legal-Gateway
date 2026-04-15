import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db, consultationsTable, contactsTable, newsletterTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  const [totalConsultations] = await db.select({ value: count() }).from(consultationsTable);
  const [totalContacts] = await db.select({ value: count() }).from(contactsTable);
  const [totalSubscribers] = await db.select({ value: count() }).from(newsletterTable);
  const [pendingConsultations] = await db
    .select({ value: count() })
    .from(consultationsTable)
    .where(eq(consultationsTable.status, "pending"));

  res.json({
    totalConsultations: totalConsultations?.value ?? 0,
    totalContacts: totalContacts?.value ?? 0,
    totalSubscribers: totalSubscribers?.value ?? 0,
    pendingConsultations: pendingConsultations?.value ?? 0,
  });
});

export default router;

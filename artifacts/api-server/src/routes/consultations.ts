import { Router, type IRouter } from "express";
import { eq, desc, count } from "drizzle-orm";
import { db, consultationsTable } from "@workspace/db";
import {
  CreateConsultationBody,
  ListConsultationsQueryParams,
  UpdateConsultationParams,
  UpdateConsultationBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/consultations", async (req, res): Promise<void> => {
  const parsed = CreateConsultationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [consultation] = await db
    .insert(consultationsTable)
    .values({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      serviceCategory: parsed.data.serviceCategory,
      serviceInterest: parsed.data.serviceInterest,
      message: parsed.data.message ?? null,
      preferredDate: parsed.data.preferredDate ?? null,
      status: "pending",
    })
    .returning();

  req.log.info({ id: consultation.id }, "Consultation created");
  res.status(201).json(consultation);
});

router.get("/consultations", async (req, res): Promise<void> => {
  const queryParsed = ListConsultationsQueryParams.safeParse(req.query);
  const status = queryParsed.success ? queryParsed.data.status : undefined;
  const page = queryParsed.success ? (queryParsed.data.page ?? 1) : 1;
  const limit = queryParsed.success ? (queryParsed.data.limit ?? 50) : 50;
  const offset = (page - 1) * limit;

  const query = db
    .select()
    .from(consultationsTable)
    .orderBy(desc(consultationsTable.createdAt))
    .limit(limit)
    .offset(offset);

  let results;
  if (status) {
    results = await db
      .select()
      .from(consultationsTable)
      .where(eq(consultationsTable.status, status))
      .orderBy(desc(consultationsTable.createdAt))
      .limit(limit)
      .offset(offset);
  } else {
    results = await query;
  }

  res.json(results);
});

router.patch("/consultations/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramsParsed = UpdateConsultationParams.safeParse({ id: parseInt(rawId, 10) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const bodyParsed = UpdateConsultationBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const updateData: Partial<typeof consultationsTable.$inferInsert> = {};
  if (bodyParsed.data.status != null) updateData.status = bodyParsed.data.status;
  if (bodyParsed.data.notes != null) updateData.notes = bodyParsed.data.notes;

  const [updated] = await db
    .update(consultationsTable)
    .set(updateData)
    .where(eq(consultationsTable.id, paramsParsed.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Consultation not found" });
    return;
  }

  res.json(updated);
});

export default router;

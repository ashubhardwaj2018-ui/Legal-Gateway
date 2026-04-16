import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, lawyerProfilesTable } from "@workspace/db";
import {
  CreateLawyerProfileBody,
  UpdateLawyerProfileBody,
  UpdateLawyerProfileParams,
  DeleteLawyerProfileParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/admin/lawyer-profiles", async (_req, res): Promise<void> => {
  const results = await db.select().from(lawyerProfilesTable).orderBy(lawyerProfilesTable.name);
  res.json(results);
});

router.post("/admin/lawyer-profiles", async (req, res): Promise<void> => {
  const parsed = CreateLawyerProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [result] = await db.insert(lawyerProfilesTable).values(parsed.data).returning();
  res.status(201).json(result);
});

router.patch("/admin/lawyer-profiles/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramsParsed = UpdateLawyerProfileParams.safeParse({ id: parseInt(rawId, 10) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const bodyParsed = UpdateLawyerProfileBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }
  const [result] = await db
    .update(lawyerProfilesTable)
    .set({ ...bodyParsed.data, updatedAt: new Date() })
    .where(eq(lawyerProfilesTable.id, paramsParsed.data.id))
    .returning();
  if (!result) {
    res.status(404).json({ error: "Lawyer profile not found" });
    return;
  }
  res.json(result);
});

router.delete("/admin/lawyer-profiles/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramsParsed = DeleteLawyerProfileParams.safeParse({ id: parseInt(rawId, 10) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [deleted] = await db.delete(lawyerProfilesTable).where(eq(lawyerProfilesTable.id, paramsParsed.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Lawyer profile not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, servicesConfigTable } from "@workspace/db";
import {
  CreateServiceConfigBody,
  UpdateServiceConfigBody,
  UpdateServiceConfigParams,
  DeleteServiceConfigParams,
  ListServicesConfigQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/admin/services-config", async (req, res): Promise<void> => {
  const qp = ListServicesConfigQueryParams.safeParse(req.query);
  const categoryId = qp.success ? qp.data.categoryId : undefined;

  let results;
  if (categoryId) {
    results = await db.select().from(servicesConfigTable).where(eq(servicesConfigTable.categoryId, categoryId));
  } else {
    results = await db.select().from(servicesConfigTable).orderBy(servicesConfigTable.categoryId, servicesConfigTable.serviceName);
  }
  res.json(results);
});

router.post("/admin/services-config", async (req, res): Promise<void> => {
  const parsed = CreateServiceConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [result] = await db.insert(servicesConfigTable).values(parsed.data).returning();
  res.status(201).json(result);
});

router.patch("/admin/services-config/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramsParsed = UpdateServiceConfigParams.safeParse({ id: parseInt(rawId, 10) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const bodyParsed = UpdateServiceConfigBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }
  const [result] = await db
    .update(servicesConfigTable)
    .set({ ...bodyParsed.data, updatedAt: new Date() })
    .where(eq(servicesConfigTable.id, paramsParsed.data.id))
    .returning();
  if (!result) {
    res.status(404).json({ error: "Service config not found" });
    return;
  }
  res.json(result);
});

router.delete("/admin/services-config/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramsParsed = DeleteServiceConfigParams.safeParse({ id: parseInt(rawId, 10) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [deleted] = await db
    .delete(servicesConfigTable)
    .where(eq(servicesConfigTable.id, paramsParsed.data.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Service config not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;

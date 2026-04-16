import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, seoSettingsTable } from "@workspace/db";
import { UpsertSeoSettingBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/admin/seo", async (_req, res): Promise<void> => {
  const results = await db.select().from(seoSettingsTable).orderBy(seoSettingsTable.page);
  res.json(results);
});

router.get("/admin/seo/:page", async (req, res): Promise<void> => {
  const page = Array.isArray(req.params.page) ? req.params.page[0] : req.params.page;
  const [result] = await db.select().from(seoSettingsTable).where(eq(seoSettingsTable.page, page));
  if (!result) {
    res.status(404).json({ error: "SEO setting not found" });
    return;
  }
  res.json(result);
});

router.put("/admin/seo/:page", async (req, res): Promise<void> => {
  const page = Array.isArray(req.params.page) ? req.params.page[0] : req.params.page;
  const parsed = UpsertSeoSettingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [result] = await db
    .insert(seoSettingsTable)
    .values({ page, ...parsed.data })
    .onConflictDoUpdate({
      target: seoSettingsTable.page,
      set: { ...parsed.data, updatedAt: new Date() },
    })
    .returning();

  res.json(result);
});

export default router;

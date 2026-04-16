import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, newsletterTable } from "@workspace/db";
import { SubscribeNewsletterBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/newsletter", async (req, res): Promise<void> => {
  const parsed = SubscribeNewsletterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const [subscriber] = await db
      .insert(newsletterTable)
      .values({ email: parsed.data.email, name: parsed.data.name ?? null })
      .returning();
    req.log.info({ email: subscriber.email }, "Newsletter subscriber added");
    res.status(201).json(subscriber);
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === "23505") {
      res.status(400).json({ error: "This email is already subscribed." });
      return;
    }
    throw err;
  }
});

router.get("/newsletter", async (_req, res): Promise<void> => {
  const results = await db.select().from(newsletterTable).orderBy(desc(newsletterTable.subscribedAt));
  res.json(results);
});

export default router;

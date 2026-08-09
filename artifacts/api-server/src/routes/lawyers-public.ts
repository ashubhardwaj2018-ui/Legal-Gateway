import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, lawyerProfilesTable } from "@workspace/db";

const router: IRouter = Router();

// Public endpoint — no auth required — powers home "Meet Our Experts" and /our-lawyers page.
router.get("/lawyer-profiles", async (_req, res): Promise<void> => {
  const results = await db
    .select()
    .from(lawyerProfilesTable)
    .where(eq(lawyerProfilesTable.isActive, true))
    .orderBy(asc(lawyerProfilesTable.id));
  res.json(results);
});

export default router;

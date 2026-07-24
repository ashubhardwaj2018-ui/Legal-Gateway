import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { db, activityLogsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/admin/activity-logs", async (req, res): Promise<void> => {
  const { username, module, action, userType, from, to, limit = "100", offset = "0" } = req.query as Record<string, string>;
  const conditions = [];
  if (username) conditions.push(eq(activityLogsTable.username, username));
  if (module && module !== "all") conditions.push(eq(activityLogsTable.module, module));
  if (action && action !== "all") conditions.push(eq(activityLogsTable.action, action));
  if (userType && userType !== "all") conditions.push(eq(activityLogsTable.userType, userType));
  if (from) conditions.push(gte(activityLogsTable.createdAt, new Date(from)));
  if (to) conditions.push(lte(activityLogsTable.createdAt, new Date(to)));

  const rows = conditions.length
    ? await db.select().from(activityLogsTable).where(and(...conditions)).orderBy(desc(activityLogsTable.createdAt)).limit(parseInt(limit)).offset(parseInt(offset))
    : await db.select().from(activityLogsTable).orderBy(desc(activityLogsTable.createdAt)).limit(parseInt(limit)).offset(parseInt(offset));

  res.json(rows);
});

export default router;

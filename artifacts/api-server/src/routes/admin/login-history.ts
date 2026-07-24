import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { db, loginHistoryTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/admin/login-history", async (req, res): Promise<void> => {
  const { username, userType, status, from, to, limit = "100", offset = "0" } = req.query as Record<string, string>;
  const conditions = [];
  if (username) conditions.push(eq(loginHistoryTable.username, username));
  if (userType && userType !== "all") conditions.push(eq(loginHistoryTable.userType, userType));
  if (status && status !== "all") conditions.push(eq(loginHistoryTable.status, status));
  if (from) conditions.push(gte(loginHistoryTable.loggedInAt, new Date(from)));
  if (to) conditions.push(lte(loginHistoryTable.loggedInAt, new Date(to)));

  const rows = conditions.length
    ? await db.select().from(loginHistoryTable).where(and(...conditions)).orderBy(desc(loginHistoryTable.loggedInAt)).limit(parseInt(limit)).offset(parseInt(offset))
    : await db.select().from(loginHistoryTable).orderBy(desc(loginHistoryTable.loggedInAt)).limit(parseInt(limit)).offset(parseInt(offset));

  res.json(rows);
});

export default router;

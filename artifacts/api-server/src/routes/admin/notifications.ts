import { Router, type IRouter } from "express";
import { eq, and, isNull, desc, lt } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import type { AuthenticatedRequest } from "./auth";

const router: IRouter = Router();

// Internal helper — called by other routes to create notifications
export async function createNotification(opts: {
  recipientId: number;
  recipientType?: "admin" | "employee";
  type: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: number;
  link?: string;
}) {
  try {
    await db.insert(notificationsTable).values({
      recipientId: opts.recipientId,
      recipientType: opts.recipientType ?? "employee",
      type: opts.type,
      title: opts.title,
      body: opts.body ?? "",
      entityType: opts.entityType ?? null,
      entityId: opts.entityId ?? null,
      link: opts.link ?? null,
    });
  } catch {
    // Non-fatal — notifications must never break the calling operation
  }
}

// ── GET /admin/notifications — list last 30 for current user ─────────────────
router.get("/admin/notifications", async (req: AuthenticatedRequest, res): Promise<void> => {
  const userId = typeof req.adminUser?.userId === "number" ? req.adminUser.userId : null;
  const userType = (req.adminUser?.userType as string) === "employee" ? "employee" : "admin";
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const { before } = req.query as Record<string, string>;

  const rows = before
    ? await db.select().from(notificationsTable)
        .where(and(
          eq(notificationsTable.recipientId, userId),
          eq(notificationsTable.recipientType, userType),
          lt(notificationsTable.createdAt, new Date(before)),
        ))
        .orderBy(desc(notificationsTable.createdAt)).limit(30)
    : await db.select().from(notificationsTable)
        .where(and(
          eq(notificationsTable.recipientId, userId),
          eq(notificationsTable.recipientType, userType),
        ))
        .orderBy(desc(notificationsTable.createdAt)).limit(30);

  res.json(rows);
});

// ── GET /admin/notifications/unread-count — poll this every 30s ───────────────
router.get("/admin/notifications/unread-count", async (req: AuthenticatedRequest, res): Promise<void> => {
  const userId = typeof req.adminUser?.userId === "number" ? req.adminUser.userId : null;
  const userType = (req.adminUser?.userType as string) === "employee" ? "employee" : "admin";
  if (!userId) { res.json({ count: 0 }); return; }

  const rows = await db.select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(and(
      eq(notificationsTable.recipientId, userId),
      eq(notificationsTable.recipientType, userType),
      isNull(notificationsTable.readAt),
    ));

  res.json({ count: rows.length });
});

// ── POST /admin/notifications/:id/read ───────────────────────────────────────
router.post("/admin/notifications/:id/read", async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const userId = typeof req.adminUser?.userId === "number" ? req.adminUser.userId : null;
  const userType = (req.adminUser?.userType as string) === "employee" ? "employee" : "admin";
  if (!userId || isNaN(id)) { res.status(400).json({ error: "Invalid request" }); return; }

  await db.update(notificationsTable)
    .set({ readAt: new Date() })
    .where(and(
      eq(notificationsTable.id, id),
      eq(notificationsTable.recipientId, userId),
      eq(notificationsTable.recipientType, userType),
    ));
  res.json({ ok: true });
});

// ── POST /admin/notifications/read-all ────────────────────────────────────────
router.post("/admin/notifications/read-all", async (req: AuthenticatedRequest, res): Promise<void> => {
  const userId = typeof req.adminUser?.userId === "number" ? req.adminUser.userId : null;
  const userType = (req.adminUser?.userType as string) === "employee" ? "employee" : "admin";
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  await db.update(notificationsTable)
    .set({ readAt: new Date() })
    .where(and(
      eq(notificationsTable.recipientId, userId),
      eq(notificationsTable.recipientType, userType),
      isNull(notificationsTable.readAt),
    ));
  res.json({ ok: true });
});

export default router;

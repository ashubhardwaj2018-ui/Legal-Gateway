import { Router, type IRouter } from "express";
import { eq, and, isNull, desc, lt, lte, isNotNull, gte, inArray } from "drizzle-orm";
import {
  db, notificationsTable, consultationsTable, leadAssignmentsTable,
} from "@workspace/db";
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

// ── Follow-up reminder scheduler ─────────────────────────────────────────────
// Runs every 15 min; creates a notification for each assignee whose lead has a
// follow-up due within the next 24 hours (deduplicated once per lead per day).
export function startFollowUpScheduler(): void {
  const run = async () => {
    try {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const dueLeads = await db
        .select({ id: consultationsTable.id, name: consultationsTable.name })
        .from(consultationsTable)
        .where(and(
          isNotNull(consultationsTable.nextFollowUp),
          lte(consultationsTable.nextFollowUp, in24h),
        ));

      if (!dueLeads.length) return;

      const leadIds = dueLeads.map(l => l.id);
      const assignments = await db.select()
        .from(leadAssignmentsTable)
        .where(and(inArray(leadAssignmentsTable.leadId, leadIds), eq(leadAssignmentsTable.status, "active")));

      for (const a of assignments) {
        // Skip if already notified today for this lead
        const existing = await db
          .select({ id: notificationsTable.id })
          .from(notificationsTable)
          .where(and(
            eq(notificationsTable.recipientId, a.assignedToId),
            eq(notificationsTable.type, "followup_due"),
            eq(notificationsTable.entityId, a.leadId),
            gte(notificationsTable.createdAt, todayStart),
          ))
          .limit(1);
        if (existing.length) continue;

        const lead = dueLeads.find(l => l.id === a.leadId);
        if (!lead) continue;

        await createNotification({
          recipientId: a.assignedToId,
          recipientType: "employee",
          type: "followup_due",
          title: "Follow-up Due",
          body: `Reminder: follow up on lead "${lead.name}"`,
          entityType: "lead",
          entityId: a.leadId,
          link: "/admin/my-dashboard",
        });
      }
    } catch {
      // Non-fatal — scheduler must never crash the server
    }
  };

  // Run immediately on startup, then every 15 minutes
  run().catch(() => {});
  setInterval(() => { run().catch(() => {}); }, 15 * 60 * 1000);
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

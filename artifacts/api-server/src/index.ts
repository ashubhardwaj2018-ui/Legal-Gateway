import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";
import { and, lte, gte, eq } from "drizzle-orm";
import { db, consultationsTable, notificationsTable, adminUsersTable } from "@workspace/db";
import { createNotification } from "./routes/admin/notifications";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ─── Follow-up reminder scheduler ─────────────────────────────────────────────

async function checkFollowUpReminders(): Promise<void> {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Consultations with an overdue follow-up that are not closed
    const due = await db.select({
      id: consultationsTable.id,
      name: consultationsTable.name,
      nextFollowUp: consultationsTable.nextFollowUp,
      status: consultationsTable.status,
    }).from(consultationsTable)
      .where(and(
        lte(consultationsTable.nextFollowUp, now),
      ));

    const active = due.filter(c =>
      c.nextFollowUp != null && !["completed", "closed", "cancelled"].includes(c.status ?? "")
    );
    if (active.length === 0) return;

    // Already-notified consultation IDs in the last 24h
    const recentNotifs = await db.select({ entityId: notificationsTable.entityId })
      .from(notificationsTable)
      .where(and(
        eq(notificationsTable.type, "followup_reminder"),
        eq(notificationsTable.entityType, "consultation"),
        gte(notificationsTable.createdAt, oneDayAgo),
      ));
    const alreadyNotified = new Set(recentNotifs.map(n => n.entityId).filter((id): id is number => id != null));

    // Admin users to notify
    const admins = await db.select({ id: adminUsersTable.id }).from(adminUsersTable);

    for (const c of active) {
      if (alreadyNotified.has(c.id)) continue;
      const dueDate = c.nextFollowUp!.toLocaleDateString("en-IN");
      for (const admin of admins) {
        await createNotification({
          recipientId: admin.id,
          recipientType: "admin",
          type: "followup_reminder",
          title: `Follow-up due: ${c.name}`,
          body: `Follow-up was due on ${dueDate}. Status: ${c.status ?? "pending"}.`,
          entityType: "consultation",
          entityId: c.id,
          link: "/admin/leads",
        });
      }
      logger.info({ consultationId: c.id, name: c.name }, "Follow-up reminder sent");
    }
  } catch (err) {
    logger.warn({ err }, "Follow-up reminder check failed (non-fatal)");
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Run follow-up check after short startup delay, then every 15 minutes
  setTimeout(() => { void checkFollowUpReminders(); }, 10_000);
  setInterval(() => { void checkFollowUpReminders(); }, 15 * 60 * 1000);
});

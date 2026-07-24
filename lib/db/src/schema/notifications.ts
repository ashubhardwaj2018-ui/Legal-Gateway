import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  recipientId: integer("recipient_id").notNull(),
  recipientType: text("recipient_type").notNull().default("employee"), // "admin" | "employee"
  type: text("type").notNull(), // lead_assigned | lead_updated | task_assigned | chat_message | followup_reminder | invoice_generated | payment_received
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  entityType: text("entity_type"), // lead | task | chat | invoice
  entityId: integer("entity_id"),
  link: text("link"), // href to navigate to
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  recipientIdx: index("notifications_recipient_idx").on(t.recipientId, t.recipientType),
  createdIdx: index("notifications_created_idx").on(t.createdAt),
}));

export type Notification = typeof notificationsTable.$inferSelect;

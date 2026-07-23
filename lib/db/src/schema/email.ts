import { pgTable, serial, text, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";

export const emailTemplatesTable = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  htmlBody: text("html_body").notNull(),
  type: text("type").notNull().default("custom"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailLogsTable = pgTable("email_logs", {
  id: serial("id").primaryKey(),
  toEmail: text("to_email").notNull(),
  toName: text("to_name"),
  subject: text("subject").notNull(),
  type: text("type").notNull().default("custom"),
  status: text("status").notNull().default("queued"),
  templateId: integer("template_id"),
  leadId: integer("lead_id"),
  invoiceId: integer("invoice_id"),
  errorMsg: text("error_msg"),
  messageId: text("message_id"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("email_logs_status_idx").on(t.status),
  createdIdx: index("email_logs_created_idx").on(t.createdAt),
}));

export type EmailTemplate = typeof emailTemplatesTable.$inferSelect;
export type EmailLog = typeof emailLogsTable.$inferSelect;

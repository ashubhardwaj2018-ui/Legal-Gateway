import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

export const portalTokensTable = pgTable("portal_tokens", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  emailIdx: index("portal_tokens_email_idx").on(t.email),
  tokenIdx: index("portal_tokens_token_idx").on(t.token),
}));

export const portalMessagesTable = pgTable("portal_messages", {
  id: serial("id").primaryKey(),
  clientEmail: text("client_email").notNull(),
  clientName: text("client_name"),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  isRead: text("is_read").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  emailIdx: index("portal_messages_email_idx").on(t.clientEmail),
}));

export type PortalToken = typeof portalTokensTable.$inferSelect;
export type PortalMessage = typeof portalMessagesTable.$inferSelect;

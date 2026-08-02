import { pgTable, serial, text, timestamp, index, integer } from "drizzle-orm/pg-core";

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

// Documents uploaded by clients through the portal
export const portalDocumentsTable = pgTable("portal_documents", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  clientEmail: text("client_email").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size").notNull().default(0),
  mimeType: text("mime_type").notNull().default("application/octet-stream"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  leadIdx: index("portal_documents_lead_idx").on(t.leadId),
  emailIdx: index("portal_documents_email_idx").on(t.clientEmail),
}));

// Real-time chat between client and assigned executive
export const portalChatMessagesTable = pgTable("portal_chat_messages", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  clientEmail: text("client_email").notNull(),
  senderType: text("sender_type").notNull().default("client"), // "client" | "employee"
  senderName: text("sender_name").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  leadIdx: index("portal_chat_lead_idx").on(t.leadId),
}));

// Access requests: clients submit email → admin approves/rejects → magic link sent on approval
export const portalAccessRequestsTable = pgTable("portal_access_requests", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  phone: text("phone"),
  message: text("message"),
  status: text("status").notNull().default("pending"), // "pending" | "approved" | "rejected"
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  emailIdx: index("portal_access_requests_email_idx").on(t.email),
  statusIdx: index("portal_access_requests_status_idx").on(t.status),
}));

export type PortalToken = typeof portalTokensTable.$inferSelect;
export type PortalMessage = typeof portalMessagesTable.$inferSelect;
export type PortalDocument = typeof portalDocumentsTable.$inferSelect;
export type PortalChatMessage = typeof portalChatMessagesTable.$inferSelect;
export type PortalAccessRequest = typeof portalAccessRequestsTable.$inferSelect;

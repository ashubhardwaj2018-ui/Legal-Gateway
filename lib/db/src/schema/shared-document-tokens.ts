import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const sharedDocumentTokensTable = pgTable("shared_document_tokens", {
  id:        serial("id").primaryKey(),
  token:     text("token").notNull().unique(),
  docType:   text("doc_type").notNull(),   // "invoice" | "quotation"
  docId:     text("doc_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SharedDocumentToken = typeof sharedDocumentTokensTable.$inferSelect;

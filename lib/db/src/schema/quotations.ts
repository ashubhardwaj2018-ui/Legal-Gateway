import { pgTable, text, serial, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const quotationsTable = pgTable("quotations", {
  id: serial("id").primaryKey(),
  quotationNumber: text("quotation_number").notNull().unique(),
  leadId: integer("lead_id"),           // nullable FK → consultations.id
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").notNull(),
  clientPhone: text("client_phone"),
  clientCompany: text("client_company"),
  items: jsonb("items").notNull().default([]),
  subtotal: integer("subtotal").notNull().default(0),
  taxPercent: integer("tax_percent").notNull().default(18),
  taxAmount: integer("tax_amount").notNull().default(0),
  total: integer("total").notNull().default(0),
  notes: text("notes"),
  validityDays: integer("validity_days").notNull().default(30),
  status: text("status").notNull().default("draft"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectedReason: text("rejected_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  leadIdIdx: index("quotations_lead_id_idx").on(table.leadId),
  statusIdx: index("quotations_status_idx").on(table.status),
}));

export const insertQuotationSchema = createInsertSchema(quotationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuotation = z.infer<typeof insertQuotationSchema>;
export type Quotation = typeof quotationsTable.$inferSelect;

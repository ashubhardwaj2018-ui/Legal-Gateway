import { pgTable, text, serial, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(),
  type: text("type").notNull().default("invoice"),
  status: text("status").notNull().default("draft"),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email"),
  clientPhone: text("client_phone"),
  clientAddress: text("client_address"),
  clientGST: text("client_gst"),
  clientState: text("client_state"),
  leadId: integer("lead_id"),
  items: jsonb("items").notNull().default([]),
  subtotal: text("subtotal").notNull().default("0"),
  discount: text("discount").default("0"),
  discountType: text("discount_type").default("fixed"),
  gstAmount: text("gst_amount").default("0"),
  total: text("total").notNull().default("0"),
  paidAmount: text("paid_amount").default("0"),
  dueDate: text("due_date"),
  notes: text("notes"),
  terms: text("terms"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  typeIdx: index("invoices_type_idx").on(t.type),
  statusIdx: index("invoices_status_idx").on(t.status),
}));

export const invoicePaymentsTable = pgTable("invoice_payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull(),
  amount: text("amount").notNull(),
  mode: text("mode").notNull().default("cash"),
  transactionId: text("transaction_id"),
  notes: text("notes"),
  paidAt: text("paid_at").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Invoice = typeof invoicesTable.$inferSelect;
export type InvoicePayment = typeof invoicePaymentsTable.$inferSelect;

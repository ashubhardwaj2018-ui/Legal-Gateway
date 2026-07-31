import { pgTable, text, serial, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";

// ── WhatsApp Message Templates ────────────────────────────────────────────────
// Supports placeholders: {{ClientName}}, {{CompanyName}}, {{LeadID}},
// {{ServiceName}}, {{QuotationNo}}, {{InvoiceNo}}, {{Amount}},
// {{AssignedEmployee}}, {{DueDate}}, {{Website}}, {{CompanyWhatsApp}}, {{SupportEmail}}
export const whatsappTemplatesTable = pgTable("whatsapp_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default("general"),
  // welcome | followup | quotation | invoice | payment | assignment | status | general | broadcast
  body: text("body").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});

// ── WhatsApp Message Log ──────────────────────────────────────────────────────
// Stores every outgoing (and incoming when API connected) message.
export const whatsappMessagesTable = pgTable("whatsapp_messages", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id"),                       // null for bulk/broadcast
  toNumber: text("to_number").notNull(),
  fromNumber: text("from_number"),                  // company WhatsApp number
  message: text("message").notNull(),
  templateId: integer("template_id"),
  templateName: text("template_name"),
  senderType: text("sender_type").notNull().default("employee"), // employee | system | client
  senderName: text("sender_name"),
  senderId: integer("sender_id"),                   // employee ID if applicable
  direction: text("direction").notNull().default("outgoing"), // outgoing | incoming
  status: text("status").notNull().default("sent"), // pending | sent | delivered | read | failed
  provider: text("provider").notNull().default("web"), // web | waba | twilio | 360dialog | gupshup | interakt
  isBulk: boolean("is_bulk").notNull().default(false),
  bulkBatchId: text("bulk_batch_id"),               // groups a bulk send session
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  leadIdx: index("wa_messages_lead_idx").on(t.leadId),
  createdIdx: index("wa_messages_created_idx").on(t.createdAt),
  bulkIdx: index("wa_messages_bulk_idx").on(t.bulkBatchId),
}));

// ── Auto-Trigger Configuration ────────────────────────────────────────────────
// Admin enables/disables auto WhatsApp triggers for CRM events.
export const whatsappTriggersTable = pgTable("whatsapp_triggers", {
  id: serial("id").primaryKey(),
  event: text("event").notNull().unique(),
  // lead_created | lead_assigned | status_changed | quotation_sent | invoice_sent
  // payment_reminder | document_requested | service_completed | portal_created
  templateId: integer("template_id"),               // null = use default body
  isEnabled: boolean("is_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});

export type WhatsAppTemplate = typeof whatsappTemplatesTable.$inferSelect;
export type WhatsAppMessage = typeof whatsappMessagesTable.$inferSelect;
export type WhatsAppTrigger = typeof whatsappTriggersTable.$inferSelect;

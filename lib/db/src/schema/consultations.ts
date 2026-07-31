import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const consultationsTable = pgTable("consultations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  serviceCategory: text("service_category").notNull(),
  serviceInterest: text("service_interest").notNull(),
  message: text("message"),
  preferredDate: text("preferred_date"),
  status: text("status").notNull().default("new"),
  notes: text("notes"),
  // CRM fields
  company: text("company"),
  whatsapp: text("whatsapp"),
  city: text("city"),
  state: text("state"),
  priority: text("priority").default("medium"),
  source: text("source").default("website"),
  rating: integer("rating"),
  assignedTo: text("assigned_to"),
  expectedRevenue: text("expected_revenue"),
  probability: integer("probability"),
  expectedClosingDate: text("expected_closing_date"),
  nextFollowUp: timestamp("next_follow_up", { withTimezone: true }),
  tags: text("tags"),
  // WhatsApp CRM fields
  countryCode: text("country_code").default("+91"),
  whatsappVerified: boolean("whatsapp_verified").default(false),
  lastWhatsappMessage: text("last_whatsapp_message"),
  lastWhatsappDate: timestamp("last_whatsapp_date", { withTimezone: true }),
  whatsappStatus: text("whatsapp_status").default("unknown"), // unknown | active | blocked | invalid
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const leadNotesTable = pgTable("lead_notes", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  content: text("content").notNull(),
  createdBy: text("created_by").default("Admin"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leadActivitiesTable = pgTable("lead_activities", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leadTasksTable = pgTable("lead_tasks", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: text("due_date"),
  status: text("status").notNull().default("pending"),
  priority: text("priority").default("medium"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const leadAssignmentsTable = pgTable("lead_assignments", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  assignedToId: integer("assigned_to_id").notNull(),
  assignedToName: text("assigned_to_name").notNull(),
  assignedById: integer("assigned_by_id"),
  assignedByName: text("assigned_by_name"),
  deadline: text("deadline"),
  priority: text("priority").default("medium"),
  notes: text("notes"),
  status: text("status").notNull().default("active"),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leadTimelineTable = pgTable("lead_timeline", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  actorId: integer("actor_id"),
  actorName: text("actor_name").notNull().default("System"),
  actionType: text("action_type").notNull(),
  description: text("description").notNull(),
  payload: text("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConsultationSchema = createInsertSchema(consultationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertConsultation = z.infer<typeof insertConsultationSchema>;
export type Consultation = typeof consultationsTable.$inferSelect;
export type LeadNote = typeof leadNotesTable.$inferSelect;
export type LeadActivity = typeof leadActivitiesTable.$inferSelect;
export type LeadTask = typeof leadTasksTable.$inferSelect;

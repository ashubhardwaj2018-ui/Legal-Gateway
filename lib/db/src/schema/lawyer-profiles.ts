import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const lawyerProfilesTable = pgTable("lawyer_profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role"),
  specialization: text("specialization").notNull(),
  experienceYears: integer("experience_years").notNull().default(0),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  email: text("email"),
  languages: text("languages"),
  barCouncilNo: text("bar_council_no"),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLawyerProfileSchema = createInsertSchema(lawyerProfilesTable).omit({ id: true, updatedAt: true });
export type InsertLawyerProfile = z.infer<typeof insertLawyerProfileSchema>;
export type LawyerProfile = typeof lawyerProfilesTable.$inferSelect;

import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const seoSettingsTable = pgTable("seo_settings", {
  id: serial("id").primaryKey(),
  page: text("page").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  keywords: text("keywords"),
  ogTitle: text("og_title"),
  ogDescription: text("og_description"),
  ogImage: text("og_image"),
  robots: text("robots").notNull().default("index, follow"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSeoSettingSchema = createInsertSchema(seoSettingsTable).omit({ id: true, updatedAt: true });
export type InsertSeoSetting = z.infer<typeof insertSeoSettingSchema>;
export type SeoSetting = typeof seoSettingsTable.$inferSelect;

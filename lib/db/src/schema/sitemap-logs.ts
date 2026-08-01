import { pgTable, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const sitemapLogsTable = pgTable("sitemap_logs", {
  id: serial("id").primaryKey(),
  urlsGenerated: integer("urls_generated").notNull().default(0),
  pseoFiles: integer("pseo_files").notNull().default(0),
  blogsIncluded: integer("blogs_included").notNull().default(0),
  companiesIncluded: integer("companies_included").notNull().default(0),
  locationsCovered: integer("locations_covered").notNull().default(0),
  pingedGoogle: boolean("pinged_google").notNull().default(false),
  pingedBing: boolean("pinged_bing").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SitemapLog = typeof sitemapLogsTable.$inferSelect;

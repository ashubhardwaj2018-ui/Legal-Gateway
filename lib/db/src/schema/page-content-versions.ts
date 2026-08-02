import { pgTable, serial, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const pageContentVersionsTable = pgTable("page_content_versions", {
  id:            serial("id").primaryKey(),
  page:          text("page").notNull(),
  content:       jsonb("content").notNull(),
  snapshotLabel: text("snapshot_label"),
  createdBy:     text("created_by").default("admin"),
  createdAt:     timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  pageIdx: index("pcv_page_idx").on(t.page, t.createdAt),
}));

export type PageContentVersion = typeof pageContentVersionsTable.$inferSelect;
export type InsertPageContentVersion = typeof pageContentVersionsTable.$inferInsert;

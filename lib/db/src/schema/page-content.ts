import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const pageContentTable = pgTable("page_content", {
  id: serial("id").primaryKey(),
  page: text("page").notNull(),
  blockId: text("block_id").notNull(),
  content: text("content").notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  pageBlockIdx: uniqueIndex("page_content_unique_idx").on(table.page, table.blockId),
}));

export type PageContent = typeof pageContentTable.$inferSelect;
export type InsertPageContent = typeof pageContentTable.$inferInsert;

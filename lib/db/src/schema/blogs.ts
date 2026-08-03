import {
  pgTable, text, serial, timestamp, boolean, integer, index,
} from "drizzle-orm/pg-core";

export const blogsTable = pgTable(
  "blogs",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    excerpt: text("excerpt"),
    content: text("content").notNull().default(""),
    featuredImage: text("featured_image"),
    category: text("category").notNull().default("general"),
    tags: text("tags"),
    status: text("status").notNull().default("draft"),
    authorName: text("author_name").notNull().default("Legal Filing India"),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    metaKeywords: text("meta_keywords"),
    ogImage: text("og_image"),
    schemaMarkup: text("schema_markup"),
    faqs: text("faqs"),
    readingTime: integer("reading_time").notNull().default(5),
    viewCount: integer("view_count").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    slugIdx: index("blogs_slug_idx").on(table.slug),
    statusIdx: index("blogs_status_idx").on(table.status),
    categoryIdx: index("blogs_category_idx").on(table.category),
  })
);

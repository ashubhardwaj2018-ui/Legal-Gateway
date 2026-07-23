import { Router, type IRouter } from "express";
import { eq, ilike, or, desc, count, and, sql } from "drizzle-orm";
import { db, blogsTable } from "@workspace/db";

const router: IRouter = Router();

// ── List published blogs ──────────────────────────────────────────────────────
router.get("/blogs", async (req, res): Promise<void> => {
  const { category, search, page = "1", limit = "12" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, parseInt(limit));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [eq(blogsTable.status, "published")];
  if (category) conditions.push(eq(blogsTable.category, category));
  if (search) conditions.push(or(
    ilike(blogsTable.title, `%${search}%`),
    ilike(blogsTable.excerpt, `%${search}%`)
  )!);

  const where = and(...conditions);

  const [rows, [{ total }]] = await Promise.all([
    db.select({
      id: blogsTable.id,
      title: blogsTable.title,
      slug: blogsTable.slug,
      excerpt: blogsTable.excerpt,
      featuredImage: blogsTable.featuredImage,
      category: blogsTable.category,
      tags: blogsTable.tags,
      authorName: blogsTable.authorName,
      readingTime: blogsTable.readingTime,
      viewCount: blogsTable.viewCount,
      publishedAt: blogsTable.publishedAt,
      createdAt: blogsTable.createdAt,
    }).from(blogsTable).where(where).orderBy(desc(blogsTable.publishedAt)).limit(limitNum).offset(offset),
    db.select({ total: count() }).from(blogsTable).where(where),
  ]);

  res.json({ data: rows, total: Number(total), page: pageNum, pages: Math.ceil(Number(total) / limitNum) });
});

// ── Get single blog by slug ───────────────────────────────────────────────────
router.get("/blogs/:slug", async (req, res): Promise<void> => {
  const [blog] = await db.select().from(blogsTable)
    .where(and(eq(blogsTable.slug, req.params.slug), eq(blogsTable.status, "published")));
  if (!blog) { res.status(404).json({ error: "Not found" }); return; }

  // Increment view count (fire and forget)
  db.update(blogsTable)
    .set({ viewCount: sql`${blogsTable.viewCount} + 1` })
    .where(eq(blogsTable.id, blog.id))
    .catch(() => {});

  res.json(blog);
});

export { router as blogsRouter };

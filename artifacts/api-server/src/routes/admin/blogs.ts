import { Router, type IRouter } from "express";
import { eq, ilike, or, desc, count, sql, and } from "drizzle-orm";
import { db, blogsTable } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

function makeSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100);
}

function calcReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

// ── List all blogs (admin) ────────────────────────────────────────────────────
router.get("/admin/blogs", async (req, res): Promise<void> => {
  const { status, search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  if (status && status !== "all") conditions.push(eq(blogsTable.status, status));
  if (search) conditions.push(or(
    ilike(blogsTable.title, `%${search}%`),
    ilike(blogsTable.category, `%${search}%`)
  ));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(blogsTable).where(where).orderBy(desc(blogsTable.createdAt)).limit(limitNum).offset(offset),
    db.select({ total: count() }).from(blogsTable).where(where),
  ]);

  res.json({ data: rows, total: Number(total), page: pageNum, pages: Math.ceil(Number(total) / limitNum) });
});

// ── Get single blog (admin) ───────────────────────────────────────────────────
router.get("/admin/blogs/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [blog] = await db.select().from(blogsTable).where(eq(blogsTable.id, id));
  if (!blog) { res.status(404).json({ error: "Not found" }); return; }
  res.json(blog);
});

// ── Create blog ───────────────────────────────────────────────────────────────
router.post("/admin/blogs", async (req, res): Promise<void> => {
  const body = req.body as {
    title: string; slug?: string; excerpt?: string | null; content: string;
    featuredImage?: string | null; category?: string; tags?: string | null;
    status?: string; authorName?: string; metaTitle?: string | null;
    metaDescription?: string | null; metaKeywords?: string | null;
    ogImage?: string | null; faqs?: string | null;
  };

  const slug = body.slug?.trim() || makeSlug(body.title);
  const readingTime = calcReadingTime(body.content || "");

  const [created] = await db.insert(blogsTable).values({
    title: body.title,
    slug,
    excerpt: body.excerpt ?? null,
    content: body.content,
    featuredImage: body.featuredImage ?? null,
    category: body.category ?? "general",
    tags: body.tags ?? null,
    status: body.status ?? "draft",
    authorName: body.authorName ?? "Vakil & Co.",
    metaTitle: body.metaTitle ?? null,
    metaDescription: body.metaDescription ?? null,
    metaKeywords: body.metaKeywords ?? null,
    ogImage: body.ogImage ?? null,
    faqs: body.faqs ?? null,
    readingTime,
    publishedAt: body.status === "published" ? new Date() : null,
  }).returning();

  res.status(201).json(created);
});

// ── Update blog ───────────────────────────────────────────────────────────────
router.put("/admin/blogs/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const body = req.body as Partial<{
    title: string; slug: string; excerpt: string | null; content: string;
    featuredImage: string | null; category: string; tags: string | null;
    status: string; authorName: string; metaTitle: string | null;
    metaDescription: string | null; metaKeywords: string | null;
    ogImage: string | null; faqs: string | null;
  }>;

  const existing = await db.select().from(blogsTable).where(eq(blogsTable.id, id));
  if (!existing[0]) { res.status(404).json({ error: "Not found" }); return; }

  const updates: Partial<typeof blogsTable.$inferInsert> = { ...body };
  if (body.content) updates.readingTime = calcReadingTime(body.content);
  if (body.status === "published" && existing[0].status !== "published") {
    updates.publishedAt = new Date();
  }

  const [updated] = await db.update(blogsTable).set(updates).where(eq(blogsTable.id, id)).returning();
  res.json(updated);
});

// ── Publish blog ──────────────────────────────────────────────────────────────
router.post("/admin/blogs/:id/publish", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [updated] = await db.update(blogsTable)
    .set({ status: "published", publishedAt: new Date() })
    .where(eq(blogsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

// ── Delete blog ───────────────────────────────────────────────────────────────
router.delete("/admin/blogs/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(blogsTable).where(eq(blogsTable.id, id));
  res.status(204).end();
});

// ── AI Generate blog ──────────────────────────────────────────────────────────
router.post("/admin/blogs/ai-generate", async (req, res): Promise<void> => {
  const {
    topic,
    serviceCategory,
    targetCity,
    tone = "professional",
    wordCount = 800,
  } = req.body as {
    topic: string;
    serviceCategory?: string | null;
    targetCity?: string | null;
    tone?: string;
    wordCount?: number;
  };

  const contextParts: string[] = [];
  if (serviceCategory) contextParts.push(`legal service category: ${serviceCategory}`);
  if (targetCity) contextParts.push(`targeting clients in ${targetCity}`);
  const context = contextParts.length > 0 ? `Context: ${contextParts.join(", ")}.` : "";

  const prompt = `You are an expert Indian legal content writer for Vakil & Co. Legal Associates.

Generate a complete, SEO-optimized blog post in ${tone} tone.
Topic: "${topic}"
${context}
Target word count: ~${wordCount} words

Respond ONLY with a valid JSON object (no markdown, no code blocks) with these exact keys:
{
  "title": "SEO-optimized blog title",
  "slug": "url-friendly-slug",
  "excerpt": "2-3 sentence summary for meta description (max 160 chars)",
  "content": "Full HTML blog content with h2/h3 headings, paragraphs, lists. Include intro, 4-6 sections, and conclusion. Use proper HTML tags.",
  "metaTitle": "SEO meta title (max 60 chars)",
  "metaDescription": "Meta description (max 160 chars)",
  "metaKeywords": "keyword1, keyword2, keyword3, keyword4, keyword5",
  "faqs": "[{\\"q\\":\\"Question?\\",\\"a\\":\\"Answer.\\"},{\\"q\\":\\"Question 2?\\",\\"a\\":\\"Answer 2.\\"}]",
  "tags": "tag1, tag2, tag3",
  "category": "legal-advice"
}

The content must be:
- Specific to Indian law/regulations
- Mention Vakil & Co. naturally once or twice
- Include practical advice
- Be engaging and informative`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";

  let parsed: Record<string, string>;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    res.status(500).json({ error: "AI returned invalid JSON", raw });
    return;
  }

  res.json(parsed);
});

export { router as adminBlogsRouter };

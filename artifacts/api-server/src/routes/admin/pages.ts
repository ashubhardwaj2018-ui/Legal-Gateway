import { Router } from "express";
import { db } from "@workspace/db";
import { pageContentTable, pageContentVersionsTable } from "@workspace/db/schema";
import { eq, desc, inArray } from "drizzle-orm";

const pagesRouter = Router();

// ── Page content ──────────────────────────────────────────────────────────────

// GET /api/admin/pages/:page
pagesRouter.get("/admin/pages/:page", async (req, res): Promise<void> => {
  const { page } = req.params as { page: string };
  try {
    const blocks = await db.select().from(pageContentTable).where(eq(pageContentTable.page, page));
    const content: Record<string, string> = {};
    for (const block of blocks) content[block.blockId] = block.content;
    res.json({ page, content });
  } catch {
    res.status(500).json({ error: "Failed to fetch page content" });
  }
});

// PUT /api/admin/pages/:page — bulk upsert + auto-snapshot
pagesRouter.put("/admin/pages/:page", async (req, res): Promise<void> => {
  const { page } = req.params as { page: string };
  const body = req.body as { content?: Record<string, string>; label?: string };
  const content = body.content;

  if (!content || typeof content !== "object") {
    res.status(400).json({ error: "content must be an object" });
    return;
  }

  try {
    for (const [blockId, value] of Object.entries(content)) {
      await db
        .insert(pageContentTable)
        .values({ page, blockId, content: String(value) })
        .onConflictDoUpdate({
          target: [pageContentTable.page, pageContentTable.blockId],
          set: { content: String(value), updatedAt: new Date() },
        });
    }

    // Auto-snapshot on every save (keep last 20)
    await db.insert(pageContentVersionsTable).values({
      page,
      content: content as unknown as Record<string, unknown>,
      snapshotLabel: body.label ?? new Date().toISOString(),
      createdBy: "admin",
    });

    const allVersions = await db
      .select({ id: pageContentVersionsTable.id })
      .from(pageContentVersionsTable)
      .where(eq(pageContentVersionsTable.page, page))
      .orderBy(desc(pageContentVersionsTable.createdAt));

    if (allVersions.length > 20) {
      const toDelete = allVersions.slice(20).map((v) => v.id);
      await db
        .delete(pageContentVersionsTable)
        .where(inArray(pageContentVersionsTable.id, toDelete));
    }

    res.json({ ok: true, updated: Object.keys(content).length });
  } catch (e) {
    console.error("[pages PUT]", e);
    res.status(500).json({ error: "Failed to save page content" });
  }
});

// ── Version history ───────────────────────────────────────────────────────────

// GET /api/admin/pages/:page/versions
pagesRouter.get("/admin/pages/:page/versions", async (req, res): Promise<void> => {
  const { page } = req.params as { page: string };
  try {
    const versions = await db
      .select()
      .from(pageContentVersionsTable)
      .where(eq(pageContentVersionsTable.page, page))
      .orderBy(desc(pageContentVersionsTable.createdAt))
      .limit(20);
    res.json(versions);
  } catch {
    res.status(500).json({ error: "Failed to fetch versions" });
  }
});

export default pagesRouter;

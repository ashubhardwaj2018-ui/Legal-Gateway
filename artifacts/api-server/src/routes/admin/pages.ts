import { Router } from "express";
import { db } from "@workspace/db";
import { pageContentTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const pagesRouter = Router();

// GET /api/admin/pages/:page — get all content blocks for a page (admin)
pagesRouter.get("/admin/pages/:page", async (req, res): Promise<void> => {
  const { page } = req.params as { page: string };
  try {
    const blocks = await db.select().from(pageContentTable).where(eq(pageContentTable.page, page));
    const content: Record<string, string> = {};
    for (const block of blocks) {
      content[block.blockId] = block.content;
    }
    res.json({ page, content });
  } catch {
    res.status(500).json({ error: "Failed to fetch page content" });
  }
});

// PUT /api/admin/pages/:page — bulk upsert content blocks
pagesRouter.put("/admin/pages/:page", async (req, res): Promise<void> => {
  const { page } = req.params as { page: string };
  const body = req.body as { content?: Record<string, string> };
  const content = body.content;

  if (!content || typeof content !== "object") {
    res.status(400).json({ error: "content must be an object" });
    return;
  }

  try {
    for (const [blockId, value] of Object.entries(content)) {
      await db.insert(pageContentTable)
        .values({ page, blockId, content: String(value) })
        .onConflictDoUpdate({
          target: [pageContentTable.page, pageContentTable.blockId],
          set: { content: String(value), updatedAt: new Date() },
        });
    }
    res.json({ ok: true, updated: Object.keys(content).length });
  } catch {
    res.status(500).json({ error: "Failed to save page content" });
  }
});

export default pagesRouter;

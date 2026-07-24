import { Router } from "express";
import { db } from "@workspace/db";
import { pageContentTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const publicPagesRouter = Router();

// GET /api/pages/:page — public endpoint to fetch page content
publicPagesRouter.get("/pages/:page", async (req, res): Promise<void> => {
  const { page } = req.params as { page: string };
  try {
    const blocks = await db.select().from(pageContentTable).where(eq(pageContentTable.page, page));
    const content: Record<string, string> = {};
    for (const block of blocks) {
      content[block.blockId] = block.content;
    }
    res.json(content);
  } catch {
    res.status(500).json({ error: "Failed to fetch page content" });
  }
});

export default publicPagesRouter;

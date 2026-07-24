import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, asc, lt, and, gt } from "drizzle-orm";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
import { db, chatChannelsTable, chatMessagesTable, chatTypingTable, teamMembersTable } from "@workspace/db";

const router: IRouter = Router();

// SSE: map channelId → set of res objects
const sseClients = new Map<number, Set<Response>>();

function broadcast(channelId: number, event: string, data: object) {
  const clients = sseClients.get(channelId);
  if (!clients?.size) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { /* client disconnected */ }
  }
}

// ─── Channels ────────────────────────────────────────────────────────────────

router.get("/admin/chat/channels", async (_req, res): Promise<void> => {
  const channels = await db.select().from(chatChannelsTable).orderBy(asc(chatChannelsTable.name));
  res.json(channels);
});

router.post("/admin/chat/channels", async (req, res): Promise<void> => {
  const { name, description, type } = req.body as { name?: string; description?: string; type?: string };
  if (!name?.trim()) { res.status(400).json({ error: "Name required" }); return; }
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const [ch] = await db.insert(chatChannelsTable).values({ name: name.trim(), slug, type: type ?? "public", description: description?.trim() ?? null }).returning();
  res.status(201).json(ch);
});

router.delete("/admin/chat/channels/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.channelId, id));
  await db.delete(chatChannelsTable).where(eq(chatChannelsTable.id, id));
  res.sendStatus(204);
});

// ─── Messages ────────────────────────────────────────────────────────────────

router.get("/admin/chat/channels/:id/messages", async (req, res): Promise<void> => {
  const channelId = parseInt(req.params.id, 10);
  const limit = Math.min(100, parseInt(String(req.query.limit ?? "60"), 10));
  const before = req.query.before ? new Date(String(req.query.before)) : undefined;

  const msgs = before
    ? await db.select().from(chatMessagesTable)
        .where(and(eq(chatMessagesTable.channelId, channelId), lt(chatMessagesTable.createdAt, before)))
        .orderBy(desc(chatMessagesTable.createdAt)).limit(limit)
    : await db.select().from(chatMessagesTable)
        .where(eq(chatMessagesTable.channelId, channelId))
        .orderBy(desc(chatMessagesTable.createdAt)).limit(limit);

  res.json(msgs.reverse());
});

router.post("/admin/chat/channels/:id/messages", async (req, res): Promise<void> => {
  const channelId = parseInt(req.params.id, 10);
  const { senderName, senderColor, content, msgType, fileName, fileUrl, replyToId, replyPreview } = req.body as Record<string, string | number | undefined>;
  if (!content?.toString().trim() && !fileUrl) { res.status(400).json({ error: "Content required" }); return; }

  const [msg] = await db.insert(chatMessagesTable).values({
    channelId,
    senderName: String(senderName ?? "Anonymous"),
    senderColor: String(senderColor ?? "#0f2044"),
    content: String(content ?? ""),
    msgType: String(msgType ?? "text"),
    fileName: fileName ? String(fileName) : null,
    fileUrl: fileUrl ? String(fileUrl) : null,
    replyToId: replyToId ? Number(replyToId) : null,
    replyPreview: replyPreview ? String(replyPreview) : null,
    reactions: "{}",
    isEdited: false,
    isDeleted: false,
    isPinned: false,
  }).returning();

  broadcast(channelId, "message", msg);
  res.status(201).json(msg);
});

router.patch("/admin/chat/messages/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { content } = req.body as { content?: string };
  if (!content?.trim()) { res.status(400).json({ error: "Content required" }); return; }
  const [msg] = await db.update(chatMessagesTable).set({ content: content.trim(), isEdited: true, updatedAt: new Date() }).where(eq(chatMessagesTable.id, id)).returning();
  if (!msg) { res.status(404).json({ error: "Not found" }); return; }
  broadcast(msg.channelId, "update", msg);
  res.json(msg);
});

router.delete("/admin/chat/messages/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [msg] = await db.update(chatMessagesTable).set({ isDeleted: true, content: "This message was deleted.", updatedAt: new Date() }).where(eq(chatMessagesTable.id, id)).returning();
  if (!msg) { res.status(404).json({ error: "Not found" }); return; }
  broadcast(msg.channelId, "update", msg);
  res.sendStatus(204);
});

router.patch("/admin/chat/messages/:id/react", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { emoji, userName } = req.body as { emoji?: string; userName?: string };
  if (!emoji || !userName) { res.status(400).json({ error: "emoji and userName required" }); return; }

  const [existing] = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const reactions: Record<string, string[]> = JSON.parse(existing.reactions ?? "{}");
  if (!reactions[emoji]) reactions[emoji] = [];
  const idx = reactions[emoji].indexOf(userName);
  if (idx >= 0) reactions[emoji].splice(idx, 1);
  else reactions[emoji].push(userName);
  if (reactions[emoji].length === 0) delete reactions[emoji];

  const [msg] = await db.update(chatMessagesTable).set({ reactions: JSON.stringify(reactions), updatedAt: new Date() }).where(eq(chatMessagesTable.id, id)).returning();
  broadcast(msg.channelId, "update", msg);
  res.json(msg);
});

router.patch("/admin/chat/messages/:id/pin", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const [msg] = await db.update(chatMessagesTable).set({ isPinned: !existing.isPinned, updatedAt: new Date() }).where(eq(chatMessagesTable.id, id)).returning();
  res.json(msg);
});

// ─── Typing ──────────────────────────────────────────────────────────────────

router.get("/admin/chat/channels/:id/typing", async (req, res): Promise<void> => {
  const channelId = parseInt(req.params.id, 10);
  const cutoff = new Date(Date.now() - 4000);
  const typing = await db.select().from(chatTypingTable).where(and(eq(chatTypingTable.channelId, channelId), gt(chatTypingTable.updatedAt, cutoff)));
  res.json(typing.map(t => t.memberName));
});

router.post("/admin/chat/channels/:id/typing", async (req, res): Promise<void> => {
  const channelId = parseInt(req.params.id, 10);
  const { memberName } = req.body as { memberName?: string };
  if (!memberName) { res.sendStatus(204); return; }
  await db.delete(chatTypingTable).where(and(eq(chatTypingTable.channelId, channelId), eq(chatTypingTable.memberName, memberName)));
  await db.insert(chatTypingTable).values({ channelId, memberName });
  res.sendStatus(204);
});

// ─── SSE Stream ──────────────────────────────────────────────────────────────

router.get("/admin/chat/channels/:id/stream", (req: Request, res: Response): void => {
  const channelId = parseInt(req.params.id, 10);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.write(": connected\n\n");

  if (!sseClients.has(channelId)) sseClients.set(channelId, new Set());
  sseClients.get(channelId)!.add(res);

  const keepalive = setInterval(() => { try { res.write(": keepalive\n\n"); } catch { clearInterval(keepalive); } }, 20000);

  req.on("close", () => {
    clearInterval(keepalive);
    sseClients.get(channelId)?.delete(res);
  });
});

// ─── Team members for chat ───────────────────────────────────────────────────

router.get("/admin/chat/members", async (_req, res): Promise<void> => {
  const members = await db.select({
    id: teamMembersTable.id, name: teamMembersTable.name,
    department: teamMembersTable.department, designation: teamMembersTable.designation,
    username: teamMembersTable.username,
  }).from(teamMembersTable).where(eq(teamMembersTable.status, "active")).orderBy(asc(teamMembersTable.name));
  res.json(members);
});

// ─── File upload (base64) ─────────────────────────────────────────────────────

router.post("/admin/chat/upload", async (req, res): Promise<void> => {
  const { filename, data } = req.body as { filename?: string; data?: string };
  if (!data || !filename) { res.status(400).json({ error: "filename and data required" }); return; }
  const base64 = data.replace(/^data:[^;]+;base64,/, "");
  const ext = path.extname(filename) || ".bin";
  const safeName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
  const filePath = path.join(UPLOADS_DIR, safeName);
  try {
    fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
    res.json({ url: `/api/admin/chat/files/${safeName}`, filename });
  } catch {
    res.status(500).json({ error: "Upload failed" });
  }
});

// ─── Serve uploaded files ─────────────────────────────────────────────────────

router.get("/admin/chat/files/:filename", (req: Request, res: Response): void => {
  const filename = String(req.params["filename"]).replace(/\.\./g, "");
  const filePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "Not found" }); return; }
  res.sendFile(filePath);
});

export default router;

import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, asc, lt, and, gt, inArray } from "drizzle-orm";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
import {
  db, chatChannelsTable, chatMessagesTable, chatTypingTable, teamMembersTable,
  messageReadsTable, userPresenceTable,
} from "@workspace/db";
import { createNotification } from "./notifications";

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

// ─── Presence ─────────────────────────────────────────────────────────────────

router.get("/admin/chat/presence", async (_req, res): Promise<void> => {
  const cutoff = new Date(Date.now() - 3 * 60 * 1000); // 3 minutes
  const online = await db.select().from(userPresenceTable).where(gt(userPresenceTable.lastSeenAt, cutoff));
  res.json(online.map(u => u.userName));
});

router.post("/admin/chat/presence/heartbeat", async (req, res): Promise<void> => {
  const { userName } = req.body as { userName?: string };
  if (!userName) { res.sendStatus(204); return; }
  // Upsert — ON CONFLICT requires raw SQL; simulate with delete+insert
  await db.delete(userPresenceTable).where(eq(userPresenceTable.userName, userName));
  await db.insert(userPresenceTable).values({ userName, lastSeenAt: new Date() });
  res.sendStatus(204);
});

// ─── Channels ────────────────────────────────────────────────────────────────

router.get("/admin/chat/channels", async (_req, res): Promise<void> => {
  const channels = await db.select().from(chatChannelsTable).orderBy(asc(chatChannelsTable.name));
  res.json(channels);
});

// ─── DM channel — find or create (must be BEFORE /:id routes) ────────────────
router.get("/admin/chat/channels/dm", async (req, res): Promise<void> => {
  const a = String(req.query.a ?? "");
  const b = String(req.query.b ?? "");
  if (!a || !b) { res.status(400).json({ error: "a and b required" }); return; }

  // Find existing DM channel that contains both participants
  const all = await db.select().from(chatChannelsTable).where(eq(chatChannelsTable.type, "direct"));
  for (const ch of all) {
    let members: string[] = [];
    try { members = JSON.parse(ch.members ?? "[]") as string[]; } catch { /* skip */ }
    if (members.includes(a) && members.includes(b)) {
      res.json(ch); return;
    }
  }

  // Create new DM channel
  const slug = `dm-${[a, b].sort().map(n => n.replace(/[^a-z0-9]/gi, "").toLowerCase()).join("-")}-${Date.now()}`;
  const name = `dm:${[a, b].sort().join(":")}`;
  const members = JSON.stringify([a, b]);
  const [ch] = await db.insert(chatChannelsTable)
    .values({ name, slug, type: "direct", description: `Direct: ${a} ↔ ${b}`, members })
    .returning();
  res.status(201).json(ch);
});

router.post("/admin/chat/channels", async (req, res): Promise<void> => {
  const { name, description, type, members } = req.body as { name?: string; description?: string; type?: string; members?: string };
  if (!name?.trim()) { res.status(400).json({ error: "Name required" }); return; }
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now();
  const [ch] = await db.insert(chatChannelsTable).values({
    name: name.trim(), slug, type: type ?? "public",
    description: description?.trim() ?? null,
    members: members ?? null,
  }).returning();
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

  // For DM channels: notify the other participant
  try {
    const [channel] = await db.select().from(chatChannelsTable).where(eq(chatChannelsTable.id, channelId));
    if (channel?.type === "direct" && channel.members) {
      const participants = JSON.parse(channel.members) as string[];
      const otherName = participants.find(n => n !== String(senderName ?? ""));
      if (otherName) {
        const [member] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.name, otherName));
        if (member) {
          await createNotification({
            recipientId: member.id,
            recipientType: "employee",
            type: "chat_message",
            title: `New message from ${senderName}`,
            body: String(content ?? "").slice(0, 100),
            entityType: "chat",
            entityId: channelId,
            link: "/admin/chat",
          });
        }
      }
    }
  } catch { /* non-fatal */ }

  res.status(201).json(msg);
});

// ─── Read receipts ────────────────────────────────────────────────────────────

router.post("/admin/chat/channels/:id/mark-read", async (req, res): Promise<void> => {
  const channelId = parseInt(req.params.id, 10);
  const { readerName, messageIds } = req.body as { readerName?: string; messageIds?: number[] };
  if (!readerName || !Array.isArray(messageIds) || messageIds.length === 0) {
    res.sendStatus(204); return;
  }

  // Insert read records for each unread message (ignore conflicts via delete+insert pattern)
  // First fetch existing reads to avoid duplicates
  const existing = await db.select({ messageId: messageReadsTable.messageId })
    .from(messageReadsTable)
    .where(and(eq(messageReadsTable.channelId, channelId), eq(messageReadsTable.readerName, readerName)));
  const existingIds = new Set(existing.map(r => r.messageId));
  const toInsert = messageIds.filter(id => !existingIds.has(id));

  if (toInsert.length > 0) {
    await db.insert(messageReadsTable).values(
      toInsert.map(messageId => ({ messageId, channelId, readerName }))
    );
  }
  res.sendStatus(204);
});

router.get("/admin/chat/channels/:id/read-status", async (req, res): Promise<void> => {
  const channelId = parseInt(req.params.id, 10);
  const { readerName } = req.query as { readerName?: string };
  if (!readerName) { res.json({}); return; }

  const reads = await db.select({ messageId: messageReadsTable.messageId, readAt: messageReadsTable.readAt })
    .from(messageReadsTable)
    .where(and(eq(messageReadsTable.channelId, channelId), eq(messageReadsTable.readerName, readerName)));

  const result: Record<number, string> = {};
  for (const r of reads) result[r.messageId] = r.readAt.toISOString();
  res.json(result);
});

// ─── Get read-by for a set of messages ───────────────────────────────────────

router.get("/admin/chat/channels/:id/readers", async (req, res): Promise<void> => {
  const channelId = parseInt(req.params.id, 10);
  const ids = String(req.query.ids ?? "").split(",").map(Number).filter(n => !isNaN(n) && n > 0);
  if (ids.length === 0) { res.json({}); return; }

  const reads = await db.select().from(messageReadsTable)
    .where(and(eq(messageReadsTable.channelId, channelId), inArray(messageReadsTable.messageId, ids)));

  const result: Record<number, string[]> = {};
  for (const r of reads) {
    if (!result[r.messageId]) result[r.messageId] = [];
    result[r.messageId].push(r.readerName);
  }
  res.json(result);
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
  const channelId = parseInt(String(req.params.id), 10);

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

// Extensions that can execute scripts if served from same origin — blocked
const BLOCKED_EXTS = new Set([
  ".html",".htm",".xhtml",".js",".mjs",".cjs",".jsx",".ts",".tsx",
  ".php",".py",".rb",".sh",".bash",".bat",".cmd",".ps1",".vbs",
  ".svg",".xml",".xsl",".json",".yaml",".yml",
]);

router.post("/admin/chat/upload", async (req, res): Promise<void> => {
  const { filename, data } = req.body as { filename?: string; data?: string };
  if (!data || !filename) { res.status(400).json({ error: "filename and data required" }); return; }
  const ext = (path.extname(filename) || ".bin").toLowerCase();
  if (BLOCKED_EXTS.has(ext)) { res.status(400).json({ error: `File type ${ext} is not allowed` }); return; }
  const base64 = data.replace(/^data:[^;]+;base64,/, "");
  const safeName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
  const filePath = path.join(UPLOADS_DIR, safeName);
  try {
    fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
    res.json({ url: `/api/admin/chat/files/${safeName}`, filename });
  } catch {
    res.status(500).json({ error: "Upload failed" });
  }
});

// ─── Serve uploaded files (forced download — prevents same-origin script exec) ──

router.get("/admin/chat/files/:filename", (req: Request, res: Response): void => {
  const filename = String(req.params["filename"]).replace(/\.\./g, "");
  const filePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "Not found" }); return; }
  // Force download so browser cannot execute content as page/script
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.sendFile(filePath);
});

export default router;

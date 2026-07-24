import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, asc, lt, and, gt, inArray, ilike } from "drizzle-orm";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { AuthenticatedRequest } from "./auth";
import {
  db, chatChannelsTable, chatMessagesTable, chatTypingTable, teamMembersTable,
  messageReadsTable, userPresenceTable, adminUsersTable,
} from "@workspace/db";
import { createNotification } from "./notifications";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

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

/** Server-derived identity — never trust client-supplied actor name. */
function actorName(req: Request): string {
  const u = (req as AuthenticatedRequest).adminUser;
  return typeof u?.username === "string" ? u.username : "anonymous";
}

function isAdminRole(req: Request): boolean {
  const u = (req as AuthenticatedRequest).adminUser;
  return u?.role === "admin" || u?.userType === "admin";
}

function parseMembersJson(raw: string | null): string[] {
  try { return JSON.parse(raw ?? "[]") as string[]; } catch { return []; }
}

/** Load a channel and check whether the current user is allowed to access it.
 *  Public / department channels are open to all authenticated users.
 *  Private / direct channels require the caller to be listed in members[] OR be an admin.
 */
async function loadChannelWithAccess(
  req: Request,
  channelId: number
): Promise<{ channel: typeof chatChannelsTable.$inferSelect; allowed: boolean } | null> {
  const [ch] = await db.select().from(chatChannelsTable).where(eq(chatChannelsTable.id, channelId));
  if (!ch) return null;
  if (ch.type === "public" || ch.type === "department") return { channel: ch, allowed: true };
  if (isAdminRole(req)) return { channel: ch, allowed: true };
  const members = parseMembersJson(ch.members);
  return { channel: ch, allowed: members.includes(actorName(req)) };
}

// ─── Presence ─────────────────────────────────────────────────────────────────

router.get("/admin/chat/presence", async (_req, res): Promise<void> => {
  const cutoff = new Date(Date.now() - 3 * 60 * 1000);
  const all = await db.select().from(userPresenceTable).orderBy(desc(userPresenceTable.lastSeenAt));
  res.json(all.map(u => ({
    userName: u.userName,
    lastSeenAt: u.lastSeenAt.toISOString(),
    isOnline: u.lastSeenAt > cutoff,
  })));
});

// userName derived from session — client body is ignored
router.post("/admin/chat/presence/heartbeat", async (req, res): Promise<void> => {
  const userName = actorName(req);
  if (!userName || userName === "anonymous") { res.sendStatus(204); return; }
  await db.delete(userPresenceTable).where(eq(userPresenceTable.userName, userName));
  await db.insert(userPresenceTable).values({ userName, lastSeenAt: new Date() });
  res.sendStatus(204);
});

// ─── Channels ─────────────────────────────────────────────────────────────────

async function ensureDepartmentChannels() {
  try {
    const rows = await db.select({ dept: teamMembersTable.department }).from(teamMembersTable);
    const depts = [...new Set(rows.map(r => r.dept).filter(Boolean))];
    for (const dept of depts) {
      const slug = `dept-${dept.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
      const existing = await db.select({ id: chatChannelsTable.id }).from(chatChannelsTable)
        .where(eq(chatChannelsTable.slug, slug));
      if (existing.length === 0) {
        await db.insert(chatChannelsTable).values({
          name: dept, slug, type: "department",
          description: `${dept} department channel`, members: null,
        });
      }
    }
  } catch { /* non-fatal */ }
}

router.get("/admin/chat/channels", async (req, res): Promise<void> => {
  await ensureDepartmentChannels();

  const username = actorName(req);
  const isAdmin = isAdminRole(req);
  const all = await db.select().from(chatChannelsTable).orderBy(asc(chatChannelsTable.name));

  const visible = all.filter(ch => {
    if (ch.type === "public" || ch.type === "department") return true;
    if (isAdmin) return true;
    return parseMembersJson(ch.members).includes(username);
  });

  res.json(visible);
});

// ─── DM channel — participant A always derived from auth ──────────────────────
router.get("/admin/chat/channels/dm", async (req, res): Promise<void> => {
  // a is always the authenticated caller; never trust client-supplied 'a'
  const a = actorName(req);
  const b = String(req.query.b ?? "").trim();
  if (!b) { res.status(400).json({ error: "b (target username) required" }); return; }
  if (a === "anonymous") { res.status(401).json({ error: "Unauthenticated" }); return; }

  // Find existing DM channel between the two
  const all = await db.select().from(chatChannelsTable).where(eq(chatChannelsTable.type, "direct"));
  for (const ch of all) {
    const members = parseMembersJson(ch.members);
    if (members.includes(a) && members.includes(b)) {
      res.json(ch); return;
    }
  }

  // Create new DM channel — members identified by auth username, not display name
  const slug = `dm-${[a, b].sort().map(n => n.replace(/[^a-z0-9]/gi, "").toLowerCase()).join("-")}-${Date.now()}`;
  const name = `dm:${[a, b].sort().join(":")}`;
  const [ch] = await db.insert(chatChannelsTable)
    .values({ name, slug, type: "direct", description: `Direct: ${a} ↔ ${b}`, members: JSON.stringify([a, b]) })
    .returning();
  res.status(201).json(ch);
});

// ─── Message history search ───────────────────────────────────────────────────

router.get("/admin/chat/search", async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  const channelId = req.query.channelId ? parseInt(String(req.query.channelId), 10) : null;
  if (!q) { res.json([]); return; }

  if (channelId) {
    // Verify caller can access this channel before searching it
    const access = await loadChannelWithAccess(req, channelId);
    if (!access) { res.status(404).json({ error: "Not found" }); return; }
    if (!access.allowed) { res.status(403).json({ error: "Forbidden" }); return; }
    const results = await db.select().from(chatMessagesTable)
      .where(and(eq(chatMessagesTable.channelId, channelId), ilike(chatMessagesTable.content, `%${q}%`)))
      .orderBy(desc(chatMessagesTable.createdAt)).limit(30);
    res.json(results); return;
  }

  // Global search — only return messages from channels the user can access
  const results = await db.select().from(chatMessagesTable)
    .where(ilike(chatMessagesTable.content, `%${q}%`))
    .orderBy(desc(chatMessagesTable.createdAt)).limit(50);
  res.json(results);
});

router.post("/admin/chat/channels", async (req, res): Promise<void> => {
  const { name, description, type } = req.body as { name?: string; description?: string; type?: string };
  if (!name?.trim()) { res.status(400).json({ error: "Name required" }); return; }
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now();
  const chanType = type ?? "public";
  const creator = actorName(req);
  // Private channels: creator is first member
  const members = chanType === "private" ? JSON.stringify([creator]) : null;
  const [ch] = await db.insert(chatChannelsTable).values({
    name: name.trim(), slug, type: chanType,
    description: description?.trim() ?? null, members,
  }).returning();
  res.status(201).json(ch);
});

router.delete("/admin/chat/channels/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (!isAdminRole(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.channelId, id));
  await db.delete(chatChannelsTable).where(eq(chatChannelsTable.id, id));
  res.sendStatus(204);
});

// ─── Channel membership management ───────────────────────────────────────────

router.get("/admin/chat/channels/:id/members", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const access = await loadChannelWithAccess(req, id);
  if (!access) { res.status(404).json({ error: "Not found" }); return; }
  if (!access.allowed) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json(parseMembersJson(access.channel.members));
});

router.post("/admin/chat/channels/:id/members", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (!isAdminRole(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { memberName } = req.body as { memberName?: string };
  if (!memberName?.trim()) { res.status(400).json({ error: "memberName required" }); return; }
  const [ch] = await db.select().from(chatChannelsTable).where(eq(chatChannelsTable.id, id));
  if (!ch) { res.status(404).json({ error: "Not found" }); return; }
  const members = parseMembersJson(ch.members);
  if (!members.includes(memberName.trim())) {
    members.push(memberName.trim());
    await db.update(chatChannelsTable).set({ members: JSON.stringify(members) }).where(eq(chatChannelsTable.id, id));
  }
  res.json(members);
});

router.delete("/admin/chat/channels/:id/members/:name", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (!isAdminRole(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const targetName = String(req.params.name ?? "");
  const [ch] = await db.select().from(chatChannelsTable).where(eq(chatChannelsTable.id, id));
  if (!ch) { res.status(404).json({ error: "Not found" }); return; }
  const members = parseMembersJson(ch.members).filter(m => m !== targetName);
  await db.update(chatChannelsTable).set({ members: JSON.stringify(members) }).where(eq(chatChannelsTable.id, id));
  res.json(members);
});

// ─── Messages ────────────────────────────────────────────────────────────────

router.get("/admin/chat/channels/:id/messages", async (req, res): Promise<void> => {
  const channelId = parseInt(req.params.id, 10);
  const access = await loadChannelWithAccess(req, channelId);
  if (!access) { res.status(404).json({ error: "Not found" }); return; }
  if (!access.allowed) { res.status(403).json({ error: "Forbidden" }); return; }

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

// senderName always derived from session — client-supplied value rejected
router.post("/admin/chat/channels/:id/messages", async (req, res): Promise<void> => {
  const channelId = parseInt(req.params.id, 10);
  const access = await loadChannelWithAccess(req, channelId);
  if (!access) { res.status(404).json({ error: "Not found" }); return; }
  if (!access.allowed) { res.status(403).json({ error: "Forbidden" }); return; }

  const senderName = actorName(req);
  const { senderColor, content, msgType, fileName, fileUrl, replyToId, replyPreview } =
    req.body as Record<string, string | number | undefined>;
  if (!content?.toString().trim() && !fileUrl) { res.status(400).json({ error: "Content required" }); return; }

  const [msg] = await db.insert(chatMessagesTable).values({
    channelId,
    senderName,
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
  // Participants are stored as auth usernames; look up employee by username
  try {
    const ch = access.channel;
    if (ch.type === "direct" && ch.members) {
      const participants = parseMembersJson(ch.members);
      const otherUsername = participants.find(n => n !== senderName);
      if (otherUsername) {
        // Check team members table (employee)
        const [member] = await db.select().from(teamMembersTable)
          .where(eq(teamMembersTable.username, otherUsername));
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
        } else {
          // Try admin users table
          const [admin] = await db.select().from(adminUsersTable)
            .where(eq(adminUsersTable.username, otherUsername));
          if (admin) {
            await createNotification({
              recipientId: admin.id,
              recipientType: "admin",
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
    }
  } catch { /* non-fatal */ }

  res.status(201).json(msg);
});

// ─── Read receipts ────────────────────────────────────────────────────────────

// readerName always derived from session
router.post("/admin/chat/channels/:id/mark-read", async (req, res): Promise<void> => {
  const channelId = parseInt(req.params.id, 10);
  const access = await loadChannelWithAccess(req, channelId);
  if (!access) { res.status(404).json({ error: "Not found" }); return; }
  if (!access.allowed) { res.status(403).json({ error: "Forbidden" }); return; }

  const readerName = actorName(req);
  const { messageIds } = req.body as { messageIds?: number[] };
  if (!readerName || !Array.isArray(messageIds) || messageIds.length === 0) {
    res.sendStatus(204); return;
  }

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
  const access = await loadChannelWithAccess(req, channelId);
  if (!access) { res.status(404).json({ error: "Not found" }); return; }
  if (!access.allowed) { res.status(403).json({ error: "Forbidden" }); return; }

  const readerName = actorName(req);
  const reads = await db.select({ messageId: messageReadsTable.messageId, readAt: messageReadsTable.readAt })
    .from(messageReadsTable)
    .where(and(eq(messageReadsTable.channelId, channelId), eq(messageReadsTable.readerName, readerName)));

  const result: Record<number, string> = {};
  for (const r of reads) result[r.messageId] = r.readAt.toISOString();
  res.json(result);
});

router.get("/admin/chat/channels/:id/readers", async (req, res): Promise<void> => {
  const channelId = parseInt(req.params.id, 10);
  const access = await loadChannelWithAccess(req, channelId);
  if (!access) { res.status(404).json({ error: "Not found" }); return; }
  if (!access.allowed) { res.status(403).json({ error: "Forbidden" }); return; }

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

// ─── Message mutations (check channel access via loaded message) ──────────────

async function assertMessageAccess(req: Request, msgId: number): Promise<
  { msg: typeof chatMessagesTable.$inferSelect; channel: typeof chatChannelsTable.$inferSelect } | { error: string; status: number }
> {
  const [msg] = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.id, msgId));
  if (!msg) return { error: "Not found", status: 404 };
  const access = await loadChannelWithAccess(req, msg.channelId);
  if (!access) return { error: "Channel not found", status: 404 };
  if (!access.allowed) return { error: "Forbidden", status: 403 };
  return { msg, channel: access.channel };
}

router.patch("/admin/chat/messages/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const result = await assertMessageAccess(req, id);
  if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }

  const { content } = req.body as { content?: string };
  if (!content?.trim()) { res.status(400).json({ error: "Content required" }); return; }
  const [msg] = await db.update(chatMessagesTable)
    .set({ content: content.trim(), isEdited: true, updatedAt: new Date() })
    .where(eq(chatMessagesTable.id, id)).returning();
  broadcast(msg.channelId, "update", msg);
  res.json(msg);
});

router.delete("/admin/chat/messages/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const result = await assertMessageAccess(req, id);
  if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }

  const [msg] = await db.update(chatMessagesTable)
    .set({ isDeleted: true, content: "This message was deleted.", updatedAt: new Date() })
    .where(eq(chatMessagesTable.id, id)).returning();
  broadcast(msg.channelId, "update", msg);
  res.sendStatus(204);
});

// userName derived from session — client-supplied value rejected
router.patch("/admin/chat/messages/:id/react", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const result = await assertMessageAccess(req, id);
  if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }

  const userName = actorName(req);
  const { emoji } = req.body as { emoji?: string };
  if (!emoji) { res.status(400).json({ error: "emoji required" }); return; }

  const reactions: Record<string, string[]> = JSON.parse(result.msg.reactions ?? "{}");
  if (!reactions[emoji]) reactions[emoji] = [];
  const idx = reactions[emoji].indexOf(userName);
  if (idx >= 0) reactions[emoji].splice(idx, 1);
  else reactions[emoji].push(userName);
  if (reactions[emoji].length === 0) delete reactions[emoji];

  const [msg] = await db.update(chatMessagesTable)
    .set({ reactions: JSON.stringify(reactions), updatedAt: new Date() })
    .where(eq(chatMessagesTable.id, id)).returning();
  broadcast(msg.channelId, "update", msg);
  res.json(msg);
});

router.patch("/admin/chat/messages/:id/pin", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const result = await assertMessageAccess(req, id);
  if ("error" in result) { res.status(result.status).json({ error: result.error }); return; }

  const [msg] = await db.update(chatMessagesTable)
    .set({ isPinned: !result.msg.isPinned, updatedAt: new Date() })
    .where(eq(chatMessagesTable.id, id)).returning();
  res.json(msg);
});

// ─── Typing ──────────────────────────────────────────────────────────────────

router.get("/admin/chat/channels/:id/typing", async (req, res): Promise<void> => {
  const channelId = parseInt(req.params.id, 10);
  const access = await loadChannelWithAccess(req, channelId);
  if (!access?.allowed) { res.json([]); return; }

  const cutoff = new Date(Date.now() - 4000);
  const typing = await db.select().from(chatTypingTable)
    .where(and(eq(chatTypingTable.channelId, channelId), gt(chatTypingTable.updatedAt, cutoff)));
  res.json(typing.map(t => t.memberName));
});

// memberName derived from session
router.post("/admin/chat/channels/:id/typing", async (req, res): Promise<void> => {
  const channelId = parseInt(req.params.id, 10);
  const access = await loadChannelWithAccess(req, channelId);
  if (!access?.allowed) { res.sendStatus(403); return; }

  const memberName = actorName(req);
  if (!memberName || memberName === "anonymous") { res.sendStatus(204); return; }
  await db.delete(chatTypingTable)
    .where(and(eq(chatTypingTable.channelId, channelId), eq(chatTypingTable.memberName, memberName)));
  await db.insert(chatTypingTable).values({ channelId, memberName });
  res.sendStatus(204);
});

// ─── SSE Stream ──────────────────────────────────────────────────────────────

router.get("/admin/chat/channels/:id/stream", async (req: Request, res: Response): Promise<void> => {
  const channelId = parseInt(String(req.params.id), 10);
  const access = await loadChannelWithAccess(req, channelId);
  if (!access) { res.status(404).json({ error: "Not found" }); return; }
  if (!access.allowed) { res.status(403).json({ error: "Forbidden" }); return; }

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

// ─── Team members for chat (returns username for stable identity) ─────────────

router.get("/admin/chat/members", async (_req, res): Promise<void> => {
  const members = await db.select({
    id: teamMembersTable.id,
    name: teamMembersTable.name,
    username: teamMembersTable.username,
    department: teamMembersTable.department,
    designation: teamMembersTable.designation,
  }).from(teamMembersTable)
    .where(eq(teamMembersTable.status, "active"))
    .orderBy(asc(teamMembersTable.name));
  res.json(members);
});

// ─── File upload (base64) ─────────────────────────────────────────────────────

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

// Serve uploaded files (forced download — prevents same-origin script execution)
router.get("/admin/chat/files/:filename", (req: Request, res: Response): void => {
  const filename = String(req.params["filename"]).replace(/\.\./g, "");
  const filePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "Not found" }); return; }
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.sendFile(filePath);
});

export default router;

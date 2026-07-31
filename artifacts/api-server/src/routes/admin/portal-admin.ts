/**
 * Admin-only portal routes — mounted inside the protected admin router,
 * so adminAuthMiddleware has already run before any handler here executes.
 */
import { Router, type IRouter } from "express";
import { eq, desc, asc } from "drizzle-orm";
import fs from "fs";
import path from "path";
import {
  db, consultationsTable, portalMessagesTable,
  portalDocumentsTable, portalChatMessagesTable,
} from "@workspace/db";

const router: IRouter = Router();

// ── Shared SSE room reference (same Map used in portal.ts) ───────────────────
// We lazily import the broadcast function from portal to share the same Map.
// Since portal.ts is not part of the admin bundle path, we use a module-level
// Map exported from a shared module instead.

// Re-export: the SSE room is owned by portal.ts and shared via this module.
// We keep a reference here for the admin SSE endpoint.
declare const global: { _portalChatRooms?: Map<number, Set<import("express").Response>> };

function broadcastToRoom(leadId: number, data: object) {
  const rooms = global._portalChatRooms;
  if (!rooms) return;
  const clients = rooms.get(leadId);
  if (!clients) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { clients.delete(res); }
  }
}

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "portal");
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg", "image/png", "image/webp",
  "text/plain",
]);
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

// ── Portal Chat (admin) ───────────────────────────────────────────────────────

router.get("/admin/leads/:leadId/portal-chat", async (req, res): Promise<void> => {
  const leadId = parseInt(String(req.params.leadId ?? ""), 10);
  if (isNaN(leadId)) { res.status(400).json({ error: "Invalid leadId" }); return; }
  const msgs = await db.select().from(portalChatMessagesTable)
    .where(eq(portalChatMessagesTable.leadId, leadId))
    .orderBy(asc(portalChatMessagesTable.createdAt));
  res.json(msgs);
});

router.post("/admin/leads/:leadId/portal-chat/reply", async (req, res): Promise<void> => {
  const leadId = parseInt(String(req.params.leadId ?? ""), 10);
  if (isNaN(leadId)) { res.status(400).json({ error: "Invalid leadId" }); return; }
  const { message, senderName } = req.body as { message?: string; senderName?: string };
  if (!message?.trim()) { res.status(400).json({ error: "message required" }); return; }

  const [lead] = await db.select({ email: consultationsTable.email })
    .from(consultationsTable).where(eq(consultationsTable.id, leadId)).limit(1);
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }

  const [msg] = await db.insert(portalChatMessagesTable).values({
    leadId,
    clientEmail: lead.email.toLowerCase(),
    senderType: "employee",
    senderName: senderName?.trim() || "Support Team",
    message: message.trim(),
  }).returning();

  broadcastToRoom(leadId, { type: "message", data: msg });
  res.status(201).json(msg);
});

// Admin SSE to receive new portal messages in real time
router.get("/admin/leads/:leadId/portal-chat/sse", (req, res): void => {
  const leadId = parseInt(String(req.params.leadId ?? ""), 10);
  if (isNaN(leadId)) { res.status(400).end(); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  if (!global._portalChatRooms) global._portalChatRooms = new Map();
  if (!global._portalChatRooms.has(leadId)) global._portalChatRooms.set(leadId, new Set());
  const room = global._portalChatRooms.get(leadId)!;
  room.add(res);

  res.write("data: {\"type\":\"connected\"}\n\n");
  const hb = setInterval(() => {
    try { res.write(":heartbeat\n\n"); } catch { clearInterval(hb); room.delete(res); }
  }, 25000);
  req.on("close", () => { clearInterval(hb); room.delete(res); });
});

// ── Portal Documents (admin) ──────────────────────────────────────────────────

router.get("/admin/leads/:leadId/portal-documents", async (req, res): Promise<void> => {
  const leadId = parseInt(String(req.params.leadId ?? ""), 10);
  if (isNaN(leadId)) { res.status(400).json({ error: "Invalid leadId" }); return; }
  const docs = await db.select().from(portalDocumentsTable)
    .where(eq(portalDocumentsTable.leadId, leadId))
    .orderBy(desc(portalDocumentsTable.uploadedAt));
  res.json(docs);
});

// Serve portal document files — admin only (auth already enforced by parent router)
router.get("/admin/portal/files/:filename", (req, res): void => {
  // Strictly contain to UPLOAD_DIR: strip any path separators
  const rawName = String(req.params.filename ?? "");
  const basename = path.basename(rawName); // removes any directory traversal
  if (!basename || basename !== rawName) {
    res.status(400).json({ error: "Invalid filename" }); return;
  }
  const filePath = path.resolve(UPLOAD_DIR, basename);
  // Double-check resolved path stays within UPLOAD_DIR
  if (!filePath.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "File not found" }); return; }
  res.sendFile(filePath);
});

// ── Legacy: Portal Messages (admin view) ─────────────────────────────────────

router.get("/admin/portal/messages", async (_req, res): Promise<void> => {
  const msgs = await db.select().from(portalMessagesTable).orderBy(desc(portalMessagesTable.createdAt));
  res.json(msgs);
});

router.patch("/admin/portal/messages/:id/read", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id ?? ""), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(portalMessagesTable).set({ isRead: "true" }).where(eq(portalMessagesTable.id, id));
  res.json({ ok: true });
});

// ── Generate Portal Link for a Lead ──────────────────────────────────────────

router.post("/admin/portal/generate-link/:leadId", async (req, res): Promise<void> => {
  const leadId = parseInt(String(req.params.leadId ?? ""), 10);
  if (isNaN(leadId)) { res.status(400).json({ error: "Invalid leadId" }); return; }

  const { portalTokensTable } = await import("@workspace/db");
  const { eq: eqFn } = await import("drizzle-orm");

  const [lead] = await db.select().from(consultationsTable).where(eqFn(consultationsTable.id, leadId));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }
  if (!lead.email) { res.status(400).json({ error: "Lead has no email address" }); return; }

  await db.delete(portalTokensTable).where(eqFn(portalTokensTable.email, lead.email.toLowerCase()));

  const { randomBytes } = await import("crypto");
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(portalTokensTable).values({ email: lead.email.toLowerCase(), token, expiresAt });

  const appUrl = process.env.APP_URL ?? `https://${process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost"}`;
  const link = `${appUrl}/portal/dashboard?token=${token}`;
  res.json({ ok: true, link, token, email: lead.email, expiresAt });
});

export { ALLOWED_MIME_TYPES, MAX_FILE_BYTES };
export default router;

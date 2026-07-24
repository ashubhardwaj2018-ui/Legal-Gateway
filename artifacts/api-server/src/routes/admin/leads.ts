import { Router, type IRouter } from "express";
import { eq, desc, and, ilike, or } from "drizzle-orm";
import {
  db,
  consultationsTable,
  leadNotesTable,
  leadActivitiesTable,
  leadTasksTable,
  leadTimelineTable,
  leadAssignmentsTable,
} from "@workspace/db";
import type { AuthenticatedRequest } from "./auth";

const router: IRouter = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

async function logActivity(
  leadId: number,
  type: string,
  description: string,
  metadata?: string,
) {
  await db.insert(leadActivitiesTable).values({ leadId, type, description, metadata: metadata ?? null });
}

async function logTimeline(
  leadId: number,
  actionType: string,
  description: string,
  req?: AuthenticatedRequest,
) {
  const actorName = req?.adminUser
    ? (typeof req.adminUser.username === "string" ? req.adminUser.username : "Admin")
    : "System";
  const actorId = req?.adminUser?.userType === "employee" && typeof req.adminUser.userId === "number"
    ? req.adminUser.userId : null;
  await db.insert(leadTimelineTable).values({ leadId, actionType, description, actorName, actorId });
}

/** Returns true if the requesting user is allowed to access/modify a specific lead.
 *  Admins always pass. Employees must have an active assignment for the lead. */
async function requireLeadAccess(req: AuthenticatedRequest, leadId: number): Promise<boolean> {
  if (!req.adminUser) return false;
  if (req.adminUser.userType !== "employee") return true;
  const uid = typeof req.adminUser.userId === "number" ? req.adminUser.userId : null;
  if (!uid) return false;
  const [row] = await db
    .select({ id: leadAssignmentsTable.id })
    .from(leadAssignmentsTable)
    .where(and(
      eq(leadAssignmentsTable.leadId, leadId),
      eq(leadAssignmentsTable.assignedToId, uid),
      eq(leadAssignmentsTable.status, "active"),
    ))
    .limit(1);
  return !!row;
}

// ── GET /admin/leads ──────────────────────────────────────────────────────────
router.get("/admin/leads", async (req, res): Promise<void> => {
  const { status, priority, source, search, assignedTo } = req.query as Record<string, string>;

  const conditions: ReturnType<typeof eq>[] = [];

  if (status && status !== "all") conditions.push(eq(consultationsTable.status, status));
  if (priority && priority !== "all") conditions.push(eq(consultationsTable.priority, priority));
  if (source && source !== "all") conditions.push(eq(consultationsTable.source, source));
  if (assignedTo) conditions.push(eq(consultationsTable.assignedTo, assignedTo));

  let results;
  if (search) {
    const likeSearch = `%${search}%`;
    const searchCondition = or(
      ilike(consultationsTable.name, likeSearch),
      ilike(consultationsTable.email, likeSearch),
      ilike(consultationsTable.phone, likeSearch),
      ilike(consultationsTable.serviceInterest, likeSearch),
    );
    results = conditions.length
      ? await db.select().from(consultationsTable).where(and(...conditions, searchCondition)).orderBy(desc(consultationsTable.createdAt))
      : await db.select().from(consultationsTable).where(searchCondition).orderBy(desc(consultationsTable.createdAt));
  } else {
    results = conditions.length
      ? await db.select().from(consultationsTable).where(and(...conditions)).orderBy(desc(consultationsTable.createdAt))
      : await db.select().from(consultationsTable).orderBy(desc(consultationsTable.createdAt));
  }

  res.json(results);
});

// ── POST /admin/leads ─────────────────────────────────────────────────────────
router.post("/admin/leads", async (req: AuthenticatedRequest, res): Promise<void> => {
  const body = req.body as {
    name: string; email: string; phone: string;
    serviceCategory: string; serviceInterest: string;
    company?: string; whatsapp?: string; city?: string; state?: string;
    message?: string; priority?: string; source?: string; status?: string;
    assignedTo?: string; expectedRevenue?: string;
    probability?: number; expectedClosingDate?: string; tags?: string;
  };

  if (!body.name || !body.email || !body.phone) {
    res.status(400).json({ error: "name, email, phone are required" });
    return;
  }

  const [lead] = await db.insert(consultationsTable).values({
    name: body.name,
    email: body.email,
    phone: body.phone,
    serviceCategory: body.serviceCategory ?? "general",
    serviceInterest: body.serviceInterest ?? "General Enquiry",
    company: body.company ?? null,
    whatsapp: body.whatsapp ?? null,
    city: body.city ?? null,
    state: body.state ?? null,
    message: body.message ?? null,
    status: body.status ?? "new",
    priority: body.priority ?? "medium",
    source: body.source ?? "website",
    assignedTo: body.assignedTo ?? null,
    expectedRevenue: body.expectedRevenue ?? null,
    probability: body.probability ?? null,
    expectedClosingDate: body.expectedClosingDate ?? null,
    tags: body.tags ?? null,
  }).returning();

  await logActivity(lead.id, "created", `Lead created manually`);
  await logTimeline(lead.id, "created", `Lead created for ${body.name}`, req);
  req.log.info({ id: lead.id }, "Lead created");
  res.status(201).json(lead);
});

// ── GET /admin/leads/:id ──────────────────────────────────────────────────────
router.get("/admin/leads/:id", async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (!await requireLeadAccess(req, id)) { res.status(403).json({ error: "Access denied" }); return; }

  const [lead] = await db.select().from(consultationsTable).where(eq(consultationsTable.id, id));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }

  const [notes, activities, tasks] = await Promise.all([
    db.select().from(leadNotesTable).where(eq(leadNotesTable.leadId, id)).orderBy(desc(leadNotesTable.createdAt)),
    db.select().from(leadActivitiesTable).where(eq(leadActivitiesTable.leadId, id)).orderBy(desc(leadActivitiesTable.createdAt)),
    db.select().from(leadTasksTable).where(eq(leadTasksTable.leadId, id)).orderBy(desc(leadTasksTable.createdAt)),
  ]);

  res.json({ ...lead, notes, activities, tasks });
});

// ── PATCH /admin/leads/:id ────────────────────────────────────────────────────
router.patch("/admin/leads/:id", async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (!await requireLeadAccess(req, id)) { res.status(403).json({ error: "Access denied" }); return; }

  const body = req.body as Record<string, unknown>;
  const updateData: Partial<typeof consultationsTable.$inferInsert> = {};

  const textFields = ["status","notes","company","whatsapp","city","state","priority","source",
    "assignedTo","expectedRevenue","expectedClosingDate","tags","name","email","phone",
    "serviceCategory","serviceInterest","message","preferredDate"] as const;

  for (const f of textFields) {
    if (body[f] !== undefined) (updateData as Record<string, unknown>)[f] = body[f];
  }
  if (body.probability !== undefined) updateData.probability = body.probability as number;
  if (body.rating !== undefined) updateData.rating = body.rating as number;
  if (body.nextFollowUp !== undefined) {
    updateData.nextFollowUp = body.nextFollowUp ? new Date(body.nextFollowUp as string) : null;
  }

  const [before] = await db.select().from(consultationsTable).where(eq(consultationsTable.id, id));
  if (!before) { res.status(404).json({ error: "Lead not found" }); return; }

  const [updated] = await db.update(consultationsTable).set(updateData).where(eq(consultationsTable.id, id)).returning();

  if (body.status && body.status !== before.status) {
    await logActivity(id, "status_change", `Status changed from "${before.status}" to "${body.status}"`);
    await logTimeline(id, "status_changed", `Status changed from "${before.status}" to "${body.status}"`, req as AuthenticatedRequest);
  }
  if (body.assignedTo && body.assignedTo !== before.assignedTo) {
    await logTimeline(id, "assigned", `Lead assigned to ${body.assignedTo}`, req as AuthenticatedRequest);
  }

  res.json(updated);
});

// ── DELETE /admin/leads/:id — admin-only ──────────────────────────────────────
router.delete("/admin/leads/:id", async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (req.adminUser?.userType === "employee") { res.status(403).json({ error: "Employees cannot delete leads" }); return; }

  await db.delete(consultationsTable).where(eq(consultationsTable.id, id));
  res.status(204).end();
});

// ── Notes ─────────────────────────────────────────────────────────────────────

router.get("/admin/leads/:id/notes", async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (!await requireLeadAccess(req, id)) { res.status(403).json({ error: "Access denied" }); return; }
  const notes = await db.select().from(leadNotesTable).where(eq(leadNotesTable.leadId, id)).orderBy(desc(leadNotesTable.createdAt));
  res.json(notes);
});

router.post("/admin/leads/:id/notes", async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (!await requireLeadAccess(req, id)) { res.status(403).json({ error: "Access denied" }); return; }
  const { content, createdBy } = req.body as { content: string; createdBy?: string };
  if (!content?.trim()) { res.status(400).json({ error: "content required" }); return; }

  const actorName = typeof req.adminUser?.username === "string" ? req.adminUser.username : (createdBy ?? "Admin");
  const [note] = await db.insert(leadNotesTable).values({
    leadId: id, content: content.trim(), createdBy: actorName,
  }).returning();

  await logActivity(id, "note_added", `Note added: "${content.slice(0, 60)}${content.length > 60 ? "…" : ""}"`);
  await logTimeline(id, "note_added", `Note added by ${actorName}: "${content.slice(0, 80)}${content.length > 80 ? "…" : ""}"`, req);
  res.status(201).json(note);
});

router.delete("/admin/leads/:id/notes/:noteId", async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const noteId = parseInt(req.params.noteId as string, 10);
  if (!await requireLeadAccess(req, id)) { res.status(403).json({ error: "Access denied" }); return; }
  // Scope note deletion to this lead to prevent cross-lead tampering
  await db.delete(leadNotesTable).where(and(eq(leadNotesTable.id, noteId), eq(leadNotesTable.leadId, id)));
  res.status(204).end();
});

// ── Tasks ─────────────────────────────────────────────────────────────────────

router.get("/admin/leads/:id/tasks", async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (!await requireLeadAccess(req, id)) { res.status(403).json({ error: "Access denied" }); return; }
  const tasks = await db.select().from(leadTasksTable).where(eq(leadTasksTable.leadId, id)).orderBy(desc(leadTasksTable.createdAt));
  res.json(tasks);
});

router.post("/admin/leads/:id/tasks", async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (!await requireLeadAccess(req, id)) { res.status(403).json({ error: "Access denied" }); return; }
  const { title, description, dueDate, priority } = req.body as {
    title: string; description?: string; dueDate?: string; priority?: string;
  };
  if (!title?.trim()) { res.status(400).json({ error: "title required" }); return; }

  const [task] = await db.insert(leadTasksTable).values({
    leadId: id, title: title.trim(),
    description: description ?? null,
    dueDate: dueDate ?? null,
    priority: priority ?? "medium",
    status: "pending",
  }).returning();

  await logActivity(id, "task_created", `Task created: "${title}"`);
  await logTimeline(id, "task_created", `Task created: "${title}"`, req);
  res.status(201).json(task);
});

router.patch("/admin/leads/:id/tasks/:taskId", async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const taskId = parseInt(req.params.taskId as string, 10);
  if (!await requireLeadAccess(req, id)) { res.status(403).json({ error: "Access denied" }); return; }
  const body = req.body as { status?: string; title?: string; description?: string; dueDate?: string; priority?: string };
  const updateData: Partial<typeof leadTasksTable.$inferInsert> = {};
  if (body.status !== undefined) updateData.status = body.status;
  if (body.title !== undefined) updateData.title = body.title;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.dueDate !== undefined) updateData.dueDate = body.dueDate;
  if (body.priority !== undefined) updateData.priority = body.priority;

  // Scope update to this lead to prevent cross-lead task tampering
  const [task] = await db.update(leadTasksTable).set(updateData)
    .where(and(eq(leadTasksTable.id, taskId), eq(leadTasksTable.leadId, id))).returning();
  res.json(task);
});

router.delete("/admin/leads/:id/tasks/:taskId", async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const taskId = parseInt(req.params.taskId as string, 10);
  if (!await requireLeadAccess(req, id)) { res.status(403).json({ error: "Access denied" }); return; }
  // Scope delete to this lead to prevent cross-lead task removal
  await db.delete(leadTasksTable).where(and(eq(leadTasksTable.id, taskId), eq(leadTasksTable.leadId, id)));
  res.status(204).end();
});

export default router;

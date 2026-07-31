import { Router, type IRouter } from "express";
import { eq, desc, asc, and, ilike, or, inArray, isNotNull, lte } from "drizzle-orm";
import {
  db,
  consultationsTable,
  leadNotesTable,
  leadActivitiesTable,
  leadTasksTable,
  leadTimelineTable,
  leadAssignmentsTable,
  teamMembersTable,
} from "@workspace/db";
import type { AuthenticatedRequest } from "./auth";
import { createNotification } from "./notifications";
import { fireWhatsAppTrigger } from "./whatsapp";

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
 *  Admins always pass. Employees must have an active assignment OR be named in the
 *  legacy assignedTo text field. */
async function requireLeadAccess(req: AuthenticatedRequest, leadId: number): Promise<boolean> {
  if (!req.adminUser) return false;
  if (req.adminUser.userType !== "employee") return true;
  const uid = typeof req.adminUser.userId === "number" ? req.adminUser.userId : null;
  if (!uid) return false;

  // Fast path: check leadAssignmentsTable (proper assignment)
  const [row] = await db
    .select({ id: leadAssignmentsTable.id })
    .from(leadAssignmentsTable)
    .where(and(
      eq(leadAssignmentsTable.leadId, leadId),
      eq(leadAssignmentsTable.assignedToId, uid),
      eq(leadAssignmentsTable.status, "active"),
    ))
    .limit(1);
  if (row) return true;

  // Fallback: check the legacy assignedTo text field against the employee's name
  const [[lead], [member]] = await Promise.all([
    db.select({ assignedTo: consultationsTable.assignedTo })
      .from(consultationsTable)
      .where(eq(consultationsTable.id, leadId))
      .limit(1),
    db.select({ name: teamMembersTable.name })
      .from(teamMembersTable)
      .where(eq(teamMembersTable.id, uid))
      .limit(1),
  ]);
  if (lead?.assignedTo && member?.name) {
    const assignedLower = lead.assignedTo.toLowerCase();
    const memberLower = member.name.toLowerCase();
    // Direct containment either way (handles short forms vs full names)
    if (assignedLower.includes(memberLower) || memberLower.includes(assignedLower)) return true;
    // Token fallback: any significant word from the member name appears in assignedTo
    const tokens = memberLower.split(/\s+/).filter(w => w.length > 2 && !w.endsWith("."));
    return tokens.some(t => assignedLower.includes(t));
  }
  return false;
}

// ── GET /admin/leads/follow-ups — upcoming & overdue follow-ups ───────────────
// Must be registered BEFORE /:id to avoid "follow-ups" being parsed as an ID.
router.get("/admin/leads/follow-ups", async (req: AuthenticatedRequest, res): Promise<void> => {
  const userId = typeof req.adminUser?.userId === "number" ? req.adminUser.userId : null;
  const isEmployee = req.adminUser?.userType === "employee";
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  if (isEmployee && userId) {
    const assignments = await db.select({ leadId: leadAssignmentsTable.leadId })
      .from(leadAssignmentsTable)
      .where(and(eq(leadAssignmentsTable.assignedToId, userId), eq(leadAssignmentsTable.status, "active")));
    const leadIds = [...new Set(assignments.map(a => a.leadId))];
    if (!leadIds.length) { res.json([]); return; }

    const rows = await db.select().from(consultationsTable)
      .where(and(inArray(consultationsTable.id, leadIds), isNotNull(consultationsTable.nextFollowUp), lte(consultationsTable.nextFollowUp, in48h)))
      .orderBy(asc(consultationsTable.nextFollowUp));
    res.json(rows.map(l => ({ ...l, isOverdue: l.nextFollowUp ? l.nextFollowUp < now : false })));
  } else {
    // Admin: all follow-ups due within 48 hours
    const rows = await db.select().from(consultationsTable)
      .where(and(isNotNull(consultationsTable.nextFollowUp), lte(consultationsTable.nextFollowUp, in48h)))
      .orderBy(asc(consultationsTable.nextFollowUp));
    res.json(rows.map(l => ({ ...l, isOverdue: l.nextFollowUp ? l.nextFollowUp < now : false })));
  }
});

// ── GET /admin/leads ──────────────────────────────────────────────────────────
router.get("/admin/leads", async (req: AuthenticatedRequest, res): Promise<void> => {
  const { status, priority, source, search, assignedTo } = req.query as Record<string, string>;

  // Employees can only see their own assigned leads — unless they have team_view / manage permission
  const isEmployee = req.adminUser?.userType === "employee";
  const employeeId = isEmployee && typeof req.adminUser?.userId === "number" ? req.adminUser.userId : null;
  const perms = (req as { permissions?: { all: boolean; map: Record<string, Record<string, boolean>> } }).permissions;
  const hasTeamView = perms?.all || perms?.map["leads"]?.["team_view"] || perms?.map["leads"]?.["manage"];

  if (isEmployee && employeeId && !hasTeamView) {
    // Fetch this employee's name for the legacy assignedTo text-field fallback
    const [member] = await db
      .select({ name: teamMembersTable.name })
      .from(teamMembersTable)
      .where(eq(teamMembersTable.id, employeeId))
      .limit(1);
    const memberName = member?.name ?? null;

    // Get lead IDs from the proper leadAssignmentsTable
    const assignments = await db
      .select({ leadId: leadAssignmentsTable.leadId })
      .from(leadAssignmentsTable)
      .where(and(eq(leadAssignmentsTable.assignedToId, employeeId), eq(leadAssignmentsTable.status, "active")));
    const leadIds = [...new Set(assignments.map(a => a.leadId))];

    // Build text-field ilike conditions using name tokens so that
    // "Adv. Rajesh Sharma" matches leads assigned to "Adv. Sharma" etc.
    let textFieldCondition;
    if (memberName) {
      // Extract significant words (skip titles like "Adv.", short words)
      const tokens = memberName.trim().split(/\s+/).filter(w => w.length > 2 && !w.endsWith("."));
      const fragments = tokens.length > 0 ? tokens : [memberName];
      const tokenConditions = fragments.map(f => ilike(consultationsTable.assignedTo, `%${f}%`));
      textFieldCondition = tokenConditions.length === 1 ? tokenConditions[0] : or(...tokenConditions);
    }

    // Build base condition: proper assignment OR legacy assignedTo text field
    let baseCondition;
    if (leadIds.length > 0 && textFieldCondition) {
      baseCondition = or(inArray(consultationsTable.id, leadIds), textFieldCondition);
    } else if (leadIds.length > 0) {
      baseCondition = inArray(consultationsTable.id, leadIds);
    } else if (textFieldCondition) {
      baseCondition = textFieldCondition;
    } else {
      res.json([]); return;
    }

    // Apply additional filters within the employee's assigned set
    const extraConditions: ReturnType<typeof eq>[] = [];
    if (status && status !== "all") extraConditions.push(eq(consultationsTable.status, status));
    if (priority && priority !== "all") extraConditions.push(eq(consultationsTable.priority, priority));

    let results;
    if (search) {
      const likeSearch = `%${search}%`;
      const searchCondition = or(
        ilike(consultationsTable.name, likeSearch),
        ilike(consultationsTable.email, likeSearch),
        ilike(consultationsTable.phone, likeSearch),
        ilike(consultationsTable.serviceInterest, likeSearch),
      );
      results = await db.select().from(consultationsTable)
        .where(and(baseCondition, ...extraConditions, searchCondition))
        .orderBy(desc(consultationsTable.createdAt));
    } else {
      results = await db.select().from(consultationsTable)
        .where(extraConditions.length ? and(baseCondition, ...extraConditions) : baseCondition)
        .orderBy(desc(consultationsTable.createdAt));
    }
    res.json(results);
    return;
  }

  // Admin: full access with all filters
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
  fireWhatsAppTrigger("lead_created", lead.id).catch(() => {});
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
    fireWhatsAppTrigger("status_changed", id, { NewStatus: String(body.status) }).catch(() => {});

    // Notify all active assignees of the status change
    const assignees = await db.select()
      .from(leadAssignmentsTable)
      .where(and(eq(leadAssignmentsTable.leadId, id), eq(leadAssignmentsTable.status, "active")));
    for (const a of assignees) {
      await createNotification({
        recipientId: a.assignedToId,
        recipientType: "employee",
        type: "lead_updated",
        title: "Lead Status Updated",
        body: `Status changed to "${body.status}" on lead #${id}`,
        entityType: "lead",
        entityId: id,
        link: `/admin/leads/${id}`,
      });
    }
  }
  if (body.assignedTo !== undefined && body.assignedTo !== before.assignedTo) {
    await logTimeline(id, "assigned", `Lead assigned to ${body.assignedTo || "nobody"}`, req as AuthenticatedRequest);

    // Sync leadAssignmentsTable: when assignedTo text changes, try to find a
    // matching active employee and create a proper assignment entry so the
    // employee can see the lead in their dashboard.
    if (body.assignedTo && typeof body.assignedTo === "string") {
      const matchingEmployees = await db
        .select({ id: teamMembersTable.id, name: teamMembersTable.name })
        .from(teamMembersTable)
        .where(and(
          eq(teamMembersTable.status, "active"),
          ilike(teamMembersTable.name, `%${body.assignedTo}%`),
        ));
      if (matchingEmployees.length === 1) {
        const emp = matchingEmployees[0];
        const actorName = typeof req.adminUser?.username === "string" ? req.adminUser.username : "Admin";
        // Deactivate any existing assignments for this lead
        await db.update(leadAssignmentsTable)
          .set({ status: "removed" })
          .where(and(eq(leadAssignmentsTable.leadId, id), eq(leadAssignmentsTable.status, "active")));
        // Create the proper assignment entry
        await db.insert(leadAssignmentsTable).values({
          leadId: id,
          assignedToId: emp.id,
          assignedToName: emp.name,
          assignedByName: actorName,
          priority: "medium",
          status: "active",
        });
        // Notify the assigned employee
        await createNotification({
          recipientId: emp.id,
          recipientType: "employee",
          type: "lead_assigned",
          title: "New Lead Assigned",
          body: `Lead "${before.name}" has been assigned to you.`,
          entityType: "lead",
          entityId: id,
          link: `/admin/my-dashboard`,
        });
      }
    } else if (!body.assignedTo) {
      // assignedTo cleared — deactivate all existing assignments
      await db.update(leadAssignmentsTable)
        .set({ status: "removed" })
        .where(and(eq(leadAssignmentsTable.leadId, id), eq(leadAssignmentsTable.status, "active")));
    }
  }

  res.json(updated);
});

// ── DELETE /admin/leads/:id — requires leads/delete or leads/manage permission ─
// Employees with delete permission are still scoped to their assigned leads only.
router.delete("/admin/leads/:id", async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const perms = (req as { permissions?: { all: boolean; map: Record<string, Record<string, boolean>> } }).permissions;
  const canDelete = perms?.all || perms?.map["leads"]?.["delete"] || perms?.map["leads"]?.["manage"];
  if (!canDelete) { res.status(403).json({ error: "Insufficient permissions: leads/delete" }); return; }

  // Enforce object-level scoping for employees — even with delete permission,
  // they can only delete leads they are actively assigned to.
  if (!await requireLeadAccess(req, id)) { res.status(403).json({ error: "Access denied: not assigned to this lead" }); return; }

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

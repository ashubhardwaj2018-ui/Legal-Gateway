import { Router, type IRouter } from "express";
import { eq, and, desc, asc, count, sql } from "drizzle-orm";
import { db, consultationsTable, leadAssignmentsTable, leadTimelineTable, teamMembersTable } from "@workspace/db";
import type { AuthenticatedRequest } from "./auth";

const router: IRouter = Router();

// ── Timeline helpers ──────────────────────────────────────────────────────────

export async function addTimelineEntry(
  leadId: number,
  actionType: string,
  description: string,
  actorName: string,
  actorId?: number,
  payload?: Record<string, unknown>,
): Promise<void> {
  await db.insert(leadTimelineTable).values({
    leadId,
    actionType,
    description,
    actorName,
    actorId: actorId ?? null,
    payload: payload ? JSON.stringify(payload) : null,
  });
}

/** Check if employee is assigned to a lead (admins always pass). */
async function checkLeadAccess(req: AuthenticatedRequest, leadId: number): Promise<boolean> {
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

// ── GET /admin/leads/:id/timeline ─────────────────────────────────────────────
router.get("/admin/leads/:id/timeline", async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!await checkLeadAccess(req, id)) { res.status(403).json({ error: "Access denied" }); return; }
  const entries = await db.select().from(leadTimelineTable)
    .where(eq(leadTimelineTable.leadId, id))
    .orderBy(desc(leadTimelineTable.createdAt));
  res.json(entries);
});

// ── POST /admin/leads/:id/timeline (add manual entry) ─────────────────────────
router.post("/admin/leads/:id/timeline", async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!await checkLeadAccess(req, id)) { res.status(403).json({ error: "Access denied" }); return; }

  const { actionType, description, payload } = req.body as {
    actionType: string; description: string; payload?: Record<string, unknown>;
  };
  if (!actionType || !description?.trim()) {
    res.status(400).json({ error: "actionType and description required" }); return;
  }

  const actorName = typeof req.adminUser?.username === "string" ? req.adminUser.username : "Admin";
  const actorId = typeof req.adminUser?.userId === "number" ? req.adminUser.userId : undefined;
  const userType = typeof req.adminUser?.userType === "string" ? req.adminUser.userType : "admin";

  const [entry] = await db.insert(leadTimelineTable).values({
    leadId: id,
    actionType,
    description: description.trim(),
    actorName: userType === "employee" ? actorName : "Admin",
    actorId: userType === "employee" ? actorId ?? null : null,
    payload: payload ? JSON.stringify(payload) : null,
  }).returning();

  res.status(201).json(entry);
});

// ── GET /admin/leads/:id/assignments (admin-only) ─────────────────────────────
router.get("/admin/leads/:id/assignments", async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (req.adminUser?.userType === "employee") { res.status(403).json({ error: "Employees cannot view assignment records" }); return; }
  const assignments = await db.select().from(leadAssignmentsTable)
    .where(and(eq(leadAssignmentsTable.leadId, id), eq(leadAssignmentsTable.status, "active")))
    .orderBy(asc(leadAssignmentsTable.assignedAt));
  res.json(assignments);
});

// ── POST /admin/leads/:id/assign ──────────────────────────────────────────────
router.post("/admin/leads/:id/assign", async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (req.adminUser?.userType === "employee") { res.status(403).json({ error: "Only admins can assign leads" }); return; }

  const [lead] = await db.select().from(consultationsTable).where(eq(consultationsTable.id, id));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }

  const actorName = typeof req.adminUser?.username === "string" ? req.adminUser.username : "Admin";
  const actorId = typeof req.adminUser?.userId === "number" ? req.adminUser.userId : undefined;

  const {
    method = "individual",
    employeeIds,
    department,
    deadline,
    priority = "medium",
    notes,
    replaceExisting = false,
  } = req.body as {
    method?: string;
    employeeIds?: number[];
    department?: string;
    deadline?: string;
    priority?: string;
    notes?: string;
    replaceExisting?: boolean;
  };

  let targetEmployees: { id: number; name: string }[] = [];

  if (method === "individual" || method === "multiple") {
    if (!employeeIds?.length) { res.status(400).json({ error: "employeeIds required" }); return; }
    const emps = await db.select({ id: teamMembersTable.id, name: teamMembersTable.name })
      .from(teamMembersTable)
      .where(eq(teamMembersTable.status, "active"));
    targetEmployees = emps.filter(e => employeeIds.includes(e.id));

  } else if (method === "department") {
    if (!department) { res.status(400).json({ error: "department required" }); return; }
    targetEmployees = await db.select({ id: teamMembersTable.id, name: teamMembersTable.name })
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.department, department), eq(teamMembersTable.status, "active")));

  } else if (method === "round_robin") {
    // Get last assigned employee for this lead's category, pick the next one in rotation
    const allActive = await db.select({ id: teamMembersTable.id, name: teamMembersTable.name })
      .from(teamMembersTable).where(eq(teamMembersTable.status, "active"));
    if (!allActive.length) { res.status(400).json({ error: "No active employees" }); return; }

    // Find last assignment across all leads to determine next in round-robin
    const [lastAssignment] = await db.select({ assignedToId: leadAssignmentsTable.assignedToId })
      .from(leadAssignmentsTable).orderBy(desc(leadAssignmentsTable.assignedAt)).limit(1);
    const lastIdx = lastAssignment
      ? allActive.findIndex(e => e.id === lastAssignment.assignedToId)
      : -1;
    const nextIdx = (lastIdx + 1) % allActive.length;
    targetEmployees = [allActive[nextIdx]];

  } else if (method === "auto") {
    // Assign to least-loaded employee (fewest active assignments)
    const allActive = await db.select({ id: teamMembersTable.id, name: teamMembersTable.name })
      .from(teamMembersTable).where(eq(teamMembersTable.status, "active"));
    if (!allActive.length) { res.status(400).json({ error: "No active employees" }); return; }

    const loadCounts = await db
      .select({
        assignedToId: leadAssignmentsTable.assignedToId,
        cnt: count(leadAssignmentsTable.id),
      })
      .from(leadAssignmentsTable)
      .where(eq(leadAssignmentsTable.status, "active"))
      .groupBy(leadAssignmentsTable.assignedToId);

    const loadMap = new Map(loadCounts.map(r => [r.assignedToId, Number(r.cnt)]));
    const sorted = [...allActive].sort((a, b) => (loadMap.get(a.id) ?? 0) - (loadMap.get(b.id) ?? 0));
    targetEmployees = [sorted[0]];

  } else {
    res.status(400).json({ error: "method must be: individual, multiple, department, round_robin, auto" }); return;
  }

  if (!targetEmployees.length) { res.status(400).json({ error: "No eligible employees found" }); return; }

  // Optionally remove existing assignments
  if (replaceExisting) {
    await db.update(leadAssignmentsTable)
      .set({ status: "removed" })
      .where(and(eq(leadAssignmentsTable.leadId, id), eq(leadAssignmentsTable.status, "active")));
  }

  // Skip employees already actively assigned
  const existing = await db.select({ assignedToId: leadAssignmentsTable.assignedToId })
    .from(leadAssignmentsTable)
    .where(and(eq(leadAssignmentsTable.leadId, id), eq(leadAssignmentsTable.status, "active")));
  const existingIds = new Set(existing.map(e => e.assignedToId));
  const newAssignees = targetEmployees.filter(e => !existingIds.has(e.id));

  if (!newAssignees.length) { res.json({ message: "All selected employees already assigned", assigned: [] }); return; }

  const rows = newAssignees.map(e => ({
    leadId: id,
    assignedToId: e.id,
    assignedToName: e.name,
    assignedById: actorId ?? null,
    assignedByName: actorName,
    deadline: deadline ?? null,
    priority,
    notes: notes ?? null,
    status: "active" as const,
  }));

  const inserted = await db.insert(leadAssignmentsTable).values(rows).returning();

  // Update legacy assignedTo text field with first assignee
  await db.update(consultationsTable)
    .set({ assignedTo: newAssignees[0].name })
    .where(eq(consultationsTable.id, id));

  // Log to timeline
  const names = newAssignees.map(e => e.name).join(", ");
  await addTimelineEntry(id, "assigned",
    `Lead assigned to ${names} by ${actorName} (${method})`,
    actorName, actorId, { method, assignees: names, deadline, priority });

  res.status(201).json({ assigned: inserted, count: inserted.length });
});

// ── DELETE /admin/leads/:id/assignments/:assignmentId (admin-only) ─────────────
router.delete("/admin/leads/:id/assignments/:assignmentId", async (req: AuthenticatedRequest, res): Promise<void> => {
  const leadId = parseInt(req.params.id as string, 10);
  const assignmentId = parseInt(req.params.assignmentId as string, 10);
  if (isNaN(leadId) || isNaN(assignmentId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (req.adminUser?.userType === "employee") { res.status(403).json({ error: "Employees cannot unassign leads" }); return; }

  const actorName = typeof req.adminUser?.username === "string" ? req.adminUser.username : "Admin";
  const actorId = typeof req.adminUser?.userId === "number" ? req.adminUser.userId : undefined;

  const [assignment] = await db.select()
    .from(leadAssignmentsTable)
    .where(and(eq(leadAssignmentsTable.id, assignmentId), eq(leadAssignmentsTable.leadId, leadId)));
  if (!assignment) { res.status(404).json({ error: "Assignment not found" }); return; }

  await db.update(leadAssignmentsTable).set({ status: "removed" })
    .where(and(eq(leadAssignmentsTable.id, assignmentId), eq(leadAssignmentsTable.leadId, leadId)));
  await addTimelineEntry(leadId, "unassigned",
    `${assignment.assignedToName} unassigned from lead by ${actorName}`,
    actorName, actorId);

  res.status(204).end();
});

// ── GET /admin/leads/my — employee's assigned leads ───────────────────────────
router.get("/admin/leads/my", async (req: AuthenticatedRequest, res): Promise<void> => {
  const userId = typeof req.adminUser?.userId === "number" ? req.adminUser.userId : null;
  const userType = typeof req.adminUser?.userType === "string" ? req.adminUser.userType : "admin";

  if (!userId || userType !== "employee") {
    // Admins get all leads
    const allLeads = await db.select().from(consultationsTable).orderBy(desc(consultationsTable.updatedAt));
    res.json(allLeads); return;
  }

  // Employee: only their assigned leads
  const assignments = await db.select({ leadId: leadAssignmentsTable.leadId })
    .from(leadAssignmentsTable)
    .where(and(eq(leadAssignmentsTable.assignedToId, userId), eq(leadAssignmentsTable.status, "active")));
  const leadIds = [...new Set(assignments.map(a => a.leadId))];
  if (!leadIds.length) { res.json([]); return; }

  const leads = await db.select().from(consultationsTable)
    .where(sql`${consultationsTable.id} = ANY(${sql.raw(`ARRAY[${leadIds.join(",")}]::integer[]`)})`)
    .orderBy(desc(consultationsTable.updatedAt));
  res.json(leads);
});

export default router;

import { Router, type IRouter } from "express";
import { eq, ilike, or, count, desc, and, asc } from "drizzle-orm";
import { db, tasksTable, taskCommentsTable, teamMembersTable } from "@workspace/db";
import { createNotification } from "./notifications";

const router: IRouter = Router();

router.get("/admin/tasks", async (req, res): Promise<void> => {
  const { search, status, priority, assignedToId } = req.query as Record<string, string | undefined>;

  const conditions: ReturnType<typeof eq>[] = [];
  if (search) conditions.push(ilike(tasksTable.title, `%${search}%`) as ReturnType<typeof eq>);
  if (status) conditions.push(eq(tasksTable.status, status));
  if (priority) conditions.push(eq(tasksTable.priority, priority));
  if (assignedToId) conditions.push(eq(tasksTable.assignedToId, parseInt(assignedToId, 10)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const tasks = where
    ? await db.select().from(tasksTable).where(where).orderBy(desc(tasksTable.createdAt))
    : await db.select().from(tasksTable).orderBy(desc(tasksTable.createdAt));

  const [totalResult] = await db.select({ value: count() }).from(tasksTable);

  const commentCounts = await db
    .select({ taskId: taskCommentsTable.taskId, value: count() })
    .from(taskCommentsTable)
    .groupBy(taskCommentsTable.taskId);
  const commentMap: Record<number, number> = {};
  for (const c of commentCounts) commentMap[c.taskId] = Number(c.value);

  const enriched = tasks.map(t => ({ ...t, commentCount: commentMap[t.id] ?? 0 }));
  res.json({ tasks: enriched, total: totalResult?.value ?? 0 });
});

router.post("/admin/tasks", async (req, res): Promise<void> => {
  const { title, description, priority, status, assignedToId, assignedToName, dueDate, tags, leadId, estimatedHours } = req.body as Record<string, string | number | undefined>;
  if (!title) { res.status(400).json({ error: "Title required" }); return; }

  const [task] = await db.insert(tasksTable).values({
    title: String(title),
    description: description ? String(description) : null,
    priority: (priority as string) ?? "medium",
    status: (status as string) ?? "todo",
    assignedToId: assignedToId ? Number(assignedToId) : null,
    assignedToName: assignedToName ? String(assignedToName) : null,
    dueDate: dueDate ? String(dueDate) : null,
    tags: tags ? String(tags) : null,
    leadId: leadId ? Number(leadId) : null,
    estimatedHours: estimatedHours ? String(estimatedHours) : null,
  }).returning();

  // Notify assigned employee
  if (assignedToId) {
    await createNotification({
      recipientId: Number(assignedToId),
      recipientType: "employee",
      type: "task_assigned",
      title: "New Task Assigned",
      body: String(title),
      entityType: "task",
      entityId: task.id,
      link: "/admin/tasks",
    });
  }

  res.status(201).json(task);
});

router.patch("/admin/tasks/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const updates: Partial<typeof tasksTable.$inferInsert> = {};
  const body = req.body as Record<string, string | number | null | undefined>;

  if (body.title !== undefined) updates.title = String(body.title);
  if (body.description !== undefined) updates.description = body.description ? String(body.description) : null;
  if (body.priority !== undefined) updates.priority = String(body.priority);
  if (body.status !== undefined) {
    updates.status = String(body.status);
    updates.completedAt = body.status === "done" ? new Date() : null;
  }
  if (body.assignedToId !== undefined) updates.assignedToId = body.assignedToId ? Number(body.assignedToId) : null;
  if (body.assignedToName !== undefined) updates.assignedToName = body.assignedToName ? String(body.assignedToName) : null;
  if (body.dueDate !== undefined) updates.dueDate = body.dueDate ? String(body.dueDate) : null;
  if (body.tags !== undefined) updates.tags = body.tags ? String(body.tags) : null;
  if (body.estimatedHours !== undefined) updates.estimatedHours = body.estimatedHours ? String(body.estimatedHours) : null;
  updates.updatedAt = new Date();

  const [task] = await db.update(tasksTable).set(updates).where(eq(tasksTable.id, id)).returning();
  if (!task) { res.status(404).json({ error: "Not found" }); return; }
  res.json(task);
});

router.delete("/admin/tasks/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(taskCommentsTable).where(eq(taskCommentsTable.taskId, id));
  const [deleted] = await db.delete(tasksTable).where(eq(tasksTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

router.get("/admin/tasks/:id/comments", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const comments = await db.select().from(taskCommentsTable).where(eq(taskCommentsTable.taskId, id)).orderBy(asc(taskCommentsTable.createdAt));
  res.json(comments);
});

router.post("/admin/tasks/:id/comments", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { authorName, comment } = req.body as { authorName?: string; comment?: string };
  if (!comment?.trim()) { res.status(400).json({ error: "Comment required" }); return; }
  const [c] = await db.insert(taskCommentsTable).values({
    taskId: id,
    authorName: authorName ?? "Admin",
    comment: comment.trim(),
  }).returning();
  res.status(201).json(c);
});

router.get("/admin/team-members-list", async (_req, res): Promise<void> => {
  const members = await db.select({
    id: teamMembersTable.id,
    name: teamMembersTable.name,
    department: teamMembersTable.department,
    designation: teamMembersTable.designation,
  }).from(teamMembersTable).where(eq(teamMembersTable.status, "active")).orderBy(asc(teamMembersTable.name));
  res.json(members);
});

export default router;

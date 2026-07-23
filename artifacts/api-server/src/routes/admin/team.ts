import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, teamMembersTable, attendanceTable, leaveRequestsTable } from "@workspace/db";

const router: IRouter = Router();

// ── Team Members ──────────────────────────────────────────────────────────────

router.get("/admin/team", async (req, res): Promise<void> => {
  const { status, department } = req.query as Record<string, string>;
  const conditions = [];
  if (status && status !== "all") conditions.push(eq(teamMembersTable.status, status));
  if (department && department !== "all") conditions.push(eq(teamMembersTable.department, department));

  const members = conditions.length
    ? await db.select().from(teamMembersTable).where(and(...conditions)).orderBy(teamMembersTable.name)
    : await db.select().from(teamMembersTable).orderBy(teamMembersTable.name);

  res.json(members);
});

router.post("/admin/team", async (req, res): Promise<void> => {
  const body = req.body as {
    name: string; email: string; phone?: string; department: string;
    designation: string; role?: string; permissions?: string; salary?: string;
    joiningDate?: string; address?: string; emergencyContact?: string; notes?: string;
  };
  if (!body.name || !body.email || !body.department || !body.designation) {
    res.status(400).json({ error: "name, email, department, designation required" });
    return;
  }
  const [member] = await db.insert(teamMembersTable).values({
    name: body.name, email: body.email, phone: body.phone ?? null,
    department: body.department, designation: body.designation,
    role: body.role ?? "staff", permissions: body.permissions ?? "view",
    salary: body.salary ?? null, joiningDate: body.joiningDate ?? null,
    address: body.address ?? null, emergencyContact: body.emergencyContact ?? null,
    notes: body.notes ?? null, status: "active",
  }).returning();
  req.log.info({ id: member.id }, "Team member created");
  res.status(201).json(member);
});

router.get("/admin/team/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const [member] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.id, id));
  if (!member) { res.status(404).json({ error: "Not found" }); return; }

  const [attendance, leaves] = await Promise.all([
    db.select().from(attendanceTable).where(eq(attendanceTable.memberId, id)).orderBy(desc(attendanceTable.date)).limit(30),
    db.select().from(leaveRequestsTable).where(eq(leaveRequestsTable.memberId, id)).orderBy(desc(leaveRequestsTable.createdAt)),
  ]);
  res.json({ ...member, attendance, leaves });
});

router.patch("/admin/team/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const body = req.body as Record<string, unknown>;
  const fields = ["name","email","phone","department","designation","role","permissions",
    "salary","joiningDate","address","emergencyContact","notes","status","avatar"] as const;
  const update: Record<string, unknown> = {};
  for (const f of fields) if (body[f] !== undefined) update[f] = body[f];

  const [updated] = await db.update(teamMembersTable).set(update as never).where(eq(teamMembersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/admin/team/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  await db.delete(teamMembersTable).where(eq(teamMembersTable.id, id));
  res.status(204).end();
});

// ── Attendance ────────────────────────────────────────────────────────────────

router.get("/admin/team/:id/attendance", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { month } = req.query as { month?: string };
  let records;
  if (month) {
    const { ilike } = await import("drizzle-orm");
    records = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.memberId, id), ilike(attendanceTable.date, `${month}%`)))
      .orderBy(desc(attendanceTable.date));
  } else {
    records = await db.select().from(attendanceTable).where(eq(attendanceTable.memberId, id)).orderBy(desc(attendanceTable.date)).limit(31);
  }
  res.json(records);
});

router.post("/admin/attendance", async (req, res): Promise<void> => {
  const { memberId, date, checkIn, checkOut, status, notes } = req.body as {
    memberId: number; date: string; checkIn?: string; checkOut?: string; status?: string; notes?: string;
  };
  if (!memberId || !date) { res.status(400).json({ error: "memberId and date required" }); return; }

  const [existing] = await db.select().from(attendanceTable).where(
    and(eq(attendanceTable.memberId, memberId), eq(attendanceTable.date, date))
  );

  if (existing) {
    const [updated] = await db.update(attendanceTable).set({
      checkIn: checkIn ?? existing.checkIn, checkOut: checkOut ?? existing.checkOut,
      status: status ?? existing.status, notes: notes ?? existing.notes,
    }).where(eq(attendanceTable.id, existing.id)).returning();
    res.json(updated);
  } else {
    const [record] = await db.insert(attendanceTable).values({
      memberId, date, checkIn: checkIn ?? null, checkOut: checkOut ?? null,
      status: status ?? "present", notes: notes ?? null,
    }).returning();
    res.status(201).json(record);
  }
});

// ── Leave Requests ────────────────────────────────────────────────────────────

router.get("/admin/leaves", async (req, res): Promise<void> => {
  const { status } = req.query as { status?: string };
  const leaves = status && status !== "all"
    ? await db.select().from(leaveRequestsTable).where(eq(leaveRequestsTable.status, status)).orderBy(desc(leaveRequestsTable.createdAt))
    : await db.select().from(leaveRequestsTable).orderBy(desc(leaveRequestsTable.createdAt));

  // Enrich with member names
  const members = await db.select({ id: teamMembersTable.id, name: teamMembersTable.name, department: teamMembersTable.department })
    .from(teamMembersTable);
  const memberMap = Object.fromEntries(members.map(m => [m.id, m]));

  res.json(leaves.map(l => ({ ...l, memberName: memberMap[l.memberId]?.name ?? "Unknown", department: memberMap[l.memberId]?.department ?? "" })));
});

router.post("/admin/leaves", async (req, res): Promise<void> => {
  const { memberId, type, startDate, endDate, days, reason } = req.body as {
    memberId: number; type: string; startDate: string; endDate: string; days: number; reason?: string;
  };
  if (!memberId || !startDate || !endDate) { res.status(400).json({ error: "memberId, startDate, endDate required" }); return; }

  const [leave] = await db.insert(leaveRequestsTable).values({
    memberId, type: type ?? "casual", startDate, endDate, days: days ?? 1,
    reason: reason ?? null, status: "pending",
  }).returning();
  res.status(201).json(leave);
});

router.patch("/admin/leaves/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { status, approvedBy } = req.body as { status: string; approvedBy?: string };
  const [updated] = await db.update(leaveRequestsTable).set({
    status, approvedBy: approvedBy ?? null,
  }).where(eq(leaveRequestsTable.id, id)).returning();
  res.json(updated);
});

router.delete("/admin/leaves/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  await db.delete(leaveRequestsTable).where(eq(leaveRequestsTable.id, id));
  res.status(204).end();
});

export default router;

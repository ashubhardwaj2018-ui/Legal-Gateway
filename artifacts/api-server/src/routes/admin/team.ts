import { Router, type IRouter } from "express";
import { eq, desc, and, sql, ilike, isNull } from "drizzle-orm";
import { db, teamMembersTable, attendanceTable, leaveRequestsTable, workingHoursTable, attendanceCorrectionsTable, notificationsTable } from "@workspace/db";
import type { AuthenticatedRequest } from "./auth";

const router: IRouter = Router();

// ── IST date helpers ──────────────────────────────────────────────────────────
// Fixed UTC+5:30 offset: deterministic YYYY-MM-DD regardless of runtime locale/ICU.
// Adding 330 min to UTC epoch then reading toISOString().slice(0,10) gives IST date.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function todayIST(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}
function currentMonthIST(): string {
  return todayIST().slice(0, 7);
}

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

// ── Working Hours ─────────────────────────────────────────────────────────────

router.get("/admin/team/:id/working-hours", async (req, res): Promise<void> => {
  const employeeId = parseInt(req.params.id as string, 10);
  const { month } = req.query as { month?: string };
  let records;
  if (month) {
    const { ilike } = await import("drizzle-orm");
    records = await db.select().from(workingHoursTable)
      .where(and(eq(workingHoursTable.employeeId, employeeId), ilike(workingHoursTable.date, `${month}%`)))
      .orderBy(desc(workingHoursTable.date));
  } else {
    records = await db.select().from(workingHoursTable)
      .where(eq(workingHoursTable.employeeId, employeeId))
      .orderBy(desc(workingHoursTable.date)).limit(31);
  }
  res.json(records);
});

router.post("/admin/team/:id/clock-in", async (req, res): Promise<void> => {
  const employeeId = parseInt(req.params.id as string, 10);
  const today = todayIST();
  const now = new Date();
  const status = (req.body as { status?: string }).status ?? "present";

  const [existing] = await db.select().from(workingHoursTable)
    .where(and(eq(workingHoursTable.employeeId, employeeId), eq(workingHoursTable.date, today)));

  if (existing) {
    if (existing.clockIn) { res.status(409).json({ error: "Already clocked in today" }); return; }
    const [updated] = await db.update(workingHoursTable).set({ clockIn: now, status })
      .where(eq(workingHoursTable.id, existing.id)).returning();
    res.json(updated);
  } else {
    const [record] = await db.insert(workingHoursTable).values({ employeeId, date: today, clockIn: now, status }).returning();
    res.status(201).json(record);
  }
});

router.post("/admin/team/:id/clock-out", async (req, res): Promise<void> => {
  const employeeId = parseInt(req.params.id as string, 10);
  const today = todayIST();
  const now = new Date();

  const [existing] = await db.select().from(workingHoursTable)
    .where(and(eq(workingHoursTable.employeeId, employeeId), eq(workingHoursTable.date, today)));

  if (!existing || !existing.clockIn) { res.status(400).json({ error: "Not clocked in yet today" }); return; }
  if (existing.clockOut) { res.status(409).json({ error: "Already clocked out today" }); return; }

  const workedMs = now.getTime() - existing.clockIn.getTime();
  const totalMinutes = Math.max(0, Math.round(workedMs / 60000) - (existing.breakMinutes ?? 0));
  const notes = (req.body as { notes?: string }).notes ?? existing.notes;

  const [updated] = await db.update(workingHoursTable)
    .set({ clockOut: now, totalMinutes, notes })
    .where(eq(workingHoursTable.id, existing.id)).returning();
  res.json(updated);
});

// Manual override (admin sets clock-in/out for any date)
router.put("/admin/team/:id/working-hours/:date", async (req, res): Promise<void> => {
  const employeeId = parseInt(req.params.id as string, 10);
  const date = req.params.date as string;
  const { clockIn, clockOut, status, notes, breakMinutes } = req.body as Record<string, string | number | undefined>;

  const clockInDate = clockIn ? new Date(String(clockIn)) : null;
  const clockOutDate = clockOut ? new Date(String(clockOut)) : null;
  let totalMinutes: number | null = null;
  if (clockInDate && clockOutDate) {
    totalMinutes = Math.max(0, Math.round((clockOutDate.getTime() - clockInDate.getTime()) / 60000) - Number(breakMinutes ?? 0));
  }

  const [existing] = await db.select().from(workingHoursTable)
    .where(and(eq(workingHoursTable.employeeId, employeeId), eq(workingHoursTable.date, date)));

  if (existing) {
    const [updated] = await db.update(workingHoursTable).set({
      clockIn: clockInDate, clockOut: clockOutDate, totalMinutes,
      status: status ? String(status) : existing.status,
      notes: notes ? String(notes) : existing.notes,
      breakMinutes: breakMinutes ? Number(breakMinutes) : existing.breakMinutes,
    }).where(eq(workingHoursTable.id, existing.id)).returning();
    res.json(updated);
  } else {
    const [record] = await db.insert(workingHoursTable).values({
      employeeId, date, clockIn: clockInDate, clockOut: clockOutDate,
      totalMinutes, status: status ? String(status) : "present",
      notes: notes ? String(notes) : null, breakMinutes: breakMinutes ? Number(breakMinutes) : 0,
    }).returning();
    res.status(201).json(record);
  }
});

// Today's working summary for all employees
router.get("/admin/working-hours/today", async (_req, res): Promise<void> => {
  const today = todayIST();
  const rows = await db.select({
    id: workingHoursTable.id,
    employeeId: workingHoursTable.employeeId,
    date: workingHoursTable.date,
    clockIn: workingHoursTable.clockIn,
    clockOut: workingHoursTable.clockOut,
    totalMinutes: workingHoursTable.totalMinutes,
    status: workingHoursTable.status,
    name: teamMembersTable.name,
    department: teamMembersTable.department,
    designation: teamMembersTable.designation,
  }).from(workingHoursTable)
    .innerJoin(teamMembersTable, eq(workingHoursTable.employeeId, teamMembersTable.id))
    .where(eq(workingHoursTable.date, today));
  res.json(rows);
});

// Monthly summary per employee
router.get("/admin/team/:id/working-hours/summary", async (req, res): Promise<void> => {
  const employeeId = parseInt(req.params.id as string, 10);
  const month = (req.query as { month?: string }).month ?? currentMonthIST();
  const { ilike } = await import("drizzle-orm");
  const rows = await db.select({
    totalDays: sql<number>`count(*)`,
    totalMinutes: sql<number>`coalesce(sum(total_minutes), 0)`,
    presentDays: sql<number>`count(*) filter (where status = 'present')`,
    wfhDays: sql<number>`count(*) filter (where status = 'work_from_home')`,
    halfDays: sql<number>`count(*) filter (where status = 'half_day')`,
  }).from(workingHoursTable)
    .where(and(eq(workingHoursTable.employeeId, employeeId), ilike(workingHoursTable.date, `${month}%`)));
  res.json(rows[0] ?? { totalDays: 0, totalMinutes: 0, presentDays: 0, wfhDays: 0, halfDays: 0 });
});

// NOTE: Self-service /admin/attendance/me/* routes live in attendance-self-service.ts
// and are registered BEFORE makeModulePermissionMiddleware — accessible to all
// authenticated users without a "team" permission.

// ── Admin: correction management ─────────────────────────────────────────────

// GET all corrections — admin only
router.get("/admin/attendance-corrections", async (req, res): Promise<void> => {
  if ((req as AuthenticatedRequest).adminUser?.userType !== "admin") {
    res.status(403).json({ error: "Admin access required" }); return;
  }
  const { status } = req.query as { status?: string };
  const baseQuery = db.select({
    id: attendanceCorrectionsTable.id,
    employeeId: attendanceCorrectionsTable.employeeId,
    employeeName: teamMembersTable.name,
    date: attendanceCorrectionsTable.date,
    requestedClockIn: attendanceCorrectionsTable.requestedClockIn,
    requestedClockOut: attendanceCorrectionsTable.requestedClockOut,
    reason: attendanceCorrectionsTable.reason,
    status: attendanceCorrectionsTable.status,
    reviewedBy: attendanceCorrectionsTable.reviewedBy,
    createdAt: attendanceCorrectionsTable.createdAt,
  }).from(attendanceCorrectionsTable)
    .innerJoin(teamMembersTable, eq(attendanceCorrectionsTable.employeeId, teamMembersTable.id))
    .orderBy(desc(attendanceCorrectionsTable.createdAt));

  const rows = status && status !== "all"
    ? await baseQuery.where(eq(attendanceCorrectionsTable.status, status))
    : await baseQuery;
  res.json(rows);
});

// PATCH approve / reject a correction — admin only, pending-only, atomic transaction
router.patch("/admin/attendance-corrections/:id", async (req, res): Promise<void> => {
  if ((req as AuthenticatedRequest).adminUser?.userType !== "admin") {
    res.status(403).json({ error: "Admin access required" }); return;
  }

  const id = parseInt(req.params.id as string, 10);
  const { status } = req.body as { status: "approved" | "rejected" };
  if (!["approved", "rejected"].includes(status)) {
    res.status(400).json({ error: "status must be 'approved' or 'rejected'" }); return;
  }

  // Pre-flight: confirm the correction exists and is still pending
  const [correction] = await db.select().from(attendanceCorrectionsTable)
    .where(eq(attendanceCorrectionsTable.id, id));
  if (!correction) { res.status(404).json({ error: "Not found" }); return; }

  // Reviewer derived exclusively from the authenticated session
  const authUser = (req as AuthenticatedRequest).adminUser;
  const reviewer: string = typeof authUser?.username === "string" ? authUser.username : "admin";

  let updated: typeof correction;

  await db.transaction(async (tx) => {
    // Atomic conditional update: only succeeds if the record is still pending.
    // Two concurrent reviews will race here; the second will update 0 rows and
    // the transaction will resolve as a no-op (the pre-flight error above runs
    // outside the transaction so a concurrent approval could pass it, but only
    // one can actually commit the status change).
    const rows = await tx.update(attendanceCorrectionsTable)
      .set({ status, reviewedBy: reviewer })
      .where(and(eq(attendanceCorrectionsTable.id, id), eq(attendanceCorrectionsTable.status, "pending")))
      .returning();
    // If 0 rows updated, a concurrent review already claimed this correction
    if (!rows[0]) return; // transaction becomes a no-op; handled below
    updated = rows[0];

    if (status === "approved" && (correction.requestedClockIn || correction.requestedClockOut)) {
      // Fetch existing record first so we can merge timestamps and preserve break minutes
      const [existing] = await tx.select().from(workingHoursTable)
        .where(and(eq(workingHoursTable.employeeId, correction.employeeId), eq(workingHoursTable.date, correction.date)));

      // Merge: use corrected value where provided, fall back to existing stored value
      const mergedCi = correction.requestedClockIn ?? existing?.clockIn ?? null;
      const mergedCo = correction.requestedClockOut ?? existing?.clockOut ?? null;
      const breakMins = existing?.breakMinutes ?? 0;

      // Recompute net minutes from merged pair minus recorded breaks
      const totalMinutes = mergedCi && mergedCo
        ? Math.max(0, Math.round((mergedCo.getTime() - mergedCi.getTime()) / 60000) - breakMins)
        : existing?.totalMinutes ?? null;

      if (existing) {
        await tx.update(workingHoursTable).set({
          clockIn: mergedCi,
          clockOut: mergedCo,
          totalMinutes,
          status: "present",
        }).where(eq(workingHoursTable.id, existing.id));
      } else {
        await tx.insert(workingHoursTable).values({
          employeeId: correction.employeeId,
          date: correction.date,
          clockIn: mergedCi, clockOut: mergedCo, totalMinutes, status: "present",
        });
      }
    }
  });

  // @ts-expect-error updated is assigned inside the transaction callback
  if (!updated) { res.status(409).json({ error: "Correction already reviewed by another admin" }); return; }

  // Notify the employee — fire-and-forget so a failed insert never blocks the response
  db.insert(notificationsTable).values({
    recipientId:   correction.employeeId,
    recipientType: "employee",
    type:          "attendance_correction",
    title:         status === "approved"
      ? "Attendance Correction Approved ✓"
      : "Attendance Correction Rejected",
    body:  `Your correction request for ${correction.date} has been ${status} by ${reviewer}.`,
    entityType: "attendance_correction",
    entityId:   correction.id,
    link:       "/admin/attendance?tab=corrections",
  }).catch(() => { /* non-fatal */ });

  res.json(updated);
});

// ── Attendance report (admin) ─────────────────────────────────────────────────

// GET /admin/attendance/report?month=YYYY-MM
router.get("/admin/attendance/report", async (req, res): Promise<void> => {
  const m = (req.query as { month?: string }).month ?? currentMonthIST();

  const members = await db.select({
    id: teamMembersTable.id,
    name: teamMembersTable.name,
    designation: teamMembersTable.designation,
    department: teamMembersTable.department,
  }).from(teamMembersTable).where(eq(teamMembersTable.status, "active")).orderBy(teamMembersTable.name);

  const rows = await Promise.all(members.map(async (member) => {
    const [stats] = await db.select({
      presentDays:     sql<number>`count(*) filter (where status in ('present', 'work_from_home'))`,
      lateDays:        sql<number>`count(*) filter (where clock_in is not null and (clock_in at time zone 'Asia/Kolkata')::time > '09:30:00')`,
      totalMinutes:    sql<number>`coalesce(sum(total_minutes), 0)`,
      overtimeMinutes: sql<number>`coalesce(sum(greatest(0, total_minutes - 480)), 0)`,
    }).from(workingHoursTable)
      .where(and(eq(workingHoursTable.employeeId, member.id), ilike(workingHoursTable.date, `${m}%`)));

    const [{ correctionsPending }] = await db.select({
      correctionsPending: sql<number>`count(*)`,
    }).from(attendanceCorrectionsTable)
      .where(and(eq(attendanceCorrectionsTable.employeeId, member.id), eq(attendanceCorrectionsTable.status, "pending")));

    return {
      ...member,
      presentDays:        Number(stats?.presentDays ?? 0),
      lateDays:           Number(stats?.lateDays ?? 0),
      totalMinutes:       Number(stats?.totalMinutes ?? 0),
      overtimeMinutes:    Number(stats?.overtimeMinutes ?? 0),
      correctionsPending: Number(correctionsPending ?? 0),
    };
  }));

  res.json(rows);
});

export default router;

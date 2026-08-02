/**
 * Attendance self-service routes — accessible to any authenticated admin/employee.
 * This router is registered BEFORE makeModulePermissionMiddleware so no "team"
 * permission is required. Every handler derives the employee ID from the JWT session
 * and can only access the logged-in user's own data.
 */
import { Router, type IRouter } from "express";
import { eq, desc, and, ilike, isNull, isNotNull } from "drizzle-orm";
import { db, workingHoursTable, attendanceCorrectionsTable } from "@workspace/db";
import type { AuthenticatedRequest } from "./auth";

const attendanceMeRouter: IRouter = Router();

// IST date helpers — fixed UTC+5:30 offset, deterministic YYYY-MM-DD regardless of locale/ICU.
// IST = UTC + 5h30m: add 330 min to epoch then read the UTC date string.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function todayIST(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}
function currentMonthIST(): string {
  return todayIST().slice(0, 7);
}
function getAuthId(req: AuthenticatedRequest): number | null {
  const uid = req.adminUser?.userId;
  return typeof uid === "number" ? uid : null;
}

// ── GET today's working-hours record ─────────────────────────────────────────
attendanceMeRouter.get("/admin/attendance/me/today", async (req, res): Promise<void> => {
  const employeeId = getAuthId(req as AuthenticatedRequest);
  if (!employeeId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const today = todayIST();
  const [record] = await db.select().from(workingHoursTable)
    .where(and(eq(workingHoursTable.employeeId, employeeId), eq(workingHoursTable.date, today)));
  res.json(record ?? null);
});

// ── GET monthly working hours ─────────────────────────────────────────────────
attendanceMeRouter.get("/admin/attendance/me/hours", async (req, res): Promise<void> => {
  const employeeId = getAuthId(req as AuthenticatedRequest);
  if (!employeeId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const m = (req.query as { month?: string }).month ?? currentMonthIST();
  const records = await db.select().from(workingHoursTable)
    .where(and(eq(workingHoursTable.employeeId, employeeId), ilike(workingHoursTable.date, `${m}%`)))
    .orderBy(workingHoursTable.date);
  res.json(records);
});

// ── GET my correction requests ────────────────────────────────────────────────
attendanceMeRouter.get("/admin/attendance/me/corrections", async (req, res): Promise<void> => {
  const employeeId = getAuthId(req as AuthenticatedRequest);
  if (!employeeId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const records = await db.select().from(attendanceCorrectionsTable)
    .where(eq(attendanceCorrectionsTable.employeeId, employeeId))
    .orderBy(desc(attendanceCorrectionsTable.createdAt)).limit(50);
  res.json(records);
});

// ── POST clock-in ─────────────────────────────────────────────────────────────
// Atomic: INSERT ON CONFLICT DO NOTHING handles duplicate-row race; then
// conditional UPDATE WHERE clockIn IS NULL handles the existing-row race.
// Two concurrent requests both receive a valid response — no 500 on unique violation.
attendanceMeRouter.post("/admin/attendance/me/clock-in", async (req, res): Promise<void> => {
  const employeeId = getAuthId(req as AuthenticatedRequest);
  if (!employeeId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const today = todayIST();
  const now = new Date();
  const status = (req.body as { status?: string }).status ?? "present";

  // Step 1: try to insert a fresh row; if row already exists DO NOTHING
  const inserted = await db.insert(workingHoursTable)
    .values({ employeeId, date: today, clockIn: now, status })
    .onConflictDoNothing()
    .returning();

  if (inserted[0]) { res.status(201).json(inserted[0]); return; }

  // Step 2: row already exists — atomically set clockIn only if it is still null
  const clocked = await db.update(workingHoursTable)
    .set({ clockIn: now, status })
    .where(and(
      eq(workingHoursTable.employeeId, employeeId),
      eq(workingHoursTable.date, today),
      isNull(workingHoursTable.clockIn),
    ))
    .returning();

  if (clocked[0]) { res.json(clocked[0]); return; }

  // clockIn was already set before this request arrived
  res.status(409).json({ error: "Already clocked in today" });
});

// ── POST clock-out ────────────────────────────────────────────────────────────
// Atomic: UPDATE WHERE clockOut IS NULL AND breakStartAt IS NULL.
// Concurrent duplicate clock-outs: the second returns 0 rows → 409.
attendanceMeRouter.post("/admin/attendance/me/clock-out", async (req, res): Promise<void> => {
  const employeeId = getAuthId(req as AuthenticatedRequest);
  if (!employeeId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const today = todayIST();
  const now = new Date();

  // Read current state to validate preconditions and compute totalMinutes
  const [existing] = await db.select().from(workingHoursTable)
    .where(and(eq(workingHoursTable.employeeId, employeeId), eq(workingHoursTable.date, today)));

  if (!existing?.clockIn)    { res.status(400).json({ error: "Not clocked in yet today" }); return; }
  if (existing.clockOut)     { res.status(409).json({ error: "Already clocked out today" }); return; }
  if (existing.breakStartAt) { res.status(400).json({ error: "Please end your break before clocking out" }); return; }

  const workedMs = now.getTime() - existing.clockIn.getTime();
  const totalMinutes = Math.max(0, Math.round(workedMs / 60000) - (existing.breakMinutes ?? 0));

  // Atomic update: only applies if clockOut is still null (concurrent race safety)
  const updated = await db.update(workingHoursTable)
    .set({ clockOut: now, totalMinutes })
    .where(and(
      eq(workingHoursTable.id, existing.id),
      isNull(workingHoursTable.clockOut),
    ))
    .returning();

  if (!updated[0]) { res.status(409).json({ error: "Already clocked out today" }); return; }
  res.json(updated[0]);
});

// ── POST break-start ──────────────────────────────────────────────────────────
// Atomic: UPDATE WHERE breakStartAt IS NULL.
// Concurrent duplicate break-starts: the second returns 0 rows → 409.
attendanceMeRouter.post("/admin/attendance/me/break-start", async (req, res): Promise<void> => {
  const employeeId = getAuthId(req as AuthenticatedRequest);
  if (!employeeId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const today = todayIST();
  const now = new Date();

  // Read current state to validate preconditions
  const [existing] = await db.select().from(workingHoursTable)
    .where(and(eq(workingHoursTable.employeeId, employeeId), eq(workingHoursTable.date, today)));

  if (!existing?.clockIn) { res.status(400).json({ error: "Not clocked in yet today" }); return; }
  if (existing.clockOut)  { res.status(400).json({ error: "Already clocked out" }); return; }
  if (existing.breakStartAt) { res.status(409).json({ error: "Already on break" }); return; }

  // Atomic update: only applies if breakStartAt is still null
  const updated = await db.update(workingHoursTable)
    .set({ breakStartAt: now })
    .where(and(
      eq(workingHoursTable.id, existing.id),
      isNull(workingHoursTable.breakStartAt),
    ))
    .returning();

  if (!updated[0]) { res.status(409).json({ error: "Already on break" }); return; }
  res.json(updated[0]);
});

// ── POST break-end ────────────────────────────────────────────────────────────
attendanceMeRouter.post("/admin/attendance/me/break-end", async (req, res): Promise<void> => {
  const employeeId = getAuthId(req as AuthenticatedRequest);
  if (!employeeId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const today = todayIST();
  const now = new Date();

  const [existing] = await db.select().from(workingHoursTable)
    .where(and(eq(workingHoursTable.employeeId, employeeId), eq(workingHoursTable.date, today)));

  if (!existing?.breakStartAt) { res.status(400).json({ error: "Not currently on break" }); return; }

  const breakMins = Math.max(1, Math.round((now.getTime() - existing.breakStartAt.getTime()) / 60000));
  const totalBreak = (existing.breakMinutes ?? 0) + breakMins;

  const [updated] = await db.update(workingHoursTable)
    .set({ breakStartAt: null, breakEndAt: now, breakMinutes: totalBreak })
    .where(eq(workingHoursTable.id, existing.id)).returning();
  res.json(updated);
});

// ── POST submit a correction request ─────────────────────────────────────────
attendanceMeRouter.post("/admin/attendance/me/corrections", async (req, res): Promise<void> => {
  const employeeId = getAuthId(req as AuthenticatedRequest);
  if (!employeeId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { date, clockIn: ciStr, clockOut: coStr, reason } = req.body as {
    date: string; clockIn?: string; clockOut?: string; reason: string;
  };
  if (!date || !reason?.trim()) { res.status(400).json({ error: "date and reason are required" }); return; }

  // Parse times as IST (UTC+05:30)
  const mkTs = (t?: string) => t ? new Date(`${date}T${t}+05:30`) : null;

  const [record] = await db.insert(attendanceCorrectionsTable).values({
    employeeId, date,
    requestedClockIn:  mkTs(ciStr),
    requestedClockOut: mkTs(coStr),
    reason: reason.trim(),
    status: "pending",
  }).returning();
  res.status(201).json(record);
});

export default attendanceMeRouter;

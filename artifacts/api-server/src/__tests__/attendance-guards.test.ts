/**
 * End-to-end guard tests for attendance clock-in/out and correction-approval endpoints.
 *
 * Strategy: mount only the relevant routers on a minimal Express app, inject a fake
 * `adminUser` via middleware so auth passes without a real DB session, and mock
 * `@workspace/db` so no live database is needed.
 *
 * Scenarios covered:
 *  - Double clock-in                 → 409
 *  - Clock-out without clock-in      → 400
 *  - Clock-out while on break        → 400
 *  - Break-end without break-start   → 400
 *  - Approved correction upserts the correct working_hours row (existing & new)
 *  - Correction already reviewed     → 409
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express, { type Request, type Response, type NextFunction } from "express";
import type { AuthenticatedRequest } from "../routes/admin/auth.js";

// ── Shared mock state (hoisted so vi.mock factory can reference them) ──────────

const { mockDb, mockTx } = vi.hoisted(() => {
  /** Returns a thenable chain — every builder method returns `this`. */
  function makeChain(result: unknown) {
    const chain: Record<string, unknown> = {};
    for (const m of [
      "from", "where", "orderBy", "limit", "innerJoin",
      "set", "values", "returning", "onConflictDoNothing",
    ]) {
      chain[m] = () => chain;
    }
    chain.then = (
      resolve: (v: unknown) => unknown,
      reject?: (e: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject);
    chain.catch = (reject: (e: unknown) => unknown) =>
      Promise.resolve(result).catch(reject);
    return chain;
  }

  const mockTx = {
    select:      vi.fn(() => makeChain([])),
    insert:      vi.fn(() => makeChain([])),
    update:      vi.fn(() => makeChain([])),
    delete:      vi.fn(() => makeChain([])),
  };

  const mockDb = {
    select:      vi.fn(() => makeChain([])),
    insert:      vi.fn(() => makeChain([])),
    update:      vi.fn(() => makeChain([])),
    delete:      vi.fn(() => makeChain([])),
    transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx)),
    _makeChain:  makeChain,
  };

  return { mockDb, mockTx };
});

vi.mock("@workspace/db", () => ({
  db:                         mockDb,
  workingHoursTable:          {},
  attendanceCorrectionsTable: {},
  teamMembersTable:           {},
  attendanceTable:            {},
  leaveRequestsTable:         {},
  notificationsTable:         {},
}));

// ── Import routers AFTER vi.mock is set up ─────────────────────────────────────

import attendanceMeRouter from "../routes/admin/attendance-self-service.js";
import teamRouter         from "../routes/admin/team.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convenience alias — re-creates a chain with a given result. */
const chain = (result: unknown) => mockDb._makeChain(result);

type FakeUser = { userId: number; userType: string; username?: string };

/** Build a minimal Express app that injects a fake adminUser. */
function buildApp(user: FakeUser, ...routers: express.IRouter[]) {
  const app = express();
  app.use(express.json());
  // Inject fake session
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as AuthenticatedRequest).adminUser = user as never;
    next();
  });
  for (const r of routers) app.use(r);
  // Catch unhandled errors and surface them as JSON 500 with the message
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ _testError: msg });
  });
  return app;
}

// Two test apps — one for self-service (employee), one for admin corrections
const selfServiceApp = buildApp({ userId: 42, userType: "employee" }, attendanceMeRouter);
const adminApp       = buildApp({ userId: 1,  userType: "admin", username: "testadmin" }, teamRouter);

// ── Reset mocks between tests ─────────────────────────────────────────────────

beforeEach(() => {
  mockDb.select.mockReset();
  mockDb.insert.mockReset();
  mockDb.update.mockReset();
  mockDb.delete.mockReset();
  mockDb.transaction.mockReset();
  mockTx.select.mockReset();
  mockTx.insert.mockReset();
  mockTx.update.mockReset();
  mockTx.delete.mockReset();

  // Default: return empty arrays (no existing records)
  mockDb.select.mockReturnValue(chain([]));
  mockDb.insert.mockReturnValue(chain([]));
  mockDb.update.mockReturnValue(chain([]));
  mockTx.select.mockReturnValue(chain([]));
  mockTx.insert.mockReturnValue(chain([]));
  mockTx.update.mockReturnValue(chain([]));
  mockDb.transaction.mockImplementation(
    async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Self-service: clock-in
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/admin/attendance/me/clock-in", () => {
  const newRow = { id: 1, employeeId: 42, date: "2026-08-02", clockIn: new Date(), status: "present" };

  it("returns 201 when this is the first clock-in of the day (INSERT path)", async () => {
    // INSERT succeeds → returning() gives [newRow]
    mockDb.insert.mockReturnValue(chain([newRow]));

    const res = await request(selfServiceApp)
      .post("/admin/attendance/me/clock-in")
      .send({});

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ employeeId: 42 });
  });

  it("returns 200 when a row exists but clockIn is null (UPDATE path)", async () => {
    const rowNoCi = { ...newRow, clockIn: null };
    // INSERT hits conflict → returns []
    mockDb.insert.mockReturnValue(chain([]));
    // UPDATE WHERE clockIn IS NULL succeeds → returns [row]
    mockDb.update.mockReturnValue(chain([rowNoCi]));

    const res = await request(selfServiceApp)
      .post("/admin/attendance/me/clock-in")
      .send({});

    expect(res.status).toBe(200);
  });

  it("returns 409 when already clocked in (INSERT conflict + UPDATE finds clockIn already set)", async () => {
    // INSERT hits conflict → returns []
    mockDb.insert.mockReturnValue(chain([]));
    // UPDATE WHERE clockIn IS NULL also finds nothing (clockIn was already set)
    mockDb.update.mockReturnValue(chain([]));

    const res = await request(selfServiceApp)
      .post("/admin/attendance/me/clock-in")
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already clocked in/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Self-service: clock-out
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/admin/attendance/me/clock-out", () => {
  const base = {
    id: 1, employeeId: 42, date: "2026-08-02",
    clockIn: new Date(Date.now() - 8 * 3600_000),
    clockOut: null, breakStartAt: null, breakMinutes: 0,
  };

  it("returns 400 when no working-hours row exists today (not clocked in)", async () => {
    mockDb.select.mockReturnValue(chain([])); // no row

    const res = await request(selfServiceApp)
      .post("/admin/attendance/me/clock-out")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not clocked in/i);
  });

  it("returns 400 when row exists but clockIn is null (not clocked in)", async () => {
    mockDb.select.mockReturnValue(chain([{ ...base, clockIn: null }]));

    const res = await request(selfServiceApp)
      .post("/admin/attendance/me/clock-out")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not clocked in/i);
  });

  it("returns 409 when already clocked out", async () => {
    mockDb.select.mockReturnValue(chain([{ ...base, clockOut: new Date() }]));

    const res = await request(selfServiceApp)
      .post("/admin/attendance/me/clock-out")
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already clocked out/i);
  });

  it("returns 400 when still on break", async () => {
    mockDb.select.mockReturnValue(
      chain([{ ...base, breakStartAt: new Date(Date.now() - 600_000) }]),
    );

    const res = await request(selfServiceApp)
      .post("/admin/attendance/me/clock-out")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/break/i);
  });

  it("returns 200 and clocks out successfully", async () => {
    const updated = { ...base, clockOut: new Date(), totalMinutes: 480 };
    mockDb.select.mockReturnValue(chain([base]));
    mockDb.update.mockReturnValue(chain([updated]));

    const res = await request(selfServiceApp)
      .post("/admin/attendance/me/clock-out")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ totalMinutes: 480 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Self-service: break-start
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/admin/attendance/me/break-start", () => {
  const base = {
    id: 1, employeeId: 42, date: "2026-08-02",
    clockIn: new Date(Date.now() - 3600_000),
    clockOut: null, breakStartAt: null, breakMinutes: 0,
  };

  it("returns 400 when not clocked in", async () => {
    mockDb.select.mockReturnValue(chain([]));

    const res = await request(selfServiceApp)
      .post("/admin/attendance/me/break-start")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not clocked in/i);
  });

  it("returns 400 when already clocked out", async () => {
    mockDb.select.mockReturnValue(chain([{ ...base, clockOut: new Date() }]));

    const res = await request(selfServiceApp)
      .post("/admin/attendance/me/break-start")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already clocked out/i);
  });

  it("returns 409 when already on break", async () => {
    mockDb.select.mockReturnValue(
      chain([{ ...base, breakStartAt: new Date(Date.now() - 300_000) }]),
    );

    const res = await request(selfServiceApp)
      .post("/admin/attendance/me/break-start")
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already on break/i);
  });

  it("returns 200 when break starts successfully", async () => {
    const updated = { ...base, breakStartAt: new Date() };
    mockDb.select.mockReturnValue(chain([base]));
    mockDb.update.mockReturnValue(chain([updated]));

    const res = await request(selfServiceApp)
      .post("/admin/attendance/me/break-start")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("breakStartAt");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Self-service: break-end
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/admin/attendance/me/break-end", () => {
  it("returns 400 when not currently on break (no row)", async () => {
    mockDb.select.mockReturnValue(chain([]));

    const res = await request(selfServiceApp)
      .post("/admin/attendance/me/break-end")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not currently on break/i);
  });

  it("returns 400 when row exists but breakStartAt is null", async () => {
    mockDb.select.mockReturnValue(chain([{
      id: 1, employeeId: 42, date: "2026-08-02",
      clockIn: new Date(), clockOut: null, breakStartAt: null, breakMinutes: 0,
    }]));

    const res = await request(selfServiceApp)
      .post("/admin/attendance/me/break-end")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not currently on break/i);
  });

  it("returns 200 and ends break successfully, accumulating breakMinutes", async () => {
    const breakStartAt = new Date(Date.now() - 15 * 60_000); // 15 min ago
    const existing = {
      id: 1, employeeId: 42, date: "2026-08-02",
      clockIn: new Date(Date.now() - 3600_000),
      clockOut: null, breakStartAt, breakMinutes: 5, // previously had 5 min
    };
    const updated = { ...existing, breakStartAt: null, breakMinutes: 20, breakEndAt: new Date() };
    mockDb.select.mockReturnValue(chain([existing]));
    mockDb.update.mockReturnValue(chain([updated]));

    const res = await request(selfServiceApp)
      .post("/admin/attendance/me/break-end")
      .send({});

    expect(res.status).toBe(200);
    // accumulated = prior 5 + ~15 new = ~20 minutes
    expect(res.body.breakMinutes).toBeGreaterThanOrEqual(15);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin: correction approval (PATCH /api/admin/attendance-corrections/:id)
// ─────────────────────────────────────────────────────────────────────────────

describe("PATCH /api/admin/attendance-corrections/:id", () => {
  const ci = new Date("2026-08-02T09:00:00+05:30");
  const co = new Date("2026-08-02T18:00:00+05:30");
  const pendingCorrection = {
    id: 7, employeeId: 42, date: "2026-08-02",
    requestedClockIn: ci, requestedClockOut: co,
    reason: "Forgot to clock in", status: "pending", reviewedBy: null,
  };

  it("returns 403 when caller is not admin", async () => {
    const employeeApp = buildApp({ userId: 42, userType: "employee" }, teamRouter);

    const res = await request(employeeApp)
      .patch("/admin/attendance-corrections/7")
      .send({ status: "approved" });

    expect(res.status).toBe(403);
  });

  it("returns 400 when status is not approved or rejected", async () => {
    const res = await request(adminApp)
      .patch("/admin/attendance-corrections/7")
      .send({ status: "maybe" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/approved.*rejected/i);
  });

  it("returns 404 when the correction does not exist", async () => {
    mockDb.select.mockReturnValue(chain([])); // no correction found

    const res = await request(adminApp)
      .patch("/admin/attendance-corrections/999")
      .send({ status: "approved" });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it("returns 409 when a concurrent review already claimed the correction", async () => {
    mockDb.select.mockReturnValue(chain([pendingCorrection]));
    mockDb.transaction.mockImplementation(
      async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx),
    );
    // Conditional UPDATE WHERE status='pending' returns 0 rows (already claimed)
    mockTx.update.mockReturnValue(chain([]));

    const res = await request(adminApp)
      .patch("/admin/attendance-corrections/7")
      .send({ status: "approved" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already reviewed/i);
  });

  it("approves and upserts working_hours when an existing row is present", async () => {
    const approved = { ...pendingCorrection, status: "approved", reviewedBy: "testadmin" };
    const existingWh = {
      id: 5, employeeId: 42, date: "2026-08-02",
      clockIn: null, clockOut: null, totalMinutes: null, breakMinutes: 10,
    };

    mockDb.select.mockReturnValue(chain([pendingCorrection]));
    mockDb.transaction.mockImplementation(
      async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx),
    );
    // tx: conditional status update succeeds
    mockTx.update.mockReturnValueOnce(chain([approved]));
    // tx: fetch existing working_hours row
    mockTx.select.mockReturnValueOnce(chain([existingWh]));
    // tx: update working_hours row
    mockTx.update.mockReturnValueOnce(chain([{ ...existingWh, clockIn: ci, clockOut: co }]));

    const res = await request(adminApp)
      .patch("/admin/attendance-corrections/7")
      .send({ status: "approved" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "approved", reviewedBy: "testadmin" });

    // Confirm tx.update was called twice: once for correction, once for working_hours
    expect(mockTx.update).toHaveBeenCalledTimes(2);
    // Confirm tx.insert was NOT called (we updated an existing row, not inserted)
    expect(mockTx.insert).not.toHaveBeenCalled();
  });

  it("approves and inserts a new working_hours row when none exists yet", async () => {
    const approved = { ...pendingCorrection, status: "approved", reviewedBy: "testadmin" };

    mockDb.select.mockReturnValue(chain([pendingCorrection]));
    mockDb.transaction.mockImplementation(
      async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx),
    );
    // tx: conditional status update succeeds
    mockTx.update.mockReturnValueOnce(chain([approved]));
    // tx: no existing working_hours row
    mockTx.select.mockReturnValueOnce(chain([]));
    // tx: insert new working_hours row
    mockTx.insert.mockReturnValueOnce(chain([]));

    const res = await request(adminApp)
      .patch("/admin/attendance-corrections/7")
      .send({ status: "approved" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "approved" });

    // tx.update called once (correction only), tx.insert called once (new wh row)
    expect(mockTx.update).toHaveBeenCalledTimes(1);
    expect(mockTx.insert).toHaveBeenCalledTimes(1);
  });

  it("rejects a correction without touching working_hours", async () => {
    const rejected = { ...pendingCorrection, status: "rejected", reviewedBy: "testadmin" };

    mockDb.select.mockReturnValue(chain([pendingCorrection]));
    mockDb.transaction.mockImplementation(
      async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx),
    );
    // tx: conditional status update to rejected
    mockTx.update.mockReturnValueOnce(chain([rejected]));

    const res = await request(adminApp)
      .patch("/admin/attendance-corrections/7")
      .send({ status: "rejected" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "rejected" });

    // No working_hours operations should occur on rejection
    expect(mockTx.select).not.toHaveBeenCalled();
    expect(mockTx.insert).not.toHaveBeenCalled();
    // Only the correction status update
    expect(mockTx.update).toHaveBeenCalledTimes(1);
  });
});

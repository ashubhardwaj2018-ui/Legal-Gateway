import { Router, type IRouter } from "express";
import { eq, ilike, or, desc, sql } from "drizzle-orm";
import { db, teamMembersTable } from "@workspace/db";
import { hashPassword } from "./auth";

const router: IRouter = Router();

// Generate next employee ID
async function nextEmployeeId(): Promise<string> {
  const [row] = await db.select({ cnt: sql<number>`count(*)` }).from(teamMembersTable);
  const n = (Number(row?.cnt ?? 0) + 1).toString().padStart(4, "0");
  return `EMP-${n}`;
}

// ── List employees ─────────────────────────────────────────────────────────────
router.get("/admin/employees", async (req, res): Promise<void> => {
  const { search, status, department, role } = req.query as Record<string, string>;
  let q = db.select({
    id: teamMembersTable.id, employeeId: teamMembersTable.employeeId,
    name: teamMembersTable.name, email: teamMembersTable.email,
    phone: teamMembersTable.phone, department: teamMembersTable.department,
    designation: teamMembersTable.designation, role: teamMembersTable.role,
    roleId: teamMembersTable.roleId, username: teamMembersTable.username,
    status: teamMembersTable.status, avatar: teamMembersTable.avatar,
    joiningDate: teamMembersTable.joiningDate, lastLoginAt: teamMembersTable.lastLoginAt,
    forcePasswordChange: teamMembersTable.forcePasswordChange,
    twoFactorEnabled: teamMembersTable.twoFactorEnabled, createdAt: teamMembersTable.createdAt,
  }).from(teamMembersTable).$dynamic();

  const conditions = [];
  if (search) conditions.push(or(ilike(teamMembersTable.name, `%${search}%`), ilike(teamMembersTable.email, `%${search}%`), ilike(teamMembersTable.employeeId, `%${search}%`)));
  if (status && status !== "all") conditions.push(eq(teamMembersTable.status, status));
  if (department && department !== "all") conditions.push(eq(teamMembersTable.department, department));
  if (role && role !== "all") conditions.push(eq(teamMembersTable.role, role));
  if (conditions.length) q = q.where(conditions.length === 1 ? conditions[0] : conditions.reduce((a, b) => sql`${a} AND ${b}`)) as typeof q;

  const employees = await q.orderBy(teamMembersTable.name);
  res.json(employees);
});

// ── Get single employee ────────────────────────────────────────────────────────
router.get("/admin/employees/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [emp] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.id, id));
  if (!emp) { res.status(404).json({ error: "Not found" }); return; }
  const { passwordHash: _ph, ...safe } = emp;
  res.json(safe);
});

// ── Create employee ────────────────────────────────────────────────────────────
router.post("/admin/employees", async (req, res): Promise<void> => {
  const body = req.body as {
    name: string; email: string; phone?: string; department: string;
    designation: string; role?: string; roleId?: number; reportingManagerId?: number;
    username?: string; password?: string; salary?: string; joiningDate?: string;
    address?: string; emergencyContact?: string; notes?: string; avatar?: string;
  };
  if (!body.name || !body.email || !body.department || !body.designation) {
    res.status(400).json({ error: "name, email, department, designation required" }); return;
  }
  const employeeId = await nextEmployeeId();
  const [emp] = await db.insert(teamMembersTable).values({
    employeeId,
    name: body.name, email: body.email, phone: body.phone ?? null,
    department: body.department, designation: body.designation,
    role: body.role ?? "staff", roleId: body.roleId ?? null,
    reportingManagerId: body.reportingManagerId ?? null,
    username: body.username ?? null,
    passwordHash: body.password ? hashPassword(body.password) : null,
    forcePasswordChange: !!body.password,
    salary: body.salary ?? null, joiningDate: body.joiningDate ?? null,
    address: body.address ?? null, emergencyContact: body.emergencyContact ?? null,
    notes: body.notes ?? null, avatar: body.avatar ?? null, status: "active",
  }).returning();
  const { passwordHash: _ph, ...safe } = emp;
  res.status(201).json(safe);
});

// ── Update employee ────────────────────────────────────────────────────────────
router.patch("/admin/employees/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const body = req.body as Record<string, unknown>;
  const allowed = ["name","email","phone","department","designation","role","roleId",
    "reportingManagerId","username","salary","joiningDate","address",
    "emergencyContact","notes","avatar","status"] as const;
  const update: Partial<typeof teamMembersTable.$inferInsert> = {};
  for (const k of allowed) {
    if (k in body) (update as Record<string, unknown>)[k] = body[k];
  }
  const [emp] = await db.update(teamMembersTable).set(update).where(eq(teamMembersTable.id, id)).returning();
  if (!emp) { res.status(404).json({ error: "Not found" }); return; }
  const { passwordHash: _ph, ...safe } = emp;
  res.json(safe);
});

// ── Reset password ─────────────────────────────────────────────────────────────
router.patch("/admin/employees/:id/password", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { password, forceChange } = req.body as { password: string; forceChange?: boolean };
  if (!password || password.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }
  await db.update(teamMembersTable).set({
    passwordHash: hashPassword(password),
    forcePasswordChange: forceChange !== false,
  }).where(eq(teamMembersTable.id, id));
  res.json({ ok: true });
});

// ── Toggle status ──────────────────────────────────────────────────────────────
router.patch("/admin/employees/:id/status", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { status } = req.body as { status: string };
  if (!["active","inactive","on_leave"].includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
  await db.update(teamMembersTable).set({ status }).where(eq(teamMembersTable.id, id));
  res.json({ ok: true });
});

// ── Delete employee ────────────────────────────────────────────────────────────
router.delete("/admin/employees/:id", async (req, res): Promise<void> => {
  await db.delete(teamMembersTable).where(eq(teamMembersTable.id, parseInt(req.params.id, 10)));
  res.sendStatus(204);
});

export default router;

import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import { eq, or, and, isNull } from "drizzle-orm";
import { db, adminUsersTable, teamMembersTable, rolesTable, rolePermissionsTable, loginHistoryTable, activityLogsTable } from "@workspace/db";

export const authRouter: IRouter = Router();

const SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-in-prod";
const TOKEN_COOKIE = "admin_token";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Password helpers ──────────────────────────────────────────────────────────
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${key}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(derived), Buffer.from(key));
  } catch {
    return false;
  }
}

// ── Token helpers ─────────────────────────────────────────────────────────────
function signToken(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyToken(token: string): Record<string, unknown> | null {
  try {
    const [data, sig] = token.split(".");
    const expected = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as Record<string, unknown>;
    if (typeof payload.exp === "number" && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Seed default admin ────────────────────────────────────────────────────────
export async function seedDefaultAdmin() {
  const existing = await db.select().from(adminUsersTable).limit(1);
  if (existing.length > 0) return;
  await db.insert(adminUsersTable).values({
    username: "admin",
    email: "admin@vakilco.in",
    passwordHash: hashPassword("Admin@2026"),
    role: "admin",
  });
}

// ── Seed default roles ────────────────────────────────────────────────────────
const DEFAULT_ROLES = [
  "Super Admin", "Admin", "Sales Manager", "Sales Executive",
  "Accounts", "HR", "SEO Executive", "Digital Marketing Executive",
  "Content Writer", "Customer Support", "Legal Team",
  "Finance Manager", "Developer", "Customer",
];

export async function seedDefaultRoles() {
  const existing = await db.select().from(rolesTable).limit(1);
  if (existing.length > 0) return;
  await db.insert(rolesTable).values(
    DEFAULT_ROLES.map(name => ({ name, isSystem: true }))
  );
}

// ── Activity logger ───────────────────────────────────────────────────────────
export async function logActivity(
  userId: number | null,
  username: string,
  userType: "admin" | "employee",
  module: string,
  action: string,
  entityId?: number,
  details?: object,
) {
  try {
    await db.insert(activityLogsTable).values({
      userId,
      username,
      userType,
      module,
      action,
      entityId: entityId ?? null,
      details: details ? JSON.stringify(details) : null,
    });
  } catch {
    // non-fatal
  }
}

// ── Permission cache (in-memory, 5-minute TTL) ────────────────────────────────
type PermissionSet = { all: boolean; map: Record<string, Record<string, boolean>> };
const permCache = new Map<string, PermissionSet & { ts: number }>();
const PERM_TTL = 5 * 60 * 1000;
const ADMIN_ROLES = new Set(["admin", "super_admin", "Super Admin", "Admin"]);

async function loadPermissions(role: string, userType: string): Promise<PermissionSet> {
  if (userType === "admin" || ADMIN_ROLES.has(role)) {
    return { all: true, map: {} };
  }
  const cached = permCache.get(role);
  if (cached && Date.now() - cached.ts < PERM_TTL) {
    return { all: cached.all, map: cached.map };
  }
  const [roleRow] = await db.select().from(rolesTable).where(eq(rolesTable.name, role));
  if (!roleRow) {
    const result: PermissionSet = { all: false, map: {} };
    permCache.set(role, { ...result, ts: Date.now() });
    return result;
  }
  const perms = await db.select().from(rolePermissionsTable)
    .where(eq(rolePermissionsTable.roleId, roleRow.id));
  const map: Record<string, Record<string, boolean>> = {};
  for (const p of perms) {
    if (!map[p.module]) map[p.module] = {};
    map[p.module][p.action] = p.allowed;
  }
  const result: PermissionSet = { all: false, map };
  permCache.set(role, { ...result, ts: Date.now() });
  return result;
}

// Invalidate cache entry when permissions are updated
export function invalidatePermissionCache(role: string) {
  permCache.delete(role);
}

// ── Auth Middleware ───────────────────────────────────────────────────────────
export interface AuthenticatedRequest extends Request {
  adminUser?: Record<string, unknown>;
  permissions?: PermissionSet;
}

export async function adminAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[TOKEN_COOKIE] as string | undefined;
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }
  const payload = verifyToken(token);
  if (!payload) { res.status(401).json({ error: "Session expired" }); return; }

  // Block all protected routes when password change is required
  if (payload.forcePasswordChange === true) {
    res.status(403).json({ error: "password_change_required" }); return;
  }

  req.adminUser = payload;

  const role = typeof payload.role === "string" ? payload.role : "";
  const userType = typeof payload.userType === "string" ? payload.userType : "admin";
  try {
    req.permissions = await loadPermissions(role, userType);
  } catch {
    req.permissions = { all: false, map: {} };
  }
  next();
}

// ── Permission Guard Factory ──────────────────────────────────────────────────
export function requirePermission(module: string, action: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.adminUser) { res.status(401).json({ error: "Not authenticated" }); return; }
    if (req.permissions?.all) { next(); return; }
    if (req.permissions?.map[module]?.[action]) { next(); return; }
    res.status(403).json({ error: `Insufficient permissions: ${module}/${action}` });
  };
}

// ── CRUD activity logging middleware ──────────────────────────────────────────
export function crudActivityMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method) || req.path.includes("/admin/auth/")) {
    next(); return;
  }
  const onFinish = () => {
    res.removeListener("finish", onFinish);
    if (res.statusCode >= 400 || !req.adminUser) return;
    const userId = typeof req.adminUser.userId === "number" ? req.adminUser.userId : null;
    const username = typeof req.adminUser.username === "string" ? req.adminUser.username : "unknown";
    const userType: "admin" | "employee" = req.adminUser.userType === "employee" ? "employee" : "admin";
    const parts = req.path.split("/").filter(Boolean);
    const module = parts[1] ?? "unknown"; // /admin/leads/123 → "leads"
    const action = req.method === "POST" ? "create" : req.method === "DELETE" ? "delete" : "update";
    logActivity(userId, username, userType, module, action).catch(() => {});
  };
  res.on("finish", onFinish);
  next();
}

// ── URL-pattern based module permission middleware ────────────────────────────
// Each map entry: [urlPrefix, moduleName, extraAllowedActions?]
// extraAllowedActions lets specific sub-routes (e.g. assign) pass the coarse
// module gate without requiring the standard verb-mapped action. Fine-grained
// checks are still enforced inside each route handler.
export function makeModulePermissionMiddleware(
  map: Array<[string, string] | [string, string, string[]]>
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.adminUser || req.permissions?.all) { next(); return; }
    const entry = map.find(([prefix]) => req.path.startsWith(prefix));
    if (!entry) { next(); return; }
    const [, module, extraActions] = entry as [string, string, string[] | undefined];
    const action = (req.method === "GET" || req.method === "HEAD") ? "view"
      : req.method === "POST" ? "create"
      : req.method === "DELETE" ? "delete"
      : "edit";
    const perms = req.permissions?.map[module];
    if (perms?.[action] || perms?.["manage"]) { next(); return; }
    if (extraActions?.some(a => perms?.[a])) { next(); return; }
    res.status(403).json({ error: `Insufficient permissions: ${module}/${action}` });
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

authRouter.post("/admin/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) { res.status(400).json({ error: "Username and password required" }); return; }

  const ip = (req.ip ?? req.socket.remoteAddress ?? "unknown") as string;
  const uaRaw = req.headers["user-agent"];
  const ua = Array.isArray(uaRaw) ? (uaRaw[0] ?? "") : (uaRaw ?? "");

  // Check admin users first
  const [adminUser] = await db.select().from(adminUsersTable)
    .where(or(eq(adminUsersTable.username, username), eq(adminUsersTable.email, username)));

  if (adminUser && adminUser.isActive) {
    if (!verifyPassword(password, adminUser.passwordHash)) {
      await db.insert(loginHistoryTable).values({ userId: adminUser.id, username: adminUser.username, userType: "admin", ipAddress: ip, userAgent: ua, status: "failed" });
      res.status(401).json({ error: "Invalid credentials" }); return;
    }
    const token = signToken({ userId: adminUser.id, username: adminUser.username, role: adminUser.role, userType: "admin", exp: Date.now() + TOKEN_TTL_MS });
    res.cookie(TOKEN_COOKIE, token, { httpOnly: true, sameSite: "lax", maxAge: TOKEN_TTL_MS, path: "/" });
    await db.insert(loginHistoryTable).values({ userId: adminUser.id, username: adminUser.username, userType: "admin", ipAddress: ip, userAgent: ua, status: "success" });
    await logActivity(adminUser.id, adminUser.username, "admin", "auth", "login");
    res.json({ ok: true, user: { id: adminUser.id, username: adminUser.username, email: adminUser.email, role: adminUser.role, userType: "admin" } });
    return;
  }

  // Check employees
  const [employee] = await db.select().from(teamMembersTable)
    .where(or(eq(teamMembersTable.username, username), eq(teamMembersTable.email, username)));

  if (employee && employee.status === "active" && employee.username && employee.passwordHash) {
    if (!verifyPassword(password, employee.passwordHash)) {
      await db.insert(loginHistoryTable).values({ userId: employee.id, username: employee.username, userType: "employee", ipAddress: ip, userAgent: ua, status: "failed" });
      res.status(401).json({ error: "Invalid credentials" }); return;
    }
    const token = signToken({
      userId: employee.id, username: employee.username, role: employee.role,
      employeeId: employee.employeeId, userType: "employee",
      forcePasswordChange: employee.forcePasswordChange,
      exp: Date.now() + TOKEN_TTL_MS,
    });
    res.cookie(TOKEN_COOKIE, token, { httpOnly: true, sameSite: "lax", maxAge: TOKEN_TTL_MS, path: "/" });
    await db.update(teamMembersTable).set({ lastLoginAt: new Date() }).where(eq(teamMembersTable.id, employee.id));
    await db.insert(loginHistoryTable).values({ userId: employee.id, username: employee.username, userType: "employee", ipAddress: ip, userAgent: ua, status: "success" });
    await logActivity(employee.id, employee.username, "employee", "auth", "login");
    res.json({ ok: true, user: { id: employee.id, username: employee.username, email: employee.email, role: employee.role, userType: "employee", employeeId: employee.employeeId, forcePasswordChange: employee.forcePasswordChange } });
    return;
  }

  await db.insert(loginHistoryTable).values({ userId: null, username, userType: "admin", ipAddress: ip, userAgent: ua, status: "failed" });
  res.status(401).json({ error: "Invalid credentials" });
});

authRouter.post("/admin/auth/logout", async (req, res): Promise<void> => {
  const token = req.cookies?.[TOKEN_COOKIE] as string | undefined;
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const userId = typeof payload.userId === "number" ? payload.userId : null;
      if (userId !== null) {
        // Mark the most recent active session as logged out
        await db.update(loginHistoryTable)
          .set({ loggedOutAt: new Date() })
          .where(and(
            eq(loginHistoryTable.userId, userId),
            eq(loginHistoryTable.status, "success"),
            isNull(loginHistoryTable.loggedOutAt),
          ));
      }
      await logActivity(
        userId,
        typeof payload.username === "string" ? payload.username : "unknown",
        (payload.userType as "admin" | "employee") ?? "admin",
        "auth", "logout",
      );
    }
  }
  res.clearCookie(TOKEN_COOKIE, { path: "/" });
  res.json({ ok: true });
});

authRouter.post("/admin/auth/change-password", async (req, res): Promise<void> => {
  const token = req.cookies?.[TOKEN_COOKIE] as string | undefined;
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }
  const payload = verifyToken(token);
  if (!payload) { res.status(401).json({ error: "Session expired" }); return; }

  const { newPassword } = req.body as { newPassword?: string };
  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" }); return;
  }

  const userId = typeof payload.userId === "number" ? payload.userId : null;
  if (!userId) { res.status(401).json({ error: "Invalid session" }); return; }

  if (payload.userType === "employee") {
    await db.update(teamMembersTable)
      .set({ passwordHash: hashPassword(newPassword), forcePasswordChange: false })
      .where(eq(teamMembersTable.id, userId));
  } else {
    await db.update(adminUsersTable)
      .set({ passwordHash: hashPassword(newPassword) })
      .where(eq(adminUsersTable.id, userId));
  }

  // Re-issue token with forcePasswordChange cleared
  const { forcePasswordChange: _fc, exp: _exp, ...rest } = payload;
  const newToken = signToken({ ...rest, forcePasswordChange: false, exp: Date.now() + TOKEN_TTL_MS });
  res.cookie(TOKEN_COOKIE, newToken, { httpOnly: true, sameSite: "lax", maxAge: TOKEN_TTL_MS, path: "/" });
  await logActivity(userId, typeof payload.username === "string" ? payload.username : "unknown",
    payload.userType === "employee" ? "employee" : "admin", "auth", "password_change");
  res.json({ ok: true });
});

authRouter.get("/admin/auth/me", (req, res): void => {
  const token = req.cookies?.[TOKEN_COOKIE] as string | undefined;
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }
  const payload = verifyToken(token);
  if (!payload) { res.status(401).json({ error: "Session expired" }); return; }
  res.json({ ok: true, user: payload });
});

authRouter.get("/admin/auth/permissions", async (req, res): Promise<void> => {
  const token = req.cookies?.[TOKEN_COOKIE] as string | undefined;
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }
  const payload = verifyToken(token);
  if (!payload) { res.status(401).json({ error: "Session expired" }); return; }

  const role = typeof payload.role === "string" ? payload.role : "";
  const userType = typeof payload.userType === "string" ? payload.userType : "admin";
  try {
    const perms = await loadPermissions(role, userType);
    res.json(perms);
  } catch {
    res.json({ all: false, map: {} });
  }
});

// ── User management (admin only) ──────────────────────────────────────────────
authRouter.get("/admin/auth/users", adminAuthMiddleware, requirePermission("employees", "view"), async (_req, res): Promise<void> => {
  const users = await db.select({
    id: adminUsersTable.id, username: adminUsersTable.username,
    email: adminUsersTable.email, role: adminUsersTable.role,
    isActive: adminUsersTable.isActive, createdAt: adminUsersTable.createdAt,
  }).from(adminUsersTable);
  res.json(users);
});

authRouter.post("/admin/auth/users", adminAuthMiddleware, requirePermission("employees", "create"), async (req, res): Promise<void> => {
  const { username, email, password, role } = req.body as Record<string, string>;
  if (!username || !email || !password) { res.status(400).json({ error: "username, email, password required" }); return; }
  const [user] = await db.insert(adminUsersTable).values({ username, email, passwordHash: hashPassword(password), role: role ?? "staff" }).returning({ id: adminUsersTable.id, username: adminUsersTable.username, email: adminUsersTable.email, role: adminUsersTable.role });
  res.status(201).json(user);
});

authRouter.patch("/admin/auth/users/:id/password", adminAuthMiddleware, requirePermission("employees", "edit"), async (req, res): Promise<void> => {
  const { password } = req.body as { password?: string };
  if (!password || password.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }
  await db.update(adminUsersTable).set({ passwordHash: hashPassword(password) }).where(eq(adminUsersTable.id, parseInt(String(req.params["id"]), 10)));
  res.json({ ok: true });
});

authRouter.delete("/admin/auth/users/:id", adminAuthMiddleware, requirePermission("employees", "delete"), async (req, res): Promise<void> => {
  await db.delete(adminUsersTable).where(eq(adminUsersTable.id, parseInt(String(req.params["id"]), 10)));
  res.sendStatus(204);
});

import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import { eq, or } from "drizzle-orm";
import { db, adminUsersTable } from "@workspace/db";

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

// ── Auth Middleware ───────────────────────────────────────────────────────────
// Only protects /api/admin/* routes (but not /api/admin/auth/*)
export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const isAdminPath = req.path.startsWith("/api/admin/");
  const isAuthPath = req.path.startsWith("/api/admin/auth/");
  if (!isAdminPath || isAuthPath) { next(); return; }

  const token = req.cookies?.[TOKEN_COOKIE] as string | undefined;
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }
  const payload = verifyToken(token);
  if (!payload) { res.status(401).json({ error: "Session expired" }); return; }
  (req as Request & { adminUser: unknown }).adminUser = payload;
  next();
}

// ── Routes ────────────────────────────────────────────────────────────────────

authRouter.post("/admin/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) { res.status(400).json({ error: "Username and password required" }); return; }

  const [user] = await db.select().from(adminUsersTable)
    .where(or(eq(adminUsersTable.username, username), eq(adminUsersTable.email, username)));

  if (!user || !user.isActive) { res.status(401).json({ error: "Invalid credentials" }); return; }
  if (!verifyPassword(password, user.passwordHash)) { res.status(401).json({ error: "Invalid credentials" }); return; }

  const token = signToken({ userId: user.id, username: user.username, role: user.role, exp: Date.now() + TOKEN_TTL_MS });
  res.cookie(TOKEN_COOKIE, token, { httpOnly: true, sameSite: "lax", maxAge: TOKEN_TTL_MS, path: "/" });
  res.json({ ok: true, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
});

authRouter.post("/admin/auth/logout", (_req, res): void => {
  res.clearCookie(TOKEN_COOKIE, { path: "/" });
  res.json({ ok: true });
});

authRouter.get("/admin/auth/me", (req, res): void => {
  const token = req.cookies?.[TOKEN_COOKIE] as string | undefined;
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }
  const payload = verifyToken(token);
  if (!payload) { res.status(401).json({ error: "Session expired" }); return; }
  res.json({ ok: true, user: payload });
});

// ── User management (admin only) ──────────────────────────────────────────────
authRouter.get("/admin/auth/users", adminAuthMiddleware, async (_req, res): Promise<void> => {
  const users = await db.select({ id: adminUsersTable.id, username: adminUsersTable.username, email: adminUsersTable.email, role: adminUsersTable.role, isActive: adminUsersTable.isActive, createdAt: adminUsersTable.createdAt }).from(adminUsersTable);
  res.json(users);
});

authRouter.post("/admin/auth/users", adminAuthMiddleware, async (req, res): Promise<void> => {
  const { username, email, password, role } = req.body as Record<string, string>;
  if (!username || !email || !password) { res.status(400).json({ error: "username, email, password required" }); return; }
  const [user] = await db.insert(adminUsersTable).values({ username, email, passwordHash: hashPassword(password), role: role ?? "staff" }).returning({ id: adminUsersTable.id, username: adminUsersTable.username, email: adminUsersTable.email, role: adminUsersTable.role });
  res.status(201).json(user);
});

authRouter.patch("/admin/auth/users/:id/password", adminAuthMiddleware, async (req, res): Promise<void> => {
  const { password } = req.body as { password?: string };
  if (!password || password.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }
  await db.update(adminUsersTable).set({ passwordHash: hashPassword(password) }).where(eq(adminUsersTable.id, parseInt(req.params.id, 10)));
  res.json({ ok: true });
});

authRouter.delete("/admin/auth/users/:id", adminAuthMiddleware, async (req, res): Promise<void> => {
  await db.delete(adminUsersTable).where(eq(adminUsersTable.id, parseInt(req.params.id, 10)));
  res.sendStatus(204);
});

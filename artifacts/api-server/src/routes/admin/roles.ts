import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, rolesTable, rolePermissionsTable } from "@workspace/db";

const router: IRouter = Router();

// Module keys must match the permission middleware map in admin/index.ts
const MODULES = [
  "dashboard","leads","employees","team","indian_companies","tasks","invoices",
  "chat","email","reports","contacts","quotations","seo","services",
  "company_data","newsletter","lawyers","locations","settings",
];

const ACTIONS = ["view","create","edit","delete","export","approve","assign","print","download","upload"];

// ── List roles ─────────────────────────────────────────────────────────────────
router.get("/admin/roles", async (_req, res): Promise<void> => {
  const roles = await db.select().from(rolesTable).orderBy(rolesTable.name);
  res.json(roles);
});

// ── Create role ────────────────────────────────────────────────────────────────
router.post("/admin/roles", async (req, res): Promise<void> => {
  const { name, description } = req.body as { name: string; description?: string };
  if (!name?.trim()) { res.status(400).json({ error: "name required" }); return; }
  const [role] = await db.insert(rolesTable).values({ name: name.trim(), description: description ?? null, isSystem: false }).returning();
  res.status(201).json(role);
});

// ── Update role ────────────────────────────────────────────────────────────────
router.patch("/admin/roles/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { name, description } = req.body as { name?: string; description?: string };
  const update: { name?: string; description?: string } = {};
  if (name) update.name = name.trim();
  if (description !== undefined) update.description = description;
  const [role] = await db.update(rolesTable).set(update).where(eq(rolesTable.id, id)).returning();
  if (!role) { res.status(404).json({ error: "Not found" }); return; }
  res.json(role);
});

// ── Delete role (custom only) ──────────────────────────────────────────────────
router.delete("/admin/roles/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, id));
  if (!role) { res.status(404).json({ error: "Not found" }); return; }
  if (role.isSystem) { res.status(403).json({ error: "Cannot delete system role" }); return; }
  await db.delete(rolesTable).where(eq(rolesTable.id, id));
  res.sendStatus(204);
});

// ── Get permissions for a role ─────────────────────────────────────────────────
router.get("/admin/roles/:id/permissions", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const perms = await db.select().from(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, id));
  // Return as matrix: { module: { action: bool } }
  const matrix: Record<string, Record<string, boolean>> = {};
  for (const m of MODULES) {
    matrix[m] = {};
    for (const a of ACTIONS) matrix[m][a] = false;
  }
  for (const p of perms) {
    if (matrix[p.module]) matrix[p.module][p.action] = p.allowed;
  }
  res.json({ roleId: id, matrix, modules: MODULES, actions: ACTIONS });
});

// ── Save permissions for a role (bulk upsert) ─────────────────────────────────
router.put("/admin/roles/:id/permissions", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { matrix } = req.body as { matrix: Record<string, Record<string, boolean>> };
  if (!matrix) { res.status(400).json({ error: "matrix required" }); return; }

  // Delete all existing permissions for this role and re-insert
  await db.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, id));

  const rows: { roleId: number; module: string; action: string; allowed: boolean }[] = [];
  for (const [module, actions] of Object.entries(matrix)) {
    for (const [action, allowed] of Object.entries(actions)) {
      rows.push({ roleId: id, module, action, allowed: Boolean(allowed) });
    }
  }
  if (rows.length > 0) {
    await db.insert(rolePermissionsTable).values(rows);
  }
  res.json({ ok: true, saved: rows.length });
});

// ── Get modules + actions list ─────────────────────────────────────────────────
router.get("/admin/roles/meta/modules", (_req, res): void => {
  res.json({ modules: MODULES, actions: ACTIONS });
});

export default router;

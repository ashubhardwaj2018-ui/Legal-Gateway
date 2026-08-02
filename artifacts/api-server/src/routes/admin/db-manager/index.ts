import { Router } from "express";
import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db/schema";
import { sql, desc, eq, and, gte, lte, type SQL } from "drizzle-orm";
import { TABLE_MAP, ALLOWED_TABLES, type ColDef } from "./table-registry";

// ── Ensure audit_logs table exists at startup ──────────────────────────────────
// This makes the DB Manager self-bootstrapping: if the migration hasn't been
// applied manually the table is created here so audit writes never silently fail.

async function ensureAuditTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id          SERIAL PRIMARY KEY,
      table_name  TEXT        NOT NULL,
      row_id      TEXT,
      action      TEXT        NOT NULL,
      changed_data JSONB,
      actor_username TEXT,
      ip_address  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}
ensureAuditTable().catch(e => console.error("[db-manager] audit table bootstrap failed:", e));

const dbManagerRouter = Router();

// ── Authorization guard ────────────────────────────────────────────────────────
// DB Manager is restricted to super_admin role ONLY.
// ALL admin users receive req.permissions.all = true from loadPermissions, so the
// module-permission middleware in admin/index.ts is bypassed for every admin.
// This explicit guard enforces the real access boundary without relying on that bypass.

dbManagerRouter.use("/admin/db-manager", (req: any, res: any, next: any) => {
  if (!req.adminUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (req.adminUser.role !== "super_admin") {
    res.status(403).json({ error: "Database Manager is restricted to super admin accounts" });
    return;
  }
  next();
});

// ── Sensitive field names that must never appear in audit changedData ──────────

const SENSITIVE_DB_NAMES = new Set([
  "password_hash", "passwordhash", "password",
  "config_enc",    "configenc",
  "api_key",       "apikey",
  "token",         "reset_token", "refresh_token", "access_token",
  "secret",        "private_key", "client_secret",
  "totp_secret",   "totpsecret",
]);

function scrubSensitive(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = SENSITIVE_DB_NAMES.has(k.toLowerCase()) ? "[REDACTED]" : v;
  }
  return out;
}

function scrubAuditEntry(entry: Record<string, unknown>): Record<string, unknown> {
  const cd = entry.changedData ?? entry.changed_data;
  if (!cd || typeof cd !== "object") return entry;
  const data = cd as Record<string, unknown>;
  const scrubbed: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === "before" || k === "after") {
      scrubbed[k] = v && typeof v === "object" ? scrubSensitive(v as Record<string, unknown>) : v;
    } else {
      scrubbed[k] = v;
    }
  }
  const result = { ...entry };
  if ("changedData" in entry) result.changedData = scrubbed;
  else result.changed_data = scrubbed;
  return result;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getActor(req: any): string {
  return (req.adminUser as any)?.username ?? "unknown";
}

function isSuperAdmin(req: any): boolean {
  // req.permissions.all is true for ALL admin users — not a super_admin indicator.
  // Super admin status is the explicit role on the admin_users/team_members record.
  return (req.adminUser as any)?.role === "super_admin";
}

type AuditClient = { insert: typeof db.insert };

async function writeAudit(
  params: {
    tableName: string;
    rowId?: string | null;
    action: string;
    changedData?: unknown;
    actorUsername: string;
    ipAddress?: string;
  },
  client: AuditClient = db,
) {
  // No try/catch — let errors propagate so callers can fail-fast or rollback.
  await client.insert(auditLogsTable).values({
    tableName: params.tableName,
    rowId: params.rowId ?? null,
    action: params.action,
    changedData: (params.changedData ?? null) as any,
    actorUsername: params.actorUsername,
    ipAddress: params.ipAddress ?? null,
  });
}

// Visible columns (not hidden) for SELECT
function visibleCols(cols: ColDef[]): ColDef[] {
  return cols.filter(c => !c.hidden);
}

// Build a SELECT list of visible columns using sql.identifier
function buildSelectList(cols: ColDef[]): SQL<unknown> {
  return visibleCols(cols)
    .map(c => sql`${sql.identifier(c.db)}`)
    .reduce((acc: SQL<unknown>, cur: SQL<unknown>, i: number) =>
      i === 0 ? sql`${cur}` : sql`${acc}, ${cur}`,
      sql`` as SQL<unknown>,
    );
}

// ── Field-level coercion ───────────────────────────────────────────────────────
// Converts a raw body value to the correct JS type for a given column definition.
// Empty string for any nullable column → null. Type mismatches are normalised so
// PostgreSQL never receives an empty string where it expects a timestamp/number/json.

function coerceField(col: ColDef, raw: unknown): unknown {
  // Explicit null / undefined → null for nullable, keep for non-nullable
  if (raw === null || raw === undefined) return null;

  // Empty string handling — the main footgun from browser form inputs
  if (raw === "") {
    if (col.nullable) return null;
    // Non-nullable non-text types: coerce rather than pass ""
    if (col.type !== "text" && col.type !== "enum") return null;
    return "";
  }

  switch (col.type) {
    case "timestamp": {
      // Accept ISO strings, date strings, or Date objects; reject garbage
      const d = new Date(raw as string);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    case "number":
    case "id": {
      const n = Number(raw);
      return isNaN(n) ? null : n;
    }
    case "boolean":
      if (typeof raw === "boolean") return raw;
      return raw === "true" || raw === "1" || raw === 1;
    case "jsonb":
      if (typeof raw === "object") return raw;   // already parsed
      if (typeof raw === "string") {
        try { return JSON.parse(raw); } catch { return null; }
      }
      return null;
    default:
      return raw;
  }
}

// ── GET /admin/db-manager/tables ──────────────────────────────────────────────

dbManagerRouter.get("/admin/db-manager/tables", (req, res) => {
  const superAdmin = isSuperAdmin(req);
  const { TABLE_REGISTRY } = require("./table-registry") as { TABLE_REGISTRY: import("./table-registry").TableDef[] };
  const tables = TABLE_REGISTRY.map(t => ({
    name: t.name,
    label: t.label,
    category: t.category,
    primaryKey: t.primaryKey,
    softDeleteCol: t.softDeleteCol ?? null,
    isProtected: t.isProtected,
    canWrite: !t.isProtected || superAdmin,
    columns: t.columns.filter(c => !c.hidden),
  }));
  res.json(tables);
});

// ── GET /admin/db-manager/audit-logs ─────────────────────────────────────────
// Restricted to super admins only — changedData may contain sensitive fields

dbManagerRouter.get("/admin/db-manager/audit-logs", async (req, res): Promise<void> => {
  if (!isSuperAdmin(req)) {
    res.status(403).json({ error: "Audit log access requires super admin role" });
    return;
  }

  try {
    const {
      tableName, action, actor, dateFrom, dateTo, rowId,
      page = "1", limit = "50",
    } = req.query as Record<string, string>;

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, parseInt(limit, 10) || 50);
    const offset   = (pageNum - 1) * limitNum;

    const conditions: SQL<unknown>[] = [];
    if (tableName) conditions.push(eq(auditLogsTable.tableName, tableName));
    if (action)    conditions.push(eq(auditLogsTable.action, action));
    if (actor)     conditions.push(eq(auditLogsTable.actorUsername, actor));
    if (rowId)     conditions.push(eq(auditLogsTable.rowId, rowId));
    if (dateFrom)  conditions.push(gte(auditLogsTable.createdAt, new Date(dateFrom)));
    if (dateTo)    conditions.push(lte(auditLogsTable.createdAt, new Date(dateTo)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countRes] = await Promise.all([
      db.select().from(auditLogsTable)
        .where(whereClause)
        .orderBy(desc(auditLogsTable.createdAt))
        .limit(limitNum)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(auditLogsTable).where(whereClause),
    ]);

    // Scrub sensitive data from changedData before returning
    const safeRows = rows.map(r => scrubAuditEntry(r as unknown as Record<string, unknown>));

    res.json({ rows: safeRows, total: countRes[0]?.count ?? 0, page: pageNum, limit: limitNum });
  } catch (e) {
    console.error("[db-manager audit-logs]", e);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

// ── GET /admin/db-manager/:table/records ─────────────────────────────────────

dbManagerRouter.get("/admin/db-manager/:table/records", async (req, res): Promise<void> => {
  const { table } = req.params as { table: string };
  if (!ALLOWED_TABLES.has(table)) { res.status(404).json({ error: "Unknown table" }); return; }

  const tableDef = TABLE_MAP.get(table)!;
  if (tableDef.isProtected && !isSuperAdmin(req)) {
    res.status(403).json({ error: "System table — super admin only" }); return;
  }

  try {
    const {
      search = "", sort = tableDef.primaryKey, order = "desc",
      page = "1", limit = "50", showDeleted = "false",
      ...filters
    } = req.query as Record<string, string>;

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(500, parseInt(limit, 10) || 50);
    const offset   = (pageNum - 1) * limitNum;

    const vcols      = visibleCols(tableDef.columns);
    const colDbNames = new Set(vcols.map(c => c.db));
    const colByName  = new Map(tableDef.columns.map(c => [c.name, c]));
    const colByDb    = new Map(tableDef.columns.map(c => [c.db, c]));

    // Validate sort column
    const sortCol = colByName.get(sort) ?? colByDb.get(sort) ?? tableDef.columns[0];
    const safeOrder = order === "asc" ? sql`ASC` : sql`DESC`;

    // Build WHERE fragments
    const whereParts: SQL<unknown>[] = [];

    // Soft-delete filter
    if (tableDef.softDeleteCol) {
      const sdCol = tableDef.columns.find(c => c.name === tableDef.softDeleteCol);
      if (sdCol && showDeleted !== "true") {
        whereParts.push(
          sql`${sql.identifier(sdCol.db)} = false OR ${sql.identifier(sdCol.db)} IS NULL`,
        );
      }
    }

    // Search across text columns
    if (search.trim()) {
      const textCols = vcols.filter(c => c.type === "text" || c.type === "enum");
      if (textCols.length > 0) {
        const searchFrag: SQL<unknown> = textCols
          .map(c => sql`${sql.identifier(c.db)}::text ILIKE ${'%' + search + '%'}` as SQL<unknown>)
          .reduce((acc: SQL<unknown>, cur: SQL<unknown>) => sql`${acc} OR ${cur}`);
        whereParts.push(sql`(${searchFrag})`);
      }
    }

    // Per-column filters
    const reservedParams = new Set(["search", "sort", "order", "page", "limit", "showDeleted"]);
    for (const [key, val] of Object.entries(filters)) {
      if (reservedParams.has(key) || !val) continue;
      const col = colByDb.get(key) ?? colByName.get(key);
      if (col && colDbNames.has(col.db)) {
        if (col.type === "boolean") {
          whereParts.push(sql`${sql.identifier(col.db)} = ${val === "true"}`);
        } else {
          whereParts.push(sql`${sql.identifier(col.db)}::text ILIKE ${'%' + val + '%'}`);
        }
      }
    }

    const whereClause: SQL<unknown> = whereParts.length > 0
      ? sql`WHERE ${whereParts.reduce((a: SQL<unknown>, b: SQL<unknown>) => sql`${a} AND ${b}`)}`
      : sql``;

    const selectCols = buildSelectList(vcols);

    const [rows, countRes] = await Promise.all([
      db.execute(sql`
        SELECT ${selectCols}
        FROM ${sql.identifier(table)}
        ${whereClause}
        ORDER BY ${sql.identifier(sortCol.db)} ${safeOrder}
        LIMIT ${limitNum} OFFSET ${offset}
      `),
      db.execute(sql`SELECT COUNT(*)::int AS cnt FROM ${sql.identifier(table)} ${whereClause}`),
    ]);

    res.json({
      rows: rows.rows,
      total: (countRes.rows[0] as any)?.cnt ?? 0,
      page: pageNum,
      limit: limitNum,
    });
  } catch (e) {
    console.error(`[db-manager GET /${table}/records]`, e);
    res.status(500).json({ error: String(e) });
  }
});

// ── POST /admin/db-manager/:table/records ────────────────────────────────────

dbManagerRouter.post("/admin/db-manager/:table/records", async (req, res): Promise<void> => {
  const { table } = req.params as { table: string };
  if (!ALLOWED_TABLES.has(table)) { res.status(404).json({ error: "Unknown table" }); return; }
  const tableDef = TABLE_MAP.get(table)!;
  if (tableDef.isProtected && !isSuperAdmin(req)) {
    res.status(403).json({ error: "System table — super admin only" }); return;
  }

  try {
    const body       = req.body as Record<string, unknown>;
    const allowed    = new Set(tableDef.columns.filter(c => !c.readonly && !c.hidden && c.type !== "id").map(c => c.db));
    const colByName  = new Map(tableDef.columns.map(c => [c.name, c]));

    const colsSql: SQL<unknown>[] = [];
    const valsSql: SQL<unknown>[] = [];

    for (const [key, val] of Object.entries(body)) {
      const col = colByName.get(key) ?? tableDef.columns.find(c => c.db === key);
      if (!col || !allowed.has(col.db)) continue;
      const coerced = coerceField(col, val);
      // Skip null values for non-nullable fields without a DB default (would cause NOT NULL violation)
      if (coerced === null && !col.nullable && col.type !== "boolean") continue;
      colsSql.push(sql`${sql.identifier(col.db)}`);
      valsSql.push(sql`${coerced}`);
    }

    if (colsSql.length === 0) { res.status(400).json({ error: "No valid fields provided" }); return; }

    const colList: SQL<unknown> = colsSql.reduce((a: SQL<unknown>, b: SQL<unknown>) => sql`${a}, ${b}`);
    const valList: SQL<unknown> = valsSql.reduce((a: SQL<unknown>, b: SQL<unknown>) => sql`${a}, ${b}`);

    const safeRow = await db.transaction(async (tx) => {
      const result = await tx.execute(sql`
        INSERT INTO ${sql.identifier(table)} (${colList})
        VALUES (${valList})
        RETURNING *
      `);
      const newRow = result.rows[0] as Record<string, unknown>;
      await writeAudit({
        tableName: table,
        rowId: String(newRow[tableDef.primaryKey] ?? ""),
        action: "create",
        changedData: { after: scrubSensitive(newRow) },
        actorUsername: getActor(req),
        ipAddress: req.ip,
      }, tx);
      // Return only visible (non-hidden) fields
      const visDbSet = new Set(visibleCols(tableDef.columns).map(c => c.db));
      return Object.fromEntries(Object.entries(newRow).filter(([k]) => visDbSet.has(k)));
    });

    res.status(201).json(safeRow);
  } catch (e) {
    console.error(`[db-manager POST /${table}/records]`, e);
    res.status(500).json({ error: String(e) });
  }
});

// ── PUT /admin/db-manager/:table/records/:id ─────────────────────────────────

dbManagerRouter.put("/admin/db-manager/:table/records/:id", async (req, res): Promise<void> => {
  const { table, id } = req.params as { table: string; id: string };
  if (!ALLOWED_TABLES.has(table)) { res.status(404).json({ error: "Unknown table" }); return; }
  const tableDef = TABLE_MAP.get(table)!;
  if (tableDef.isProtected && !isSuperAdmin(req)) {
    res.status(403).json({ error: "System table — super admin only" }); return;
  }

  try {
    const body      = req.body as Record<string, unknown>;
    const allowed   = new Set(tableDef.columns.filter(c => !c.readonly && !c.hidden && c.type !== "id").map(c => c.db));
    const colByName = new Map(tableDef.columns.map(c => [c.name, c]));

    // Fetch before state (outside transaction — read-only, no need to hold lock)
    const beforeRes = await db.execute(sql`
      SELECT * FROM ${sql.identifier(table)}
      WHERE ${sql.identifier(tableDef.primaryKey)} = ${id}
      LIMIT 1
    `);
    const before = beforeRes.rows[0] as Record<string, unknown> | undefined;
    if (!before) { res.status(404).json({ error: "Record not found" }); return; }

    const setParts: SQL<unknown>[] = [];
    for (const [key, val] of Object.entries(body)) {
      const col = colByName.get(key) ?? tableDef.columns.find(c => c.db === key);
      if (!col || !allowed.has(col.db)) continue;
      const coerced = coerceField(col, val);
      setParts.push(sql`${sql.identifier(col.db)} = ${coerced}`);
    }

    if (setParts.length === 0) { res.status(400).json({ error: "No valid fields to update" }); return; }

    const hasUpdatedAt = tableDef.columns.some(c => c.db === "updated_at");
    if (hasUpdatedAt) setParts.push(sql`updated_at = NOW()`);

    const setClause: SQL<unknown> = setParts.reduce((a: SQL<unknown>, b: SQL<unknown>) => sql`${a}, ${b}`);

    const safeAfter = await db.transaction(async (tx) => {
      const result = await tx.execute(sql`
        UPDATE ${sql.identifier(table)}
        SET ${setClause}
        WHERE ${sql.identifier(tableDef.primaryKey)} = ${id}
        RETURNING *
      `);
      const after = result.rows[0] as Record<string, unknown>;
      await writeAudit({
        tableName: table,
        rowId: id,
        action: "update",
        changedData: { before: scrubSensitive(before), after: scrubSensitive(after) },
        actorUsername: getActor(req),
        ipAddress: req.ip,
      }, tx);
      const visDbSet = new Set(visibleCols(tableDef.columns).map(c => c.db));
      return Object.fromEntries(Object.entries(after).filter(([k]) => visDbSet.has(k)));
    });

    res.json(safeAfter);
  } catch (e) {
    console.error(`[db-manager PUT /${table}/records/${id}]`, e);
    res.status(500).json({ error: String(e) });
  }
});

// ── DELETE /admin/db-manager/:table/records/:id ───────────────────────────────

dbManagerRouter.delete("/admin/db-manager/:table/records/:id", async (req, res): Promise<void> => {
  const { table, id } = req.params as { table: string; id: string };
  if (!ALLOWED_TABLES.has(table)) { res.status(404).json({ error: "Unknown table" }); return; }
  const tableDef = TABLE_MAP.get(table)!;
  if (tableDef.isProtected && !isSuperAdmin(req)) {
    res.status(403).json({ error: "System table — super admin only" }); return;
  }

  try {
    const sdCol        = tableDef.softDeleteCol ? tableDef.columns.find(c => c.name === tableDef.softDeleteCol)! : null;
    const hasUpdatedAt = tableDef.columns.some(c => c.db === "updated_at");
    const extraSet     = hasUpdatedAt ? sql`, updated_at = NOW()` : sql``;

    const affected = await db.transaction(async (tx) => {
      let cnt = 0;
      if (sdCol) {
        const r = await tx.execute(sql`
          UPDATE ${sql.identifier(table)}
          SET ${sql.identifier(sdCol.db)} = true ${extraSet}
          WHERE ${sql.identifier(tableDef.primaryKey)} = ${id}
          RETURNING ${sql.identifier(tableDef.primaryKey)}
        `);
        cnt = r.rows.length;
      } else {
        const r = await tx.execute(sql`
          DELETE FROM ${sql.identifier(table)}
          WHERE ${sql.identifier(tableDef.primaryKey)} = ${id}
          RETURNING ${sql.identifier(tableDef.primaryKey)}
        `);
        cnt = r.rows.length;
      }
      if (cnt === 0) throw Object.assign(new Error("Record not found"), { status: 404 });
      await writeAudit({ tableName: table, rowId: id, action: "delete", actorUsername: getActor(req), ipAddress: req.ip }, tx);
      return cnt;
    });

    void affected; // used only for side-effect
    res.json({ ok: true });
  } catch (e: any) {
    if (e?.status === 404) { res.status(404).json({ error: "Record not found" }); return; }
    console.error(`[db-manager DELETE /${table}/records/${id}]`, e);
    res.status(500).json({ error: String(e) });
  }
});

// ── POST /admin/db-manager/:table/records/:id/restore ────────────────────────

dbManagerRouter.post("/admin/db-manager/:table/records/:id/restore", async (req, res): Promise<void> => {
  const { table, id } = req.params as { table: string; id: string };
  if (!ALLOWED_TABLES.has(table)) { res.status(404).json({ error: "Unknown table" }); return; }
  const tableDef = TABLE_MAP.get(table)!;
  if (!tableDef.softDeleteCol) { res.status(400).json({ error: "Table does not support soft delete" }); return; }

  try {
    const sdCol        = tableDef.columns.find(c => c.name === tableDef.softDeleteCol)!;
    const hasUpdatedAt = tableDef.columns.some(c => c.db === "updated_at");
    const extraSet     = hasUpdatedAt ? sql`, updated_at = NOW()` : sql``;

    await db.transaction(async (tx) => {
      const r = await tx.execute(sql`
        UPDATE ${sql.identifier(table)}
        SET ${sql.identifier(sdCol.db)} = false ${extraSet}
        WHERE ${sql.identifier(tableDef.primaryKey)} = ${id}
        RETURNING ${sql.identifier(tableDef.primaryKey)}
      `);
      if (r.rows.length === 0) throw Object.assign(new Error("Record not found"), { status: 404 });
      await writeAudit({ tableName: table, rowId: id, action: "restore", actorUsername: getActor(req), ipAddress: req.ip }, tx);
    });

    res.json({ ok: true });
  } catch (e: any) {
    if (e?.status === 404) { res.status(404).json({ error: "Record not found" }); return; }
    console.error(`[db-manager restore/${id}]`, e);
    res.status(500).json({ error: String(e) });
  }
});

// ── POST /admin/db-manager/:table/bulk-delete ─────────────────────────────────

dbManagerRouter.post("/admin/db-manager/:table/bulk-delete", async (req, res): Promise<void> => {
  const { table } = req.params as { table: string };
  if (!ALLOWED_TABLES.has(table)) { res.status(404).json({ error: "Unknown table" }); return; }
  const tableDef = TABLE_MAP.get(table)!;
  if (tableDef.isProtected && !isSuperAdmin(req)) {
    res.status(403).json({ error: "System table — super admin only" }); return;
  }

  const { ids } = req.body as { ids: (string | number)[] };
  if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: "ids array required" }); return; }
  if (ids.length > 500) { res.status(400).json({ error: "Max 500 ids per bulk operation" }); return; }

  try {
    const idList: SQL<unknown> = ids
      .map(id => sql`${id}` as SQL<unknown>)
      .reduce((a: SQL<unknown>, b: SQL<unknown>) => sql`${a}, ${b}`);

    const actualDeleted = await db.transaction(async (tx) => {
      let cnt = 0;
      if (tableDef.softDeleteCol) {
        const sdCol = tableDef.columns.find(c => c.name === tableDef.softDeleteCol)!;
        const r = await tx.execute(sql`
          UPDATE ${sql.identifier(table)}
          SET ${sql.identifier(sdCol.db)} = true
          WHERE ${sql.identifier(tableDef.primaryKey)} IN (${idList})
          RETURNING ${sql.identifier(tableDef.primaryKey)}
        `);
        cnt = r.rows.length;
      } else {
        const r = await tx.execute(sql`
          DELETE FROM ${sql.identifier(table)}
          WHERE ${sql.identifier(tableDef.primaryKey)} IN (${idList})
          RETURNING ${sql.identifier(tableDef.primaryKey)}
        `);
        cnt = r.rows.length;
      }
      await writeAudit({
        tableName: table, action: "bulk_delete",
        changedData: { ids, count: cnt },
        actorUsername: getActor(req), ipAddress: req.ip,
      }, tx);
      return cnt;
    });

    res.json({ ok: true, deleted: actualDeleted });
  } catch (e) {
    console.error(`[db-manager bulk-delete/${table}]`, e);
    res.status(500).json({ error: String(e) });
  }
});

// ── POST /admin/db-manager/:table/bulk-edit ───────────────────────────────────

dbManagerRouter.post("/admin/db-manager/:table/bulk-edit", async (req, res): Promise<void> => {
  const { table } = req.params as { table: string };
  if (!ALLOWED_TABLES.has(table)) { res.status(404).json({ error: "Unknown table" }); return; }
  const tableDef = TABLE_MAP.get(table)!;
  if (tableDef.isProtected && !isSuperAdmin(req)) {
    res.status(403).json({ error: "System table — super admin only" }); return;
  }

  const { ids, patch } = req.body as { ids: (string | number)[]; patch: Record<string, unknown> };
  if (!Array.isArray(ids) || ids.length === 0 || !patch || typeof patch !== "object") {
    res.status(400).json({ error: "ids and patch required" }); return;
  }

  try {
    const allowed   = new Set(tableDef.columns.filter(c => !c.readonly && !c.hidden && c.type !== "id").map(c => c.db));
    const colByName = new Map(tableDef.columns.map(c => [c.name, c]));

    const setParts: SQL<unknown>[] = [];
    for (const [key, val] of Object.entries(patch)) {
      const col = colByName.get(key) ?? tableDef.columns.find(c => c.db === key);
      if (!col || !allowed.has(col.db)) continue;
      const coerced = coerceField(col, val);
      if (coerced === null && !col.nullable && col.type !== "boolean") continue;
      setParts.push(sql`${sql.identifier(col.db)} = ${coerced}`);
    }
    if (setParts.length === 0) { res.status(400).json({ error: "No valid fields to update" }); return; }

    const hasUpdatedAt = tableDef.columns.some(c => c.db === "updated_at");
    if (hasUpdatedAt) setParts.push(sql`updated_at = NOW()`);

    const setClause: SQL<unknown> = setParts.reduce((a: SQL<unknown>, b: SQL<unknown>) => sql`${a}, ${b}`);
    const idList: SQL<unknown>    = ids.map(id => sql`${id}` as SQL<unknown>)
                                       .reduce((a: SQL<unknown>, b: SQL<unknown>) => sql`${a}, ${b}`);

    const actualUpdated = await db.transaction(async (tx) => {
      const r = await tx.execute(sql`
        UPDATE ${sql.identifier(table)}
        SET ${setClause}
        WHERE ${sql.identifier(tableDef.primaryKey)} IN (${idList})
        RETURNING ${sql.identifier(tableDef.primaryKey)}
      `);
      const cnt = r.rows.length;
      await writeAudit({
        tableName: table, action: "bulk_edit",
        changedData: { ids, patch: scrubSensitive(patch), count: cnt },
        actorUsername: getActor(req), ipAddress: req.ip,
      }, tx);
      return cnt;
    });

    res.json({ ok: true, updated: actualUpdated });
  } catch (e) {
    console.error(`[db-manager bulk-edit/${table}]`, e);
    res.status(500).json({ error: String(e) });
  }
});

// ── GET /admin/db-manager/:table/export.csv ───────────────────────────────────

dbManagerRouter.get("/admin/db-manager/:table/export.csv", async (req, res): Promise<void> => {
  const { table } = req.params as { table: string };
  if (!ALLOWED_TABLES.has(table)) { res.status(404).json({ error: "Unknown table" }); return; }
  const tableDef = TABLE_MAP.get(table)!;
  if (tableDef.isProtected && !isSuperAdmin(req)) {
    res.status(403).json({ error: "System table — super admin only" }); return;
  }

  try {
    const { search = "", sort = tableDef.primaryKey, order = "desc" } = req.query as Record<string, string>;
    const vcols     = visibleCols(tableDef.columns);
    const colByName = new Map(tableDef.columns.map(c => [c.name, c]));
    const sortCol   = colByName.get(sort) ?? tableDef.columns[0];
    const safeOrder = order === "asc" ? sql`ASC` : sql`DESC`;

    const whereParts: SQL<unknown>[] = [];
    if (search.trim()) {
      const textCols = vcols.filter(c => c.type === "text" || c.type === "enum");
      if (textCols.length > 0) {
        const frag: SQL<unknown> = textCols
          .map(c => sql`${sql.identifier(c.db)}::text ILIKE ${'%' + search + '%'}` as SQL<unknown>)
          .reduce((a: SQL<unknown>, b: SQL<unknown>) => sql`${a} OR ${b}`);
        whereParts.push(sql`(${frag})`);
      }
    }
    const whereClause: SQL<unknown> = whereParts.length > 0
      ? sql`WHERE ${whereParts.reduce((a: SQL<unknown>, b: SQL<unknown>) => sql`${a} AND ${b}`)}`
      : sql``;

    const selectCols = buildSelectList(vcols);
    const result = await db.execute(sql`
      SELECT ${selectCols} FROM ${sql.identifier(table)}
      ${whereClause}
      ORDER BY ${sql.identifier(sortCol.db)} ${safeOrder}
      LIMIT 10000
    `);

    const headers = vcols.map(c => c.label);
    const rows    = result.rows as Record<string, unknown>[];

    const escape = (v: unknown) => {
      const s = v == null ? "" : String(typeof v === "object" ? JSON.stringify(v) : v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const csv = [
      headers.join(","),
      ...rows.map(row => vcols.map(c => escape(row[c.db])).join(",")),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${table}_export.csv"`);
    res.send(csv);
  } catch (e) {
    console.error(`[db-manager export/${table}]`, e);
    res.status(500).json({ error: String(e) });
  }
});

// ── POST /admin/db-manager/:table/import ─────────────────────────────────────

dbManagerRouter.post("/admin/db-manager/:table/import", async (req, res): Promise<void> => {
  const { table } = req.params as { table: string };
  if (!ALLOWED_TABLES.has(table)) { res.status(404).json({ error: "Unknown table" }); return; }
  const tableDef = TABLE_MAP.get(table)!;
  if (tableDef.isProtected && !isSuperAdmin(req)) {
    res.status(403).json({ error: "System table — super admin only" }); return;
  }

  const { rows } = req.body as { rows: Record<string, unknown>[] };
  if (!Array.isArray(rows) || rows.length === 0) { res.status(400).json({ error: "rows array required" }); return; }
  if (rows.length > 5000) { res.status(400).json({ error: "Max 5000 rows per import" }); return; }

  try {
    const allowed   = new Set(tableDef.columns.filter(c => !c.readonly && !c.hidden && c.type !== "id").map(c => c.db));
    const colByLabel = new Map(tableDef.columns.map(c => [c.label.toLowerCase(), c]));
    const colByName  = new Map(tableDef.columns.map(c => [c.name.toLowerCase(), c]));
    const colByDb    = new Map(tableDef.columns.map(c => [c.db.toLowerCase(), c]));

    let inserted     = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const colsSql: SQL<unknown>[] = [];
      const valsSql: SQL<unknown>[] = [];

      for (const [key, val] of Object.entries(row)) {
        const kl  = key.toLowerCase();
        const col = colByLabel.get(kl) ?? colByName.get(kl) ?? colByDb.get(kl);
        if (!col || !allowed.has(col.db)) continue;
        const coerced = coerceField(col, val ?? null);
        // Skip null for non-nullable non-boolean fields to avoid constraint errors
        if (coerced === null && !col.nullable && col.type !== "boolean") continue;
        colsSql.push(sql`${sql.identifier(col.db)}`);
        valsSql.push(sql`${coerced}`);
      }

      if (colsSql.length === 0) continue;
      try {
        const colList: SQL<unknown> = colsSql.reduce((a: SQL<unknown>, b: SQL<unknown>) => sql`${a}, ${b}`);
        const valList: SQL<unknown> = valsSql.reduce((a: SQL<unknown>, b: SQL<unknown>) => sql`${a}, ${b}`);
        // Use RETURNING to count only rows actually inserted (skips conflicts)
        const result = await db.execute(sql`
          INSERT INTO ${sql.identifier(table)} (${colList}) VALUES (${valList})
          ON CONFLICT DO NOTHING
          RETURNING ${sql.identifier(tableDef.primaryKey)}
        `);
        if (result.rows.length > 0) inserted++;
      } catch (e) {
        errors.push(`Row ${i + 1}: ${String(e).slice(0, 100)}`);
      }
    }

    await writeAudit({
      tableName: table, action: "import",
      changedData: { attempted: rows.length, inserted, errors: errors.slice(0, 10) },
      actorUsername: getActor(req), ipAddress: req.ip,
    });

    res.json({ ok: true, inserted, errors });
  } catch (e) {
    console.error(`[db-manager import/${table}]`, e);
    res.status(500).json({ error: String(e) });
  }
});

// ── GET /admin/db-manager/:table/records/:id/history ─────────────────────────
// Restricted to super admins — history contains before/after snapshots

dbManagerRouter.get("/admin/db-manager/:table/records/:id/history", async (req, res): Promise<void> => {
  const { table, id } = req.params as { table: string; id: string };
  if (!ALLOWED_TABLES.has(table)) { res.status(404).json({ error: "Unknown table" }); return; }
  if (!isSuperAdmin(req)) {
    res.status(403).json({ error: "Record history requires super admin role" });
    return;
  }

  try {
    const history = await db.select().from(auditLogsTable)
      .where(and(eq(auditLogsTable.tableName, table), eq(auditLogsTable.rowId, id)))
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(100);

    // Scrub sensitive fields from changedData before returning
    const safeHistory = history.map(r => scrubAuditEntry(r as unknown as Record<string, unknown>));
    res.json(safeHistory);
  } catch (e) {
    console.error(`[db-manager history/${table}/${id}]`, e);
    res.status(500).json({ error: String(e) });
  }
});

export default dbManagerRouter;

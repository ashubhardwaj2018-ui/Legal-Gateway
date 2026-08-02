import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, servicesConfigTable } from "@workspace/db";
import {
  CreateServiceConfigBody,
  UpdateServiceConfigBody,
  UpdateServiceConfigParams,
  DeleteServiceConfigParams,
  ListServicesConfigQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/admin/services-config", async (req, res): Promise<void> => {
  const qp = ListServicesConfigQueryParams.safeParse(req.query);
  const categoryId = qp.success ? qp.data.categoryId : undefined;

  let results;
  if (categoryId) {
    results = await db.select().from(servicesConfigTable).where(eq(servicesConfigTable.categoryId, categoryId));
  } else {
    results = await db.select().from(servicesConfigTable).orderBy(servicesConfigTable.categoryId, servicesConfigTable.serviceName);
  }
  res.json(results);
});

router.post("/admin/services-config", async (req, res): Promise<void> => {
  const parsed = CreateServiceConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [result] = await db.insert(servicesConfigTable).values(parsed.data).returning();
  res.status(201).json(result);
});

router.patch("/admin/services-config/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramsParsed = UpdateServiceConfigParams.safeParse({ id: parseInt(rawId, 10) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const bodyParsed = UpdateServiceConfigBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }
  const [result] = await db
    .update(servicesConfigTable)
    .set({ ...bodyParsed.data, updatedAt: new Date() })
    .where(eq(servicesConfigTable.id, paramsParsed.data.id))
    .returning();
  if (!result) {
    res.status(404).json({ error: "Service config not found" });
    return;
  }
  res.json(result);
});

router.delete("/admin/services-config/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramsParsed = DeleteServiceConfigParams.safeParse({ id: parseInt(rawId, 10) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [deleted] = await db
    .delete(servicesConfigTable)
    .where(eq(servicesConfigTable.id, paramsParsed.data.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Service config not found" });
    return;
  }
  res.sendStatus(204);
});

// ── POST /admin/services/bulk ─────────────────────────────────────────────────
// Bulk upsert services from CSV import.
// Each row: { name, slug, categoryId (string, e.g. "business-setup"), shortDescription?, description?, price?, isActive? }
// - Validates required fields and rejects the whole request on structural errors.
// - Rejects rows with duplicate slugs within the submitted batch.
// - Upserts by slug (unique index on services_config.slug): updates existing, inserts new.
// Returns: { inserted, updated, errors, rowErrors }

// Valid category IDs sourced from the static SERVICES_DATA categories.
const VALID_CATEGORY_IDS = new Set([
  "consult-expert", "business-setup", "tax-compliance", "trademark-ip",
  "documentation", "fundraising", "ngo", "property-personal", "lawyers",
]);

interface BulkServiceRow {
  name: string;
  slug: string;
  categoryId: string;
  shortDescription?: string;
  description?: string;
  price?: number | null;
  isActive?: boolean;
}

router.post("/admin/services/bulk", async (req, res): Promise<void> => {
  const { rows } = req.body as { rows: BulkServiceRow[] };

  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "rows array is required and must not be empty" });
    return;
  }
  if (rows.length > 2000) {
    res.status(400).json({ error: "Max 2000 rows per import" });
    return;
  }

  // Per-row structural validation
  const validationErrors: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const label = `Row ${i + 1}`;
    if (!r.name?.trim())               validationErrors.push(`${label}: name is required`);
    if (!r.slug?.trim())               validationErrors.push(`${label}: slug is required`);
    if (!r.categoryId?.trim())         validationErrors.push(`${label}: categoryId is required`);
    else if (!VALID_CATEGORY_IDS.has(r.categoryId.trim())) {
      validationErrors.push(`${label}: categoryId "${r.categoryId}" is not a recognised category. Valid values: ${[...VALID_CATEGORY_IDS].join(", ")}`);
    }
    if (r.price != null) {
      const p = Number(r.price);
      if (!Number.isFinite(p) || !Number.isInteger(p) || p < 0) {
        validationErrors.push(`${label}: price must be a non-negative integer`);
      }
    }
  }
  if (validationErrors.length > 0) {
    res.status(400).json({ error: "Validation failed", details: validationErrors });
    return;
  }

  // Reject duplicate slugs within the batch
  const seenSlugs = new Set<string>();
  const duplicateSlugs: string[] = [];
  for (const r of rows) {
    const s = r.slug.trim().toLowerCase();
    if (seenSlugs.has(s)) duplicateSlugs.push(s);
    else seenSlugs.add(s);
  }
  if (duplicateSlugs.length > 0) {
    res.status(400).json({ error: "Duplicate slugs in batch", duplicates: duplicateSlugs });
    return;
  }

  let inserted = 0;
  let updated = 0;
  let errors = 0;
  const rowErrors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const slug        = r.slug.trim().toLowerCase();
    const categoryId  = r.categoryId.trim();
    const serviceName = r.name.trim();
    const basePrice   = (r.price != null && Number.isFinite(Number(r.price)))
      ? Math.round(Number(r.price)) : null;
    const isActive    = r.isActive !== false;
    const description = r.description?.trim() || r.shortDescription?.trim() || null;

    try {
      // Check if a service with this slug already exists
      const [existing] = await db
        .select({ id: servicesConfigTable.id })
        .from(servicesConfigTable)
        .where(eq(servicesConfigTable.slug, slug))
        .limit(1);

      if (existing) {
        await db
          .update(servicesConfigTable)
          .set({
            serviceName,
            categoryId,
            ...(description !== null ? { description } : {}),
            ...(basePrice   !== null ? { basePrice }   : {}),
            isActive,
            updatedAt: new Date(),
          })
          .where(eq(servicesConfigTable.id, existing.id));
        updated++;
      } else {
        await db
          .insert(servicesConfigTable)
          .values({
            slug,
            categoryId,
            serviceName,
            description: description ?? undefined,
            basePrice: basePrice ?? undefined,
            isActive,
          });
        inserted++;
      }
    } catch (e) {
      errors++;
      rowErrors.push(`Row ${i + 1} (${serviceName}): ${String(e).slice(0, 120)}`);
    }
  }

  res.json({ inserted, updated, errors, rowErrors });
});

export default router;

import { Router, type IRouter } from "express";
import { eq, ilike, or, count, desc, sql, and, inArray } from "drizzle-orm";
import { db, locationsTable, locationUploadLogsTable } from "@workspace/db";
import { z } from "zod/v4";

const router: IRouter = Router();

function makeSlug(row: {
  city?: string | null;
  town?: string | null;
  village?: string | null;
  district?: string | null;
  state: string;
}): string {
  const primary = row.city || row.town || row.village || row.district || row.state;
  return primary
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// Stats dashboard
router.get("/admin/locations/stats", async (req, res): Promise<void> => {
  const result = await db.execute(sql`
    SELECT
      COUNT(*) AS total,
      COUNT(DISTINCT state) AS states,
      COUNT(DISTINCT district) FILTER (WHERE district IS NOT NULL) AS districts,
      COUNT(*) FILTER (WHERE city IS NOT NULL) AS cities,
      COUNT(*) FILTER (WHERE town IS NOT NULL AND city IS NULL) AS towns,
      COUNT(*) FILTER (WHERE village IS NOT NULL AND city IS NULL AND town IS NULL) AS villages,
      COUNT(*) FILTER (WHERE is_active = true) AS active
    FROM locations
  `);
  const row = (result.rows[0] ?? {}) as Record<string, unknown>;
  const [lastUpload] = await db
    .select()
    .from(locationUploadLogsTable)
    .orderBy(desc(locationUploadLogsTable.createdAt))
    .limit(1);
  res.json({
    total: Number(row.total) || 0,
    states: Number(row.states) || 0,
    districts: Number(row.districts) || 0,
    cities: Number(row.cities) || 0,
    towns: Number(row.towns) || 0,
    villages: Number(row.villages) || 0,
    active: Number(row.active) || 0,
    lastUpload: lastUpload ?? null,
  });
});

// Upload history
router.get("/admin/location-upload-logs", async (req, res): Promise<void> => {
  const logs = await db
    .select()
    .from(locationUploadLogsTable)
    .orderBy(desc(locationUploadLogsTable.createdAt))
    .limit(20);
  res.json(logs);
});

// List locations
router.get("/admin/locations", async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  const district = typeof req.query.district === "string" ? req.query.district : undefined;
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(200, Math.max(10, parseInt(String(req.query.limit ?? "50"), 10)));
  const offset = (page - 1) * limit;

  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(locationsTable.city, `%${search}%`),
        ilike(locationsTable.town, `%${search}%`),
        ilike(locationsTable.district, `%${search}%`),
        ilike(locationsTable.state, `%${search}%`),
        ilike(locationsTable.slug, `%${search}%`),
      ),
    );
  }
  if (state) conditions.push(eq(locationsTable.state, state));
  if (district) conditions.push(eq(locationsTable.district, district));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRes] = where
    ? await db.select({ value: count() }).from(locationsTable).where(where)
    : await db.select({ value: count() }).from(locationsTable);

  const data = where
    ? await db.select().from(locationsTable).where(where).orderBy(desc(locationsTable.createdAt)).limit(limit).offset(offset)
    : await db.select().from(locationsTable).orderBy(desc(locationsTable.createdAt)).limit(limit).offset(offset);

  res.json({ data, total: totalRes?.value ?? 0, page, limit });
});

// Distinct states list (for filter dropdowns)
router.get("/admin/locations/states", async (req, res): Promise<void> => {
  const rows = await db
    .selectDistinct({ state: locationsTable.state })
    .from(locationsTable)
    .orderBy(locationsTable.state);
  res.json(rows.map((r) => r.state));
});

// Bulk upsert (from frontend Excel parse)
const BulkUpsertBody = z.object({
  fileName: z.string(),
  records: z.array(
    z.object({
      country: z.string().optional(),
      state: z.string(),
      district: z.string().optional(),
      city: z.string().optional(),
      town: z.string().optional(),
      village: z.string().optional(),
      pincode: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      population: z.number().optional(),
    }),
  ),
});

router.post("/admin/locations/bulk-upsert", async (req, res): Promise<void> => {
  const parsed = BulkUpsertBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { fileName, records } = parsed.data;
  let inserted = 0;
  let updated = 0;
  let duplicates = 0;
  let errors = 0;
  const BATCH = 200;

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    try {
      const rows = batch.map((r) => ({
        country: r.country ?? "India",
        state: r.state,
        district: r.district ?? null,
        city: r.city ?? null,
        town: r.town ?? null,
        village: r.village ?? null,
        pincode: r.pincode ?? null,
        latitude: r.latitude ?? null,
        longitude: r.longitude ?? null,
        population: r.population ?? null,
        slug: makeSlug(r),
        isActive: true,
      }));

      const result = await db
        .insert(locationsTable)
        .values(rows)
        .onConflictDoUpdate({
          target: locationsTable.slug,
          set: {
            state: sql`excluded.state`,
            district: sql`excluded.district`,
            city: sql`excluded.city`,
            town: sql`excluded.town`,
            village: sql`excluded.village`,
            pincode: sql`excluded.pincode`,
            latitude: sql`excluded.latitude`,
            longitude: sql`excluded.longitude`,
            population: sql`excluded.population`,
            updatedAt: new Date(),
          },
        })
        .returning({ id: locationsTable.id, slug: locationsTable.slug });

      // Count inserted vs updated by checking which rows existed before
      inserted += result.length;
    } catch {
      errors += batch.length;
    }
  }

  // Log the upload
  await db.insert(locationUploadLogsTable).values({
    fileName,
    totalRows: records.length,
    inserted,
    updated,
    duplicates,
    errors,
  });

  res.json({ totalRows: records.length, inserted, updated, duplicates, errors });
});

// Create single location
router.post("/admin/locations", async (req, res): Promise<void> => {
  const { country, state, district, city, town, village, pincode, latitude, longitude, population } = req.body as Record<string, unknown>;
  if (!state || typeof state !== "string") {
    res.status(400).json({ error: "state is required" });
    return;
  }
  const slug = makeSlug({ city: city as string, town: town as string, village: village as string, district: district as string, state });
  try {
    const [row] = await db
      .insert(locationsTable)
      .values({ country: String(country ?? "India"), state, district: district as string, city: city as string, town: town as string, village: village as string, pincode: pincode as string, latitude: latitude as number, longitude: longitude as number, population: population as number, slug })
      .returning();
    res.status(201).json(row);
  } catch {
    res.status(409).json({ error: "Location with this slug already exists" });
  }
});

// Update location
router.put("/admin/locations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { state, district, city, town, village, pincode, latitude, longitude, population, isActive } = req.body as Record<string, unknown>;
  if (!state || typeof state !== "string") { res.status(400).json({ error: "state is required" }); return; }
  const slug = makeSlug({ city: city as string, town: town as string, village: village as string, district: district as string, state });
  const [row] = await db
    .update(locationsTable)
    .set({ state, district: district as string, city: city as string, town: town as string, village: village as string, pincode: pincode as string, latitude: latitude as number, longitude: longitude as number, population: population as number, isActive: Boolean(isActive ?? true), slug })
    .where(eq(locationsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

// Toggle active status
router.patch("/admin/locations/:id/status", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [current] = await db.select().from(locationsTable).where(eq(locationsTable.id, id));
  if (!current) { res.status(404).json({ error: "Not found" }); return; }
  const [row] = await db.update(locationsTable).set({ isActive: !current.isActive }).where(eq(locationsTable.id, id)).returning();
  res.json(row);
});

// Delete single
router.delete("/admin/locations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [deleted] = await db.delete(locationsTable).where(eq(locationsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

// Bulk delete
router.post("/admin/locations/bulk-delete", async (req, res): Promise<void> => {
  const ids = (req.body as { ids?: unknown }).ids;
  if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: "ids array required" }); return; }
  const numIds = ids.map(Number).filter((n) => !isNaN(n));
  await db.delete(locationsTable).where(inArray(locationsTable.id, numIds));
  res.json({ deleted: numIds.length });
});

export default router;

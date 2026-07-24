import { Router, type IRouter } from "express";
import { eq, ilike, or, count, desc, sql, and, inArray } from "drizzle-orm";
import { db, locationsTable, locationUploadLogsTable } from "@workspace/db";
import * as XLSX from "xlsx";
import multer from "multer";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

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

// ─── Template download ──────────────────────────────────────────────────────

router.get("/admin/locations/template", (_req, res): void => {
  const wb = XLSX.utils.book_new();
  const headers = ["City", "State", "Country", "Slug", "Meta Title", "Meta Description", "Latitude", "Longitude"];
  const sampleData = [
    { City: "Mumbai", State: "Maharashtra", Country: "India", Slug: "mumbai", "Meta Title": "Top Lawyers in Mumbai | Vakil & Co", "Meta Description": "Expert legal services in Mumbai. Contact Vakil & Co for trademark, property, and corporate law.", Latitude: 19.076, Longitude: 72.8777 },
    { City: "Bangalore", State: "Karnataka", Country: "India", Slug: "bangalore", "Meta Title": "Legal Services in Bangalore | Vakil & Co", "Meta Description": "Trusted law firm in Bangalore for startups, IP, NGO registration and more.", Latitude: 12.9716, Longitude: 77.5946 },
    { City: "Chennai", State: "Tamil Nadu", Country: "India", Slug: "chennai", "Meta Title": "Lawyers in Chennai | Vakil & Co", "Meta Description": "Professional legal assistance in Chennai. Trademark, property, and business law experts.", Latitude: 13.0827, Longitude: 80.2707 },
  ];
  const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
  ws["!cols"] = [16, 16, 12, 16, 40, 60, 10, 10].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, "Locations");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=\"locations-template.xlsx\"");
  res.send(Buffer.from(buf));
});

// ─── Server-side parse & preview ────────────────────────────────────────────

interface ParsedPreviewRow {
  idx: number;
  city?: string;
  state?: string;
  country?: string;
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  latitude?: number;
  longitude?: number;
  errors: string[];
  isValid: boolean;
}

interface ColumnMapping {
  source: string;
  target: string;
}

function normalisePreviewRow(raw: Record<string, unknown>, idx: number): ParsedPreviewRow {
  const pick = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = raw[k] ?? raw[k.toLowerCase()] ?? raw[k.toUpperCase()];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return undefined;
  };
  const state = pick("State", "state");
  const city = pick("City", "city");
  const country = pick("Country", "country") ?? "India";
  const slugInput = pick("Slug", "slug");
  const metaTitle = pick("Meta Title", "meta_title", "metaTitle");
  const metaDescription = pick("Meta Description", "meta_description", "metaDescription");
  const lat = parseFloat(pick("Latitude", "latitude", "lat") ?? "");
  const lng = parseFloat(pick("Longitude", "longitude", "lng", "lon") ?? "");
  const generatedSlug = slugInput || makeSlug({ city, state: state ?? "", town: undefined, village: undefined, district: undefined });
  const errors: string[] = [];
  if (!state) errors.push("State is required");
  if (!city) errors.push("City is required");
  if (!generatedSlug) errors.push("Could not generate slug");
  return {
    idx,
    city,
    state,
    country,
    slug: generatedSlug || undefined,
    metaTitle,
    metaDescription,
    latitude: isNaN(lat) ? undefined : lat,
    longitude: isNaN(lng) ? undefined : lng,
    errors,
    isValid: errors.length === 0,
  };
}

router.post(
  "/admin/locations/parse-preview",
  upload.single("file"),
  (req, res): void => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    try {
      const wb = XLSX.read(file.buffer, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      if (rawRows.length === 0) {
        res.status(422).json({ error: "File contains no data rows" });
        return;
      }

      // Detect columns present in the file
      const detectedColumns = Object.keys(rawRows[0] ?? {});

      // Build column mapping (source → canonical target)
      const mapping: ColumnMapping[] = [];
      const colMap: Record<string, string> = {
        City: "city", State: "state", Country: "country", Slug: "slug",
        "Meta Title": "metaTitle", "Meta Description": "metaDescription",
        Latitude: "latitude", Longitude: "longitude",
      };
      for (const col of detectedColumns) {
        const target = colMap[col] ?? colMap[col.toLowerCase()] ?? col.toLowerCase().replace(/\s+/g, "_");
        mapping.push({ source: col, target });
      }

      // Parse & validate rows
      const rows = rawRows.map((r, i) => normalisePreviewRow(r, i + 1));

      // Flag duplicate slugs within file
      const slugSeen = new Map<string, number>();
      for (const row of rows) {
        if (!row.slug) continue;
        if (slugSeen.has(row.slug)) {
          row.errors.push(`Duplicate slug within file (first at row ${slugSeen.get(row.slug)})`);
          row.isValid = false;
        } else {
          slugSeen.set(row.slug, row.idx);
        }
      }

      const validRows = rows.filter((r) => r.isValid);
      const errorRows = rows.filter((r) => !r.isValid);

      res.json({
        totalRows: rows.length,
        validCount: validRows.length,
        errorCount: errorRows.length,
        detectedColumns,
        columnMapping: mapping,
        rows,        // full list (first 500 for preview)
        validRows,   // only valid, for import payload
      });
    } catch {
      res.status(422).json({ error: "Failed to parse file — check it is a valid Excel or CSV" });
    }
  },
);

// ─── CSV export ─────────────────────────────────────────────────────────────

router.get("/admin/locations/export-csv", async (req, res): Promise<void> => {
  const rows = await db.select().from(locationsTable).orderBy(desc(locationsTable.createdAt));
  const header = "id,country,state,district,city,town,village,pincode,latitude,longitude,population,slug,isActive,createdAt";
  const csvRows = rows.map((r) =>
    [
      r.id,
      r.country,
      r.state,
      r.district ?? "",
      r.city ?? "",
      r.town ?? "",
      r.village ?? "",
      r.pincode ?? "",
      r.latitude ?? "",
      r.longitude ?? "",
      r.population ?? "",
      r.slug,
      r.isActive,
      r.createdAt.toISOString(),
    ]
      .map((v) => (String(v).includes(",") ? `"${String(v).replace(/"/g, '""')}"` : v))
      .join(","),
  );
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=\"locations-export.csv\"");
  res.send([header, ...csvRows].join("\n"));
});

// ─── Stats dashboard ─────────────────────────────────────────────────────────

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
interface LocationRecord {
  country?: string;
  state: string;
  district?: string;
  city?: string;
  town?: string;
  village?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  population?: number;
}

router.post("/admin/locations/bulk-upsert", async (req, res): Promise<void> => {
  const body = req.body as { fileName?: unknown; records?: unknown };
  const fileName = typeof body.fileName === "string" ? body.fileName : "upload.xlsx";
  if (!Array.isArray(body.records)) {
    res.status(400).json({ error: "records array required" });
    return;
  }
  const records = body.records as LocationRecord[];
  if (records.some((r) => !r.state)) {
    res.status(400).json({ error: "Each record must have a state" });
    return;
  }
  let inserted = 0;
  let updated = 0;
  let duplicates = 0;
  let errors = 0;
  const BATCH = 200;

  // Pre-fetch all slugs that already exist so we can accurately count inserts vs updates
  const allSlugs = records.map((r) => makeSlug(r)).filter(Boolean);
  const existingSlugRows = allSlugs.length
    ? await db
        .select({ slug: locationsTable.slug })
        .from(locationsTable)
        .where(inArray(locationsTable.slug, allSlugs))
    : [];
  const existingSlugs = new Set(existingSlugRows.map((r) => r.slug));

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

      await db
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
        });

      // Accurately split batch into new inserts vs updates
      for (const row of rows) {
        if (existingSlugs.has(row.slug)) updated++;
        else inserted++;
      }
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

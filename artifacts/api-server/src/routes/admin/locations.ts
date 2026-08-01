import { Router, type IRouter } from "express";
import { eq, ilike, or, count, desc, sql, and, inArray } from "drizzle-orm";
import { db, locationsTable, locationUploadLogsTable, serviceLocationsTable } from "@workspace/db";
import https from "https";
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
  city?: string;       // most-specific display name (village > town > city > district)
  state?: string;
  country?: string;
  district?: string;
  town?: string;
  village?: string;
  pincode?: string;
  population?: number;
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

/** Slugify a plain string (no makeSlug dependency). */
function slugifyStr(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function normalisePreviewRow(raw: Record<string, unknown>, idx: number): ParsedPreviewRow {
  const pick = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = raw[k] ?? raw[k.toLowerCase()] ?? raw[k.toUpperCase()];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return undefined;
  };

  const state    = pick("State", "state");
  const district = pick("District", "district");
  const city     = pick("City", "city");
  const town     = pick("Town", "town");
  const village  = pick("Village", "village");
  const country  = pick("Country", "country") ?? "India";
  const pincode  = pick("Pin Code", "Pincode", "pincode", "zip");
  const popRaw   = pick("Population", "population");
  const population = popRaw ? parseInt(popRaw, 10) : undefined;

  // For pSEO, the "display city" is the most specific non-empty location level:
  // village > town > city > district
  const primaryLocation = village || town || city || district;

  const slugInput       = pick("Slug", "slug");
  const metaTitle       = pick("Meta Title", "meta_title", "metaTitle");
  const metaDescription = pick("Meta Description", "meta_description", "metaDescription");
  const lat = parseFloat(pick("Latitude", "latitude", "lat") ?? "");
  const lng = parseFloat(pick("Longitude", "longitude", "lng", "lon", "Longitute", "longitute") ?? "");

  // Generate compound slug: "{primaryLocation}-{state}" for cross-state uniqueness.
  // Falls back to slugifyStr(state) when only state is present.
  let generatedSlug = slugInput;
  if (!generatedSlug && primaryLocation && state) {
    generatedSlug = slugifyStr(`${primaryLocation} ${state}`);
  } else if (!generatedSlug && primaryLocation) {
    generatedSlug = slugifyStr(primaryLocation);
  } else if (!generatedSlug && state) {
    generatedSlug = slugifyStr(state);
  }

  const errors: string[] = [];
  if (!state) errors.push("State is required");
  if (!primaryLocation) errors.push("City, Town, Village, or District is required");
  if (!generatedSlug) errors.push("Could not generate slug");

  return {
    idx,
    city: primaryLocation,   // store most-specific location as the display city
    state,
    country,
    district,
    town,
    village,
    pincode,
    population: isNaN(population as number) ? undefined : population,
    slug: generatedSlug || undefined,
    metaTitle,
    metaDescription,
    latitude: isNaN(lat) ? undefined : lat,
    longitude: isNaN(lng) ? undefined : lng,
    errors,
    isValid: errors.length === 0,
  };
}

// In-memory store: server holds parsed validRows so client never needs to send them back
interface ParsedLocBatch {
  validRows: ParsedPreviewRow[];
  createdAt: number;
}
const locParsedStore = new Map<string, ParsedLocBatch>();
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, b] of locParsedStore.entries()) {
    if (b.createdAt < cutoff) locParsedStore.delete(id);
  }
}, 30 * 60 * 1000);

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

      // Store valid rows server-side so import uses parseId (no double round-trip)
      const parseId = `loc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      locParsedStore.set(parseId, { validRows, createdAt: Date.now() });

      res.json({
        parseId,
        totalRows: rows.length,
        validCount: validRows.length,
        errorCount: rows.filter((r) => !r.isValid).length,
        detectedColumns,
        columnMapping: mapping,
        rows: rows.slice(0, 500), // preview only — validRows NOT sent back to save bandwidth
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

// ─── In-memory import job store ─────────────────────────────────────────────

type JobStatus = "pending" | "running" | "done" | "error";
interface ImportJob {
  status: JobStatus;
  fileName: string;
  total: number;
  processed: number;
  inserted: number;
  updated: number;
  duplicates: number;
  errors: number;
  message?: string;
}
const importJobs = new Map<string, ImportJob>();

// Background import runner — mutates job state in-place
async function runImportJob(jobId: string, fileName: string, records: LocationRecord[]): Promise<void> {
  const job = importJobs.get(jobId)!;
  job.status = "running";

  // NOTE: We do NOT pre-fetch existing slugs with inArray() here because that
  // query crashes Node with a stack overflow at ~10k+ items. The upsert below
  // handles conflicts correctly; inserted/updated counts are approximated instead.

  const BATCH = 100;
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
        // Use admin-provided slug if present; otherwise generate from city/state
        slug: r.slug || makeSlug(r),
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

      // Count all upserted rows as inserted (exact insert/update split not tracked
      // to avoid the inArray stack-overflow on large batches).
      job.inserted += rows.length;
    } catch {
      job.errors += batch.length;
    }
    job.processed += batch.length;
  }

  // Log the upload
  try {
    await db.insert(locationUploadLogsTable).values({
      fileName,
      totalRows: records.length,
      inserted: job.inserted,
      updated: job.updated,
      duplicates: job.duplicates,
      errors: job.errors,
    });
  } catch { /* non-fatal */ }

  job.status = "done";
}

// ─── Async import: start job ─────────────────────────────────────────────────

interface LocationRecord {
  slug?: string;
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

router.post("/admin/locations/start-import", (req, res): void => {
  const body = req.body as { fileName?: unknown; records?: unknown; parseId?: unknown };
  const fileName = typeof body.fileName === "string" ? body.fileName : "upload.xlsx";

  let records: LocationRecord[];

  // Prefer parseId (server-stored rows — no double round-trip for large files)
  if (typeof body.parseId === "string") {
    const stored = locParsedStore.get(body.parseId);
    if (!stored) {
      res.status(404).json({ error: "Parse session expired — please re-upload the file" });
      return;
    }
    records = stored.validRows.map((r) => ({
      slug: r.slug,
      country: r.country ?? "India",
      state: r.state!,
      district: r.district,
      city: r.city,
      town: r.town,
      village: r.village,
      pincode: r.pincode,
      population: r.population,
      latitude: r.latitude,
      longitude: r.longitude,
    }));
  } else if (Array.isArray(body.records)) {
    // Backward-compat: client sends records directly
    records = body.records as LocationRecord[];
    if (records.some((r) => !r.state)) {
      res.status(400).json({ error: "Each record must have a state" });
      return;
    }
  } else {
    res.status(400).json({ error: "Provide parseId (recommended) or records array" });
    return;
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job: ImportJob = {
    status: "pending",
    fileName,
    total: records.length,
    processed: 0,
    inserted: 0,
    updated: 0,
    duplicates: 0,
    errors: 0,
  };
  importJobs.set(jobId, job);

  // Fire-and-forget background processing
  runImportJob(jobId, fileName, records).catch((err: unknown) => {
    const j = importJobs.get(jobId);
    if (j) { j.status = "error"; j.message = String(err); }
  });

  res.json({ jobId, total: records.length });
});

// ─── Async import: poll status ───────────────────────────────────────────────

router.get("/admin/locations/import-status/:jobId", (req, res): void => {
  const job = importJobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({
    status: job.status,
    total: job.total,
    processed: job.processed,
    inserted: job.inserted,
    updated: job.updated,
    duplicates: job.duplicates,
    errors: job.errors,
    message: job.message,
  });
});

// ─── Legacy synchronous bulk-upsert (kept for backward compat) ──────────────

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

  const jobId = `sync_${Date.now()}`;
  const job: ImportJob = { status: "pending", fileName, total: records.length, processed: 0, inserted: 0, updated: 0, duplicates: 0, errors: 0 };
  importJobs.set(jobId, job);
  await runImportJob(jobId, fileName, records);
  const done = importJobs.get(jobId)!;
  res.json({ totalRows: records.length, inserted: done.inserted, updated: done.updated, duplicates: done.duplicates, errors: done.errors });
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

// ─── pSEO: Rebuild service-location relationships ────────────────────────────
// Creates service_locations rows for top N locations × all services.
// We cap at 5000 locations to keep the table manageable (dynamic pages work regardless).

const ALL_SERVICE_SLUGS_FOR_REBUILD = [
  // Top services for featured relationship tracking
  "gst-registration","trademark-registration","private-limited-company","limited-liability-partnership",
  "individual-income-tax-filing","fssai-registration-online","msmessi-registration","one-person-company",
  "gst-filing","copyright-registration","startup-india-registration","ngo","trademark-renewal",
  "legal-notice","property-registration","marriage-registration","digital-signature-certificate",
  "tds-return-filing","accounting-and-book-keeping","rental-agreement","sole-proprietorship",
  "partnership-firm","name-change","gst-advisory","trademark-infringement","trust-registration",
  "section-8-company","society-registration","provident-fund-pf-registration","esi-registration",
  "company-name-search","iso-certification","iec-importexport-code","non-disclosure-agreement-nda",
  "employment-agreement","make-a-will","power-of-attorney","property-title-verification",
  "court-marriage","divorce-lawyer","criminal-lawyer","trademark-registration","trademark-infringement",
  "permanent-patent","provisional-application","copyright-registration","design-registration",
  "gst-registration","gst-filing","tds-return-filing","income-tax-notice",
];
const UNIQUE_REBUILD_SLUGS = [...new Set(ALL_SERVICE_SLUGS_FOR_REBUILD)];

router.post("/admin/locations/rebuild-relationships", async (req, res): Promise<void> => {
  const start = Date.now();
  const MAX_LOCATIONS = 5_000;
  const BATCH = 200;

  try {
    // Fetch top locations by population
    const locations = await db
      .select({ id: locationsTable.id })
      .from(locationsTable)
      .where(eq(locationsTable.isActive, true))
      .orderBy(desc(locationsTable.population))
      .limit(MAX_LOCATIONS);

    let inserted = 0;

    // Insert in batches, ignore duplicates via onConflictDoNothing
    for (let i = 0; i < locations.length; i += BATCH) {
      const batch = locations.slice(i, i + BATCH);
      const rows = batch.flatMap((loc) =>
        UNIQUE_REBUILD_SLUGS.map((slug) => ({
          serviceId: slug,
          locationId: loc.id,
          isFeatured: true,
        }))
      );

      try {
        const result = await db
          .insert(serviceLocationsTable)
          .values(rows)
          .onConflictDoNothing()
          .returning({ id: serviceLocationsTable.id });
        inserted += result.length;
      } catch { /* skip batch on error */ }
    }

    res.json({
      inserted,
      locationsCovered: locations.length,
      serviceCount: UNIQUE_REBUILD_SLUGS.length,
      elapsed: Date.now() - start,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Sitemap: ping search engines ────────────────────────────────────────────

function pingUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const req = https.get(url, (res) => { resolve(res.statusCode !== undefined && res.statusCode < 400); res.resume(); });
      req.setTimeout(8000, () => { req.destroy(); resolve(false); });
      req.on("error", () => resolve(false));
    } catch { resolve(false); }
  });
}

router.post("/admin/sitemap/ping", async (req, res): Promise<void> => {
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host  = req.headers["x-forwarded-host"] ?? req.headers.host ?? "vakil.co.in";
  const sitemapUrl = encodeURIComponent(`${proto}://${host}/api/sitemap.xml`);

  const [google, bing] = await Promise.all([
    pingUrl(`https://www.google.com/ping?sitemap=${sitemapUrl}`),
    pingUrl(`https://www.bing.com/ping?sitemap=${sitemapUrl}`),
  ]);

  res.json({
    google,
    bing,
    sitemapSubmitted: decodeURIComponent(sitemapUrl),
    message: `Pinged at ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`,
  });
});

export default router;

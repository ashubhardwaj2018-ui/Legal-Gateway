import { Router, type IRouter } from "express";
import { eq, ilike, or, count, desc, and, sql } from "drizzle-orm";
import { db, indianCompaniesTable } from "@workspace/db";
import * as XLSX from "xlsx";
import multer from "multer";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

// ─── Slug generation ──────────────────────────────────────────────────────────
function makeSlug(name: string, cin: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  const suffix = cin.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toLowerCase();
  return `${base}-${suffix}`;
}

// ─── Template download ────────────────────────────────────────────────────────
router.get("/admin/indian-companies/template", (_req, res): void => {
  const wb = XLSX.utils.book_new();
  const headers = [
    "CIN", "Company Name", "Company Type", "Company Status",
    "Date of Incorporation", "Authorised Capital(Rs)", "Paid Up Capital(Rs)",
    "State", "District", "City", "Pin Code",
    "Principal Business Activity", "Registrar of Companies", "Registered Address", "Email",
  ];
  const sampleData = [
    {
      CIN: "U72200MH2010PTC123456",
      "Company Name": "ACME Technologies Private Limited",
      "Company Type": "Private Limited",
      "Company Status": "Active",
      "Date of Incorporation": "15-06-2010",
      "Authorised Capital(Rs)": "1000000",
      "Paid Up Capital(Rs)": "500000",
      State: "Maharashtra",
      District: "Mumbai",
      City: "Mumbai",
      "Pin Code": "400001",
      "Principal Business Activity": "Information Technology",
      "Registrar of Companies": "RoC-Mumbai",
      "Registered Address": "123 Business Park, Andheri East, Mumbai",
      Email: "info@acmetech.com",
    },
    {
      CIN: "L17110GJ1973PLC002867",
      "Company Name": "Gujarat Textiles Limited",
      "Company Type": "Public Limited",
      "Company Status": "Active",
      "Date of Incorporation": "22-03-1973",
      "Authorised Capital(Rs)": "50000000",
      "Paid Up Capital(Rs)": "25000000",
      State: "Gujarat",
      District: "Ahmedabad",
      City: "Ahmedabad",
      "Pin Code": "380001",
      "Principal Business Activity": "Textiles",
      "Registrar of Companies": "RoC-Ahmedabad",
      "Registered Address": "456 Industrial Area, Naroda, Ahmedabad",
      Email: "contact@gujarattextiles.com",
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
  ws["!cols"] = [22, 40, 18, 12, 18, 18, 16, 14, 14, 14, 10, 30, 20, 40, 26].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, "Companies");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="indian-companies-template.xlsx"');
  res.send(Buffer.from(buf));
});

// ─── Server-side parse & preview (stored so import doesn't need to re-send data)
interface NormalisedRow {
  cin: string;
  companyName: string;
  incorporationDate: string | null;
  companyStatus: string | null;
  companyType: string | null;
  authorizedCapital: string | null;
  paidUpCapital: string | null;
  registeredOffice: string | null;
  state: string | null;
  district: string | null;
  city: string | null;
  pincode: string | null;
  industry: string | null;
  roc: string | null;
  email: string | null;
  slug: string;
  errors: string[];
  isValid: boolean;
  rowIndex: number;
}

function normaliseCompanyRow(raw: Record<string, unknown>, idx: number): NormalisedRow {
  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = raw[k] ?? raw[k.toLowerCase()] ?? raw[k.toUpperCase()];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return null;
  };

  const cin = pick("CIN", "cin") ?? "";
  const companyName = pick("Company Name", "companyName", "company_name", "COMPANY NAME") ?? "";
  const errors: string[] = [];
  if (!cin) errors.push("CIN is required");
  if (!companyName) errors.push("Company Name is required");

  const slug = cin && companyName ? makeSlug(companyName, cin) : "";

  return {
    cin,
    companyName,
    slug,
    incorporationDate: pick("Date of Incorporation", "incorporationDate", "incorporation_date"),
    companyStatus: pick("Company Status", "companyStatus", "company_status", "Status"),
    companyType: pick("Company Type", "companyType", "company_type", "Type"),
    authorizedCapital: pick("Authorised Capital(Rs)", "authorizedCapital", "authorized_capital", "Authorized Capital"),
    paidUpCapital: pick("Paid Up Capital(Rs)", "paidUpCapital", "paid_up_capital", "Paid Up Capital"),
    registeredOffice: pick("Registered Address", "registeredOffice", "registered_office", "Registered Office"),
    state: pick("State", "state"),
    district: pick("District", "district"),
    city: pick("City", "city"),
    pincode: pick("Pin Code", "Pincode", "pincode", "PIN"),
    industry: pick("Principal Business Activity", "industry", "Industry"),
    roc: pick("Registrar of Companies", "roc", "ROC"),
    email: pick("Email", "email"),
    errors,
    isValid: errors.length === 0,
    rowIndex: idx,
  };
}

// In-memory store for parsed rows (keyed by parseId, expires after 2 hours)
interface ParsedBatch {
  rows: NormalisedRow[];
  validRows: NormalisedRow[];
  createdAt: number;
}
const parsedStore = new Map<string, ParsedBatch>();

// Cleanup old entries every 30 minutes
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, batch] of parsedStore.entries()) {
    if (batch.createdAt < cutoff) parsedStore.delete(id);
  }
}, 30 * 60 * 1000);

router.post(
  "/admin/indian-companies/parse-preview",
  upload.single("file"),
  (req, res): void => {
    const file = req.file;
    if (!file) { res.status(400).json({ error: "No file uploaded" }); return; }
    try {
      const wb = XLSX.read(file.buffer, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      if (rawRows.length === 0) { res.status(422).json({ error: "File contains no data rows" }); return; }

      const rows = rawRows.map((r, i) => normaliseCompanyRow(r, i + 1));

      // Flag duplicate CINs within file
      const cinSeen = new Map<string, number>();
      for (const row of rows) {
        if (!row.cin) continue;
        if (cinSeen.has(row.cin)) {
          row.errors.push(`Duplicate CIN in file (first at row ${cinSeen.get(row.cin)})`);
          row.isValid = false;
        } else {
          cinSeen.set(row.cin, row.rowIndex);
        }
      }

      const validRows = rows.filter((r) => r.isValid);
      const parseId = `ic_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      parsedStore.set(parseId, { rows, validRows, createdAt: Date.now() });

      const detectedColumns = Object.keys(rawRows[0] ?? {});

      res.json({
        parseId,
        totalRows: rows.length,
        validCount: validRows.length,
        errorCount: rows.filter((r) => !r.isValid).length,
        detectedColumns,
        preview: rows.slice(0, 200),
      });
    } catch {
      res.status(422).json({ error: "Failed to parse file — check it is a valid Excel or CSV" });
    }
  },
);

// ─── In-memory import job store ───────────────────────────────────────────────
type JobStatus = "pending" | "running" | "done" | "error";
interface ImportJob {
  status: JobStatus;
  fileName: string;
  total: number;
  processed: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  message?: string;
}
const importJobs = new Map<string, ImportJob>();

async function runCompanyImportJob(jobId: string, fileName: string, rows: NormalisedRow[]): Promise<void> {
  const job = importJobs.get(jobId)!;
  job.status = "running";

  const BATCH = 1000; // bulk insert 1000 rows per query — ~20x faster than row-by-row
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).filter((r) => r.cin && r.companyName);
    job.skipped += rows.slice(i, i + BATCH).length - batch.length;

    if (batch.length === 0) { job.processed += BATCH; continue; }

    const values = batch.map((row) => ({
      cin: row.cin,
      companyName: row.companyName,
      slug: row.slug,
      incorporationDate: row.incorporationDate,
      companyStatus: row.companyStatus,
      companyType: row.companyType,
      authorizedCapital: row.authorizedCapital,
      paidUpCapital: row.paidUpCapital,
      registeredOffice: row.registeredOffice,
      state: row.state,
      district: row.district,
      city: row.city,
      pincode: row.pincode,
      industry: row.industry,
      roc: row.roc,
      email: row.email,
      updatedAt: new Date(),
    }));

    try {
      await db.insert(indianCompaniesTable)
        .values(values)
        .onConflictDoUpdate({
          target: indianCompaniesTable.cin,
          set: {
            companyName: sql`excluded.company_name`,
            slug: sql`excluded.slug`,
            incorporationDate: sql`excluded.incorporation_date`,
            companyStatus: sql`excluded.company_status`,
            companyType: sql`excluded.company_type`,
            authorizedCapital: sql`excluded.authorized_capital`,
            paidUpCapital: sql`excluded.paid_up_capital`,
            registeredOffice: sql`excluded.registered_office`,
            state: sql`excluded.state`,
            district: sql`excluded.district`,
            city: sql`excluded.city`,
            pincode: sql`excluded.pincode`,
            industry: sql`excluded.industry`,
            roc: sql`excluded.roc`,
            email: sql`excluded.email`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
      job.imported += batch.length;
    } catch {
      job.errors += batch.length;
    }
    job.processed += batch.length;
  }
  job.status = "done";
}

// Start import (uses parseId for large files)
router.post("/admin/indian-companies/start-import", (req, res): void => {
  const body = req.body as { parseId?: string; fileName?: string };
  const parseId = typeof body.parseId === "string" ? body.parseId : null;
  const fileName = typeof body.fileName === "string" ? body.fileName : "upload.xlsx";

  if (!parseId) { res.status(400).json({ error: "parseId is required" }); return; }
  const stored = parsedStore.get(parseId);
  if (!stored) { res.status(404).json({ error: "Parse session expired — please re-upload the file" }); return; }

  const { validRows } = stored;
  if (validRows.length === 0) { res.status(400).json({ error: "No valid rows to import" }); return; }

  const jobId = `icjob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job: ImportJob = {
    status: "pending", fileName, total: validRows.length,
    processed: 0, imported: 0, updated: 0, skipped: 0, errors: 0,
  };
  importJobs.set(jobId, job);

  runCompanyImportJob(jobId, fileName, validRows).catch((err: unknown) => {
    const j = importJobs.get(jobId);
    if (j) { j.status = "error"; j.message = String(err); }
  });

  res.json({ jobId, total: validRows.length });
});

// Poll job status
router.get("/admin/indian-companies/import-status/:jobId", (req, res): void => {
  const job = importJobs.get(req.params.jobId);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  res.json({
    status: job.status,
    total: job.total,
    processed: job.processed,
    imported: job.imported,
    updated: job.updated,
    skipped: job.skipped,
    errors: job.errors,
    message: job.message,
  });
});

// ─── Fast JSON bulk-upsert (for server-side migration / seeding) ──────────────
// POST /admin/indian-companies/bulk-upsert
// Body: { records: [{ cin, companyName, slug, incorporationDate, companyStatus, companyType,
//   authorizedCapital, paidUpCapital, registeredOffice, state, district, city, pincode,
//   industry, roc, email }] }
// Returns: { inserted, updated, errors }
router.post("/admin/indian-companies/bulk-upsert", async (req, res): Promise<void> => {
  const body = req.body as { records?: unknown[] };
  if (!Array.isArray(body.records) || body.records.length === 0) {
    res.status(400).json({ error: "records array is required" });
    return;
  }

  const raw = body.records as Record<string, unknown>[];
  const valid = raw.filter((r) => r.cin && r.companyName && r.slug);
  if (valid.length === 0) { res.json({ inserted: 0, updated: 0, errors: raw.length }); return; }

  const BATCH = 1000;
  let inserted = 0, errors = 0;

  for (let i = 0; i < valid.length; i += BATCH) {
    const batch = valid.slice(i, i + BATCH).map((r) => ({
      cin: String(r.cin),
      companyName: String(r.companyName),
      slug: String(r.slug),
      incorporationDate: r.incorporationDate ? String(r.incorporationDate) : null,
      companyStatus: r.companyStatus ? String(r.companyStatus) : null,
      companyType: r.companyType ? String(r.companyType) : null,
      authorizedCapital: r.authorizedCapital ? String(r.authorizedCapital) : null,
      paidUpCapital: r.paidUpCapital ? String(r.paidUpCapital) : null,
      registeredOffice: r.registeredOffice ? String(r.registeredOffice) : null,
      state: r.state ? String(r.state) : null,
      district: r.district ? String(r.district) : null,
      city: r.city ? String(r.city) : null,
      pincode: r.pincode ? String(r.pincode) : null,
      industry: r.industry ? String(r.industry) : null,
      roc: r.roc ? String(r.roc) : null,
      email: r.email ? String(r.email) : null,
      updatedAt: new Date(),
    }));

    try {
      await db.insert(indianCompaniesTable)
        .values(batch)
        .onConflictDoUpdate({
          target: indianCompaniesTable.cin,
          set: {
            companyName: sql`excluded.company_name`,
            slug: sql`excluded.slug`,
            incorporationDate: sql`excluded.incorporation_date`,
            companyStatus: sql`excluded.company_status`,
            companyType: sql`excluded.company_type`,
            authorizedCapital: sql`excluded.authorized_capital`,
            paidUpCapital: sql`excluded.paid_up_capital`,
            registeredOffice: sql`excluded.registered_office`,
            state: sql`excluded.state`,
            district: sql`excluded.district`,
            city: sql`excluded.city`,
            pincode: sql`excluded.pincode`,
            industry: sql`excluded.industry`,
            roc: sql`excluded.roc`,
            email: sql`excluded.email`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
      inserted += batch.length;
    } catch {
      errors += batch.length;
    }
  }

  res.json({ inserted, updated: 0, errors });
});

// ─── Browse / list ────────────────────────────────────────────────────────────
router.get("/admin/indian-companies", async (req, res): Promise<void> => {
  const {
    search, state, status, type: companyType, letter,
    page: pageStr, limit: limitStr,
  } = req.query as Record<string, string | undefined>;

  const page = parseInt(pageStr ?? "1", 10) || 1;
  const limit = Math.min(parseInt(limitStr ?? "50", 10) || 50, 200);
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];
  if (search) {
    conditions.push(
      or(
        ilike(indianCompaniesTable.companyName, `%${search}%`),
        ilike(indianCompaniesTable.cin, `%${search}%`),
      ) as ReturnType<typeof eq>
    );
  }
  if (letter && /^[a-zA-Z]$/.test(letter)) {
    conditions.push(ilike(indianCompaniesTable.companyName, `${letter}%`) as ReturnType<typeof eq>);
  }
  if (state) conditions.push(ilike(indianCompaniesTable.state, `%${state}%`) as ReturnType<typeof eq>);
  if (status) conditions.push(ilike(indianCompaniesTable.companyStatus, `%${status}%`) as ReturnType<typeof eq>);
  if (companyType) conditions.push(ilike(indianCompaniesTable.companyType, `%${companyType}%`) as ReturnType<typeof eq>);

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = where
    ? await db.select({ value: count() }).from(indianCompaniesTable).where(where)
    : await db.select({ value: count() }).from(indianCompaniesTable);

  const data = where
    ? await db.select().from(indianCompaniesTable).where(where).orderBy(desc(indianCompaniesTable.createdAt)).limit(limit).offset(offset)
    : await db.select().from(indianCompaniesTable).orderBy(desc(indianCompaniesTable.createdAt)).limit(limit).offset(offset);

  res.json({ data, total: totalResult?.value ?? 0, page, limit });
});

// Delete single
router.delete("/admin/indian-companies/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [deleted] = await db.delete(indianCompaniesTable).where(eq(indianCompaniesTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

// CSV export
router.get("/admin/indian-companies/export", async (req, res): Promise<void> => {
  const { search, state, status, type: companyType } = req.query as Record<string, string | undefined>;

  const conditions: ReturnType<typeof eq>[] = [];
  if (search) conditions.push(or(ilike(indianCompaniesTable.companyName, `%${search}%`), ilike(indianCompaniesTable.cin, `%${search}%`)) as ReturnType<typeof eq>);
  if (state) conditions.push(ilike(indianCompaniesTable.state, `%${state}%`) as ReturnType<typeof eq>);
  if (status) conditions.push(ilike(indianCompaniesTable.companyStatus, `%${status}%`) as ReturnType<typeof eq>);
  if (companyType) conditions.push(ilike(indianCompaniesTable.companyType, `%${companyType}%`) as ReturnType<typeof eq>);

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const data = where
    ? await db.select().from(indianCompaniesTable).where(where).orderBy(indianCompaniesTable.companyName).limit(50000)
    : await db.select().from(indianCompaniesTable).orderBy(indianCompaniesTable.companyName).limit(50000);

  const headers = ["CIN","Company Name","Company Type","Company Status","Incorporation Date","Authorized Capital","Paid Up Capital","State","District","City","Pincode","Industry","ROC","Registered Office","Email"];
  const rows = data.map(c => [
    c.cin, c.companyName, c.companyType ?? "", c.companyStatus ?? "",
    c.incorporationDate ?? "", c.authorizedCapital ?? "", c.paidUpCapital ?? "",
    c.state ?? "", c.district ?? "", c.city ?? "", c.pincode ?? "",
    c.industry ?? "", c.roc ?? "", c.registeredOffice ?? "", c.email ?? "",
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="indian-companies.csv"');
  res.send(csv);
});

export default router;

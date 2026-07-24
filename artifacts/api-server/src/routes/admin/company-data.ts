import { Router, type IRouter } from "express";
import { eq, ilike, or, count, desc, sql } from "drizzle-orm";
import { db, companyDataTable } from "@workspace/db";
import { requirePermission } from "./auth";
import {
  CreateCompanyRecordBody,
  BulkImportCompanyDataBody,
  ListCompanyDataQueryParams,
  DeleteCompanyRecordParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/admin/company-data", async (req, res): Promise<void> => {
  const qp = ListCompanyDataQueryParams.safeParse(req.query);
  const search = qp.success ? qp.data.search : undefined;
  const state = qp.success ? qp.data.state : undefined;
  const status = qp.success ? qp.data.status : undefined;
  const page = qp.success ? (qp.data.page ?? 1) : 1;
  const limit = qp.success ? (qp.data.limit ?? 50) : 50;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(companyDataTable.companyName, `%${search}%`),
        ilike(companyDataTable.cin, `%${search}%`),
        ilike(companyDataTable.email, `%${search}%`)
      )
    );
  }
  if (state) conditions.push(eq(companyDataTable.state, state));
  if (status) conditions.push(eq(companyDataTable.companyStatus, status));

  const whereClause = conditions.length > 0
    ? sql`${conditions.reduce((a, b) => sql`${a} AND ${b}`)}`
    : undefined;

  const [totalResult] = whereClause
    ? await db.select({ value: count() }).from(companyDataTable).where(whereClause)
    : await db.select({ value: count() }).from(companyDataTable);

  const data = whereClause
    ? await db.select().from(companyDataTable).where(whereClause).orderBy(desc(companyDataTable.createdAt)).limit(limit).offset(offset)
    : await db.select().from(companyDataTable).orderBy(desc(companyDataTable.createdAt)).limit(limit).offset(offset);

  res.json({ data, total: totalResult?.value ?? 0, page, limit });
});

router.post("/admin/company-data", async (req, res): Promise<void> => {
  const parsed = CreateCompanyRecordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [result] = await db.insert(companyDataTable).values(parsed.data).returning();
  res.status(201).json(result);
});

router.post("/admin/company-data/bulk-import", requirePermission("company_data", "import"), async (req, res): Promise<void> => {
  const parsed = BulkImportCompanyDataBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let imported = 0;
  let errors = 0;
  const BATCH_SIZE = 100;
  const records = parsed.data.records;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    try {
      await db.insert(companyDataTable).values(batch);
      imported += batch.length;
    } catch {
      errors += batch.length;
    }
  }

  res.json({ imported, skipped: 0, errors });
});

router.delete("/admin/company-data/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const paramsParsed = DeleteCompanyRecordParams.safeParse({ id: parseInt(rawId, 10) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const [deleted] = await db.delete(companyDataTable).where(eq(companyDataTable.id, paramsParsed.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Record not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;

import { Router, type IRouter } from "express";
import { eq, ilike, or, count, desc, and } from "drizzle-orm";
import { db, indianCompaniesTable } from "@workspace/db";

const router: IRouter = Router();

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

router.get("/admin/indian-companies", async (req, res): Promise<void> => {
  const {
    search, state, status, type: companyType,
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

router.post("/admin/indian-companies/bulk-import", async (req, res): Promise<void> => {
  const { records } = req.body as { records: Record<string, string>[] };
  if (!Array.isArray(records) || records.length === 0) {
    res.status(400).json({ error: "No records provided" });
    return;
  }

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of records) {
    const cin = (row.cin ?? row.CIN ?? "").toString().trim();
    const companyName = (row.companyName ?? row.company_name ?? row["Company Name"] ?? row["COMPANY NAME"] ?? "").toString().trim();

    if (!cin || !companyName) { skipped++; continue; }

    const slug = makeSlug(companyName, cin);

    const payload = {
      cin,
      companyName,
      slug,
      incorporationDate: (row.incorporationDate ?? row.incorporation_date ?? row["Date of Incorporation"] ?? "").toString().trim() || null,
      companyStatus: (row.companyStatus ?? row.company_status ?? row["Company Status"] ?? row["Status"] ?? "").toString().trim() || null,
      companyType: (row.companyType ?? row.company_type ?? row["Company Type"] ?? row["Type"] ?? "").toString().trim() || null,
      authorizedCapital: (row.authorizedCapital ?? row.authorized_capital ?? row["Authorised Capital(Rs)"] ?? "").toString().trim() || null,
      paidUpCapital: (row.paidUpCapital ?? row.paid_up_capital ?? row["Paid Up Capital(Rs)"] ?? "").toString().trim() || null,
      registeredOffice: (row.registeredOffice ?? row.registered_office ?? row["Registered Address"] ?? "").toString().trim() || null,
      state: (row.state ?? row.State ?? "").toString().trim() || null,
      district: (row.district ?? row.District ?? "").toString().trim() || null,
      city: (row.city ?? row.City ?? "").toString().trim() || null,
      pincode: (row.pincode ?? row.Pincode ?? row["Pin Code"] ?? "").toString().trim() || null,
      industry: (row.industry ?? row.Industry ?? row["Principal Business Activity"] ?? "").toString().trim() || null,
      roc: (row.roc ?? row.ROC ?? row["Registrar of Companies"] ?? "").toString().trim() || null,
      email: (row.email ?? row.Email ?? "").toString().trim() || null,
      updatedAt: new Date(),
    };

    try {
      const [existing] = await db.select({ id: indianCompaniesTable.id }).from(indianCompaniesTable).where(eq(indianCompaniesTable.cin, cin)).limit(1);
      if (existing) {
        await db.update(indianCompaniesTable).set(payload).where(eq(indianCompaniesTable.cin, cin));
        updated++;
      } else {
        await db.insert(indianCompaniesTable).values(payload);
        imported++;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      errors.push(`CIN ${cin}: ${msg.slice(0, 80)}`);
    }
  }

  res.json({ imported, updated, skipped, errors: errors.slice(0, 20), total: records.length });
});

router.delete("/admin/indian-companies/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [deleted] = await db.delete(indianCompaniesTable).where(eq(indianCompaniesTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

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

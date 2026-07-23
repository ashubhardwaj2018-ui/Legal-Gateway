import { Router, type IRouter } from "express";
import { eq, ilike, or, count, desc, sql, and } from "drizzle-orm";
import { db, indianCompaniesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/companies", async (req, res): Promise<void> => {
  const {
    search, state, district, city, industry, roc,
    status, type: companyType,
    page: pageStr, limit: limitStr,
  } = req.query as Record<string, string | undefined>;

  const page = parseInt(pageStr ?? "1", 10) || 1;
  const limit = Math.min(parseInt(limitStr ?? "25", 10) || 25, 100);
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
  if (district) conditions.push(ilike(indianCompaniesTable.district, `%${district}%`) as ReturnType<typeof eq>);
  if (city) conditions.push(ilike(indianCompaniesTable.city, `%${city}%`) as ReturnType<typeof eq>);
  if (industry) conditions.push(ilike(indianCompaniesTable.industry, `%${industry}%`) as ReturnType<typeof eq>);
  if (roc) conditions.push(ilike(indianCompaniesTable.roc, `%${roc}%`) as ReturnType<typeof eq>);
  if (status) conditions.push(ilike(indianCompaniesTable.companyStatus, `%${status}%`) as ReturnType<typeof eq>);
  if (companyType) conditions.push(ilike(indianCompaniesTable.companyType, `%${companyType}%`) as ReturnType<typeof eq>);

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = where
    ? await db.select({ value: count() }).from(indianCompaniesTable).where(where)
    : await db.select({ value: count() }).from(indianCompaniesTable);

  const data = where
    ? await db.select().from(indianCompaniesTable).where(where).orderBy(desc(indianCompaniesTable.createdAt)).limit(limit).offset(offset)
    : await db.select().from(indianCompaniesTable).orderBy(desc(indianCompaniesTable.createdAt)).limit(limit).offset(offset);

  res.json({ data, total: totalResult?.value ?? 0, page, limit, pages: Math.ceil((totalResult?.value ?? 0) / limit) });
});

router.get("/companies/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params;
  const [company] = await db.select().from(indianCompaniesTable).where(eq(indianCompaniesTable.slug, slug)).limit(1);
  if (!company) { res.status(404).json({ error: "Company not found" }); return; }

  const related = await db.select({
    id: indianCompaniesTable.id,
    companyName: indianCompaniesTable.companyName,
    slug: indianCompaniesTable.slug,
    companyType: indianCompaniesTable.companyType,
    companyStatus: indianCompaniesTable.companyStatus,
    state: indianCompaniesTable.state,
    city: indianCompaniesTable.city,
  })
    .from(indianCompaniesTable)
    .where(and(eq(indianCompaniesTable.state, company.state ?? ""), sql`${indianCompaniesTable.id} != ${company.id}`))
    .orderBy(desc(indianCompaniesTable.createdAt))
    .limit(6);

  res.json({ company, related });
});

export default router;

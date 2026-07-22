import { Router, type IRouter } from "express";
import { eq, ilike, or, and, ne, sql, desc } from "drizzle-orm";
import { db, locationsTable } from "@workspace/db";

const router: IRouter = Router();

// AJAX location search — GET /api/locations/search?q=gur&limit=8
router.get("/locations/search", async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const limit = Math.min(20, parseInt(String(req.query.limit ?? "8"), 10));
  if (!q || q.length < 2) { res.json([]); return; }

  const rows = await db
    .select({
      slug: locationsTable.slug,
      city: locationsTable.city,
      town: locationsTable.town,
      village: locationsTable.village,
      district: locationsTable.district,
      state: locationsTable.state,
    })
    .from(locationsTable)
    .where(
      and(
        eq(locationsTable.isActive, true),
        or(
          ilike(locationsTable.city, `${q}%`),
          ilike(locationsTable.town, `${q}%`),
          ilike(locationsTable.village, `${q}%`),
          ilike(locationsTable.district, `${q}%`),
          ilike(locationsTable.slug, `${q}%`),
        ),
      ),
    )
    .orderBy(locationsTable.city)
    .limit(limit);

  res.json(rows);
});

// Get location by slug — GET /api/locations/:slug
router.get("/locations/:slug", async (req, res): Promise<void> => {
  const slug = req.params.slug as string;
  const [row] = await db.select().from(locationsTable).where(eq(locationsTable.slug, slug));
  if (!row) { res.status(404).json({ error: "Location not found" }); return; }
  res.json(row);
});

// Nearby locations — GET /api/locations/:slug/nearby?limit=12
router.get("/locations/:slug/nearby", async (req, res): Promise<void> => {
  const slug = req.params.slug as string;
  const limit = Math.min(24, parseInt(String(req.query.limit ?? "12"), 10));

  const [loc] = await db.select().from(locationsTable).where(eq(locationsTable.slug, slug));
  if (!loc) { res.json([]); return; }

  // Prefer same district, fallback to same state
  const sameDistrictRows = loc.district
    ? await db
        .select({ slug: locationsTable.slug, city: locationsTable.city, town: locationsTable.town, village: locationsTable.village, district: locationsTable.district, state: locationsTable.state })
        .from(locationsTable)
        .where(and(eq(locationsTable.isActive, true), eq(locationsTable.district, loc.district), ne(locationsTable.slug, slug)))
        .limit(limit)
    : [];

  if (sameDistrictRows.length >= limit) { res.json(sameDistrictRows); return; }

  const needed = limit - sameDistrictRows.length;
  const existingSlugs = [slug, ...sameDistrictRows.map((r) => r.slug)];
  const stateRows = await db
    .select({ slug: locationsTable.slug, city: locationsTable.city, town: locationsTable.town, village: locationsTable.village, district: locationsTable.district, state: locationsTable.state })
    .from(locationsTable)
    .where(
      and(
        eq(locationsTable.isActive, true),
        eq(locationsTable.state, loc.state),
        sql`slug NOT IN (${sql.join(existingSlugs.map((s) => sql`${s}`), sql`, `)})`,
      ),
    )
    .limit(needed);

  res.json([...sameDistrictRows, ...stateRows]);
});

// Distinct states — GET /api/locations/states
router.get("/locations", async (req, res): Promise<void> => {
  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  const limit = Math.min(100, parseInt(String(req.query.limit ?? "50"), 10));

  const where = state
    ? and(eq(locationsTable.isActive, true), eq(locationsTable.state, state))
    : eq(locationsTable.isActive, true);

  const rows = await db
    .select({ slug: locationsTable.slug, city: locationsTable.city, town: locationsTable.town, district: locationsTable.district, state: locationsTable.state })
    .from(locationsTable)
    .where(where)
    .orderBy(desc(locationsTable.population))
    .limit(limit);

  res.json(rows);
});

// XML Sitemap — GET /api/sitemap.xml
router.get("/sitemap.xml", async (req, res): Promise<void> => {
  const locations = await db
    .select({ slug: locationsTable.slug })
    .from(locationsTable)
    .where(eq(locationsTable.isActive, true))
    .limit(50000);

  // Core service slugs (generated from service names)
  const serviceCategories = [
    "business-setup",
    "tax-compliance",
    "trademark-ip",
    "documentation",
    "fundraising",
    "ngo",
    "property-personal",
    "lawyers",
    "consult-expert",
  ];

  // Top services for pSEO combinations (subset to keep sitemap manageable)
  const topServiceSlugs = [
    "private-limited-company",
    "limited-liability-partnership",
    "gst-registration",
    "trademark-registration",
    "income-tax-return-filing",
    "fssai-registration-online",
    "msme-ssi-registration",
    "one-person-company",
    "sole-proprietorship",
    "gst-return-filing",
    "roc-annual-compliance",
    "accounting-bookkeeping",
    "digital-signature-certificate",
    "startup-india-registration",
    "ngo-registration",
    "copyright-registration",
    "patent-filing",
  ];

  const baseUrl = "https://vakil.co.in";
  const now = new Date().toISOString().split("T")[0];

  const staticUrls = [
    `${baseUrl}/`,
    ...serviceCategories.map((c) => `${baseUrl}/services/${c}`),
  ];

  const locationUrls = locations.flatMap((loc) =>
    topServiceSlugs.map((svc) => `${baseUrl}/${svc}/${loc.slug}`),
  );

  const allUrls = [...staticUrls, ...locationUrls];

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.send(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (url) => `  <url>
    <loc>${url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${url === `${baseUrl}/` ? "1.0" : url.includes("/services/") ? "0.8" : "0.7"}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`,
  );
});

export default router;

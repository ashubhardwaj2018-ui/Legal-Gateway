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

// ── All service slugs (mirrors services.ts toSlug output) ─────────────────────
const ALL_SERVICE_PAGES: Array<[string, string]> = [
  // consult-expert
  ["consult-expert","talk-to-a-lawyer"],["consult-expert","talk-to-a-ca"],["consult-expert","talk-to-a-cs"],["consult-expert","talk-to-an-iptrademark-lawyer"],
  // business-setup
  ["business-setup","private-limited-company"],["business-setup","limited-liability-partnership"],["business-setup","one-person-company"],["business-setup","sole-proprietorship"],["business-setup","nidhi-company"],["business-setup","producer-company"],["business-setup","partnership-firm"],["business-setup","startup-india-registration"],["business-setup","us-incorporation"],["business-setup","singapore-incorporation"],["business-setup","uk-incorporation"],["business-setup","netherlands-incorporation"],["business-setup","hong-kong-incorporation"],["business-setup","dubai-incorporation"],["business-setup","company-name-search"],["business-setup","business-name-generator"],["business-setup","digital-signature-certificate"],["business-setup","msmessi-registration"],["business-setup","iso-certification"],["business-setup","fssai-registration-online"],["business-setup","iec-importexport-code"],["business-setup","legal-metrology"],["business-setup","hallmark-registration"],["business-setup","bis-registration"],["business-setup","webe-commerce-website-development"],
  // tax-compliance
  ["tax-compliance","gst-registration"],["tax-compliance","gst-filing"],["tax-compliance","gst-advisory"],["tax-compliance","indirect-tax"],["tax-compliance","rodtep"],["tax-compliance","add-a-director"],["tax-compliance","remove-a-director"],["tax-compliance","increase-authorized-capital"],["tax-compliance","close-the-pvt-ltd-company"],["tax-compliance","change-objectiveactivity"],["tax-compliance","change-address"],["tax-compliance","change-company-name"],["tax-compliance","add-designated-partner"],["tax-compliance","changes-to-llp-agreement"],["tax-compliance","close-the-llp"],["tax-compliance","private-limited-company-opc-compliance"],["tax-compliance","limited-liability-partnership-compliance"],["tax-compliance","provident-fund-pf-registration"],["tax-compliance","esi-registration"],["tax-compliance","professional-tax-registration"],["tax-compliance","shops-and-establishments-license"],["tax-compliance","employee-stock-option-plan-esop"],["tax-compliance","posh-compliance"],["tax-compliance","accounting-and-book-keeping"],["tax-compliance","payroll-maintenance"],["tax-compliance","tds-return-filing"],["tax-compliance","individual-income-tax-filing"],["tax-compliance","proprietorship-tax-return-filing"],["tax-compliance","income-tax-notice"],["tax-compliance","proprietorship-to-pvt-ltd-company"],["tax-compliance","compliance-check-secretarial-audit"],["tax-compliance","due-diligence"],["tax-compliance","partnership-to-llp"],["tax-compliance","private-to-public-limited-company"],["tax-compliance","private-to-one-person-company"],["tax-compliance","rbi-compliance"],
  // trademark-ip
  ["trademark-ip","trademark-registration"],["trademark-ip","search-for-trademark"],["trademark-ip","respond-to-tm-objection"],["trademark-ip","well-known-trademark"],["trademark-ip","trademark-watch"],["trademark-ip","trademark-renewal"],["trademark-ip","trademark-assignment"],["trademark-ip","usa-trademark"],["trademark-ip","international-trademark"],["trademark-ip","logo-design"],["trademark-ip","copyright-registration"],["trademark-ip","indian-patent-search"],["trademark-ip","provisional-application"],["trademark-ip","permanent-patent"],["trademark-ip","copyright-infringement"],["trademark-ip","patent-infringement"],["trademark-ip","trademark-infringement"],["trademark-ip","design-registration"],
  // documentation
  ["documentation","non-disclosure-agreement-nda"],["documentation","service-level-agreement"],["documentation","franchise-agreement"],["documentation","master-service-agreement"],["documentation","shareholders-agreement"],["documentation","joint-venture-agreement"],["documentation","founders-agreement"],["documentation","vendor-agreement"],["documentation","consultancy-agreement"],["documentation","memorandum-of-understanding"],["documentation","make-a-will"],["documentation","power-of-attorney"],["documentation","terms-of-service"],["documentation","gdpr"],["documentation","disclaimer"],["documentation","scope-of-work-and-deliverables-agreement"],["documentation","rental-agreement"],["documentation","sale-deed"],["documentation","legal-notice"],["documentation","legal-notice-for-recovery-of-dues"],["documentation","cheque-bounce-notice"],["documentation","employment-agreement"],
  // fundraising
  ["fundraising","fundraising"],["fundraising","pitch-deck"],
  // ngo
  ["ngo","ngo"],["ngo","section-8-company"],["ngo","trust-registration"],["ngo","society-registration"],["ngo","ngo-compliance"],["ngo","section-8-compliance"],["ngo","csr-1-filing"],["ngo","sec80g-sec12a"],["ngo","darpan-registration"],
  // property-personal
  ["property-personal","property-title-verification"],["property-personal","property-registration"],["property-personal","name-change"],["property-personal","religion-change"],["property-personal","gender-change"],["property-personal","online-police-complaint"],["property-personal","marriage-registration"],["property-personal","court-marriage"],["property-personal","corporate-immigration"],["property-personal","family-immigration"],["property-personal","college-immigration"],["property-personal","online-consumer-complaint"],["property-personal","e-commerce-consumer-complaint"],["property-personal","insurance-consumer-complaint"],["property-personal","consumer-protection-act"],
  // lawyers
  ["lawyers","criminal-lawyer"],["lawyers","labour-lawyer"],["lawyers","consumer-court-lawyer"],["lawyers","divorce-lawyer"],["lawyers","banking-lawyer"],["lawyers","immigration-lawyer"],["lawyers","family-lawyer"],["lawyers","litigation-lawyer"],["lawyers","intellectual-property-lawyer"],["lawyers","trademark-lawyer"],["lawyers","technology-media-and-telecom-tmt"],["lawyers","risk-management-and-regulatory-risk"],
];

// Top service slugs used for pSEO city combinations in the sitemap
const PSEO_SERVICE_SLUGS = [
  "private-limited-company","limited-liability-partnership","gst-registration","trademark-registration",
  "individual-income-tax-filing","fssai-registration-online","msmessi-registration","one-person-company",
  "gst-filing","copyright-registration","startup-india-registration","ngo","trademark-renewal",
  "legal-notice","property-registration","marriage-registration","digital-signature-certificate",
  "tds-return-filing","accounting-and-book-keeping","rental-agreement","sole-proprietorship",
  "partnership-firm","name-change","gst-advisory","trademark-infringement",
];

const SERVICE_CATEGORY_IDS = [
  "business-setup","tax-compliance","trademark-ip","documentation",
  "fundraising","ngo","property-personal","lawyers","consult-expert",
];

const BASE_URL = "https://vakil.co.in";

// ── Sitemap index — GET /api/sitemap.xml ──────────────────────────────────────
// Returns a sitemap index pointing to sub-sitemaps, keeping each under 50k URLs.
router.get("/sitemap.xml", async (req, res): Promise<void> => {
  const now = new Date().toISOString().split("T")[0];
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host  = req.headers["x-forwarded-host"] ?? req.headers.host ?? "vakil.co.in";
  const apiBase = `${proto}://${host}/api`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.send(
    `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${apiBase}/sitemap-static.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${apiBase}/sitemap-pseo.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
</sitemapindex>`,
  );
});

// ── Static + service pages sitemap — GET /api/sitemap-static.xml ─────────────
router.get("/sitemap-static.xml", async (_req, res): Promise<void> => {
  const now = new Date().toISOString().split("T")[0];

  const staticUrls = [
    { url: `${BASE_URL}/`, priority: "1.0", freq: "daily" },
    { url: `${BASE_URL}/about`, priority: "0.8", freq: "weekly" },
    { url: `${BASE_URL}/contact`, priority: "0.8", freq: "monthly" },
    { url: `${BASE_URL}/blogs`, priority: "0.7", freq: "daily" },
    { url: `${BASE_URL}/privacy`, priority: "0.3", freq: "monthly" },
    { url: `${BASE_URL}/terms`, priority: "0.3", freq: "monthly" },
    // Service category pages
    ...SERVICE_CATEGORY_IDS.map(id => ({ url: `${BASE_URL}/services/${id}`, priority: "0.9", freq: "weekly" })),
    // All service detail pages
    ...ALL_SERVICE_PAGES.map(([catId, svcSlug]) => ({ url: `${BASE_URL}/services/${catId}/${svcSlug}`, priority: "0.8", freq: "weekly" })),
  ];

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.send(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
          http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${staticUrls.map(({ url, priority, freq }) =>
  `  <url>\n    <loc>${url}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
).join("\n")}
</urlset>`,
  );
});

// ── pSEO service × location sitemap — GET /api/sitemap-pseo.xml ──────────────
// Top 25 services × up to 2000 most-populated locations = up to 50k URLs
router.get("/sitemap-pseo.xml", async (_req, res): Promise<void> => {
  const now = new Date().toISOString().split("T")[0];

  const perService = Math.floor(50000 / PSEO_SERVICE_SLUGS.length); // ~2000 per service
  const locations = await db
    .select({ slug: locationsTable.slug })
    .from(locationsTable)
    .where(eq(locationsTable.isActive, true))
    .orderBy(desc(locationsTable.population))
    .limit(perService);

  const entries: string[] = [];
  for (const svcSlug of PSEO_SERVICE_SLUGS) {
    for (const loc of locations) {
      entries.push(
        `  <url>\n    <loc>${BASE_URL}/${svcSlug}/${loc.slug}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`,
      );
    }
  }

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.send(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
          http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${entries.join("\n")}
</urlset>`,
  );
});

export default router;

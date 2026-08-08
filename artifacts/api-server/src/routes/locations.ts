import { Router, type IRouter } from "express";
import { eq, ilike, or, and, ne, sql, desc, asc, count } from "drizzle-orm";
import { db, locationsTable, blogsTable, indianCompaniesTable } from "@workspace/db";

const router: IRouter = Router();

// ── All service pages — mirrors services.ts toSlug output ─────────────────────
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

// Unique service slugs (deduped)
const ALL_UNIQUE_SERVICE_SLUGS: string[] = [...new Set(ALL_SERVICE_PAGES.map(([, slug]) => slug))];

// Service category IDs for service-category pages
const SERVICE_CATEGORY_IDS = [
  "business-setup","tax-compliance","trademark-ip","documentation",
  "fundraising","ngo","property-personal","lawyers","consult-expert",
];

// Locations per pSEO sitemap file — ensures ≤ 50,000 URLs per file
const LOC_PER_PSEO_FILE = Math.max(1, Math.floor(50_000 / ALL_UNIQUE_SERVICE_SLUGS.length));

const BASE_URL = "https://legalfilingindia.com";

// ── Helpers ───────────────────────────────────────────────────────────────────
function xmlUrl(loc: string, lastmod: string, freq: string, priority: string): string {
  return `  <url>\n    <loc>${escXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}
function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── AJAX location search ──────────────────────────────────────────────────────
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

// ── Get location by slug ──────────────────────────────────────────────────────
router.get("/locations/:slug", async (req, res): Promise<void> => {
  const slug = req.params.slug as string;
  const [row] = await db.select().from(locationsTable).where(eq(locationsTable.slug, slug));
  if (!row) { res.status(404).json({ error: "Location not found" }); return; }
  res.json(row);
});

// ── Nearby locations ──────────────────────────────────────────────────────────
router.get("/locations/:slug/nearby", async (req, res): Promise<void> => {
  const slug = req.params.slug as string;
  const limit = Math.min(24, parseInt(String(req.query.limit ?? "12"), 10));

  const [loc] = await db.select().from(locationsTable).where(eq(locationsTable.slug, slug));
  if (!loc) { res.json([]); return; }

  const sameDistrictRows = loc.district
    ? await db
        .select({ slug: locationsTable.slug, city: locationsTable.city, town: locationsTable.town, village: locationsTable.village, district: locationsTable.district, state: locationsTable.state })
        .from(locationsTable)
        .where(and(eq(locationsTable.isActive, true), eq(locationsTable.district, loc.district), ne(locationsTable.slug, slug)))
        .orderBy(desc(locationsTable.population))
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
    .orderBy(desc(locationsTable.population))
    .limit(needed);

  res.json([...sameDistrictRows, ...stateRows]);
});

// ── All locations (optional filter by state) ──────────────────────────────────
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
    .orderBy(desc(locationsTable.population), asc(locationsTable.city))
    .limit(limit);

  res.json(rows);
});

// ── State hub: all locations in a state ──────────────────────────────────────
router.get("/locations/state/:state", async (req, res): Promise<void> => {
  const state = decodeURIComponent(req.params.state as string);
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(200, parseInt(String(req.query.limit ?? "100"), 10));
  const offset = (page - 1) * limit;

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(locationsTable)
    .where(and(eq(locationsTable.isActive, true), eq(locationsTable.state, state)));

  const rows = await db
    .select({
      id: locationsTable.id,
      slug: locationsTable.slug,
      city: locationsTable.city,
      town: locationsTable.town,
      village: locationsTable.village,
      district: locationsTable.district,
      state: locationsTable.state,
      pincode: locationsTable.pincode,
      population: locationsTable.population,
    })
    .from(locationsTable)
    .where(and(eq(locationsTable.isActive, true), eq(locationsTable.state, state)))
    .orderBy(desc(locationsTable.population), asc(locationsTable.city))
    .limit(limit)
    .offset(offset);

  if (rows.length === 0 && page === 1) {
    res.status(404).json({ error: "State not found or no locations in this state" });
    return;
  }

  res.json({ state, locations: rows, total: Number(total), page, limit });
});

// ── Distinct states list ──────────────────────────────────────────────────────
router.get("/location-states", async (_req, res): Promise<void> => {
  const rows = await db
    .selectDistinct({ state: locationsTable.state })
    .from(locationsTable)
    .where(eq(locationsTable.isActive, true))
    .orderBy(locationsTable.state);
  res.json(rows.map((r) => r.state));
});

// ── pSEO stats (public) ───────────────────────────────────────────────────────
router.get("/pseo-stats", async (_req, res): Promise<void> => {
  const [[{ value: locCount }], [{ value: priorityCount }]] = await Promise.all([
    db.select({ value: count() }).from(locationsTable).where(eq(locationsTable.isActive, true)),
    db.select({ value: count() }).from(locationsTable)
      .where(and(eq(locationsTable.isActive, true), eq(locationsTable.seoPriority, true))),
  ]);

  const totalLocations   = Number(locCount);
  const priorityLocations = Number(priorityCount);
  const totalServices    = ALL_UNIQUE_SERVICE_SLUGS.length;
  const totalUrls        = totalLocations * totalServices;
  const qualifiedUrls    = priorityLocations * totalServices;
  const pseoFiles        = Math.max(1, Math.ceil(priorityLocations / LOC_PER_PSEO_FILE));

  res.json({
    totalLocations,
    priorityLocations,
    totalServices,
    totalPseoUrls: totalUrls,
    qualifiedPseoUrls: qualifiedUrls,
    pseoSitemapFiles: pseoFiles,
    locationsPerFile: LOC_PER_PSEO_FILE,
    serviceCategories: SERVICE_CATEGORY_IDS.length,
    baseDomain: BASE_URL,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SITEMAPS
// ─────────────────────────────────────────────────────────────────────────────

// ── robots.txt ───────────────────────────────────────────────────────────────
router.get("/robots.txt", (req, res): void => {
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host  = req.headers["x-forwarded-host"] ?? req.headers.host ?? "legalfilingindia.com";
  const apiBase = `${proto}://${host}/api`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send(
`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/admin/
Disallow: /portal/

# Crawl-delay (optional — remove if pages rank well)
Crawl-delay: 1

# Sitemap index
Sitemap: ${apiBase}/sitemap.xml
`);
});

// Companies per sitemap file (Google's 50,000-URL limit)
const COMPANIES_PER_FILE = 50_000;

// ── Sitemap index builder (shared by /sitemap.xml and /sitemap-index.xml) ─────
async function buildSitemapIndex(req: import("express").Request): Promise<string> {
  const now = new Date().toISOString().split("T")[0];
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host  = req.headers["x-forwarded-host"] ?? req.headers.host ?? "legalfilingindia.com";
  const apiBase = `${proto}://${host}/api`;

  const [[{ value: priorityLocCount }], [{ value: coCount }]] = await Promise.all([
    // Only count SEO-priority locations for pSEO sitemaps
    db.select({ value: count() }).from(locationsTable)
      .where(and(eq(locationsTable.isActive, true), eq(locationsTable.seoPriority, true))),
    db.select({ value: count() }).from(indianCompaniesTable),
  ]);

  const numPseoFiles     = Math.max(1, Math.ceil(Number(priorityLocCount) / LOC_PER_PSEO_FILE));
  const numCompanyFiles  = Math.max(1, Math.ceil(Number(coCount)  / COMPANIES_PER_FILE));

  const entries: string[] = [
    `  <sitemap><loc>${apiBase}/sitemap-static.xml</loc><lastmod>${now}</lastmod></sitemap>`,
    `  <sitemap><loc>${apiBase}/sitemap-blogs.xml</loc><lastmod>${now}</lastmod></sitemap>`,
    ...Array.from({ length: numCompanyFiles }, (_, i) =>
      `  <sitemap><loc>${apiBase}/sitemap-companies-${i + 1}.xml</loc><lastmod>${now}</lastmod></sitemap>`
    ),
    ...Array.from({ length: numPseoFiles }, (_, i) =>
      `  <sitemap><loc>${apiBase}/sitemap-pseo-${i + 1}.xml</loc><lastmod>${now}</lastmod></sitemap>`
    ),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</sitemapindex>`;
}

// ── Sitemap index — two canonical URLs ───────────────────────────────────────
router.get("/sitemap.xml", async (req, res): Promise<void> => {
  const xml = await buildSitemapIndex(req);
  if (req.query.download !== undefined) {
    res.setHeader("Content-Disposition", 'attachment; filename="sitemap.xml"');
  }
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(xml);
});

router.get("/sitemap-index.xml", async (req, res): Promise<void> => {
  const xml = await buildSitemapIndex(req);
  if (req.query.download !== undefined) {
    res.setHeader("Content-Disposition", 'attachment; filename="sitemap-index.xml"');
  }
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(xml);
});

// ── Static + service pages sitemap ───────────────────────────────────────────
router.get("/sitemap-static.xml", async (req, res): Promise<void> => {
  const now = new Date().toISOString().split("T")[0];

  const staticUrls = [
    { url: `${BASE_URL}/`,          priority: "1.0", freq: "daily" },
    { url: `${BASE_URL}/about`,     priority: "0.8", freq: "monthly" },
    { url: `${BASE_URL}/contact`,   priority: "0.8", freq: "monthly" },
    { url: `${BASE_URL}/services`,  priority: "0.9", freq: "weekly"  },
    { url: `${BASE_URL}/lawyers`,   priority: "0.7", freq: "weekly"  },
    { url: `${BASE_URL}/blogs`,     priority: "0.7", freq: "daily"   },
    { url: `${BASE_URL}/companies`, priority: "0.6", freq: "weekly"  },
    // Service category pages
    ...SERVICE_CATEGORY_IDS.map((id) => ({
      url: `${BASE_URL}/services/${id}`, priority: "0.8", freq: "weekly",
    })),
    // Individual service pages
    ...ALL_SERVICE_PAGES.map(([catId, slug]) => ({
      url: `${BASE_URL}/services/${catId}/${slug}`, priority: "0.7", freq: "monthly",
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">\n${staticUrls.map(({ url, priority, freq }) => xmlUrl(url, now, freq, priority)).join("\n")}\n</urlset>`;
  if (req.query.download !== undefined) {
    res.setHeader("Content-Disposition", 'attachment; filename="sitemap-static.xml"');
  }
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(xml);
});

// ── Blogs sitemap ─────────────────────────────────────────────────────────────
router.get("/sitemap-blogs.xml", async (_req, res): Promise<void> => {
  const now = new Date().toISOString().split("T")[0];

  let blogUrls: string[] = [];
  try {
    const blogs = await db
      .select({ slug: blogsTable.slug, updatedAt: blogsTable.updatedAt })
      .from(blogsTable)
      .where(eq(blogsTable.status, "published"))
      .orderBy(desc(blogsTable.updatedAt))
      .limit(50_000);

    blogUrls = blogs.map((b) =>
      xmlUrl(`${BASE_URL}/blogs/${b.slug}`, (b.updatedAt ?? new Date()).toISOString().split("T")[0], "weekly", "0.6")
    );
  } catch { /* blogsTable may not have expected fields */ }

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${blogUrls.join("\n")}
</urlset>`);
});

// ── Companies sitemap — paginated (sitemap-companies-N.xml) ──────────────────
// Each file covers up to COMPANIES_PER_FILE slugs (≤ 50,000 per Google's limit)
router.get("/sitemap-companies-:page.xml", async (req, res): Promise<void> => {
  const page = parseInt(req.params.page as string, 10);
  if (isNaN(page) || page < 1) { res.status(404).send("Not found"); return; }

  const now    = new Date().toISOString().split("T")[0];
  const offset = (page - 1) * COMPANIES_PER_FILE;

  const companies = await db
    .select({ slug: indianCompaniesTable.slug })
    .from(indianCompaniesTable)
    .orderBy(indianCompaniesTable.id)
    .limit(COMPANIES_PER_FILE)
    .offset(offset);

  // Return an empty valid urlset (not 404) so Google doesn't report HTTP errors
  const compUrls = companies.map((c) =>
    xmlUrl(`${BASE_URL}/company/${c.slug}`, now, "monthly", "0.4")
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${compUrls.join("\n")}\n</urlset>`;
  if (req.query.download !== undefined) {
    res.setHeader("Content-Disposition", `attachment; filename="sitemap-companies-${page}.xml"`);
  }
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(xml);
});

// ── Legacy alias: sitemap-companies.xml — serve page 1 content directly ───────
// (No redirect — redirects confuse Google Search Console)
router.get("/sitemap-companies.xml", async (req, res): Promise<void> => {
  const now = new Date().toISOString().split("T")[0];
  const companies = await db
    .select({ slug: indianCompaniesTable.slug })
    .from(indianCompaniesTable)
    .orderBy(indianCompaniesTable.id)
    .limit(COMPANIES_PER_FILE);

  const compUrls = companies.map((c) =>
    xmlUrl(`${BASE_URL}/company/${c.slug}`, now, "monthly", "0.4")
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${compUrls.join("\n")}\n</urlset>`;
  if (req.query.download !== undefined) {
    res.setHeader("Content-Disposition", 'attachment; filename="sitemap-companies-1.xml"');
  }
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(xml);
});

// ── pSEO sitemap — page N (priority locations × SEO-enabled services only) ────
// IMPORTANT: Only seo_priority=true locations are included.
// This prevents 21.5M low-value URLs from entering the sitemap.
// Each file covers LOC_PER_PSEO_FILE priority locations × ALL services ≤ 50,000 URLs.
router.get("/sitemap-pseo-:page.xml", async (req, res): Promise<void> => {
  const page = parseInt(req.params.page as string, 10);
  if (isNaN(page) || page < 1) { res.status(404).send("Not found"); return; }

  const now = new Date().toISOString().split("T")[0];
  const offset = (page - 1) * LOC_PER_PSEO_FILE;

  // ONLY query seo_priority=true locations — critical SEO qualification gate
  const locations = await db
    .select({ slug: locationsTable.slug })
    .from(locationsTable)
    .where(and(eq(locationsTable.isActive, true), eq(locationsTable.seoPriority, true)))
    .orderBy(desc(locationsTable.population), asc(locationsTable.state), asc(locationsTable.slug))
    .limit(LOC_PER_PSEO_FILE)
    .offset(offset);

  // Return a valid empty urlset (never 404) — Google reports HTTP errors for non-200
  const entries: string[] = [];
  for (const loc of locations) {
    for (const svcSlug of ALL_UNIQUE_SERVICE_SLUGS) {
      entries.push(`  <url><loc>${escXml(`${BASE_URL}/${svcSlug}/${loc.slug}`)}</loc></url>`);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`;
  if (req.query.download !== undefined) {
    res.setHeader("Content-Disposition", `attachment; filename="sitemap-pseo-${page}.xml"`);
  }
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(xml);
});

export default router;

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

// Fallback city count used when seo_priority has not been seeded yet.
// If fewer than MIN_PRIORITY_THRESHOLD rows are marked seo_priority=true the
// sitemap falls back to the top-N locations by population so a missed seed
// never produces a 0-file sitemap.
const MIN_PRIORITY_THRESHOLD = 100;
const FALLBACK_PRIORITY_COUNT = 1560;

const BASE_URL = "https://legalfilingindia.com";

// ── Auto-seed guard ───────────────────────────────────────────────────────────
// When the seo_priority column has been dropped and re-added (e.g. after a
// publish that resets it to DEFAULT false), this function detects the unseeded
// state and immediately marks the top-FALLBACK_PRIORITY_COUNT active locations
// by population as seo_priority=true.  It is idempotent: a no-op once the DB
// is already seeded, so it is safe to call on every sitemap request.
// Consistent with the canonical SSR route (ssr.ts) which returns
// `noindex, follow` for seoPriority=false rows.
let _seedCheckPromise: Promise<void> | null = null;

async function ensurePrioritySeeded(): Promise<void> {
  // Reuse any in-flight check so concurrent requests don't all run the UPDATE
  if (_seedCheckPromise) return _seedCheckPromise;
  _seedCheckPromise = (async () => {
    try {
      const [{ value: seedCount }] = await db
        .select({ value: count() })
        .from(locationsTable)
        .where(and(eq(locationsTable.isActive, true), eq(locationsTable.seoPriority, true)));

      if (Number(seedCount) >= MIN_PRIORITY_THRESHOLD) return; // already seeded

      // Mark the top-N active locations by population as seo_priority=true so the
      // sitemap and canonical pages are consistent without requiring a manual step.
      await db.execute(
        sql`UPDATE locations
            SET    seo_priority = true
            WHERE  is_active = true
              AND  id IN (
                     SELECT id FROM locations
                     WHERE  is_active = true
                     ORDER  BY population DESC NULLS LAST, slug ASC
                     LIMIT  ${FALLBACK_PRIORITY_COUNT}
                   )`
      );
      console.log(`[sitemap] Auto-seeded seo_priority for top-${FALLBACK_PRIORITY_COUNT} locations by population.`);
    } finally {
      // Reset after a short delay so a future request re-checks (handles cold-start races)
      setTimeout(() => { _seedCheckPromise = null; }, 60_000);
    }
  })();
  return _seedCheckPromise;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function xmlUrl(loc: string, lastmod: string, freq: string, priority: string): string {
  return `  <url>\n    <loc>${escXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}
function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Stream an XML urlset response to the client chunk-by-chunk.
 *
 * The caller sets all HTTP headers (Content-Type, Cache-Control, etc.) before
 * calling this function, then provides a `generate` callback that writes URL
 * lines via the supplied `write` helper.  Batching writes per location (rather
 * than per URL) keeps syscall count reasonable while bounding peak memory to a
 * single location's worth of strings at a time.
 *
 * Why streaming instead of res.send(bigString):
 *  - Time-to-first-byte drops to ~milliseconds — Google's crawler sees a live
 *    response immediately instead of waiting for all ~50 k URLs to be assembled.
 *  - Peak RSS stays bounded — strings are GC-eligible as soon as each chunk is
 *    flushed to the socket, rather than the entire file sitting in one array.
 *  - Avoids request-timeout risk on cold-cache hits for the 427 npseo files.
 */
async function streamUrlset(
  res: import("express").Response,
  generate: (write: (chunk: string) => void) => void | Promise<void>,
): Promise<void> {
  res.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');
  await generate((chunk) => { res.write(chunk); });
  res.end('</urlset>');
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
  const [[{ value: locCount }], [{ value: priorityCount }], [{ value: coCount }]] = await Promise.all([
    db.select({ value: count() }).from(locationsTable).where(eq(locationsTable.isActive, true)),
    db.select({ value: count() }).from(locationsTable)
      .where(and(eq(locationsTable.isActive, true), eq(locationsTable.seoPriority, true))),
    db.select({ value: count() }).from(indianCompaniesTable),
  ]);

  const totalLocations    = Number(locCount);
  const priorityLocations = Number(priorityCount);
  const totalServices     = ALL_UNIQUE_SERVICE_SLUGS.length;
  const totalUrls         = totalLocations * totalServices;
  const qualifiedUrls     = priorityLocations * totalServices;
  const pseoFiles         = Math.max(1, Math.ceil(priorityLocations / LOC_PER_PSEO_FILE));
  const totalCompanies    = Number(coCount);
  const CO_PER_FILE       = 50_000;
  const companySitemapFiles = Math.max(1, Math.ceil(totalCompanies / CO_PER_FILE));

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
    totalCompanies,
    companySitemapFiles,
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
  // Seed seo_priority when needed — ensures sitemap and canonical pages agree
  await ensurePrioritySeeded();

  const now = new Date().toISOString().split("T")[0];
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host  = req.headers["x-forwarded-host"] ?? req.headers.host ?? "legalfilingindia.com";
  const apiBase = `${proto}://${host}/api`;

  const [[{ value: priorityLocCount }], [{ value: nonPriorityLocCount }], [{ value: coCount }]] = await Promise.all([
    // SEO-priority locations → indexed pSEO sitemaps
    db.select({ value: count() }).from(locationsTable)
      .where(and(eq(locationsTable.isActive, true), eq(locationsTable.seoPriority, true))),
    // Non-priority locations → noindex,follow pSEO sitemaps (crawlable but not indexed)
    db.select({ value: count() }).from(locationsTable)
      .where(and(eq(locationsTable.isActive, true), eq(locationsTable.seoPriority, false))),
    db.select({ value: count() }).from(indianCompaniesTable),
  ]);

  const numPseoFiles     = Math.max(1, Math.ceil(Number(priorityLocCount)    / LOC_PER_PSEO_FILE));
  const numNPseoFiles    = Math.max(0, Math.ceil(Number(nonPriorityLocCount) / LOC_PER_PSEO_FILE));
  const numCompanyFiles  = Math.max(1, Math.ceil(Number(coCount)             / COMPANIES_PER_FILE));

  const entries: string[] = [
    `  <sitemap><loc>${apiBase}/sitemap-static.xml</loc><lastmod>${now}</lastmod></sitemap>`,
    `  <sitemap><loc>${apiBase}/sitemap-blogs.xml</loc><lastmod>${now}</lastmod></sitemap>`,
    ...Array.from({ length: numCompanyFiles }, (_, i) =>
      `  <sitemap><loc>${apiBase}/sitemap-companies-${i + 1}.xml</loc><lastmod>${now}</lastmod></sitemap>`
    ),
    ...Array.from({ length: numPseoFiles }, (_, i) =>
      `  <sitemap><loc>${apiBase}/sitemap-pseo-${i + 1}.xml</loc><lastmod>${now}</lastmod></sitemap>`
    ),
    // Non-priority pSEO: noindex,follow — Google crawls but does not index
    ...Array.from({ length: numNPseoFiles }, (_, i) =>
      `  <sitemap><loc>${apiBase}/sitemap-npseo-${i + 1}.xml</loc><lastmod>${now}</lastmod></sitemap>`
    ),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</sitemapindex>`;
}

// ── Sitemap index — two canonical URLs ───────────────────────────────────────
router.get("/sitemap.xml", async (req, res): Promise<void> => {
  // Dev/test only: ?_force_seed_check=1 resets the in-memory seed cache so the
  // next buildSitemapIndex call re-evaluates the DB state immediately.
  // Never active in production (NODE_ENV=production ignores this param).
  if (process.env.NODE_ENV !== "production" && req.query._force_seed_check === "1") {
    _seedCheckPromise = null;
  }
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

// ── Sitemap All JSON — machine-readable index of every sitemap file ───────────
router.get("/sitemap-all.json", async (req, res): Promise<void> => {
  await ensurePrioritySeeded();

  const proto   = req.headers["x-forwarded-proto"]  ?? "https";
  const host    = req.headers["x-forwarded-host"]   ?? req.headers.host ?? "legalfilingindia.com";
  const apiBase = `${proto}://${host}/api`;

  const [[{ value: priorityCount }], [{ value: nonPriorityCount }], [{ value: coCount }]] = await Promise.all([
    db.select({ value: count() }).from(locationsTable)
      .where(and(eq(locationsTable.isActive, true), eq(locationsTable.seoPriority, true))),
    db.select({ value: count() }).from(locationsTable)
      .where(and(eq(locationsTable.isActive, true), eq(locationsTable.seoPriority, false))),
    db.select({ value: count() }).from(indianCompaniesTable),
  ]);

  const numPseoFiles    = Math.max(1, Math.ceil(Number(priorityCount)    / LOC_PER_PSEO_FILE));
  const numNPseoFiles   = Math.max(0, Math.ceil(Number(nonPriorityCount) / LOC_PER_PSEO_FILE));
  const numCompanyFiles = Math.max(1, Math.ceil(Number(coCount)          / COMPANIES_PER_FILE));

  const totalFiles =
    2 /* static + blogs */ +
    numCompanyFiles +
    numPseoFiles +
    numNPseoFiles;

  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({
    generated: new Date().toISOString(),
    totalFiles,
    sitemaps: {
      index:            [`${apiBase}/sitemap-index.xml`],
      static:           [`${apiBase}/sitemap-static.xml`],
      blogs:            [`${apiBase}/sitemap-blogs.xml`],
      companies:        Array.from({ length: numCompanyFiles },  (_, i) => `${apiBase}/sitemap-companies-${i + 1}.xml`),
      pseo_priority:    Array.from({ length: numPseoFiles },     (_, i) => `${apiBase}/sitemap-pseo-${i + 1}.xml`),
      pseo_nonpriority: Array.from({ length: numNPseoFiles },    (_, i) => `${apiBase}/sitemap-npseo-${i + 1}.xml`),
    },
    counts: {
      priorityLocations:    Number(priorityCount),
      nonPriorityLocations: Number(nonPriorityCount),
      companies:            Number(coCount),
    },
  });
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
// Each file covers up to COMPANIES_PER_FILE slugs (≤ 50,000 per Google's limit).
// Streamed: writes one URL line per company as soon as the DB row is available,
// so peak memory stays at one batch of rows rather than 50k assembled strings.
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

  if (req.query.download !== undefined) {
    res.setHeader("Content-Disposition", `attachment; filename="sitemap-companies-${page}.xml"`);
  }
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  await streamUrlset(res, (write) => {
    for (const c of companies) {
      write(xmlUrl(`${BASE_URL}/company/${c.slug}`, now, "monthly", "0.4") + "\n");
    }
  });
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

  if (req.query.download !== undefined) {
    res.setHeader("Content-Disposition", 'attachment; filename="sitemap-companies-1.xml"');
  }
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  await streamUrlset(res, (write) => {
    for (const c of companies) {
      write(xmlUrl(`${BASE_URL}/company/${c.slug}`, now, "monthly", "0.4") + "\n");
    }
  });
});

// ── pSEO sitemap — page N (priority locations × SEO-enabled services only) ────
// IMPORTANT: Only seo_priority=true locations are included.
// This prevents 21.5M low-value URLs from entering the sitemap.
// Each file covers LOC_PER_PSEO_FILE priority locations × ALL services ≤ 50,000 URLs.
// ensurePrioritySeeded() is called first so the DB is always seeded before
// the query runs — guaranteeing sitemap and canonical pages agree on indexability.
// Streamed: one chunk per location (~143 URL lines) for bounded peak memory.
router.get("/sitemap-pseo-:page.xml", async (req, res): Promise<void> => {
  const page = parseInt(req.params.page as string, 10);
  if (isNaN(page) || page < 1) { res.status(404).send("Not found"); return; }

  // Auto-seed if needed so seo_priority=true rows exist and canonical pages
  // return `index, follow` for the same locations we're about to serve.
  await ensurePrioritySeeded();

  const now    = new Date().toISOString().split("T")[0];
  const offset = (page - 1) * LOC_PER_PSEO_FILE;

  // ONLY query seo_priority=true locations — critical SEO qualification gate
  const locations = await db
    .select({ slug: locationsTable.slug })
    .from(locationsTable)
    .where(and(eq(locationsTable.isActive, true), eq(locationsTable.seoPriority, true)))
    .orderBy(desc(locationsTable.population), asc(locationsTable.state), asc(locationsTable.slug))
    .limit(LOC_PER_PSEO_FILE)
    .offset(offset);

  if (req.query.download !== undefined) {
    res.setHeader("Content-Disposition", `attachment; filename="sitemap-pseo-${page}.xml"`);
  }
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  // Stream one location's URLs at a time — ~143 lines per write() call
  await streamUrlset(res, (write) => {
    for (const loc of locations) {
      const chunk = ALL_UNIQUE_SERVICE_SLUGS
        .map((svcSlug) => `  <url><loc>${escXml(`${BASE_URL}/${svcSlug}/${loc.slug}`)}</loc></url>`)
        .join("\n") + "\n";
      write(chunk);
    }
  });
});

// ── Non-priority pSEO sitemap — page N (noindex,follow locations) ─────────────
// Google crawls these pages (follows links) but does not index them.
// Same density as priority sitemaps: LOC_PER_PSEO_FILE locations × all services.
// seo_priority = false locations only — priority locations are in sitemap-pseo-N.xml.
// Streamed: one chunk per location (~143 URL lines) so peak memory stays bounded
// regardless of file size — critical for cold-cache hits across 427 npseo files.
router.get("/sitemap-npseo-:page.xml", async (req, res): Promise<void> => {
  const page = parseInt(req.params.page as string, 10);
  if (isNaN(page) || page < 1) { res.status(404).send("Not found"); return; }

  const now    = new Date().toISOString().split("T")[0];
  const offset = (page - 1) * LOC_PER_PSEO_FILE;

  const locations = await db
    .select({ slug: locationsTable.slug })
    .from(locationsTable)
    .where(and(eq(locationsTable.isActive, true), eq(locationsTable.seoPriority, false)))
    .orderBy(desc(locationsTable.population), asc(locationsTable.state), asc(locationsTable.slug))
    .limit(LOC_PER_PSEO_FILE)
    .offset(offset);

  if (req.query.download !== undefined) {
    res.setHeader("Content-Disposition", `attachment; filename="sitemap-npseo-${page}.xml"`);
  }
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  // Stream one location's URLs at a time — ~143 lines per write() call
  await streamUrlset(res, (write) => {
    for (const loc of locations) {
      const chunk = ALL_UNIQUE_SERVICE_SLUGS
        .map((svcSlug) => `  <url><loc>${escXml(`${BASE_URL}/${svcSlug}/${loc.slug}`)}</loc></url>`)
        .join("\n") + "\n";
      write(chunk);
    }
  });
});

export default router;

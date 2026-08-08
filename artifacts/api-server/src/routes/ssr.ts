/**
 * Server-Side Render (SSR) prerender endpoint.
 *
 * GET /api/ssr/:serviceSlug/:locationSlug
 *
 * Returns a complete, SEO-optimised HTML page for any pSEO URL.
 * Search-engine crawlers routed here via Nginx receive full SEO content
 * (title, JSON-LD, H1, FAQs, internal links) in the initial response.
 * Regular users still get the React SPA.
 *
 * Full Nginx config lives at: deploy/nginx/legalfilingindia.conf
 *
 * Key snippet (map{} at http context; locations inside server block):
 *
 *   map $http_user_agent $is_seo_bot {
 *     default 0;
 *     ~*(Googlebot|bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Sogou|facebot|ia_archiver) 1;
 *   }
 *   location /api/ {
 *     proxy_pass http://127.0.0.1:8080;   # bare proxy_pass required in prefix locations
 *   }
 *   location ~* "^/([a-z0-9-]+)/([a-z0-9-]+)$" {
 *     if ($is_seo_bot) {
 *       rewrite ^/([a-z0-9-]+)/([a-z0-9-]+)$ /api/ssr/$1/$2 last;
 *     }
 *     try_files $uri /index.html;
 *   }
 *
 * The rewrite restarts Nginx location matching so the /api/ prefix location
 * (with its bare proxy_pass) handles the proxying — proxy_pass with a URI
 * path component is invalid inside regex locations and if blocks.
 *
 * Cache-Control: public, max-age=3600, stale-while-revalidate=86400
 * is set by this handler and passes through Nginx to the crawler.
 */

import { Router, type IRouter } from "express";
import { eq, desc, asc, and } from "drizzle-orm";
import { db, locationsTable } from "@workspace/db";
import {
  getSvc,
  getSvcsByCategory,
  POPULAR_CROSS_CATEGORY,
  PROFESSIONAL_SLUGS,
  type SvcInfo,
} from "../lib/service-map";

const router: IRouter = Router();

const BASE = "https://legalfilingindia.com";
const FIRM = "Legal Filing India";

// ── Deterministic seeded pick ─────────────────────────────────────────────────
function stableHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pick<T>(arr: T[], seed: string): T {
  return arr[stableHash(seed) % arr.length];
}

// ── Location name helper ──────────────────────────────────────────────────────
function primaryPlace(loc: {
  city?: string | null; town?: string | null;
  village?: string | null; district?: string | null; state: string;
}): string {
  return loc.city || loc.town || loc.village || loc.district || loc.state;
}

// ── HTML escape ───────────────────────────────────────────────────────────────
function h(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function esc(s: string): string { return h(s); }

// ── SEO content generators ────────────────────────────────────────────────────
function genTitle(svc: SvcInfo, city: string, state: string, seed: string): string {
  return pick([
    `${svc.name} in ${city} | Expert Legal Services | ${FIRM}`,
    `${svc.name} in ${city}, ${state} | ${FIRM} – India's Trusted Filing Platform`,
    `Best ${svc.name} in ${city} | Affordable CA & Legal Services`,
  ], seed + "-title");
}

function genDesc(svc: SvcInfo, city: string, state: string, seed: string): string {
  return pick([
    `Professional ${svc.name} in ${city}, ${state}. Expert CAs, CSs & Advocates. Transparent pricing at ${svc.price}. Fast turnaround. Book free consultation.`,
    `Get ${svc.name} in ${city} from certified professionals. ${FIRM} offers end-to-end compliance support across ${state}. Starting at ${svc.price}.`,
    `Trusted ${svc.name} services in ${city}, ${state}. 10,000+ satisfied clients. Affordable fees from ${svc.price}. Contact us for a free assessment today.`,
  ], seed + "-desc");
}

function genIntro(svc: SvcInfo, city: string, state: string, district: string, seed: string): string {
  return pick([
    `Looking for ${svc.name} in ${city}? ${FIRM} provides professional ${svc.name} services throughout ${city}, ${state}. Our experienced team of Chartered Accountants, Company Secretaries, and Advocates handle everything end-to-end — so you focus on your business while we handle the compliance.`,
    `${FIRM} offers trusted ${svc.name} services in ${city}, ${state}. With a dedicated team of legal and compliance experts serving clients across ${district}, we make regulatory requirements simple, affordable, and stress-free.`,
    `Get reliable ${svc.name} in ${city} with ${FIRM}. We have helped thousands of businesses and individuals across ${state} with legal, tax, and compliance needs. Our transparent pricing ensures zero surprises from start to finish.`,
    `${svc.name} in ${city} is now faster and more affordable with ${FIRM}. Our network of experienced professionals across ${district} specialises in end-to-end service with guaranteed compliance and dedicated support.`,
  ], seed + "-intro");
}

function genFaqs(svc: SvcInfo, city: string, state: string, district: string): Array<{ q: string; a: string }> {
  return [
    { q: `How long does ${svc.name} take in ${city}?`, a: `The typical timeline for ${svc.name} in ${city} is 7–15 working days depending on government processing times. Our team works proactively to minimise delays.` },
    { q: `What is the cost of ${svc.name} in ${city}?`, a: `Our all-inclusive fee for ${svc.name} in ${city} starts at ${svc.price}. This covers professional fees, government fees, and all filings. No hidden charges.` },
    { q: `Can I get ${svc.name} done online in ${city}?`, a: `Yes, the entire process is 100% online. You submit documents digitally and we handle all government filings with real-time status updates.` },
    { q: `Do I need to visit any government office in ${city}?`, a: `In most cases no physical visit is required. Our experts handle all government submissions online on your behalf.` },
    { q: `Is ${svc.name} mandatory for businesses in ${state}?`, a: `Depending on your business type and turnover, ${svc.name} may be mandatory under applicable laws in ${district}. Our consultants can assess your specific situation.` },
  ];
}

// ── JSON-LD builders ──────────────────────────────────────────────────────────
function buildJsonLd(
  svc: SvcInfo,
  loc: { slug: string; state: string; city?: string | null; district?: string | null; pincode?: string | null },
  faqs: Array<{ q: string; a: string }>,
): object[] {
  const city = primaryPlace(loc);
  const pageUrl = `${BASE}/${svc.slug}/${loc.slug}`;

  return [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BASE },
        { "@type": "ListItem", position: 2, name: svc.categoryTitle, item: `${BASE}/services/${svc.categoryId}` },
        { "@type": "ListItem", position: 3, name: svc.name, item: `${BASE}/services/${svc.categoryId}/${svc.slug}` },
        { "@type": "ListItem", position: 4, name: city, item: pageUrl },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: `${svc.name} in ${city}`,
      description: `Professional ${svc.name} services in ${city}, ${loc.state}`,
      provider: { "@type": "Organization", name: FIRM, url: BASE },
      areaServed: { "@type": "City", name: city, containedInPlace: { "@type": "State", name: loc.state } },
      offers: { "@type": "Offer", price: svc.price.replace(/[₹,]/g, ""), priceCurrency: "INR" },
      url: pageUrl,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "LegalService",
      "@id": `${pageUrl}#local`,
      name: `${FIRM} — ${svc.name} in ${city}`,
      url: pageUrl,
      telephone: "+91-1800-123-4567",
      priceRange: svc.price,
      openingHours: "Mo-Sa 09:00-19:00",
      address: {
        "@type": "PostalAddress",
        addressLocality: city,
        addressRegion: loc.state,
        addressCountry: "IN",
        ...(loc.pincode ? { postalCode: loc.pincode } : {}),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${BASE}/#org`,
      name: FIRM,
      url: BASE,
      telephone: "+91-1800-123-4567",
    },
  ];
}

// ── Full HTML template ────────────────────────────────────────────────────────
function buildHtml(o: {
  title: string; description: string; canonical: string; keywords: string;
  robotsMeta: string;
  city: string; state: string; district: string; stateSlug: string;
  svc: SvcInfo; locationSlug: string; intro: string;
  faqs: Array<{ q: string; a: string }>;
  relatedSameCategory: SvcInfo[];
  popularServices: SvcInfo[];
  professionals: SvcInfo[];
  nearbyLocations: Array<{ slug: string; city?: string | null; town?: string | null; village?: string | null; district?: string | null; state: string }>;
  jsonLds: object[];
}): string {
  const { title, description, canonical, keywords, robotsMeta, city, state, stateSlug,
    svc, locationSlug, intro, faqs,
    relatedSameCategory, popularServices, professionals, nearbyLocations, jsonLds } = o;

  const ldTags = jsonLds.map((ld) => `  <script type="application/ld+json">${JSON.stringify(ld)}</script>`).join("\n");

  const breadcrumb = `<nav aria-label="Breadcrumb" style="margin-bottom:12px">
  <ol itemscope itemtype="https://schema.org/BreadcrumbList" style="list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:4px 8px;font-size:13px;color:#666">
    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><a itemprop="item" href="${esc(BASE)}"><span itemprop="name">Home</span></a><meta itemprop="position" content="1"/></li>
    <li aria-hidden="true">›</li>
    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><a itemprop="item" href="${esc(`${BASE}/services/${svc.categoryId}`)}"><span itemprop="name">${h(svc.categoryTitle)}</span></a><meta itemprop="position" content="2"/></li>
    <li aria-hidden="true">›</li>
    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><a itemprop="item" href="${esc(`${BASE}/services/${svc.categoryId}/${svc.slug}`)}"><span itemprop="name">${h(svc.name)}</span></a><meta itemprop="position" content="3"/></li>
    <li aria-hidden="true">›</li>
    <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><span itemprop="name">${h(city)}</span><meta itemprop="position" content="4"/></li>
  </ol>
</nav>`;

  const mkLinks = (items: SvcInfo[], href: (s: SvcInfo) => string, label: (s: SvcInfo) => string) =>
    `<ul>\n${items.map((s) => `  <li><a href="${esc(href(s))}">${h(label(s))}</a> — <small>${h(s.price)}</small></li>`).join("\n")}\n</ul>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${h(title)}</title>
  <meta name="description" content="${h(description)}"/>
  <meta name="keywords" content="${h(keywords)}"/>
  <meta name="robots" content="${h(robotsMeta)}"/>
  <link rel="canonical" href="${esc(canonical)}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:title" content="${h(title)}"/>
  <meta property="og:description" content="${h(description)}"/>
  <meta property="og:url" content="${esc(canonical)}"/>
  <meta property="og:site_name" content="${h(FIRM)}"/>
  <meta name="twitter:card" content="summary"/>
  <meta name="twitter:title" content="${h(title)}"/>
  <meta name="twitter:description" content="${h(description)}"/>
${ldTags}
  <style>
    *{box-sizing:border-box}body{font-family:system-ui,Arial,sans-serif;max-width:960px;margin:0 auto;padding:16px 24px;color:#1a1a1a;line-height:1.65}
    h1{font-size:2rem;margin:.5rem 0 .25rem;color:#0f2044}h2{font-size:1.2rem;margin-top:2rem;margin-bottom:.5rem;color:#0f2044}
    a{color:#0f2044}a:hover{color:#c9a227}ul{padding-left:1.25rem}li{margin:.3rem 0}
    .price{background:#c9a227;color:#0f2044;font-weight:700;padding:4px 14px;border-radius:6px;font-size:1.4rem;display:inline-block;margin:.5rem 0}
    .meta{display:flex;flex-wrap:wrap;gap:12px;font-size:.85rem;color:#555;margin:.5rem 0 1.5rem}
    .cta{background:#0f2044;color:#fff;padding:20px 24px;border-radius:12px;text-align:center;margin:2rem 0}
    .cta a{color:#c9a227;font-weight:700;font-size:1.05rem}
    details{border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin:.4rem 0}summary{cursor:pointer;font-weight:600}
    footer{margin-top:3rem;padding-top:1rem;border-top:1px solid #e5e7eb;font-size:.8rem;color:#999}
    footer a{color:#666}
  </style>
</head>
<body>
${breadcrumb}
<h1>${h(`${svc.name} in ${city}`)}</h1>
<div class="price">${h(svc.price)}</div>
<div class="meta">
  <span>📍 ${h(city)}, ${h(state)}</span>
  <span>⏱ 7–15 working days</span>
  <span>✅ 100% online process</span>
  <span>🔒 Legally compliant</span>
</div>
<p>${h(intro)}</p>

<div class="cta">
  <p>Get expert ${h(svc.name)} in ${h(city)} — transparent pricing, fast turnaround.</p>
  <a href="${esc(BASE)}/contact">📞 Book Free Consultation with an Expert</a>
</div>

${relatedSameCategory.length > 0 ? `<h2>Other ${h(svc.categoryTitle)} Services in ${h(city)}</h2>
${mkLinks(relatedSameCategory, (s) => `${BASE}/${s.slug}/${locationSlug}`, (s) => `${s.name} in ${city}`)}` : ""}

${popularServices.length > 0 ? `<h2>Popular Legal Services in ${h(city)}</h2>
${mkLinks(popularServices, (s) => `${BASE}/${s.slug}/${locationSlug}`, (s) => `${s.name} in ${city}`)}` : ""}

${professionals.length > 0 ? `<h2>Talk to a Professional in ${h(city)}</h2>
${mkLinks(professionals, (s) => `${BASE}/${s.slug}/${locationSlug}`, (s) => s.name)}` : ""}

${nearbyLocations.length > 0 ? `<h2>${h(svc.name)} in Nearby Areas</h2>
<ul>
${nearbyLocations.slice(0, 14).map((n) => {
  const nc = primaryPlace(n);
  return `  <li><a href="${esc(`${BASE}/${svc.slug}/${n.slug}`)}">${h(svc.name)} in ${h(nc)}</a></li>`;
}).join("\n")}
</ul>
<p><a href="${esc(`${BASE}/state/${stateSlug}`)}">→ View all cities in ${h(state)}</a></p>` : ""}

${faqs.length > 0 ? `<h2>Frequently Asked Questions</h2>
${faqs.map((f) => `<details><summary>${h(f.q)}</summary><p>${h(f.a)}</p></details>`).join("\n")}` : ""}

<h2>About ${h(FIRM)}</h2>
<p>${h(FIRM)} is India's trusted legal and compliance platform serving businesses and individuals across ${h(state)} with expert ${h(svc.name.toLowerCase())} services, transparent pricing, and dedicated support.</p>
<ul>
  <li><a href="${esc(BASE)}">Home — ${h(FIRM)}</a></li>
  <li><a href="${esc(`${BASE}/services/${svc.categoryId}`)}">All ${h(svc.categoryTitle)} Services</a></li>
  <li><a href="${esc(`${BASE}/services/${svc.categoryId}/${svc.slug}`)}">${h(svc.name)} — National Hub</a></li>
  <li><a href="${esc(`${BASE}/state/${stateSlug}`)}">Legal Services in ${h(state)}</a></li>
  <li><a href="${esc(`${BASE}/companies`)}">Indian Companies Database</a></li>
  <li><a href="${esc(`${BASE}/blogs`)}">Legal Blog</a></li>
</ul>

<footer>
  <p>${h(FIRM)} · <a href="${esc(BASE)}">${h(BASE)}</a> · 📞 +91-1800-123-4567</p>
  <p>Services available across India. <a href="${esc(`${BASE}/services`)}">All Services</a> · <a href="${esc(`${BASE}/contact`)}">Contact Us</a></p>
</footer>
</body>
</html>`;
}

// ── Main SSR route ─────────────────────────────────────────────────────────────
router.get("/ssr/:serviceSlug/:locationSlug", async (req, res): Promise<void> => {
  const { serviceSlug, locationSlug } = req.params as { serviceSlug: string; locationSlug: string };

  const svc = getSvc(serviceSlug);
  if (!svc) {
    res.status(404).type("html").send(
      `<!DOCTYPE html><html><head><title>Not Found</title><meta name="robots" content="noindex"/></head><body><h1>Service not found</h1><a href="${BASE}">Return Home</a></body></html>`
    );
    return;
  }

  const [locRow] = await db
    .select()
    .from(locationsTable)
    .where(eq(locationsTable.slug, locationSlug))
    .limit(1);

  if (!locRow) {
    res.status(404).type("html").send(
      `<!DOCTYPE html><html><head><title>Not Found</title><meta name="robots" content="noindex"/></head><body><h1>Location not found</h1><a href="${BASE}">Return Home</a></body></html>`
    );
    return;
  }

  // SEO qualification: only priority locations get index,follow
  // Non-priority pages remain accessible but tell Google not to index them
  const robotsMeta = locRow.seoPriority ? "index, follow" : "noindex, follow";

  const city     = primaryPlace(locRow);
  const state    = locRow.state;
  const district = locRow.district || state;
  const seed     = `${serviceSlug}-${locationSlug}`;
  const canonical = `${BASE}/${serviceSlug}/${locationSlug}`;
  const stateSlug = state.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  // Nearby locations (same state, ordered by population)
  const nearbyLocations = await db
    .select({ slug: locationsTable.slug, city: locationsTable.city, town: locationsTable.town,
      village: locationsTable.village, district: locationsTable.district, state: locationsTable.state })
    .from(locationsTable)
    .where(and(eq(locationsTable.isActive, true), eq(locationsTable.state, state)))
    .orderBy(desc(locationsTable.population), asc(locationsTable.slug))
    .limit(16);

  const relatedSameCategory = getSvcsByCategory(svc.categoryId)
    .filter((s) => s.slug !== serviceSlug)
    .slice(0, 6);

  const popularServices = POPULAR_CROSS_CATEGORY
    .filter((sl) => sl !== serviceSlug)
    .map((sl) => getSvc(sl))
    .filter((s): s is SvcInfo => !!s && s.categoryId !== svc.categoryId)
    .slice(0, 5);

  const professionals = PROFESSIONAL_SLUGS
    .filter((sl) => sl !== serviceSlug)
    .map((sl) => getSvc(sl))
    .filter((s): s is SvcInfo => !!s)
    .slice(0, 4);

  const title       = genTitle(svc, city, state, seed);
  const description = genDesc(svc, city, state, seed);
  const intro       = genIntro(svc, city, state, district, seed);
  const faqs        = genFaqs(svc, city, state, district);
  const keywords    = [`${svc.name} in ${city}`, `${svc.name} ${city}`, `${svc.name} ${state}`, svc.name, `${city} legal services`].join(", ");
  const jsonLds     = buildJsonLd(svc, { ...locRow, slug: locationSlug }, faqs);

  const html = buildHtml({
    title, description, canonical, keywords,
    city, state, district, stateSlug,
    robotsMeta,
    svc, locationSlug, intro, faqs,
    relatedSameCategory, popularServices, professionals,
    nearbyLocations: nearbyLocations.filter((n) => n.slug !== locationSlug),
    jsonLds,
  });

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  res.send(html);
});

// ── Usage info ─────────────────────────────────────────────────────────────────
router.get("/ssr", (_req, res): void => {
  res.json({
    endpoint: "GET /api/ssr/:serviceSlug/:locationSlug",
    example: "/api/ssr/private-limited-company/abbarajupalem-andhra-pradesh",
    description: "Returns complete SEO-optimised HTML for pSEO pages. Use this with Nginx to serve bot crawlers.",
    configFile: "deploy/nginx/legalfilingindia.conf (in repo root)",
    nginxConfig: `# Additive changes to /etc/nginx/conf.d/legalfilingindia.conf
# Full file lives at deploy/nginx/legalfilingindia.conf in the repo.
#
# 1. Add TWO map{} blocks at the TOP of the file (http{} context level,
#    before the server{} blocks):
#
map $http_user_agent $is_seo_bot {
    default                                                                          0;
    ~*(Googlebot|bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Sogou|facebot|ia_archiver) 1;
}

# Reserved first-path-segments that must NOT be SSR-routed:
#   /blog/:slug, /company/:slug, /state/:stateSlug, /portal/dashboard,
#   /services/:id, /public/…, /admin/…
map $uri $is_reserved_prefix {
    default       0;
    ~^/blog/      1;
    ~^/company/   1;
    ~^/state/     1;
    ~^/portal/    1;
    ~^/services/  1;
    ~^/public/    1;
    ~^/admin/     1;
}

# 2. Add this location block inside the https server{} block, AFTER the
#    /api/ and static-asset locations but BEFORE the catch-all location /:
#
# $is_seo_bot$is_reserved_prefix = "10" means: bot AND not a reserved route.
# Comparing the concatenated string is the standard Nginx AND-logic pattern.
# proxy_pass with a URI is invalid in regex locations / if blocks;
# rewrite + last is the correct alternative (Nginx restarts matching and
# the /api/ prefix location proxies the rewritten /api/ssr/… URL to Express).
#
location ~* "^/([a-z0-9-]+)/([a-z0-9-]+)$" {
    if ($is_seo_bot$is_reserved_prefix = "10") {
        rewrite ^/([a-z0-9-]+)/([a-z0-9-]+)$ /api/ssr/$1/$2 last;
    }
    root  /var/www/legalfilingindia/artifacts/lawfirm/dist/public;
    try_files $uri /index.html;
}`,
    deployInstructions: [
      "1. Copy deploy/nginx/legalfilingindia.conf from the repo to /etc/nginx/conf.d/ on the VPS",
      "2. Run: nginx -t   (to validate config syntax)",
      "3. Run: systemctl reload nginx",
      "4. Verify bot routing: curl -A 'Googlebot' https://legalfilingindia.com/gst-registration/delhi-dl",
      "5. Verify human routing: curl https://legalfilingindia.com/gst-registration/delhi-dl  (should return React shell)",
    ],
  });
});

export default router;

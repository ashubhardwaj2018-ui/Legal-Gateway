#!/usr/bin/env node
/**
 * generate-sitemap-index.mjs
 *
 * Generates artifacts/lawfirm/public/sitemap.xml — the static sitemap index
 * served directly by the web server at https://legalfilingindia.com/sitemap.xml
 *
 * Run after any change to priority location count or company count:
 *   node scripts/generate-sitemap-index.mjs
 *
 * Or add to the build pipeline:
 *   "prebuild": "node ../../scripts/generate-sitemap-index.mjs"
 */

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../artifacts/lawfirm/public/sitemap.xml");
const BASE = "https://legalfilingindia.com";

// Query the DB for current counts
function queryDB(sql) {
  const result = execSync(
    `psql "$DATABASE_URL" -t -A -c "${sql.replace(/"/g, '\\"')}"`,
    { encoding: "utf8" }
  ).trim();
  return parseInt(result, 10);
}

const priorityLocs   = queryDB("SELECT COUNT(*) FROM locations WHERE seo_priority=true AND is_active=true");
const totalCompanies = queryDB("SELECT COUNT(*) FROM indian_companies");

const LOC_PER_FILE      = 349;  // floor(50000 / 143 services)
const COMPANIES_PER_FILE = 50_000;

const numPseoFiles     = Math.max(1, Math.ceil(priorityLocs   / LOC_PER_FILE));
const numCompanyFiles  = Math.max(1, Math.ceil(totalCompanies / COMPANIES_PER_FILE));
const today            = new Date().toISOString().split("T")[0];

const lines = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<!--`,
  `  Static sitemap index for legalfilingindia.com`,
  `  Served directly by the web server at /sitemap.xml`,
  `  Child sitemaps are generated dynamically by the API server at /api/sitemap-*.xml`,
  ``,
  `  Last generated: ${today}`,
  `  Priority locations: ${priorityLocs}  → ${numPseoFiles} pSEO sitemap files`,
  `  Companies:         ${totalCompanies} → ${numCompanyFiles} company sitemap files`,
  ``,
  `  Regenerate: node scripts/generate-sitemap-index.mjs`,
  `-->`,
  `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
  `  <sitemap><loc>${BASE}/api/sitemap-static.xml</loc></sitemap>`,
  `  <sitemap><loc>${BASE}/api/sitemap-blogs.xml</loc></sitemap>`,
  ...Array.from({ length: numCompanyFiles }, (_, i) =>
    `  <sitemap><loc>${BASE}/api/sitemap-companies-${i + 1}.xml</loc></sitemap>`
  ),
  ...Array.from({ length: numPseoFiles }, (_, i) =>
    `  <sitemap><loc>${BASE}/api/sitemap-pseo-${i + 1}.xml</loc></sitemap>`
  ),
  `</sitemapindex>`,
].join("\n");

writeFileSync(OUT, lines, "utf8");
console.log(`✅ Written ${OUT}`);
console.log(`   ${numCompanyFiles} company files + ${numPseoFiles} pSEO files + static + blogs`);
console.log(`   Total child sitemaps: ${2 + numCompanyFiles + numPseoFiles}`);

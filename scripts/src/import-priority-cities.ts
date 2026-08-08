#!/usr/bin/env tsx
/**
 * Import Priority Cities Script
 * ==============================
 * Reads a city list file (CSV or XLSX-derived JSON), matches each city against
 * the existing locations database, and marks matched rows as seo_priority = true.
 *
 * Usage:
 *   cd scripts && npx tsx src/import-priority-cities.ts <path-to-file>
 *
 * The file should be a plain-text list of city names, one per line.
 * Format accepted:
 *   "CityName STATE IN CAPS"   e.g.  "Noida UTTAR PRADESH"
 *   "CityName"                  e.g.  "Delhi"
 *
 * Rules:
 *  - Does NOT delete or deactivate any existing locations
 *  - Does NOT create new locations automatically (add --create flag in future)
 *  - Marks matched locations as seo_priority = true
 *  - Reports ambiguous and unresolved cities
 *  - Safe to re-run (idempotent)
 */

import { createRequire } from "module";
import { readFileSync, writeFileSync } from "fs";
import { Client } from "pg";

const require = createRequire(import.meta.url);
const filePath = process.argv[2];
if (!filePath) { console.error("Usage: tsx src/import-priority-cities.ts <file>"); process.exit(1); }

function decodeHtml(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

const STATES_UC: string[] = [
  "ANDAMAN & NICOBAR ISLANDS","ANDAMAN AND NICOBAR ISLANDS",
  "DADRA AND NAGAR HAVELI AND DAMAN AND DIU","DADRA & NAGAR HAVELI",
  "DADRA AND NAGAR HAVELI","DAMAN AND DIU","ARUNACHAL PRADESH",
  "ANDHRA PRADESH","HIMACHAL PRADESH","MADHYA PRADESH",
  "UTTAR PRADESH","UTTARAKHAND","WEST BENGAL","TAMIL NADU",
  "JAMMU AND KASHMIR","JAMMU & KASHMIR","CHANDIGARH","CHHATTISGARH",
  "JHARKHAND","KARNATAKA","LAKSHADWEEP","MAHARASHTRA","MEGHALAYA",
  "MIZORAM","NAGALAND","PUDUCHERRY","RAJASTHAN","TELANGANA","TRIPURA",
  "ASSAM","BIHAR","DELHI","GUJARAT","HARYANA","KERALA","MANIPUR",
  "ODISHA","PUNJAB","SIKKIM","GOA",
].sort((a, b) => b.length - a.length);

const STATE_MAP: Record<string, string> = {
  "ANDAMAN & NICOBAR ISLANDS": "Andaman and Nicobar Islands",
  "ANDAMAN AND NICOBAR ISLANDS": "Andaman and Nicobar Islands",
  "DADRA AND NAGAR HAVELI AND DAMAN AND DIU": "Dadra and Nagar Haveli and Daman and Diu",
  "DADRA & NAGAR HAVELI": "Dadra and Nagar Haveli",
  "DADRA AND NAGAR HAVELI": "Dadra and Nagar Haveli",
  "DAMAN AND DIU": "Daman and Diu",
  "JAMMU AND KASHMIR": "Jammu and Kashmir",
  "JAMMU & KASHMIR": "Jammu and Kashmir",
};

function toTitleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseEntry(raw: string): { city: string; state: string; raw: string } {
  const s = decodeHtml(raw).trim();
  const sUC = s.toUpperCase();
  for (const st of STATES_UC) {
    if (sUC.endsWith(" " + st)) {
      const city = s.substring(0, s.length - st.length - 1).trim();
      return { city, state: STATE_MAP[st] ?? toTitleCase(st), raw: s };
    }
    if (sUC === st) return { city: "", state: STATE_MAP[st] ?? toTitleCase(st), raw: s };
  }
  return { city: s, state: "", raw: s };
}

const raw = readFileSync(filePath, "utf8");
const lines = raw.split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && l.toLowerCase() !== "city" && l.toLowerCase() !== "district");

const entries = lines.map(parseEntry).filter((e) => e.city || e.state);
console.log(`Parsed ${entries.length} entries from ${filePath}`);

const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

let matched = 0, ambiguous = 0, unresolved = 0, updated = 0;
const ambiguousList: { raw: string; matches: string[] }[] = [];
const unresolvedList: string[] = [];

for (const entry of entries) {
  const { city, state } = entry;
  if (!city) { unresolved++; unresolvedList.push(entry.raw); continue; }

  const rows = state
    ? (await db.query(
        `SELECT id, city, town, district, state, slug, population FROM locations
         WHERE is_active = true AND LOWER(state) ILIKE $1
           AND (LOWER(COALESCE(city,'')) ILIKE $2 OR LOWER(COALESCE(town,'')) ILIKE $2
                OR LOWER(COALESCE(district,'')) ILIKE $2 OR LOWER(COALESCE(village,'')) ILIKE $2)
         ORDER BY population DESC NULLS LAST LIMIT 5`,
        ["%" + state.toLowerCase() + "%", city.toLowerCase()]
      )).rows
    : (await db.query(
        `SELECT id, city, town, district, state, slug, population FROM locations
         WHERE is_active = true
           AND (LOWER(COALESCE(city,'')) ILIKE $1 OR LOWER(COALESCE(town,'')) ILIKE $1
                OR LOWER(COALESCE(district,'')) ILIKE $1)
         ORDER BY population DESC NULLS LAST LIMIT 10`,
        [city.toLowerCase()]
      )).rows;

  if (rows.length === 0) { unresolved++; unresolvedList.push(entry.raw); continue; }

  if (rows.length > 1 && !state) {
    ambiguous++;
    ambiguousList.push({ raw: entry.raw, matches: rows.map((r: Record<string, string>) => `${r.state}/${r.slug}`).slice(0, 3) });
  }

  const toUpdate = state ? rows : [rows[0]];
  for (const row of toUpdate) {
    await db.query("UPDATE locations SET seo_priority = true WHERE id = $1", [row.id]);
    updated++;
  }
  matched++;
}

const [{ count }] = (await db.query("SELECT COUNT(*) as count FROM locations WHERE seo_priority = true")).rows;
await db.end();

const report = {
  file: filePath,
  totalRows: entries.length,
  matched,
  ambiguous,
  unresolved,
  dbRowsUpdated: updated,
  totalPriorityInDb: Number(count),
  ambiguousList: ambiguousList.slice(0, 50),
  unresolvedList: unresolvedList.slice(0, 100),
};

const outPath = `/tmp/priority-import-report-${Date.now()}.json`;
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log("\n=== IMPORT COMPLETE ===");
console.log(`Matched:     ${matched}`);
console.log(`Ambiguous:   ${ambiguous}`);
console.log(`Unresolved:  ${unresolved}`);
console.log(`DB updated:  ${updated} rows`);
console.log(`Priority total in DB: ${count}`);
console.log(`Report: ${outPath}`);

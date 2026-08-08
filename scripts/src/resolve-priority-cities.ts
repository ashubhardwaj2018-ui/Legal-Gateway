#!/usr/bin/env tsx
/**
 * Fast bulk resolver for priority cities.
 * Loads all active location names from DB once, then resolves every entry in-memory.
 * Outputs a JSON report of unresolved + ambiguous entries.
 * Does NOT write to the DB (report-only mode).
 *
 * Usage:
 *   cd scripts && DATABASE_URL=... npx tsx src/resolve-priority-cities.ts <city-list.txt>
 */

import { readFileSync, writeFileSync } from "fs";
import { Client } from "pg";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: tsx src/resolve-priority-cities.ts <file>");
  process.exit(1);
}

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

// ─── Load input file ───────────────────────────────────────────────────────
const raw = readFileSync(filePath, "utf8");
const lines = raw.split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && l.toLowerCase() !== "city" && l.toLowerCase() !== "district");

const entries = lines.map(parseEntry).filter((e) => e.city || e.state);
console.log(`Parsed ${entries.length} entries from ${filePath}`);

// ─── Load all active locations from DB in bulk ─────────────────────────────
console.log("Loading all active locations from DB...");
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

// Load all active locations with their name fields
const { rows: allLocs } = await db.query<{
  id: number; city: string | null; town: string | null;
  district: string | null; village: string | null;
  state: string; slug: string; population: number | null;
  seo_priority: boolean;
}>(
  `SELECT id, city, town, district, village, state, slug, population, seo_priority
   FROM locations WHERE is_active = true`
);
console.log(`Loaded ${allLocs.length} active locations from DB`);

await db.end();

// ─── Build lookup index: lowercase name -> list of locations ─────────────
type LocRow = typeof allLocs[0];

// multi-key index: each location can appear under city, town, district, village
const nameIndex = new Map<string, LocRow[]>();
for (const loc of allLocs) {
  for (const field of [loc.city, loc.town, loc.district, loc.village]) {
    if (!field) continue;
    const key = field.toLowerCase();
    if (!nameIndex.has(key)) nameIndex.set(key, []);
    nameIndex.get(key)!.push(loc);
  }
}

console.log(`Index built with ${nameIndex.size} distinct name keys`);

// ─── Resolve entries ────────────────────────────────────────────────────────
type Match = { id: number; state: string; slug: string; population: number | null };

const resolvedList: { raw: string; matches: Match[] }[] = [];
const ambiguousList: { raw: string; matches: string[] }[] = [];
const unresolvedList: string[] = [];
let matched = 0, ambiguous = 0, unresolved = 0;
const alreadyPriority: string[] = [];

for (const entry of entries) {
  const { city, state } = entry;
  if (!city) { unresolved++; unresolvedList.push(entry.raw); continue; }

  const cityKey = city.toLowerCase();
  let candidates = nameIndex.get(cityKey) ?? [];

  // If state provided, filter to matching state
  if (state && candidates.length > 0) {
    const stateKey = state.toLowerCase();
    const filtered = candidates.filter(
      (r) => r.state.toLowerCase().includes(stateKey) || stateKey.includes(r.state.toLowerCase())
    );
    if (filtered.length > 0) candidates = filtered;
  }

  if (candidates.length === 0) {
    unresolved++;
    unresolvedList.push(entry.raw);
    continue;
  }

  // Sort by population desc
  candidates.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

  if (candidates.length > 1 && !state) {
    ambiguous++;
    ambiguousList.push({
      raw: entry.raw,
      matches: candidates.slice(0, 3).map((r) => `${r.state}/${r.slug}`),
    });
  }

  const toMatch = state ? candidates : [candidates[0]];
  for (const m of toMatch) {
    if (m.seo_priority) alreadyPriority.push(entry.raw + " -> " + m.slug);
  }
  resolvedList.push({ raw: entry.raw, matches: toMatch.map(m => ({ id: m.id, state: m.state, slug: m.slug, population: m.population })) });
  matched++;
}

// ─── Summary ────────────────────────────────────────────────────────────────
console.log("\n=== REPORT (DRY RUN — no DB writes) ===");
console.log(`Total entries: ${entries.length}`);
console.log(`Matched:       ${matched}`);
console.log(`Ambiguous:     ${ambiguous} (counted within matched)`);
console.log(`Unresolved:    ${unresolved}`);
console.log(`Already set to seo_priority: ${alreadyPriority.length}`);

const outPath = `/tmp/priority-resolve-report-${Date.now()}.json`;
writeFileSync(outPath, JSON.stringify({
  summary: { total: entries.length, matched, ambiguous, unresolved },
  unresolvedList,
  ambiguousList: ambiguousList.slice(0, 100),
  alreadyPriority: alreadyPriority.slice(0, 50),
}, null, 2));
console.log(`\nFull report: ${outPath}`);

// Print all unresolved
console.log(`\n--- UNRESOLVED (${unresolvedList.length}) ---`);
unresolvedList.forEach(u => console.log(" ", u));

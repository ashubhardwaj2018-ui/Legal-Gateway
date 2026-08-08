#!/usr/bin/env tsx
/**
 * Bulk fix for unresolved priority cities — single-query version.
 *
 * Builds ONE large SQL UPDATE combining all conditions with OR,
 * then runs a report to see what's still missing.
 *
 * Safe to re-run (idempotent — only sets seo_priority=true, never clears it).
 *
 * Usage:
 *   DATABASE_URL=... npx tsx src/fix-priority-cities.ts <city-list.txt>
 */

import { readFileSync, writeFileSync } from "fs";
import { Client } from "pg";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: tsx src/fix-priority-cities.ts <file>");
  process.exit(1);
}

// ─── Spelling correction map ───────────────────────────────────────────────
// Key: city name in source file (lowercase)
// Value: [searchTerm, statePattern?]  — statePattern is a PARTIAL match string
//   for the DB's state column (DB uses "Jammu Kashmir", "Tamilnadu", "Chattisgarh")
type Correction = [searchTerm: string, statePattern?: string];
const CORRECTIONS: Record<string, Correction> = {
  // J&K
  "badgam":                     ["budgam",          "jammu"],
  "bandipore":                  ["bandipora",        "jammu"],
  "shupiyan":                   ["shopian",          "jammu"],
  "punch":                      ["poonch",           "jammu"],
  "leh(ladakh)":                ["leh",              "jammu"],

  // Jharkhand
  "pashchimi singhbhum":        ["west singhbhum",  "jharkhand"],
  "purbi singhbhum":            ["east singhbhum",  "jharkhand"],
  "saraikela-kharsawan":        ["saraikela",        "jharkhand"],

  // Karnataka
  "belgaum":                    ["belagavi",         "karnataka"],
  "gulbarga":                   ["kalaburagi",       "karnataka"],
  "bellary":                    ["ballari",          "karnataka"],
  "mysore":                     ["mysuru",           "karnataka"],
  "shimoga":                    ["shivamogga",       "karnataka"],
  "chikmagalur":                ["chikkamagalur",    "karnataka"],

  // Maharashtra
  "ahmadnagar":                 ["ahmednagar",       "maharashtra"],
  "buldana":                    ["buldhana",         "maharashtra"],
  "bid":                        ["beed",             "maharashtra"],
  "gondiya":                    ["gondia",           "maharashtra"],
  "mumbai suburban":            ["mumbai",           "maharashtra"],
  "chhatrapati sambhajinagar":  ["sambhajinagar",    "maharashtra"],

  // Gujarat
  "dohad":                      ["dahod",            "gujarat"],
  "kachchh":                    ["kachchh",          "gujarat"],     // wildcard will find "Dahisara Kachchh"
  "devbhoomi dwarka":           ["dwarka",           "gujarat"],
  "gir somnath":                ["gir",              "gujarat"],
  "mahisagar":                  ["mahisagar",        "gujarat"],
  "sabar kantha":               ["sabarkantha",      "gujarat"],
  "panch mahals":               ["panch mahals",     "gujarat"],
  "the dangs":                  ["dangs",            "gujarat"],
  "chhota udepur":              ["chhota udaipur",   "gujarat"],
  "chhota udaipur":             ["chhota udaipur",   "gujarat"],

  // Bihar
  "kaimur (bhabua)":            ["kaimur",           "bihar"],
  "pashchim champaran":         ["west champaran",   "bihar"],
  "purbi champaran":            ["east champaran",   "bihar"],

  // Chhattisgarh (DB: "Chattisgarh")
  "dakshin bastar dantewada":   ["dantewada",        "chattisgarh"],
  "uttar bastar kanker":        ["kanker",           "chattisgarh"],
  "kabeerdham":                 ["kabeerdham",       "chattisgarh"],
  "janjgir - champa":           ["janjgir",          "chattisgarh"],

  // West Bengal
  "barddhaman":                 ["bardhaman",        "west bengal"],
  "haora":                      ["howrah",           "west bengal"],
  "hugli":                      ["hooghly",          "west bengal"],
  "maldah":                     ["malda",            "west bengal"],
  "puruliya":                   ["purulia",          "west bengal"],
  "darjiling":                  ["darjeeling",       "west bengal"],
  "paschim bardhaman":          ["bardhaman",        "west bengal"],
  "purba bardhaman":            ["bardhaman",        "west bengal"],
  "paschim medinipur":          ["midnapore",        "west bengal"],
  "purba medinipur":            ["midnapore",        "west bengal"],
  "north twenty four parganas": ["north 24",         "west bengal"],
  "south twenty four parganas": ["south 24",         "west bengal"],
  "uttar dinajpur":             ["dinajpur",         "west bengal"],
  "dakshin dinajpur":           ["dinajpur",         "west bengal"],
  "koch bihar":                 ["cooch behar",      "west bengal"],
  "jhargram":                   ["jhargram",         "west bengal"],

  // Haryana
  "mewat":                      ["nuh",              "haryana"],
  "gurgaon":                    ["gurugram",         "haryana"],

  // Himachal Pradesh
  "lahul spiti":                ["spiti",            "himachal"],

  // Uttarakhand
  "hardwar":                    ["haridwar",         "uttarakhand"],

  // Andhra Pradesh
  "y.s.r.":                     ["kadapa",           "andhra"],
  "sri potti sriramulu nellore": ["nellore",         "andhra"],

  // Assam
  "sivasagar":                  ["sibsagar",         "assam"],
  "west karbi anglong":         ["karbi anglong",    "assam"],

  // Delhi
  "new delhi":                  ["delhi",            "delhi"],

  // City-level renames — state filters added to prevent wildcard cross-state pollution
  // Previously these had NO statePattern, causing ILIKE '%term%' to match unrelated
  // post offices in other states (e.g. "kalyan" matched "Kalyanpur" in 7 states).
  "bhubaneshwar":               ["bhubaneswar",       "odisha"],
  "tiruchirappalli":            ["tiruchirappalli",   "tamilnadu"],
  "rajamahendravaram":          ["rajahmundry",       "andhra"],
  "kalyan-dombivli":            ["kalyan",            "maharashtra"],
  "vasai-virar":                ["vasai",             "maharashtra"],
};

// Entries to skip entirely (not in India / not useful)
const SKIP = new Set(["cape town"]);

// ─── DB state name normalisation ──────────────────────────────────────────
// Map standard state names → DB-friendly partial match string
const DB_STATE: Record<string, string> = {
  "jammu and kashmir":                       "jammu",
  "tamil nadu":                              "tamil",
  "chhattisgarh":                            "chattisgarh",
  "andaman and nicobar islands":             "andaman",
  "dadra and nagar haveli and daman and diu": "dadra",
  "dadra and nagar haveli":                  "dadra",
  "daman and diu":                           "daman",
};
function dbState(state: string): string {
  return DB_STATE[state.toLowerCase()] ?? state.toLowerCase();
}

// ─── Parse source file ─────────────────────────────────────────────────────
function decodeHtml(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
const STATES_UC = [
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
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
function parseEntry(raw: string) {
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

const rawFile = readFileSync(filePath, "utf8");
const entries = rawFile.split(/\r?\n/)
  .map(l => l.trim())
  .filter(l => l && l.toLowerCase() !== "city" && l.toLowerCase() !== "district")
  .map(parseEntry)
  .filter(e => e.city || e.state);

console.log(`Parsed ${entries.length} entries`);

// ─── Build condition list ──────────────────────────────────────────────────
// Each condition: { term, statePattern? }
type Cond = { term: string; statePattern?: string; raw: string; stateOnly?: boolean };
const conditions: Cond[] = [];
const skipped: string[] = [];

for (const entry of entries) {
  const { city, state, raw } = entry;

  // State-only entries (e.g. "Delhi", "Chandigarh") — mark all locations in that state
  if (!city && state) {
    conditions.push({ term: dbState(state), statePattern: dbState(state), raw, stateOnly: true });
    continue;
  }

  if (!city) { skipped.push(raw); continue; }
  if (SKIP.has(city.toLowerCase())) { skipped.push(raw); continue; }

  const cityKey = city.toLowerCase();
  const correction = CORRECTIONS[cityKey];

  let term: string;
  let statePattern: string | undefined;

  if (correction) {
    [term, statePattern] = correction;
  } else {
    term = cityKey;
    statePattern = state ? dbState(state) : undefined;
  }

  conditions.push({ term, statePattern, raw });
}

console.log(`Building update for ${conditions.length} conditions...`);

// ─── Connect & run ─────────────────────────────────────────────────────────
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const { rows: [before] } = await db.query(
  "SELECT COUNT(*) as cnt FROM locations WHERE seo_priority = true"
);
console.log(`seo_priority before: ${before.cnt}`);

// Build one big SQL with all conditions.
// Group state-specific conditions by state pattern, then union with global ones.
// We'll use parameterised queries in batches of 100 to avoid hitting parameter limits.

const BATCH = 100;
let totalUpdated = 0;
const matched: string[] = [];
const notMatched: string[] = [];

// First pass: try each condition with its state hint. Collect those that got 0 rows.
// Then for city-only entries (no state) try without state filter.
// We do this in batches by running UPDATE ... WHERE (cond1 OR cond2 OR ...) RETURNING id

// Helper: build one WHERE clause fragment for a condition
function mkClause(cond: Cond, paramIdx: number): { sql: string; params: string[] } {
  // State-only entry: mark everything in the state
  if (cond.stateOnly && cond.statePattern) {
    return {
      sql: `LOWER(state) ILIKE $${paramIdx}`,
      params: [`%${cond.statePattern}%`],
    };
  }
  const namePat = `%${cond.term}%`;
  const nameIdx = cond.statePattern ? paramIdx + 1 : paramIdx;
  const nameCols = `(LOWER(COALESCE(city,'')) ILIKE $${nameIdx} OR LOWER(COALESCE(town,'')) ILIKE $${nameIdx} OR LOWER(COALESCE(district,'')) ILIKE $${nameIdx} OR LOWER(COALESCE(village,'')) ILIKE $${nameIdx})`;
  if (cond.statePattern) {
    return {
      sql: `(LOWER(state) ILIKE $${paramIdx} AND ${nameCols})`,
      params: [`%${cond.statePattern}%`, namePat],
    };
  }
  return { sql: nameCols, params: [namePat] };
}

// Run in batches
for (let i = 0; i < conditions.length; i += BATCH) {
  const batch = conditions.slice(i, i + BATCH);
  const clauses: string[] = [];
  const params: string[] = [];
  let paramIdx = 1;

  for (const cond of batch) {
    const { sql, params: p } = mkClause(cond, paramIdx);
    clauses.push(sql);
    params.push(...p);
    paramIdx += p.length;
  }

  const sql = `
    UPDATE locations SET seo_priority = true
    WHERE is_active = true AND (${clauses.join(" OR ")})
    RETURNING id
  `;

  const result = await db.query(sql, params);
  totalUpdated += result.rowCount ?? 0;
  console.log(`  Batch ${Math.floor(i / BATCH) + 1}: updated ${result.rowCount} rows`);
}

const { rows: [after] } = await db.query(
  "SELECT COUNT(*) as cnt FROM locations WHERE seo_priority = true"
);
await db.end();

console.log(`\n=== FIX COMPLETE ===`);
console.log(`DB rows set to seo_priority: ${totalUpdated} (some may overlap)`);
console.log(`seo_priority before: ${before.cnt}  →  after: ${after.cnt}`);
console.log(`Net new priority locations: ${Number(after.cnt) - Number(before.cnt)}`);
console.log(`Skipped entries: ${skipped.length} (${skipped.join(", ")})`);

const outPath = `/tmp/priority-fix-report-${Date.now()}.json`;
writeFileSync(outPath, JSON.stringify({
  before: Number(before.cnt),
  after: Number(after.cnt),
  netNew: Number(after.cnt) - Number(before.cnt),
  totalDbRowsTouched: totalUpdated,
  skipped,
}, null, 2));
console.log(`Report: ${outPath}`);

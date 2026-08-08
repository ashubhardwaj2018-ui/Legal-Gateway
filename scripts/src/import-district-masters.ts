#!/usr/bin/env tsx
/**
 * District Masters Import
 * ========================
 * Uses attached_assets/District_Masters_(1)_1786204456278.xlsx
 * (columns: "State Name" + "City/ Town") to mark exactly ONE canonical
 * DB location per district as seo_priority = true.
 *
 * PRE-CONDITION (task-108 remediation):
 *   Before this script was run, all seo_priority flags were reset to false:
 *     UPDATE locations SET seo_priority = false WHERE seo_priority = true;
 *   This cleared a prior wildcard over-tag of 27,920 rows that resulted from
 *   ILIKE '%city%' queries without state filters.  Only this script's output
 *   (canonical, state-filtered IDs) should be considered authoritative.
 *
 * Matching strategy (tries each in order, stops at first hit):
 *  1. Exact city/town/district column match within state
 *  2. First word of city name (for compound names like "East Godavari")
 *  3. Substring ILIKE '%city%' within state
 *  — NO state-level fallback: unmatched districts are logged and skipped
 *    so operators can add explicit CITY_CORRECTIONS entries for them.
 *
 * Safe to re-run (idempotent — only sets seo_priority=true, never clears it).
 *
 * Usage:
 *   DATABASE_URL=... npx tsx src/import-district-masters.ts \
 *     ../attached_assets/District_Masters_\(1\)_1786204456278.xlsx
 */

import XLSX from "xlsx";
import { writeFileSync } from "fs";
import { Client } from "pg";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: tsx src/import-district-masters.ts <xlsx>");
  process.exit(1);
}

// ─── DB state-name → partial ILIKE pattern ─────────────────────────────────
// DB has exactly these states (SELECT DISTINCT state FROM locations):
//   APS, Andhra Pradesh, Assam, Bihar, Chattisgarh, Delhi, Gujarat, Haryana,
//   Himachal Pradesh, Jammu Kashmir, Jharkhand, Karnataka, Kerala,
//   Madhya Pradesh, Maharashtra, North Eastern, Odisha, Punjab, Rajasthan,
//   Tamil Nadu, Tamilnadu, Telangana, Uttar Pradesh, Uttarakhand, West Bengal

function xlsxStateToDb(s: string): string | null {
  const n = s.trim().toUpperCase();
  if (n.includes("N/A") || n.includes("OUTSIDE INDIA"))    return null;
  if (n.includes("ANDAMAN") || n.includes("NICOBAR"))      return null; // not in DB
  if (n.includes("ANDHRA"))                                 return "andhra pradesh";
  if (n.includes("ARUNACHAL"))                              return "north eastern";
  if (n === "ASSAM" || n === "ASSAM")                       return "assam";
  if (n === "BIHAR")                                        return "bihar";
  if (n.includes("CHANDIGARH"))                             return "haryana"; // no separate Chandigarh in DB
  if (n.includes("CHHATTISGARH") || n.includes("CHATTISGARH")) return "chattisgarh";
  if (n.includes("DADRA"))                                  return "gujarat"; // nearest in DB
  if (n.includes("DAMAN"))                                  return "gujarat"; // nearest in DB
  if (n.includes("DELHI") || n === "DELHI")                 return "delhi";
  if (n === "GOA" || n === "NORTH GOA" || n === "SOUTH GOA") return null; // not in DB
  if (n.includes("GUJARAT"))                                return "gujarat";
  if (n.includes("HARYANA"))                                return "haryana";
  if (n.includes("HIMACHAL"))                               return "himachal pradesh";
  if (n.includes("JAMMU"))                                  return "jammu kashmir";
  if (n.includes("JHARKHAND"))                              return "jharkhand";
  if (n.includes("KARNATAKA"))                              return "karnataka";
  if (n.includes("KERALA"))                                 return "kerala";
  if (n.includes("LAKSHADWEEP"))                            return null; // not in DB
  if (n.includes("MADHYA PRADESH"))                         return "madhya pradesh";
  if (n.includes("MAHARASHTRA"))                            return "maharashtra";
  if (n.includes("MANIPUR"))                                return "north eastern";
  if (n.includes("MEGHALAYA"))                              return "north eastern";
  if (n.includes("MIZORAM"))                                return "north eastern";
  if (n.includes("NAGALAND"))                               return "north eastern";
  if (n.includes("ODISHA") || n.includes("ORISSA"))         return "odisha";
  if (n.includes("PUDUCHERRY") || n.includes("PONDICHERRY")) return "tamilnadu";
  if (n.includes("PUNJAB"))                                 return "punjab";
  if (n.includes("RAJASTHAN"))                              return "rajasthan";
  if (n.includes("SIKKIM"))                                 return "north eastern";
  if (n.includes("TAMIL NADU") || n.includes("TAMILNADU")) return "tamilnadu";
  if (n.includes("TELANGANA"))                              return "telangana";
  if (n.includes("TRIPURA"))                                return "north eastern";
  if (n.includes("UTTAR PRADESH"))                          return "uttar pradesh";
  if (n.includes("UTTARAKHAND") || n.includes("UTTARANCHAL")) return "uttarakhand";
  if (n.includes("WEST BENGAL"))                            return "west bengal";
  // Title-case fallbacks (file has mixed case)
  const l = s.trim().toLowerCase();
  if (l === "assam")            return "assam";
  if (l === "bihar")            return "bihar";
  if (l === "chandigarh")       return "haryana";
  if (l === "chhattisgarh")     return "chattisgarh";
  if (l === "delhi")            return "delhi";
  if (l === "goa")              return null;
  if (l === "gujarat")          return "gujarat";
  if (l === "haryana")          return "haryana";
  if (l === "himachal pradesh") return "himachal pradesh";
  if (l === "jammu and kashmir")return "jammu kashmir";
  if (l === "jharkhand")        return "jharkhand";
  if (l === "karnataka")        return "karnataka";
  if (l === "kerala")           return "kerala";
  if (l === "madhya pradesh")   return "madhya pradesh";
  if (l === "maharashtra")      return "maharashtra";
  if (l === "manipur")          return "north eastern";
  if (l === "meghalaya")        return "north eastern";
  if (l === "mizoram")          return "north eastern";
  if (l === "nagaland")         return "north eastern";
  if (l === "odisha")           return "odisha";
  if (l === "puducherry")       return "tamilnadu";
  if (l === "punjab")           return "punjab";
  if (l === "rajasthan")        return "rajasthan";
  if (l === "sikkim")           return "north eastern";
  if (l === "tamil nadu")       return "tamilnadu";
  if (l === "telangana")        return "telangana";
  if (l === "tripura")          return "north eastern";
  if (l === "uttar pradesh")    return "uttar pradesh";
  if (l === "uttarakhand")      return "uttarakhand";
  if (l === "west bengal")      return "west bengal";
  if (l.includes("dadra") || l.includes("daman")) return "gujarat";
  if (l.includes("andaman") || l.includes("nicobar")) return null;
  return null;
}

// ─── City name corrections (xlsx term → DB search term) ────────────────────
const CITY_CORRECTIONS: Record<string, string> = {
  // Andhra Pradesh
  "sri potti sriramulu nellore": "nellore",
  "y.s.r.":                       "kadapa",
  // Bihar
  "kaimur (bhabua)":              "kaimur",
  "pashchim champaran":           "west champaran",
  "purbi champaran":              "east champaran",
  // Chhattisgarh
  "dakshin bastar dantewada":     "dantewada",
  "uttar bastar kanker":          "kanker",
  "janjgir - champa":             "janjgir",
  "janjgir champa":               "janjgir",
  // Gujarat
  "dohad":                        "dahod",
  "devbhoomi dwarka":             "dwarka",
  "gir somnath":                  "gir",
  "panch mahals":                 "panchmahal",
  "the dangs":                    "dangs",
  "chhota udepur":                "chhota udaipur",
  "sabar kantha":                 "sabarkantha",
  // Haryana
  "mewat":                        "nuh",
  "gurgaon":                      "gurugram",
  // Himachal Pradesh
  "lahul spiti":                  "spiti",
  "lahul & spiti":                "spiti",
  // J&K
  "badgam":                       "budgam",
  "bandipore":                    "bandipora",
  "shupiyan":                     "shopian",
  "punch":                        "poonch",
  "leh(ladakh)":                  "leh",
  "leh ladakh":                   "leh",
  "baramula":                     "baramulla",
  // Jharkhand
  "pashchimi singhbhum":          "west singhbhum",
  "purbi singhbhum":              "east singhbhum",
  "saraikela-kharsawan":          "saraikela",
  "saraikela kharsawan":          "saraikela",
  // Karnataka
  "belgaum":                      "belagavi",
  "gulbarga":                     "kalaburagi",
  "bellary":                      "ballari",
  "mysore":                       "mysuru",
  "shimoga":                      "shivamogga",
  "chikmagalur":                  "chikkamagalur",
  "bijapur":                      "vijayapura",
  "bangalore rural":              "bangalore",
  // Maharashtra
  "ahmadnagar":                   "ahmednagar",
  "buldana":                      "buldhana",
  "bid":                          "beed",
  "gondiya":                      "gondia",
  "mumbai suburban":              "mumbai",
  "chhatrapati sambhajinagar":    "sambhajinagar",
  "aurangabad":                   "aurangabad",
  // Odisha
  "anugul":                       "angul",
  "baudh":                        "boudh",
  "nabarangapur":                 "nabarangpur",
  "baleshwar":                    "balasore",
  // Rajasthan
  "chittaurgarh":                 "chittorgarh",
  "dhaulpur":                     "dholpur",
  "jhunjhunun":                   "jhunjhunu",
  // Tamil Nadu
  "kancheepuram":                 "kanchipuram",
  "thoothukkudi":                 "tuticorin",
  "the nilgiris":                 "ooty",
  "thiruvallur":                  "tiruvallur",
  "thiruvarur":                   "tiruvarur",
  // Telangana
  "komaram bheem":                "asifabad",
  "jayashankar":                  "bhupalapally",
  "jogulamba":                    "gadwal",
  "warangal rural":               "warangal",
  "warangal urban":               "warangal",
  "medchal-malkajgiri":           "medchal",
  "yadadri":                      "bhongir",
  "mahbubnagar":                  "mahabubnagar",
  // UP
  "bara banki":                   "barabanki",
  "rae bareli":                   "raebareli",
  "sant kabir nagar":             "khalilabad",
  "shrawasti":                    "bhinga",
  "siddharthnagar":               "naugarh",
  "sonbhadra":                    "robertsganj",
  // West Bengal
  "south twenty four parganas":   "south 24",
  "north twenty four parganas":   "north 24",
  "haora":                        "howrah",
  "hugli":                        "hooghly",
  "maldah":                       "malda",
  "puruliya":                     "purulia",
  "darjiling":                    "darjeeling",
  "paschim bardhaman":            "bardhaman",
  "purba bardhaman":              "bardhaman",
  "barddhaman":                   "bardhaman",
  "paschim medinipur":            "midnapore",
  "purba medinipur":              "midnapore",
  "uttar dinajpur":               "dinajpur",
  "dakshin dinajpur":             "dinajpur",
  "koch bihar":                   "cooch behar",
  "sahibzada ajit singh nagar":   "mohali",
  "shahid bhagat singh nagar":    "nawanshahr",
  // Delhi districts → all map to Delhi
  "central":                      "delhi",
  "east":                         "delhi",
  "new delhi":                    "new delhi",
  "north":                        "delhi",
  "north east":                   "delhi",
  "north west":                   "delhi",
  "shahdara":                     "shahdara",
  "south":                        "delhi",
  "south east delhi":             "delhi",
  "south west":                   "delhi",
  "west":                         "delhi",
  // North Eastern (Arunachal) — map to state capital / nearest big city
  "dibang valley":                "roing",
  "east kameng":                  "seppa",
  "east siang":                   "pasighat",
  "kra daadi":                    "ziro",
  "kurung kumey":                 "koloriang",
  "lower dibang valley":          "roing",
  "lower siang":                  "likabali",
  "lower subansiri":              "ziro",
  "namsai":                       "namsai",
  "papum pare":                   "itanagar",
  "tirap":                        "deomali",
  "upper siang":                  "yingkiong",
  "upper subansiri":              "daporijo",
  "west kameng":                  "bomdila",
  "west siang":                   "along",
  "siang":                        "along",
  // Assam districts
  "baksa":                        "baska",
  "charaideo":                    "sonari",
  "chirang":                      "kajalgaon",
  "dima hasao":                   "haflong",
  "kamrup metropolitan":          "guwahati",
  "kamrup":                       "guwahati",
  "karbi anglong":                "diphu",
  "sonitpur":                     "tezpur",
  "south salamara-mankachar":     "dhubri",
  "west karbi anglong":           "hamren",
  "sivasagar":                    "sibsagar",
  // Meghalaya
  "east garo hills":              "tura",
  "east jaintia hills":           "khliehriat",
  "east khasi hills":             "shillong",
  "jaintia hills":                "jowai",
  "north garo hills":             "resubelpara",
  "ribhoi":                       "nongpoh",
  "south garo hills":             "baghmara",
  "south west garo hills":        "ampati",
  "south west khasi hills":       "mawkyrwat",
  "west jaintia hills":           "jowai",
  "west khasi hills":             "nongstoin",
  // Manipur
  "imphal east":                  "imphal",
  "imphal west":                  "imphal",
  "kamjong":                      "kamjong",
  "noney":                        "noney",
  // Sikkim
  "east district":                "gangtok",
  "north  district":              "mangan",
  "south district":               "namchi",
  "west district":                "gyalshing",
  // Tripura
  "gomati":                       "udaipur",
  "south tripura":                "belonia",
  "unakoti":                      "kailashahar",
  // Odisha additional
  "kalahandi":                    "bhawanipatna",
  "khordha":                      "bhubaneswar",
  // MP additional
  "khandwa (east nimar)":         "khandwa",
  "khargone (west nimar)":        "khargone",
  "narsimhapur":                  "narsinghpur",
  // Karnataka
  "chikkaballapura":              "chikballapur",
  // Himachal additional
  "kinnaur":                      "rampur",
  "solan":                        "solan",
  // Rajasthan additional
  "pratapgarh":                   "pratapgarh",
};

// ─── Parse xlsx ─────────────────────────────────────────────────────────────
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
const entries = rawRows.slice(1)
  .map(r => ({ state: String(r[0] ?? "").trim(), city: String(r[1] ?? "").trim() }))
  .filter(r => r.state && r.city);

console.log(`Parsed ${entries.length} entries from xlsx`);

// ─── Connect ──────────────────────────────────────────────────────────────────
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

// ─── Helper: find ONE best location in a state by search term ────────────────
interface LocRow { id: number; city: string|null; town: string|null; district: string|null; state: string; slug: string; population: number|null }

async function findBest(statePat: string, term: string): Promise<LocRow | null> {
  const termL = term.toLowerCase().trim();

  // 1. Exact match in any name column
  const { rows: exact } = await db.query<LocRow>(
    `SELECT id, city, town, district, state, slug, population FROM locations
     WHERE is_active=true AND LOWER(state) ILIKE $1
       AND (LOWER(COALESCE(city,''))=$2 OR LOWER(COALESCE(town,''))=$2 OR LOWER(COALESCE(district,''))=$2)
     ORDER BY population DESC NULLS LAST LIMIT 1`,
    [`%${statePat}%`, termL]
  );
  if (exact.length) return exact[0];

  // 2. Substring match (ILIKE '%term%')
  const { rows: fuzzy } = await db.query<LocRow>(
    `SELECT id, city, town, district, state, slug, population FROM locations
     WHERE is_active=true AND LOWER(state) ILIKE $1
       AND (LOWER(COALESCE(city,'')) ILIKE $2 OR LOWER(COALESCE(town,'')) ILIKE $2 OR LOWER(COALESCE(district,'')) ILIKE $2)
     ORDER BY population DESC NULLS LAST LIMIT 1`,
    [`%${statePat}%`, `%${termL}%`]
  );
  if (fuzzy.length) return fuzzy[0];

  // 3. First significant word (≥3 chars) of the city name
  const firstWord = termL.split(/[\s\-]+/).find(w => w.length >= 3);
  if (firstWord && firstWord !== termL) {
    const { rows: fw } = await db.query<LocRow>(
      `SELECT id, city, town, district, state, slug, population FROM locations
       WHERE is_active=true AND LOWER(state) ILIKE $1
         AND (LOWER(COALESCE(city,'')) ILIKE $2 OR LOWER(COALESCE(town,'')) ILIKE $2 OR LOWER(COALESCE(district,'')) ILIKE $2)
       ORDER BY population DESC NULLS LAST LIMIT 1`,
      [`%${statePat}%`, `%${firstWord}%`]
    );
    if (fw.length) return fw[0];
  }

  // No state-level fallback: return null so the caller logs an explicit
  // "not found" entry that operators can resolve via CITY_CORRECTIONS.
  return null;
}

// ─── Process ──────────────────────────────────────────────────────────────────
const { rows: [before] } = await db.query("SELECT COUNT(*) as cnt FROM locations WHERE seo_priority=true");
console.log(`\nseo_priority before: ${before.cnt}`);

const resolvedIds = new Set<number>();
const matched: { raw: string; dbSlug: string; matchType: string }[] = [];
const skipped: string[] = [];
const noDb: string[] = [];

for (const entry of entries) {
  const statePat = xlsxStateToDb(entry.state);
  if (!statePat) {
    skipped.push(`${entry.state} | ${entry.city}`);
    continue;
  }

  const cityKey = entry.city.toLowerCase().trim();
  const searchTerm = CITY_CORRECTIONS[cityKey] ?? cityKey;

  const found = await findBest(statePat, searchTerm);
  if (!found) {
    noDb.push(`${entry.state} | ${entry.city} → [${searchTerm}] in [${statePat}]`);
    continue;
  }

  resolvedIds.add(found.id);
  matched.push({ raw: `${entry.state} | ${entry.city}`, dbSlug: found.slug, matchType: "ok" });
}

console.log(`\nResolved: ${resolvedIds.size} unique canonical locations`);
console.log(`Skipped (no DB state): ${skipped.length}`);
console.log(`Not found in DB: ${noDb.length}`);

// ─── Bulk update ──────────────────────────────────────────────────────────────
let updated = 0;
if (resolvedIds.size > 0) {
  const ids = [...resolvedIds];
  const CHUNK = 500;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const ph = chunk.map((_, j) => `$${j + 1}`).join(",");
    const r = await db.query(`UPDATE locations SET seo_priority=true WHERE id IN (${ph}) AND seo_priority=false`, chunk);
    updated += r.rowCount ?? 0;
  }
}

const { rows: [after] } = await db.query("SELECT COUNT(*) as cnt FROM locations WHERE seo_priority=true");
await db.end();

console.log(`\n=== IMPORT COMPLETE ===`);
console.log(`seo_priority before: ${before.cnt}  →  after: ${after.cnt}`);
console.log(`Net new: ${Number(after.cnt) - Number(before.cnt)}`);
console.log(`pSEO URLs = ${after.cnt} × 143 services = ${Number(after.cnt) * 143}`);

if (noDb.length) {
  console.log(`\nNot found in DB (${noDb.length}):`);
  noDb.forEach(x => console.log("  ", x));
}
if (skipped.length) {
  console.log(`\nSkipped states (${skipped.length}):`);
  skipped.forEach(x => console.log("  ", x));
}

const outPath = `/tmp/district-import-${Date.now()}.json`;
writeFileSync(outPath, JSON.stringify({
  before: Number(before.cnt),
  after: Number(after.cnt),
  netNew: Number(after.cnt) - Number(before.cnt),
  resolvedCount: resolvedIds.size,
  pSeoUrls: Number(after.cnt) * 143,
  notFoundInDb: noDb,
  skippedStates: skipped,
}, null, 2));
console.log(`\nReport: ${outPath}`);

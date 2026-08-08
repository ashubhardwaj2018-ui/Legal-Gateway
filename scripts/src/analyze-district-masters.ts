#!/usr/bin/env tsx
/**
 * Fast bulk analysis of district master XLSX vs locations DB.
 * Loads ALL locations once, does all matching in-memory.
 * Reports: matched, skipped (no DB state), not found in DB.
 * Optionally updates seo_priority=true when --update flag is passed.
 *
 * Usage (analysis only):
 *   DATABASE_URL=... npx tsx src/analyze-district-masters.ts <xlsx>
 *
 * Usage (update DB):
 *   DATABASE_URL=... npx tsx src/analyze-district-masters.ts <xlsx> --update
 */

import XLSX from "xlsx";
import { Client } from "pg";
import { writeFileSync } from "fs";

const filePath = process.argv[2];
const doUpdate = process.argv.includes("--update");
if (!filePath) {
  console.error("Usage: tsx src/analyze-district-masters.ts <xlsx> [--update]");
  process.exit(1);
}

// ─── State name normalizer (xlsx → DB LOWER(state) fragment) ─────────────────
function xlsxStateToDb(s: string): string | null {
  const n = s.trim().toUpperCase();
  if (n.includes("N/A") || n.includes("OUTSIDE INDIA"))    return null;
  if (n.includes("ANDAMAN") || n.includes("NICOBAR"))      return null;
  if (n.includes("LAKSHADWEEP"))                            return null;
  if (n === "GOA" || n.includes("NORTH GOA") || n.includes("SOUTH GOA")) return null;
  if (n.includes("ANDHRA"))                                 return "andhra";
  if (n.includes("ARUNACHAL"))                              return "north eastern";
  if (n === "ASSAM")                                        return "assam";
  if (n === "BIHAR")                                        return "bihar";
  if (n.includes("CHANDIGARH"))                             return "haryana";
  if (n.includes("CHHATTISGARH") || n.includes("CHATTISGARH")) return "chattisgarh";
  if (n.includes("DADRA") || n.includes("DAMAN"))           return "gujarat";
  if (n.includes("DELHI"))                                   return "delhi";
  if (n.includes("GUJARAT"))                                 return "gujarat";
  if (n.includes("HARYANA"))                                 return "haryana";
  if (n.includes("HIMACHAL"))                                return "himachal";
  if (n.includes("JAMMU"))                                   return "jammu";
  if (n.includes("JHARKHAND"))                               return "jharkhand";
  if (n.includes("KARNATAKA"))                               return "karnataka";
  if (n.includes("KERALA"))                                  return "kerala";
  if (n.includes("MADHYA PRADESH"))                          return "madhya pradesh";
  if (n.includes("MAHARASHTRA"))                             return "maharashtra";
  if (n.includes("MANIPUR"))                                 return "north eastern";
  if (n.includes("MEGHALAYA"))                               return "north eastern";
  if (n.includes("MIZORAM"))                                 return "north eastern";
  if (n.includes("NAGALAND"))                                return "north eastern";
  if (n.includes("ODISHA") || n.includes("ORISSA"))          return "odisha";
  if (n.includes("PUDUCHERRY") || n.includes("PONDICHERRY")) return "tamilnadu";
  if (n.includes("PUNJAB"))                                  return "punjab";
  if (n.includes("RAJASTHAN"))                               return "rajasthan";
  if (n.includes("SIKKIM"))                                  return "north eastern";
  if (n.includes("TAMIL NADU") || n.includes("TAMILNADU"))  return "tamilnadu";
  if (n.includes("TELANGANA"))                               return "telangana";
  if (n.includes("TRIPURA"))                                 return "north eastern";
  if (n.includes("UTTAR PRADESH"))                           return "uttar pradesh";
  if (n.includes("UTTARAKHAND") || n.includes("UTTARANCHAL")) return "uttarakhand";
  if (n.includes("WEST BENGAL"))                             return "west bengal";
  return null;
}

// ─── Known corrections: xlsx city name → DB search term ──────────────────────
const CITY_CORRECTIONS: Record<string, string> = {
  // Andhra Pradesh
  "sri potti sriramulu nellore": "nellore", "y.s.r.": "kadapa",
  "ntr": "vijayawada",
  // Bihar
  "kaimur (bhabua)": "kaimur", "pashchim champaran": "west champaran",
  "purbi champaran": "east champaran",
  // Chhattisgarh
  "dakshin bastar dantewada": "dantewada", "uttar bastar kanker": "kanker",
  "janjgir - champa": "janjgir", "janjgir champa": "janjgir",
  // Gujarat
  "dohad": "dahod", "devbhoomi dwarka": "dwarka", "gir somnath": "gir",
  "panch mahals": "panchmahal", "the dangs": "dangs",
  "chhota udepur": "chhota udaipur", "sabar kantha": "sabarkantha",
  // Haryana
  "mewat": "nuh", "gurgaon": "gurugram",
  // HP
  "lahul spiti": "spiti", "lahul & spiti": "spiti", "kinnaur": "rampur",
  // J&K
  "badgam": "budgam", "bandipore": "bandipora", "shupiyan": "shopian",
  "punch": "poonch", "leh(ladakh)": "leh", "leh ladakh": "leh",
  "baramula": "baramulla",
  // Jharkhand
  "pashchimi singhbhum": "west singhbhum", "purbi singhbhum": "east singhbhum",
  "saraikela-kharsawan": "saraikela", "saraikela kharsawan": "saraikela",
  // Karnataka
  "belgaum": "belagavi", "gulbarga": "kalaburagi", "bellary": "ballari",
  "mysore": "mysuru", "shimoga": "shivamogga", "chikmagalur": "chikkamagalur",
  "bijapur": "vijayapura", "bangalore rural": "bangalore",
  "chikkaballapura": "chikballapur",
  // Maharashtra
  "ahmadnagar": "ahmednagar", "buldana": "buldhana", "bid": "beed",
  "gondiya": "gondia", "mumbai suburban": "mumbai",
  "chhatrapati sambhajinagar": "sambhajinagar",
  // Odisha
  "anugul": "angul", "baudh": "boudh", "nabarangapur": "nabarangpur",
  "baleshwar": "balasore", "kalahandi": "bhawanipatna", "khordha": "bhubaneswar",
  // Rajasthan
  "chittaurgarh": "chittorgarh", "dhaulpur": "dholpur",
  "jhunjhunun": "jhunjhunu",
  // Tamil Nadu
  "kancheepuram": "kanchipuram", "thoothukkudi": "tuticorin",
  "the nilgiris": "ooty", "thiruvallur": "tiruvallur", "thiruvarur": "tiruvarur",
  // Telangana
  "komaram bheem": "asifabad", "jayashankar": "bhupalapally",
  "jogulamba": "gadwal", "warangal rural": "warangal", "warangal urban": "warangal",
  "medchal-malkajgiri": "medchal", "yadadri": "bhongir",
  "mahbubnagar": "mahabubnagar",
  // UP
  "bara banki": "barabanki", "rae bareli": "raebareli",
  "sant kabir nagar": "khalilabad", "shrawasti": "bhinga",
  "siddharthnagar": "naugarh", "sonbhadra": "robertsganj",
  // West Bengal
  "south twenty four parganas": "south 24", "north twenty four parganas": "north 24",
  "haora": "howrah", "hugli": "hooghly", "maldah": "malda",
  "puruliya": "purulia", "darjiling": "darjeeling",
  "paschim bardhaman": "bardhaman", "purba bardhaman": "bardhaman",
  "barddhaman": "bardhaman", "paschim medinipur": "midnapore",
  "purba medinipur": "midnapore", "uttar dinajpur": "dinajpur",
  "dakshin dinajpur": "dinajpur", "koch bihar": "cooch behar",
  // Punjab
  "sahibzada ajit singh nagar": "mohali", "shahid bhagat singh nagar": "nawanshahr",
  // Delhi
  "central": "delhi", "east": "delhi", "new delhi": "new delhi",
  "north": "delhi", "north east": "delhi", "north west": "delhi",
  "shahdara": "shahdara", "south": "delhi", "south east delhi": "delhi",
  "south west": "delhi", "west": "delhi",
  // Assam
  "baksa": "baska", "charaideo": "sonari", "chirang": "kajalgaon",
  "dima hasao": "haflong", "kamrup metropolitan": "guwahati", "kamrup": "guwahati",
  "karbi anglong": "diphu", "sonitpur": "tezpur",
  "south salamara-mankachar": "dhubri", "west karbi anglong": "hamren",
  "sivasagar": "sibsagar",
  // Meghalaya
  "east garo hills": "tura", "east jaintia hills": "khliehriat",
  "east khasi hills": "shillong", "jaintia hills": "jowai",
  "north garo hills": "resubelpara", "ribhoi": "nongpoh",
  "south garo hills": "baghmara", "south west garo hills": "ampati",
  "south west khasi hills": "mawkyrwat", "west jaintia hills": "jowai",
  "west khasi hills": "nongstoin",
  // Manipur
  "imphal east": "imphal", "imphal west": "imphal",
  // Sikkim
  "east district": "gangtok", "north  district": "mangan",
  "south district": "namchi", "west district": "gyalshing",
  // Tripura
  "gomati": "udaipur", "south tripura": "belonia", "unakoti": "kailashahar",
  // MP
  "khandwa (east nimar)": "khandwa", "khargone (west nimar)": "khargone",
  "narsimhapur": "narsinghpur",
  // Arunachal
  "dibang valley": "roing", "east kameng": "seppa", "east siang": "pasighat",
  "kra daadi": "ziro", "kurung kumey": "koloriang",
  "lower dibang valley": "roing", "lower siang": "likabali",
  "lower subansiri": "ziro", "namsai": "namsai", "papum pare": "itanagar",
  "tirap": "deomali", "upper siang": "yingkiong", "upper subansiri": "daporijo",
  "west kameng": "bomdila", "west siang": "along", "siang": "along",
};

// ─── Parse XLSX ────────────────────────────────────────────────────────────────
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
const entries = rawRows.slice(1)
  .map(r => ({ state: String(r[0] ?? "").trim(), city: String(r[1] ?? "").trim() }))
  .filter(r => r.state && r.city);
console.log(`\nParsed ${entries.length} entries from xlsx`);

// ─── Load ALL active locations from DB once ────────────────────────────────────
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const { rows: [beforeRow] } = await db.query("SELECT COUNT(*) as cnt FROM locations WHERE seo_priority=true");
console.log(`seo_priority before: ${beforeRow.cnt}`);

const { rows: allLocs } = await db.query<{
  id: number; city: string|null; town: string|null;
  district: string|null; state: string; slug: string; population: number|null;
}>(
  `SELECT id, city, town, district, state, slug, population
   FROM locations WHERE is_active=true`
);
console.log(`Loaded ${allLocs.length} active locations from DB`);

// ─── Build multi-key index: lowercase name → locations ───────────────────────
type LocRow = typeof allLocs[0];
const nameIndex = new Map<string, LocRow[]>();
for (const loc of allLocs) {
  for (const field of [loc.city, loc.town, loc.district]) {
    if (!field) continue;
    const key = field.toLowerCase().trim();
    if (!nameIndex.has(key)) nameIndex.set(key, []);
    nameIndex.get(key)!.push(loc);
  }
}

// ─── In-memory matching ───────────────────────────────────────────────────────
function findMatch(statePat: string, searchTerm: string): LocRow | null {
  const termL = searchTerm.toLowerCase().trim();

  // Helper: filter candidates to matching state
  const filterState = (locs: LocRow[]) =>
    locs.filter(l => l.state.toLowerCase().includes(statePat) || statePat.includes(l.state.toLowerCase()));

  // 1. Exact name match within state
  const exactCands = nameIndex.get(termL) ?? [];
  const exactState = filterState(exactCands);
  if (exactState.length) {
    return exactState.sort((a, b) => (b.population ?? 0) - (a.population ?? 0))[0];
  }

  // 2. Partial substring match (term starts name)
  for (const [key, locs] of nameIndex) {
    if (key.startsWith(termL) || termL.startsWith(key)) {
      if (key === termL) continue; // already tried
      const stateMatches = filterState(locs);
      if (stateMatches.length) {
        return stateMatches.sort((a, b) => (b.population ?? 0) - (a.population ?? 0))[0];
      }
    }
  }

  // 3. First significant word
  const firstWord = termL.split(/[\s\-]+/).find(w => w.length >= 4);
  if (firstWord && firstWord !== termL) {
    const fwCands = nameIndex.get(firstWord) ?? [];
    const fwState = filterState(fwCands);
    if (fwState.length) {
      return fwState.sort((a, b) => (b.population ?? 0) - (a.population ?? 0))[0];
    }
    // Also check if any key starts with firstWord
    for (const [key, locs] of nameIndex) {
      if (key.startsWith(firstWord) || firstWord.startsWith(key.substring(0, 5))) {
        const stateMatches = filterState(locs);
        if (stateMatches.length) {
          return stateMatches.sort((a, b) => (b.population ?? 0) - (a.population ?? 0))[0];
        }
      }
    }
  }

  return null;
}

const resolvedIds = new Set<number>();
const matched: Array<{ raw: string; slug: string }> = [];
const skipped: string[] = [];
const notFound: string[] = [];

for (const entry of entries) {
  const statePat = xlsxStateToDb(entry.state);
  if (!statePat) {
    skipped.push(`${entry.state} | ${entry.city}`);
    continue;
  }

  const cityKey = entry.city.toLowerCase().trim();
  const searchTerm = CITY_CORRECTIONS[cityKey] ?? cityKey;
  const found = findMatch(statePat, searchTerm);

  if (!found) {
    notFound.push(`${entry.state} | ${entry.city} → [search: ${searchTerm}] in [${statePat}]`);
    continue;
  }

  if (!resolvedIds.has(found.id)) {
    resolvedIds.add(found.id);
    matched.push({ raw: `${entry.state} | ${entry.city}`, slug: found.slug });
  }
}

console.log(`\n=== ANALYSIS ===`);
console.log(`Total entries:           ${entries.length}`);
console.log(`Skipped (state not in DB): ${skipped.length}`);
console.log(`Not found in DB:         ${notFound.length}`);
console.log(`Matched (unique DB rows): ${resolvedIds.size}`);
console.log(`(Previously matched):    741`);
console.log(`(New matches found):     ${resolvedIds.size - 741}`);

if (notFound.length) {
  console.log(`\n--- NOT FOUND IN DB (${notFound.length}) ---`);
  notFound.forEach(x => console.log("  ", x));
}
if (skipped.length) {
  console.log(`\n--- SKIPPED STATES (${skipped.length}) ---`);
  skipped.forEach(x => console.log("  ", x));
}

// ─── Update if requested ───────────────────────────────────────────────────────
if (doUpdate && resolvedIds.size > 0) {
  console.log(`\nUpdating ${resolvedIds.size} locations to seo_priority=true...`);
  const ids = [...resolvedIds];
  const CHUNK = 500;
  let updated = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const ph = chunk.map((_, j) => `$${j + 1}`).join(",");
    const r = await db.query(
      `UPDATE locations SET seo_priority=true WHERE id IN (${ph}) AND seo_priority=false`,
      chunk
    );
    updated += r.rowCount ?? 0;
  }
  const { rows: [afterRow] } = await db.query("SELECT COUNT(*) as cnt FROM locations WHERE seo_priority=true");
  console.log(`Updated ${updated} rows. Total priority: ${afterRow.cnt}`);
  console.log(`pSEO URLs: ${afterRow.cnt} × 143 = ${Number(afterRow.cnt) * 143}`);
  const filesNeeded = Math.ceil(Number(afterRow.cnt) / Math.floor(50000 / 143));
  console.log(`pSEO sitemap files: ${filesNeeded}`);
}

// ─── Write report ─────────────────────────────────────────────────────────────
const reportPath = `/tmp/district-analysis-${Date.now()}.json`;
writeFileSync(reportPath, JSON.stringify({
  totalEntries: entries.length,
  skipped: skipped.length,
  notFound: notFound.length,
  uniqueMatches: resolvedIds.size,
  skippedList: skipped,
  notFoundList: notFound,
  matchedList: matched,
}, null, 2));
console.log(`\nFull report: ${reportPath}`);

await db.end();

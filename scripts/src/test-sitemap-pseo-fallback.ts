#!/usr/bin/env tsx
/**
 * Integration test: pSEO sitemap fallback after seo_priority schema reset.
 *
 * Simulates a publish that drops/re-adds the seo_priority column (all rows
 * revert to DEFAULT false). Verifies:
 *
 *   Phase 1 — Baseline: sitemap shows 3 pSEO files (741 priority locations).
 *   Phase 2 — Reset:    after setting all seo_priority=false, hitting
 *                        /api/sitemap.xml?_force_seed_check=1 triggers the
 *                        auto-seed fallback and still produces 3 pSEO files.
 *   Phase 3 — Re-seed:  running the canonical seed script restores the correct
 *                        741-slug list and the sitemap still shows 3 pSEO files.
 *
 * Usage:
 *   cd scripts && npx tsx src/test-sitemap-pseo-fallback.ts
 *
 * Requirements:
 *   - API server must be running (NODE_ENV != production) on $API_URL
 *     (default: http://localhost:8080)
 *   - DATABASE_URL must point to the same DB the server uses
 *   - Run the canonical seed first: npx tsx src/seed-priority-cities.ts
 */

import { Client } from "pg";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const API_URL = process.env.API_URL ?? "http://localhost:8080";
const FALLBACK_PRIORITY_COUNT = 741;
const LOC_PER_PSEO_FILE = Math.floor(50_000 / 143); // 349 — matches locations.ts
const MIN_PSEO_FILES = Math.ceil(FALLBACK_PRIORITY_COUNT / LOC_PER_PSEO_FILE); // 3
const MIN_PRIORITY_THRESHOLD = 100; // matches locations.ts

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pass = 0;
let fail = 0;

function assert(condition: boolean, label: string, detail = ""): void {
  if (condition) {
    console.log(`  ✅  ${label}`);
    pass++;
  } else {
    console.error(`  ❌  FAIL: ${label}${detail ? `  — ${detail}` : ""}`);
    fail++;
  }
}

async function countPriority(db: Client): Promise<number> {
  const { rows: [{ cnt }] } = await db.query(
    "SELECT COUNT(*) AS cnt FROM locations WHERE seo_priority = true AND is_active = true"
  );
  return Number(cnt);
}

async function fetchSitemap(forceSeedCheck = false): Promise<string> {
  const url = `${API_URL}/api/sitemap.xml${forceSeedCheck ? "?_force_seed_check=1" : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return res.text();
}

function countPseoFiles(xml: string): number {
  return (xml.match(/sitemap-pseo-\d+\.xml/g) ?? []).length;
}

// ─── main ────────────────────────────────────────────────────────────────────

const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

try {
  // ── Phase 1: Baseline ────────────────────────────────────────────────────
  console.log("\n═══ Phase 1: Baseline ═══");

  const baselinePriority = await countPriority(db);
  console.log(`  Priority locations in DB:  ${baselinePriority}`);
  assert(baselinePriority >= FALLBACK_PRIORITY_COUNT,
    `DB has ≥ ${FALLBACK_PRIORITY_COUNT} priority locations`,
    `got ${baselinePriority}`);

  const baselineXml = await fetchSitemap();
  const baselinePseoFiles = countPseoFiles(baselineXml);
  console.log(`  pSEO files in sitemap.xml: ${baselinePseoFiles}`);
  assert(baselinePseoFiles >= MIN_PSEO_FILES,
    `Sitemap shows ≥ ${MIN_PSEO_FILES} pSEO file(s)`,
    `got ${baselinePseoFiles}`);

  // ── Phase 2: Simulate schema reset (all seo_priority → false) ────────────
  console.log("\n═══ Phase 2: Simulated schema reset (seo_priority=false) ═══");

  await db.query("UPDATE locations SET seo_priority = false WHERE is_active = true");
  const afterReset = await countPriority(db);
  console.log(`  Priority locations after reset: ${afterReset}`);
  assert(afterReset === 0,
    "All priority flags cleared",
    `expected 0, got ${afterReset}`);
  assert(afterReset < MIN_PRIORITY_THRESHOLD,
    `Count (${afterReset}) is below MIN_PRIORITY_THRESHOLD (${MIN_PRIORITY_THRESHOLD}) — fallback will fire`);

  // Hit the sitemap with ?_force_seed_check=1 to bypass the 60s in-memory cache
  // and immediately re-evaluate the DB state (dev/test only parameter).
  const fallbackXml = await fetchSitemap(true);
  const fallbackPseoFiles = countPseoFiles(fallbackXml);
  console.log(`  pSEO files after fallback seed: ${fallbackPseoFiles}`);

  const afterFallback = await countPriority(db);
  console.log(`  Priority locations after fallback: ${afterFallback}`);

  assert(afterFallback >= FALLBACK_PRIORITY_COUNT,
    `Fallback seeded ≥ ${FALLBACK_PRIORITY_COUNT} locations`,
    `got ${afterFallback}`);
  assert(afterFallback < MIN_PRIORITY_THRESHOLD || afterFallback >= FALLBACK_PRIORITY_COUNT,
    "Fallback seed count is in valid range");
  assert(fallbackPseoFiles >= MIN_PSEO_FILES,
    `Sitemap still shows ≥ ${MIN_PSEO_FILES} pSEO file(s) after fallback`,
    `got ${fallbackPseoFiles}`);

  // Verify file count math: ceil(afterFallback / LOC_PER_PSEO_FILE)
  const expectedFiles = Math.max(1, Math.ceil(afterFallback / LOC_PER_PSEO_FILE));
  assert(fallbackPseoFiles === expectedFiles,
    `File count matches ceil(${afterFallback}/${LOC_PER_PSEO_FILE}) = ${expectedFiles}`,
    `got ${fallbackPseoFiles}`);

  // ── Phase 3: Restore canonical seed ──────────────────────────────────────
  console.log("\n═══ Phase 3: Restore canonical seed ═══");

  // Clear all flags first so the canonical seed produces exactly FALLBACK_PRIORITY_COUNT
  // rows and doesn't inherit any fallback-seeded rows from Phase 2.
  await db.query("UPDATE locations SET seo_priority = false WHERE is_active = true");
  console.log("  Reset all seo_priority=false before canonical re-seed");
  console.log("  Running seed-priority-cities.ts …");
  const seedOut = execSync(
    `npx tsx ${path.join(__dirname, "seed-priority-cities.ts")}`,
    { env: process.env, encoding: "utf8", cwd: path.join(__dirname, "..") }
  );
  const seededLine = seedOut.match(/seo_priority before: \d+\s+→\s+after: (\d+)/)?.[1];
  console.log(`  Seed output: after=${seededLine ?? "?"}`);

  const restoredPriority = await countPriority(db);
  console.log(`  Priority locations after restore: ${restoredPriority}`);
  assert(restoredPriority >= FALLBACK_PRIORITY_COUNT,
    `Restored ≥ ${FALLBACK_PRIORITY_COUNT} priority locations`,
    `got ${restoredPriority}`);

  // Re-check sitemap (force seed re-check)
  const restoredXml = await fetchSitemap(true);
  const restoredPseoFiles = countPseoFiles(restoredXml);
  console.log(`  pSEO files after restore:  ${restoredPseoFiles}`);
  assert(restoredPseoFiles >= MIN_PSEO_FILES,
    `Sitemap shows ≥ ${MIN_PSEO_FILES} pSEO file(s) after restore`,
    `got ${restoredPseoFiles}`);

} finally {
  await db.end();
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
if (fail > 0) {
  console.error("❌  Integration test FAILED");
  process.exit(1);
} else {
  console.log("✅  All assertions passed — pSEO fallback is working correctly");
}

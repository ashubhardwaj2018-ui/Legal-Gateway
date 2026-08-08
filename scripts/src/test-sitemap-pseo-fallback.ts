#!/usr/bin/env tsx
/**
 * Integration test: pSEO sitemap fallback after seo_priority schema reset.
 *
 * Simulates a publish that drops/re-adds the seo_priority column (all rows
 * revert to DEFAULT false). Verifies:
 *
 *   Phase 1 — Baseline:  sitemap shows the expected pSEO file count.
 *   Phase 2 — Reset:     after setting all seo_priority=false, hitting
 *                         /api/sitemap.xml?_force_seed_check=1 triggers the
 *                         auto-seed fallback and still produces the minimum
 *                         pSEO file count.
 *   Phase 3 — Restore:   snapshot is restored to the exact pre-test state and
 *                         sitemap reflects the original count again.
 *
 * ── Safety guards ──────────────────────────────────────────────────────────
 * This test modifies seo_priority flags in the database. Before any DML it:
 *   1. Refuses to run against a non-local database unless --allow-production
 *      is explicitly passed on the command line.
 *   2. Snapshots every seo_priority=true ID before the first UPDATE.
 *   3. Restores from the snapshot in a guaranteed finally block (runs even on
 *      assertion failures or unexpected errors).
 *
 * Usage:
 *   # Against local DB (default; no extra flag needed):
 *   cd scripts && DATABASE_URL="<local-url>" npx tsx src/test-sitemap-pseo-fallback.ts
 *
 *   # Against a remote DB (explicit opt-in):
 *   cd scripts && DATABASE_URL="<remote-url>" npx tsx src/test-sitemap-pseo-fallback.ts --allow-production
 *
 * Requirements:
 *   - API server must be running at $API_URL (default: http://localhost:8080)
 *     with NODE_ENV != "production" so the ?_force_seed_check param is active.
 */

import { Client } from "pg";

// ─── Constants (must match locations.ts) ─────────────────────────────────────
const FALLBACK_PRIORITY_COUNT = 741;
const LOC_PER_PSEO_FILE       = Math.floor(50_000 / 143); // 349
const MIN_PRIORITY_THRESHOLD  = 100;
const MIN_PSEO_FILES          = Math.ceil(FALLBACK_PRIORITY_COUNT / LOC_PER_PSEO_FILE); // 3

const API_URL = process.env.API_URL ?? "http://localhost:8080";

// ─── Safety guard ─────────────────────────────────────────────────────────────
// Refuse to mutate a non-local database unless the caller explicitly opts in.
function assertSafeDatabase(): void {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl) {
    console.error("❌  DATABASE_URL is not set. Aborting.");
    process.exit(1);
  }
  const allowProduction = process.argv.includes("--allow-production");
  // Consider it "local" if it targets localhost/127.0.0.1 or a Docker service
  const isLocal =
    dbUrl.includes("localhost") ||
    dbUrl.includes("127.0.0.1") ||
    dbUrl.includes("@db:") ||
    dbUrl.includes("@postgres:");
  if (!isLocal && !allowProduction) {
    console.error(
      "❌  DATABASE_URL does not appear to be a local database.\n" +
      "    This test modifies seo_priority flags.\n" +
      "    Pass --allow-production to run against a remote database."
    );
    process.exit(1);
  }
  if (!isLocal) {
    console.warn("⚠️  Running against a non-local database (--allow-production set).");
  }
}

// ─── Assertion helpers ────────────────────────────────────────────────────────
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

// ─── DB helpers ───────────────────────────────────────────────────────────────
async function countPriority(db: Client): Promise<number> {
  const { rows: [{ cnt }] } = await db.query(
    "SELECT COUNT(*)::int AS cnt FROM locations WHERE seo_priority = true AND is_active = true"
  );
  return cnt as number;
}

/** Capture all IDs currently marked seo_priority=true (snapshot for restore). */
async function snapshotPriorityIds(db: Client): Promise<number[]> {
  const { rows } = await db.query(
    "SELECT id FROM locations WHERE seo_priority = true"
  );
  return rows.map((r: { id: number }) => r.id);
}

/**
 * Restore from snapshot: reset all flags, then re-set exactly the snapshotted IDs.
 * Runs inside a transaction for atomicity.
 */
async function restoreFromSnapshot(db: Client, ids: number[]): Promise<void> {
  await db.query("BEGIN");
  try {
    await db.query("UPDATE locations SET seo_priority = false");
    if (ids.length > 0) {
      await db.query(
        "UPDATE locations SET seo_priority = true WHERE id = ANY($1::int[])",
        [ids]
      );
    }
    await db.query("COMMIT");
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
async function fetchSitemapXml(forceSeedCheck = false): Promise<string> {
  const url = `${API_URL}/api/sitemap.xml${forceSeedCheck ? "?_force_seed_check=1" : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return res.text();
}

function countPseoFiles(xml: string): number {
  return (xml.match(/sitemap-pseo-\d+\.xml/g) ?? []).length;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
assertSafeDatabase();

const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

// Snapshot before any mutation — restored unconditionally in finally.
const snapshotIds = await snapshotPriorityIds(db);
console.log(`\nSnapshot: ${snapshotIds.length} priority location(s) recorded.`);

try {

  // ── Phase 1: Baseline ─────────────────────────────────────────────────────
  console.log("\n═══ Phase 1: Baseline ═══");

  const baselineCount = await countPriority(db);
  console.log(`  Priority locations in DB:  ${baselineCount}`);
  assert(
    baselineCount >= FALLBACK_PRIORITY_COUNT,
    `DB has ≥ ${FALLBACK_PRIORITY_COUNT} priority locations`,
    `got ${baselineCount}`
  );

  const baselineXml   = await fetchSitemapXml();
  const baselineFiles = countPseoFiles(baselineXml);
  const expectedBaselineFiles = Math.max(1, Math.ceil(baselineCount / LOC_PER_PSEO_FILE));
  console.log(`  pSEO files in sitemap.xml: ${baselineFiles}`);
  assert(
    baselineFiles >= MIN_PSEO_FILES,
    `Sitemap shows ≥ ${MIN_PSEO_FILES} pSEO file(s)`,
    `got ${baselineFiles}`
  );
  assert(
    baselineFiles === expectedBaselineFiles,
    `File count matches ceil(${baselineCount}/${LOC_PER_PSEO_FILE}) = ${expectedBaselineFiles}`,
    `got ${baselineFiles}`
  );

  // ── Phase 2: Simulated schema reset + fallback verification ──────────────
  console.log("\n═══ Phase 2: Simulated schema reset (seo_priority=false) ═══");

  await db.query("UPDATE locations SET seo_priority = false WHERE is_active = true");
  const afterReset = await countPriority(db);
  console.log(`  Priority locations after reset: ${afterReset}`);
  assert(afterReset === 0,           "All priority flags cleared",                 `expected 0, got ${afterReset}`);
  assert(afterReset < MIN_PRIORITY_THRESHOLD,
    `Count (${afterReset}) is below MIN_PRIORITY_THRESHOLD (${MIN_PRIORITY_THRESHOLD}) — fallback will fire`
  );

  // Hit sitemap with ?_force_seed_check=1 to bypass the 60s in-memory cache
  // and immediately re-evaluate the DB state (dev/test only parameter).
  const fallbackXml   = await fetchSitemapXml(true);
  const fallbackFiles = countPseoFiles(fallbackXml);
  const afterFallback = await countPriority(db);

  console.log(`  Priority locations after fallback seed: ${afterFallback}`);
  console.log(`  pSEO files in sitemap after fallback:   ${fallbackFiles}`);

  assert(
    afterFallback === FALLBACK_PRIORITY_COUNT,
    `Fallback seeded exactly ${FALLBACK_PRIORITY_COUNT} locations`,
    `got ${afterFallback}`
  );
  assert(
    fallbackFiles >= MIN_PSEO_FILES,
    `Sitemap still shows ≥ ${MIN_PSEO_FILES} pSEO file(s) after fallback`,
    `got ${fallbackFiles}`
  );
  const expectedFallbackFiles = Math.max(1, Math.ceil(afterFallback / LOC_PER_PSEO_FILE));
  assert(
    fallbackFiles === expectedFallbackFiles,
    `File count matches ceil(${afterFallback}/${LOC_PER_PSEO_FILE}) = ${expectedFallbackFiles}`,
    `got ${fallbackFiles}`
  );

} finally {
  // ── Phase 3: Guaranteed restore from snapshot ─────────────────────────────
  // Runs even if an assertion fails or an unexpected error is thrown above.
  console.log("\n═══ Phase 3: Restore from snapshot ═══");

  try {
    await restoreFromSnapshot(db, snapshotIds);
    const restoredCount = await countPriority(db);
    console.log(`  Priority locations after restore: ${restoredCount}`);
    assert(
      restoredCount === snapshotIds.length,
      `Exactly ${snapshotIds.length} priority location(s) restored`,
      `got ${restoredCount}`
    );

    const restoredXml   = await fetchSitemapXml(true);
    const restoredFiles = countPseoFiles(restoredXml);
    const expectedRestoredFiles = Math.max(1, Math.ceil(restoredCount / LOC_PER_PSEO_FILE));
    console.log(`  pSEO files after restore: ${restoredFiles}`);
    assert(
      restoredFiles === expectedRestoredFiles,
      `Sitemap shows exactly ${expectedRestoredFiles} pSEO file(s) after restore`,
      `got ${restoredFiles}`
    );
  } catch (restoreErr) {
    console.error("❌  CRITICAL: restore from snapshot failed!", restoreErr);
    fail++;
  } finally {
    await db.end();
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
if (fail > 0) {
  console.error("❌  Integration test FAILED");
  process.exit(1);
} else {
  console.log("✅  All assertions passed — pSEO fallback is working correctly");
}

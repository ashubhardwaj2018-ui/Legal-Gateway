---
name: pSEO priority city count
description: Current authoritative priority location count and how it was derived from the district master XLSX
---

# pSEO Priority City Count

## Rule
FALLBACK_PRIORITY_COUNT = **1,560** (updated from 741 on 2026-08-08)

**Why:** The district master XLSX (1,763 rows) was processed with a fast bulk in-memory matcher. Only 741 matched on the first (slow, timed-out) run. Re-run with the fast script (`scripts/src/analyze-district-masters.ts`) matched 1,149 unique DB locations; combined with the original 741 the union is 1,560.

**How to apply:** Any constant or seed that references the "correct" priority count should use 1,560. The fallback auto-seeder in `locations.ts` seeds the top-1560 by population when the column is unseeded.

## Current state (as of 2026-08-08)
- Priority locations in DB: **1,560**
- pSEO sitemap files: **5** (ceil(1560/349))
- Company sitemap files: **21** (ceil(1,048,585/50,000))
- Total child sitemaps: **28** (5 + 21 + sitemap-static + sitemap-blogs)

## Still unmatched (198 district gaps)
These are district HQs in the XLSX that have no matching city/town in the locations table.
See `scripts/src/analyze-district-masters.ts` CITY_CORRECTIONS map to fix them.
Key gaps: Solapur (MH), Chandigarh, Karimganj (AS), Saraikela (JH), Davanagere (KA),
Ahmadabad (GJ — note: "ahmedabad" without 'd' is in DB), Tapi (GJ), Sivasagar (AS).

## Key files
- `artifacts/api-server/src/routes/locations.ts` — FALLBACK_PRIORITY_COUNT, LOC_PER_PSEO_FILE
- `scripts/src/seed-priority-cities.ts` — authoritative 1,560 slug list
- `scripts/src/analyze-district-masters.ts` — fast bulk re-importer from XLSX
- `artifacts/lawfirm/public/sitemap.xml` — static sitemap index (needs regen on count change)
- `scripts/generate-sitemap-index.mjs` — regeneration script

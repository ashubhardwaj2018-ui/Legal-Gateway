---
name: pSEO Sitemap Architecture
description: How the programmatic SEO sitemap is structured and generated for scale
---

## Sitemap Strategy

- **Sitemap index**: `GET /api/sitemap.xml` — dynamically lists all sub-sitemaps based on DB location count
- **Static sitemap**: `GET /api/sitemap-static.xml` — home, about, services, all 143 service pages
- **Blog sitemap**: `GET /api/sitemap-blogs.xml` — queries blogsTable (status = "published")
- **Company sitemap**: `GET /api/sitemap-companies.xml` — queries indianCompaniesTable
- **pSEO sitemaps**: `GET /api/sitemap-pseo-{N}.xml` — paginated by location, N files split at 50k URLs

## Scale Numbers (as of implementation)

- 150,497 active locations × 143 services = **21.5M pSEO URLs**
- 349 locations per pSEO file → **432 sitemap files**
- Each file cached 24h (`Cache-Control: public, max-age=86400`)

## LOC_PER_PSEO_FILE formula

```
LOC_PER_PSEO_FILE = floor(50,000 / ALL_UNIQUE_SERVICE_SLUGS.length)
```

ALL_UNIQUE_SERVICE_SLUGS comes from `ALL_SERVICE_PAGES` array in `artifacts/api-server/src/routes/locations.ts` — must be kept in sync with frontend `services.ts`.

## robots.txt

Two sources (both correct):
1. Static file: `artifacts/lawfirm/public/robots.txt` (served by Vite/static)
2. Dynamic: `GET /api/robots.txt` (includes request host in sitemap URL)

**Why:** Static file is served immediately; API route generates correct absolute URL based on request host for deployment environments.

## service_locations table

Used for FEATURED/PRIORITY pairs only — NOT a complete enumeration of all 21M combos (impractical at scale). Dynamic pSEO pages work via catch-all route without DB entries. Unique index: `(service_id, location_id)`.

Admin rebuild endpoint (`POST /admin/locations/rebuild-relationships`) creates rows for top 5000 locations × 47 priority service slugs.

## LocalBusiness / LegalService Schema

Added to `generateJsonLd()` in `content-engine.ts` — fourth item in the returned array. Uses `LegalService` type (subtype of LocalBusiness). Includes geo coordinates when available from location row.

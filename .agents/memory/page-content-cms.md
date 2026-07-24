---
name: Page Content CMS
description: DB table, API routes, and frontend hook for the page editor CMS feature.
---

## Database
Table: `page_content` (in `lib/db/src/schema/page-content.ts`)
- `id` serial PK
- `page` text (e.g. "home", "about", "careers")
- `block_id` text (e.g. "hero_title", "stat_1_value")
- `content` text
- `updated_at` timestamp
- UNIQUE index on (page, block_id)

## API Endpoints
- **Public:** `GET /api/pages/:page` → returns `Record<blockId, content>` (no auth)
- **Admin GET:** `GET /api/admin/pages/:page` → same, via admin router
- **Admin PUT:** `PUT /api/admin/pages/:page` body: `{ content: Record<blockId, string> }` → bulk upsert

Routes in `artifacts/api-server/src/routes/admin/pages.ts` and `artifacts/api-server/src/routes/public-pages.ts`.

## Frontend Hook
`artifacts/lawfirm/src/hooks/usePageContent.ts`

```ts
const get = usePageContent("home");
// returns (blockId, fallback) => string
// empty string from DB = use fallback
const title = get("hero_title", "Expert Legal Counsel,");
```

Uses `@tanstack/react-query` with staleTime 30s, gcTime 60s.

## Pages Updated
- `home.tsx`: hero badge/title/subtitle/description, 4 stats, 3 features, process section
- `about.tsx`: hero badge/title/subtitle/description, 4 stats

## Admin UI
`artifacts/lawfirm/src/pages/admin/page-editor.tsx`
- Route: `/admin/page-editor`
- Covers: Home, About, Careers, Privacy Policy, Terms of Use
- Sections/fields defined in PAGES constant inside component
- Fetches existing content on page select, saves via PUT endpoint

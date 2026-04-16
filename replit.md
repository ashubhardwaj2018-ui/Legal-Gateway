# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Legal Services Website (`artifacts/lawfirm`)
- **Type**: react-vite (frontend only, no backend)
- **Preview path**: `/`
- **Description**: Professional Indian law firm website with full service listing
- **Color palette**: Navy (#0f2044) and Gold (#c9a227)
- **Services covered**: Trademark & IP, Documentation, Fundraising, NGO, Property & Personal, Lawyers & Experts
- **Key files**:
  - `src/App.tsx` — Router setup with wouter (public routes + admin routes)
  - `src/pages/home.tsx` — Full homepage with all sections
  - `src/pages/service-category.tsx` — Dynamic service category pages
  - `src/data/services.ts` — All service data (categories, services, descriptions, prices)
  - `src/components/layout/Navbar.tsx` — Navigation with dropdown menus
  - `src/components/layout/Footer.tsx` — Footer with all service links
  - `src/index.css` — Theme variables (navy/gold palette)
- **Features**: Scroll animations (framer-motion), service cards, lawyer profiles, testimonials, FAQ accordion, consultation CTAs
- **Admin panel**: Comprehensive admin at `/admin` with 10 sections:
  - Dashboard (stats + recent activity)
  - Leads management (consultation requests, status update, CSV export)
  - Contacts management (contact messages, mark read)
  - Quotation builder (create with line items, GST, send to client)
  - SEO Manager (meta title/desc/keywords/OG tags per page, preview mode)
  - Services & Pricing editor (per-service config with pricing)
  - Company Data (CSV bulk import, search, pagination)
  - Newsletter subscribers (list, export, copy emails)
  - Lawyer Profiles (add/edit/delete with full profile)
  - Site Settings (firm identity, contact info, hours, social links)

### API Server (`artifacts/api-server`)
- **Type**: Express API
- **Routes**: `/api/*`
- **DB tables**: consultations, contacts, newsletter, seo_settings, services_config, quotations, company_data, lawyer_profiles, site_settings
- **OpenAPI spec**: `lib/api-spec/openapi.yaml`
- **Generated client**: `lib/api-client-react/` (React Query hooks via Orval)
- **Generated Zod schemas**: `lib/api-zod/`

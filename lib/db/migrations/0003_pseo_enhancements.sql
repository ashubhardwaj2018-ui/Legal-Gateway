-- ── pSEO enhancements ───────────────────────────────────────────────────────
-- 1. Unique constraint on service_locations (serviceId × locationId)
-- 2. Sitemap generation log table

ALTER TABLE service_locations
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_title text,
  ADD COLUMN IF NOT EXISTS custom_description text;

CREATE UNIQUE INDEX IF NOT EXISTS service_locations_unique_idx
  ON service_locations (service_id, location_id);

CREATE TABLE IF NOT EXISTS sitemap_logs (
  id serial PRIMARY KEY,
  urls_generated integer NOT NULL DEFAULT 0,
  pseo_files integer NOT NULL DEFAULT 0,
  blogs_included integer NOT NULL DEFAULT 0,
  companies_included integer NOT NULL DEFAULT 0,
  locations_covered integer NOT NULL DEFAULT 0,
  pinged_google boolean NOT NULL DEFAULT false,
  pinged_bing boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

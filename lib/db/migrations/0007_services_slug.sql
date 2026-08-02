-- Add slug column to services_config for stable CSV-based upsert identity
ALTER TABLE services_config
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Create unique index so ON CONFLICT (slug) works
CREATE UNIQUE INDEX IF NOT EXISTS services_config_slug_idx
  ON services_config (slug)
  WHERE slug IS NOT NULL;

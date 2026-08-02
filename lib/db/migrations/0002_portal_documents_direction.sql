-- Migration: portal_documents — add direction column for firm-to-client file sharing
-- Applied: 2026-07-31
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS

-- "client_to_firm" = uploaded by client (original behaviour, default)
-- "firm_to_client" = sent by an admin/employee to the client through the portal
ALTER TABLE portal_documents
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'client_to_firm';

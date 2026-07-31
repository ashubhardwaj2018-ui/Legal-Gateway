-- Migration: Customer Portal — new tables and quotation acceptance columns
-- Applied: 2026-07-31
-- Safe to re-run: all statements use IF NOT EXISTS / IF NOT EXISTS-equivalent guards.

-- ── Quotation acceptance / rejection columns ──────────────────────────────────
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

-- ── Portal Documents ──────────────────────────────────────────────────────────
-- Documents uploaded by clients through the client portal.
CREATE TABLE IF NOT EXISTS portal_documents (
  id           SERIAL PRIMARY KEY,
  lead_id      INTEGER NOT NULL,
  client_email TEXT    NOT NULL,
  file_name    TEXT    NOT NULL,
  file_url     TEXT    NOT NULL,
  file_size    INTEGER NOT NULL DEFAULT 0,
  mime_type    TEXT    NOT NULL DEFAULT 'application/octet-stream',
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS portal_documents_lead_idx  ON portal_documents (lead_id);
CREATE INDEX IF NOT EXISTS portal_documents_email_idx ON portal_documents (client_email);

-- ── Portal Chat Messages ──────────────────────────────────────────────────────
-- Real-time chat between a client and their assigned employee via the portal.
-- sender_type: 'client' | 'employee'
CREATE TABLE IF NOT EXISTS portal_chat_messages (
  id           SERIAL PRIMARY KEY,
  lead_id      INTEGER NOT NULL,
  client_email TEXT    NOT NULL,
  sender_type  TEXT    NOT NULL DEFAULT 'client',
  sender_name  TEXT    NOT NULL,
  message      TEXT    NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS portal_chat_lead_idx ON portal_chat_messages (lead_id);

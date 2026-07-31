-- Migration: WhatsApp CRM Integration Module
-- Applied: 2026-07-31
-- All statements use IF NOT EXISTS guards for idempotent re-application.

-- ── Additional WhatsApp fields on leads ───────────────────────────────────────
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS country_code        TEXT    DEFAULT '+91';
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS whatsapp_verified   BOOLEAN DEFAULT FALSE;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS last_whatsapp_message TEXT;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS last_whatsapp_date  TIMESTAMPTZ;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS whatsapp_status     TEXT    DEFAULT 'unknown';

-- ── WhatsApp Templates ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id          SERIAL PRIMARY KEY,
  name        TEXT    NOT NULL,
  category    TEXT    NOT NULL DEFAULT 'general',
  body        TEXT    NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── WhatsApp Message Log ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id             SERIAL PRIMARY KEY,
  lead_id        INTEGER,
  to_number      TEXT    NOT NULL,
  from_number    TEXT,
  message        TEXT    NOT NULL,
  template_id    INTEGER,
  template_name  TEXT,
  sender_type    TEXT    NOT NULL DEFAULT 'employee',
  sender_name    TEXT,
  sender_id      INTEGER,
  direction      TEXT    NOT NULL DEFAULT 'outgoing',
  status         TEXT    NOT NULL DEFAULT 'sent',
  provider       TEXT    NOT NULL DEFAULT 'web',
  is_bulk        BOOLEAN NOT NULL DEFAULT FALSE,
  bulk_batch_id  TEXT,
  error_message  TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wa_messages_lead_idx  ON whatsapp_messages (lead_id);
CREATE INDEX IF NOT EXISTS wa_messages_created_idx ON whatsapp_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS wa_messages_bulk_idx  ON whatsapp_messages (bulk_batch_id);

-- ── Auto-Trigger Configuration ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_triggers (
  id          SERIAL PRIMARY KEY,
  event       TEXT    NOT NULL UNIQUE,
  template_id INTEGER,
  is_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default trigger rows (all disabled by default)
INSERT INTO whatsapp_triggers (event, is_enabled) VALUES
  ('lead_created',        FALSE),
  ('lead_assigned',       FALSE),
  ('status_changed',      FALSE),
  ('quotation_sent',      FALSE),
  ('invoice_sent',        FALSE),
  ('payment_reminder',    FALSE),
  ('document_requested',  FALSE),
  ('service_completed',   FALSE),
  ('portal_created',      FALSE)
ON CONFLICT (event) DO NOTHING;

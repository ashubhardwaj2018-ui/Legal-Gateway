-- Migration 0006: audit_logs table for DB Manager write history
CREATE TABLE IF NOT EXISTS audit_logs (
  id             SERIAL PRIMARY KEY,
  table_name     TEXT NOT NULL,
  row_id         TEXT,
  action         TEXT NOT NULL,
  changed_data   JSONB,
  actor_username TEXT NOT NULL DEFAULT 'system',
  ip_address     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_table_idx   ON audit_logs (table_name);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx   ON audit_logs (actor_username);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_row_idx     ON audit_logs (table_name, row_id);

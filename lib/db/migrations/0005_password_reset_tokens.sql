-- Migration: password_reset_tokens table
-- Stores time-limited tokens for forgot-password / reset-password flow

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          SERIAL PRIMARY KEY,
  token       TEXT        NOT NULL UNIQUE,
  user_id     INTEGER     NOT NULL,
  user_type   TEXT        NOT NULL,    -- 'admin' | 'employee'
  email       TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS prt_token_idx ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS prt_email_idx ON password_reset_tokens(email);

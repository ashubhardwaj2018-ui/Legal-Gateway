CREATE TABLE IF NOT EXISTS shared_document_tokens (
  id         SERIAL PRIMARY KEY,
  token      TEXT        NOT NULL UNIQUE,
  doc_type   TEXT        NOT NULL,
  doc_id     TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sdt_token_idx ON shared_document_tokens (token);
CREATE INDEX IF NOT EXISTS sdt_expires_idx ON shared_document_tokens (expires_at);

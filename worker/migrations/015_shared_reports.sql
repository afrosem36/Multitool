-- ────────────────────────────────────────────────────────────────────────────
-- Migration 015 — Shared dashboard report snapshots
-- ────────────────────────────────────────────────────────────────────────────
-- Stores public read-only share links for AI Dashboard Maker reports.
-- The full snapshot JSON lives in R2 (bucket = MY_BUCKET, key = r2_key).
-- D1 holds metadata + the public token + expiry so we can index/cleanup fast.

CREATE TABLE IF NOT EXISTS shared_reports (
  token         TEXT PRIMARY KEY,        -- public URL-safe random token
  owner_user_id INTEGER NOT NULL,        -- creator (for revoke / list)
  title         TEXT NOT NULL,
  file_name     TEXT,
  row_count     INTEGER DEFAULT 0,
  domain        TEXT,
  r2_key        TEXT NOT NULL,           -- key under MY_BUCKET that stores snapshot JSON
  created_at    INTEGER NOT NULL,        -- epoch ms
  expires_at    INTEGER NOT NULL,        -- epoch ms — public viewer rejects after this
  view_count    INTEGER DEFAULT 0,
  revoked       INTEGER DEFAULT 0        -- 1 = owner revoked, treated as expired
);

CREATE INDEX IF NOT EXISTS idx_shared_reports_owner    ON shared_reports(owner_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_shared_reports_expires  ON shared_reports(expires_at);

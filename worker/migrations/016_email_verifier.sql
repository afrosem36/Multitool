CREATE TABLE IF NOT EXISTS email_verifications (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  normalized_email TEXT NOT NULL,
  confirmation_token_hash TEXT UNIQUE,
  provider_message_id TEXT,
  verification_mode TEXT NOT NULL CHECK (verification_mode IN ('instant', 'confirmation')),
  status TEXT NOT NULL,
  confidence_score INTEGER NOT NULL DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 100),
  syntax_valid INTEGER,
  domain_valid INTEGER,
  mx_valid INTEGER,
  disposable INTEGER,
  role_based INTEGER,
  catch_all INTEGER,
  smtp_status TEXT,
  delivery_status TEXT,
  reason TEXT,
  bounce_reason TEXT,
  requester_ip_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sent_at TEXT,
  delivered_at TEXT,
  bounced_at TEXT,
  confirmed_at TEXT,
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_normalized_email
  ON email_verifications(normalized_email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verifications_provider_message_id
  ON email_verifications(provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verifications_confirmation_token_hash
  ON email_verifications(confirmation_token_hash)
  WHERE confirmation_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_verifications_created_at
  ON email_verifications(created_at);
CREATE INDEX IF NOT EXISTS idx_email_verifications_ip_mode_sent
  ON email_verifications(requester_ip_hash, verification_mode, sent_at);

CREATE TABLE IF NOT EXISTS email_verification_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_verification_rate_limits (
  rate_key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_verification_rate_limits_expiry
  ON email_verification_rate_limits(expires_at);

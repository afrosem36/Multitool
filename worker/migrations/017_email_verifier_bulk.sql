-- Additive Email Verifier bulk jobs, event history, engagement signals, and suppression data.
-- Migration 016 is already deployed and must remain unchanged.

ALTER TABLE email_verifications ADD COLUMN technical_status TEXT;
ALTER TABLE email_verifications ADD COLUMN engagement_status TEXT NOT NULL DEFAULT 'no_open_detected';
ALTER TABLE email_verifications ADD COLUMN confirmation_status TEXT NOT NULL DEFAULT 'not_confirmed';
ALTER TABLE email_verifications ADD COLUMN first_opened_at TEXT;
ALTER TABLE email_verifications ADD COLUMN last_opened_at TEXT;
ALTER TABLE email_verifications ADD COLUMN open_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE email_verifications ADD COLUMN first_clicked_at TEXT;
ALTER TABLE email_verifications ADD COLUMN last_clicked_at TEXT;
ALTER TABLE email_verifications ADD COLUMN click_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE email_verifications ADD COLUMN delayed_at TEXT;
ALTER TABLE email_verifications ADD COLUMN failed_at TEXT;
ALTER TABLE email_verifications ADD COLUMN complained_at TEXT;
ALTER TABLE email_verifications ADD COLUMN latest_event TEXT;
ALTER TABLE email_verifications ADD COLUMN latest_event_at TEXT;
ALTER TABLE email_verifications ADD COLUMN delivery_event_at TEXT;
ALTER TABLE email_verifications ADD COLUMN engagement_event_at TEXT;
ALTER TABLE email_verifications ADD COLUMN score_breakdown TEXT;

CREATE TABLE IF NOT EXISTS email_verification_jobs (
  id TEXT PRIMARY KEY,
  access_token_hash TEXT NOT NULL,
  idempotency_key TEXT,
  source_hash TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('instant', 'confirm_by_email')),
  original_filename TEXT,
  source_mime_type TEXT,
  email_column TEXT,
  status TEXT NOT NULL CHECK (
    status IN (
      'uploaded', 'ready', 'queued', 'processing', 'partially_completed',
      'completed', 'cancelled', 'failed', 'expired'
    )
  ),
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  invalid_rows INTEGER NOT NULL DEFAULT 0,
  duplicate_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  likely_deliverable_rows INTEGER NOT NULL DEFAULT 0,
  delivered_rows INTEGER NOT NULL DEFAULT 0,
  undeliverable_rows INTEGER NOT NULL DEFAULT 0,
  risky_rows INTEGER NOT NULL DEFAULT 0,
  catch_all_rows INTEGER NOT NULL DEFAULT 0,
  pending_rows INTEGER NOT NULL DEFAULT 0,
  opened_rows INTEGER NOT NULL DEFAULT 0,
  clicked_rows INTEGER NOT NULL DEFAULT 0,
  confirmed_rows INTEGER NOT NULL DEFAULT 0,
  bounced_rows INTEGER NOT NULL DEFAULT 0,
  delayed_rows INTEGER NOT NULL DEFAULT 0,
  soft_bounce_rows INTEGER NOT NULL DEFAULT 0,
  hard_bounce_rows INTEGER NOT NULL DEFAULT 0,
  suppressed_rows INTEGER NOT NULL DEFAULT 0,
  complaint_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  requester_ip_hash TEXT,
  consent_confirmed INTEGER NOT NULL DEFAULT 0,
  retention_days INTEGER NOT NULL DEFAULT 30,
  processing_limits TEXT,
  latest_event_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  expires_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verification_jobs_access_token
  ON email_verification_jobs(access_token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verification_jobs_ip_idempotency
  ON email_verification_jobs(requester_ip_hash, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_verification_jobs_source
  ON email_verification_jobs(requester_ip_hash, source_hash, mode, created_at);
CREATE INDEX IF NOT EXISTS idx_email_verification_jobs_status_created
  ON email_verification_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_email_verification_jobs_created_at
  ON email_verification_jobs(created_at);

CREATE TABLE IF NOT EXISTS email_verification_job_rows (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  original_row_number INTEGER NOT NULL,
  original_email_value TEXT,
  email TEXT,
  normalized_email TEXT,
  name TEXT,
  company TEXT,
  department TEXT,
  designation TEXT,
  reference_id TEXT,
  optional_data TEXT,

  technical_status TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'not_sent',
  engagement_status TEXT NOT NULL DEFAULT 'no_open_detected',
  confirmation_status TEXT NOT NULL DEFAULT 'not_confirmed',

  confidence_score INTEGER NOT NULL DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 100),
  score_breakdown TEXT,

  syntax_valid INTEGER,
  domain_valid INTEGER,
  mx_valid INTEGER,
  disposable INTEGER,
  role_based INTEGER,
  catch_all INTEGER,

  domain TEXT,
  suggested_email TEXT,
  smtp_status TEXT,

  provider_email_id TEXT,
  confirmation_token_hash TEXT,
  confirmation_expires_at TEXT,

  sent_at TEXT,
  delivered_at TEXT,
  first_opened_at TEXT,
  last_opened_at TEXT,
  open_count INTEGER NOT NULL DEFAULT 0,
  first_clicked_at TEXT,
  last_clicked_at TEXT,
  click_count INTEGER NOT NULL DEFAULT 0,
  confirmed_at TEXT,
  delayed_at TEXT,
  bounced_at TEXT,
  failed_at TEXT,
  complained_at TEXT,

  bounce_type TEXT,
  bounce_reason TEXT,
  latest_event TEXT,
  latest_event_at TEXT,
  delivery_event_at TEXT,
  engagement_event_at TEXT,
  reason TEXT,

  processed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (job_id) REFERENCES email_verification_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_verification_job_rows_job_id
  ON email_verification_job_rows(job_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_job_rows_email
  ON email_verification_job_rows(normalized_email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verification_job_rows_provider
  ON email_verification_job_rows(provider_email_id)
  WHERE provider_email_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verification_job_rows_token
  ON email_verification_job_rows(confirmation_token_hash)
  WHERE confirmation_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_verification_job_rows_technical
  ON email_verification_job_rows(job_id, technical_status);
CREATE INDEX IF NOT EXISTS idx_email_verification_job_rows_delivery
  ON email_verification_job_rows(job_id, delivery_status);
CREATE INDEX IF NOT EXISTS idx_email_verification_job_rows_confirmation
  ON email_verification_job_rows(job_id, confirmation_status);
CREATE INDEX IF NOT EXISTS idx_email_verification_job_rows_created
  ON email_verification_job_rows(created_at);

CREATE TABLE IF NOT EXISTS email_verification_events (
  id TEXT PRIMARY KEY,
  verification_id TEXT,
  job_row_id TEXT,
  provider_event_id TEXT NOT NULL UNIQUE,
  provider_email_id TEXT,
  event_type TEXT NOT NULL,
  provider_created_at TEXT,
  event_payload TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (verification_id) REFERENCES email_verifications(id) ON DELETE CASCADE,
  FOREIGN KEY (job_row_id) REFERENCES email_verification_job_rows(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_verification_events_verification
  ON email_verification_events(verification_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_events_job_row
  ON email_verification_events(job_row_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_events_provider_email
  ON email_verification_events(provider_email_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_events_created
  ON email_verification_events(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verification_events_provider_event
  ON email_verification_events(provider_event_id);

CREATE TABLE IF NOT EXISTS email_verification_suppressions (
  normalized_email TEXT PRIMARY KEY,
  reason TEXT NOT NULL CHECK (reason IN ('hard_bounce', 'complaint', 'provider_suppressed')),
  source_verification_id TEXT,
  source_job_row_id TEXT,
  provider_created_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_verification_suppressions_reason
  ON email_verification_suppressions(reason, updated_at);

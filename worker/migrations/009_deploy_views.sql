-- Add view tracking and username to deployments

ALTER TABLE deployments ADD COLUMN views INTEGER DEFAULT 0;
ALTER TABLE deployments ADD COLUMN username TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_deployments_username ON deployments(username);

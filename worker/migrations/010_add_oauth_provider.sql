-- Add oauth_provider column to users table for tracking login type (google, email, etc.)
ALTER TABLE users ADD COLUMN oauth_provider TEXT DEFAULT NULL;

-- IDE Projects table for HTML IDE tool

CREATE TABLE IF NOT EXISTS ide_projects (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    files TEXT NOT NULL, -- JSON: [{name, language, content}]
    is_public INTEGER DEFAULT 0,
    share_slug TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ide_projects_user_id ON ide_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_ide_projects_share_slug ON ide_projects(share_slug);

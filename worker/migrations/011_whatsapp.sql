-- WhatsApp Analytics tables for D1
-- Timestamps stored as INTEGER (Unix seconds) for efficient range queries.

CREATE TABLE IF NOT EXISTS wa_messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id    TEXT    UNIQUE NOT NULL,
  chat_id       TEXT    NOT NULL,
  chat_name     TEXT    DEFAULT '',
  from_jid      TEXT    DEFAULT '',
  to_jid        TEXT    DEFAULT '',
  body          TEXT    DEFAULT '',
  type          TEXT    DEFAULT 'chat',
  timestamp     INTEGER NOT NULL,
  is_from_me    INTEGER DEFAULT 0,
  has_media     INTEGER DEFAULT 0,
  agent_id      TEXT,
  response_time INTEGER,
  created_at    INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS wa_chats (
  chat_id           TEXT    PRIMARY KEY,
  name              TEXT    DEFAULT '',
  phone             TEXT,
  is_group          INTEGER DEFAULT 0,
  last_message      TEXT    DEFAULT '',
  last_message_time INTEGER,
  last_msg_from_me  INTEGER DEFAULT 0,
  waiting_since     INTEGER,
  agent_assigned    TEXT,
  unread_count      INTEGER DEFAULT 0,
  updated_at        INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS wa_contacts (
  phone        TEXT    PRIMARY KEY,
  name         TEXT    DEFAULT '',
  pushname     TEXT    DEFAULT '',
  is_group     INTEGER DEFAULT 0,
  lead_status  TEXT    DEFAULT 'none',
  tags         TEXT    DEFAULT '[]',
  notes        TEXT    DEFAULT '',
  first_seen   INTEGER DEFAULT (unixepoch()),
  last_contact INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS wa_leads (
  id         TEXT    PRIMARY KEY,
  phone      TEXT    NOT NULL,
  name       TEXT    DEFAULT '',
  status     TEXT    DEFAULT 'new',
  priority   TEXT    DEFAULT 'medium',
  notes      TEXT    DEFAULT '',
  tags       TEXT    DEFAULT '[]',
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_wa_msg_chat    ON wa_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_ts      ON wa_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_wa_msg_from_me ON wa_messages(is_from_me, timestamp);
CREATE INDEX IF NOT EXISTS idx_wa_chat_ts     ON wa_chats(updated_at);
CREATE INDEX IF NOT EXISTS idx_wa_lead_status ON wa_leads(status);

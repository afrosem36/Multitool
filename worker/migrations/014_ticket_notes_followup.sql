-- Enterprise CRM layer: ticket status, follow-up scheduling, agent assignment, internal notes

-- Extend wa_leads with ticket / follow-up / assignment fields
ALTER TABLE wa_leads ADD COLUMN ticket_status  TEXT DEFAULT 'open';
ALTER TABLE wa_leads ADD COLUMN follow_up_date TEXT;
ALTER TABLE wa_leads ADD COLUMN follow_up_time TEXT;
ALTER TABLE wa_leads ADD COLUMN assigned_to    TEXT;
ALTER TABLE wa_leads ADD COLUMN last_message_at INTEGER;

-- Extend wa_chats with ticket / assignment fields
ALTER TABLE wa_chats ADD COLUMN ticket_status TEXT DEFAULT 'open';
ALTER TABLE wa_chats ADD COLUMN assigned_to   TEXT;

-- Internal agent notes (never visible to customers)
CREATE TABLE IF NOT EXISTS wa_notes (
  id         TEXT    PRIMARY KEY,
  chat_id    TEXT    NOT NULL,
  session_id TEXT    NOT NULL,
  body       TEXT    NOT NULL,
  agent      TEXT    DEFAULT 'Agent',
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_wa_notes_session_chat ON wa_notes(session_id, chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wa_leads_ticket       ON wa_leads(session_id, ticket_status);
CREATE INDEX IF NOT EXISTS idx_wa_leads_followup     ON wa_leads(session_id, follow_up_date);
CREATE INDEX IF NOT EXISTS idx_wa_chats_ticket       ON wa_chats(session_id, ticket_status);

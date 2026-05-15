ALTER TABLE wa_messages ADD COLUMN author_jid TEXT DEFAULT '';
ALTER TABLE wa_messages ADD COLUMN sender_name TEXT DEFAULT '';
ALTER TABLE wa_messages ADD COLUMN media_url TEXT DEFAULT '';
ALTER TABLE wa_messages ADD COLUMN quoted_msg_id TEXT DEFAULT '';
ALTER TABLE wa_messages ADD COLUMN quoted_body TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_wa_msg_author ON wa_messages(author_jid);

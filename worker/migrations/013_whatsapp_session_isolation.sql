ALTER TABLE wa_messages ADD COLUMN session_id TEXT DEFAULT 'legacy';
ALTER TABLE wa_messages ADD COLUMN real_chat_id TEXT DEFAULT '';
ALTER TABLE wa_messages ADD COLUMN real_message_id TEXT DEFAULT '';

ALTER TABLE wa_chats ADD COLUMN session_id TEXT DEFAULT 'legacy';
ALTER TABLE wa_chats ADD COLUMN real_chat_id TEXT DEFAULT '';

ALTER TABLE wa_contacts ADD COLUMN session_id TEXT DEFAULT 'legacy';
ALTER TABLE wa_contacts ADD COLUMN real_phone TEXT DEFAULT '';

ALTER TABLE wa_leads ADD COLUMN session_id TEXT DEFAULT 'legacy';

CREATE INDEX IF NOT EXISTS idx_wa_msg_session_chat ON wa_messages(session_id, real_chat_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_wa_chat_session ON wa_chats(session_id, last_message_time);
CREATE INDEX IF NOT EXISTS idx_wa_contact_session ON wa_contacts(session_id, real_phone);
CREATE INDEX IF NOT EXISTS idx_wa_lead_session ON wa_leads(session_id, status);

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const db = require('./d1');

const SLA_THRESHOLD = parseInt(process.env.SLA_THRESHOLD_SECONDS || '900', 10);
const INITIAL_MESSAGE_SYNC_CHATS = parseInt(process.env.INITIAL_MESSAGE_SYNC_CHATS || '20', 10);
const INITIAL_MESSAGE_SYNC_LIMIT = parseInt(process.env.INITIAL_MESSAGE_SYNC_LIMIT || '20', 10);

class WhatsAppService {
  constructor(io) {
    this.io = io;
    this.client = null;
    this.status = 'disconnected';
    this.qr = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.sessionId = process.env.WA_SESSION_ID || null;
  }

  getState() { return { status: this.status, qr: this.qr, sessionId: this.sessionId }; }
  emit(event, data) {
    const isolatedEvents = new Set(['new_message', 'chat_update', 'message_ack', 'group_update', 'sync_complete']);
    const payload = { ...(data || {}), sessionId: this.sessionId };
    if (this.sessionId && isolatedEvents.has(event)) this.io.to(this.sessionId).emit(event, payload);
    else this.io.emit(event, payload);
  }

  deriveSessionId() {
    const user = this.client?.info?.wid?.user || this.client?.info?.me?.user || process.env.WA_SESSION_ID || 'unknown';
    return `session_${String(user).replace(/\D/g, '') || 'unknown'}`;
  }

  async getDisplayNameForJid(jid) {
    if (!jid || !this.client) return '';
    try {
      const contact = await this.client.getContactById(jid);
      return contact?.pushname || contact?.name || contact?.shortName || contact?.number || jid;
    } catch (_) {
      return jid.split('@')[0];
    }
  }

  async serializeMessage(msg, chat, contact, isFromMe = !!msg.fromMe) {
    const resolvedChat = chat || await msg.getChat();
    const resolvedContact = contact || await msg.getContact();
    const author = resolvedChat.isGroup ? (msg.author || msg.from || '') : '';
    const senderName = author
      ? await this.getDisplayNameForJid(author)
      : (resolvedContact.pushname || resolvedContact.name || resolvedContact.number || msg.from);
    let quoted = null;
    if (msg.hasQuotedMsg) {
      try {
        const quotedMsg = await msg.getQuotedMessage();
        quoted = {
          messageId: quotedMsg?.id?.id || '',
          body: quotedMsg?.body || '',
          author: quotedMsg?.author || quotedMsg?.from || '',
        };
      } catch (_) {
        quoted = null;
      }
    }

    return {
      messageId: msg.id.id,
      chatId: resolvedChat.id._serialized,
      chatName: resolvedChat.name || resolvedContact.pushname || resolvedContact.number || msg.from,
      from: msg.from,
      to: msg.to || '',
      author,
      senderName,
      body: msg.body || '',
      type: msg.type,
      timestamp: new Date(msg.timestamp * 1000),
      isFromMe,
      hasMedia: msg.hasMedia || false,
      mediaUrl: '',
      quotedMessage: quoted,
      agentId: isFromMe ? 'default' : null,
      sessionId: this.sessionId || 'legacy',
    };
  }

  async initialize() {
    if (this.client) {
      try { await this.client.destroy(); } catch (_) { /* ignore stale browser teardown errors */ }
      this.client = null;
    }

    this.status = 'initializing';
    this.qr = null;
    this.emit('status', { status: 'initializing' });
    console.log('[WA] Initializing client…');

    this.client = new Client({
      authStrategy: new LocalAuth({ clientId: 'wa-tools', dataPath: './.wwebjs_auth' }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--disable-accelerated-2d-canvas',
          '--disable-ipc-flooding-protection',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
        ],
        // NOTE: --single-process and --no-zygote are Linux-only.
        // Using them on Windows causes "Navigating frame was detached" crashes.
      },
    });

    this.client.on('qr', async (rawQr) => {
      try {
        const dataUrl = await qrcode.toDataURL(rawQr, { width: 256, margin: 2 });
        this.qr = dataUrl;
        this.status = 'qr';
        this.emit('qr', dataUrl);
        this.emit('status', { status: 'qr' });
        console.log('[WA] QR ready — scan with WhatsApp app');
      } catch (err) {
        console.error('[WA] QR generation error:', err.message);
      }
    });

    this.client.on('authenticated', () => {
      this.qr = null;
      this.status = 'authenticated';
      this.reconnectAttempts = 0;
      this.emit('status', { status: 'authenticated' });
      console.log('[WA] Authenticated successfully');
    });

    this.client.on('auth_failure', (msg) => {
      this.status = 'auth_failure';
      this.emit('status', { status: 'auth_failure', message: msg });
      console.error('[WA] Auth failure:', msg);
      this.scheduleReconnect();
    });

    this.client.on('ready', async () => {
      this.status = 'ready';
      this.sessionId = this.deriveSessionId();
      this.emit('status', { status: 'ready', sessionId: this.sessionId });
      this.reconnectAttempts = 0;
      console.log(`[WA] Client ready (${this.sessionId})`);
      await this.syncInitialData().catch(e => console.error('[WA] Sync error:', e.message));
    });

    this.client.on('disconnected', (reason) => {
      this.status = 'disconnected';
      this.emit('status', { status: 'disconnected', reason });
      console.log('[WA] Disconnected:', reason);
      this.scheduleReconnect();
    });

    this.client.on('message', async (msg) => {
      await this.handleMessage(msg, false);
    });

    this.client.on('message_create', async (msg) => {
      if (msg.fromMe) await this.handleMessage(msg, true);
    });

    this.client.on('message_ack', (msg, ack) => {
      this.emit('message_ack', {
        chatId: msg.fromMe ? msg.to : msg.from,
        messageId: msg.id?.id,
        ack,
      });
    });

    this.client.on('chat_update', (chat) => {
      const lastMsg = chat.lastMessage;
      this.emit('chat_update', {
        chatId: chat.id?._serialized,
        name: chat.name || chat.id?.user,
        phone: chat.isGroup ? null : chat.id?.user,
        isGroup: !!chat.isGroup,
        unreadCount: chat.unreadCount || 0,
        lastMessage: lastMsg?.body || '',
        lastMessageTime: lastMsg ? new Date(lastMsg.timestamp * 1000) : null,
        lastMessageIsFromMe: !!lastMsg?.fromMe,
      });
    });

    this.client.on('group_update', (notification) => {
      this.emit('group_update', {
        chatId: notification.chatId || notification.id?._serialized,
        type: notification.type,
        timestamp: new Date(),
      });
    });

    this.client.initialize().catch((err) => {
      console.error('[WA] Initialization error:', err.message);
      this.status = 'disconnected';
      this.emit('status', { status: 'disconnected' });
      this.scheduleReconnect();
    });
  }

  // ── Message handling ──────────────────────────────────────────────────────
  async handleMessage(msg, isFromMe) {
    try {
      const chat    = await msg.getChat();
      const contact = await msg.getContact();
      const ts      = new Date(msg.timestamp * 1000);

      const record = await this.serializeMessage(msg, chat, contact, isFromMe);

      if (isFromMe) {
        try {
          const last = await db.getLastCustomerMsg(record.chatId, this.sessionId);
          if (last) record.responseTime = Math.round((ts - new Date(last.timestamp)) / 1000);
        } catch (_) { /* response-time lookup is best effort */ }
      }

      // Fire-and-forget DB writes — errors are logged but don't fail the handler
      db.upsertMessage(record).catch(e => console.error('[WA] upsertMessage:', e.message));
      db.upsertChat({
        chatId:              record.chatId,
        sessionId:           this.sessionId,
        name:                record.chatName,
        phone:               contact.number || null,
        isGroup:             chat.isGroup || false,
        lastMessage:         record.body,
        lastMessageTime:     ts,
        lastMessageIsFromMe: isFromMe,
        waitingSince:        isFromMe ? null : ts,
      }).catch(e => console.error('[WA] upsertChat:', e.message));
      db.upsertContact({
        phone:    contact.number || '',
        sessionId: this.sessionId,
        name:     contact.pushname || contact.name || contact.number || msg.from,
        pushname: contact.pushname || '',
        isGroup:  contact.isGroup || false,
      }).catch(e => console.error('[WA] upsertContact:', e.message));

      this.emit('new_message', {
        messageId:    record.messageId,
        chatId:       record.chatId,
        chatName:     record.chatName,
        body:         record.body,
        type:         record.type,
        hasMedia:     record.hasMedia,
        mediaUrl:     record.mediaUrl,
        author:       record.author,
        senderName:   record.senderName,
        quotedMessage: record.quotedMessage,
        timestamp:    record.timestamp,
        isFromMe,
        responseTime: record.responseTime || null,
        phone:        contact.number || msg.from,
      });
    } catch (err) {
      console.error('[WA] handleMessage error:', err.message);
    }
  }

  async hydrateChatMessages(chatId, limit = 50) {
    if (this.status !== 'ready' || !this.client) {
      throw new Error('WhatsApp client is not ready');
    }
    const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 50, 100));
    const chat = await this.client.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit: safeLimit });
    const records = [];
    const participantContacts = new Map();

    for (const msg of messages) {
      const contact = await msg.getContact().catch(() => null);
      const record = await this.serializeMessage(msg, chat, contact, !!msg.fromMe);
      if (record.isFromMe) {
        try {
          const last = await db.getLastCustomerMsg(record.chatId, this.sessionId);
          if (last) record.responseTime = Math.round((record.timestamp - new Date(last.timestamp)) / 1000);
        } catch (_) { /* response-time lookup is best effort */ }
      }
      records.push(record);
      if (record.author && !participantContacts.has(record.author)) {
        participantContacts.set(record.author, {
          phone: record.author.split('@')[0],
          sessionId: this.sessionId,
          name: record.senderName || record.author,
          pushname: record.senderName || '',
          isGroup: false,
        });
      }
    }

    if (records.length) {
      await db.bulkUpsertMessages(records).catch(e => console.error('[WA] bulk messages:', e.message));
    }
    if (participantContacts.size) {
      await db.bulkUpsertContacts([...participantContacts.values()]).catch(e => console.error('[WA] bulk participants:', e.message));
    }

    return { ok: true, chatId, count: records.length };
  }

  async getGroupParticipants(chatId) {
    if (this.status !== 'ready' || !this.client) {
      throw new Error('WhatsApp client is not ready');
    }
    const chat = await this.client.getChatById(chatId);
    if (!chat.isGroup) return [];
    const rows = [];
    for (const p of chat.participants || []) {
      const jid = p.id?._serialized;
      rows.push({
        id: jid,
        phone: p.id?.user || '',
        name: await this.getDisplayNameForJid(jid),
        isAdmin: !!p.isAdmin,
        isSuperAdmin: !!p.isSuperAdmin,
      });
    }
    return rows;
  }

  async sendMessage(chatId, body) {
    if (this.status !== 'ready' || !this.client) {
      throw new Error('WhatsApp client is not ready');
    }
    const text = String(body || '').trim();
    if (!chatId || !text) throw new Error('chatId and body are required');

    const delay = 800 + Math.floor(Math.random() * 1000);
    await new Promise(resolve => setTimeout(resolve, delay));
    const msg = await this.client.sendMessage(chatId, text);
    return {
      messageId: msg.id?.id,
      chatId,
      body: text,
      timestamp: new Date(),
      isFromMe: true,
      type: msg.type || 'chat',
      hasMedia: false,
      author: '',
      senderName: 'You',
    };
  }

  // ── Initial sync after ready ──────────────────────────────────────────────
  async syncInitialData() {
    console.log('[WA] Starting initial data sync…');
    const [chats, contacts] = await Promise.all([
      this.client.getChats(),
      this.client.getContacts(),
    ]);

    const contactRows = contacts
      .filter(c => !c.isMe && c.number)
      .slice(0, 500)
      .map(c => ({
        phone:    c.number,
        sessionId: this.sessionId,
        name:     c.pushname || c.name || c.number,
        pushname: c.pushname || '',
        isGroup:  c.isGroup || false,
      }));
    if (contactRows.length) {
      await db.bulkUpsertContacts(contactRows).catch(e => console.error('[WA] bulk contacts:', e.message));
    }

    const chatRows = chats.slice(0, 100).map(chat => {
      const lastMsg = chat.lastMessage;
      return {
        chatId:              chat.id._serialized,
        sessionId:           this.sessionId,
        name:                chat.name || chat.id.user,
        phone:               chat.isGroup ? null : chat.id.user,
        isGroup:             chat.isGroup || false,
        unreadCount:         chat.unreadCount || 0,
        lastMessage:         lastMsg?.body || '',
        lastMessageTime:     lastMsg ? new Date(lastMsg.timestamp * 1000) : null,
        lastMessageIsFromMe: lastMsg?.fromMe || false,
        waitingSince:        (!lastMsg?.fromMe && lastMsg) ? new Date(lastMsg.timestamp * 1000) : null,
      };
    });
    if (chatRows.length) {
      await db.bulkUpsertChats(chatRows).catch(e => console.error('[WA] bulk chats:', e.message));
    }

    const recentChats = chats.slice(0, Math.max(0, Math.min(INITIAL_MESSAGE_SYNC_CHATS, 50)));
    for (const chat of recentChats) {
      await this.hydrateChatMessages(chat.id._serialized, INITIAL_MESSAGE_SYNC_LIMIT)
        .catch(e => console.error(`[WA] hydrate ${chat.id._serialized}:`, e.message));
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    console.log(`[WA] Synced ${Math.min(chats.length,100)} chats, ${Math.min(contacts.length,500)} contacts`);
    this.emit('sync_complete', { chats: Math.min(chats.length,100), contacts: Math.min(contacts.length,500) });
  }

  // ── Session management ────────────────────────────────────────────────────
  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = Math.min(5000 * Math.pow(2, this.reconnectAttempts), 120000);
    this.reconnectAttempts++;
    console.log(`[WA] Reconnect scheduled in ${Math.round(delay/1000)}s (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this.initialize(), delay);
  }

  async destroy() {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.client) {
      try { await this.client.destroy(); } catch (_) { /* ignore stale browser teardown errors */ }
      this.client = null;
    }
    this.status = 'disconnected';
    this.qr = null;
    this.sessionId = process.env.WA_SESSION_ID || null;
    this.emit('status', { status: 'disconnected' });
  }

  getSlaStatus(waitingSeconds) {
    if (!waitingSeconds || waitingSeconds <= 0) return 'ok';
    if (waitingSeconds > SLA_THRESHOLD) return 'breached';
    if (waitingSeconds > SLA_THRESHOLD * 0.7) return 'warning';
    return 'ok';
  }
}

module.exports = WhatsAppService;

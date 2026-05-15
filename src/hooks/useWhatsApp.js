import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const WA_URL = import.meta.env.VITE_WA_SERVICE_URL || 'http://localhost:3002';

const initialData = {
  chats: [], contacts: [], analytics: null, leads: [],
  qaQueue: [], notifications: [], searchResults: [],
  messagesByChat: {}, notesByChat: {}, sessionId: null,
};

export function useWhatsApp() {
  const socketRef = useRef(null);
  const [sessionState, setSessionState] = useState({
    status: 'connecting',
    sessionId: null, qrCode: null, error: null,
  });
  const [data, setData]           = useState(initialData);
  const [loading, setLoading]     = useState({});
  const [serviceReachable, setServiceReachable] = useState(true);

  // ── API helpers ────────────────────────────────────────────────────────
  const api = useCallback(async (path, options = {}) => {
    const res = await fetch(`${WA_URL}/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
    return res.json();
  }, []);

  const load = useCallback(async (key, path, params = '') => {
    setLoading(p => ({ ...p, [key]: true }));
    try {
      const result = await api(`${path}${params}`);
      setData(p => ({ ...p, [key]: result }));
    } catch (err) {
      console.error(`[useWhatsApp] load ${key}:`, err.message);
    } finally {
      setLoading(p => ({ ...p, [key]: false }));
    }
  }, [api]);

  // ── Public fetch methods ───────────────────────────────────────────────
  const fetchChats     = useCallback((params = '') => load('chats',    '/chats',         params), [load]);
  const fetchContacts  = useCallback((params = '') => load('contacts', '/contacts',      params), [load]);
  const fetchAnalytics = useCallback((params = '') => load('analytics','/analytics',     params), [load]);
  const fetchLeads     = useCallback((params = '') => load('leads',    '/leads',         params), [load]);
  const fetchQaQueue   = useCallback((params = '') => load('qaQueue',  '/qa/queue',      params), [load]);
  const fetchNotifs    = useCallback((params = '') => load('notifications','/notifications', params), [load]);
  const fetchSearch    = useCallback((q, extra='') =>
    load('searchResults', '/search', `?q=${encodeURIComponent(q)}${extra}`), [load]);

  const fetchMessages = useCallback(async (chatId, options = {}) => {
    if (!chatId) return [];
    const params = new URLSearchParams();
    params.set('limit', String(options.limit || 80));
    if (options.hydrate !== false) params.set('hydrate', '1');
    if (options.before) params.set('before', options.before);
    setLoading(p => ({ ...p, [`messages:${chatId}`]: true }));
    try {
      const result = await api(`/chats/${encodeURIComponent(chatId)}/messages?${params}`);
      setData(p => ({
        ...p,
        messagesByChat: {
          ...p.messagesByChat,
          [chatId]: options.before
            ? [...result, ...(p.messagesByChat?.[chatId] || [])]
            : result,
        },
      }));
      return result;
    } catch (err) {
      console.error(`[useWhatsApp] fetchMessages ${chatId}:`, err.message);
      return [];
    } finally {
      setLoading(p => ({ ...p, [`messages:${chatId}`]: false }));
    }
  }, [api]);

  // ── Notes ──────────────────────────────────────────────────────────────
  const fetchNotes = useCallback(async (chatId) => {
    if (!chatId) return [];
    setLoading(p => ({ ...p, [`notes:${chatId}`]: true }));
    try {
      const result = await api(`/notes/${encodeURIComponent(chatId)}`);
      setData(p => ({ ...p, notesByChat: { ...p.notesByChat, [chatId]: result } }));
      return result;
    } catch (err) {
      console.error(`[useWhatsApp] fetchNotes ${chatId}:`, err.message);
      return [];
    } finally {
      setLoading(p => ({ ...p, [`notes:${chatId}`]: false }));
    }
  }, [api]);

  const createNote = useCallback(async (chatId, body, agent = 'Agent') => {
    const result = await api(`/notes/${encodeURIComponent(chatId)}`, {
      method: 'POST',
      body: JSON.stringify({ body, agent }),
    });
    setData(p => ({
      ...p,
      notesByChat: {
        ...p.notesByChat,
        [chatId]: [...(p.notesByChat?.[chatId] || []), result],
      },
    }));
    return result;
  }, [api]);

  // ── Ticket status + agent assignment ───────────────────────────────────
  const updateTicket = useCallback(async (chatId, updates) => {
    await api(`/chats/${encodeURIComponent(chatId)}/ticket`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    setData(p => ({
      ...p,
      chats: (p.chats || []).map(c => c.chatId === chatId ? { ...c, ...updates } : c),
      qaQueue: (p.qaQueue || []).map(q => q.chatId === chatId ? { ...q, ...updates } : q),
    }));
  }, [api]);

  // ── Send message ───────────────────────────────────────────────────────
  const sendMessage = useCallback(async (chatId, body) => {
    const text = String(body || '').trim();
    if (!chatId || !text) return null;
    const result = await api(`/chats/${encodeURIComponent(chatId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body: text }),
    });
    // Auto-advance ticket to in-progress when agent replies
    updateTicket(chatId, { ticketStatus: 'in-progress' }).catch(() => {});
    return result;
  }, [api, updateTicket]);

  // ── Lead CRUD ──────────────────────────────────────────────────────────
  const createLead = useCallback(async (leadData) => {
    const result = await api('/leads', { method: 'POST', body: JSON.stringify(leadData) });
    setData(p => ({ ...p, leads: [result, ...p.leads.filter(l => l._id !== result._id)] }));
    return result;
  }, [api]);

  const updateLead = useCallback(async (id, updates) => {
    const result = await api(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
    setData(p => ({ ...p, leads: p.leads.map(l => l._id === id ? result : l) }));
    return result;
  }, [api]);

  const updateContact = useCallback(async (phone, updates) => {
    const result = await api(`/contacts/${phone}`, { method: 'PATCH', body: JSON.stringify(updates) });
    setData(p => ({ ...p, contacts: p.contacts.map(c => c.phone === phone ? result : c) }));
    return result;
  }, [api]);

  const reconnectSession  = useCallback(() => socketRef.current?.emit('reconnect_session'),  []);
  const disconnectSession = useCallback(() => socketRef.current?.emit('disconnect_session'), []);

  // ── Batch refresh ──────────────────────────────────────────────────────
  const refreshAll = useCallback(() => {
    fetchChats(); fetchContacts(); fetchAnalytics();
    fetchLeads(); fetchQaQueue(); fetchNotifs();
  }, [fetchChats, fetchContacts, fetchAnalytics, fetchLeads, fetchQaQueue, fetchNotifs]);

  // ── Socket.IO ──────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(WA_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 5000,
      reconnectionDelayMax: 60000,
      randomizationFactor: 0.4,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setServiceReachable(true);
      socket.emit('request_qr');
    });

    socket.on('connect_error', () => {
      setServiceReachable(false);
      setSessionState(p => ({ ...p, status: 'error', error: 'Cannot reach WhatsApp service' }));
    });

    socket.on('status', ({ status, reason, message, sessionId }) => {
      setSessionState(p => ({
        ...p, status,
        sessionId: sessionId || p.sessionId,
        error: status === 'auth_failure' ? message : status === 'error' ? reason : null,
        qrCode: ['authenticated', 'ready'].includes(status) ? null : p.qrCode,
      }));
      if (status === 'ready') {
        if (sessionId) {
          socket.emit('join_session', sessionId);
          setData(p => p.sessionId === sessionId ? p : { ...initialData, sessionId });
        }
        refreshAll();
      }
    });

    socket.on('qr', qrDataUrl =>
      setSessionState(p => ({ ...p, qrCode: qrDataUrl, status: 'qr' }))
    );

    socket.on('new_message', (message) => {
      if (!message?.chatId) return;
      setData(p => {
        const existing = p.chats || [];
        const found    = existing.find(c => c.chatId === message.chatId);
        // Auto set ticket → open when customer sends a message
        const autoTicketStatus = message.isFromMe ? (found?.ticketStatus || 'in-progress') : 'open';
        const updatedChat = {
          ...(found || {}),
          chatId:              message.chatId,
          name:                message.chatName || found?.name || message.phone || message.chatId,
          phone:               message.phone    || found?.phone || null,
          lastMessage:         message.body,
          lastMessageTime:     message.timestamp,
          lastMessageIsFromMe: message.isFromMe,
          unreadCount:         message.isFromMe ? (found?.unreadCount || 0) : (found?.unreadCount || 0) + 1,
          ticketStatus:        autoTicketStatus,
          waitingMinutes:      message.isFromMe ? 0 : found?.waitingMinutes,
          slaStatus:           message.isFromMe ? 'ok' : found?.slaStatus,
        };
        const chats = [updatedChat, ...existing.filter(c => c.chatId !== message.chatId)];
        const knownMessages = p.messagesByChat?.[message.chatId] || [];
        const msgRecord = {
          messageId:     message.messageId || `${message.chatId}-${message.timestamp}`,
          chatId:        message.chatId,
          body:          message.body,
          timestamp:     message.timestamp,
          isFromMe:      !!message.isFromMe,
          type:          message.type || 'chat',
          hasMedia:      !!message.hasMedia,
          mediaUrl:      message.mediaUrl || '',
          author:        message.author   || '',
          senderName:    message.senderName || '',
          quotedMessage: message.quotedMessage || null,
          responseTime:  message.responseTime  || null,
        };
        const alreadyHave = knownMessages.some(m => m.messageId === msgRecord.messageId);
        const messagesByChat = alreadyHave
          ? p.messagesByChat
          : { ...p.messagesByChat, [message.chatId]: [...knownMessages, msgRecord] };
        return { ...p, chats, messagesByChat };
      });
      fetchQaQueue();
      fetchNotifs();
      fetchAnalytics();
    });

    socket.on('chat_update', (chat) => {
      if (!chat?.chatId) return;
      setData(p => ({
        ...p,
        chats: [chat, ...(p.chats || []).filter(c => c.chatId !== chat.chatId)],
      }));
    });

    socket.on('message_ack', ({ chatId, messageId, ack }) => {
      if (!chatId || !messageId) return;
      setData(p => ({
        ...p,
        messagesByChat: {
          ...p.messagesByChat,
          [chatId]: (p.messagesByChat?.[chatId] || []).map(m =>
            m.messageId === messageId ? { ...m, ack } : m
          ),
        },
      }));
    });

    socket.on('sync_complete', () => refreshAll());

    return () => { socket.disconnect(); };
  }, [refreshAll, fetchQaQueue, fetchNotifs, fetchAnalytics]);

  return {
    sessionState, serviceReachable,
    data, loading,
    fetchChats, fetchContacts, fetchAnalytics, fetchLeads,
    fetchQaQueue, fetchNotifs, fetchSearch,
    fetchMessages, sendMessage,
    fetchNotes, createNote, updateTicket,
    createLead, updateLead, updateContact,
    reconnectSession, disconnectSession,
    WA_URL,
  };
}

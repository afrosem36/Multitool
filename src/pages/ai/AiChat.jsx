import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  Send, Bot, User, Copy, RefreshCw, Trash2, Download,
  Plus, Search, ChevronLeft, Sparkles, MessageSquare,
  Code, Zap, Brain, Check, Menu, X, StopCircle,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const DAILY_LIMIT       = 20;
const STORAGE_USAGE_KEY = 'ai_chat_usage';
const STORAGE_SESS_KEY  = 'ai_chat_sessions';
const STORAGE_CUR_KEY   = 'ai_chat_current';
const AI_NAME           = 'MultiTool AI';
const SYSTEM_PROMPT     = `You are ${AI_NAME}, a smart, helpful, and friendly AI assistant built into MultiTool Hub — a powerful all-in-one productivity platform. You help users with coding, writing, analysis, math, and general questions. Be concise, accurate, and use markdown formatting (bold, code blocks, lists) where appropriate.`;

const SUGGESTED_PROMPTS = [
  { icon: Code,        label: 'Write code',       text: 'Write a Python function to reverse a linked list' },
  { icon: Brain,       label: 'Explain concept',  text: 'Explain how neural networks learn in simple terms' },
  { icon: Zap,         label: 'Quick task',       text: 'Give me 5 productivity tips for developers' },
  { icon: MessageSquare, label: 'Draft message',  text: 'Write a professional email to reschedule a meeting' },
  { icon: Sparkles,    label: 'Creative',         text: 'Write a short story about an AI that discovers music' },
  { icon: Bot,         label: 'Debug help',       text: 'Why does JavaScript have NaN !== NaN? Explain the logic' },
];

// ─── Storage helpers ──────────────────────────────────────────────────────────
function getTodayKey() { return new Date().toISOString().split('T')[0]; }

function getUsage() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_USAGE_KEY) || '{}');
    if (raw.date !== getTodayKey()) return { date: getTodayKey(), count: 0 };
    return raw;
  } catch { return { date: getTodayKey(), count: 0 }; }
}
function saveUsage(u) { localStorage.setItem(STORAGE_USAGE_KEY, JSON.stringify(u)); }
function incrementUsage() {
  const u = getUsage(); u.count += 1; saveUsage(u); return u.count;
}

function loadSessions() {
  try { return JSON.parse(localStorage.getItem(STORAGE_SESS_KEY) || '[]'); }
  catch { return []; }
}
function saveSessions(s) { localStorage.setItem(STORAGE_SESS_KEY, JSON.stringify(s)); }
function loadCurrentId() { return localStorage.getItem(STORAGE_CUR_KEY) || null; }
function saveCurrentId(id) { localStorage.setItem(STORAGE_CUR_KEY, id); }

function newSessionId() { return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function newMsgId()     { return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

function sessionTitle(messages) {
  const first = messages.find(m => m.role === 'user');
  if (!first) return 'New Chat';
  return first.content.slice(0, 48) + (first.content.length > 48 ? '…' : '');
}

// ─── Markdown renderer ────────────────────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return '';
  // Code blocks (``` ... ```)
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    `<pre class="ai-code-block" data-lang="${lang || 'code'}"><code>${escHtml(code.trim())}</code></pre>`
  );
  // Inline code
  text = text.replace(/`([^`\n]+)`/g, '<code class="ai-inline-code">$1</code>');
  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Headings
  text = text.replace(/^### (.+)$/gm, '<h4 class="ai-h4">$1</h4>');
  text = text.replace(/^## (.+)$/gm, '<h3 class="ai-h3">$1</h3>');
  text = text.replace(/^# (.+)$/gm, '<h2 class="ai-h2">$1</h2>');
  // Unordered lists
  text = text.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  text = text.replace(/(<li>.*<\/li>\n?)+/g, m => `<ul class="ai-list">${m}</ul>`);
  // Ordered lists
  text = text.replace(/^\d+\. (.+)$/gm, '<oli>$1</oli>');
  text = text.replace(/(<oli>.*<\/oli>\n?)+/g, m =>
    `<ol class="ai-olist">${m.replace(/<\/?oli>/g, match => match === '<oli>' ? '<li>' : '</li>')}</ol>`
  );
  // Line breaks
  text = text.replace(/\n\n/g, '</p><p class="ai-p">');
  text = text.replace(/\n/g, '<br/>');
  if (!text.startsWith('<h') && !text.startsWith('<pre') && !text.startsWith('<ul') && !text.startsWith('<ol')) {
    text = `<p class="ai-p">${text}</p>`;
  }
  return text;
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Thinking dots ────────────────────────────────────────────────────────────
const ThinkingDots = memo(() => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '2px 0' }}>
    {[0, 1, 2].map(i => (
      <motion.span key={i} style={{ width: 7, height: 7, borderRadius: '50%',
        background: 'var(--accent-primary)', display: 'block' }}
        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
    ))}
  </div>
));

// ─── CopyButton ───────────────────────────────────────────────────────────────
const CopyButton = memo(({ text }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button onClick={copy} title="Copy message" style={S.actionBtn}>
      {copied ? <Check size={13} color="#4ade80" /> : <Copy size={13} />}
    </button>
  );
});

// ─── MessageBubble ────────────────────────────────────────────────────────────
const MessageBubble = memo(({ msg, isLast, onRegenerate, isStreaming }) => {
  const isUser = msg.role === 'user';
  const time = new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row',
        gap: '0.7rem', alignItems: 'flex-start', marginBottom: '1.25rem' }}>

      {/* Avatar */}
      <div style={{ ...S.avatar, background: isUser ? 'var(--gradient-primary)' : 'rgba(99,102,241,0.18)',
        border: isUser ? 'none' : '1px solid rgba(99,102,241,0.3)', flexShrink: 0 }}>
        {isUser ? <User size={15} color="#fff" /> : <Bot size={15} color="var(--accent-primary)" />}
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: '78%', minWidth: 0 }}>
        <div style={{ ...S.bubble,
          background: isUser ? 'var(--gradient-primary)' : 'var(--glass-bg)',
          border: isUser ? 'none' : '1px solid var(--glass-border)',
          borderRadius: isUser ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
          boxShadow: isUser
            ? '0 4px 20px rgba(99,102,241,0.35)'
            : 'var(--glass-glow)',
        }}>
          {msg.thinking && !msg.content ? (
            <ThinkingDots />
          ) : isUser ? (
            <p style={{ margin: 0, color: '#fff', lineHeight: 1.6, fontSize: '0.93rem',
              whiteSpace: 'pre-wrap' }}>{msg.content}</p>
          ) : (
            <div className="ai-markdown" style={{ color: 'var(--text-primary)', fontSize: '0.93rem' }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
          )}
        </div>

        {/* Timestamp + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem',
          marginTop: '0.3rem', flexDirection: isUser ? 'row-reverse' : 'row' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', opacity: 0.6 }}>{time}</span>
          {!isUser && msg.content && (
            <>
              <CopyButton text={msg.content} />
              {isLast && !isStreaming && (
                <button onClick={onRegenerate} title="Regenerate" style={S.actionBtn}>
                  <RefreshCw size={13} />
                </button>
              )}
            </>
          )}
          {isUser && <CopyButton text={msg.content} />}
        </div>
      </div>
    </motion.div>
  );
});

// ─── ChatSidebar ─────────────────────────────────────────────────────────────
const ChatSidebar = memo(({
  sessions, currentId, onSelect, onNew, onDelete, searchQ, setSearchQ, open, onClose,
}) => {
  const filtered = useMemo(() =>
    sessions.filter(s => s.title.toLowerCase().includes(searchQ.toLowerCase()))
      .sort((a, b) => b.updatedAt - a.updatedAt),
    [sessions, searchQ]
  );

  return (
    <>
      {/* Overlay on mobile */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 39,
              display: 'none' }}
            className="sidebar-overlay" />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ x: open ? 0 : '-100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{ ...S.sidebar, zIndex: 40 }}
        className="ai-sidebar">

        {/* Header */}
        <div style={S.sidebarHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bot size={18} color="var(--accent-primary)" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{AI_NAME}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button onClick={onNew} title="New chat" style={{ ...S.iconBtn, background: 'var(--gradient-primary)' }}>
              <Plus size={15} color="#fff" />
            </button>
            <button onClick={onClose} style={S.iconBtn} className="sidebar-close-btn">
              <ChevronLeft size={15} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '0 0.75rem 0.75rem', position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: '1.25rem', top: '50%',
            transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="Search chats…"
            style={{ ...S.searchInput, paddingLeft: '2rem' }} />
        </div>

        {/* Sessions */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.5rem' }}>
          <AnimatePresence>
            {filtered.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem',
                marginTop: '2rem', opacity: 0.6 }}>
                {searchQ ? 'No chats found' : 'No conversations yet'}
              </p>
            )}
            {filtered.map(s => (
              <motion.div key={s.id} layout
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                onClick={() => { onSelect(s.id); onClose(); }}
                style={{ ...S.sessionItem,
                  background: s.id === currentId
                    ? 'rgba(99,102,241,0.18)'
                    : 'transparent',
                  borderColor: s.id === currentId
                    ? 'rgba(99,102,241,0.4)'
                    : 'transparent',
                }}>
                <MessageSquare size={13} style={{ flexShrink: 0, marginTop: '2px',
                  color: s.id === currentId ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 500,
                    color: s.id === currentId ? 'var(--text-primary)' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.title}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)', opacity: 0.5 }}>
                    {s.messages.length} msg{s.messages.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button onClick={e => { e.stopPropagation(); onDelete(s.id); }}
                  title="Delete" style={{ ...S.iconBtn, opacity: 0, flexShrink: 0 }}
                  className="delete-session-btn">
                  <Trash2 size={12} color="var(--danger)" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div style={{ padding: '0.75rem', borderTop: '1px solid var(--glass-border)',
          fontSize: '0.72rem', color: 'var(--text-secondary)', textAlign: 'center', opacity: 0.5 }}>
          Powered by Puter.js • Free AI
        </div>
      </motion.aside>
    </>
  );
});

// ─── UsageBanner ─────────────────────────────────────────────────────────────
const UsageBanner = memo(({ used, limit }) => {
  const pct       = Math.min(100, (used / limit) * 100);
  const remaining = Math.max(0, limit - used);
  const isNear    = remaining <= 5;
  const isDone    = remaining === 0;

  return (
    <div style={{ ...S.usageBanner,
      borderColor: isDone ? 'rgba(239,68,68,0.4)' : isNear ? 'rgba(245,158,11,0.3)' : 'var(--glass-border)',
      background: isDone ? 'rgba(239,68,68,0.06)' : isNear ? 'rgba(245,158,11,0.05)' : 'var(--glass-bg)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.25rem' }}>
        <span style={{ fontSize: '0.78rem', color: isDone ? '#f87171' : isNear ? '#fcd34d' : 'var(--text-secondary)' }}>
          {isDone ? '⚠️ Daily limit reached — resets at midnight'
            : isNear ? `⚡ ${remaining} messages left today`
            : `${used} / ${limit} messages used today`}
        </span>
        {isDone && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', opacity: 0.7 }}>
            Come back tomorrow or upgrade ✨
          </span>
        )}
      </div>
      <div style={{ height: '4px', borderRadius: '999px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }}
          style={{ height: '100%', borderRadius: '999px',
            background: isDone
              ? 'linear-gradient(90deg,#ef4444,#f87171)'
              : isNear
                ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                : 'linear-gradient(90deg,#6366f1,#8b5cf6,#d946ef)' }} />
      </div>
    </div>
  );
});

// ─── LimitPopup ───────────────────────────────────────────────────────────────
const LimitPopup = memo(({ onClose }) => (
  <AnimatePresence>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: '1rem' }}>
      <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }} onClick={e => e.stopPropagation()}
        className="glass-panel"
        style={{ maxWidth: '400px', width: '100%', padding: '2rem', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1rem' }}>
          <Zap size={24} color="var(--accent-primary)" />
        </div>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem' }}>Daily Limit Reached</h3>
        <p style={{ margin: '0 0 1.5rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          You've used all <strong style={{ color: 'var(--text-primary)' }}>{DAILY_LIMIT} free messages</strong> for today.
          Your limit resets at midnight.
        </p>
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}
            onClick={onClose}>
            <Sparkles size={15} /> Got it
          </button>
        </div>
      </motion.div>
    </motion.div>
  </AnimatePresence>
));

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page: {
    display: 'flex', height: '100dvh', overflow: 'hidden',
    position: 'relative', background: 'var(--bg-dark)',
  },
  sidebar: {
    width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column',
    background: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
    borderRight: '1px solid var(--glass-border)',
    position: 'fixed', top: 0, left: 0, bottom: 0,
  },
  sidebarHeader: {
    padding: '1rem 0.75rem', borderBottom: '1px solid var(--glass-border)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  main: {
    flex: 1, display: 'flex', flexDirection: 'column',
    minWidth: 0, transition: 'padding-left 0.3s ease',
  },
  topBar: {
    padding: '0.75rem 1rem', borderBottom: '1px solid var(--glass-border)',
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    background: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
    flexShrink: 0,
  },
  messagesArea: {
    flex: 1, overflowY: 'auto', padding: '1.5rem 1rem',
    scrollBehavior: 'smooth',
  },
  inputArea: {
    padding: '0.75rem 1rem 1rem',
    borderTop: '1px solid var(--glass-border)',
    background: 'var(--glass-bg)', backdropFilter: 'blur(16px)',
    flexShrink: 0,
  },
  inputRow: {
    display: 'flex', gap: '0.6rem', alignItems: 'flex-end',
    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)',
    borderRadius: '14px', padding: '0.5rem 0.5rem 0.5rem 1rem',
    transition: 'border-color 0.2s',
  },
  textarea: {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    color: 'var(--text-primary)', fontSize: '0.93rem', resize: 'none',
    fontFamily: 'inherit', lineHeight: 1.6, maxHeight: '160px',
    overflowY: 'auto', paddingTop: '0.25rem',
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: '10px', flexShrink: 0,
    background: 'var(--gradient-primary)', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s', boxShadow: '0 2px 12px rgba(99,102,241,0.4)',
  },
  avatar: {
    width: 30, height: 30, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  bubble: {
    padding: '0.75rem 1rem', backdropFilter: 'blur(8px)',
  },
  actionBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'var(--text-secondary)', padding: '2px', lineHeight: 0,
    borderRadius: '4px', transition: 'color 0.15s',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  iconBtn: {
    width: 28, height: 28, borderRadius: '8px', border: '1px solid var(--glass-border)',
    background: 'rgba(255,255,255,0.05)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text-secondary)', transition: 'all 0.15s',
  },
  sessionItem: {
    display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
    padding: '0.6rem 0.5rem', borderRadius: '10px', cursor: 'pointer',
    border: '1px solid transparent', transition: 'all 0.15s',
    marginBottom: '2px',
  },
  searchInput: {
    width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--glass-border)', borderRadius: '8px',
    padding: '0.4rem 0.75rem', color: 'var(--text-primary)',
    fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit',
  },
  usageBanner: {
    padding: '0.6rem 0.85rem', borderRadius: '10px',
    border: '1px solid', marginBottom: '0.75rem',
    backdropFilter: 'blur(8px)',
  },
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100%', gap: '0.75rem',
    padding: '2rem', textAlign: 'center',
  },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AiChat() {
  const [sessions,    setSessions]    = useState(loadSessions);
  const [currentId,   setCurrentId]   = useState(loadCurrentId);
  const [input,       setInput]       = useState('');
  const [streaming,   setStreaming]   = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQ,     setSearchQ]     = useState('');
  const [usage,       setUsage]       = useState(getUsage);
  const [showLimit,   setShowLimit]   = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);
  const abortRef       = useRef(false);

  // Current session
  const currentSession = useMemo(
    () => sessions.find(s => s.id === currentId) || null,
    [sessions, currentId]
  );
  const messages = currentSession?.messages || [];

  // Persist sessions
  useEffect(() => { saveSessions(sessions); }, [sessions]);
  useEffect(() => { if (currentId) saveCurrentId(currentId); }, [currentId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, [input]);

  // Sidebar auto-close on small screens
  useEffect(() => {
    const check = () => { if (window.innerWidth < 768) setSidebarOpen(false); };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ── Session helpers ──
  const createSession = useCallback(() => {
    const id  = newSessionId();
    const now = Date.now();
    const s   = { id, title: 'New Chat', messages: [], createdAt: now, updatedAt: now };
    setSessions(prev => [s, ...prev]);
    setCurrentId(id);
    setInput('');
    return id;
  }, []);

  const ensureSession = useCallback(() => {
    if (currentId && sessions.find(s => s.id === currentId)) return currentId;
    return createSession();
  }, [currentId, sessions, createSession]);

  const updateSession = useCallback((id, updater) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...updater(s), updatedAt: Date.now() } : s));
  }, []);

  const deleteSession = useCallback((id) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentId === id) {
      const remaining = sessions.filter(s => s.id !== id);
      setCurrentId(remaining[0]?.id || null);
    }
    toast.success('Chat deleted');
  }, [currentId, sessions]);

  // ── Send message ──
  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    // Limit check
    const u = getUsage();
    if (u.count >= DAILY_LIMIT) { setShowLimit(true); return; }

    const sid = ensureSession();
    const userMsg = { id: newMsgId(), role: 'user', content: trimmed, ts: Date.now() };
    const aiMsg   = { id: newMsgId(), role: 'assistant', content: '', thinking: true, ts: Date.now() };

    // Append user + placeholder AI message
    updateSession(sid, s => ({
      messages: [...s.messages, userMsg, aiMsg],
      title: s.messages.length === 0 ? sessionTitle([userMsg]) : s.title,
    }));
    setInput('');
    setStreaming(true);
    abortRef.current = false;

    // Increment usage
    const newCount = incrementUsage();
    setUsage({ date: getTodayKey(), count: newCount });

    try {
      // Build conversation history for puter (last 20 messages for context window)
      const history = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...(sessions.find(s => s.id === sid)?.messages.slice(-18) || []).map(m => ({
          role: m.role, content: m.content,
        })),
        { role: 'user', content: trimmed },
      ];

      // Dynamic import to keep initial bundle small
      const { puter } = await import('@heyputer/puter.js');

      let accumulated = '';
      const response  = await puter.ai.chat(history, { stream: true });

      for await (const part of response) {
        if (abortRef.current) break;
        const chunk = part?.text || part?.toString?.() || '';
        accumulated += chunk;
        // Update AI message content live
        updateSession(sid, s => ({
          messages: s.messages.map(m =>
            m.id === aiMsg.id ? { ...m, content: accumulated, thinking: false } : m
          ),
        }));
      }

      // Finalize
      updateSession(sid, s => ({
        messages: s.messages.map(m =>
          m.id === aiMsg.id ? { ...m, content: accumulated || '(No response)', thinking: false } : m
        ),
      }));
    } catch (err) {
      console.error('[AiChat]', err);
      const errText = err?.message?.includes('quota') || err?.message?.includes('limit')
        ? 'Rate limit hit — please wait a moment and try again.'
        : `Error: ${err.message || 'Failed to get response'}`;
      updateSession(sid, s => ({
        messages: s.messages.map(m =>
          m.id === aiMsg.id ? { ...m, content: errText, thinking: false } : m
        ),
      }));
      toast.error('AI response failed');
    } finally {
      setStreaming(false);
      abortRef.current = false;
    }
  }, [streaming, ensureSession, updateSession, sessions]);

  const handleSend = useCallback(() => sendMessage(input), [sendMessage, input]);

  const handleRegenerate = useCallback(() => {
    if (!currentSession) return;
    const lastUser = [...currentSession.messages].reverse().find(m => m.role === 'user');
    if (!lastUser) return;
    // Remove last AI message then re-send
    updateSession(currentId, s => ({
      messages: s.messages.slice(0, -1),
    }));
    setTimeout(() => sendMessage(lastUser.content), 50);
  }, [currentSession, currentId, updateSession, sendMessage]);

  const handleStop = useCallback(() => { abortRef.current = true; }, []);

  const handleClear = useCallback(() => {
    if (!currentId) return;
    updateSession(currentId, s => ({ ...s, messages: [], title: 'New Chat' }));
    toast.success('Chat cleared');
  }, [currentId, updateSession]);

  const handleExport = useCallback(() => {
    if (!messages.length) return;
    const text = messages.map(m =>
      `[${m.role === 'user' ? 'You' : AI_NAME}] ${new Date(m.ts).toLocaleTimeString()}\n${m.content}`
    ).join('\n\n---\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'chat-export.txt'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Chat exported');
  }, [messages]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const isLimited = usage.count >= DAILY_LIMIT;
  const mainPaddingLeft = sidebarOpen ? '260px' : '0';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      {/* Floating background orbs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
          top: '-10%', left: '20%', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
          bottom: '5%', right: '10%', filter: 'blur(40px)' }} />
      </div>

      {/* Sidebar */}
      <ChatSidebar
        sessions={sessions} currentId={currentId}
        onSelect={setCurrentId} onNew={createSession}
        onDelete={deleteSession} searchQ={searchQ}
        setSearchQ={setSearchQ} open={sidebarOpen}
        onClose={() => setSidebarOpen(false)} />

      {/* Main area */}
      <div style={{ ...S.main, paddingLeft: mainPaddingLeft, position: 'relative', zIndex: 1 }}
        className="ai-main">

        {/* Top bar */}
        <div style={S.topBar}>
          <button onClick={() => setSidebarOpen(v => !v)} style={S.iconBtn} title="Toggle sidebar">
            {sidebarOpen ? <X size={15} /> : <Menu size={15} />}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
            <Bot size={16} color="var(--accent-primary)" />
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
              {currentSession?.title || AI_NAME}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {messages.length > 0 && (
              <>
                <button onClick={handleExport} style={S.iconBtn} title="Export chat">
                  <Download size={14} />
                </button>
                <button onClick={handleClear} style={S.iconBtn} title="Clear chat">
                  <Trash2 size={14} color="var(--danger)" />
                </button>
              </>
            )}
            <button onClick={createSession} style={{ ...S.iconBtn,
              background: 'var(--gradient-primary)', borderColor: 'transparent' }} title="New chat">
              <Plus size={14} color="#fff" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={S.messagesArea} id="messages-area">
          {messages.length === 0 ? (
            <div style={S.emptyState}>
              {/* Logo */}
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
                style={{ width: 72, height: 72, borderRadius: '50%',
                  background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 40px rgba(99,102,241,0.15)' }}>
                <Bot size={32} color="var(--accent-primary)" />
              </motion.div>

              <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}>
                <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.4rem' }}>
                  Hello! I'm {AI_NAME}
                </h2>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Ask me anything — coding, writing, analysis, or just chat.
                </p>
              </motion.div>

              {/* Suggested prompts */}
              <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '0.6rem', maxWidth: '640px', width: '100%', marginTop: '0.5rem' }}>
                {SUGGESTED_PROMPTS.map(({ icon: Icon, label, text }) => (
                  <motion.button key={label} whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
                    onClick={() => sendMessage(text)} disabled={isLimited}
                    style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                      borderRadius: '12px', padding: '0.75rem 0.85rem', cursor: 'pointer',
                      textAlign: 'left', transition: 'all 0.2s',
                      backdropFilter: 'blur(12px)', opacity: isLimited ? 0.4 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <Icon size={13} color="var(--accent-primary)" />
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                        {label}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)',
                      lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {text}
                    </p>
                  </motion.button>
                ))}
              </motion.div>
            </div>
          ) : (
            <div style={{ maxWidth: '820px', margin: '0 auto', width: '100%' }}>
              {messages.map((msg, i) => (
                <MessageBubble key={msg.id} msg={msg}
                  isLast={i === messages.length - 1}
                  onRegenerate={handleRegenerate}
                  isStreaming={streaming} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div style={S.inputArea}>
          <div style={{ maxWidth: '820px', margin: '0 auto' }}>
            <UsageBanner used={usage.count} limit={DAILY_LIMIT} />

            <div style={{ ...S.inputRow, borderColor: isLimited ? 'rgba(239,68,68,0.3)' : undefined }}
              onFocus={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--glass-border)'}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isLimited
                  ? 'Daily limit reached — come back tomorrow'
                  : 'Ask anything… (Enter to send, Shift+Enter for new line)'}
                disabled={isLimited}
                rows={1}
                style={{ ...S.textarea, opacity: isLimited ? 0.5 : 1,
                  cursor: isLimited ? 'not-allowed' : 'text' }} />

              {streaming ? (
                <motion.button whileTap={{ scale: 0.92 }}
                  onClick={handleStop}
                  style={{ ...S.sendBtn, background: 'rgba(239,68,68,0.8)' }}
                  title="Stop generating">
                  <StopCircle size={17} color="#fff" />
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }}
                  onClick={handleSend}
                  disabled={!input.trim() || isLimited}
                  style={{ ...S.sendBtn,
                    opacity: !input.trim() || isLimited ? 0.45 : 1,
                    cursor: !input.trim() || isLimited ? 'not-allowed' : 'pointer' }}
                  title="Send (Enter)">
                  <Send size={16} color="#fff" />
                </motion.button>
              )}
            </div>

            <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-secondary)',
              opacity: 0.45, marginTop: '0.4rem' }}>
              {AI_NAME} can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </div>

      {/* Limit popup */}
      {showLimit && <LimitPopup onClose={() => setShowLimit(false)} />}

      {/* Scoped styles */}
      <style>{`
        .ai-sidebar { transition: transform 0.3s cubic-bezier(.4,0,.2,1); }
        .ai-main { transition: padding-left 0.3s cubic-bezier(.4,0,.2,1); }

        @media (max-width: 767px) {
          .ai-main { padding-left: 0 !important; }
          .sidebar-close-btn { display: flex !important; }
          .sidebar-overlay { display: block !important; }
        }
        @media (min-width: 768px) {
          .sidebar-close-btn { display: none !important; }
        }

        .ai-session-item:hover .delete-session-btn { opacity: 1 !important; }
        .delete-session-btn:hover { background: rgba(239,68,68,0.1) !important; border-color: rgba(239,68,68,0.3) !important; }

        /* Markdown styles */
        .ai-markdown { line-height: 1.7; }
        .ai-markdown .ai-p { margin: 0 0 0.6em; color: var(--text-primary); }
        .ai-markdown .ai-p:last-child { margin-bottom: 0; }
        .ai-markdown .ai-h2 { font-size: 1.15rem; font-weight: 700; margin: 0.8em 0 0.4em; color: var(--text-primary); }
        .ai-markdown .ai-h3 { font-size: 1.05rem; font-weight: 600; margin: 0.7em 0 0.35em; color: var(--text-primary); }
        .ai-markdown .ai-h4 { font-size: 0.95rem; font-weight: 600; margin: 0.6em 0 0.3em; color: var(--text-primary); }
        .ai-markdown .ai-list,
        .ai-markdown .ai-olist { margin: 0.4em 0 0.6em 1.2em; padding: 0; }
        .ai-markdown .ai-list li,
        .ai-markdown .ai-olist li { margin-bottom: 0.25em; color: var(--text-primary); font-size: 0.91rem; }
        .ai-markdown strong { font-weight: 700; color: var(--text-primary); }
        .ai-markdown em { font-style: italic; }

        .ai-inline-code {
          background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.25);
          padding: 1px 5px; border-radius: 4px; font-family: 'Fira Code', 'Cascadia Code', monospace;
          font-size: 0.85em; color: #a78bfa;
        }
        .ai-code-block {
          background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px; padding: 1rem; margin: 0.6em 0;
          overflow-x: auto; position: relative;
        }
        .ai-code-block::before {
          content: attr(data-lang);
          position: absolute; top: 6px; right: 10px;
          font-size: 0.68rem; color: rgba(255,255,255,0.3);
          text-transform: uppercase; letter-spacing: 0.08em;
        }
        .ai-code-block code {
          font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
          font-size: 0.83rem; color: #e2e8f0; white-space: pre;
        }

        /* Scrollbar */
        #messages-area::-webkit-scrollbar { width: 4px; }
        #messages-area::-webkit-scrollbar-track { background: transparent; }
        #messages-area::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

        /* Session item hover */
        div[data-sess]:hover .delete-session-btn { opacity: 1 !important; }
      `}</style>
    </div>
  );
}

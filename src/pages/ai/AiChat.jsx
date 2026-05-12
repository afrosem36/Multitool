import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  Send, Bot, User, Copy, RefreshCw, Trash2, Download,
  Plus, Search, ChevronLeft, Sparkles, MessageSquare,
  Code, Zap, Brain, Check, Menu, X, StopCircle, Mic, Paperclip, Image as ImageIcon,
  AlertCircle, Loader, LogIn, LogOut,
} from 'lucide-react';
import { getCredits, saveCredits, spendCredits, canAfford, getResetCountdown, CREDIT_COSTS } from './aiCredits';
import { classifyIntent, buildContextForIntent } from './aiCapabilities';
import { useAuth } from '../../context/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const AI_NAME       = 'MultiTool AI';
const MAX_CREDITS   = 50;
const SYSTEM_PROMPT = `You are ${AI_NAME}, a smart, helpful, and friendly AI assistant built into MultiTool Hub. You help with coding, writing, analysis, math, creative tasks, and general questions. You are direct, modern, and conversational.

IMPORTANT CAPABILITY AWARENESS:
- When asked about live weather, elections, stock prices, current news, sports scores, or real-time data: Honestly note that you don't currently have live internet access.
- You support text generation, image creation, code writing, math solving, and general knowledge.
- Always be natural and helpful, even when explaining limitations.

Be concise, use markdown formatting (bold, code blocks, lists) where appropriate. Show personality.`;

const SUGGESTED_PROMPTS = [
  { icon: Code,          label: 'Write code',      text: 'Write a Python function to reverse a linked list' },
  { icon: Brain,         label: 'Explain concept', text: 'Explain how neural networks learn in simple terms' },
  { icon: Zap,           label: 'Quick task',      text: 'Give me 5 productivity tips for developers' },
  { icon: MessageSquare, label: 'Draft message',   text: 'Write a professional email to reschedule a meeting' },
  { icon: Sparkles,      label: 'Creative',        text: 'Write a short story about an AI that discovers music' },
  { icon: ImageIcon,     label: 'Image',           text: 'Draw a cozy cyberpunk cafe at night with warm neon lights' },
];

// ─── Per-user storage helpers ─────────────────────────────────────────────────
function getStorageKeys(userId) {
  const suffix = userId ? `_${userId}` : '_guest';
  return {
    sessions: `ai_chat_sessions${suffix}`,
    current:  `ai_chat_current${suffix}`,
  };
}

function loadSessions(userId) {
  try {
    const key = getStorageKeys(userId).sessions;
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch { return []; }
}

function saveSessions(sessions, userId) {
  const key = getStorageKeys(userId).sessions;
  localStorage.setItem(key, JSON.stringify(sessions));
}

function loadCurrentId(userId) {
  return localStorage.getItem(getStorageKeys(userId).current) || null;
}

function saveCurrentId(id, userId) {
  localStorage.setItem(getStorageKeys(userId).current, id);
}

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function sessionTitle(messages) {
  const first = messages.find(m => m.role === 'user');
  if (!first) return 'New Chat';
  return first.content.slice(0, 46) + (first.content.length > 46 ? '…' : '');
}

// ─── Markdown renderer — copy button uses data attribute (no inline onclick) ──
function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMarkdown(text) {
  if (!text) return '';

  // Fenced code blocks
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const trimmed = code.trim();
    const label   = lang || 'code';
    return (
      `<div class="ai-code-wrap">` +
        `<div class="ai-code-header">` +
          `<span class="ai-code-lang">${label.toUpperCase()}</span>` +
          `<button class="ai-code-copy" data-code="${encodeURIComponent(trimmed)}">Copy</button>` +
        `</div>` +
        `<pre class="ai-code-pre"><code>${escHtml(trimmed)}</code></pre>` +
      `</div>`
    );
  });

  // Inline code
  text = text.replace(/`([^`\n]+)`/g, '<code class="ai-inline-code">$1</code>');
  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  // Headings
  text = text.replace(/^### (.+)$/gm, '<h4 class="ai-h">$1</h4>');
  text = text.replace(/^## (.+)$/gm,  '<h3 class="ai-h">$1</h3>');
  text = text.replace(/^# (.+)$/gm,   '<h2 class="ai-h">$1</h2>');
  // Unordered lists
  text = text.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  text = text.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, m => `<ul class="ai-list">${m}</ul>`);
  // Ordered lists
  text = text.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  // Paragraphs
  text = text.replace(/\n\n/g, '</p><p class="ai-p">');
  text = text.replace(/\n/g, '<br/>');
  if (!text.startsWith('<h') && !text.startsWith('<div') && !text.startsWith('<ul') && !text.startsWith('<ol')) {
    text = `<p class="ai-p">${text}</p>`;
  }
  return text;
}

// ─── Response content extractor ───────────────────────────────────────────────
function extractResponseContent(response) {
  if (!response) return '';
  if (typeof response === 'string') return response;
  if (response.message?.content) return String(response.message.content).trim();
  if (response.text) return String(response.text).trim();
  if (response.content && typeof response.content === 'string') return String(response.content).trim();
  if (Array.isArray(response.choices) && response.choices[0]?.message?.content)
    return String(response.choices[0].message.content).trim();
  if (Array.isArray(response.content) && response.content[0]?.text)
    return String(response.content[0].text).trim();
  const str = String(response);
  if (str && str !== '[object Object]') return str.trim();
  return '';
}

// ─── ThinkingDots ─────────────────────────────────────────────────────────────
const ThinkingDots = memo(() => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 0' }}>
    {[0, 1, 2].map(i => (
      <motion.span key={i}
        style={{ width: 7, height: 7, borderRadius: '50%', background: '#9ca3af', display: 'block' }}
        animate={{ opacity: [0.3, 1, 0.3], scale: [0.7, 1, 0.7] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }} />
    ))}
  </div>
));

// ─── CopyButton (message-level) ───────────────────────────────────────────────
const CopyButton = memo(({ text, style }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        });
      }}
      title="Copy"
      style={{ background: 'none', borderWidth: 0, cursor: 'pointer', padding: '4px 6px',
        borderRadius: 6, color: '#6b7280', display: 'flex', alignItems: 'center', ...style }}>
      {copied ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
    </button>
  );
});

// ─── MessageBubble ────────────────────────────────────────────────────────────
const MessageBubble = memo(({ msg, isLast, onRegenerate, isStreaming }) => {
  const isUser  = msg.role === 'user';
  const isImage = msg.type === 'image';
  const time    = new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row',
        gap: '0.85rem', alignItems: 'flex-start', marginBottom: '1.75rem', width: '100%' }}>

      {/* Avatar */}
      <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: isUser ? '#6366f1' : '#1e1e2e',
        borderWidth: 1, borderStyle: 'solid',
        borderColor: isUser ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)' }}>
        {isUser ? <User size={16} color="#fff" /> : <Bot size={16} color="#8b8fa8" />}
      </div>

      {/* Bubble / content */}
      <div style={{ maxWidth: 'min(90%, 640px)', minWidth: 0 }}>
        {/* Message body */}
        <div style={{
          padding: isUser ? '0.75rem 1.1rem' : '0.2rem 0',
          background: isUser ? '#2f2f2f' : 'transparent',
          borderRadius: isUser ? '18px 18px 4px 18px' : 0,
          wordBreak: 'break-word',
        }}>
          {msg.thinking && !msg.content ? (
            <ThinkingDots />
          ) : isImage ? (
            <div style={{ textAlign: 'center' }}>
              <img src={msg.content} alt="Generated"
                style={{ maxWidth: '100%', borderRadius: 12, marginBottom: '0.5rem' }} />
              <a href={msg.content} download
                style={{ fontSize: '0.8rem', color: '#818cf8', textDecoration: 'none' }}>
                ⬇ Download
              </a>
            </div>
          ) : isUser ? (
            <p style={{ margin: 0, color: '#f3f4f6', lineHeight: 1.65, fontSize: '0.94rem', whiteSpace: 'pre-wrap' }}>
              {msg.content}
            </p>
          ) : (
            <div
              className="ai-markdown"
              onClick={(e) => {
                const btn = e.target.closest('.ai-code-copy');
                if (!btn) return;
                const code = decodeURIComponent(btn.dataset.code || '');
                navigator.clipboard.writeText(code).then(() => {
                  btn.textContent = 'Copied!';
                  setTimeout(() => btn.textContent = 'Copy', 1800);
                });
              }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
            />
          )}
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem',
          flexDirection: isUser ? 'row-reverse' : 'row', paddingLeft: isUser ? 0 : 2 }}>
          <span style={{ fontSize: '0.68rem', color: '#4b5563' }}>{time}</span>
          {!isUser && msg.content && !isImage && (
            <>
              <CopyButton text={msg.content} />
              {isLast && !isStreaming && (
                <button onClick={onRegenerate} title="Regenerate"
                  style={{ background: 'none', borderWidth: 0, cursor: 'pointer', padding: '4px 6px',
                    borderRadius: 6, color: '#6b7280', display: 'flex', alignItems: 'center' }}>
                  <RefreshCw size={13} />
                </button>
              )}
              <span style={{ fontSize: '0.65rem', color: '#374151' }}>Puter AI</span>
            </>
          )}
          {isUser && <CopyButton text={msg.content} />}
        </div>
      </div>
    </motion.div>
  );
});

// ─── Login Gate ───────────────────────────────────────────────────────────────
const LoginGate = ({ onLogin }) => {
  const navigate = useNavigate();
  return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0d0d0d', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        style={{ textAlign: 'center', padding: '3rem 2rem', maxWidth: 380 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#1a1a2e',
          borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(99,102,241,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
          <Bot size={32} color="#6366f1" />
        </div>
        <h2 style={{ color: '#f3f4f6', fontSize: '1.5rem', fontWeight: 600, margin: '0 0 0.75rem' }}>
          {AI_NAME}
        </h2>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0 0 2rem', lineHeight: 1.6 }}>
          Sign in to access your personal AI chat with saved history.
        </p>
        <button
          onClick={() => navigate('/login', { state: { from: '/ai-chat' } })}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
            padding: '0.85rem 2rem', background: '#6366f1', color: '#fff',
            borderWidth: 0, borderRadius: 12, fontSize: '0.95rem', fontWeight: 600,
            cursor: 'pointer', transition: 'background 0.2s' }}>
          <LogIn size={18} /> Sign In to Continue
        </button>
        <p style={{ color: '#4b5563', fontSize: '0.8rem', margin: '1.5rem 0 0' }}>
          Don't have an account?{' '}
          <button onClick={() => navigate('/signup')}
            style={{ background: 'none', borderWidth: 0, color: '#818cf8', cursor: 'pointer',
              fontSize: '0.8rem', padding: 0, textDecoration: 'underline' }}>
            Sign Up
          </button>
        </p>
      </motion.div>
    </div>
  );
};

// ─── Credits Bar ──────────────────────────────────────────────────────────────
const CreditsBar = memo(({ credits, maxCredits, resetCountdown }) => {
  const pct    = Math.floor((credits / maxCredits) * 100);
  const isLow  = credits <= 10;
  const empty  = credits === 0;
  const color  = empty ? '#ef4444' : isLow ? '#f59e0b' : '#6366f1';

  return (
    <div style={{ padding: '0.5rem 0 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ flex: 1, height: 4, background: '#1f1f1f', borderRadius: 2, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4 }}
          style={{ height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: '0.72rem', color: '#4b5563', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {credits}/{maxCredits} cr
        {isLow && <span style={{ color: '#f59e0b', marginLeft: 6 }}>· resets {resetCountdown}</span>}
      </span>
    </div>
  );
});

// ─── Chat Sidebar ─────────────────────────────────────────────────────────────
const ChatSidebar = memo(({ sessions, currentId, onSelect, onNew, onDelete, searchQ, setSearchQ, open, onClose, user, onLogout }) => {
  const filtered = useMemo(() =>
    sessions.filter(s => s.title.toLowerCase().includes(searchQ.toLowerCase())),
    [sessions, searchQ]
  );

  return (
    <motion.div
      initial={false}
      animate={{ x: open ? 0 : -260 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      style={{ position: 'fixed', top: 0, left: 0, width: 260, height: '100dvh',
        background: '#171717', display: 'flex', flexDirection: 'column',
        zIndex: 40, overflow: 'hidden',
        borderWidth: '0 1px 0 0', borderStyle: 'solid', borderColor: '#262626' }}>

      {/* Header */}
      <div style={{ padding: '1.1rem 1rem 0.75rem', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: '#262626' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bot size={18} color="#6366f1" />
          <span style={{ fontWeight: 700, color: '#f3f4f6', fontSize: '0.92rem' }}>{AI_NAME}</span>
        </div>
        <button onClick={onClose} className="sidebar-close-btn"
          style={{ background: 'none', borderWidth: 0, color: '#4b5563', cursor: 'pointer',
            padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
          <X size={16} />
        </button>
      </div>

      {/* New chat */}
      <div style={{ padding: '0.75rem' }}>
        <button onClick={onNew}
          style={{ width: '100%', padding: '0.65rem 1rem', background: '#212121',
            borderWidth: 1, borderStyle: 'solid', borderColor: '#333',
            borderRadius: 10, color: '#d1d5db', cursor: 'pointer', fontSize: '0.88rem',
            display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'background 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.background = '#2a2a2a'}
          onMouseLeave={e => e.currentTarget.style.background = '#212121'}>
          <Plus size={15} /> New Chat
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '0 0.75rem 0.5rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%',
            transform: 'translateY(-50%)', color: '#4b5563', pointerEvents: 'none' }} />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search chats…"
            style={{ width: '100%', padding: '0.55rem 0.75rem 0.55rem 2rem',
              background: '#212121', borderWidth: 1, borderStyle: 'solid', borderColor: '#333',
              borderRadius: 8, color: '#d1d5db', fontSize: '0.82rem',
              outline: 'none', boxSizing: 'border-box' }} />
        </div>
      </div>

      {/* Chat list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.5rem' }}>
        {filtered.length === 0 ? (
          <p style={{ color: '#4b5563', fontSize: '0.8rem', textAlign: 'center', padding: '2rem 1rem' }}>
            No chats yet
          </p>
        ) : filtered.map(s => (
          <div key={s.id} onClick={() => onSelect(s.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.6rem 0.7rem', borderRadius: 8, margin: '2px 0',
              background: currentId === s.id ? '#212121' : 'transparent',
              cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => { if (currentId !== s.id) e.currentTarget.style.background = '#1c1c1c'; }}
            onMouseLeave={e => { if (currentId !== s.id) e.currentTarget.style.background = 'transparent'; }}>
            <MessageSquare size={13} color="#4b5563" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '0.83rem', color: '#d1d5db',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.title}
            </span>
            <button onClick={e => { e.stopPropagation(); onDelete(s.id); }}
              style={{ background: 'none', borderWidth: 0, color: '#4b5563', cursor: 'pointer',
                padding: 3, borderRadius: 4, display: 'flex', alignItems: 'center', opacity: 0.7,
                flexShrink: 0 }}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* User / logout footer */}
      <div style={{ padding: '0.75rem', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: '#262626' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.4rem',
          borderRadius: 8, background: '#212121' }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#6366f1',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <User size={14} color="#fff" />
          </div>
          <span style={{ flex: 1, fontSize: '0.8rem', color: '#9ca3af',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email || 'User'}
          </span>
          <button onClick={onLogout} title="Sign out"
            style={{ background: 'none', borderWidth: 0, color: '#4b5563', cursor: 'pointer',
              padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
});

// ─── Credits Exhausted Modal ──────────────────────────────────────────────────
const CreditModal = memo(({ onClose }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
      backdropFilter: 'blur(6px)' }}
    onClick={onClose}>
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={e => e.stopPropagation()}
      style={{ background: '#1a1a1a', borderWidth: 1, borderStyle: 'solid', borderColor: '#333',
        borderRadius: 20, padding: '2rem', maxWidth: 380, textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
      <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
      <h3 style={{ color: '#f3f4f6', fontSize: '1.2rem', fontWeight: 600, margin: '0 0 0.6rem' }}>
        Credits Exhausted
      </h3>
      <p style={{ color: '#6b7280', fontSize: '0.88rem', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
        You've used all your daily credits. They reset at midnight.
      </p>
      <button onClick={onClose}
        style={{ padding: '0.75rem 2rem', background: '#6366f1', color: '#fff',
          borderWidth: 0, borderRadius: 10, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}>
        Got it
      </button>
    </motion.div>
  </motion.div>
));

// ─── Under-Development Gate ───────────────────────────────────────────────────
function AiChatUnavailable() {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#07070f 0%,#0d0d1a 100%)', padding: '2rem',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20, margin: '0 auto 1.5rem',
          background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
        }}>
          <Bot size={32} style={{ color: '#fff' }}/>
        </div>
        <h1 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.6rem', marginBottom: '.6rem' }}>
          AI Chat
        </h1>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '.4rem',
          background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 100, padding: '.3rem .85rem', marginBottom: '1.2rem',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}/>
          <span style={{ fontSize: '.78rem', fontWeight: 600, color: '#fbbf24' }}>Under Development</span>
        </div>
        <p style={{ color: '#64748b', fontSize: '.95rem', lineHeight: 1.65, marginBottom: '1.75rem' }}>
          AI Chat is currently under development and will be available soon.
          We're working on making it smarter and more reliable for you.
        </p>
        <button onClick={() => navigate(-1)} style={{
          display: 'inline-flex', alignItems: 'center', gap: '.45rem',
          background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
          border: 'none', borderRadius: 10, padding: '.65rem 1.4rem',
          fontWeight: 700, fontSize: '.9rem', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
        }}>
          ← Go Back
        </button>
      </div>
    </div>
  );
}

// ─── Main AiChat Component ────────────────────────────────────────────────────
export default function AiChat() {
  return <AiChatUnavailable />;
}

function AiChatFull() {
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();

  // Per-user sessions
  const userId = user?.id || user?._id || null;

  const [sessions, setSessions]     = useState(() => loadSessions(userId));
  const [currentId, setCurrentId]   = useState(() => loadCurrentId(userId));
  const [input, setInput]           = useState('');
  const [streaming, setStreaming]    = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQ, setSearchQ]       = useState('');
  const [credits, setCredits]       = useState(() => getCredits().credits);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [voiceMode, setVoiceMode]   = useState('idle');
  const [pendingImageGen, setPendingImageGen] = useState(false);
  const [resetCountdown, setResetCountdown] = useState(() => getResetCountdown().display);

  const messagesEndRef   = useRef(null);
  const textareaRef      = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const audioFileInputRef = useRef(null);
  const abortRef         = useRef(false);

  const currentSession = useMemo(() => sessions.find(s => s.id === currentId), [sessions, currentId]);
  const messages = currentSession?.messages || [];

  // Re-load sessions when user changes
  useEffect(() => {
    if (!authLoading) {
      const loaded   = loadSessions(userId);
      const loadedId = loadCurrentId(userId);
      setSessions(loaded);
      setCurrentId(loadedId);
    }
  }, [userId, authLoading]);

  // Persist sessions
  useEffect(() => { saveSessions(sessions, userId); }, [sessions, userId]);
  useEffect(() => { if (currentId) saveCurrentId(currentId, userId); }, [currentId, userId]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Credits polling
  useEffect(() => {
    const id = setInterval(() => {
      setCredits(getCredits().credits);
      setResetCountdown(getResetCountdown().display);
    }, 10000);
    return () => clearInterval(id);
  }, []);

  // Textarea auto-resize
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, [input]);

  // Sidebar auto-close on mobile
  useEffect(() => {
    const check = () => { if (window.innerWidth < 768) setSidebarOpen(false); };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Session helpers
  const createSession = useCallback(() => {
    const id  = newId('sess');
    const now = Date.now();
    setSessions(prev => [{ id, title: 'New Chat', messages: [], createdAt: now, updatedAt: now }, ...prev]);
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
  }, [currentId, sessions]);

  // Voice
  const handleMicStart = useCallback(async () => {
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = e => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        setVoiceMode('transcribing');
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(blob);
        stream.getTracks().forEach(t => t.stop());
        setVoiceMode('idle');
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setVoiceMode('recording');
    } catch {
      toast.error('Microphone access denied');
    }
  }, []);

  const handleMicStop = useCallback(() => mediaRecorderRef.current?.stop(), []);

  const transcribeAudio = useCallback(async (blob) => {
    try {
      if (!canAfford(CREDIT_COSTS.AUDIO_TRANSCRIPTION)) {
        toast.error('Insufficient credits');
        setVoiceMode('idle');
        return;
      }
      const fd = new FormData();
      fd.append('audio', blob, 'audio.webm');
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Transcription failed');
      const data = await res.json();
      const text = data.text || data.transcription || '';
      setInput(prev => prev + (prev ? ' ' : '') + text);
      textareaRef.current?.focus();
      spendCredits(CREDIT_COSTS.AUDIO_TRANSCRIPTION);
      setCredits(prev => prev - CREDIT_COSTS.AUDIO_TRANSCRIPTION);
      toast.success('Transcription done');
    } catch (err) {
      toast.error('Transcription failed: ' + err.message);
    } finally {
      setVoiceMode('idle');
    }
  }, []);

  // AI call with Puter → Groq fallback
  const callAIWithFallback = useCallback(async (history) => {
    try {
      const { puter } = await import('@heyputer/puter.js');
      const timeout   = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000));
      const response  = await Promise.race([puter.ai.chat(history, { stream: true }), timeout]);
      return { response, usedFallback: false };
    } catch {
      // Groq fallback
      const res = await fetch('/api/groq/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: history,
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });
      if (!res.ok) throw new Error(`Groq error: ${res.status}`);
      const data    = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      const gen     = (async function* () { yield content; })();
      return { response: gen, usedFallback: true };
    }
  }, []);

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const intent = classifyIntent(trimmed);
    const cost   = intent.cost;

    if (!canAfford(cost)) { setShowUpgrade(true); return; }

    // Image generation branch
    if (intent.type?.includes('image_generation')) {
      try {
        setPendingImageGen(true);
        const { puter } = await import('@heyputer/puter.js');
        const imageUrl  = await puter.ai.txt2img(trimmed);
        const sid       = ensureSession();
        const userMsg   = { id: newId('msg'), role: 'user', content: trimmed, ts: Date.now() };
        const imgMsg    = { id: newId('msg'), role: 'assistant', type: 'image', content: imageUrl, ts: Date.now() };
        updateSession(sid, s => ({
          messages: [...s.messages, userMsg, imgMsg],
          title: s.messages.length === 0 ? sessionTitle([userMsg]) : s.title,
        }));
        spendCredits(cost);
        setCredits(prev => prev - cost);
        setInput('');
      } catch (err) {
        toast.error('Image generation failed: ' + err.message);
      } finally {
        setPendingImageGen(false);
      }
      return;
    }

    // Text branch
    const sid     = ensureSession();
    const userMsg = { id: newId('msg'), role: 'user', content: trimmed, ts: Date.now() };
    const aiMsg   = { id: newId('msg'), role: 'assistant', content: '', thinking: true, ts: Date.now() };

    updateSession(sid, s => ({
      messages: [...s.messages, userMsg, aiMsg],
      title: s.messages.length === 0 ? sessionTitle([userMsg]) : s.title,
    }));
    setInput('');
    setStreaming(true);
    abortRef.current = false;

    try {
      let sysPrompt = SYSTEM_PROMPT;
      if (intent.contextHint) sysPrompt += buildContextForIntent(intent);

      const history = [
        { role: 'system', content: sysPrompt },
        ...(sessions.find(s => s.id === sid)?.messages.slice(-18) || []).map(m => ({
          role: m.role, content: m.content,
        })),
        { role: 'user', content: trimmed },
      ];

      const { response, usedFallback } = await callAIWithFallback(history);
      let accumulated = '';

      for await (const part of response) {
        if (abortRef.current) break;
        const chunk = typeof part === 'string' ? part : extractResponseContent(part);
        if (chunk) {
          accumulated += chunk;
          updateSession(sid, s => ({
            messages: s.messages.map(m =>
              m.id === aiMsg.id ? { ...m, content: accumulated, thinking: false } : m
            ),
          }));
        }
      }

      const final = accumulated.trim() || 'Unable to generate a response.';
      updateSession(sid, s => ({
        messages: s.messages.map(m =>
          m.id === aiMsg.id ? { ...m, content: final, thinking: false } : m
        ),
      }));

      if (usedFallback) toast.success('Using Groq fallback AI');
      spendCredits(cost);
      setCredits(prev => prev - cost);
    } catch (err) {
      const errText = err.message?.includes('quota')
        ? 'Rate limit hit — please wait a moment.'
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
  }, [streaming, ensureSession, updateSession, sessions, callAIWithFallback]);

  const handleSend       = useCallback(() => sendMessage(input), [sendMessage, input]);
  const handleStop       = useCallback(() => { abortRef.current = true; }, []);
  const handleRegenerate = useCallback(() => {
    if (!currentSession) return;
    const lastUser = [...currentSession.messages].reverse().find(m => m.role === 'user');
    if (!lastUser) return;
    updateSession(currentId, s => ({ messages: s.messages.slice(0, -1) }));
    setTimeout(() => sendMessage(lastUser.content), 50);
  }, [currentSession, currentId, updateSession, sendMessage]);

  const handleClear = useCallback(() => {
    if (!currentId) return;
    updateSession(currentId, s => ({ ...s, messages: [], title: 'New Chat' }));
  }, [currentId, updateSession]);

  const handleExport = useCallback(() => {
    if (!messages.length) return;
    const text = messages.map(m =>
      `[${m.role === 'user' ? 'You' : AI_NAME}] ${new Date(m.ts).toLocaleTimeString()}\n${m.content}`
    ).join('\n\n---\n\n');
    const a  = document.createElement('a');
    a.href   = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = 'chat.txt';
    a.click();
  }, [messages]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0d0d0d' }}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
          <Loader size={28} color="#6366f1" />
        </motion.div>
      </div>
    );
  }

  if (!user) return <LoginGate />;

  // ── Sidebar content width ─────────────────────────────────────────────────
  const mainPad = sidebarOpen && window.innerWidth >= 768 ? 260 : 0;

  return (
    <div style={{ height: '100dvh', display: 'flex', background: '#0d0d0d',
      fontFamily: "'Inter', system-ui, sans-serif", color: '#f3f4f6', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <ChatSidebar
        sessions={sessions}
        currentId={currentId}
        onSelect={id => { setCurrentId(id); if (window.innerWidth < 768) setSidebarOpen(false); }}
        onNew={createSession}
        onDelete={deleteSession}
        searchQ={searchQ}
        setSearchQ={setSearchQ}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        onLogout={handleLogout}
      />

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        paddingLeft: mainPad, transition: 'padding-left 0.3s ease' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.75rem 1.25rem', borderBottomWidth: 1, borderBottomStyle: 'solid',
          borderBottomColor: '#1f1f1f', flexShrink: 0 }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button onClick={() => setSidebarOpen(v => !v)}
              style={{ background: 'none', borderWidth: 0, color: '#6b7280', cursor: 'pointer',
                padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center' }}>
              <Menu size={18} />
            </button>
            <span style={{ fontSize: '0.88rem', color: '#6b7280', fontWeight: 500 }}>
              {currentSession?.title || 'New Chat'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {[
              { icon: Download, title: 'Export', action: handleExport },
              { icon: Trash2,   title: 'Clear',  action: handleClear },
              { icon: Plus,     title: 'New',    action: createSession },
            ].map(({ icon: Icon, title, action }) => (
              <button key={title} onClick={action} title={title}
                style={{ background: 'none', borderWidth: 0, color: '#4b5563', cursor: 'pointer',
                  padding: '6px 8px', borderRadius: 8, display: 'flex', alignItems: 'center',
                  transition: 'color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#9ca3af'}
                onMouseLeave={e => e.currentTarget.style.color = '#4b5563'}>
                <Icon size={16} />
              </button>
            ))}
          </div>
        </div>

        {/* Messages area — flex:1, overflowY auto, bottom pad so content never hides behind input */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1rem 0' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: '240px' }}>

            {messages.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
                style={{ textAlign: 'center', paddingTop: '15vh' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#1a1a2e',
                  borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(99,102,241,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                  <Bot size={30} color="#6366f1" />
                </div>
                <h2 style={{ color: '#f3f4f6', fontWeight: 600, fontSize: '1.4rem', margin: '0 0 0.5rem' }}>
                  {AI_NAME}
                </h2>
                <p style={{ color: '#4b5563', margin: '0 0 2.5rem', fontSize: '0.88rem' }}>
                  How can I help you today?
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '0.75rem', maxWidth: 560, margin: '0 auto', textAlign: 'left' }}>
                  {SUGGESTED_PROMPTS.map((p, i) => (
                    <motion.button key={i} onClick={() => sendMessage(p.text)}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      style={{ padding: '0.85rem', background: '#1a1a1a',
                        borderWidth: 1, borderStyle: 'solid', borderColor: '#262626',
                        borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                        display: 'flex', flexDirection: 'column', gap: '0.4rem',
                        transition: 'border-color 0.2s, background 0.2s' }}
                      whileHover={{ borderColor: '#404040', background: '#1f1f1f' }}
                      whileTap={{ scale: 0.97 }}>
                      <p.icon size={18} color="#6366f1" />
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#d1d5db' }}>{p.label}</span>
                      <span style={{ fontSize: '0.72rem', color: '#4b5563', lineHeight: 1.4 }}>
                        {p.text.slice(0, 36)}…
                      </span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              messages.map((msg, i) => (
                <MessageBubble key={msg.id} msg={msg}
                  isLast={i === messages.length - 1}
                  onRegenerate={handleRegenerate}
                  isStreaming={streaming && i === messages.length - 1} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area — part of the flex column, NOT overlapping messages */}
        <div style={{ flexShrink: 0, padding: '0 1rem 1.25rem', background: '#0d0d0d' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {/* Tool buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem', alignItems: 'center' }}>
              <button
                onClick={voiceMode === 'recording' ? handleMicStop : handleMicStart}
                disabled={streaming || voiceMode === 'transcribing'}
                title={voiceMode === 'recording' ? 'Stop' : 'Voice input'}
                style={{ padding: '0.4rem 0.75rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem',
                  display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s',
                  background: voiceMode === 'recording' ? 'rgba(239,68,68,0.15)' : '#1a1a1a',
                  borderWidth: 1, borderStyle: 'solid',
                  borderColor: voiceMode === 'recording' ? 'rgba(239,68,68,0.4)' : '#333',
                  color: voiceMode === 'recording' ? '#ef4444' : '#6b7280' }}>
                {voiceMode === 'transcribing'
                  ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Mic size={13} />}
                {voiceMode === 'recording' ? 'Stop' : voiceMode === 'transcribing' ? 'Transcribing…' : 'Voice'}
              </button>

              <button onClick={() => audioFileInputRef.current?.click()}
                disabled={streaming || voiceMode !== 'idle'}
                style={{ padding: '0.4rem 0.75rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem',
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  background: '#1a1a1a', borderWidth: 1, borderStyle: 'solid', borderColor: '#333',
                  color: '#6b7280' }}>
                <Paperclip size={13} /> Audio file
              </button>

              <input ref={audioFileInputRef} type="file" accept="audio/*" hidden
                onChange={e => { if (e.target.files?.[0]) transcribeAudio(e.target.files[0]); }} />

              <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#4b5563' }}>
                {credits - CREDIT_COSTS.IMAGE_GENERATION < 0
                  ? <span style={{ color: '#7f1d1d' }}>No image credits</span>
                  : `Image: ${CREDIT_COSTS.IMAGE_GENERATION}cr`}
              </span>
            </div>

            {/* Input container */}
            <div style={{ background: '#1a1a1a', borderWidth: 1, borderStyle: 'solid', borderColor: '#333',
              borderRadius: 16, padding: '0.75rem 0.75rem 0.75rem 1rem',
              display: 'flex', gap: '0.6rem', alignItems: 'flex-end',
              boxShadow: '0 0 0 1px #262626, 0 8px 24px rgba(0,0,0,0.3)',
              transition: 'border-color 0.2s' }}>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder="Ask me anything… (Shift+Enter for new line)"
                disabled={streaming || voiceMode !== 'idle'}
                style={{ flex: 1, background: 'transparent', borderWidth: 0,
                  color: '#f3f4f6', fontSize: '0.93rem', resize: 'none', outline: 'none',
                  fontFamily: 'inherit', lineHeight: 1.6, maxHeight: 160,
                  minHeight: 24, padding: 0, opacity: streaming ? 0.6 : 1 }}
              />

              <button
                onClick={streaming ? handleStop : handleSend}
                disabled={(!input.trim() && !streaming) || pendingImageGen}
                title={streaming ? 'Stop' : 'Send'}
                style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: (!input.trim() && !streaming) || pendingImageGen ? 'not-allowed' : 'pointer',
                  borderWidth: 0, transition: 'all 0.2s',
                  background: streaming ? '#7f1d1d'
                    : (!input.trim() || pendingImageGen) ? '#262626'
                    : '#6366f1',
                  color: (!input.trim() && !streaming) || pendingImageGen ? '#4b5563' : '#fff' }}>
                {streaming ? <StopCircle size={17} />
                  : pendingImageGen ? <Loader size={17} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Send size={17} />}
              </button>
            </div>

            {/* Credits bar */}
            <CreditsBar credits={credits} maxCredits={MAX_CREDITS} resetCountdown={resetCountdown} />
          </div>
        </div>
      </div>

      {/* Credits modal */}
      <AnimatePresence>
        {showUpgrade && <CreditModal onClose={() => setShowUpgrade(false)} />}
      </AnimatePresence>

      {/* Global styles */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 3px; }

        .ai-markdown { color: #d1d5db; font-size: 0.93rem; line-height: 1.75; }
        .ai-markdown p { margin: 0.6rem 0; }
        .ai-markdown h2, .ai-markdown h3, .ai-markdown h4 { color: #f3f4f6; margin: 1.2rem 0 0.5rem; font-weight: 600; }
        .ai-h { color: #f3f4f6; margin: 1.2rem 0 0.5rem; font-weight: 600; }
        .ai-p { margin: 0.6rem 0; color: #d1d5db; line-height: 1.75; }

        .ai-inline-code { background: #1f2937; padding: 0.15em 0.45em; border-radius: 5px;
          color: #93c5fd; font-family: 'Fira Code', 'Monaco', monospace; font-size: 0.88em; }

        .ai-code-wrap { background: #111827; border: 1px solid #1f2937; border-radius: 12px;
          overflow: hidden; margin: 1rem 0; }
        .ai-code-header { display: flex; justify-content: space-between; align-items: center;
          padding: 0.5rem 0.85rem; background: #1a2332; border-bottom: 1px solid #1f2937; }
        .ai-code-lang { font-size: 0.72rem; color: #4b5563; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.5px; }
        .ai-code-copy { background: #1f2937; border: 1px solid #374151; border-radius: 5px;
          color: #9ca3af; font-size: 0.72rem; padding: 0.25rem 0.65rem;
          cursor: pointer; transition: all 0.2s; }
        .ai-code-copy:hover { background: #374151; color: #d1d5db; }
        .ai-code-pre { margin: 0; padding: 1rem; overflow-x: auto; }
        .ai-code-pre code { color: #a5f3fc; font-family: 'Fira Code', 'Monaco', monospace;
          font-size: 0.855rem; line-height: 1.65; }

        .ai-list { margin: 0.6rem 0; padding-left: 1.5rem; color: #d1d5db; }
        .ai-list li { margin: 0.3rem 0; }

        @media (max-width: 768px) {
          .sidebar-close-btn { display: flex !important; }
        }
        @media (min-width: 769px) {
          .sidebar-close-btn { display: none !important; }
        }
      `}</style>
    </div>
  );
}

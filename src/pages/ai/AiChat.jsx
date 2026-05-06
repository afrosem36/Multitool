import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  Send, Bot, User, Copy, RefreshCw, Trash2, Download,
  Plus, Search, ChevronLeft, Sparkles, MessageSquare,
  Code, Zap, Brain, Check, Menu, X, StopCircle, Mic, Paperclip, Image as ImageIcon,
  AlertCircle, Loader,
} from 'lucide-react';
import { getCredits, saveCredits, spendCredits, canAfford, getResetCountdown, CREDIT_COSTS } from './aiCredits';
import { classifyIntent, buildContextForIntent } from './aiCapabilities';

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_SESS_KEY  = 'ai_chat_sessions';
const STORAGE_CUR_KEY   = 'ai_chat_current';
const AI_NAME           = 'MultiTool AI';
const SYSTEM_PROMPT = `You are ${AI_NAME}, a smart, helpful, and friendly AI assistant built into MultiTool Hub. You help with coding, writing, analysis, math, creative tasks, and general questions. You are direct, modern, and conversational.

IMPORTANT CAPABILITY AWARENESS:
- When asked about live weather, elections, stock prices, current news, sports scores, or real-time data: Honestly note that you don't currently have live internet access. Never pretend to know current information. Example: "I don't have access to live weather data right now, but I can explain how weather works..."
- You support text generation, image creation, code writing, math solving, and general knowledge.
- Always be natural and helpful, even when explaining limitations.

Be concise, use markdown formatting (bold, code blocks, lists) where appropriate. Show personality.`;

const SUGGESTED_PROMPTS = [
  { icon: Code,        label: 'Write code',       text: 'Write a Python function to reverse a linked list' },
  { icon: Brain,       label: 'Explain concept',  text: 'Explain how neural networks learn in simple terms' },
  { icon: Zap,         label: 'Quick task',       text: 'Give me 5 productivity tips for developers' },
  { icon: MessageSquare, label: 'Draft message',  text: 'Write a professional email to reschedule a meeting' },
  { icon: Sparkles,    label: 'Creative',         text: 'Write a short story about an AI that discovers music' },
  { icon: ImageIcon,   label: 'Image',            text: 'Draw a cozy cyberpunk cafe at night with warm neon lights' },
];

// ─── Storage helpers ──────────────────────────────────────────────────────────
function getTodayKey() { return new Date().toISOString().split('T')[0]; }

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

// ─── Enhanced Markdown renderer with code copy buttons ───────────────────────
function renderMarkdown(text) {
  if (!text) return '';

  // Code blocks (``` ... ```) — add copy button
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const codeTrimmed = code.trim();
    const copyBtn = `<button class="ai-code-copy" onclick="navigator.clipboard.writeText(${JSON.stringify(codeTrimmed)}); this.textContent='Copied!'; setTimeout(() => this.textContent='Copy', 1800);" title="Copy code">Copy</button>`;
    return `<pre class="ai-code-block" data-lang="${lang || 'code'}"><code>${escHtml(codeTrimmed)}</code>${copyBtn}</pre>`;
  });

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

// ─── Response parsing helpers (provider-agnostic) ──────────────────────────────
function extractResponseContent(response) {
  if (!response) return '';
  if (typeof response === 'string') return response;
  if (response.message?.content) return String(response.message.content).trim();
  if (response.text) return String(response.text).trim();
  if (response.content && typeof response.content === 'string') return String(response.content).trim();
  if (Array.isArray(response.choices) && response.choices[0]?.message?.content) {
    return String(response.choices[0].message.content).trim();
  }
  if (Array.isArray(response.candidates) && response.candidates[0]?.content?.parts?.[0]?.text) {
    return String(response.candidates[0].content.parts[0].text).trim();
  }
  if (Array.isArray(response.content) && response.content[0]?.text) {
    return String(response.content[0].text).trim();
  }
  const str = String(response);
  if (str && str !== '[object Object]') return str.trim();
  return '';
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

// ─── MessageBubble (improved with model badge) ──────────────────────────────
const MessageBubble = memo(({ msg, isLast, onRegenerate, isStreaming }) => {
  const isUser = msg.role === 'user';
  const time = new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isImage = msg.type === 'image';

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row',
        gap: '0.7rem', alignItems: 'flex-start', marginBottom: '1.25rem' }}>

      <div style={{ ...S.avatar, background: isUser ? 'var(--gradient-primary)' : 'rgba(99,102,241,0.18)',
        border: isUser ? 'none' : '1px solid rgba(99,102,241,0.3)', flexShrink: 0 }}>
        {isUser ? <User size={15} color="#fff" /> : <Bot size={15} color="var(--accent-primary)" />}
      </div>

      <div style={{ maxWidth: '78%', minWidth: 0 }}>
        <div style={{ ...S.bubble,
          background: isUser ? 'var(--gradient-primary)' : 'var(--glass-bg)',
          border: isUser ? 'none' : '1px solid var(--glass-border)',
          borderRadius: isUser ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
          boxShadow: isUser ? '0 4px 20px rgba(99,102,241,0.35)' : 'var(--glass-glow)',
        }}>
          {msg.thinking && !msg.content ? (
            <ThinkingDots />
          ) : isImage ? (
            <div style={{ textAlign: 'center' }}>
              <img src={msg.content} alt="Generated" style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '0.5rem' }} />
              <a href={msg.content} download style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', textDecoration: 'none' }}>⬇ Download</a>
            </div>
          ) : isUser ? (
            <p style={{ margin: 0, color: '#fff', lineHeight: 1.6, fontSize: '0.93rem', whiteSpace: 'pre-wrap' }}>{msg.content}</p>
          ) : (
            <div className="ai-markdown" style={{ color: 'var(--text-primary)', fontSize: '0.93rem' }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem',
          marginTop: '0.3rem', flexDirection: isUser ? 'row-reverse' : 'row' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', opacity: 0.6 }}>{time}</span>
          {!isUser && msg.content && !isImage && (
            <>
              <CopyButton text={msg.content} />
              {isLast && !isStreaming && (
                <button onClick={onRegenerate} title="Regenerate" style={S.actionBtn}>
                  <RefreshCw size={13} />
                </button>
              )}
            </>
          )}
          {!isUser && (
            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', opacity: 0.5, marginLeft: '0.3rem' }}>Puter AI</span>
          )}
          {isUser && <CopyButton text={msg.content} />}
        </div>
      </div>
    </motion.div>
  );
});

// ─── Credits Bar (animated progress with countdown) ─────────────────────────
const CreditsBar = memo(({ credits, maxCredits, resetCountdown }) => {
  const percent = Math.floor((credits / maxCredits) * 100);
  const isLow = credits <= 10;
  const isEmpty = credits === 0;

  const barColor = isEmpty ? '#ef4444' : isLow ? '#f59e0b' : 'var(--gradient-primary)';

  return (
    <motion.div style={{ padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.2)',
      borderRadius: '12px', marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-primary)' }}>
          Credits: <strong>{credits}/{maxCredits}</strong>
        </span>
        {isLow && (
          <span style={{ fontSize: '0.7rem', color: '#f59e0b' }}>Resets in {resetCountdown}</span>
        )}
      </div>
      <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.4 }}
          style={{ height: '100%', background: barColor, borderRadius: '3px' }} />
      </div>
    </motion.div>
  );
});

// ─── Chat Sidebar ─────────────────────────────────────────────────────────────
const ChatSidebar = memo(({
  sessions, currentId, onSelect, onNew, onDelete, searchQ, setSearchQ, open, onClose,
}) => {
  const filtered = useMemo(() =>
    sessions.filter(s => s.title.toLowerCase().includes(searchQ.toLowerCase())),
    [sessions, searchQ]
  );

  return (
    <motion.div
      initial={{ x: -260 }}
      animate={{ x: open ? 0 : -260 }}
      transition={{ duration: 0.2 }}
      style={{ ...S.sidebar, left: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bot size={18} color="var(--accent-primary)" />
          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Chats</span>
        </div>
        <button onClick={onClose} style={{ ...S.iconBtn, display: 'none' }} className="show-mobile">
          <X size={18} />
        </button>
      </div>

      <button onClick={onNew} style={{ ...S.newChatBtn, margin: '1rem' }}>
        <Plus size={16} /> New Chat
      </button>

      <div style={{ padding: '0 1rem 1rem' }}>
        <input
          type="text"
          placeholder="Search chats..."
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          style={{ ...S.searchInput }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.5rem' }}>
        {filtered.length === 0 ? (
          <p style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>
            No chats found
          </p>
        ) : (
          filtered.map(s => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => onSelect(s.id)}
              style={{ ...S.sessionItem, background: currentId === s.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                borderLeft: currentId === s.id ? '2px solid var(--accent-primary)' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</p>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {s.messages.length} messages
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                style={{ ...S.iconBtn, opacity: 0.6 }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}>
                <Trash2 size={14} />
              </button>
            </motion.div>
          ))
        )}
      </div>

      <div style={{ padding: '1rem', borderTop: '1px solid var(--glass-border)',
        fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
        Powered by Puter.js & MultiTool
      </div>
    </motion.div>
  );
});

// ─── Premium Upgrade Modal (replaces old LimitPopup) ────────────────────────
const PremiumUpgradeModal = memo(({ onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
      backdropFilter: 'blur(4px)' }}
    onClick={onClose}>
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      onClick={(e) => e.stopPropagation()}
      style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
        borderRadius: '20px', padding: '2rem', maxWidth: '400px', textAlign: 'center' }}>
      <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
      <h2 style={{ margin: '0 0 0.75rem', color: 'var(--text-primary)', fontSize: '1.4rem' }}>
        Credits Exhausted
      </h2>
      <p style={{ margin: '0 0 1.5rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        You've used all your daily credits. They'll reset at midnight, or upgrade to premium for unlimited access.
      </p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button
          onClick={onClose}
          style={{ ...S.btn, background: 'rgba(99,102,241,0.1)', color: 'var(--accent-primary)',
            border: '1px solid var(--accent-primary)' }}>
          Got it
        </button>
        <button
          style={{ ...S.btn, background: 'var(--gradient-primary)', color: '#fff' }}>
          Upgrade
        </button>
      </div>
    </motion.div>
  </motion.div>
));

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AiChat() {
  // State
  const [sessions, setSessions] = useState(loadSessions);
  const [currentId, setCurrentId] = useState(loadCurrentId);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [credits, setCredits] = useState(() => getCredits().credits);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [voiceMode, setVoiceMode] = useState('idle'); // idle | recording | transcribing
  const [pendingImageGen, setPendingImageGen] = useState(false);
  const [resetCountdown, setResetCountdown] = useState(() => getResetCountdown().display);

  // Refs
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioFileInputRef = useRef(null);
  const abortRef = useRef(false);

  // Derived state
  const currentSession = useMemo(() =>
    sessions.find(s => s.id === currentId),
    [sessions, currentId]
  );
  const messages = currentSession?.messages || [];
  const maxCredits = 50;

  // Sync localStorage on changes
  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    if (currentId) saveCurrentId(currentId);
  }, [currentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Update credits from localStorage periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const state = getCredits();
      setCredits(state.credits);
      setResetCountdown(getResetCountdown().display);
    }, 10000); // every 10 seconds

    return () => clearInterval(interval);
  }, []);

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

  // Session helpers
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

  // Voice recording handlers
  const handleMicStart = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        setVoiceMode('transcribing');
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(blob);
        stream.getTracks().forEach(track => track.stop());
        setVoiceMode('idle');
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setVoiceMode('recording');
    } catch (err) {
      toast.error('Microphone access denied');
    }
  }, []);

  const handleMicStop = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const handleAudioUpload = useCallback((file) => {
    if (!file) return;
    setVoiceMode('transcribing');
    transcribeAudio(file);
  }, []);

  const transcribeAudio = useCallback(async (blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'audio.webm');

      if (!canAfford(CREDIT_COSTS.AUDIO_TRANSCRIPTION)) {
        toast.error('Insufficient credits for transcription');
        setVoiceMode('idle');
        return;
      }

      const resp = await fetch('/api/transcribe', { method: 'POST', body: formData });
      if (!resp.ok) throw new Error('Transcription failed');

      const data = await resp.json();
      const text = data.text || data.transcription || '';

      setInput(prev => prev + (prev ? ' ' : '') + text);
      textareaRef.current?.focus();

      spendCredits(CREDIT_COSTS.AUDIO_TRANSCRIPTION);
      setCredits(prev => prev - CREDIT_COSTS.AUDIO_TRANSCRIPTION);
      toast.success('Transcription added');
    } catch (err) {
      toast.error('Transcription failed: ' + err.message);
    } finally {
      setVoiceMode('idle');
    }
  }, []);

  // Send message with all new features
  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    // Classify intent
    const intent = classifyIntent(trimmed);
    const cost = intent.cost;

    // Credit check
    if (!canAfford(cost)) {
      setShowUpgrade(true);
      return;
    }

    // Image generation branch
    if (intent.type && intent.type.includes('image_generation')) {
      try {
        setPendingImageGen(true);
        const { puter } = await import('@heyputer/puter.js');
        const imageUrl = await puter.ai.txt2img(trimmed);

        const sid = ensureSession();
        const userMsg = { id: newMsgId(), role: 'user', content: trimmed, ts: Date.now() };
        const imgMsg = { id: newMsgId(), role: 'assistant', type: 'image', content: imageUrl, ts: Date.now() };

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

    // Normal text/AI branch
    const sid = ensureSession();
    const userMsg = { id: newMsgId(), role: 'user', content: trimmed, ts: Date.now() };
    const aiMsg = { id: newMsgId(), role: 'assistant', content: '', thinking: true, ts: Date.now() };

    updateSession(sid, s => ({
      messages: [...s.messages, userMsg, aiMsg],
      title: s.messages.length === 0 ? sessionTitle([userMsg]) : s.title,
    }));
    setInput('');
    setStreaming(true);
    abortRef.current = false;

    try {
      // Build system prompt with capability context
      let systemPrompt = SYSTEM_PROMPT;
      if (intent.contextHint) {
        systemPrompt += buildContextForIntent(intent);
      }

      const history = [
        { role: 'system', content: systemPrompt },
        ...(sessions.find(s => s.id === sid)?.messages.slice(-18) || []).map(m => ({
          role: m.role, content: m.content,
        })),
        { role: 'user', content: trimmed },
      ];

      const { puter } = await import('@heyputer/puter.js');
      let accumulated = '';
      const response = await puter.ai.chat(history, { stream: true });

      for await (const part of response) {
        if (abortRef.current) break;

        let chunk = '';
        if (typeof part === 'string') {
          chunk = part;
        } else {
          chunk = extractResponseContent(part);
        }

        if (typeof chunk === 'string' && chunk.length > 0) {
          accumulated += chunk;
          updateSession(sid, s => ({
            messages: s.messages.map(m =>
              m.id === aiMsg.id ? { ...m, content: accumulated, thinking: false } : m
            ),
          }));
        }
      }

      const finalContent = accumulated.trim() || 'Unable to generate response. Please try again.';
      updateSession(sid, s => ({
        messages: s.messages.map(m =>
          m.id === aiMsg.id ? { ...m, content: finalContent, thinking: false } : m
        ),
      }));

      spendCredits(cost);
      setCredits(prev => prev - cost);
    } catch (err) {
      console.error('[AiChat]', err);
      const errText = err?.message?.includes('quota') ? 'Rate limit hit — please wait a moment and try again.' :
        err?.message?.includes('API key') ? 'API configuration issue.' :
        `Error: ${err.message || 'Failed to get response'}`;

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
  }, [messages]);

  return (
    <div style={S.page}>
      <ChatSidebar
        sessions={sessions}
        currentId={currentId}
        onSelect={setCurrentId}
        onNew={createSession}
        onDelete={deleteSession}
        searchQ={searchQ}
        setSearchQ={setSearchQ}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main style={{ ...S.main, paddingLeft: sidebarOpen && window.innerWidth >= 768 ? '260px' : '0' }}>
        {/* Top bar */}
        <div style={S.topBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={S.iconBtn}
              className="hide-desktop">
              {sidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
            </button>
            <Bot size={20} color="var(--accent-primary)" />
            <h1 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>
              {currentSession?.title || 'MultiTool AI Chat'}
            </h1>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleExport} title="Export chat" style={S.iconBtn}>
              <Download size={18} />
            </button>
            <button onClick={handleClear} title="Clear chat" style={S.iconBtn}>
              <Trash2 size={18} />
            </button>
            <button onClick={createSession} title="New chat" style={S.iconBtn}>
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div style={S.messagesArea}>
          {messages.length === 0 ? (
            <motion.div style={S.emptyState}>
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
                style={S.emptyAvatar}>
                <Bot size={40} color="var(--accent-primary)" />
              </motion.div>
              <h2 style={{ margin: '1rem 0 0.5rem', color: 'var(--text-primary)' }}>
                Hello! I'm {AI_NAME}
              </h2>
              <p style={{ margin: '0 0 2rem', color: 'var(--text-secondary)', maxWidth: '400px', textAlign: 'center' }}>
                I can help with coding, writing, image creation, transcription, and much more. What would you like to do?
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '1rem', width: '100%', maxWidth: '500px' }}>
                {SUGGESTED_PROMPTS.map((p, i) => (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => sendMessage(p.text)}
                    style={{ ...S.suggestedBtn, padding: '1rem' }}>
                    <p.icon size={20} style={{ margin: '0 auto 0.5rem' }} />
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '500' }}>{p.label}</p>
                    <p style={{ margin: '0.3rem 0 0', fontSize: '0.7rem', opacity: 0.6 }}>
                      {p.text.slice(0, 20)}...
                    </p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isLast={i === messages.length - 1}
                onRegenerate={handleRegenerate}
                isStreaming={streaming && i === messages.length - 1}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div style={S.inputArea}>
          <CreditsBar credits={credits} maxCredits={maxCredits} resetCountdown={resetCountdown} />

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={voiceMode === 'recording' ? handleMicStop : handleMicStart}
              disabled={streaming || voiceMode === 'transcribing'}
              title={voiceMode === 'recording' ? 'Stop recording' : 'Record audio'}
              style={{ ...S.smallBtn, background: voiceMode === 'recording' ? '#ef4444' : 'rgba(99,102,241,0.1)',
                color: voiceMode === 'recording' ? '#fff' : 'var(--accent-primary)' }}>
              <Mic size={16} />
              {voiceMode === 'recording' && ' Recording...'}
              {voiceMode === 'transcribing' && ' Transcribing...'}
            </button>

            <button
              onClick={() => audioFileInputRef.current?.click()}
              disabled={streaming || voiceMode !== 'idle'}
              title="Upload audio file"
              style={{ ...S.smallBtn }}>
              <Paperclip size={16} />
            </button>

            {credits - CREDIT_COSTS.IMAGE_GENERATION < 0 ? (
              <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>No credits for image</span>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Image: {CREDIT_COSTS.IMAGE_GENERATION}cr
              </span>
            )}

            <input
              ref={audioFileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a"
              hidden
              onChange={(e) => handleAudioUpload(e.target.files?.[0])}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask me anything... (Shift + Enter for new line)"
              disabled={streaming || voiceMode !== 'idle'}
              style={{ ...S.textarea, opacity: streaming || voiceMode !== 'idle' ? 0.6 : 1 }}
            />

            <button
              onClick={streaming ? handleStop : handleSend}
              disabled={!input.trim() && !streaming || pendingImageGen}
              title={streaming ? 'Stop' : 'Send'}
              style={{ ...S.sendBtn, background: streaming ? '#ef4444' : 'var(--gradient-primary)' }}>
              {streaming ? <StopCircle size={18} /> : pendingImageGen ? <Loader size={18} /> : <Send size={18} />}
            </button>
          </div>

          <p style={{ margin: '0.5rem 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Free tier: {maxCredits} credits/day. Text = 1cr, Image = 3cr, Transcription = 2cr
          </p>
        </div>
      </main>

      {/* Premium upgrade modal */}
      <AnimatePresence>
        {showUpgrade && <PremiumUpgradeModal onClose={() => setShowUpgrade(false)} />}
      </AnimatePresence>

      {/* Styles */}
      <style>{`
        .ai-markdown { line-height: 1.7; }
        .ai-markdown h2, .ai-markdown h3, .ai-markdown h4 { margin: 1.2rem 0 0.5rem; }
        .ai-markdown h2 { font-size: 1.3rem; }
        .ai-markdown h3 { font-size: 1.1rem; }
        .ai-markdown h4 { font-size: 1rem; }
        .ai-markdown code { background: rgba(99,102,241,0.15); padding: 0.2em 0.4em; border-radius: 4px; }
        .ai-code-block { background: rgba(0,0,0,0.3); border: 1px solid rgba(99,102,241,0.3); border-radius: 8px;
          padding: 1rem; overflow-x: auto; position: relative; margin: 1rem 0; }
        .ai-code-block code { background: none; padding: 0; }
        .ai-code-block::before { content: attr(data-lang); position: absolute; top: 0.5rem; right: 0.5rem;
          font-size: 0.7rem; color: var(--text-secondary); }
        .ai-code-copy { position: absolute; top: 0.5rem; right: 0.5rem; padding: 0.3rem 0.6rem;
          background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.4); border-radius: 4px;
          color: var(--accent-primary); font-size: 0.7rem; cursor: pointer; }
        .ai-code-copy:hover { background: rgba(99,102,241,0.3); }
        .ai-list, .ai-olist { margin: 0.5rem 0; padding-left: 1.5rem; }
        .ai-p { margin: 0.5rem 0; }
        @media (max-width: 768px) {
          .hide-desktop { display: none !important; }
          .show-mobile { display: block !important; }
        }
        @media (min-width: 768px) {
          .hide-desktop { display: none !important; }
          .show-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    height: '100dvh',
    background: 'var(--bg-dark)',
    display: 'flex',
    position: 'relative',
    color: 'var(--text-primary)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  sidebar: {
    position: 'fixed',
    top: 0,
    width: '260px',
    height: '100dvh',
    background: 'var(--glass-bg)',
    border: '1px solid var(--glass-border)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 40,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'padding-left 0.2s',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    borderBottom: '1px solid var(--glass-border)',
    background: 'rgba(0,0,0,0.1)',
  },
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  emptyAvatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(99,102,241,0.3)',
  },
  inputArea: {
    padding: '1.5rem',
    borderTop: '1px solid var(--glass-border)',
    background: 'rgba(0,0,0,0.2)',
  },
  textarea: {
    flex: 1,
    background: 'var(--glass-bg)',
    border: '1px solid var(--glass-border)',
    borderRadius: '12px',
    padding: '0.75rem',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    resize: 'none',
    fontFamily: 'inherit',
    maxHeight: '160px',
  },
  sendBtn: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    border: 'none',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  smallBtn: {
    padding: '0.5rem 0.75rem',
    background: 'rgba(99,102,241,0.1)',
    border: '1px solid rgba(99,102,241,0.2)',
    borderRadius: '8px',
    color: 'var(--accent-primary)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
  },
  bubble: {
    padding: '0.75rem 1rem',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  btn: {
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '500',
  },
  iconBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    border: 'none',
    background: 'rgba(99,102,241,0.1)',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  newChatBtn: {
    width: '100%',
    padding: '0.75rem',
    background: 'var(--gradient-primary)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  },
  searchInput: {
    width: '100%',
    padding: '0.5rem 0.75rem',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
  },
  sessionItem: {
    padding: '0.75rem',
    margin: '0.25rem 0',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    transition: 'background 0.2s',
  },
  suggestedBtn: {
    background: 'var(--glass-bg)',
    border: '1px solid var(--glass-border)',
    borderRadius: '12px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    transition: 'all 0.2s',
  },
};

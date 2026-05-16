import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  MessageCircle, Link as LinkIcon, QrCode, Clipboard, ExternalLink,
  RotateCcw, Sparkles, LayoutDashboard, ShieldCheck, BarChart2,
  Users, Search, Download, Bell, Target, AlertTriangle,
  CheckCircle, Clock, Zap, XCircle, Check,
  FileText, FileSpreadsheet, Plus, Activity,
  MessageSquare, RefreshCw,
  WifiOff, Loader2,
  Phone, Send, Paperclip, Mic, MoreVertical, Image as ImageIcon,
  Video, File, CheckCheck, Smile, User, Info, PanelRight,
  Inbox, StickyNote, CalendarClock, Ticket, Timer,
  ArrowRightCircle,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { useWhatsApp } from '../../hooks/useWhatsApp';
import '../styles/WhatsAppTools.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizePhone = (v) => String(v || '').replace(/\D/g, '');

const buildWaLink = (phone, msg) => {
  const n = normalizePhone(phone);
  if (!n || n.length < 8 || n.length > 15) return { link: '', error: n ? 'Invalid number.' : '' };
  return {
    link: msg.trim() ? `https://wa.me/${n}?text=${encodeURIComponent(msg)}` : `https://wa.me/${n}`,
    error: '',
  };
};

function fmtSeconds(s) {
  if (!s) return '—';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}

function fmtWaiting(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  const m = Math.round(Number(minutes));
  if (m <= 0) return 'Just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); const rm = m % 60;
  if (h < 24) return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
  const d = Math.floor(h / 24); const rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

function timeAgo(ts) {
  if (!ts) return '—';
  const d = Math.round((Date.now() - new Date(ts).getTime()) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
}

function chatTime(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function initials(name = '') {
  const clean = String(name || '').replace(/[^\w\s+]/g, '').trim();
  if (!clean) return 'WA';
  return clean.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function shortMessage(msg = '') {
  if (!msg) return 'Media';
  const s = String(msg);
  return s.length > 60 ? `${s.slice(0, 60)}…` : s;
}

function getDateLabel(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function fmtNoteTime(ts) {
  if (!ts) return '';
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function computeLiveTatMins(chat, nowMs) {
  if (!chat) return null;
  if (chat.lastMessageIsFromMe) return 0;
  if (chat.lastMessageTime) {
    return Math.max(0, Math.round((nowMs - new Date(chat.lastMessageTime).getTime()) / 60000));
  }
  return chat.waitingMinutes ?? null;
}

const scoreColor = (s) => s >= 90 ? '#25d366' : s >= 70 ? '#f59e0b' : '#ef4444';

// ─── Constants ────────────────────────────────────────────────────────────────

const LEAD_STAGES = [
  { key: 'hot-lead',    label: 'Hot Lead',    color: '#ef4444' },
  { key: 'prospect',    label: 'Prospect',    color: '#3b82f6' },
  { key: 'interested',  label: 'Interested',  color: '#8b5cf6' },
  { key: 'follow-up',   label: 'Follow-Up',   color: '#f59e0b' },
  { key: 'negotiation', label: 'Negotiation', color: '#ec4899' },
  { key: 'converted',   label: 'Converted',   color: '#25d366' },
  { key: 'dropout',     label: 'Dropout',     color: '#64748b' },
  { key: 'spam',        label: 'Spam',        color: '#374151' },
  { key: 'vip',         label: 'VIP',         color: '#f59e0b' },
];

const LEAD_COLOR = Object.fromEntries(LEAD_STAGES.map((s) => [s.key, s.color]));

const LEAD_STAGE_KEYS = LEAD_STAGES.map((s) => s.key);

const TICKET_STATUS_COLORS = {
  open: '#3b82f6',
  'in-progress': '#f59e0b',
  resolved: '#25d366',
  closed: '#64748b',
};

const STATUS_MAP = {
  breached: ['red', 'SLA Breached'],
  warning: ['orange', 'Warning'],
  ok: ['green', 'On Time'],
  'hot-lead': ['red', 'Hot Lead'],
  hot: ['red', 'Hot Lead'],
  prospect: ['blue', 'Prospect'],
  potential: ['blue', 'Prospect'],
  interested: ['purple', 'Interested'],
  'follow-up': ['orange', 'Follow-Up'],
  negotiation: ['purple', 'Negotiation'],
  converted: ['green', 'Converted'],
  vip: ['purple', 'VIP'],
  dropout: ['gray', 'Dropout'],
  spam: ['gray', 'Spam'],
  new: ['blue', 'New Lead'],
  open: ['blue', 'Open'],
  'in-progress': ['orange', 'In Progress'],
  resolved: ['green', 'Resolved'],
  closed: ['gray', 'Closed'],
  inactive: ['gray', 'Inactive'],
};

const statusBadge = (s) => {
  const [color, label] = STATUS_MAP[s] || ['gray', String(s || '—')];
  return <span className={`wt-badge ${color}`}>{label}</span>;
};

const CHART_STYLE = {
  tooltip: { background: 'rgba(9,9,18,0.95)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', fontSize: '12px' },
  axis: { fill: '#64748b', fontSize: 11 },
};

const MODULES = [
  { id: 'workspace',     label: 'Workspace',     icon: MessageSquare,  section: 'Overview',   badge: null },
  { id: 'dashboard',     label: 'Dashboard',     icon: LayoutDashboard, section: 'Overview',  badge: null },
  { id: 'link-creator',  label: 'Link Creator',  icon: LinkIcon,        section: 'Tools',     badge: null },
  { id: 'qa',            label: 'QA Monitor',    icon: ShieldCheck,    section: 'Operations', badge: 'qa' },
  { id: 'analytics',     label: 'Analytics',     icon: BarChart2,       section: 'Operations', badge: null },
  { id: 'leads',         label: 'Leads',         icon: Target,          section: 'Operations', badge: 'leads' },
  { id: 'contacts',      label: 'Contacts',      icon: Phone,           section: 'Data',      badge: null },
  { id: 'chat-search',   label: 'Chat Search',   icon: Search,          section: 'Data',      badge: null },
  { id: 'reports',       label: 'Reports',       icon: Download,        section: 'Data',      badge: null },
  { id: 'notifications', label: 'Notifications', icon: Bell,            section: 'System',    badge: 'notifs' },
];
const SECTIONS = ['Overview', 'Tools', 'Operations', 'Data', 'System'];

// ─── Connection Screen ────────────────────────────────────────────────────────

function ConnectionPanel({ sessionState, serviceReachable, reconnectSession }) {
  const { status, qrCode, error } = sessionState;
  const isLoading = ['connecting', 'initializing', 'authenticated'].includes(status);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '2rem' }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(37,211,102,0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <MessageCircle size={32} color="#25d366" />
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          My WhatsApp Workspace
        </h2>
        {!serviceReachable && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '1rem', marginBottom: '1.5rem', fontSize: '0.875rem', color: '#f87171' }}>
            <WifiOff size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Cannot reach WhatsApp service at <strong>localhost:3002</strong>.
            <br />Start with: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '0.1rem 0.4rem', borderRadius: 4 }}>npm run dev:whatsapp</code>
          </div>
        )}
        {status === 'qr' && qrCode ? (
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
              Scan this QR code with your WhatsApp app to connect.
            </p>
            <div style={{ background: 'white', padding: 16, borderRadius: 16, display: 'inline-block', marginBottom: '1.25rem' }}>
              <img src={qrCode} alt="WhatsApp QR Code" style={{ display: 'block', width: 220, height: 220 }} />
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>WhatsApp → Linked Devices → Link a Device</p>
          </div>
        ) : isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '2rem 0' }}>
            <Loader2 size={32} color="#25d366" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {status === 'connecting' ? 'Connecting to service…' :
               status === 'initializing' ? 'Starting WhatsApp client…' :
               status === 'authenticated' ? 'Authenticated! Loading chats…' : 'Please wait…'}
            </p>
          </div>
        ) : (
          <div>
            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '1rem', marginBottom: '1.25rem', fontSize: '0.875rem', color: '#f87171' }}>
                {error}
              </div>
            )}
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
              {status === 'disconnected' ? 'Session disconnected.' : 'Waiting to connect…'}
            </p>
            <button className="wt-btn wt-btn-primary" onClick={reconnectSession} style={{ width: '100%', justifyContent: 'center' }}>
              <RefreshCw size={15} /> Connect WhatsApp
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard Module ─────────────────────────────────────────────────────────

function DashboardModule({ analytics, leads, loading, onNavigate, fetchAnalytics }) {
  const a = analytics || {};

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const followUpsDueToday = useMemo(
    () => (leads || []).filter((l) => l.follow_up_date === today).length,
    [leads, today],
  );

  const hotLeadsCount = useMemo(
    () => (leads || []).filter((l) => l.status === 'hot-lead' || l.status === 'hot').length,
    [leads],
  );

  const leadFunnelData = useMemo(() => {
    const counts = {};
    (leads || []).forEach((l) => {
      const stage = LEAD_STAGES.find((s) => s.key === l.status);
      const key = stage ? stage.label : 'Other';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name, value,
      color: LEAD_STAGES.find((s) => s.label === name)?.color || '#64748b',
    }));
  }, [leads]);

  const kpis = [
    { label: 'Total Chats',        value: a.totalChats ?? '—',                                    icon: MessageCircle,  bg: 'rgba(37,211,102,0.12)', color: '#25d366' },
    { label: 'Pending Replies',    value: a.pendingReplies ?? '—',                                icon: Clock,          bg: 'rgba(249,115,22,0.12)', color: '#fb923c' },
    { label: 'Avg Response Time',  value: fmtSeconds(a.avgResponseTime),                          icon: Zap,            bg: 'rgba(59,130,246,0.12)', color: '#60a5fa' },
    { label: 'Follow-Ups Today',   value: followUpsDueToday,                                      icon: CalendarClock,  bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    { label: 'Hot Leads',          value: hotLeadsCount,                                          icon: Target,         bg: 'rgba(239,68,68,0.12)',  color: '#ef4444' },
    { label: 'SLA Compliance',     value: a.slaCompliance != null ? `${a.slaCompliance}%` : '—', icon: ShieldCheck,    bg: 'rgba(37,211,102,0.12)', color: '#25d366' },
  ];

  return (
    <>
      <div className="wt-page-header">
        <div>
          <h1 className="wt-page-title">My Dashboard</h1>
          <p className="wt-page-subtitle">Personal productivity — live from your WhatsApp</p>
        </div>
        <button className="wt-btn wt-btn-ghost" onClick={fetchAnalytics}>
          <RefreshCw size={14} className={loading.analytics ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {a.breachedCount > 0 && (
        <div className="wt-qa-alert">
          <AlertTriangle size={16} />
          <strong>{a.breachedCount} SLA breach{a.breachedCount > 1 ? 'es' : ''}</strong> — customers waiting without reply.
          <button className="wt-btn wt-btn-sm wt-btn-danger" style={{ marginLeft: 'auto' }} onClick={() => onNavigate('qa')}>View Queue</button>
        </div>
      )}

      {loading.analytics && !a.totalChats ? (
        <div className="wt-empty"><Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} /><br />Loading…</div>
      ) : (
        <>
          <div className="wt-kpi-grid">
            {kpis.map((k) => (
              <div key={k.label} className="wt-kpi-card">
                <div className="wt-kpi-top">
                  <div className="wt-kpi-icon" style={{ background: k.bg }}><k.icon size={17} color={k.color} /></div>
                </div>
                <div className="wt-kpi-value">{k.value}</div>
                <div className="wt-kpi-label">{k.label}</div>
              </div>
            ))}
          </div>

          <div className="wt-charts-grid">
            {a.hourlyData?.length > 0 && (
              <div className="wt-chart-card">
                <p className="wt-chart-card-title">Hourly Message Volume</p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={a.hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dash-gc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#25d366" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#25d366" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="h" tick={CHART_STYLE.axis} />
                    <YAxis tick={CHART_STYLE.axis} />
                    <Tooltip contentStyle={CHART_STYLE.tooltip} />
                    <Area type="monotone" dataKey="chats" stroke="#25d366" fill="url(#dash-gc)" strokeWidth={2} dot={false} name="Messages" />
                    <Area type="monotone" dataKey="replied" stroke="#6366f1" fill="none" strokeWidth={2} dot={false} name="Replied" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {a.weeklyData?.length > 0 && (
              <div className="wt-chart-card">
                <p className="wt-chart-card-title">Weekly Response Trend</p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={a.weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="d" tick={CHART_STYLE.axis} />
                    <YAxis tick={CHART_STYLE.axis} />
                    <Tooltip contentStyle={CHART_STYLE.tooltip} />
                    <Line type="monotone" dataKey="score" stroke="#25d366" strokeWidth={2} dot={{ fill: '#25d366', r: 3 }} name="SLA %" />
                    <Line type="monotone" dataKey="chats" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} name="Volume" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {leadFunnelData.length > 0 && (
              <div className="wt-chart-card">
                <p className="wt-chart-card-title">Lead Funnel</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie data={leadFunnelData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                        {leadFunnelData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={CHART_STYLE.tooltip} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {leadFunnelData.map((e) => (
                      <div key={e.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{e.name}</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{e.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {!a.totalChats && (
            <div className="wt-empty">
              <MessageCircle size={32} style={{ opacity: 0.3, marginBottom: 8 }} /><br />
              No data yet. Messages will appear as they are received.
            </div>
          )}
        </>
      )}
    </>
  );
}

// ─── Link Creator ─────────────────────────────────────────────────────────────

function LinkCreatorModule() {
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const { link, error } = useMemo(() => buildWaLink(phone, msg), [phone, msg]);

  const copy = async () => {
    if (!link) { setStatusMsg('error:Enter a valid number first.'); return; }
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true); setStatusMsg('success:Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const [sType, sText] = statusMsg.split(':');

  return (
    <div className="wt-link-creator">
      <div className="wt-page-header">
        <div>
          <h1 className="wt-page-title">WhatsApp Link Creator</h1>
          <p className="wt-page-subtitle">Generate shareable wa.me links with pre-filled messages</p>
        </div>
        <div className="wt-header-actions">
          <button className="wt-btn wt-btn-ghost" onClick={() => { setPhone('+14155552671'); setMsg('Hello! I wanted to connect.'); }}><Sparkles size={14} /> Sample</button>
          <button className="wt-btn wt-btn-ghost" onClick={() => { setPhone(''); setMsg(''); setQrUrl(''); setStatusMsg(''); }}><RotateCcw size={14} /> Reset</button>
        </div>
      </div>
      <div className="wt-lc-grid">
        <div className="wt-lc-form-card">
          <div className="wt-field">
            <label>Phone Number (with country code)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 415 555 2671" />
            <small>Include country code — e.g. +971 for UAE, +44 for UK</small>
          </div>
          <div className="wt-field">
            <label>Pre-filled Message <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span></label>
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Type your message here…" />
            <small>{msg.length} characters</small>
          </div>
          {error && <div className="wt-badge red" style={{ display: 'block', padding: '0.5rem', borderRadius: 8 }}>{error}</div>}
        </div>
        <div className="wt-lc-preview-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontWeight: 600, fontSize: '0.875rem' }}>
            <MessageCircle size={16} color="#25d366" /> Generated Link
          </div>
          <div className="wt-link-output">{link || <span style={{ color: 'var(--text-secondary)' }}>Your link will appear here…</span>}</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <button className="wt-btn wt-btn-ghost wt-btn-sm" onClick={copy} disabled={!link}>
              {copied ? <CheckCircle size={13} /> : <Clipboard size={13} />}{copied ? 'Copied!' : 'Copy'}
            </button>
            <button className="wt-btn wt-btn-ghost wt-btn-sm" onClick={() => link && setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}`)} disabled={!link}>
              <QrCode size={13} /> QR
            </button>
            <button className="wt-btn wt-btn-primary wt-btn-sm" onClick={() => link && window.open(link, '_blank', 'noopener,noreferrer')} disabled={!link}>
              <ExternalLink size={13} /> Open
            </button>
          </div>
          {sText && <div className={`wt-badge ${sType === 'success' ? 'green' : 'red'}`} style={{ display: 'block', padding: '0.5rem', borderRadius: 8 }}>{sText}</div>}
          {qrUrl && link && (
            <div className="wt-qr-wrap">
              <img src={qrUrl} alt="QR" />
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>Scan to open WhatsApp</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── QA Monitor ───────────────────────────────────────────────────────────────

function QAModule({ qaQueue, loading, fetchQaQueue, onOpenChat }) {
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchQaQueue(`?filter=${filter}`); }, [filter, fetchQaQueue]);

  const chats = qaQueue || [];
  const breached = chats.filter((c) => c.slaStatus === 'breached').length;
  const warning = chats.filter((c) => c.slaStatus === 'warning').length;

  const waitingColor = (s) => s === 'breached' ? '#f87171' : s === 'warning' ? '#fb923c' : '#4ade80';

  return (
    <>
      <div className="wt-page-header">
        <div>
          <h1 className="wt-page-title">QA Monitor</h1>
          <p className="wt-page-subtitle">Real-time SLA tracking — live from your WhatsApp session</p>
        </div>
        <button className="wt-btn wt-btn-ghost" onClick={() => fetchQaQueue(`?filter=${filter}`)}>
          <RefreshCw size={14} className={loading.qaQueue ? 'spin' : ''} /> Refresh
        </button>
      </div>

      <div className="wt-kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {[
          { label: 'Total Pending', value: chats.length, color: '#6366f1' },
          { label: 'SLA Breached', value: breached, color: '#ef4444' },
          { label: 'Warning Zone', value: warning, color: '#f59e0b' },
          { label: 'On Time', value: chats.length - breached - warning, color: '#25d366' },
        ].map((k) => (
          <div key={k.label} className="wt-kpi-card">
            <div className="wt-kpi-value" style={{ color: k.color }}>{k.value}</div>
            <div className="wt-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {breached > 0 && (
        <div className="wt-qa-alert">
          <AlertTriangle size={16} />
          <strong>{breached} SLA breach{breached > 1 ? 'es' : ''}</strong> — customers waiting without reply.
        </div>
      )}

      <div className="wt-table-wrap">
        <div className="wt-table-header">
          <h3 className="wt-table-title">Pending Chat Queue</h3>
          <div className="wt-table-controls">
            {['all', 'breached', 'warning'].map((f) => (
              <button key={f} className={`wt-btn wt-btn-sm ${filter === f ? 'wt-btn-primary' : 'wt-btn-ghost'}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f === 'breached' ? 'Breached' : 'Warning'}
              </button>
            ))}
          </div>
        </div>
        {loading.qaQueue && !chats.length ? (
          <div className="wt-empty"><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
        ) : (
          <table>
            <thead><tr><th>Customer</th><th>Last Message</th><th>Waiting</th><th>SLA</th><th>Ticket</th><th>Action</th></tr></thead>
            <tbody>
              {chats.map((c) => (
                <tr key={c.chatId}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.customer}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.phone}</div>
                  </td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.lastMessage}</td>
                  <td>
                    <span style={{ color: waitingColor(c.slaStatus), fontWeight: 700 }}>
                      <Timer size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                      {fmtWaiting(c.waitingMinutes)}
                    </span>
                  </td>
                  <td>{statusBadge(c.slaStatus)}</td>
                  <td>{statusBadge(c.ticketStatus || 'open')}</td>
                  <td>
                    <button
                      className="wt-btn wt-btn-sm wt-btn-primary"
                      onClick={() => onOpenChat && onOpenChat({ chatId: c.chatId, name: c.customer, phone: c.phone })}
                    >
                      <ArrowRightCircle size={12} /> Reply
                    </button>
                  </td>
                </tr>
              ))}
              {chats.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No pending chats. All SLA targets met.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ─── Analytics Module ─────────────────────────────────────────────────────────

function AnalyticsModule({ analytics, loading, fetchAnalytics }) {
  const [range, setRange] = useState('7d');

  useEffect(() => { fetchAnalytics(`?range=${range}`); }, [range, fetchAnalytics]);

  const a = analytics || {};

  return (
    <>
      <div className="wt-page-header">
        <div>
          <h1 className="wt-page-title">Analytics</h1>
          <p className="wt-page-subtitle">Personal response metrics — calculated from real message timestamps</p>
        </div>
        <div className="wt-header-actions">
          <select className="wt-select" value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="1d">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button className="wt-btn wt-btn-ghost" onClick={() => fetchAnalytics(`?range=${range}`)}>
            <RefreshCw size={14} className={loading.analytics ? 'spin' : ''} />
          </button>
        </div>
      </div>

      <div className="wt-kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {[
          { label: 'Total Chats', value: a.totalChats ?? '—' },
          { label: 'Avg Response', value: fmtSeconds(a.avgResponseTime) },
          { label: 'SLA Compliance', value: a.slaCompliance != null ? `${a.slaCompliance}%` : '—' },
          { label: 'QA Score', value: a.qaScore != null ? `${a.qaScore}%` : '—' },
        ].map((k) => (
          <div key={k.label} className="wt-kpi-card">
            <div className="wt-kpi-value">{k.value}</div>
            <div className="wt-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {loading.analytics && !a.hourlyData ? (
        <div className="wt-empty"><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
      ) : (
        <div className="wt-charts-grid">
          {a.hourlyData?.length > 0 && (
            <div className="wt-chart-card">
              <p className="wt-chart-card-title">Hourly Activity</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={a.hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="an-ga" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="h" tick={CHART_STYLE.axis} /><YAxis tick={CHART_STYLE.axis} />
                  <Tooltip contentStyle={CHART_STYLE.tooltip} />
                  <Area type="monotone" dataKey="chats" stroke="#6366f1" fill="url(#an-ga)" strokeWidth={2} dot={false} name="Chats" />
                  <Area type="monotone" dataKey="replied" stroke="#25d366" fill="none" strokeWidth={2} dot={false} name="Replied" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {a.weeklyData?.length > 0 && (
            <div className="wt-chart-card">
              <p className="wt-chart-card-title">Response Trend</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={a.weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="d" tick={CHART_STYLE.axis} /><YAxis tick={CHART_STYLE.axis} />
                  <Tooltip contentStyle={CHART_STYLE.tooltip} />
                  <Line type="monotone" dataKey="score" stroke="#25d366" strokeWidth={2} dot={{ fill: '#25d366', r: 3 }} name="SLA %" />
                  <Line type="monotone" dataKey="chats" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} name="Chats" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {!a.hourlyData?.length && !a.weeklyData?.length && (
            <div className="wt-empty" style={{ gridColumn: '1/-1' }}>No message data for this period.</div>
          )}
        </div>
      )}
    </>
  );
}

// ─── Leads Module ─────────────────────────────────────────────────────────────

function LeadsModule({ leads, loading, fetchLeads, createLead, updateLead, onOpenChat }) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const searchDebounce = useRef(null);

  useEffect(() => { fetchLeads(`?status=${filterStatus}`); }, [filterStatus, fetchLeads]);

  const handleSearchChange = useCallback((e) => {
    const v = e.target.value;
    setSearch(v);
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      fetchLeads(`?status=${filterStatus}&search=${encodeURIComponent(v)}`);
    }, 300);
  }, [filterStatus, fetchLeads]);

  const handleCreate = useCallback(async () => {
    if (!newPhone) return;
    await createLead({ phone: normalizePhone(newPhone), name: newName, status: 'prospect' });
    setNewPhone(''); setNewName(''); setCreating(false);
    fetchLeads(`?status=${filterStatus}`);
  }, [newPhone, newName, createLead, fetchLeads, filterStatus]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const list = leads || [];

  return (
    <>
      <div className="wt-page-header">
        <div>
          <h1 className="wt-page-title">Lead Management</h1>
          <p className="wt-page-subtitle">Track, convert, and follow up on WhatsApp leads</p>
        </div>
        <button className="wt-btn wt-btn-primary" onClick={() => setCreating(true)}><Plus size={14} /> Add Lead</button>
      </div>

      {creating && (
        <div style={{ background: 'rgba(37,211,102,0.05)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 14, padding: '1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="wt-field" style={{ margin: 0, flex: 1, minWidth: 140 }}>
            <label>Phone</label>
            <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+971501234567" />
          </div>
          <div className="wt-field" style={{ margin: 0, flex: 1, minWidth: 140 }}>
            <label>Name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Contact name" />
          </div>
          <button className="wt-btn wt-btn-primary" onClick={handleCreate}><CheckCircle size={13} /> Save</button>
          <button className="wt-btn wt-btn-ghost" onClick={() => setCreating(false)}><XCircle size={13} /> Cancel</button>
        </div>
      )}

      <div className="wt-filter-bar">
        <div className="wt-search-wrap">
          <Search size={15} />
          <input className="wt-search-input" placeholder="Search name or number…" value={search} onChange={handleSearchChange} />
        </div>
        <select className="wt-select" value={filterStatus} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All Leads</option>
          {LEAD_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {loading.leads && !list.length ? (
        <div className="wt-empty"><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
      ) : (
        <div className="wt-lead-grid">
          {list.map((l) => {
            const followUpOverdue = l.follow_up_date && l.follow_up_date < today;
            const stage = LEAD_STAGES.find((s) => s.key === l.status);
            return (
              <div
                key={l._id}
                className="wt-lead-card"
                style={followUpOverdue ? { boxShadow: '0 0 0 1px rgba(239,68,68,0.35)' } : undefined}
              >
                <div className="wt-lead-card-head">
                  <div>
                    <div className="wt-lead-name">{l.name || l.phone}</div>
                    <div className="wt-lead-phone">{l.phone}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-end' }}>
                    {stage && (
                      <span style={{ padding: '0.2rem 0.55rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: `${stage.color}22`, color: stage.color, border: `1px solid ${stage.color}44` }}>
                        {stage.label}
                      </span>
                    )}
                  </div>
                </div>

                {l.follow_up_date && (
                  <div style={{ fontSize: '0.75rem', color: followUpOverdue ? '#f87171' : '#f59e0b', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CalendarClock size={11} />
                    {followUpOverdue ? 'Overdue: ' : 'Follow-up: '}{l.follow_up_date} {l.follow_up_time || ''}
                  </div>
                )}

                {l.notes && (
                  <div style={{ fontSize: '0.78rem', color: '#f59e0b', background: 'rgba(245,158,11,0.08)', padding: '0.4rem 0.6rem', borderRadius: 7, marginBottom: '0.5rem' }}>
                    <StickyNote size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />{l.notes}
                  </div>
                )}

                <div className="wt-lead-footer">
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {(l.tags || []).map((t) => <span key={t} className="wt-badge blue" style={{ fontSize: '0.68rem' }}>{t}</span>)}
                  </div>
                  <span>{timeAgo(l.updatedAt)}</span>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                  <select
                    className="wt-select"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', flex: 1 }}
                    value={l.status || ''}
                    onChange={(e) => updateLead(l._id, { status: e.target.value })}
                  >
                    {LEAD_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  {onOpenChat && l.phone && (
                    <button className="wt-btn wt-btn-sm wt-btn-primary" style={{ marginLeft: 'auto' }}
                      onClick={() => onOpenChat({ chatId: null, name: l.name || l.phone, phone: l.phone })}>
                      <MessageCircle size={11} /> Chat
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {list.length === 0 && !loading.leads && (
            <div className="wt-empty" style={{ gridColumn: '1/-1' }}>No leads found.</div>
          )}
        </div>
      )}
    </>
  );
}

// ─── Contacts Module ──────────────────────────────────────────────────────────

function ContactsModule({ contacts, loading, fetchContacts }) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilter] = useState('all');

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const handleSearch = useCallback(() => {
    fetchContacts(`?search=${encodeURIComponent(search)}&status=${filterStatus}`);
  }, [search, filterStatus, fetchContacts]);

  const exportCSV = useCallback(() => {
    const rows = [['Name', 'Phone', 'Status', 'Tags', 'Last Contact']];
    (contacts || []).forEach((c) => rows.push([c.name, c.phone, c.leadStatus || '', (c.tags || []).join(';'), c.lastContact || '']));
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'whatsapp_contacts.csv';
    a.click();
  }, [contacts]);

  const list = contacts || [];

  return (
    <>
      <div className="wt-page-header">
        <div><h1 className="wt-page-title">Contacts</h1><p className="wt-page-subtitle">{list.length} contacts synced from WhatsApp</p></div>
        <div className="wt-header-actions">
          <button className="wt-btn wt-btn-ghost" onClick={exportCSV}><Download size={14} /> CSV</button>
          <button className="wt-btn wt-btn-ghost" onClick={() => fetchContacts()}><RefreshCw size={14} className={loading.contacts ? 'spin' : ''} /></button>
        </div>
      </div>
      <div className="wt-filter-bar">
        <div className="wt-search-wrap">
          <Search size={15} />
          <input className="wt-search-input" placeholder="Search name or number…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
        </div>
        <select className="wt-select" value={filterStatus} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="hot-lead">Hot Lead</option>
          <option value="follow-up">Follow-Up</option>
          <option value="vip">VIP</option>
          <option value="converted">Converted</option>
        </select>
        <button className="wt-btn wt-btn-ghost" onClick={handleSearch}><Search size={13} /></button>
      </div>
      <div className="wt-table-wrap">
        <div className="wt-table-header"><h3 className="wt-table-title">Contacts ({list.length})</h3></div>
        {loading.contacts && !list.length ? (
          <div className="wt-empty"><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
        ) : (
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Status</th><th>Tags</th><th>Last Contact</th><th>Action</th></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.phone}>
                  <td><strong>{c.name || c.pushname || c.phone}</strong></td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{c.phone}</td>
                  <td>{c.leadStatus ? statusBadge(c.leadStatus) : <span className="wt-badge gray">—</span>}</td>
                  <td>{(c.tags || []).map((t) => <span key={t} className="wt-badge blue" style={{ marginRight: 4, fontSize: '0.68rem' }}>{t}</span>)}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{timeAgo(c.lastContact)}</td>
                  <td>
                    <a href={`https://wa.me/${normalizePhone(c.phone)}`} target="_blank" rel="noopener noreferrer" className="wt-btn wt-btn-sm wt-btn-ghost" style={{ textDecoration: 'none' }}>
                      <MessageCircle size={12} />
                    </a>
                  </td>
                </tr>
              ))}
              {list.length === 0 && !loading.contacts && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No contacts synced yet.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ─── Chat Search Module ───────────────────────────────────────────────────────

function ChatSearchModule({ searchResults, loading, fetchSearch }) {
  const [query, setQuery] = useState('');
  const [dateFrom, setFrom] = useState('');
  const [dateTo, setTo] = useState('');

  const doSearch = useCallback(() => {
    if (!query) return;
    fetchSearch(query, `&dateFrom=${dateFrom}&dateTo=${dateTo}`);
  }, [query, dateFrom, dateTo, fetchSearch]);

  const results = searchResults || [];

  return (
    <>
      <div className="wt-page-header">
        <div><h1 className="wt-page-title">Chat Search</h1><p className="wt-page-subtitle">Full-text search across all synced conversations</p></div>
      </div>
      <div style={{ background: 'rgba(15,15,25,0.7)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div className="wt-filter-bar" style={{ marginBottom: '0.75rem' }}>
          <div className="wt-search-wrap" style={{ flex: 1, maxWidth: 500 }}>
            <Search size={15} />
            <input className="wt-search-input" placeholder="Search keyword, e.g. 'invoice', 'delivery'…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()} />
          </div>
          <button className="wt-btn wt-btn-primary" onClick={doSearch} disabled={!query}><Search size={13} /> Search</button>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <input type="date" className="wt-select" value={dateFrom} onChange={(e) => setFrom(e.target.value)} title="From date" />
          <input type="date" className="wt-select" value={dateTo} onChange={(e) => setTo(e.target.value)} title="To date" />
        </div>
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Quick:</span>
          {['discount', 'invoice', 'complaint', 'delivery', 'refund'].map((t) => (
            <button key={t} className="wt-badge blue" style={{ cursor: 'pointer', border: 'none', background: 'rgba(59,130,246,0.12)' }} onClick={() => { setQuery(t); fetchSearch(t); }}>{t}</button>
          ))}
        </div>
      </div>
      {loading.searchResults ? (
        <div className="wt-empty"><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
      ) : (
        <div className="wt-search-results">
          {results.map((m) => (
            <div key={m._id} className="wt-chat-result">
              <div className="wt-chat-result-head">
                <span className="wt-chat-result-name">{m.chatName || m.from}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{chatTime(m.timestamp)}</span>
              </div>
              <div className="wt-chat-result-msg">{m.body}</div>
              {m.responseTime && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span className="wt-badge green" style={{ fontSize: '0.65rem' }}>Replied in {fmtSeconds(m.responseTime)}</span>
                </div>
              )}
            </div>
          ))}
          {!results.length && query && !loading.searchResults && <div className="wt-empty">No results for &quot;{query}&quot;</div>}
          {!results.length && !query && <div className="wt-empty">Enter a keyword to search your WhatsApp conversations.</div>}
        </div>
      )}
    </>
  );
}

// ─── Reports Module ───────────────────────────────────────────────────────────

function ReportsModule() {
  const reports = [
    { title: 'Daily Activity Report',  desc: 'Chats handled, response times, and volume for today',          icon: Activity,      color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
    { title: 'Weekly Performance',     desc: 'SLA compliance, QA scores, and weekly trends',                 icon: BarChart2,     color: '#25d366', bg: 'rgba(37,211,102,0.12)' },
    { title: 'Monthly SLA Report',     desc: 'Full SLA breakdown, breach analysis, and recommendations',     icon: ShieldCheck,   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    { title: 'Pending Chat Report',    desc: 'All unanswered and SLA-breached conversations',                icon: Clock,         color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
    { title: 'Missed Lead Report',     desc: 'Leads that went unreplied or were never followed up',          icon: AlertTriangle, color: '#fb923c', bg: 'rgba(249,115,22,0.12)' },
    { title: 'Follow-Up Summary',      desc: 'Completed vs missed follow-ups over the selected period',      icon: CalendarClock, color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
    { title: 'Contact Export',         desc: 'All contacts with status, tags, and last interaction',         icon: Users,         color: '#14b8a6', bg: 'rgba(20,184,166,0.12)' },
    { title: 'Chat Log Export',        desc: 'Full conversation history with timestamps',                    icon: MessageCircle, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  ];
  const download = useCallback((title) => {
    const csv = `Report,Date\n${title},${new Date().toLocaleDateString()}`;
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = title.replace(/\s+/g, '_').toLowerCase() + '.csv';
    a.click();
  }, []);

  return (
    <>
      <div className="wt-page-header">
        <div><h1 className="wt-page-title">Reports</h1><p className="wt-page-subtitle">Export CSV or PDF from your session data</p></div>
        <select className="wt-select"><option>Last 7 Days</option><option>Last 30 Days</option><option>This Month</option></select>
      </div>
      <div className="wt-reports-grid">
        {reports.map((r) => (
          <div key={r.title} className="wt-report-card">
            <div className="wt-report-icon" style={{ background: r.bg }}><r.icon size={22} color={r.color} /></div>
            <h4 className="wt-report-title">{r.title}</h4>
            <p className="wt-report-desc">{r.desc}</p>
            <div className="wt-report-actions">
              <button className="wt-btn wt-btn-sm wt-btn-ghost" onClick={() => download(r.title)}><FileSpreadsheet size={12} /> CSV</button>
              <button className="wt-btn wt-btn-sm wt-btn-ghost"><FileText size={12} /> PDF</button>
              <button className="wt-btn wt-btn-sm wt-btn-primary" style={{ marginLeft: 'auto' }} onClick={() => download(r.title)}><Download size={12} /> Download</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Notifications Module ─────────────────────────────────────────────────────

function NotificationsModule({ notifications, data, loading, fetchNotifs }) {
  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const localNotifs = useMemo(() => {
    const out = [];
    (data?.qaQueue || []).filter((c) => c.slaStatus === 'breached').forEach((c) => {
      out.push({ type: 'critical', title: 'SLA Breached', desc: `${c.customer || c.phone} — waiting ${fmtWaiting(c.waitingMinutes)}`, time: new Date().toISOString() });
    });
    (data?.leads || []).filter((l) => l.follow_up_date && l.follow_up_date < today).forEach((l) => {
      out.push({ type: 'warning', title: 'Overdue Follow-Up', desc: `${l.name || l.phone} — was due on ${l.follow_up_date}`, time: new Date().toISOString() });
    });
    (data?.leads || []).filter((l) => (l.status === 'hot-lead' || l.status === 'hot') && l.updatedAt && (Date.now() - new Date(l.updatedAt).getTime() > 7200000)).forEach((l) => {
      out.push({ type: 'warning', title: 'Hot Lead — No Reply', desc: `${l.name || l.phone} — no reply in over 2 hours`, time: new Date().toISOString() });
    });
    return out;
  }, [data?.qaQueue, data?.leads, today]);

  const allNotifs = useMemo(() => {
    const priority = { critical: 0, warning: 1, info: 2, success: 3 };
    const combined = [...(notifications || []), ...localNotifs];
    return combined.sort((a, b) => {
      const dp = (priority[a.type] ?? 2) - (priority[b.type] ?? 2);
      if (dp !== 0) return dp;
      return new Date(b.time || b.createdAt || 0) - new Date(a.time || a.createdAt || 0);
    });
  }, [notifications, localNotifs]);

  const iconMap = {
    critical: { icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    warning:  { icon: Clock,         color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    info:     { icon: Bell,          color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
    success:  { icon: CheckCircle,   color: '#25d366', bg: 'rgba(37,211,102,0.12)' },
  };

  return (
    <>
      <div className="wt-page-header">
        <div><h1 className="wt-page-title">Notifications</h1><p className="wt-page-subtitle">SLA breaches, overdue follow-ups, and hot lead alerts</p></div>
        <button className="wt-btn wt-btn-ghost" onClick={fetchNotifs}><RefreshCw size={14} className={loading.notifications ? 'spin' : ''} /> Refresh</button>
      </div>
      {loading.notifications && !allNotifs.length ? (
        <div className="wt-empty"><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
      ) : (
        <div className="wt-notif-list">
          {allNotifs.map((n, i) => {
            const { icon: Icon, color, bg } = iconMap[n.type] || iconMap.info;
            return (
              <div key={i} className={`wt-notif-item ${n.type === 'critical' ? 'critical' : 'unread'}`}>
                <div className="wt-notif-icon" style={{ background: bg }}><Icon size={16} color={color} /></div>
                <div className="wt-notif-body">
                  <div className="wt-notif-title">{n.title}</div>
                  <div className="wt-notif-desc">{n.desc}</div>
                </div>
                <span className="wt-notif-time">{timeAgo(n.time || n.createdAt)}</span>
              </div>
            );
          })}
          {allNotifs.length === 0 && <div className="wt-empty">No active alerts. All targets are being met.</div>}
        </div>
      )}
    </>
  );
}

// ─── Workspace: Chat List Sidebar ─────────────────────────────────────────────

function ChatListSidebar({ chats, leads, activeChatId, onSelect, loading, fetchChats, sessionState }) {
  const [rawSearch, setRawSearch] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const debounceRef = useRef(null);

  const handleSearchChange = useCallback((e) => {
    const v = e.target.value;
    setRawSearch(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(v), 300);
  }, []);

  const leadByPhone = useMemo(() => {
    const map = {};
    (leads || []).forEach((l) => { if (l.phone) map[normalizePhone(l.phone)] = l; });
    return map;
  }, [leads]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (chats || []).filter((chat) => {
      if (q && ![chat.name, chat.phone, chat.lastMessage].some((v) => String(v || '').toLowerCase().includes(q))) return false;
      if (activeFilter === 'unread') return (chat.unreadCount || 0) > 0;
      if (activeFilter === 'follow-up') {
        const lead = chat.phone ? leadByPhone[normalizePhone(chat.phone)] : null;
        return !!(lead?.follow_up_date || chat.followUpDate);
      }
      if (activeFilter === 'hot-lead') {
        const lead = chat.phone ? leadByPhone[normalizePhone(chat.phone)] : null;
        return lead?.status === 'hot-lead' || lead?.status === 'hot';
      }
      return true;
    });
  }, [chats, search, activeFilter, leadByPhone]);

  const isReady = sessionState?.status === 'ready';
  const statusDot = isReady ? 'online' : sessionState?.status === 'qr' ? 'busy' : 'offline';

  const PILLS = [
    { id: 'all',       label: 'All' },
    { id: 'unread',    label: 'Unread' },
    { id: 'follow-up', label: 'Follow-Up' },
    { id: 'hot-lead',  label: 'Hot Lead' },
  ];

  return (
    <section className="wt-chat-list-panel">
      <div style={{ padding: '0.9rem 1rem 0', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(18,25,34,0.96)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#25d366,#128c7e)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MessageCircle size={15} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.1 }}>My Workspace</div>
              <div style={{ fontSize: '0.67rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className={`wt-status-dot ${statusDot}`} />
                {isReady ? 'Connected' : sessionState?.status || 'Offline'}
              </div>
            </div>
          </div>
          <button className="wt-icon-btn" onClick={fetchChats} title="Refresh chats">
            <RefreshCw size={15} className={loading.chats ? 'spin' : ''} />
          </button>
        </div>

        <div className="wt-chat-search" style={{ padding: '0 0 0.55rem', border: 'none' }}>
          <Search size={14} />
          <input value={rawSearch} onChange={handleSearchChange} placeholder="Search conversations…" />
        </div>

        <div style={{ display: 'flex', gap: '0.3rem', paddingBottom: '0.6rem', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {PILLS.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveFilter(p.id)}
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: 20,
                fontSize: '0.72rem',
                fontWeight: activeFilter === p.id ? 700 : 400,
                background: activeFilter === p.id ? '#25d366' : 'rgba(255,255,255,0.05)',
                color: activeFilter === p.id ? '#000' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="wt-chat-list">
        {filtered.map((chat) => {
          const lead = chat.phone ? leadByPhone[normalizePhone(chat.phone)] : null;
          const leadColor = lead ? (LEAD_COLOR[lead.status] || null) : null;
          const followUpDate = lead?.follow_up_date || chat.followUpDate;
          const isOverdue = followUpDate && followUpDate < today;

          return (
            <button
              key={chat.chatId}
              className={`wt-chat-row ${activeChatId === chat.chatId ? 'active' : ''}`}
              onClick={() => onSelect(chat)}
            >
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div className={`wt-chat-avatar ${chat.isGroup ? 'group' : ''}`}>
                  {chat.isGroup ? <Users size={18} /> : initials(chat.name || chat.phone)}
                </div>
                {leadColor && !chat.isGroup && (
                  <span style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: leadColor, border: '1.5px solid rgba(12,17,24,0.9)' }} />
                )}
              </div>
              <div className="wt-chat-row-main">
                <div className="wt-chat-row-top">
                  <strong>{chat.name || chat.phone || 'Unknown'}</strong>
                  <span>{chatTime(chat.lastMessageTime)}</span>
                </div>
                <div className="wt-chat-row-bottom">
                  <span>{chat.lastMessageIsFromMe ? 'You: ' : ''}{shortMessage(chat.lastMessage)}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                    {isOverdue && <Clock size={11} color="#f59e0b" />}
                    {(chat.unreadCount || 0) > 0 && <em>{chat.unreadCount}</em>}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
        {loading.chats && !filtered.length && <div className="wt-chat-empty"><Loader2 className="spin" size={22} /> Loading chats…</div>}
        {!loading.chats && !filtered.length && <div className="wt-chat-empty"><Inbox size={24} /> No conversations.</div>}
      </div>
    </section>
  );
}

// ─── Workspace: Message Renderer Helpers ──────────────────────────────────────

function DateSeparator({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', userSelect: 'none' }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
      <span style={{ fontSize: '0.71rem', fontWeight: 600, color: 'var(--text-secondary)', padding: '0.2rem 0.75rem', background: 'rgba(18,25,34,0.9)', borderRadius: 999, border: '1px solid rgba(255,255,255,0.07)' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
    </div>
  );
}

function MediaRenderer({ message }) {
  if (!message.hasMedia && message.type === 'chat') return null;
  if (message.mediaUrl && String(message.type || '').includes('image')) {
    return <img className="wt-media-image" src={message.mediaUrl} alt="media" />;
  }
  const type = String(message.type || '').toLowerCase();
  const Icon = type.includes('image') ? ImageIcon : type.includes('video') ? Video : File;
  return <div className="wt-media-tile"><Icon size={18} /><span>{type || 'media'}</span></div>;
}

function TickMark({ ack }) {
  if (ack >= 3) return <CheckCheck size={13} style={{ color: '#53bdeb' }} />;
  if (ack >= 2) return <CheckCheck size={13} style={{ color: 'rgba(233,237,239,0.65)' }} />;
  if (ack >= 1) return <Check size={13} style={{ color: 'rgba(233,237,239,0.65)' }} />;
  return <Clock size={11} style={{ color: 'rgba(233,237,239,0.4)' }} />;
}

function MessageBubble({ message, isGroup, showMeta, isOptimistic }) {
  return (
    <div className={`wt-message-line ${message.isFromMe ? 'out' : 'in'}`} style={isOptimistic ? { opacity: 0.6 } : undefined}>
      <div className="wt-message-bubble">
        {isGroup && !message.isFromMe && (
          <span className="wt-message-sender">{message.senderName || message.author || 'Group participant'}</span>
        )}
        {message.quotedMessage?.body && <div className="wt-quoted-bubble">{message.quotedMessage.body}</div>}
        <MediaRenderer message={message} />
        {message.body && <p>{message.body}</p>}
        {showMeta && (
          <span className="wt-message-meta">
            {chatTime(message.timestamp)}
            {message.isFromMe && <TickMark ack={message.ack} />}
            {isOptimistic && <span style={{ fontSize: '0.6rem', opacity: 0.7, marginLeft: 2 }}>sending…</span>}
          </span>
        )}
      </div>
    </div>
  );
}

function MessageComposer({ onSend }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  const submit = useCallback(async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await onSend(body);
  }, [text, onSend]);

  const handleInput = (e) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 130) + 'px';
  };

  return (
    <div className="wt-composer">
      <button className="wt-icon-btn" title="Emoji"><Smile size={18} /></button>
      <button className="wt-icon-btn" title="Attach file"><Paperclip size={18} /></button>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleInput}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        placeholder="Type a message…"
      />
      <button className="wt-icon-btn wt-send-btn" onClick={text.trim() ? submit : undefined} title={text.trim() ? 'Send' : 'Voice note'}>
        {text.trim() ? <Send size={18} /> : <Mic size={18} />}
      </button>
    </div>
  );
}

// ─── Workspace: Chat Window ───────────────────────────────────────────────────

function ChatWindowArea({ activeChat, messages, loading, optimisticMsgs, onSend, onLoadOlder, tatMins, qaItem }) {
  const threadRef = useRef(null);
  const bottomRef = useRef(null);
  const prevScrollHeightRef = useRef(0);
  const prevChatIdRef = useRef(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  // Reset scroll state on chat change
  useEffect(() => {
    if (activeChat?.chatId !== prevChatIdRef.current) {
      prevChatIdRef.current = activeChat?.chatId;
      setUserScrolledUp(false);
    }
  }, [activeChat?.chatId]);

  // Scroll to bottom when messages arrive (if not scrolled up)
  useEffect(() => {
    if (!userScrolledUp && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages?.length, optimisticMsgs?.length, userScrolledUp]);

  // Initial jump to bottom on chat open
  useEffect(() => {
    requestAnimationFrame(() => {
      if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'instant' });
    });
  }, [activeChat?.chatId]);

  const handleScroll = useCallback(() => {
    const el = threadRef.current;
    if (!el) return;
    setUserScrolledUp(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
  }, []);

  const handleLoadOlder = useCallback(async () => {
    const el = threadRef.current;
    if (el) prevScrollHeightRef.current = el.scrollHeight;
    await onLoadOlder();
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevScrollHeightRef.current;
    });
  }, [onLoadOlder]);

  // Merge real + optimistic messages, deduplicate, sort by time
  const allMessages = useMemo(() => {
    const real = messages || [];
    const opt = (optimisticMsgs || []).filter(
      (om) => !real.some((m) => m.body === om.body && Math.abs(new Date(m.timestamp) - new Date(om.timestamp)) < 5000),
    );
    return [...real, ...opt].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [messages, optimisticMsgs]);

  // Build items list with date separators and grouping markers
  const processedItems = useMemo(() => {
    const items = [];
    let lastDateLabel = '';
    allMessages.forEach((msg, i) => {
      const dateLabel = getDateLabel(msg.timestamp);
      if (dateLabel !== lastDateLabel) {
        items.push({ type: 'separator', label: dateLabel, key: `sep_${dateLabel}_${i}` });
        lastDateLabel = dateLabel;
      }
      const next = allMessages[i + 1];
      const showMeta = !next ||
        next.isFromMe !== msg.isFromMe ||
        (new Date(next.timestamp) - new Date(msg.timestamp)) > 120000;
      items.push({ type: 'message', msg, showMeta, isOptimistic: !!msg._optimistic });
    });
    return items;
  }, [allMessages]);

  const tatColor = tatMins == null || tatMins === 0 ? '#4ade80' : tatMins < 60 ? '#4ade80' : tatMins < 240 ? '#f59e0b' : '#f87171';
  const slaStatus = qaItem?.slaStatus || activeChat?.slaStatus;

  if (!activeChat) {
    return (
      <section className="wt-chat-window wt-chat-placeholder">
        <MessageCircle size={42} />
        <h2>My WhatsApp Workspace</h2>
        <p>Select a conversation to view messages, reply, and manage follow-ups in one place.</p>
      </section>
    );
  }

  return (
    <section className="wt-chat-window">
      <header className="wt-chat-window-head">
        <div className={`wt-chat-avatar large ${activeChat.isGroup ? 'group' : ''}`}>
          {activeChat.isGroup ? <Users size={21} /> : initials(activeChat.name || activeChat.phone)}
        </div>
        <div className="wt-chat-title">
          <strong>{activeChat.name || activeChat.phone}</strong>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {activeChat.phone && !activeChat.isGroup && (
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.74rem' }}>{activeChat.phone}</span>
            )}
            {slaStatus && statusBadge(slaStatus)}
            {tatMins !== null && tatMins !== undefined && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.74rem', fontWeight: 700, color: tatColor }}>
                <Timer size={11} />{fmtWaiting(tatMins)}
              </span>
            )}
          </span>
        </div>
        <div className="wt-chat-actions">
          <button className="wt-icon-btn"><Info size={18} /></button>
          <button className="wt-icon-btn"><MoreVertical size={18} /></button>
        </div>
      </header>

      <div ref={threadRef} className="wt-message-thread" onScroll={handleScroll}>
        {loading ? (
          <div className="wt-chat-empty"><Loader2 className="spin" size={24} /> Loading messages…</div>
        ) : (
          <>
            {allMessages.length > 0 && (
              <button className="wt-load-older" onClick={handleLoadOlder}>
                Load 50 more messages
              </button>
            )}
            {processedItems.map((item) =>
              item.type === 'separator'
                ? <DateSeparator key={item.key} label={item.label} />
                : <MessageBubble
                    key={item.msg.messageId}
                    message={item.msg}
                    isGroup={activeChat.isGroup}
                    showMeta={item.showMeta}
                    isOptimistic={item.isOptimistic}
                  />
            )}
            {allMessages.length === 0 && (
              <div className="wt-chat-empty">No messages yet. New messages will appear here.</div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <MessageComposer onSend={onSend} />
    </section>
  );
}

// ─── Workspace: Operations Panel ──────────────────────────────────────────────

function OperationsPanel({ chat, analytics, qaQueue, leads, data, updateTicket, updateLead, createNote, now }) {
  const chatId = chat?.chatId;
  const a = analytics || {};

  const matchingLead = useMemo(
    () => leads?.find((l) => l.phone && chat?.phone && normalizePhone(l.phone) === normalizePhone(chat.phone)),
    [leads, chat?.phone],
  );

  const qaItem = useMemo(
    () => qaQueue?.find((q) => q.chatId === chatId),
    [qaQueue, chatId],
  );

  const notes = useMemo(() => {
    const raw = data?.notesByChat?.[chatId] || [];
    return [...raw].sort((a, b) => {
      const ta = a.createdAt || a.created_at || 0;
      const tb = b.createdAt || b.created_at || 0;
      const toMs = (v) => typeof v === 'number' ? v * 1000 : new Date(v).getTime();
      return toMs(ta) - toMs(tb);
    });
  }, [data?.notesByChat, chatId]);

  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [ticketSaving, setTicketSaving] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('');
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  useEffect(() => {
    setFollowUpDate(chat?.followUpDate || matchingLead?.follow_up_date || '');
    setFollowUpTime(chat?.followUpTime || matchingLead?.follow_up_time || '');
  }, [chatId, matchingLead?._id]);

  const ticketStatus = chat?.ticketStatus || qaItem?.ticketStatus || 'open';
  const leadStatus = matchingLead?.status || '';

  const handleTicketChange = useCallback(async (s) => {
    if (!chatId || ticketSaving) return;
    setTicketSaving(true);
    try { await updateTicket(chatId, { ticketStatus: s }); } catch (_) { /* endpoint may not exist for this chat type */ } finally { setTicketSaving(false); }
  }, [chatId, ticketSaving, updateTicket]);

  const handleLeadStatus = useCallback(async (s) => {
    if (!matchingLead) return;
    try { await updateLead(matchingLead._id, { status: s }); } catch (_) { /* swallow */ }
  }, [matchingLead, updateLead]);

  const handleSaveFollowUp = useCallback(async () => {
    if (!chatId || savingFollowUp) return;
    setSavingFollowUp(true);
    try {
      await updateTicket(chatId, { followUpDate, followUpTime }).catch(() => {});
      if (matchingLead) await updateLead(matchingLead._id, { follow_up_date: followUpDate, follow_up_time: followUpTime });
    } catch (_) { /* swallow */ } finally { setSavingFollowUp(false); }
  }, [chatId, followUpDate, followUpTime, matchingLead, updateTicket, updateLead, savingFollowUp]);

  const handleAddNote = useCallback(async () => {
    if (!noteText.trim() || !chatId) return;
    setSavingNote(true);
    try { await createNote(chatId, noteText.trim()); setNoteText(''); } catch (_) { /* swallow */ } finally { setSavingNote(false); }
  }, [noteText, chatId, createNote]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const followUpOverdue = followUpDate && followUpDate < today;
  const followUpSoon = followUpDate && !followUpOverdue && (() => {
    const diff = new Date(followUpDate).getTime() - Date.now();
    return diff > 0 && diff < 86400000;
  })();

  const tatMins = useMemo(() => computeLiveTatMins(chat, now), [chat, now]);
  const tatColor = tatMins == null || tatMins === 0 ? '#4ade80' : tatMins < 60 ? '#4ade80' : tatMins < 240 ? '#f59e0b' : '#f87171';

  const TICKET_OPTIONS = ['open', 'in-progress', 'resolved', 'closed'];

  if (!chat) {
    return (
      <aside className="wt-insights-panel">
        <div className="wt-insights-head"><PanelRight size={17} /><strong>Operations</strong></div>
        <div style={{ padding: '2rem 0.75rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Select a conversation to view operations context.
        </div>
      </aside>
    );
  }

  return (
    <aside className="wt-insights-panel">
      <div className="wt-insights-head"><PanelRight size={17} /><strong>Operations</strong></div>

      {/* Lead Status */}
      <div className="wt-insight-card">
        <span className="wt-insight-label"><Target size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Lead Status</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.28rem', marginTop: '0.4rem' }}>
          {LEAD_STAGES.map((s) => (
            <button
              key={s.key}
              onClick={() => handleLeadStatus(s.key)}
              disabled={!matchingLead}
              style={{
                padding: '0.18rem 0.5rem',
                borderRadius: 20,
                fontSize: '0.68rem',
                fontWeight: 600,
                border: `1px solid ${leadStatus === s.key ? s.color + 'aa' : 'rgba(255,255,255,0.1)'}`,
                cursor: matchingLead ? 'pointer' : 'default',
                background: leadStatus === s.key ? s.color + '22' : 'rgba(255,255,255,0.04)',
                color: leadStatus === s.key ? s.color : 'var(--text-secondary)',
                transition: 'all 0.15s',
                opacity: !matchingLead ? 0.4 : 1,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        {!matchingLead && (
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0.4rem 0 0' }}>No lead profile matched to this contact.</p>
        )}
      </div>

      {/* Ticket Status */}
      <div className="wt-insight-card">
        <span className="wt-insight-label"><Ticket size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Ticket Status</span>
        <div className="wt-ticket-chips">
          {TICKET_OPTIONS.map((s) => (
            <button
              key={s}
              className={`wt-ticket-chip ${ticketStatus === s ? 'active' : ''}`}
              onClick={() => handleTicketChange(s)}
              disabled={ticketSaving}
              style={ticketStatus === s ? {
                borderColor: TICKET_STATUS_COLORS[s] + '88',
                background: TICKET_STATUS_COLORS[s] + '22',
                color: TICKET_STATUS_COLORS[s],
              } : undefined}
            >
              {s.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* TAT & Waiting */}
      <div className="wt-insight-card">
        <span className="wt-insight-label"><Timer size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Waiting Time</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.4rem 0 0.2rem' }}>
          <strong style={{ fontSize: '1.5rem', fontWeight: 800, color: tatColor, lineHeight: 1 }}>
            {fmtWaiting(tatMins)}
          </strong>
          {qaItem?.slaStatus && statusBadge(qaItem.slaStatus)}
        </div>
      </div>

      {/* My Follow-Up */}
      <div className="wt-insight-card">
        <span className="wt-insight-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span><CalendarClock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />My Follow-Up</span>
          {followUpOverdue && <span className="wt-badge red" style={{ fontSize: '0.62rem', padding: '0.15rem 0.45rem' }}>Overdue</span>}
          {followUpSoon && !followUpOverdue && <span className="wt-badge orange" style={{ fontSize: '0.62rem', padding: '0.15rem 0.45rem' }}>Due Soon</span>}
        </span>
        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
          <input
            type="date"
            className="wt-select"
            style={{ flex: 1, padding: '0.3rem 0.5rem', fontSize: '0.74rem', minWidth: 105 }}
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
          />
          <input
            type="time"
            className="wt-select"
            style={{ flex: 1, padding: '0.3rem 0.5rem', fontSize: '0.74rem', minWidth: 85 }}
            value={followUpTime}
            onChange={(e) => setFollowUpTime(e.target.value)}
          />
        </div>
        <button
          className="wt-btn wt-btn-sm wt-btn-ghost"
          style={{ marginTop: '0.4rem', width: '100%', justifyContent: 'center' }}
          onClick={handleSaveFollowUp}
          disabled={savingFollowUp || !followUpDate}
        >
          {savingFollowUp ? <Loader2 size={11} className="spin" /> : <CheckCircle size={11} />} Save Follow-Up
        </button>
      </div>

      {/* Conversation QA */}
      <div className="wt-insight-card">
        <span className="wt-insight-label">Conversation QA</span>
        <div className="wt-insight-score" style={{ color: scoreColor(a.qaScore || 100) }}>{a.qaScore ?? 100}%</div>
        <div className="wt-score-bar">
          <div className="wt-score-bar-fill" style={{ width: `${a.qaScore ?? 100}%`, background: scoreColor(a.qaScore || 100) }} />
        </div>
      </div>

      {/* Internal Notes */}
      <div className="wt-insight-card">
        <span className="wt-insight-label"><StickyNote size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Internal Notes</span>
        <div className="wt-notes-list" style={{ maxHeight: 220 }}>
          {notes.length === 0 && <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>No notes yet.</div>}
          {notes.map((n, i) => (
            <div key={n.id || i} className="wt-note-item">
              <div className="wt-note-meta">{fmtNoteTime(n.createdAt || n.created_at)}</div>
              <div className="wt-note-body">{n.body}</div>
            </div>
          ))}
        </div>
        <div className="wt-notes-composer">
          <textarea
            className="wt-notes-textarea"
            rows={2}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add an internal note…"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
          />
          <button
            className="wt-btn wt-btn-sm wt-btn-primary"
            onClick={handleAddNote}
            disabled={savingNote || !noteText.trim()}
          >
            {savingNote ? <Loader2 size={11} className="spin" /> : <Plus size={11} />} Add
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─── Workspace Module ─────────────────────────────────────────────────────────

function WorkspaceModule({
  data, loading, fetchChats, fetchMessages, sendMessage,
  updateTicket, updateLead, createNote, fetchNotes,
  leads, externalChatId, setExternalChatId, sessionState,
}) {
  const [localChatId, setLocalChatId] = useState('');
  const [optimisticMsgs, setOptimisticMsgs] = useState({});
  const [now, setNow] = useState(Date.now);

  // Live TAT clock — tick every 60 seconds
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch chats once on mount
  useEffect(() => { fetchChats(); }, [fetchChats]);

  const activeChatId = externalChatId || localChatId;

  const setActiveChatId = useCallback((id) => {
    setLocalChatId(id);
    setExternalChatId?.(id);
  }, [setExternalChatId]);

  const activeChat = useMemo(
    () => data.chats?.find((c) => c.chatId === activeChatId) || null,
    [data.chats, activeChatId],
  );

  // Fetch messages (limit 50) and notes on every chat selection
  useEffect(() => {
    if (!activeChatId) return;
    fetchMessages(activeChatId, { limit: 50 });
    fetchNotes(activeChatId);
  }, [activeChatId, fetchMessages, fetchNotes]);

  const selectChat = useCallback((chat) => setActiveChatId(chat.chatId), [setActiveChatId]);

  const handleSend = useCallback(async (body) => {
    if (!activeChatId || !body) return;
    const tempId = `_opt_${Date.now()}`;
    const tempMsg = {
      messageId: tempId,
      chatId: activeChatId,
      body,
      timestamp: new Date().toISOString(),
      isFromMe: true,
      type: 'chat',
      hasMedia: false,
      _optimistic: true,
    };
    setOptimisticMsgs((p) => ({ ...p, [activeChatId]: [...(p[activeChatId] || []), tempMsg] }));
    try {
      await sendMessage(activeChatId, body);
    } finally {
      setTimeout(() => {
        setOptimisticMsgs((p) => ({ ...p, [activeChatId]: (p[activeChatId] || []).filter((m) => m.messageId !== tempId) }));
      }, 3000);
    }
  }, [activeChatId, sendMessage]);

  const handleLoadOlder = useCallback(async () => {
    if (!activeChatId) return;
    const msgs = data.messagesByChat?.[activeChatId] || [];
    const first = msgs[0];
    if (first?.timestamp) {
      await fetchMessages(activeChatId, { before: first.timestamp, limit: 50 });
    }
  }, [activeChatId, data.messagesByChat, fetchMessages]);

  const activeMessages = useMemo(
    () => activeChat ? (data.messagesByChat?.[activeChat.chatId] || []) : [],
    [activeChat, data.messagesByChat],
  );

  const activeOptimistic = useMemo(
    () => activeChatId ? (optimisticMsgs[activeChatId] || []) : [],
    [activeChatId, optimisticMsgs],
  );

  const qaItem = useMemo(
    () => data.qaQueue?.find((q) => q.chatId === activeChatId),
    [data.qaQueue, activeChatId],
  );

  const tatMins = useMemo(() => computeLiveTatMins(activeChat, now), [activeChat, now]);

  return (
    <div className="wt-live-workspace">
      <ChatListSidebar
        chats={data.chats}
        leads={leads}
        activeChatId={activeChatId}
        onSelect={selectChat}
        loading={loading}
        fetchChats={fetchChats}
        sessionState={sessionState}
      />
      <ChatWindowArea
        activeChat={activeChat}
        messages={activeMessages}
        loading={!!loading[`messages:${activeChatId}`]}
        optimisticMsgs={activeOptimistic}
        onSend={handleSend}
        onLoadOlder={handleLoadOlder}
        tatMins={tatMins}
        qaItem={qaItem}
      />
      <OperationsPanel
        chat={activeChat}
        analytics={data.analytics}
        qaQueue={data.qaQueue}
        leads={leads}
        data={data}
        updateTicket={updateTicket}
        updateLead={updateLead}
        createNote={createNote}
        now={now}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const WhatsAppTools = () => {
  const [active, setActive] = useState('workspace');
  const [activeChatId, setActiveChatId] = useState('');

  const wa = useWhatsApp();
  const {
    sessionState, serviceReachable, data, loading,
    reconnectSession, disconnectSession,
    fetchChats, fetchContacts, fetchAnalytics, fetchLeads,
    fetchQaQueue, fetchNotifs, fetchSearch,
    fetchMessages, sendMessage,
    createLead, updateLead, updateTicket, createNote, fetchNotes,
  } = wa;

  const isReady = sessionState.status === 'ready';

  const onOpenChat = useCallback(({ chatId, name, phone }) => {
    setActive('workspace');
    if (chatId) {
      setActiveChatId(chatId);
    } else if (phone) {
      const match = data.chats?.find((c) => c.phone && normalizePhone(c.phone) === normalizePhone(phone));
      if (match) setActiveChatId(match.chatId);
    }
  }, [data.chats]);

  const qaBadge = useMemo(() => data.qaQueue?.filter((c) => c.slaStatus !== 'ok').length || 0, [data.qaQueue]);
  const leadBadge = useMemo(() => data.leads?.filter((l) => l.status === 'hot-lead' || l.status === 'hot').length || 0, [data.leads]);
  const notifBadge = useMemo(() => data.notifications?.filter((n) => n.type === 'critical').length || 0, [data.notifications]);

  const getBadge = useCallback((b) => {
    if (b === 'qa') return qaBadge;
    if (b === 'leads') return leadBadge;
    if (b === 'notifs') return notifBadge;
    return 0;
  }, [qaBadge, leadBadge, notifBadge]);

  const renderModule = () => {
    if (!isReady && active !== 'link-creator') {
      return <ConnectionPanel sessionState={sessionState} serviceReachable={serviceReachable} reconnectSession={reconnectSession} />;
    }
    switch (active) {
      case 'workspace':
        return (
          <WorkspaceModule
            data={data}
            loading={loading}
            fetchChats={fetchChats}
            fetchMessages={fetchMessages}
            sendMessage={sendMessage}
            updateTicket={updateTicket}
            updateLead={updateLead}
            createNote={createNote}
            fetchNotes={fetchNotes}
            leads={data.leads || []}
            externalChatId={activeChatId}
            setExternalChatId={setActiveChatId}
            sessionState={sessionState}
          />
        );
      case 'dashboard':
        return <DashboardModule analytics={data.analytics} leads={data.leads} loading={loading} onNavigate={setActive} fetchAnalytics={fetchAnalytics} />;
      case 'link-creator':
        return <LinkCreatorModule />;
      case 'qa':
        return <QAModule qaQueue={data.qaQueue} loading={loading} fetchQaQueue={fetchQaQueue} onOpenChat={onOpenChat} />;
      case 'analytics':
        return <AnalyticsModule analytics={data.analytics} loading={loading} fetchAnalytics={fetchAnalytics} />;
      case 'leads':
        return <LeadsModule leads={data.leads} loading={loading} fetchLeads={fetchLeads} createLead={createLead} updateLead={updateLead} onOpenChat={onOpenChat} />;
      case 'contacts':
        return <ContactsModule contacts={data.contacts} loading={loading} fetchContacts={fetchContacts} />;
      case 'chat-search':
        return <ChatSearchModule searchResults={data.searchResults} loading={loading} fetchSearch={fetchSearch} />;
      case 'reports':
        return <ReportsModule />;
      case 'notifications':
        return <NotificationsModule notifications={data.notifications} data={data} loading={loading} fetchNotifs={fetchNotifs} />;
      default:
        return null;
    }
  };

  const statusDot = isReady ? 'online' : sessionState.status === 'qr' ? 'busy' : 'offline';

  return (
    <div className="wt-workspace">
      <aside className="wt-sidebar">
        <div className="wt-sidebar-brand">
          <div className="wt-sidebar-brand-icon"><MessageCircle size={18} /></div>
          <div className="wt-sidebar-brand-text">
            <strong>WhatsApp Tools</strong>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className={`wt-status-dot ${statusDot}`} />
              {isReady ? 'Connected' : sessionState.status === 'qr' ? 'Scan QR' : sessionState.status}
            </span>
          </div>
        </div>

        {!isReady && (
          <div style={{ margin: '0 0.5rem 0.75rem', padding: '0.75rem', background: 'rgba(37,211,102,0.05)', border: '1px solid rgba(37,211,102,0.15)', borderRadius: 10, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {sessionState.status === 'qr' ? 'Scan the QR code to connect' : 'Connect WhatsApp to see live data'}
            <button className="wt-btn wt-btn-sm wt-btn-primary" style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }} onClick={() => setActive('dashboard')}>
              Connect
            </button>
          </div>
        )}

        {SECTIONS.map((section) => {
          const items = MODULES.filter((m) => m.section === section);
          if (!items.length) return null;
          return (
            <div key={section}>
              <div className="wt-sidebar-section">{section}</div>
              {items.map((m) => {
                const count = m.badge ? getBadge(m.badge) : 0;
                return (
                  <button key={m.id} className={`wt-nav-item ${active === m.id ? 'active' : ''}`} onClick={() => setActive(m.id)}>
                    <m.icon size={15} />{m.label}
                    {count > 0 && <span className="wt-nav-badge">{count}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}

        {isReady && (
          <div style={{ marginTop: 'auto', padding: '0.75rem 0.5rem 0' }}>
            <button className="wt-btn wt-btn-sm wt-btn-danger" style={{ width: '100%', justifyContent: 'center' }} onClick={disconnectSession}>
              <WifiOff size={12} /> Disconnect
            </button>
          </div>
        )}
      </aside>

      <main className="wt-content">
        <div className="wt-mobile-nav">
          {MODULES.map((m) => (
            <button key={m.id} className={`wt-mobile-nav-item ${active === m.id ? 'active' : ''}`} onClick={() => setActive(m.id)}>
              <m.icon size={18} />{m.label}
            </button>
          ))}
        </div>
        {renderModule()}
      </main>
    </div>
  );
};

export default WhatsAppTools;

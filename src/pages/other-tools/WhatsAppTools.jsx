import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  MessageCircle, Link as LinkIcon, QrCode, Clipboard, ExternalLink,
  RotateCcw, Sparkles, LayoutDashboard, ShieldCheck, BarChart2,
  Users, Search, Download, Bell, Target, AlertTriangle,
  CheckCircle, Clock, Zap, XCircle,
  FileText, FileSpreadsheet, Plus, Activity,
  UserCheck, MessageSquare, RefreshCw,
  ArrowUp, ArrowDown, WifiOff, Loader2,
  Phone, Send, Paperclip, Mic, MoreVertical, Image as ImageIcon,
  Video, File, CheckCheck, Smile, User, Info, PanelRight,
  Inbox, StickyNote, UserCog, CalendarClock, Ticket, Timer,
  ChevronDown, ChevronRight, ArrowRightCircle
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { useWhatsApp } from '../../hooks/useWhatsApp';
import '../styles/WhatsAppTools.css';

// ── Helpers ────────────────────────────────────────────────────────────────
const normalizePhone = (v) => v.replace(/\D/g, '');

const buildWaLink = (phone, msg) => {
  const n = normalizePhone(phone);
  if (!n || n.length < 8 || n.length > 15) return { link: '', error: n ? 'Invalid number.' : '' };
  return { link: msg.trim() ? `https://wa.me/${n}?text=${encodeURIComponent(msg)}` : `https://wa.me/${n}`, error: '' };
};

function fmtSeconds(s) {
  if (!s) return '—';
  if (s < 60)  return `${s}s`;
  if (s < 3600) return `${Math.round(s/60)}m`;
  return `${(s/3600).toFixed(1)}h`;
}

// Human-readable waiting time: 2d 4h 32m or 4h 12m or 45m
function fmtWaiting(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  const m = Math.round(Number(minutes));
  if (m <= 0)   return 'Just now';
  if (m < 60)   return `${m}m`;
  const h = Math.floor(m / 60); const rm = m % 60;
  if (h < 24)   return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
  const d = Math.floor(h / 24); const rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

// Same but from raw seconds
function fmtWaitingSecs(secs) {
  return fmtWaiting(Math.round((secs || 0) / 60));
}

function timeAgo(ts) {
  if (!ts) return '—';
  const d = Math.round((Date.now() - new Date(ts).getTime()) / 1000);
  if (d < 60)   return `${d}s ago`;
  if (d < 3600) return `${Math.round(d/60)}m ago`;
  if (d < 86400) return `${Math.round(d/3600)}h ago`;
  return `${Math.round(d/86400)}d ago`;
}

function chatTime(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  }
  return date.toLocaleDateString([], { month:'short', day:'numeric' });
}

function initials(name = '') {
  const clean = String(name || '').replace(/[^\w\s+]/g, '').trim();
  if (!clean) return 'WA';
  return clean.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function shortMessage(message = '') {
  if (!message) return 'Media message';
  return message.length > 72 ? `${message.slice(0, 72)}...` : message;
}

const scoreColor = (s) => s >= 90 ? '#25d366' : s >= 70 ? '#f59e0b' : '#ef4444';

const STATUS_MAP = {
  // SLA
  breached:    ['red',    'SLA Breached'],
  warning:     ['orange', 'Warning'],
  ok:          ['green',  'On Time'],
  // Lead pipeline
  potential:   ['blue',   'Potential'],
  'follow-up': ['orange', 'Follow-Up'],
  'hot-lead':  ['red',    'Hot Lead'],
  hot:         ['red',    'Hot Lead'],
  vip:         ['purple', 'VIP'],
  dropout:     ['gray',   'Dropout'],
  converted:   ['green',  'Converted'],
  closed:      ['green',  'Closed'],
  spam:        ['gray',   'Spam'],
  inactive:    ['gray',   'Inactive'],
  new:         ['blue',   'New Lead'],
  // Ticket
  open:        ['blue',   'Open'],
  'in-progress':['orange','In Progress'],
  resolved:    ['green',  'Resolved'],
};

const statusBadge = (s) => {
  const [color, label] = STATUS_MAP[s] || ['gray', String(s || '—')];
  return <span className={`wt-badge ${color}`}>{label}</span>;
};

const CHART_STYLE = {
  tooltip: { background:'rgba(9,9,18,0.95)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', borderRadius:'8px', fontSize:'12px' },
  axis:    { fill:'#64748b', fontSize:11 },
};

// ── Connection Screen ─────────────────────────────────────────────────────
function ConnectionPanel({ sessionState, serviceReachable, reconnectSession }) {
  const { status, qrCode, error } = sessionState;

  const isLoading = ['connecting', 'initializing', 'authenticated'].includes(status);

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', padding:'2rem' }}>
      <div style={{ maxWidth:480, width:'100%', textAlign:'center' }}>
        <div style={{ width:64, height:64, borderRadius:'50%', background:'rgba(37,211,102,0.12)', display:'inline-flex', alignItems:'center', justifyContent:'center', marginBottom:'1.5rem' }}>
          <MessageCircle size={32} color="#25d366" />
        </div>

        <h2 style={{ fontSize:'1.5rem', fontWeight:700, color:'var(--text-primary)', marginBottom:'0.5rem' }}>
          WhatsApp Tools
        </h2>

        {!serviceReachable && (
          <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:12, padding:'1rem', marginBottom:'1.5rem', fontSize:'0.875rem', color:'#f87171' }}>
            <WifiOff size={16} style={{marginRight:6, verticalAlign:'middle'}} />
            Cannot connect to WhatsApp service at <strong>localhost:3002</strong>.
            <br />Start it with: <code style={{background:'rgba(0,0,0,0.3)',padding:'0.1rem 0.4rem',borderRadius:4}}>npm run dev:whatsapp</code>
          </div>
        )}

        {status === 'qr' && qrCode ? (
          <div>
            <p style={{ color:'var(--text-secondary)', marginBottom:'1.25rem', fontSize:'0.9rem' }}>
              Scan this QR code with your WhatsApp app to connect your account.
            </p>
            <div style={{ background:'white', padding:16, borderRadius:16, display:'inline-block', marginBottom:'1.25rem' }}>
              <img src={qrCode} alt="WhatsApp QR Code" style={{ display:'block', width:220, height:220 }} />
            </div>
            <p style={{ color:'var(--text-secondary)', fontSize:'0.8rem' }}>
              WhatsApp → Linked Devices → Link a Device
            </p>
          </div>
        ) : isLoading ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.75rem', padding:'2rem 0' }}>
            <Loader2 size={32} color="#25d366" style={{ animation:'spin 1s linear infinite' }} />
            <p style={{ color:'var(--text-secondary)', fontSize:'0.9rem' }}>
              {status === 'connecting'    ? 'Connecting to service…' :
               status === 'initializing' ? 'Starting WhatsApp client…' :
               status === 'authenticated' ? 'Authenticated! Loading chats…' : 'Please wait…'}
            </p>
          </div>
        ) : (
          <div>
            {error && (
              <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:12, padding:'1rem', marginBottom:'1.25rem', fontSize:'0.875rem', color:'#f87171' }}>
                {error}
              </div>
            )}
            <p style={{ color:'var(--text-secondary)', marginBottom:'1.25rem', fontSize:'0.9rem' }}>
              {status === 'disconnected' ? 'Session disconnected.' : 'Waiting to connect…'}
            </p>
            <button className="wt-btn wt-btn-primary" onClick={reconnectSession} style={{width:'100%',justifyContent:'center'}}>
              <RefreshCw size={15} /> Connect WhatsApp
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────
function DashboardModule({ analytics, loading, onNavigate, fetchAnalytics }) {
  const a = analytics || {};
  useEffect(() => { fetchAnalytics(); }, []);

  const kpis = [
    { label:'Total Chats',       value: a.totalChats ?? '—',      change: null,                    icon: MessageCircle, bg:'rgba(37,211,102,0.12)',  color:'#25d366' },
    { label:'Pending Replies',   value: a.pendingReplies ?? '—',  dir: 'down',                     icon: Clock,         bg:'rgba(249,115,22,0.12)',  color:'#fb923c' },
    { label:'Avg Response Time', value: fmtSeconds(a.avgResponseTime), dir: null,                  icon: Zap,           bg:'rgba(59,130,246,0.12)',  color:'#60a5fa' },
    { label:'SLA Compliance',    value: a.slaCompliance != null ? `${a.slaCompliance}%` : '—', dir:'up', icon: ShieldCheck, bg:'rgba(37,211,102,0.12)', color:'#25d366' },
    { label:'QA Score',          value: a.qaScore != null ? `${a.qaScore}%` : '—', dir:'up',       icon: Activity,      bg:'rgba(99,102,241,0.12)', color:'#a78bfa' },
    { label:'SLA Breaches',      value: a.breachedCount ?? '—',   dir: 'neutral',                  icon: AlertTriangle, bg:'rgba(239,68,68,0.12)',  color:'#f87171' },
  ];

  return (
    <>
      <div className="wt-page-header">
        <div>
          <h1 className="wt-page-title">Operations Dashboard</h1>
          <p className="wt-page-subtitle">Live WhatsApp data</p>
        </div>
        <div className="wt-header-actions">
          <button className="wt-btn wt-btn-ghost" onClick={() => fetchAnalytics()}>
            <RefreshCw size={14} className={loading.analytics ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {(a.breachedCount > 0) && (
        <div className="wt-qa-alert">
          <AlertTriangle size={16} />
          <strong>{a.breachedCount} SLA breach{a.breachedCount > 1 ? 'es' : ''}</strong> detected — customers waiting without response.
          <button className="wt-btn wt-btn-sm wt-btn-danger" style={{marginLeft:'auto'}} onClick={() => onNavigate('qa')}>View QA Queue</button>
        </div>
      )}

      {loading.analytics && !a.totalChats ? (
        <div className="wt-empty"><Loader2 size={24} style={{animation:'spin 1s linear infinite', marginBottom:8}} /><br/>Loading analytics…</div>
      ) : (
        <>
          <div className="wt-kpi-grid">
            {kpis.map((k) => (
              <div key={k.label} className="wt-kpi-card">
                <div className="wt-kpi-top">
                  <div className="wt-kpi-icon" style={{background: k.bg}}><k.icon size={17} color={k.color} /></div>
                  {k.dir && (
                    <span className={`wt-kpi-change ${k.dir === 'up' ? 'up' : k.dir === 'down' ? 'down' : 'neutral'}`}>
                      {k.dir === 'up' ? <ArrowUp size={10}/> : k.dir === 'down' ? <ArrowDown size={10}/> : null}live
                    </span>
                  )}
                </div>
                <div className="wt-kpi-value">{k.value}</div>
                <div className="wt-kpi-label">{k.label}</div>
              </div>
            ))}
          </div>

          {(a.hourlyData?.length > 0 || a.weeklyData?.length > 0) && (
            <div className="wt-charts-grid">
              {a.hourlyData?.length > 0 && (
                <div className="wt-chart-card">
                  <p className="wt-chart-card-title">Hourly Chat Volume vs Replied</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={a.hourlyData} margin={{top:5,right:10,left:-20,bottom:0}}>
                      <defs>
                        <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#25d366" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#25d366" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                      <XAxis dataKey="h" tick={CHART_STYLE.axis}/>
                      <YAxis tick={CHART_STYLE.axis}/>
                      <Tooltip contentStyle={CHART_STYLE.tooltip}/>
                      <Area type="monotone" dataKey="chats"   stroke="#25d366" fill="url(#gc)" strokeWidth={2} dot={false} name="Total"/>
                      <Area type="monotone" dataKey="replied" stroke="#6366f1" fill="none"      strokeWidth={2} dot={false} name="Replied"/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              {a.weeklyData?.length > 0 && (
                <div className="wt-chart-card">
                  <p className="wt-chart-card-title">Weekly SLA & Volume</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={a.weeklyData} margin={{top:5,right:10,left:-20,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                      <XAxis dataKey="d" tick={CHART_STYLE.axis}/>
                      <YAxis tick={CHART_STYLE.axis}/>
                      <Tooltip contentStyle={CHART_STYLE.tooltip}/>
                      <Bar dataKey="score" fill="#25d366" radius={[4,4,0,0]} name="SLA %"/>
                      <Bar dataKey="chats" fill="#6366f1" radius={[4,4,0,0]} name="Chats"/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {a.leadFunnel?.length > 0 && (
                <div className="wt-chart-card">
                  <p className="wt-chart-card-title">Lead Funnel</p>
                  <div style={{display:'flex',alignItems:'center',gap:'1.5rem'}}>
                    <ResponsiveContainer width="50%" height={180}>
                      <PieChart>
                        <Pie data={a.leadFunnel} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                          {a.leadFunnel.map((e,i) => <Cell key={i} fill={e.color}/>)}
                        </Pie>
                        <Tooltip contentStyle={CHART_STYLE.tooltip}/>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{flex:1,display:'flex',flexDirection:'column',gap:'0.4rem'}}>
                      {a.leadFunnel.map((e) => (
                        <div key={e.name} style={{display:'flex',alignItems:'center',gap:'0.5rem',fontSize:'0.8rem'}}>
                          <span style={{width:10,height:10,borderRadius:'50%',background:e.color,flexShrink:0}}/>
                          <span style={{color:'var(--text-secondary)',flex:1}}>{e.name}</span>
                          <strong style={{color:'var(--text-primary)'}}>{e.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!a.totalChats && (
            <div className="wt-empty">
              <MessageCircle size={32} style={{opacity:0.3,marginBottom:8}}/>
              <br/>No data yet. Chats will appear as messages are received.
            </div>
          )}
        </>
      )}
    </>
  );
}

// ── Link Creator ──────────────────────────────────────────────────────────
function LinkCreatorModule() {
  const [phone, setPhone]       = useState('');
  const [msg, setMsg]           = useState('');
  const [qrUrl, setQrUrl]       = useState('');
  const [copied, setCopied]     = useState(false);
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
          <button className="wt-btn wt-btn-ghost" onClick={() => { setPhone('+14155552671'); setMsg('Hello! I wanted to connect.'); }}><Sparkles size={14}/> Sample</button>
          <button className="wt-btn wt-btn-ghost" onClick={() => { setPhone(''); setMsg(''); setQrUrl(''); setStatusMsg(''); }}><RotateCcw size={14}/> Reset</button>
        </div>
      </div>
      <div className="wt-lc-grid">
        <div className="wt-lc-form-card">
          <div className="wt-field">
            <label>Phone Number (with country code)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 415 555 2671"/>
            <small>Include country code — e.g. +971 for UAE, +44 for UK</small>
          </div>
          <div className="wt-field">
            <label>Pre-filled Message <span style={{color:'var(--text-secondary)',fontWeight:400}}>(optional)</span></label>
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Type your message here…"/>
            <small>{msg.length} characters</small>
          </div>
          {error && <div className="wt-badge red" style={{display:'block',padding:'0.5rem',borderRadius:8}}>{error}</div>}
        </div>
        <div className="wt-lc-preview-card">
          <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.75rem',fontWeight:600,fontSize:'0.875rem'}}>
            <MessageCircle size={16} color="#25d366"/> Generated Link
          </div>
          <div className="wt-link-output">{link || <span style={{color:'var(--text-secondary)'}}>Your link will appear here…</span>}</div>
          <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap',marginBottom:'0.75rem'}}>
            <button className="wt-btn wt-btn-ghost wt-btn-sm" onClick={copy} disabled={!link}>
              {copied ? <CheckCircle size={13}/> : <Clipboard size={13}/>}{copied ? 'Copied!' : 'Copy'}
            </button>
            <button className="wt-btn wt-btn-ghost wt-btn-sm" onClick={() => link && setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}`)} disabled={!link}>
              <QrCode size={13}/> QR
            </button>
            <button className="wt-btn wt-btn-primary wt-btn-sm" onClick={() => link && window.open(link,'_blank','noopener,noreferrer')} disabled={!link}>
              <ExternalLink size={13}/> Open
            </button>
          </div>
          {sText && <div className={`wt-badge ${sType === 'success' ? 'green' : 'red'}`} style={{display:'block',padding:'0.5rem',borderRadius:8}}>{sText}</div>}
          {qrUrl && link && (
            <div className="wt-qr-wrap">
              <img src={qrUrl} alt="QR"/>
              <p style={{fontSize:'0.78rem',color:'var(--text-secondary)',margin:0}}>Scan to open WhatsApp</p>
            </div>
          )}
          <div style={{marginTop:'1rem',padding:'0.75rem',background:'rgba(255,255,255,0.03)',borderRadius:10,fontSize:'0.8rem'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem'}}>
              <div><span style={{color:'var(--text-secondary)'}}>Normalized</span><br/><strong>{normalizePhone(phone)||'—'}</strong></div>
              <div><span style={{color:'var(--text-secondary)'}}>Chars</span><br/><strong>{msg.length}</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── QA Monitor ────────────────────────────────────────────────────────────
function QAModule({ qaQueue, loading, fetchQaQueue, onOpenChat }) {
  const [filter, setFilter] = useState('all');
  useEffect(() => { fetchQaQueue(`?filter=${filter}`); }, [filter]);

  const chats    = qaQueue || [];
  const breached = chats.filter(c => c.slaStatus === 'breached').length;
  const warning  = chats.filter(c => c.slaStatus === 'warning').length;

  const waitingColor = (s) => s === 'breached' ? '#f87171' : s === 'warning' ? '#fb923c' : '#4ade80';

  return (
    <>
      <div className="wt-page-header">
        <div>
          <h1 className="wt-page-title">QA Monitor</h1>
          <p className="wt-page-subtitle">Real-time SLA tracking — live from your WhatsApp session</p>
        </div>
        <button className="wt-btn wt-btn-ghost" onClick={() => fetchQaQueue(`?filter=${filter}`)}>
          <RefreshCw size={14} className={loading.qaQueue ? 'spin' : ''}/> Refresh
        </button>
      </div>

      <div className="wt-kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
        {[
          {label:'Total Pending', value: chats.length,                             color:'#6366f1'},
          {label:'SLA Breached',  value: breached,                                 color:'#ef4444'},
          {label:'Warning Zone',  value: warning,                                  color:'#f59e0b'},
          {label:'On Time',       value: chats.length - breached - warning,        color:'#25d366'},
        ].map(k => (
          <div key={k.label} className="wt-kpi-card">
            <div className="wt-kpi-value" style={{color:k.color}}>{k.value}</div>
            <div className="wt-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {breached > 0 && (
        <div className="wt-qa-alert">
          <AlertTriangle size={16}/>
          <strong>{breached} SLA breach{breached > 1 ? 'es' : ''}</strong> — customers waiting without agent response.
        </div>
      )}

      <div className="wt-table-wrap">
        <div className="wt-table-header">
          <h3 className="wt-table-title">Pending Chat Queue</h3>
          <div className="wt-table-controls">
            {['all','breached','warning'].map(f => (
              <button key={f} className={`wt-btn wt-btn-sm ${filter===f?'wt-btn-primary':'wt-btn-ghost'}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f === 'breached' ? 'Breached' : 'Warning'}
              </button>
            ))}
          </div>
        </div>
        {loading.qaQueue && !chats.length ? (
          <div className="wt-empty"><Loader2 size={20} style={{animation:'spin 1s linear infinite'}}/></div>
        ) : (
          <table>
            <thead><tr><th>Customer</th><th>Last Message</th><th>Waiting</th><th>SLA</th><th>Ticket</th><th>Agent</th><th>Action</th></tr></thead>
            <tbody>
              {chats.map(c => (
                <tr key={c.chatId}>
                  <td>
                    <div style={{fontWeight:600}}>{c.customer}</div>
                    <div style={{fontSize:'0.75rem',color:'var(--text-secondary)'}}>{c.phone}</div>
                  </td>
                  <td style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.lastMessage}</td>
                  <td>
                    <span style={{color:waitingColor(c.slaStatus),fontWeight:700,fontVariantNumeric:'tabular-nums'}}>
                      <Timer size={11} style={{verticalAlign:'middle',marginRight:3}}/>
                      {fmtWaiting(c.waitingMinutes)}
                    </span>
                  </td>
                  <td>{statusBadge(c.slaStatus)}</td>
                  <td>{statusBadge(c.ticketStatus || 'open')}</td>
                  <td>
                    <span style={{color: !c.assignedTo ? '#f87171' : 'var(--text-primary)'}}>
                      {c.assignedTo || c.agentAssigned || 'Unassigned'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="wt-btn wt-btn-sm wt-btn-primary"
                      onClick={() => onOpenChat && onOpenChat({ chatId: c.chatId, name: c.customer, phone: c.phone })}
                      title="Open this conversation in the workspace"
                    >
                      <ArrowRightCircle size={12}/> Reply
                    </button>
                  </td>
                </tr>
              ))}
              {chats.length === 0 && (
                <tr><td colSpan={7} style={{textAlign:'center',padding:'2rem',color:'var(--text-secondary)'}}>No pending chats. All SLA targets met.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ── Analytics ─────────────────────────────────────────────────────────────
function AnalyticsModule({ analytics, loading, fetchAnalytics }) {
  const [range, setRange] = useState('7d');
  useEffect(() => { fetchAnalytics(`?range=${range}`); }, [range]);
  const a = analytics || {};

  return (
    <>
      <div className="wt-page-header">
        <div><h1 className="wt-page-title">Live Analytics</h1><p className="wt-page-subtitle">Calculated from real WhatsApp message timestamps</p></div>
        <div className="wt-header-actions">
          <select className="wt-select" value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="1d">Today</option><option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option>
          </select>
          <button className="wt-btn wt-btn-ghost" onClick={() => fetchAnalytics(`?range=${range}`)}><RefreshCw size={14} className={loading.analytics?'spin':''}/></button>
        </div>
      </div>

      <div className="wt-kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
        {[
          {label:'Total Chats',    value: a.totalChats ?? '—'},
          {label:'Avg Response',   value: fmtSeconds(a.avgResponseTime)},
          {label:'SLA Compliance', value: a.slaCompliance != null ? `${a.slaCompliance}%` : '—'},
          {label:'QA Score',       value: a.qaScore != null ? `${a.qaScore}%` : '—'},
        ].map((k) => (
          <div key={k.label} className="wt-kpi-card"><div className="wt-kpi-value">{k.value}</div><div className="wt-kpi-label">{k.label}</div></div>
        ))}
      </div>

      {loading.analytics && !a.hourlyData ? (
        <div className="wt-empty"><Loader2 size={24} style={{animation:'spin 1s linear infinite'}}/></div>
      ) : (
        <div className="wt-charts-grid">
          {a.hourlyData?.length > 0 && (
            <div className="wt-chart-card">
              <p className="wt-chart-card-title">Hourly Activity</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={a.hourlyData} margin={{top:5,right:10,left:-20,bottom:0}}>
                  <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                  <XAxis dataKey="h" tick={CHART_STYLE.axis}/><YAxis tick={CHART_STYLE.axis}/>
                  <Tooltip contentStyle={CHART_STYLE.tooltip}/>
                  <Area type="monotone" dataKey="chats" stroke="#6366f1" fill="url(#ga)" strokeWidth={2} dot={false} name="Chats"/>
                  <Area type="monotone" dataKey="replied" stroke="#25d366" fill="none" strokeWidth={2} dot={false} name="Replied"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {a.weeklyData?.length > 0 && (
            <div className="wt-chart-card">
              <p className="wt-chart-card-title">Daily Trend</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={a.weeklyData} margin={{top:5,right:10,left:-20,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                  <XAxis dataKey="d" tick={CHART_STYLE.axis}/><YAxis tick={CHART_STYLE.axis}/>
                  <Tooltip contentStyle={CHART_STYLE.tooltip}/>
                  <Line type="monotone" dataKey="score" stroke="#25d366" strokeWidth={2} dot={{fill:'#25d366',r:3}} name="SLA %"/>
                  <Line type="monotone" dataKey="chats" stroke="#f59e0b" strokeWidth={2} dot={{fill:'#f59e0b',r:3}} name="Chats"/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {(!a.hourlyData?.length && !a.weeklyData?.length) && (
            <div className="wt-empty" style={{gridColumn:'1/-1'}}>No message data yet for this period.</div>
          )}
        </div>
      )}
    </>
  );
}

// ── Lead Management ───────────────────────────────────────────────────────
const LEAD_STATUSES = ['potential','new','hot','follow-up','vip','converted','dropout','closed','spam'];

function LeadFollowUpRow({ lead, onUpdate }) {
  const [date, setDate] = useState(lead.follow_up_date || '');
  const [time, setTime] = useState(lead.follow_up_time || '');
  const save = () => onUpdate(lead._id, { follow_up_date: date, follow_up_time: time });
  return (
    <div className="wt-followup-row">
      <CalendarClock size={12} color="#f59e0b"/>
      <input type="date" className="wt-select" style={{padding:'0.25rem 0.5rem',fontSize:'0.75rem'}}
        value={date} onChange={e => setDate(e.target.value)}/>
      <input type="time" className="wt-select" style={{padding:'0.25rem 0.5rem',fontSize:'0.75rem'}}
        value={time} onChange={e => setTime(e.target.value)}/>
      <button className="wt-btn wt-btn-sm wt-btn-ghost" style={{padding:'0.2rem 0.55rem'}} onClick={save}>
        <CheckCircle size={11}/> Save
      </button>
    </div>
  );
}

function LeadsModule({ leads, loading, fetchLeads, createLead, updateLead, onOpenChat }) {
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilter] = useState('all');
  const [creating, setCreating]   = useState(false);
  const [newPhone, setNewPhone]   = useState('');
  const [newName, setNewName]     = useState('');

  useEffect(() => { fetchLeads(`?status=${filterStatus}&search=${encodeURIComponent(search)}`); }, [filterStatus]);

  const handleSearch  = () => fetchLeads(`?status=${filterStatus}&search=${encodeURIComponent(search)}`);
  const handleCreate  = async () => {
    if (!newPhone) return;
    await createLead({ phone: normalizePhone(newPhone), name: newName, status: 'potential' });
    setNewPhone(''); setNewName(''); setCreating(false); fetchLeads();
  };

  const list = leads || [];

  return (
    <>
      <div className="wt-page-header">
        <div><h1 className="wt-page-title">Lead Management</h1><p className="wt-page-subtitle">Full CRM pipeline — track, convert, and follow up on WhatsApp leads</p></div>
        <button className="wt-btn wt-btn-primary" onClick={() => setCreating(true)}><Plus size={14}/> Add Lead</button>
      </div>

      {creating && (
        <div style={{background:'rgba(37,211,102,0.05)',border:'1px solid rgba(37,211,102,0.2)',borderRadius:14,padding:'1.25rem',marginBottom:'1.25rem',display:'flex',gap:'0.75rem',flexWrap:'wrap',alignItems:'flex-end'}}>
          <div className="wt-field" style={{margin:0,flex:1,minWidth:140}}>
            <label>Phone</label>
            <input value={newPhone} onChange={e=>setNewPhone(e.target.value)} placeholder="+971501234567"/>
          </div>
          <div className="wt-field" style={{margin:0,flex:1,minWidth:140}}>
            <label>Name</label>
            <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Customer name"/>
          </div>
          <button className="wt-btn wt-btn-primary" onClick={handleCreate}><CheckCircle size={13}/> Save</button>
          <button className="wt-btn wt-btn-ghost" onClick={() => setCreating(false)}><XCircle size={13}/> Cancel</button>
        </div>
      )}

      <div className="wt-filter-bar">
        <div className="wt-search-wrap">
          <Search size={15}/>
          <input className="wt-search-input" placeholder="Search name or number…" value={search}
            onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSearch()}/>
        </div>
        <select className="wt-select" value={filterStatus} onChange={e=>setFilter(e.target.value)}>
          <option value="all">All Leads</option>
          {LEAD_STATUSES.map(s => <option key={s} value={s}>{s.replace('-',' ')}</option>)}
        </select>
        <button className="wt-btn wt-btn-ghost" onClick={handleSearch}><Search size={13}/></button>
      </div>

      {loading.leads && !list.length ? (
        <div className="wt-empty"><Loader2 size={24} style={{animation:'spin 1s linear infinite'}}/></div>
      ) : (
        <div className="wt-lead-grid">
          {list.map(l => (
            <div key={l._id} className="wt-lead-card">
              <div className="wt-lead-card-head">
                <div>
                  <div className="wt-lead-name">{l.name || l.phone}</div>
                  <div className="wt-lead-phone">{l.phone}</div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'0.25rem',alignItems:'flex-end'}}>
                  {statusBadge(l.status)}
                  {l.ticket_status && l.ticket_status !== 'open' && statusBadge(l.ticket_status)}
                </div>
              </div>

              {l.status === 'follow-up' && (
                <LeadFollowUpRow lead={l} onUpdate={updateLead}/>
              )}
              {l.follow_up_date && l.status !== 'follow-up' && (
                <div style={{fontSize:'0.75rem',color:'#f59e0b',marginBottom:'0.4rem'}}>
                  <CalendarClock size={11} style={{verticalAlign:'middle',marginRight:4}}/>
                  Follow-up: {l.follow_up_date} {l.follow_up_time || ''}
                </div>
              )}

              {l.notes && (
                <div style={{fontSize:'0.78rem',color:'#f59e0b',background:'rgba(245,158,11,0.08)',padding:'0.4rem 0.6rem',borderRadius:7,marginBottom:'0.5rem'}}>
                  <StickyNote size={10} style={{verticalAlign:'middle',marginRight:4}}/> {l.notes}
                </div>
              )}

              <div className="wt-lead-footer">
                <div style={{display:'flex',gap:'0.3rem',flexWrap:'wrap'}}>
                  {(l.tags||[]).map(t=><span key={t} className="wt-badge blue" style={{fontSize:'0.68rem'}}>{t}</span>)}
                </div>
                <span>{timeAgo(l.updatedAt)}</span>
              </div>

              <div style={{display:'flex',gap:'0.4rem',marginTop:'0.75rem',flexWrap:'wrap'}}>
                <select
                  className="wt-select"
                  style={{padding:'0.25rem 0.5rem',fontSize:'0.72rem',flex:1}}
                  value={l.status}
                  onChange={e => updateLead(l._id, { status: e.target.value })}
                >
                  {LEAD_STATUSES.map(s => <option key={s} value={s}>{s.replace('-',' ')}</option>)}
                </select>
                {onOpenChat && l.phone && (
                  <button className="wt-btn wt-btn-sm wt-btn-primary" style={{marginLeft:'auto'}}
                    onClick={() => onOpenChat({ chatId: null, name: l.name || l.phone, phone: l.phone })}>
                    <MessageCircle size={11}/> Chat
                  </button>
                )}
              </div>
            </div>
          ))}
          {list.length === 0 && !loading.leads && (
            <div className="wt-empty" style={{gridColumn:'1/-1'}}>No leads found.</div>
          )}
        </div>
      )}
    </>
  );
}

// ── Contacts ──────────────────────────────────────────────────────────────
function ContactsModule({ contacts, loading, fetchContacts }) {
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilter] = useState('all');

  useEffect(() => { fetchContacts(); }, []);

  const handleSearch = () => fetchContacts(`?search=${encodeURIComponent(search)}&status=${filterStatus}`);

  const exportCSV = () => {
    const rows = [['Name','Phone','Status','Tags','Last Contact']];
    (contacts || []).forEach((c) => rows.push([c.name, c.phone, c.leadStatus||'', (c.tags||[]).join(';'), c.lastContact||'']));
    const csv = rows.map((r)=>r.map((v)=>`"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'whatsapp_contacts.csv';
    a.click();
  };

  const list = contacts || [];

  return (
    <>
      <div className="wt-page-header">
        <div><h1 className="wt-page-title">Contact Management</h1><p className="wt-page-subtitle">{list.length} contacts synced from WhatsApp</p></div>
        <div className="wt-header-actions">
          <button className="wt-btn wt-btn-ghost" onClick={exportCSV}><Download size={14}/> CSV</button>
          <button className="wt-btn wt-btn-ghost" onClick={() => fetchContacts()}><RefreshCw size={14} className={loading.contacts?'spin':''}/></button>
        </div>
      </div>
      <div className="wt-filter-bar">
        <div className="wt-search-wrap">
          <Search size={15}/>
          <input className="wt-search-input" placeholder="Search name or number…" value={search} onChange={(e)=>setSearch(e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&handleSearch()}/>
        </div>
        <select className="wt-select" value={filterStatus} onChange={(e)=>setFilter(e.target.value)}>
          <option value="all">All</option><option value="hot">Hot Lead</option><option value="follow-up">Follow-up</option>
          <option value="vip">VIP</option><option value="closed">Closed</option>
        </select>
        <button className="wt-btn wt-btn-ghost" onClick={handleSearch}><Search size={13}/></button>
      </div>
      <div className="wt-table-wrap">
        <div className="wt-table-header"><h3 className="wt-table-title">Contacts ({list.length})</h3></div>
        {loading.contacts && !list.length ? (
          <div className="wt-empty"><Loader2 size={20} style={{animation:'spin 1s linear infinite'}}/></div>
        ) : (
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Status</th><th>Tags</th><th>Last Contact</th><th>Action</th></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.phone}>
                  <td><strong>{c.name || c.pushname || c.phone}</strong></td>
                  <td style={{color:'var(--text-secondary)',fontSize:'0.82rem'}}>{c.phone}</td>
                  <td>{c.leadStatus ? statusBadge(c.leadStatus) : <span className="wt-badge gray">—</span>}</td>
                  <td>{(c.tags||[]).map((t)=><span key={t} className="wt-badge blue" style={{marginRight:4,fontSize:'0.68rem'}}>{t}</span>)}</td>
                  <td style={{color:'var(--text-secondary)',fontSize:'0.82rem'}}>{timeAgo(c.lastContact)}</td>
                  <td>
                    <a href={`https://wa.me/${normalizePhone(c.phone)}`} target="_blank" rel="noopener noreferrer" className="wt-btn wt-btn-sm wt-btn-ghost" style={{textDecoration:'none'}}>
                      <MessageCircle size={12}/>
                    </a>
                  </td>
                </tr>
              ))}
              {list.length===0&&!loading.contacts && <tr><td colSpan={6} style={{textAlign:'center',padding:'2rem',color:'var(--text-secondary)'}}>No contacts synced yet.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ── Chat Search ───────────────────────────────────────────────────────────
function ChatSearchModule({ searchResults, loading, fetchSearch }) {
  const [query, setQuery]   = useState('');
  const [agent]             = useState('');
  const [dateFrom, setFrom] = useState('');
  const [dateTo, setTo]     = useState('');

  const doSearch = () => {
    if (!query) return;
    fetchSearch(query, `&agent=${agent}&dateFrom=${dateFrom}&dateTo=${dateTo}`);
  };

  const results = searchResults || [];

  return (
    <>
      <div className="wt-page-header">
        <div><h1 className="wt-page-title">Chat Search</h1><p className="wt-page-subtitle">Full-text search across all synced conversations</p></div>
      </div>
      <div style={{background:'rgba(15,15,25,0.7)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:14,padding:'1.25rem',marginBottom:'1.25rem'}}>
        <div className="wt-filter-bar" style={{marginBottom:'0.75rem'}}>
          <div className="wt-search-wrap" style={{flex:1,maxWidth:500}}>
            <Search size={15}/>
            <input className="wt-search-input" placeholder="Search by keyword, e.g. 'discount', 'invoice'…" value={query} onChange={(e)=>setQuery(e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&doSearch()}/>
          </div>
          <button className="wt-btn wt-btn-primary" onClick={doSearch} disabled={!query}><Search size={13}/> Search</button>
        </div>
        <div style={{display:'flex',gap:'0.6rem',flexWrap:'wrap'}}>
          <input type="date" className="wt-select" value={dateFrom} onChange={(e)=>setFrom(e.target.value)} title="From date"/>
          <input type="date" className="wt-select" value={dateTo}   onChange={(e)=>setTo(e.target.value)}   title="To date"/>
        </div>
        <div style={{marginTop:'0.75rem',display:'flex',gap:'0.4rem',flexWrap:'wrap',alignItems:'center'}}>
          <span style={{fontSize:'0.78rem',color:'var(--text-secondary)'}}>Quick:</span>
          {['discount','invoice','complaint','delivery','refund'].map((t) => (
            <button key={t} className="wt-badge blue" style={{cursor:'pointer',border:'none',background:'rgba(59,130,246,0.12)'}} onClick={() => { setQuery(t); setTimeout(()=>fetchSearch(t),0); }}>{t}</button>
          ))}
        </div>
      </div>
      {loading.searchResults ? (
        <div className="wt-empty"><Loader2 size={24} style={{animation:'spin 1s linear infinite'}}/></div>
      ) : (
        <div className="wt-search-results">
          {results.map((m) => (
            <div key={m._id} className="wt-chat-result">
              <div className="wt-chat-result-head">
                <span className="wt-chat-result-name">{m.chatName || m.from}</span>
                <span style={{fontSize:'0.78rem',color:'var(--text-secondary)'}}>{new Date(m.timestamp).toLocaleDateString()}</span>
              </div>
              <div className="wt-chat-result-msg">{m.body}</div>
              <div style={{marginTop:'0.5rem',display:'flex',gap:'0.5rem',alignItems:'center',fontSize:'0.75rem',color:'var(--text-secondary)'}}>
                <span>{m.from}</span>
                {m.responseTime && <span className="wt-badge green" style={{fontSize:'0.65rem'}}>Replied in {fmtSeconds(m.responseTime)}</span>}
                {m.isFromMe && <span className="wt-badge blue" style={{fontSize:'0.65rem'}}>Agent</span>}
              </div>
            </div>
          ))}
          {!results.length && query && !loading.searchResults && <div className="wt-empty">No results for &quot;{query}&quot;</div>}
          {!results.length && !query && <div className="wt-empty">Enter a keyword to search across your WhatsApp conversations.</div>}
        </div>
      )}
    </>
  );
}

// ── Reports ───────────────────────────────────────────────────────────────
function ReportsModule() {
  const reports = [
    { title:'Daily Team Report',    desc:'Agent activity, chats handled, response times for today',  icon: Activity,      color:'#6366f1', bg:'rgba(99,102,241,0.12)' },
    { title:'Weekly Performance',   desc:'SLA compliance, QA scores, and team trends for the week',  icon: BarChart2,     color:'#25d366', bg:'rgba(37,211,102,0.12)' },
    { title:'Monthly SLA Report',   desc:'Full SLA breakdown, breach analysis, recommendations',     icon: ShieldCheck,   color:'#f59e0b', bg:'rgba(245,158,11,0.12)' },
    { title:'Agent Efficiency',     desc:'Individual agent metrics — speed, volume, QA score',       icon: UserCheck,     color:'#8b5cf6', bg:'rgba(139,92,246,0.12)' },
    { title:'Pending Chat Report',  desc:'All unanswered and SLA-breached conversations',            icon: Clock,         color:'#ef4444', bg:'rgba(239,68,68,0.12)'  },
    { title:'Missed Lead Report',   desc:'Leads that went unreplied or were never followed up',      icon: AlertTriangle, color:'#fb923c', bg:'rgba(249,115,22,0.12)' },
    { title:'Contact Export',       desc:'All contacts with status, tags, and last interaction',     icon: Users,         color:'#14b8a6', bg:'rgba(20,184,166,0.12)' },
    { title:'Chat Log Export',      desc:'Full conversation history with timestamps',                icon: MessageCircle, color:'#3b82f6', bg:'rgba(59,130,246,0.12)' },
  ];
  const download = (title) => {
    const csv = `Report,Date\n${title},${new Date().toLocaleDateString()}`;
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = title.replace(/\s+/g,'_').toLowerCase() + '.csv';
    a.click();
  };
  return (
    <>
      <div className="wt-page-header">
        <div><h1 className="wt-page-title">Downloadable Reports</h1><p className="wt-page-subtitle">Export PDF, Excel, or CSV from real session data</p></div>
        <select className="wt-select"><option>Last 7 Days</option><option>Last 30 Days</option><option>This Month</option></select>
      </div>
      <div className="wt-reports-grid">
        {reports.map((r) => (
          <div key={r.title} className="wt-report-card">
            <div className="wt-report-icon" style={{background:r.bg}}><r.icon size={22} color={r.color}/></div>
            <h4 className="wt-report-title">{r.title}</h4>
            <p className="wt-report-desc">{r.desc}</p>
            <div className="wt-report-actions">
              <button className="wt-btn wt-btn-sm wt-btn-ghost" onClick={()=>download(r.title)}><FileSpreadsheet size={12}/> CSV</button>
              <button className="wt-btn wt-btn-sm wt-btn-ghost"><FileText size={12}/> PDF</button>
              <button className="wt-btn wt-btn-sm wt-btn-primary" style={{marginLeft:'auto'}} onClick={()=>download(r.title)}><Download size={12}/> Download</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Notifications ─────────────────────────────────────────────────────────
function NotificationsModule({ notifications, loading, fetchNotifs }) {
  useEffect(() => { fetchNotifs(); }, []);

  const notifs = notifications || [];
  const iconMap = {
    critical: { icon: AlertTriangle, color:'#ef4444', bg:'rgba(239,68,68,0.12)' },
    warning:  { icon: Clock,         color:'#f59e0b', bg:'rgba(245,158,11,0.12)' },
    info:     { icon: Bell,          color:'#6366f1', bg:'rgba(99,102,241,0.12)' },
    success:  { icon: CheckCircle,   color:'#25d366', bg:'rgba(37,211,102,0.12)' },
  };

  return (
    <>
      <div className="wt-page-header">
        <div><h1 className="wt-page-title">Notification Center</h1><p className="wt-page-subtitle">SLA breaches, missed leads, and system alerts — from live data</p></div>
        <button className="wt-btn wt-btn-ghost" onClick={fetchNotifs}><RefreshCw size={14} className={loading.notifications?'spin':''}/> Refresh</button>
      </div>
      {loading.notifications && !notifs.length ? (
        <div className="wt-empty"><Loader2 size={24} style={{animation:'spin 1s linear infinite'}}/></div>
      ) : (
        <div className="wt-notif-list">
          {notifs.map((n, i) => {
            const { icon: Icon, color, bg } = iconMap[n.type] || iconMap.info;
            return (
              <div key={i} className={`wt-notif-item ${n.type === 'critical' ? 'critical' : 'unread'}`}>
                <div className="wt-notif-icon" style={{background:bg}}><Icon size={16} color={color}/></div>
                <div className="wt-notif-body">
                  <div className="wt-notif-title">{n.title}</div>
                  <div className="wt-notif-desc">{n.desc}</div>
                </div>
                <span className="wt-notif-time">{timeAgo(n.time)}</span>
              </div>
            );
          })}
          {notifs.length === 0 && <div className="wt-empty">No active alerts. All SLA targets are being met.</div>}
        </div>
      )}
    </>
  );
}

// ── Main Workspace ────────────────────────────────────────────────────────
function ChatList({ chats, activeChatId, search, setSearch, onSelect, loading, fetchChats }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (chats || []).filter((chat) => !q || [chat.name, chat.phone, chat.lastMessage].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [chats, search]);

  return (
    <section className="wt-chat-list-panel">
      <div className="wt-chat-list-head">
        <div><h2>Chats</h2><span>{filtered.length} synced conversations</span></div>
        <button className="wt-icon-btn" title="Refresh chats" onClick={() => fetchChats()}><RefreshCw size={17} className={loading.chats ? 'spin' : ''}/></button>
      </div>
      <div className="wt-chat-search"><Search size={15}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search or start a chat"/></div>
      <div className="wt-chat-list">
        {filtered.map((chat) => (
          <button key={chat.chatId} className={`wt-chat-row ${activeChatId === chat.chatId ? 'active' : ''}`} onClick={() => onSelect(chat)}>
            <div className={`wt-chat-avatar ${chat.isGroup ? 'group' : ''}`}>{chat.isGroup ? <Users size={18}/> : initials(chat.name || chat.phone)}</div>
            <div className="wt-chat-row-main">
              <div className="wt-chat-row-top"><strong>{chat.name || chat.phone || 'Unknown chat'}</strong><span>{chatTime(chat.lastMessageTime)}</span></div>
              <div className="wt-chat-row-bottom"><span>{chat.lastMessageIsFromMe ? 'You: ' : ''}{shortMessage(chat.lastMessage)}</span>{(chat.unreadCount || 0) > 0 && <em>{chat.unreadCount}</em>}</div>
            </div>
          </button>
        ))}
        {loading.chats && !filtered.length && <div className="wt-chat-empty"><Loader2 className="spin" size={22}/> Loading chats...</div>}
        {!loading.chats && !filtered.length && <div className="wt-chat-empty"><Inbox size={24}/> No chats synced yet.</div>}
      </div>
    </section>
  );
}

function MediaRenderer({ message }) {
  if (!message.hasMedia && message.type === 'chat') return null;
  if (message.mediaUrl && String(message.type || '').includes('image')) {
    return <img className="wt-media-image" src={message.mediaUrl} alt="WhatsApp media"/>;
  }
  const type = String(message.type || '').toLowerCase();
  const Icon = type.includes('image') ? ImageIcon : type.includes('video') ? Video : File;
  return <div className="wt-media-tile"><Icon size={18}/><span>{type || 'media'} attachment</span></div>;
}

function MessageBubble({ message, isGroup }) {
  return (
    <div className={`wt-message-line ${message.isFromMe ? 'out' : 'in'}`}>
      <div className="wt-message-bubble">
        {isGroup && !message.isFromMe && <span className="wt-message-sender">{message.senderName || message.author || 'Group participant'}</span>}
        {message.quotedMessage?.body && <div className="wt-quoted-bubble">{message.quotedMessage.body}</div>}
        <MediaRenderer message={message}/>
        {message.body && <p>{message.body}</p>}
        <span className="wt-message-meta">{chatTime(message.timestamp)}{message.isFromMe && <CheckCheck size={13} className={message.ack >= 2 ? 'read' : ''}/>}</span>
      </div>
    </div>
  );
}

function MessageComposer({ disabled, onSend }) {
  const [text, setText] = useState('');
  const submit = async () => {
    const body = text.trim();
    if (!body || disabled) return;
    setText('');
    await onSend(body);
  };
  return (
    <div className="wt-composer">
      <button className="wt-icon-btn" title="Emoji"><Smile size={18}/></button>
      <button className="wt-icon-btn" title="Attach media"><Paperclip size={18}/></button>
      <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} disabled={disabled} placeholder={disabled ? 'Select a synced chat to reply' : 'Type a message'}/>
      <button className="wt-icon-btn wt-send-btn" title={text.trim() ? 'Send' : 'Voice note'} onClick={text.trim() ? submit : undefined} disabled={disabled}>{text.trim() ? <Send size={18}/> : <Mic size={18}/>}</button>
    </div>
  );
}

function ChatWindow({ activeChat, messages, loading, onSend, onLoadOlder }) {
  if (!activeChat) {
    return <section className="wt-chat-window wt-chat-placeholder"><MessageCircle size={42}/><h2>WhatsApp Operations Workspace</h2><p>Select a live synced conversation to view messages, reply, and monitor QA context in one place.</p></section>;
  }
  return (
    <section className="wt-chat-window">
      <header className="wt-chat-window-head">
        <div className={`wt-chat-avatar large ${activeChat.isGroup ? 'group' : ''}`}>{activeChat.isGroup ? <Users size={21}/> : initials(activeChat.name || activeChat.phone)}</div>
        <div className="wt-chat-title"><strong>{activeChat.name || activeChat.phone}</strong><span>{activeChat.isGroup ? 'Group conversation' : activeChat.phone || 'WhatsApp contact'}</span></div>
        <div className="wt-chat-actions"><button className="wt-icon-btn" title="Contact info"><Info size={18}/></button><button className="wt-icon-btn" title="More"><MoreVertical size={18}/></button></div>
      </header>
      <div className="wt-message-thread">
        {loading ? <div className="wt-chat-empty"><Loader2 className="spin" size={24}/> Loading messages...</div> : <>
          {(messages || []).length > 0 && <button className="wt-load-older" onClick={onLoadOlder}>Load older messages</button>}
          {(messages || []).map((message) => <MessageBubble key={message.messageId} message={message} isGroup={activeChat.isGroup}/>)}
          {(!messages || messages.length === 0) && <div className="wt-chat-empty">No local messages yet. New events will appear here.</div>}
        </>}
      </div>
      <MessageComposer disabled={!activeChat} onSend={onSend}/>
    </section>
  );
}

function ConversationInsights({ chat, analytics, qaQueue, leads, data, updateTicket, createNote, fetchNotes }) {
  const matchingLead = leads?.find((l) => l.phone && chat?.phone && normalizePhone(l.phone) === normalizePhone(chat.phone));
  const qaItem  = qaQueue?.find((q) => q.chatId === chat?.chatId);
  const a       = analytics || {};
  const chatId  = chat?.chatId;

  const [noteText,     setNoteText]     = useState('');
  const [savingNote,   setSavingNote]   = useState(false);
  const [ticketSaving, setTicketSaving] = useState(false);
  const [agentInput,   setAgentInput]   = useState('');

  const notes = data?.notesByChat?.[chatId] || [];

  useEffect(() => { if (chatId) fetchNotes(chatId); }, [chatId]);
  useEffect(() => { setAgentInput(chat?.assignedTo || ''); }, [chat?.assignedTo]);

  const handleTicketChange = async (s) => {
    if (!chatId) return;
    setTicketSaving(true);
    try { await updateTicket(chatId, { ticketStatus: s }); } finally { setTicketSaving(false); }
  };

  const handleAssign = async () => {
    if (!chatId) return;
    await updateTicket(chatId, { assignedTo: agentInput });
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !chatId) return;
    setSavingNote(true);
    try { await createNote(chatId, noteText.trim()); setNoteText(''); } finally { setSavingNote(false); }
  };

  const ticketStatus   = chat?.ticketStatus || qaItem?.ticketStatus || 'open';
  const TICKET_OPTIONS = ['open', 'in-progress', 'resolved', 'closed'];

  if (!chat) {
    return (
      <aside className="wt-insights-panel">
        <div className="wt-insights-head"><PanelRight size={17}/><strong>Operations</strong></div>
        <div style={{padding:'2rem 0.5rem',textAlign:'center',fontSize:'0.8rem',color:'var(--text-secondary)'}}>Select a conversation to view operations context.</div>
      </aside>
    );
  }

  return (
    <aside className="wt-insights-panel">
      <div className="wt-insights-head"><PanelRight size={17}/><strong>Operations</strong></div>

      {/* Ticket Status */}
      <div className="wt-insight-card">
        <span className="wt-insight-label"><Ticket size={12} style={{verticalAlign:'middle',marginRight:4}}/>Ticket Status</span>
        <div className="wt-ticket-chips">
          {TICKET_OPTIONS.map(s => (
            <button key={s} className={`wt-ticket-chip ${ticketStatus === s ? 'active' : ''}`}
              onClick={() => handleTicketChange(s)} disabled={ticketSaving}>
              {s.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Waiting / SLA */}
      <div className="wt-insight-card">
        <span className="wt-insight-label"><Clock size={12} style={{verticalAlign:'middle',marginRight:4}}/>Waiting Time</span>
        <div className="wt-insight-row" style={{gap:'0.5rem'}}>
          <Timer size={14} color="#f59e0b"/>
          <strong style={{color: qaItem?.slaStatus==='breached' ? '#f87171' : qaItem?.slaStatus==='warning' ? '#fb923c' : '#4ade80'}}>
            {fmtWaiting(chat?.waitingMinutes)}
          </strong>
          {statusBadge(qaItem?.slaStatus || chat?.slaStatus || 'ok')}
        </div>
      </div>

      {/* Agent Assignment */}
      <div className="wt-insight-card">
        <span className="wt-insight-label"><UserCog size={12} style={{verticalAlign:'middle',marginRight:4}}/>Assigned Agent</span>
        <div className="wt-assign-row">
          <input className="wt-select" style={{flex:1,padding:'0.3rem 0.5rem',fontSize:'0.78rem'}}
            value={agentInput} onChange={e => setAgentInput(e.target.value)}
            placeholder="Agent name…" onKeyDown={e => e.key==='Enter' && handleAssign()}/>
          <button className="wt-btn wt-btn-sm wt-btn-ghost" onClick={handleAssign}><CheckCircle size={12}/></button>
        </div>
      </div>

      {/* Lead Profile */}
      <div className="wt-insight-card">
        <span className="wt-insight-label"><User size={12} style={{verticalAlign:'middle',marginRight:4}}/>Lead Profile</span>
        <div className="wt-lead-mini">
          <User size={16}/>
          <div>
            <strong>{matchingLead?.name || chat?.name || 'Unclassified'}</strong>
            <span>{matchingLead?.status ? statusBadge(matchingLead.status) : statusBadge('new')}</span>
          </div>
        </div>
        {matchingLead?.follow_up_date && (
          <div style={{fontSize:'0.74rem',color:'#f59e0b',marginTop:'0.35rem'}}>
            <CalendarClock size={11} style={{verticalAlign:'middle',marginRight:3}}/>
            Follow-up: {matchingLead.follow_up_date} {matchingLead.follow_up_time || ''}
          </div>
        )}
        {matchingLead?.notes && <p style={{fontSize:'0.78rem',color:'var(--text-secondary)',margin:'0.3rem 0 0'}}>{matchingLead.notes}</p>}
        {!matchingLead && <p style={{fontSize:'0.78rem',color:'var(--text-secondary)',margin:'0.3rem 0 0'}}>No lead profile attached.</p>}
      </div>

      {/* QA Score */}
      <div className="wt-insight-card">
        <span className="wt-insight-label">Conversation QA</span>
        <div className="wt-insight-score" style={{color:scoreColor(a.qaScore||100)}}>{a.qaScore??100}%</div>
        <div className="wt-score-bar"><div className="wt-score-bar-fill" style={{width:`${a.qaScore??100}%`,background:scoreColor(a.qaScore||100)}}/></div>
      </div>

      {/* Internal Notes */}
      <div className="wt-insight-card">
        <span className="wt-insight-label"><StickyNote size={12} style={{verticalAlign:'middle',marginRight:4}}/>Internal Notes</span>
        <div className="wt-notes-list">
          {notes.length === 0 && <div style={{fontSize:'0.76rem',color:'var(--text-secondary)'}}>No notes yet.</div>}
          {notes.map((n, i) => (
            <div key={n.id || i} className="wt-note-item">
              <div className="wt-note-meta">
                {n.agent || 'Agent'} · {n.created_at ? new Date(n.created_at * 1000).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : ''}
              </div>
              <div className="wt-note-body">{n.body}</div>
            </div>
          ))}
        </div>
        <div className="wt-notes-composer">
          <textarea className="wt-notes-textarea" rows={2}
            value={noteText} onChange={e => setNoteText(e.target.value)}
            placeholder="Add internal note (agents only)…"
            onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}/>
          <button className="wt-btn wt-btn-sm wt-btn-primary" onClick={handleAddNote} disabled={savingNote || !noteText.trim()}>
            {savingNote ? <Loader2 size={11} className="spin"/> : <Send size={11}/>} Add
          </button>
        </div>
      </div>
    </aside>
  );
}

function WorkspaceModule({ data, loading, fetchChats, fetchMessages, sendMessage,
                            updateTicket, createNote, fetchNotes,
                            externalChatId, setExternalChatId }) {
  const [localChatId, setLocalChatId] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => { fetchChats(); }, [fetchChats]);

  const activeChatId = externalChatId || localChatId;

  const setActiveChatId = useCallback((id) => {
    setLocalChatId(id);
    setExternalChatId?.(id);
  }, [setExternalChatId]);

  const activeChat = useMemo(() => data.chats?.find((chat) => chat.chatId === activeChatId) || null, [data.chats, activeChatId]);

  useEffect(() => {
    if (activeChat?.chatId && !data.messagesByChat?.[activeChat.chatId]) fetchMessages(activeChat.chatId);
  }, [activeChat?.chatId, data.messagesByChat, fetchMessages]);

  const selectChat = useCallback((chat) => {
    setActiveChatId(chat.chatId);
    if (!data.messagesByChat?.[chat.chatId]) fetchMessages(chat.chatId);
  }, [data.messagesByChat, fetchMessages, setActiveChatId]);

  const send = useCallback((body) => sendMessage(activeChat?.chatId, body), [activeChat?.chatId, sendMessage]);

  const loadOlder = useCallback(() => {
    const first = data.messagesByChat?.[activeChat?.chatId]?.[0];
    if (activeChat?.chatId && first?.timestamp) {
      fetchMessages(activeChat.chatId, { hydrate:false, before:first.timestamp, limit:80 });
    }
  }, [activeChat?.chatId, data.messagesByChat, fetchMessages]);

  const activeMessages = activeChat ? (data.messagesByChat?.[activeChat.chatId] || []) : [];

  return (
    <div className="wt-live-workspace">
      <ChatList chats={data.chats} activeChatId={activeChat?.chatId} search={search} setSearch={setSearch} onSelect={selectChat} loading={loading} fetchChats={fetchChats}/>
      <ChatWindow activeChat={activeChat} messages={activeMessages} loading={!!loading[`messages:${activeChat?.chatId}`]} onSend={send} onLoadOlder={loadOlder}/>
      <ConversationInsights
        chat={activeChat} analytics={data.analytics} qaQueue={data.qaQueue}
        leads={data.leads} data={data}
        updateTicket={updateTicket} createNote={createNote} fetchNotes={fetchNotes}
      />
    </div>
  );
}

const MODULES = [
  { id:'workspace',     label:'Workspace',      icon:MessageSquare,    section:'Overview',   badge:null },
  { id:'dashboard',     label:'Dashboard',      icon:LayoutDashboard, section:'Overview',   badge:null },
  { id:'link-creator',  label:'Link Creator',   icon:LinkIcon,         section:'Tools',      badge:null },
  { id:'qa',            label:'QA Monitor',     icon:ShieldCheck,     section:'Operations', badge:'qa' },
  { id:'analytics',     label:'Analytics',      icon:BarChart2,        section:'Operations', badge:null },
  { id:'leads',         label:'Leads',          icon:Target,           section:'Operations', badge:'leads' },
  { id:'contacts',      label:'Contacts',       icon:Phone,            section:'Data',       badge:null },
  { id:'chat-search',   label:'Chat Search',    icon:Search,           section:'Data',       badge:null },
  { id:'reports',       label:'Reports',        icon:Download,         section:'Data',       badge:null },
  { id:'notifications', label:'Notifications',  icon:Bell,             section:'System',     badge:'notifs' },
];
const SECTIONS = ['Overview','Tools','Operations','Data','System'];

const WhatsAppTools = () => {
  const [active, setActive]               = useState('workspace');
  const [activeChatId, setActiveChatId]   = useState('');
  const wa = useWhatsApp();
  const { sessionState, serviceReachable, data, loading, reconnectSession,
          fetchChats, fetchContacts, fetchAnalytics, fetchLeads, fetchQaQueue, fetchNotifs, fetchSearch,
          fetchMessages, sendMessage, createLead, updateLead,
          updateTicket, createNote, fetchNotes } = wa;

  const isReady = sessionState.status === 'ready';

  // Cross-module "open in workspace" navigation
  const onOpenChat = useCallback(({ chatId, name, phone }) => {
    setActive('workspace');
    if (chatId) {
      setActiveChatId(chatId);
    } else if (phone) {
      const match = data.chats?.find(c => c.phone && normalizePhone(c.phone) === normalizePhone(phone));
      if (match) setActiveChatId(match.chatId);
    }
  }, [data.chats]);

  // Badge counts
  const qaBadge    = useMemo(() => data.qaQueue?.filter((c) => c.slaStatus !== 'ok').length || 0, [data.qaQueue]);
  const leadBadge  = useMemo(() => data.leads?.filter((l) => l.status === 'hot').length || 0,     [data.leads]);
  const notifBadge = useMemo(() => data.notifications?.filter((n) => n.type === 'critical').length || 0, [data.notifications]);

  const getBadge = (b) => {
    if (b === 'qa')     return qaBadge;
    if (b === 'leads')  return leadBadge;
    if (b === 'notifs') return notifBadge;
    return 0;
  };

  const renderModule = () => {
    if (!isReady && active !== 'link-creator') {
      return <ConnectionPanel sessionState={sessionState} serviceReachable={serviceReachable} reconnectSession={reconnectSession}/>;
    }
    switch (active) {
      case 'workspace':     return <WorkspaceModule data={data} loading={loading} fetchChats={fetchChats} fetchMessages={fetchMessages} sendMessage={sendMessage} updateTicket={updateTicket} createNote={createNote} fetchNotes={fetchNotes} externalChatId={activeChatId} setExternalChatId={setActiveChatId}/>;
      case 'dashboard':     return <DashboardModule analytics={data.analytics} loading={loading} onNavigate={setActive} fetchAnalytics={fetchAnalytics}/>;
      case 'link-creator':  return <LinkCreatorModule/>;
      case 'qa':            return <QAModule qaQueue={data.qaQueue} loading={loading} fetchQaQueue={fetchQaQueue} onOpenChat={onOpenChat}/>;
      case 'analytics':     return <AnalyticsModule analytics={data.analytics} loading={loading} fetchAnalytics={fetchAnalytics}/>;
      case 'leads':         return <LeadsModule leads={data.leads} loading={loading} fetchLeads={fetchLeads} createLead={createLead} updateLead={updateLead} onOpenChat={onOpenChat}/>;
      case 'contacts':      return <ContactsModule contacts={data.contacts} loading={loading} fetchContacts={fetchContacts}/>;
      case 'chat-search':   return <ChatSearchModule searchResults={data.searchResults} loading={loading} fetchSearch={fetchSearch}/>;
      case 'reports':       return <ReportsModule/>;
      case 'notifications': return <NotificationsModule notifications={data.notifications} loading={loading} fetchNotifs={fetchNotifs}/>;
      default:              return null;
    }
  };

  const statusDot = isReady ? 'online' : sessionState.status === 'qr' ? 'busy' : 'offline';

  return (
    <div className="wt-workspace">
      {/* Sidebar */}
      <aside className="wt-sidebar">
        <div className="wt-sidebar-brand">
          <div className="wt-sidebar-brand-icon"><MessageCircle size={18}/></div>
          <div className="wt-sidebar-brand-text">
            <strong>WhatsApp Tools</strong>
            <span style={{display:'flex',alignItems:'center',gap:4}}>
              <span className={`wt-status-dot ${statusDot}`}/>
              {isReady ? 'Connected' : sessionState.status === 'qr' ? 'Scan QR' : sessionState.status}
            </span>
          </div>
        </div>

        {!isReady && (
          <div style={{margin:'0 0.5rem 0.75rem',padding:'0.75rem',background:'rgba(37,211,102,0.05)',border:'1px solid rgba(37,211,102,0.15)',borderRadius:10,fontSize:'0.78rem',color:'var(--text-secondary)'}}>
            {sessionState.status === 'qr'
              ? '📱 Scan the QR code to connect'
              : '⚡ Connect WhatsApp to see live data'}
            <button className="wt-btn wt-btn-sm wt-btn-primary" style={{marginTop:'0.5rem',width:'100%',justifyContent:'center'}} onClick={()=>setActive('dashboard')}>
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
                  <button key={m.id} className={`wt-nav-item ${active===m.id?'active':''}`} onClick={()=>setActive(m.id)}>
                    <m.icon size={15}/>{m.label}
                    {count > 0 && <span className="wt-nav-badge">{count}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}

        {isReady && (
          <div style={{marginTop:'auto',padding:'0.75rem 0.5rem 0'}}>
            <button className="wt-btn wt-btn-sm wt-btn-danger" style={{width:'100%',justifyContent:'center'}} onClick={wa.disconnectSession}>
              <WifiOff size={12}/> Disconnect
            </button>
          </div>
        )}
      </aside>

      {/* Main */}
      <main className="wt-content">
        {/* Mobile nav */}
        <div className="wt-mobile-nav">
          {MODULES.map((m) => (
            <button key={m.id} className={`wt-mobile-nav-item ${active===m.id?'active':''}`} onClick={()=>setActive(m.id)}>
              <m.icon size={18}/>{m.label}
            </button>
          ))}
        </div>

        {renderModule()}
      </main>
    </div>
  );
};

export default WhatsAppTools;

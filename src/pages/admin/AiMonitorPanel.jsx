import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock,
  Zap, Brain, Database, Activity, TrendingUp, ChevronRight,
  Wifi, WifiOff, Server, Globe, Cpu, BarChart2, Shield,
  Layers, Calendar, CalendarDays, Flame,
} from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { useAuth } from '../../context/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const TOOL_META = {
  'text-to-sql':   { label: 'Text-to-SQL',        icon: Database, color: '#6366f1' },
  'transcription': { label: 'Audio Transcription', icon: Activity, color: '#10b981' },
};

const PROVIDER_META = {
  groq:   { color: '#f97316', bg: 'rgba(249,115,22,0.1)',   border: 'rgba(249,115,22,0.25)'   },
  gemini: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',   border: 'rgba(59,130,246,0.25)'   },
  openai: { color: '#10b981', bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.25)'   },
};

// Known free-tier API quotas per provider (daily request limits)
const PROVIDER_QUOTA = {
  groq:   { dailyReq: 14400, tier: 'Free',      note: '14,400 req/day · 6K RPM',          limitType: 'requests' },
  gemini: { dailyReq: 1500,  tier: 'Free',      note: '1,500 req/day · 1M TPM',            limitType: 'requests' },
  openai: { dailyReq: null,  tier: 'Paid',      note: 'Pay-per-use · no daily cap',        limitType: 'cost'     },
};

function fmtLatency(ms) {
  if (ms == null) return '—';
  if (ms < 1000)  return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
function fmtTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleTimeString(); } catch { return '—'; }
}
function fmtNum(n) {
  if (n == null || n === 0) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000)    return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, size = 'md' }) {
  const cfg = {
    ok:           { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)',  label: 'Working',      Icon: CheckCircle  },
    rate_limited: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',  label: 'Rate Limited', Icon: AlertTriangle },
    error:        { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)',   label: 'Error',        Icon: XCircle       },
    no_key:       { color: '#64748b', bg: 'rgba(100,116,139,0.1)',  border: 'rgba(100,116,139,0.2)', label: 'No Key',       Icon: Shield        },
    browser_only: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)',  label: 'Browser Only', Icon: Globe         },
    checking:     { color: '#64748b', bg: 'rgba(100,116,139,0.1)',  border: 'rgba(100,116,139,0.2)', label: 'Checking…',    Icon: RefreshCw     },
  }[status] || { color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.2)', label: status, Icon: AlertTriangle };

  const sz = size === 'sm' ? { dot: 6, font: '.67rem', pad: '.15rem .45rem' }
                           : { dot: 8, font: '.75rem', pad: '.22rem .65rem' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.35rem',
      background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 100,
      padding: sz.pad, fontSize: sz.font, fontWeight: 600, color: cfg.color }}>
      <span style={{ width: sz.dot, height: sz.dot, borderRadius: '50%', background: cfg.color,
        boxShadow: status === 'ok' ? `0 0 6px ${cfg.color}` : 'none',
        animation: status === 'checking' ? 'pulse 1.5s ease-in-out infinite' : 'none' }}/>
      {cfg.label}
    </span>
  );
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────
function ToggleSwitch({ enabled, onChange }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onChange(!enabled); }}
      title={enabled ? 'Click to disable' : 'Click to enable'}
      style={{
        position: 'relative', display: 'inline-flex', alignItems: 'center',
        width: 38, height: 21, borderRadius: 11, border: 'none',
        background: enabled ? '#10b981' : 'rgba(255,255,255,0.1)',
        cursor: 'pointer', padding: 0, flexShrink: 0,
        transition: 'background .2s', boxShadow: enabled ? '0 0 8px rgba(16,185,129,0.4)' : 'none',
      }}>
      <span style={{
        position: 'absolute', left: enabled ? 19 : 2,
        width: 17, height: 17, borderRadius: '50%', background: '#fff',
        transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }}/>
    </button>
  );
}

// ─── Quota Bar ────────────────────────────────────────────────────────────────
function QuotaBar({ used, limit, color }) {
  if (!limit) return null;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : color;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.22rem' }}>
        <span style={{ fontSize: '.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Daily API Quota
        </span>
        <span style={{ fontSize: '.65rem', fontWeight: 700,
          color: pct >= 90 ? '#f87171' : pct >= 70 ? '#fbbf24' : '#94a3b8' }}>
          {fmtNum(used)} / {fmtNum(limit)} · {pct}%
        </span>
      </div>
      <div style={{ height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 4,
          background: pct >= 90
            ? 'linear-gradient(90deg,#ef4444,#dc2626)'
            : pct >= 70
            ? 'linear-gradient(90deg,#f59e0b,#d97706)'
            : `linear-gradient(90deg,${color},${color}bb)`,
          transition: 'width .6s cubic-bezier(.4,0,.2,1)',
          boxShadow: pct > 0 ? `0 0 8px ${barColor}55` : 'none',
        }}/>
      </div>
    </div>
  );
}

// ─── Provider Card ────────────────────────────────────────────────────────────
function ProviderCard({ provider, isDisabled, onToggle, usage }) {
  const meta  = PROVIDER_META[provider.key] || PROVIDER_META.groq;
  const quota = PROVIDER_QUOTA[provider.key] || {};

  const borderColor = isDisabled                          ? 'rgba(255,255,255,0.06)'
                    : provider.status === 'ok'           ? 'rgba(16,185,129,0.35)'
                    : provider.status === 'rate_limited' ? 'rgba(245,158,11,0.35)'
                    : provider.status === 'error'        ? 'rgba(239,68,68,0.35)'
                    : provider.status === 'browser_only' ? 'rgba(139,92,246,0.25)'
                    : 'rgba(255,255,255,0.07)';

  const todayUsed  = usage?.today  ?? 0;
  const weekUsed   = usage?.week   ?? 0;
  const monthUsed  = usage?.month  ?? 0;

  return (
    <div style={{ background: '#0d0d1a', border: `1px solid ${borderColor}`,
      borderRadius: 16, padding: '1.15rem 1.25rem', transition: 'all .2s',
      opacity: isDisabled ? 0.45 : 1, position: 'relative', display: 'flex', flexDirection: 'column', gap: '.75rem' }}>

      {isDisabled && (
        <div style={{ position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)', background: 'rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
          padding: '.2rem .75rem', fontSize: '.72rem', fontWeight: 700,
          color: '#94a3b8', letterSpacing: '.08em', pointerEvents: 'none', zIndex: 1 }}>
          DISABLED
        </div>
      )}

      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: meta.bg,
            border: `1px solid ${meta.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Server size={16} style={{ color: meta.color }}/>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '.9rem', color: '#e2e8f0', lineHeight: 1.2 }}>{provider.name}</div>
            <div style={{ fontSize: '.66rem', color: '#475569', marginTop: '.1rem', fontFamily: 'monospace' }}>{provider.model}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <StatusBadge status={isDisabled ? 'no_key' : provider.status}/>
          <ToggleSwitch enabled={!isDisabled} onChange={() => onToggle(provider.key)}/>
        </div>
      </div>

      {/* ── Role + tier badges ── */}
      <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem',
          background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 7,
          padding: '.18rem .5rem', fontSize: '.67rem', color: meta.color, fontWeight: 600 }}>
          <Zap size={9}/> {provider.role}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem',
          background: quota.tier === 'Free' ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
          border: `1px solid ${quota.tier === 'Free' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
          borderRadius: 7, padding: '.18rem .5rem', fontSize: '.67rem',
          color: quota.tier === 'Free' ? '#34d399' : '#fbbf24', fontWeight: 600 }}>
          {quota.tier === 'Free' ? '✦ Free' : '💳 Paid'}
        </span>
      </div>

      {/* ── Quota bar (only for providers with daily request limits) ── */}
      {quota.dailyReq && (
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10,
          padding: '.6rem .75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
          <QuotaBar used={todayUsed} limit={quota.dailyReq} color={meta.color}/>
          <div style={{ marginTop: '.3rem', fontSize: '.62rem', color: '#334155' }}>
            {quota.note}
          </div>
        </div>
      )}

      {/* ── For pay-per-use or free/unlimited providers ── */}
      {!quota.dailyReq && (
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10,
          padding: '.5rem .75rem', border: '1px solid rgba(255,255,255,0.05)',
          fontSize: '.68rem', color: '#475569' }}>
          {quota.note}
        </div>
      )}

      {/* ── Today / Week / Month usage stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '.35rem' }}>
        {[
          { label: 'Today',    value: fmtNum(todayUsed), Icon: Flame,       color: '#f87171' },
          { label: 'Week',     value: fmtNum(weekUsed),  Icon: CalendarDays, color: '#60a5fa' },
          { label: 'Month',    value: fmtNum(monthUsed), Icon: Calendar,    color: '#a78bfa' },
          { label: 'Latency',  value: fmtLatency(provider.latencyMs), Icon: Activity, color: '#34d399' },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8,
            padding: '.35rem .4rem', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
            <Icon size={11} style={{ color, marginBottom: '.15rem' }}/>
            <div style={{ fontSize: '.8rem', fontWeight: 800, color: '#e2e8f0', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '.58rem', color: '#475569', marginTop: '.12rem',
              textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Last check + error ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '.63rem', color: '#334155' }}>
          Last check: <span style={{ color: '#475569' }}>{fmtTime(provider.checkedAt)}</span>
        </div>
        {provider.status === 'rate_limited' && (
          <span style={{ fontSize: '.63rem', color: '#fbbf24', fontWeight: 600 }}>⚠ Rate limited</span>
        )}
      </div>

      {provider.errorMsg && !isDisabled && (
        <div style={{ background: 'rgba(239,68,68,0.07)',
          border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8,
          padding: '.3rem .6rem', fontSize: '.7rem', color: '#f87171' }}>
          ⚠ {provider.errorMsg}
        </div>
      )}
    </div>
  );
}

// ─── Flow Row ─────────────────────────────────────────────────────────────────
function FlowRow({ label, steps, note }) {
  const colors = { groq: '#f97316', gemini: '#3b82f6', openai: '#10b981' };
  const names  = { groq: 'Groq Llama', gemini: 'Gemini 3.1 Flash Lite', openai: 'OpenAI' };
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12, padding: '.8rem 1rem', display: 'flex', alignItems: 'center',
      gap: '.75rem', flexWrap: 'wrap' }}>
      <div style={{ minWidth: 160, fontSize: '.78rem', fontWeight: 700, color: '#94a3b8' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', flex: 1, flexWrap: 'wrap' }}>
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem',
              background: `${colors[s]}15`, border: `1px solid ${colors[s]}40`,
              borderRadius: 8, padding: '.25rem .65rem', fontSize: '.75rem',
              fontWeight: 700, color: colors[s] }}>
              {i === 0 ? '① ' : i === 1 ? '② ' : '③ '}{names[s]}
            </span>
            {i < steps.length - 1 && <ChevronRight size={13} style={{ color: '#475569', flexShrink: 0 }}/>}
          </React.Fragment>
        ))}
        {steps.length === 1 && (
          <span style={{ fontSize: '.68rem', color: '#475569', marginLeft: '.25rem' }}>exclusive</span>
        )}
      </div>
      {note && <div style={{ fontSize: '.67rem', color: '#475569', fontStyle: 'italic' }}>{note}</div>}
    </div>
  );
}

// ─── Credit Bar (per tool) ────────────────────────────────────────────────────
function CreditBar({ toolId, todayCount, weekCount, monthCount, limit }) {
  const meta  = TOOL_META[toolId] || { label: toolId, icon: Database, color: '#6366f1' };
  const Icon  = meta.icon;
  const pct   = limit ? Math.min(100, Math.round((todayCount / limit) * 100)) : null;
  const barColor = pct == null ? '#6366f1' : pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#10b981';

  return (
    <div style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12, padding: '1rem 1.1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <Icon size={14} style={{ color: meta.color }}/>
          <span style={{ fontSize: '.82rem', fontWeight: 700, color: '#e2e8f0' }}>{meta.label}</span>
        </div>
        {limit && (
          <span style={{ fontSize: '.7rem', color: pct >= 90 ? '#f87171' : '#64748b', fontWeight: 600 }}>
            {todayCount} / {limit} today
          </span>
        )}
      </div>

      {limit && (
        <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden', marginBottom: '.6rem' }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3,
            background: barColor, transition: 'width .5s',
            boxShadow: pct > 0 ? `0 0 6px ${barColor}66` : 'none' }}/>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '.35rem' }}>
        {[
          { label: 'Today',       value: todayCount },
          { label: 'This Week',   value: weekCount  },
          { label: 'This Month',  value: monthCount },
          { label: 'Daily Limit', value: limit ?? '∞' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 7,
            padding: '.3rem .4rem', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
            <div style={{ fontSize: '.58rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
            <div style={{ fontSize: '.88rem', fontWeight: 800, color: '#e2e8f0', marginTop: '.08rem' }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const DISABLED_KEY    = 'ai_disabled_providers';
const LAST_CHECK_KEY  = 'ai_monitor_last_check';
const CACHED_DATA_KEY = 'ai_monitor_cached_data';
const ONE_DAY_MS      = 24 * 60 * 60 * 1000;

function loadDisabled() {
  try { return JSON.parse(localStorage.getItem(DISABLED_KEY) || '[]'); } catch { return []; }
}
function loadCachedData() {
  try { return JSON.parse(localStorage.getItem(CACHED_DATA_KEY) || 'null'); } catch { return null; }
}
function isDueForCheck() {
  try {
    const last = Number(localStorage.getItem(LAST_CHECK_KEY) || 0);
    return Date.now() - last >= ONE_DAY_MS;
  } catch { return true; }
}

export default function AiMonitorPanel() {
  const { token } = useAuth();
  const [data, setData]               = useState(loadCachedData);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [disabled, setDisabled]       = useState(loadDisabled);
  const [lastRefresh, setLastRefresh] = useState(() => {
    try {
      const ts = Number(localStorage.getItem(LAST_CHECK_KEY) || 0);
      return ts ? new Date(ts).toLocaleString() : null;
    } catch { return null; }
  });
  const [nextCheck, setNextCheck] = useState(() => {
    try {
      const last = Number(localStorage.getItem(LAST_CHECK_KEY) || 0);
      return last ? new Date(last + ONE_DAY_MS) : null;
    } catch { return null; }
  });

  const toggleProvider = useCallback((key) => {
    setDisabled(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      localStorage.setItem(DISABLED_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const apiFetch = useCallback((path, opts = {}) =>
    fetch(`${API_BASE_URL}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
    }), [token]);

  const testLatency = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/admin/ai-status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const now  = Date.now();
      setData(prev => prev ? { ...prev, providers: json.providers, credits: json.credits } : json);
      setLastRefresh(new Date(now).toLocaleString());
      localStorage.setItem(CACHED_DATA_KEY, JSON.stringify(
        data ? { ...data, providers: json.providers, credits: json.credits } : json
      ));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, data]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/admin/ai-status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const now  = Date.now();
      setData(json);
      setLastRefresh(new Date(now).toLocaleString());
      setNextCheck(new Date(now + ONE_DAY_MS));
      localStorage.setItem(LAST_CHECK_KEY,  String(now));
      localStorage.setItem(CACHED_DATA_KEY, JSON.stringify(json));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  // Auto-refresh every 24h
  useEffect(() => {
    if (isDueForCheck()) refresh();
    const id = setInterval(() => { if (isDueForCheck()) refresh(); }, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [refresh]);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const providers = data?.providers || [];

  const todayMap  = Object.fromEntries((data?.credits?.today || []).map(r => [r.tool_id, Number(r.total)]));
  const weekMap   = Object.fromEntries((data?.credits?.week  || []).map(r => [r.tool_id, Number(r.total)]));
  const monthMap  = Object.fromEntries((data?.credits?.month || []).map(r => [r.tool_id, Number(r.total)]));
  const limits    = data?.credits?.limits || {};

  // Per-provider AI call usage (tracked by system)
  const providerToday = data?.credits?.providerToday || {};
  const providerWeek  = data?.credits?.providerWeek  || {};
  const providerMonth = data?.credits?.providerMonth || {};

  // Build usage object per provider key
  // Groq also serves transcription + text-to-sql tool calls
  const providerUsage = (key) => {
    const base = {
      today: providerToday[key] || 0,
      week:  providerWeek[key]  || 0,
      month: providerMonth[key] || 0,
    };
    if (key === 'groq') {
      // Add tool-level groq usage (transcription + sql)
      const toolsToday = Object.entries(todayMap)
        .filter(([tid]) => limits[tid]?.provider === 'groq')
        .reduce((s, [, v]) => s + v, 0);
      const toolsWeek  = Object.entries(weekMap)
        .filter(([tid]) => limits[tid]?.provider === 'groq')
        .reduce((s, [, v]) => s + v, 0);
      const toolsMonth = Object.entries(monthMap)
        .filter(([tid]) => limits[tid]?.provider === 'groq')
        .reduce((s, [, v]) => s + v, 0);
      return { today: base.today + toolsToday, week: base.week + toolsWeek, month: base.month + toolsMonth };
    }
    return base;
  };

  const activeProviders = providers.filter(p => !disabled.includes(p.key));
  const workingCount    = activeProviders.filter(p => p.status === 'ok').length;
  const rateLimitedCount = activeProviders.filter(p => p.status === 'rate_limited').length;

  const S = {
    card: { background: '#111122', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '1.25rem 1.5rem' },
    head: { fontSize: '.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '.9rem', display: 'flex', alignItems: 'center', gap: '.4rem' },
    stat: { background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '.85rem 1rem', textAlign: 'center' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin  { to{transform:rotate(360deg)} }
      `}</style>

      {/* ── Top Bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.75rem' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <Brain size={20} style={{ color: '#818cf8' }}/> AI Services Monitor
          </div>
          <div style={{ fontSize: '.78rem', color: '#64748b', marginTop: '.2rem' }}>
            Latency checked once per day · Fallback chain: Gemini → OpenAI → Groq
            {lastRefresh && <span style={{ marginLeft: '.6rem', color: '#475569' }}>Last: {lastRefresh}</span>}
            {nextCheck   && <span style={{ marginLeft: '.6rem', color: '#334155' }}>· Next: {nextCheck.toLocaleString()}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button onClick={testLatency} disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem',
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 9, padding: '.45rem 1rem', cursor: loading ? 'wait' : 'pointer',
              color: '#34d399', fontSize: '.82rem', fontWeight: 600 }}>
            <Activity size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}/>
            {loading ? 'Testing…' : 'Test Latency'}
          </button>
          <button onClick={refresh} disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem',
              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 9, padding: '.45rem 1rem', cursor: loading ? 'wait' : 'pointer',
              color: '#818cf8', fontSize: '.82rem', fontWeight: 600 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}/>
            {loading ? 'Refreshing…' : 'Full Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 10, padding: '.65rem 1rem', fontSize: '.82rem', color: '#f87171' }}>
          ⚠ Failed to load status: {error}
        </div>
      )}

      {/* ── Summary Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '.75rem' }}>
        {[
          { label: 'Total Providers', value: providers.length || 4,        color: '#818cf8', Icon: Server        },
          { label: 'Working',         value: workingCount,                  color: '#10b981', Icon: CheckCircle   },
          { label: 'Disabled',        value: disabled.length,               color: '#64748b', Icon: WifiOff       },
          { label: 'Rate Limited',    value: rateLimitedCount,              color: '#f59e0b', Icon: AlertTriangle },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} style={S.stat}>
            <Icon size={18} style={{ color, margin: '0 auto .4rem' }}/>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#e2e8f0', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '.67rem', color: '#64748b', marginTop: '.2rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Provider Status Cards ── */}
      <div style={S.card}>
        <div style={S.head}><Wifi size={12}/> API Provider Status · Balance & Quota</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: '.9rem' }}>
          {loading && !data
            ? [0,1,2,3].map(i => (
                <div key={i} style={{ height: 240, background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16,
                  animation: 'pulse 1.5s ease-in-out infinite' }}/>
              ))
            : providers.map(p => (
                <ProviderCard
                  key={p.key}
                  provider={p}
                  isDisabled={disabled.includes(p.key)}
                  onToggle={toggleProvider}
                  usage={providerUsage(p.key)}
                />
              ))
          }
        </div>

        {/* Legend */}
        <div style={{ marginTop: '1rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap',
          padding: '.6rem .75rem', background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10 }}>
          <span style={{ fontSize: '.68rem', color: '#475569' }}>
            <span style={{ color: '#f87171' }}>●</span> Quota bar = your app's calls to that provider today vs their free-tier daily limit
          </span>
          <span style={{ fontSize: '.68rem', color: '#475569' }}>
            <span style={{ color: '#34d399' }}>●</span> Server runs full fallback chain — single client request triggers all retries
          </span>
        </div>
      </div>

      {/* ── AI Routing Flow ── */}
      <div style={S.card}>
        <div style={S.head}><TrendingUp size={12}/> AI Routing Flow</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          <FlowRow
            label="General AI Tasks"
            steps={(data?.flow?.general || ['gemini','openai','groq']).filter(s => !disabled.includes(s))}
            note={disabled.some(d => ['gemini','openai','groq'].includes(d)) ? `⚠ ${disabled.filter(d => ['gemini','openai','groq'].includes(d)).join(', ')} disabled` : 'Text, QA, Analysis, Dashboard, Medical'}
          />
          <FlowRow
            label="Text-to-SQL"
            steps={(data?.flow?.textToSql || ['groq']).filter(s => !disabled.includes(s))}
            note={disabled.includes('groq') ? '⚠ Groq disabled — Text-to-SQL unavailable' : 'Uses llama-3.3-70b-versatile exclusively'}
          />
          <FlowRow
            label="Audio Transcription"
            steps={(data?.flow?.transcription || ['groq']).filter(s => !disabled.includes(s))}
            note={disabled.includes('groq') ? '⚠ Groq disabled — Transcription unavailable' : 'Uses whisper-large-v3-turbo exclusively'}
          />
        </div>

        <div style={{ marginTop: '1rem', padding: '.75rem 1rem',
          background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10 }}>
          <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#818cf8', marginBottom: '.35rem' }}>
            How fallback works
          </div>
          <div style={{ fontSize: '.75rem', color: '#64748b', lineHeight: 1.6 }}>
            For general tasks the backend tries <strong style={{ color: '#60a5fa' }}>Gemini 3.1 Flash Lite</strong> first,
            falls back to <strong style={{ color: '#34d399' }}>OpenAI gpt-4.1-mini</strong>, then <strong style={{ color: '#fb923c' }}>Groq llama-3.3-70b</strong> as the final safety net.
            Transcription and SQL generation always use <strong style={{ color: '#fb923c' }}>Groq</strong> directly — no fallback.
          </div>
        </div>
      </div>

      {/* ── Per-Tool Credit Usage ── */}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.9rem' }}>
          <div style={S.head}><BarChart2 size={12}/> User Credit Usage by Tool</div>
          <div style={{ fontSize: '.7rem', color: '#475569' }}>Resets daily at UTC midnight</div>
        </div>

        {Object.keys(TOOL_META).length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '.85rem' }}>
            {Object.keys(TOOL_META).map(toolId => (
              <CreditBar
                key={toolId}
                toolId={toolId}
                todayCount={Number(todayMap[toolId] || 0)}
                weekCount={Number(weekMap[toolId] || 0)}
                monthCount={Number(monthMap[toolId] || 0)}
                limit={limits[toolId]?.daily ?? null}
              />
            ))}
          </div>
        ) : (
          <div style={{ color: '#475569', fontSize: '.82rem', textAlign: 'center', padding: '1rem' }}>No usage data yet.</div>
        )}

        {/* Totals summary */}
        {data && (
          <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '.5rem' }}>
            {[
              { label: 'Requests Today',  value: fmtNum(Object.values(todayMap).reduce((a,b) => a+Number(b), 0)),  color: '#f87171' },
              { label: 'This Week',       value: fmtNum(Object.values(weekMap).reduce((a,b) => a+Number(b), 0)),   color: '#60a5fa' },
              { label: 'This Month',      value: fmtNum(Object.values(monthMap).reduce((a,b) => a+Number(b), 0)),  color: '#a78bfa' },
              { label: 'Active Tools',    value: Object.keys(todayMap).filter(k => todayMap[k] > 0).length,        color: '#34d399' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
                padding: '.65rem .85rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: '.63rem', color: '#475569', marginTop: '.15rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── API Key Audit ── */}
      <div style={S.card}>
        <div style={S.head}><Shield size={12}/> API Key Audit</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
          {[
            { key: 'GROQ_API_KEY',   provider: 'Groq',         purpose: 'Audio transcription · Text-to-SQL · Speaker diarization', configured: !!data && providers.find(p => p.key === 'groq')?.status !== 'no_key'   },
            { key: 'GEMINI_API_KEY', provider: 'Google Gemini', purpose: 'Dashboard planning · QA analysis · General text tasks',    configured: !!data && providers.find(p => p.key === 'gemini')?.status !== 'no_key' },
            { key: 'OPENAI_API_KEY', provider: 'OpenAI',        purpose: 'Second fallback for general AI tasks (gpt-4.1-mini)',     configured: !!data && providers.find(p => p.key === 'openai')?.status !== 'no_key' },
          ].map(({ key, provider, purpose, configured }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '.85rem',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10, padding: '.55rem .85rem', flexWrap: 'wrap' }}>
              <StatusBadge status={configured ? 'ok' : 'no_key'} size="sm"/>
              <div style={{ minWidth: 140 }}>
                <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace' }}>{key}</div>
                <div style={{ fontSize: '.65rem', color: '#64748b' }}>{provider}</div>
              </div>
              <div style={{ fontSize: '.72rem', color: '#475569', flex: 1 }}>{purpose}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '.85rem', fontSize: '.72rem', color: '#334155',
          background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '.45rem .7rem' }}>
          🔐 API keys are stored as Cloudflare Worker secrets — never exposed in source code or frontend.
          Use <code style={{ color: '#818cf8', background: 'rgba(99,102,241,0.1)', padding: '.05rem .3rem', borderRadius: 4 }}>wrangler secret put KEY_NAME</code> to update.
        </div>
      </div>
    </div>
  );
}

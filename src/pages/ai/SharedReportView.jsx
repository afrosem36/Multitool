/**
 * SHARED REPORT VIEW — read-only public dashboard viewer
 * ─────────────────────────────────────────────────────────────────────────────
 * Accessed via /report/share/:token
 *
 * - No upload, no AI, no configuration
 * - No access to private dashboards or other user data
 * - Renders snapshot exactly as the owner saw it
 * - Shows clear "expired" or "revoked" messaging if link is invalid
 */

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  BarChart2, AlertTriangle, Clock, RefreshCw,
  Sparkles, Share2, ArrowRight, Eye,
} from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { DashboardCanvas } from './dashboardComponents';

const T_DARK = {
  page:'#07070f', card:'#0d0d1a', card2:'#111122', border:'rgba(255,255,255,0.07)',
  text:'#e2e8f0', sub:'#64748b', input:'rgba(255,255,255,0.05)', hover:'rgba(255,255,255,0.04)',
  glass:'rgba(13,13,26,0.85)',
};

function formatRelativeExpiry(ts) {
  if (!ts) return '';
  const ms = ts - Date.now();
  if (ms < 0) return 'expired';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'}`;
}

// ─── Status / Error screen ───────────────────────────────────────────────────
function StatusScreen({ icon: Icon, color, title, message, action, T = T_DARK }) {
  return (
    <div style={{ minHeight:'100vh', background:T.page, color:T.text, display:'flex',
      alignItems:'center', justifyContent:'center', padding:'2rem', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ maxWidth:480, textAlign:'center' }}>
        <div style={{ width:72, height:72, borderRadius:18, margin:'0 auto 1.5rem',
          background: `${color}15`, border:`1px solid ${color}40`, display:'flex',
          alignItems:'center', justifyContent:'center' }}>
          <Icon size={32} style={{ color }}/>
        </div>
        <div style={{ fontWeight:800, fontSize:'1.4rem', marginBottom:'.55rem' }}>{title}</div>
        <div style={{ color:T.sub, fontSize:'.95rem', lineHeight:1.6, marginBottom:'1.5rem' }}>{message}</div>
        {action || (
          <Link to="/" style={{ display:'inline-flex', alignItems:'center', gap:'.45rem',
            background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff',
            padding:'.65rem 1.4rem', borderRadius:10, fontSize:'.88rem', fontWeight:600,
            textDecoration:'none', boxShadow:'0 4px 14px rgba(99,102,241,0.35)' }}>
            Build your own dashboard <ArrowRight size={13}/>
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Main viewer ─────────────────────────────────────────────────────────────
export default function SharedReportView() {
  const { token } = useParams();
  const [state, setState] = useState({ status: 'loading', snapshot: null, expiresAt: null, error: null });
  const [activeTabId, setActiveTabId] = useState(null);
  const T = T_DARK;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const resp = await fetch(`${API_BASE_URL}/api/share/dashboard/${encodeURIComponent(token)}`);
        const data = await resp.json();
        if (cancelled) return;
        if (data.success && data.snapshot) {
          setState({ status: 'ok', snapshot: data.snapshot, expiresAt: data.expiresAt, error: null });
          const firstId = data.snapshot?.tabs?.[0]?.id || null;
          setActiveTabId(firstId);
        } else {
          setState({ status: data.code || 'error', snapshot: null, expiresAt: null, error: data.error });
        }
      } catch (err) {
        if (cancelled) return;
        setState({ status: 'network_error', snapshot: null, expiresAt: null, error: err.message });
      }
    }
    if (token) load();
    return () => { cancelled = true; };
  }, [token]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (state.status === 'loading') {
    return (
      <div style={{ minHeight:'100vh', background:T.page, color:T.text,
        display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui,sans-serif' }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ textAlign:'center' }}>
          <div style={{ width:48, height:48, borderRadius:14, margin:'0 auto 1rem',
            background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 6px 20px rgba(99,102,241,0.35)' }}>
            <RefreshCw size={20} style={{ color:'#fff', animation:'spin 1s linear infinite' }}/>
          </div>
          <div style={{ fontWeight:600, fontSize:'.95rem' }}>Loading shared report…</div>
        </div>
      </div>
    );
  }

  // ── Error / expired / revoked ─────────────────────────────────────────────
  if (state.status === 'EXPIRED' || state.error === 'This report link has expired') {
    return <StatusScreen icon={Clock} color="#f59e0b"
      title="This report link has expired"
      message="The owner set an expiry on this shared dashboard and that window has passed. Ask the owner to generate a new link if you still need access."/>;
  }
  if (state.status === 'REVOKED') {
    return <StatusScreen icon={AlertTriangle} color="#ef4444"
      title="This report link has been revoked"
      message="The owner revoked access to this shared dashboard. Ask them to share a new link if you still need to view it."/>;
  }
  if (state.status === 'NOT_FOUND' || state.status === 'MISSING_BLOB' || state.status === 'BAD_TOKEN') {
    return <StatusScreen icon={AlertTriangle} color="#ef4444"
      title="Report not found"
      message="This link doesn't point to a valid shared report. It may have been deleted or the URL is mistyped."/>;
  }
  if (state.status !== 'ok' || !state.snapshot) {
    return <StatusScreen icon={AlertTriangle} color="#ef4444"
      title="Couldn't load report"
      message={state.error || 'An unexpected error occurred while loading the shared report.'}/>;
  }

  // ── Render the shared dashboard (read-only) ───────────────────────────────
  const snap = state.snapshot;
  // Build the shape that DashboardCanvas expects
  const dashboard = {
    plan: {
      title: snap.title,
      subtitle: snap.subtitle,
      domain: snap.domain,
      confidence: snap.confidence,
      tabs: (snap.tabs || []).map(t => ({
        id: t.id, title: t.title, description: t.description,
        summary: t.summary, insights: t.insights || [],
        kpis: t.kpis || [],
        charts: (t.charts || []).map(c => ({ ...c })),
        isForecast: t.isForecast || t.id === 'forecast',
        isInsights: t.isInsights || t.id === 'insights',
      })),
      charts: snap.charts || [],
      insights: snap.insights || [],
      summary: snap.summary || '',
    },
    // Tab charts: build the { spec, data } shape that the canvas expects
    tabChartData: (snap.tabs || []).reduce((acc, t) => {
      acc[t.id] = (t.charts || [])
        .filter(c => Array.isArray(c.data) && c.data.length > 0)
        .map(c => ({ spec: { ...c, data: undefined }, data: c.data }));
      return acc;
    }, {}),
    // Legacy flat charts fallback
    builtCharts: (snap.charts || [])
      .filter(c => Array.isArray(c.data) && c.data.length > 0)
      .map(c => ({ spec: { ...c, data: undefined }, data: c.data })),
    kpis: snap.kpis || [],
    agentData: snap.agentData || null,
    fileName: snap.fileName || '',
    rowCount: snap.rowCount || 0,
    source: 'shared',
  };

  return (
    <div style={{ minHeight:'100vh', background:T.page, color:T.text, fontFamily:'system-ui,sans-serif' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(99,102,241,0.3);border-radius:99px}
        *{box-sizing:border-box}
      `}</style>

      {/* ── Read-only header bar ────────────────────────────────────────────── */}
      <div style={{ borderBottom:`1px solid ${T.border}`, padding:'.65rem 1.5rem',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        background:T.glass, position:'sticky', top:0, zIndex:50, backdropFilter:'blur(16px)',
        flexWrap:'wrap', gap:'.5rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'.65rem', minWidth:0 }}>
          <div style={{ width:32, height:32, background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
            borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 4px 12px rgba(99,102,241,0.35)', flexShrink:0 }}>
            <BarChart2 size={16} style={{ color:'#fff' }}/>
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'.4rem' }}>
              <div style={{ fontWeight:700, fontSize:'.92rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'40vw' }}>
                {snap.title}
              </div>
              <span style={{ padding:'.14rem .55rem', borderRadius:100, fontSize:'.62rem', fontWeight:700,
                background:'rgba(139,92,246,0.12)', color:'#a78bfa', border:'1px solid rgba(139,92,246,0.25)',
                display:'inline-flex', alignItems:'center', gap:'.2rem' }}>
                <Eye size={9}/> SHARED · READ ONLY
              </span>
            </div>
            <div style={{ fontSize:'.62rem', color:T.sub, marginTop:'.05rem' }}>
              Public snapshot · {snap.fileName || 'data'} · {snap.rowCount?.toLocaleString('en-IN')} rows
            </div>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'.6rem' }}>
          {state.expiresAt && (
            <span style={{ display:'inline-flex', alignItems:'center', gap:'.3rem',
              padding:'.3rem .65rem', borderRadius:100, fontSize:'.7rem', fontWeight:600,
              background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', color:'#fbbf24' }}>
              <Clock size={11}/> Expires in {formatRelativeExpiry(state.expiresAt)}
            </span>
          )}
          <Link to="/ai/dashboard-maker"
            style={{ display:'inline-flex', alignItems:'center', gap:'.3rem',
              background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff',
              border:'none', borderRadius:8, padding:'.36rem .8rem', textDecoration:'none',
              fontSize:'.74rem', fontWeight:600, boxShadow:'0 4px 12px rgba(99,102,241,0.3)' }}>
            <Sparkles size={11}/> Build your own
          </Link>
        </div>
      </div>

      <div style={{ maxWidth:1280, margin:'0 auto', padding:'1.5rem 1.25rem' }}>
        <DashboardCanvas
          dashboard={dashboard}
          rows={[]}            /* shared view never has raw rows for privacy */
          headers={snap.headers || []}
          analysis={null}
          activeTabId={activeTabId}
          onChangeTab={setActiveTabId}
          onExpandChart={null}   /* expand disabled in read-only view */
          T={T}
          readOnly={true}
        />

        {/* Footer note */}
        <div style={{ marginTop:'2rem', padding:'1rem 1.25rem',
          background:'rgba(99,102,241,0.04)', border:'1px solid rgba(99,102,241,0.12)',
          borderRadius:12, textAlign:'center' }}>
          <div style={{ fontSize:'.8rem', color:T.text, fontWeight:600, marginBottom:'.3rem' }}>
            <Share2 size={11} style={{ verticalAlign:'-1px', marginRight:'.3rem', color:'#818cf8' }}/>
            This is a read-only snapshot
          </div>
          <div style={{ fontSize:'.72rem', color:T.sub, lineHeight:1.6 }}>
            You are viewing a public dashboard shared by the owner. Editing, raw-data download and AI features are disabled.
            Want to build your own AI dashboard from a spreadsheet?{' '}
            <Link to="/ai/dashboard-maker" style={{ color:'#818cf8', fontWeight:600 }}>Try AI Dashboard Maker →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

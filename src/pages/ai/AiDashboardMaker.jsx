import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  Upload, FileSpreadsheet, Sparkles, BarChart2, TrendingUp,
  Download, RefreshCw, X, CheckCircle, Table2, Zap,
  ArrowUpRight, ArrowDownRight, Minus, Sun, Moon, Info,
  Clock, Trophy, LayoutDashboard, ChevronRight, AlertCircle,
  Database, Target, Users, DollarSign, Activity, BarChart,
  PieChart as PieIcon, LineChart as LineIcon, LogIn, User,
  Lock, Shield, Brain, Cpu, FlaskConical, Link2, ChevronDown,
  Globe, Layers, GitBranch, Lightbulb, TrendingDown, AlertTriangle,
  ArrowLeft, Wand2, Wifi, WifiOff, ScatterChart as ScatterIcon,
  Radar as RadarIcon, GitMerge,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  BarChart as ReBar, Bar,
  LineChart as ReLine, Line,
  AreaChart as ReArea, Area,
  PieChart as RePie, Pie, Cell,
  ScatterChart as ReScatter, Scatter,
  RadarChart as ReRadar, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart as ReComposed,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { API_BASE_URL } from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useAiRateLimit } from '../../hooks/useAiRateLimit';
import { AiLoginGate, AiRateLimitBanner, AiRateLimitBadge } from '../../components/shared/AiRateLimitGate';
import { useDashboardStore } from '../../store/dashboardStore';

// ── Engines ──────────────────────────────────────────────────────────────────
import { analyzeDataset, SEMANTIC_STYLE, ST } from '../../engines/semanticEngine';
import {
  aggregateForChart, buildDateTrends, formatKPIValue,
  buildAIPayload, generateAutoInsights, analyzeDataQuality,
} from '../../engines/analyticsEngine';
import { generateChartSpecs, buildFallbackPlan, computeLayout } from '../../engines/chartEngine';
import { generateKPIs } from '../../engines/kpiEngine';
import { detectRelationships, groupColumns, recommendDashboards, REL_META } from '../../engines/relationshipEngine';
import { generateInsights } from '../../engines/insightEngine';

// ─── Constants ─────────────────────────────────────────────────────────────────
const COLORS = ['#6366f1','#10b981','#f59e0b','#3b82f6','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16','#f97316'];
const FREE_DASHBOARD_LIMIT = 3;

const DARK  = { page:'#07070f', card:'#0d0d1a', card2:'#111122', border:'rgba(255,255,255,0.07)', text:'#e2e8f0', sub:'#64748b', input:'rgba(255,255,255,0.05)', hover:'rgba(255,255,255,0.04)', glass:'rgba(13,13,26,0.85)' };
const LIGHT = { page:'#f0f4ff', card:'#ffffff',  card2:'#f8faff', border:'rgba(0,0,0,0.08)',       text:'#0f172a', sub:'#64748b', input:'rgba(0,0,0,0.04)',        hover:'rgba(0,0,0,0.03)',       glass:'rgba(255,255,255,0.9)' };

const ALL_SEMANTIC_TYPES = Object.keys(SEMANTIC_STYLE);

const DOMAIN_LABELS = {
  sales_crm: 'CRM & Sales',
  finance: 'Finance',
  hr_payroll: 'HR & Payroll',
  ecommerce: 'E-Commerce',
  logistics: 'Logistics',
  healthcare: 'Healthcare',
  education: 'EdTech',
  real_estate: 'Real Estate',
  telecom: 'Telecom',
  generic: 'General',
};

const GEN_STAGES = [
  { id:'scan',   icon: Cpu,         label:'Scanning dataset',        detail:'Semantic inference engine classifying all columns' },
  { id:'ai',     icon: Brain,       label:'AI analysis',             detail:'Gemini dashboard planning · Puter AI on standby'   },
  { id:'render', icon: BarChart2,   label:'Building charts & KPIs',  detail:'Chart scoring, layout engine, KPI calculation'     },
  { id:'done',   icon: CheckCircle, label:'Dashboard ready',         detail:'Saved to your history'                             },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function relativeTime(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function confidenceBadge(score) {
  if (score >= 80) return { label: `${score}%`, color: '#10b981', bg: 'rgba(16,185,129,0.1)', text: 'High confidence' };
  if (score >= 55) return { label: `${score}%`, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', text: 'Medium confidence' };
  return { label: `${score}%`, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', text: 'AI assist needed' };
}

function convertGoogleSheetsUrl(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const id = match[1];
  const gidMatch = url.match(/[?&#]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

// ─── UploadZone ────────────────────────────────────────────────────────────────
function UploadZone({ onFile, T }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);
  const handle = useCallback((f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['xlsx','xls','csv','json'].includes(ext)) { toast.error('Upload .xlsx, .xls, .csv, or .json'); return; }
    onFile(f);
  }, [onFile]);

  return (
    <div
      style={{ border:`2px dashed ${drag ? '#6366f1' : T.border}`, borderRadius:16, padding:'3rem 2rem',
        textAlign:'center', cursor:'pointer', background: drag ? 'rgba(99,102,241,0.06)' : T.input, transition:'all .2s' }}
      onClick={() => ref.current?.click()}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer?.files?.[0]); }}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
    >
      <input ref={ref} type="file" accept=".xlsx,.xls,.csv,.json" style={{ display:'none' }} onChange={e => handle(e.target.files?.[0])}/>
      <div style={{ width:56, height:56, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius:16,
        display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.25rem',
        boxShadow:'0 8px 24px rgba(99,102,241,0.35)' }}>
        <FileSpreadsheet size={26} style={{ color:'#fff' }}/>
      </div>
      <div style={{ fontWeight:700, fontSize:'1rem', color:T.text, marginBottom:'.3rem' }}>Drop your file here</div>
      <div style={{ color:T.sub, fontSize:'.82rem', marginBottom:'1rem' }}>or click to browse</div>
      <div style={{ display:'flex', gap:'.4rem', justifyContent:'center', flexWrap:'wrap' }}>
        {['.xlsx','.xls','.csv','.json'].map(ext => (
          <span key={ext} style={{ padding:'.18rem .55rem', borderRadius:100, fontSize:'.68rem', fontWeight:600,
            background:'rgba(99,102,241,0.1)', color:'#6366f1', border:'1px solid rgba(99,102,241,0.2)' }}>{ext}</span>
        ))}
      </div>
    </div>
  );
}

// ─── UrlDataSource ─────────────────────────────────────────────────────────────
function UrlDataSource({ onData, T }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoad = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      let fetchUrl = url.trim();
      const csvUrl = convertGoogleSheetsUrl(fetchUrl);
      if (csvUrl) fetchUrl = csvUrl;

      const resp = await fetch(fetchUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();

      let data, headers;
      if (fetchUrl.includes('.json') || text.trimStart().startsWith('[')) {
        const json = JSON.parse(text);
        const arr = Array.isArray(json) ? json : (json.data || json.rows || json.results || [json]);
        if (!arr.length) throw new Error('Empty JSON');
        headers = Object.keys(arr[0]);
        data = arr;
      } else {
        const wb = XLSX.read(text, { type: 'string' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        data = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!data.length) throw new Error('Empty file');
        headers = Object.keys(data[0]);
      }

      const srcName = csvUrl ? 'Google Sheets' : fetchUrl.split('/').pop() || 'URL data';
      onData(data, headers, srcName);
    } catch (err) {
      toast.error('Failed to load URL: ' + (err.message || 'Network error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
      <div style={{ fontSize:'.78rem', color:T.sub, lineHeight:1.5 }}>
        Paste a Google Sheets URL, public CSV link, or JSON API endpoint:
      </div>
      <div style={{ display:'flex', gap:'.5rem' }}>
        <div style={{ flex:1, display:'flex', alignItems:'center', gap:'.5rem',
          background:T.input, border:`1px solid ${T.border}`, borderRadius:10, padding:'.55rem .75rem' }}>
          <Link2 size={14} style={{ color:T.sub, flexShrink:0 }}/>
          <input value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLoad()}
            placeholder="https://docs.google.com/spreadsheets/d/... or CSV URL"
            style={{ flex:1, background:'none', border:'none', outline:'none', color:T.text, fontSize:'.83rem' }}/>
        </div>
        <button onClick={handleLoad} disabled={loading || !url.trim()}
          style={{ display:'inline-flex', alignItems:'center', gap:'.35rem',
            background: loading ? '#1e293b' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            color: loading ? T.sub : '#fff', border:'none', borderRadius:10,
            padding:'.55rem 1rem', cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight:600, fontSize:'.83rem', whiteSpace:'nowrap',
            boxShadow: loading ? 'none' : '0 4px 12px rgba(99,102,241,0.3)' }}>
          {loading ? <RefreshCw size={13} style={{ animation:'spin 1s linear infinite' }}/> : <Globe size={13}/>}
          {loading ? 'Loading…' : 'Load'}
        </button>
      </div>
      <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap' }}>
        {[
          { label:'Google Sheets', hint:'Share → Anyone with link → Paste URL' },
          { label:'Public CSV',    hint:'Any direct .csv URL works' },
          { label:'JSON API',      hint:'Returns array of objects' },
        ].map(({ label, hint }) => (
          <div key={label} style={{ display:'flex', gap:'.3rem', alignItems:'flex-start' }}>
            <CheckCircle size={11} style={{ color:'#10b981', marginTop:2, flexShrink:0 }}/>
            <div>
              <span style={{ fontSize:'.72rem', fontWeight:600, color:T.text }}>{label}</span>
              <span style={{ fontSize:'.68rem', color:T.sub }}> — {hint}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AuthGateBanner ────────────────────────────────────────────────────────────
function AuthGateBanner({ T, onLogin }) {
  return (
    <div style={{ background:'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.08))',
      border:'1px solid rgba(99,102,241,0.18)', borderRadius:12, padding:'1rem 1.25rem',
      display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
        <Shield size={14} style={{ color:'#818cf8' }}/>
        <span style={{ fontSize:'.82rem', color:T.sub }}>
          <strong style={{ color:'#a5b4fc' }}>Sign in required</strong> · Each account gets {FREE_DASHBOARD_LIMIT} dashboards total
        </span>
      </div>
      <button onClick={onLogin}
        style={{ marginLeft:'auto', display:'inline-flex', alignItems:'center', gap:'.4rem',
          background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', border:'none',
          borderRadius:8, padding:'.4rem .9rem', cursor:'pointer', fontSize:'.76rem', fontWeight:600,
          boxShadow:'0 4px 12px rgba(99,102,241,0.3)' }}>
        <LogIn size={12}/> Sign in
      </button>
    </div>
  );
}

// ─── RecentDashboards ──────────────────────────────────────────────────────────
function RecentDashboards({ dashboards, onRestore, onDelete, T }) {
  if (!dashboards.length) return null;
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:'.5rem', marginBottom:'.65rem' }}>
        <Clock size={13} style={{ color:T.sub }}/>
        <span style={{ fontSize:'.72rem', fontWeight:700, color:T.sub, textTransform:'uppercase', letterSpacing:'.06em' }}>Recent</span>
      </div>
      <div style={{ display:'flex', gap:'.65rem', overflowX:'auto', paddingBottom:'.4rem' }}>
        {dashboards.map(d => (
          <div key={d.id} style={{ minWidth:190, maxWidth:210, background:T.card, border:`1px solid ${T.border}`,
            borderRadius:11, padding:'.8rem', flexShrink:0, cursor:'pointer', transition:'border-color .15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#6366f1'}
            onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'.4rem' }}>
              <LayoutDashboard size={12} style={{ color:'#6366f1' }}/>
              <button onClick={e => { e.stopPropagation(); onDelete(d.id); }}
                style={{ background:'none', border:'none', cursor:'pointer', color:T.sub, padding:0, display:'flex' }}>
                <X size={10}/>
              </button>
            </div>
            <div style={{ fontWeight:600, fontSize:'.8rem', color:T.text, marginBottom:'.18rem',
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{d.title}</div>
            <div style={{ fontSize:'.68rem', color:T.sub, marginBottom:'.55rem' }}>
              {d.fileName} · {d.rowCount?.toLocaleString()} rows
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:'.63rem', color:T.sub }}>{relativeTime(d.createdAt)}</span>
              <button onClick={() => onRestore(d)}
                style={{ background:'rgba(99,102,241,0.1)', border:'none', cursor:'pointer', color:'#6366f1',
                  padding:'.18rem .5rem', borderRadius:6, fontSize:'.67rem', fontWeight:600,
                  display:'flex', alignItems:'center', gap:'.18rem' }}>
                Restore <ChevronRight size={8}/>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Intelligence Command Center (replaces SchemaPreview) ─────────────────────
function IntelligenceCommandCenter({
  analysis, effectiveAnalysis, semanticOverrides, setSemanticOverride,
  userPrompt, setUserPrompt, columnHelp, setColumnHelp,
  onGenerate, loading, T, onBack,
  relationships, columnGroups, dashboardRecs, insights, dataQuality, kpiPreviews,
}) {
  const ea = effectiveAnalysis || analysis;
  const { rowCount, avgConfidence, needsAI, domain, colMeta } = ea;
  const cb = confidenceBadge(avgConfidence);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [editingCol, setEditingCol] = useState(null);

  const qualityColor = dataQuality?.score >= 90 ? '#10b981' : dataQuality?.score >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

      {/* ── Intelligence Scan Header ─────────────────────────────────────────── */}
      <div style={{ background:'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.05))',
        border:'1px solid rgba(99,102,241,0.18)', borderRadius:14, padding:'1rem 1.25rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'.75rem', marginBottom:'.65rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'.65rem' }}>
            <div style={{ width:32, height:32, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius:9,
              display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(99,102,241,0.35)' }}>
              <Cpu size={15} style={{ color:'#fff' }}/>
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:'.92rem', color:T.text }}>Intelligence Scan Complete</div>
              <div style={{ fontSize:'.7rem', color:T.sub }}>Proprietary semantic engine · {ea.headers.length} columns classified</div>
            </div>
          </div>
          <button onClick={onBack} style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:7,
            padding:'.3rem .65rem', cursor:'pointer', color:T.sub, fontSize:'.72rem', display:'flex', alignItems:'center', gap:'.3rem' }}>
            <X size={11}/> Reset
          </button>
        </div>
        <div style={{ display:'flex', gap:'.75rem', flexWrap:'wrap' }}>
          {/* Domain */}
          <div style={{ display:'flex', alignItems:'center', gap:'.35rem', padding:'.25rem .65rem',
            background:'rgba(6,182,212,0.1)', border:'1px solid rgba(6,182,212,0.2)', borderRadius:100 }}>
            <Globe size={11} style={{ color:'#22d3ee' }}/>
            <span style={{ fontSize:'.68rem', fontWeight:700, color:'#22d3ee' }}>
              {DOMAIN_LABELS[domain] || domain?.replace('_',' ').toUpperCase()}
            </span>
          </div>
          {/* Confidence */}
          <div style={{ display:'flex', alignItems:'center', gap:'.35rem', padding:'.25rem .65rem',
            background: cb.bg, border:`1px solid ${cb.color}30`, borderRadius:100 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background: cb.color }}/>
            <span style={{ fontSize:'.68rem', fontWeight:700, color: cb.color }}>{cb.text} · {cb.label}</span>
          </div>
          {/* Stats */}
          {[
            { icon: Database, label: `${rowCount.toLocaleString()} rows` },
            { icon: Layers,   label: `${ea.headers.length} columns` },
            { icon: GitBranch, label: `${relationships.length} relationships` },
          ].map(({ icon: Icon, label }) => (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:'.3rem',
              padding:'.25rem .6rem', background:T.input, border:`1px solid ${T.border}`, borderRadius:100 }}>
              <Icon size={10} style={{ color:T.sub }}/>
              <span style={{ fontSize:'.67rem', color:T.sub, fontWeight:600 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main Two-Column Layout ───────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:'1rem' }}>

        {/* LEFT: Column Intelligence */}
        <div style={{ display:'flex', flexDirection:'column', gap:'.65rem' }}>
          <div style={{ fontSize:'.72rem', fontWeight:700, color:T.sub, textTransform:'uppercase', letterSpacing:'.07em',
            display:'flex', alignItems:'center', gap:'.4rem' }}>
            <Cpu size={11}/> Column Intelligence
          </div>
          {columnGroups.map(({ name, icon, color, cols }) => (
            <div key={name} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, overflow:'hidden' }}>
              {/* Group header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'.6rem .85rem', cursor:'pointer', background:T.hover }}
                onClick={() => setExpandedGroup(expandedGroup === name ? null : name)}>
                <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
                  <span style={{ fontSize:'.85rem' }}>{icon}</span>
                  <span style={{ fontSize:'.78rem', fontWeight:700, color:T.text }}>{name}</span>
                  <span style={{ padding:'.1rem .4rem', borderRadius:100, fontSize:'.6rem', fontWeight:700,
                    background: `${color}18`, color }}>{cols.length}</span>
                </div>
                <ChevronDown size={12} style={{ color:T.sub, transform: expandedGroup===name ? 'rotate(180deg)':'rotate(0)', transition:'transform .2s' }}/>
              </div>
              {/* Columns list */}
              {(expandedGroup === name || columnGroups.length <= 4) && (
                <div style={{ padding:'.55rem .85rem', display:'flex', flexDirection:'column', gap:'.4rem' }}>
                  {cols.map(col => {
                    const meta  = colMeta[col] || {};
                    const st    = semanticOverrides[col] || meta.semanticType || 'text';
                    const style = SEMANTIC_STYLE[st] || SEMANTIC_STYLE.text;
                    const conf  = Math.round((meta.confidence || 0) * 100);
                    const lowConf = conf < 55;
                    return (
                      <div key={col} style={{ display:'flex', alignItems:'center', gap:'.6rem' }}>
                        {/* Col name */}
                        <div style={{ minWidth:0, flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'.4rem', marginBottom:'.18rem' }}>
                            <span style={{ fontSize:'.78rem', fontWeight:600, color:T.text,
                              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:160 }}>{col}</span>
                            {lowConf && <AlertTriangle size={10} style={{ color:'#f59e0b', flexShrink:0 }}/>}
                          </div>
                          {/* Confidence bar */}
                          <div style={{ height:3, background:T.hover, borderRadius:3, overflow:'hidden' }}>
                            <div style={{ height:'100%', borderRadius:3, width:`${conf}%`,
                              background: conf >= 80 ? '#10b981' : conf >= 55 ? '#f59e0b' : '#ef4444',
                              transition:'width .4s' }}/>
                          </div>
                        </div>
                        {/* Semantic type badge / override */}
                        <div style={{ position:'relative', flexShrink:0 }}>
                          <button onClick={() => setEditingCol(editingCol === col ? null : col)}
                            style={{ display:'flex', alignItems:'center', gap:'.2rem',
                              background:style.bg, color:style.color, border:`1px solid ${style.color}30`,
                              borderRadius:100, padding:'.18rem .55rem', cursor:'pointer', fontSize:'.65rem', fontWeight:700 }}>
                            {style.label}
                            <ChevronDown size={8}/>
                          </button>
                          {editingCol === col && (
                            <div style={{ position:'absolute', right:0, top:'calc(100% + 4px)', zIndex:100,
                              background:T.card, border:`1px solid ${T.border}`, borderRadius:10,
                              boxShadow:'0 8px 24px rgba(0,0,0,0.3)', padding:'.4rem',
                              display:'flex', flexDirection:'column', gap:'.2rem', maxHeight:220, overflowY:'auto', minWidth:160 }}>
                              {ALL_SEMANTIC_TYPES.map(stype => {
                                const ss = SEMANTIC_STYLE[stype];
                                return (
                                  <button key={stype}
                                    onClick={() => { setSemanticOverride(col, stype); setEditingCol(null); }}
                                    style={{ display:'flex', alignItems:'center', gap:'.4rem',
                                      background: stype === st ? ss.bg : 'none',
                                      border:'none', cursor:'pointer', borderRadius:6,
                                      padding:'.25rem .5rem', textAlign:'left' }}>
                                    <span style={{ width:8, height:8, borderRadius:'50%', background:ss.color, flexShrink:0 }}/>
                                    <span style={{ fontSize:'.7rem', color: stype === st ? ss.color : T.text }}>{ss.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        {/* Confidence % */}
                        <span style={{ fontSize:'.65rem', color: lowConf ? '#f59e0b' : T.sub, fontWeight:600, flexShrink:0 }}>
                          {conf}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* RIGHT: Intelligence Panels */}
        <div style={{ display:'flex', flexDirection:'column', gap:'.65rem' }}>

          {/* Relationships Panel */}
          {relationships.length > 0 && (
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:'.85rem' }}>
              <div style={{ fontSize:'.7rem', fontWeight:700, color:T.sub, textTransform:'uppercase',
                letterSpacing:'.06em', marginBottom:'.6rem', display:'flex', alignItems:'center', gap:'.35rem' }}>
                <GitBranch size={11}/> Detected Relationships
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'.35rem' }}>
                {relationships.slice(0, 6).map((rel, i) => {
                  const meta = REL_META[rel.type] || REL_META.financial;
                  return (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:'.5rem',
                      padding:'.35rem .55rem', background: meta.bg, borderRadius:8 }}>
                      <span style={{ fontSize:'.8rem', flexShrink:0 }}>{meta.icon}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:'.72rem', color:T.text, fontWeight:600,
                          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {rel.from} → {rel.to}
                        </div>
                        <div style={{ fontSize:'.63rem', color:T.sub }}>{meta.label}</div>
                      </div>
                      <div style={{ width:28, height:28, borderRadius:100, flexShrink:0,
                        background:`conic-gradient(${meta.color} ${Math.round(rel.strength*100)}%, transparent 0)`,
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.55rem', fontWeight:700, color:meta.color }}>
                        {Math.round(rel.strength * 100)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* KPI Predictions */}
          {kpiPreviews.length > 0 && (
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:'.85rem' }}>
              <div style={{ fontSize:'.7rem', fontWeight:700, color:T.sub, textTransform:'uppercase',
                letterSpacing:'.06em', marginBottom:'.6rem', display:'flex', alignItems:'center', gap:'.35rem' }}>
                <Target size={11}/> KPI Predictions
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'.35rem' }}>
                {kpiPreviews.slice(0, 6).map(kpi => (
                  <span key={kpi.id} style={{ padding:'.25rem .6rem', borderRadius:100, fontSize:'.67rem', fontWeight:600,
                    background:'rgba(99,102,241,0.1)', color:'#818cf8', border:'1px solid rgba(99,102,241,0.2)' }}>
                    {kpi.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Dashboards */}
          {dashboardRecs.length > 0 && (
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:'.85rem' }}>
              <div style={{ fontSize:'.7rem', fontWeight:700, color:T.sub, textTransform:'uppercase',
                letterSpacing:'.06em', marginBottom:'.6rem', display:'flex', alignItems:'center', gap:'.35rem' }}>
                <Sparkles size={11}/> Recommended Dashboards
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'.35rem' }}>
                {dashboardRecs.map((rec, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'.55rem',
                    padding:'.4rem .6rem', background:T.hover, borderRadius:8 }}>
                    <span style={{ fontSize:'.85rem' }}>{rec.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'.75rem', fontWeight:600, color:T.text }}>{rec.title}</div>
                      <div style={{ display:'flex', gap:'.25rem', marginTop:'.2rem', flexWrap:'wrap' }}>
                        {rec.tags.slice(0,3).map(t => (
                          <span key={t} style={{ fontSize:'.6rem', color:T.sub }}>#{t}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ padding:'.15rem .45rem', borderRadius:100, fontSize:'.63rem', fontWeight:800,
                      background:`${rec.fit >= 90 ? 'rgba(16,185,129' : rec.fit >= 80 ? 'rgba(99,102,241' : 'rgba(245,158,11'},0.12)`,
                      color: rec.fit >= 90 ? '#10b981' : rec.fit >= 80 ? '#818cf8' : '#fbbf24' }}>
                      {rec.fit}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Auto Insights Feed ────────────────────────────────────────────────── */}
      {insights.length > 0 && (
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:'.9rem 1rem' }}>
          <div style={{ fontSize:'.7rem', fontWeight:700, color:T.sub, textTransform:'uppercase',
            letterSpacing:'.06em', marginBottom:'.65rem', display:'flex', alignItems:'center', gap:'.4rem' }}>
            <Lightbulb size={11}/> Auto Insights
            <span style={{ fontSize:'.62rem', color:T.sub, fontWeight:400, marginLeft:.15+'rem' }}>— deterministic · no AI</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'.4rem' }}>
            {insights.slice(0, 4).map((ins, i) => {
              const isWarning = ins.startsWith('⚠');
              const isGrowth  = ins.startsWith('↑');
              return (
                <div key={i} style={{ display:'flex', gap:'.55rem', alignItems:'flex-start',
                  padding:'.45rem .6rem', background: isWarning ? 'rgba(239,68,68,0.05)' : isGrowth ? 'rgba(16,185,129,0.05)' : T.hover,
                  borderRadius:8, border:`1px solid ${isWarning ? 'rgba(239,68,68,0.12)' : isGrowth ? 'rgba(16,185,129,0.12)' : T.border}` }}>
                  {isWarning ? <AlertTriangle size={11} style={{ color:'#f87171', marginTop:2, flexShrink:0 }}/>
                             : isGrowth  ? <ArrowUpRight size={11} style={{ color:'#10b981', marginTop:2, flexShrink:0 }}/>
                             : <CheckCircle size={11} style={{ color:'#6366f1', marginTop:2, flexShrink:0 }}/>}
                  <span style={{ fontSize:'.78rem', color:T.text, lineHeight:1.5 }}>{ins.replace(/^[⚠↑]\s*/,'')}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Data Quality Bar ─────────────────────────────────────────────────── */}
      {dataQuality && (
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12,
          padding:'.75rem 1rem', display:'flex', alignItems:'center', gap:'.85rem', flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
            <Shield size={12} style={{ color:qualityColor }}/>
            <span style={{ fontSize:'.73rem', fontWeight:700, color:T.text }}>Data Quality</span>
          </div>
          <div style={{ flex:1, minWidth:120, height:5, background:T.hover, borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:3, width:`${dataQuality.score}%`,
              background: dataQuality.score >= 90 ? '#10b981' : dataQuality.score >= 70 ? '#f59e0b' : '#ef4444',
              transition:'width .6s' }}/>
          </div>
          <span style={{ fontSize:'.75rem', fontWeight:800, color:qualityColor }}>{dataQuality.score}%</span>
          {dataQuality.issues.slice(0,2).map((issue, i) => (
            <span key={i} style={{ fontSize:'.67rem', color:'#f87171', background:'rgba(239,68,68,0.08)',
              padding:'.18rem .5rem', borderRadius:6 }}>{issue}</span>
          ))}
        </div>
      )}

      {/* ── User Configuration ───────────────────────────────────────────────── */}
      <AISuggestConfig
        ea={ea} T={T}
        userPrompt={userPrompt} setUserPrompt={setUserPrompt}
        columnHelp={columnHelp} setColumnHelp={setColumnHelp}
        onGenerate={onGenerate} loading={loading} needsAI={needsAI}
      />
    </div>
  );
}

// ─── AISuggestConfig ──────────────────────────────────────────────────────────
function AISuggestConfig({ ea, T, userPrompt, setUserPrompt, columnHelp, setColumnHelp, onGenerate, loading, needsAI }) {

  const buildChatGPTPrompt = () => {
    const hdrs = (ea?.headers || []).join(', ');
    return `I have an Excel/CSV file with these column headers:\n${hdrs}\n\nPlease reply in this exact format so I can paste it into an AI Dashboard tool:\n\nCustom prompt:\n[Write a 1-2 sentence instruction for the dashboard AI, e.g. "Focus on agent performance and revenue trends. Highlight top performers and monthly growth."]\n\nColumn hints:\n[Write one line per column explaining its meaning, e.g.:\nAgent_Name = name of the sales agent\nCollection_Amount = payment collected in rupees\ncall_status = Answered / Not Answered / Busy]`;
  };

  const handleAISuggest = () => {
    const prompt = buildChatGPTPrompt();
    const url = `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    toast('ChatGPT opened with your prompt — paste its reply into the fields below', { icon:'✦', duration:5000 });
  };

  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:'.9rem 1rem',
      display:'flex', flexDirection:'column', gap:'.75rem' }}>

      {/* Header row with AI Suggest button */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'.5rem' }}>
        <span style={{ fontSize:'.72rem', fontWeight:700, color:T.sub, textTransform:'uppercase', letterSpacing:'.04em' }}>
          AI Configuration
        </span>
        <button onClick={handleAISuggest}
          style={{ display:'inline-flex', alignItems:'center', gap:'.35rem',
            padding:'.32rem .75rem', fontSize:'.74rem', fontWeight:600, cursor:'pointer',
            background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.3)',
            color:'#818cf8', borderRadius:8, transition:'all .2s' }}
          title="Opens ChatGPT with your column headers pre-filled — paste the reply back here">
          <Wand2 size={11}/> Ask ChatGPT
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.75rem' }}>
        <div>
          <label style={{ fontSize:'.72rem', fontWeight:700, color:T.sub, display:'block', marginBottom:'.3rem', textTransform:'uppercase', letterSpacing:'.04em' }}>
            Custom prompt <span style={{ opacity:.5, fontWeight:400, textTransform:'none' }}>(optional)</span>
          </label>
          <textarea rows={3} value={userPrompt} onChange={e => setUserPrompt(e.target.value)}
            placeholder="e.g. Focus on agent performance and collection trends"
            style={{ width:'100%', background:T.input, border:`1px solid ${T.border}`, borderRadius:9,
              color:T.text, padding:'.5rem .65rem', fontSize:'.8rem', outline:'none', resize:'none',
              fontFamily:'inherit', boxSizing:'border-box' }}/>
        </div>
        <div>
          <label style={{ fontSize:'.72rem', fontWeight:700, color:T.sub, display:'block', marginBottom:'.3rem', textTransform:'uppercase', letterSpacing:'.04em' }}>
            Column hints <span style={{ opacity:.5, fontWeight:400, textTransform:'none' }}>(optional)</span>
          </label>
          <textarea rows={3} value={columnHelp} onChange={e => setColumnHelp(e.target.value)}
            placeholder={'e.g.\ncall_status = Answered / Not Answered\namount = payment in rupees'}
            style={{ width:'100%', background:T.input, border:`1px solid ${T.border}`, borderRadius:9,
              color:T.text, padding:'.5rem .65rem', fontSize:'.8rem', outline:'none', resize:'none',
              fontFamily:'inherit', boxSizing:'border-box' }}/>
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:'.75rem', flexWrap:'wrap' }}>
        <button onClick={onGenerate} disabled={loading}
          style={{ display:'inline-flex', alignItems:'center', gap:'.45rem',
            padding:'.6rem 1.4rem', background: loading ? '#1e293b' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            color: loading ? '#64748b' : '#fff', border:'none', borderRadius:10, fontWeight:700,
            fontSize:'.88rem', cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.4)', transition:'all .15s' }}>
          {loading
            ? <><RefreshCw size={14} style={{ animation:'spin 1s linear infinite' }}/> Generating…</>
            : <><Zap size={14}/> Generate Dashboard</>}
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:'.35rem', fontSize:'.75rem', color:T.sub }}>
          {needsAI
            ? <><Brain size={12} style={{ color:'#818cf8' }}/> <span style={{ color:'#818cf8' }}>AI will assist</span> — low confidence detected</>
            : <><CheckCircle size={12} style={{ color:'#10b981' }}/> <span style={{ color:'#10b981' }}>Intelligence engine confident</span> — AI optional</>}
        </div>
      </div>
    </div>
  );
}

// ─── GenerationProgress ────────────────────────────────────────────────────────
function GenerationProgress({ stage, T }) {
  return (
    <div style={{ maxWidth:480, margin:'4rem auto', textAlign:'center' }}>
      <div style={{ width:58, height:58, background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
        borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center',
        margin:'0 auto 2rem', boxShadow:'0 8px 32px rgba(99,102,241,0.35)' }}>
        <BarChart2 size={26} style={{ color:'#fff' }}/>
      </div>
      <div style={{ fontWeight:700, fontSize:'1.2rem', color:T.text, marginBottom:'1.75rem' }}>
        Building your dashboard…
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'.6rem', textAlign:'left' }}>
        {GEN_STAGES.map((s, i) => {
          const status = i < stage ? 'done' : i === stage ? 'active' : 'pending';
          const Icon = s.icon;
          return (
            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'.7rem',
              background: status === 'active' ? 'rgba(99,102,241,0.08)' : T.card,
              border: `1px solid ${status === 'active' ? 'rgba(99,102,241,0.3)' : T.border}`,
              borderRadius:10, padding:'.55rem .85rem', transition:'all .3s' }}>
              <div style={{ flexShrink:0, width:22, height:22, borderRadius:100, display:'flex', alignItems:'center', justifyContent:'center',
                background: status==='done' ? 'rgba(16,185,129,0.15)' : status==='active' ? 'rgba(99,102,241,0.15)' : T.hover }}>
                {status==='done'    && <CheckCircle size={12} style={{ color:'#10b981' }}/>}
                {status==='active'  && <RefreshCw size={12} style={{ color:'#6366f1', animation:'spin 1s linear infinite' }}/>}
                {status==='pending' && <Icon size={11} style={{ color:T.sub }}/>}
              </div>
              <div>
                <div style={{ fontSize:'.8rem', fontWeight:600, color: status==='pending' ? T.sub : T.text }}>{s.label}</div>
                {status !== 'pending' && <div style={{ fontSize:'.67rem', color:T.sub, marginTop:'.08rem' }}>{s.detail}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── KpiCard ───────────────────────────────────────────────────────────────────
function KpiCard({ kpi, T }) {
  const pos = kpi.change !== null && kpi.change > 0;
  const neg = kpi.change !== null && kpi.change < 0;
  const icons = {
    currency: <DollarSign size={13} style={{ color:'#10b981' }}/>,
    count:    <Database   size={13} style={{ color:'#6366f1' }}/>,
    percent:  <Target     size={13} style={{ color:'#f59e0b' }}/>,
    person:   <Users      size={13} style={{ color:'#8b5cf6' }}/>,
    trend:    <Activity   size={13} style={{ color:'#3b82f6' }}/>,
    time:     <Clock      size={13} style={{ color:'#06b6d4' }}/>,
  };
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:'1.1rem',
      transition:'border-color .2s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.55rem' }}>
        <div style={{ fontSize:'.68rem', fontWeight:700, color:T.sub, textTransform:'uppercase', letterSpacing:'.06em' }}>{kpi.label}</div>
        {icons[kpi.icon] || icons.count}
      </div>
      <div style={{ fontSize:'1.75rem', fontWeight:800, color:T.text, lineHeight:1, marginBottom:'.45rem' }}>{kpi.formatted}</div>
      <div style={{ display:'flex', alignItems:'center', gap:'.4rem', flexWrap:'wrap' }}>
        {pos && <><ArrowUpRight size={12} style={{ color:'#10b981' }}/><span style={{ fontSize:'.7rem', color:'#10b981', fontWeight:600 }}>+{kpi.change?.toFixed(1)}%</span></>}
        {neg && <><ArrowDownRight size={12} style={{ color:'#ef4444' }}/><span style={{ fontSize:'.7rem', color:'#ef4444', fontWeight:600 }}>{kpi.change?.toFixed(1)}%</span></>}
        {!pos && !neg && <><Minus size={10} style={{ color:T.sub }}/><span style={{ fontSize:'.68rem', color:T.sub }}>Stable</span></>}
        {kpi.changeLabel && <span style={{ fontSize:'.65rem', color:T.sub }}>{kpi.changeLabel}</span>}
      </div>
      {kpi.sparkline?.length >= 3 && (
        <div style={{ marginTop:'.6rem', height:26 }}>
          <ResponsiveContainer width="100%" height={26}>
            <ReArea data={kpi.sparkline.map((v, i) => ({ i, v }))} margin={{ top:0, right:0, bottom:0, left:0 }}>
              <Area type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={1.5} fill="rgba(99,102,241,0.12)" dot={false} isAnimationActive={false}/>
            </ReArea>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── AIHealthBadge ─────────────────────────────────────────────────────────────
function AIHealthBadge({ health, T }) {
  if (!health) return null;
  const services = [
    { key: 'gemini', label: 'Gemini',   model: 'gemini-2.5-flash' },
    { key: 'openai', label: 'ChatGPT',  model: 'gpt-4.1-mini'     },
    { key: 'puter',  label: 'Puter',    model: 'gpt-4o-mini'      },
    { key: 'groq',   label: 'Groq STT', model: 'whisper'          },
  ];
  const color = s => s === 'ok' ? '#10b981' : s === 'rate_limited' ? '#f59e0b' : s === 'no_key' ? '#64748b' : '#ef4444';
  const dot   = s => s === 'ok' ? '●' : s === 'rate_limited' ? '◑' : '○';
  const label = s => s === 'ok' ? 'Ready' : s === 'rate_limited' ? 'Limited' : s === 'no_key' ? 'No key' : s === 'checking' ? '…' : 'Error';

  return (
    <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap', alignItems:'center' }}>
      {services.map(({ key, label: name, model }) => {
        const status = health[key] || 'checking';
        const c = color(status);
        return (
          <div key={key} title={`${name} (${model}): ${label(status)}`}
            style={{ display:'flex', alignItems:'center', gap:'.28rem', padding:'.2rem .55rem',
              background: status === 'ok' ? 'rgba(16,185,129,0.08)' : status === 'rate_limited' ? 'rgba(245,158,11,0.08)' : 'rgba(100,116,139,0.08)',
              border: `1px solid ${c}30`, borderRadius:100 }}>
            <span style={{ fontSize:'.65rem', color: c }}>{dot(status)}</span>
            <span style={{ fontSize:'.68rem', fontWeight:600, color: c }}>{name}</span>
            <span style={{ fontSize:'.62rem', color: T.sub }}>{label(status)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── ChartWidget ───────────────────────────────────────────────────────────────
const TYPE_SWITCHER = [
  { type:'bar',      Icon: BarChart    },
  { type:'line',     Icon: LineIcon    },
  { type:'area',     Icon: TrendingUp  },
  { type:'pie',      Icon: PieIcon     },
  { type:'scatter',  Icon: ScatterIcon },
  { type:'radar',    Icon: RadarIcon   },
  { type:'composed', Icon: GitMerge    },
];

function ChartWidget({ spec: initSpec, data, T, onExpand }) {
  const [activeType, setActiveType] = useState(initSpec.type === 'hbar' ? 'bar' : initSpec.type);
  const spec = { ...initSpec, type: activeType };
  const chartData = data || [];
  const keys = chartData.length > 0
    ? Object.keys(chartData[0]).filter(k => !['name','growth','isPeak','isWorst'].includes(k))
    : ['value'];

  const fmtY = v => {
    if (v >= 1e7) return `${(v/1e7).toFixed(1)}Cr`;
    if (v >= 1e5) return `${(v/1e5).toFixed(1)}L`;
    if (v >= 1e3) return `${(v/1e3).toFixed(0)}K`;
    return Math.round(v).toLocaleString('en-IN');
  };
  const ttStyle = { background:T.card, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, fontSize:'.73rem' };
  const axTick  = { fill:T.sub, fontSize:10 };
  const common  = { data: chartData, margin:{ top:5, right:10, left:-10, bottom:5 } };

  const chart = (() => {
    switch (spec.type) {
      case 'bar': return (
        <ReBar {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
          <XAxis dataKey="name" tick={axTick} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
          <YAxis tick={axTick} tickLine={false} axisLine={false} tickFormatter={fmtY}/>
          <Tooltip contentStyle={ttStyle} formatter={v => [fmtY(v)]}/>
          <Legend wrapperStyle={{ color:T.sub, fontSize:10 }}/>
          {keys.map((k,i) => <Bar key={k} dataKey={k} fill={COLORS[i%COLORS.length]} radius={[4,4,0,0]}/>)}
        </ReBar>
      );
      case 'hbar': return (
        <ReBar layout="horizontal" {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false}/>
          <XAxis type="number" tick={axTick} tickLine={false} axisLine={false} tickFormatter={fmtY}/>
          <YAxis type="category" dataKey="name" width={110} tick={{ ...axTick, fontSize:9 }} tickLine={false} axisLine={false}/>
          <Tooltip contentStyle={ttStyle} formatter={v => [fmtY(v)]}/>
          {keys.map((k,i) => <Bar key={k} dataKey={k} fill={COLORS[i%COLORS.length]} radius={[0,4,4,0]}/>)}
        </ReBar>
      );
      case 'line': return (
        <ReLine {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
          <XAxis dataKey="name" tick={axTick} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
          <YAxis tick={axTick} tickLine={false} axisLine={false} tickFormatter={fmtY}/>
          <Tooltip contentStyle={ttStyle} formatter={v => [fmtY(v)]}/>
          <Legend wrapperStyle={{ color:T.sub, fontSize:10 }}/>
          {keys.map((k,i) => <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i%COLORS.length]} strokeWidth={2.5} dot={false} activeDot={{ r:4 }}/>)}
        </ReLine>
      );
      case 'area': return (
        <ReArea {...common}>
          <defs>
            {keys.map((k,i) => (
              <linearGradient key={k} id={`ag${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={COLORS[i%COLORS.length]} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={COLORS[i%COLORS.length]} stopOpacity={0}/>
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
          <XAxis dataKey="name" tick={axTick} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
          <YAxis tick={axTick} tickLine={false} axisLine={false} tickFormatter={fmtY}/>
          <Tooltip contentStyle={ttStyle} formatter={v => [fmtY(v)]}/>
          <Legend wrapperStyle={{ color:T.sub, fontSize:10 }}/>
          {keys.map((k,i) => <Area key={k} type="monotone" dataKey={k} stroke={COLORS[i%COLORS.length]} strokeWidth={2.5} fill={`url(#ag${i})`}/>)}
        </ReArea>
      );
      case 'pie': return (
        <RePie>
          <Pie data={chartData} cx="50%" cy="50%" outerRadius={88} dataKey="value" nameKey="name"
            label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
          </Pie>
          <Tooltip contentStyle={ttStyle}/>
        </RePie>
      );
      case 'scatter': {
        const xKey = keys[0] || 'value';
        const yKey = keys[1] || keys[0] || 'value';
        const scatterPts = chartData.map(d => ({ x: parseFloat(d[xKey])||0, y: parseFloat(d[yKey])||0, name: d.name }));
        return (
          <ReScatter margin={{ top:5, right:10, left:-10, bottom:5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
            <XAxis dataKey="x" type="number" name={xKey} tick={axTick} tickLine={false} axisLine={false} tickFormatter={fmtY}/>
            <YAxis dataKey="y" type="number" name={yKey} tick={axTick} tickLine={false} axisLine={false} tickFormatter={fmtY}/>
            <Tooltip contentStyle={ttStyle} cursor={{ strokeDasharray:'3 3' }}
              content={({ payload }) => payload?.[0] ? (
                <div style={ttStyle}><div style={{ padding:'.35rem .6rem', fontSize:'.73rem' }}>
                  <div style={{ fontWeight:600, color:T.text }}>{payload[0].payload.name}</div>
                  <div>{xKey}: {fmtY(payload[0].payload.x)}</div>
                  <div>{yKey}: {fmtY(payload[0].payload.y)}</div>
                </div></div>
              ) : null}/>
            <Scatter data={scatterPts} fill={COLORS[0]} fillOpacity={0.75}/>
          </ReScatter>
        );
      }
      case 'radar': {
        const metrics = keys.slice(0, 6);
        return (
          <ReRadar cx="50%" cy="50%" outerRadius={80} data={chartData.slice(0, 12)}>
            <PolarGrid stroke={T.border}/>
            <PolarAngleAxis dataKey="name" tick={{ fill:T.sub, fontSize:9 }}/>
            <PolarRadiusAxis tick={false} axisLine={false}/>
            <Tooltip contentStyle={ttStyle} formatter={v => [fmtY(v)]}/>
            {metrics.map((k, i) => (
              <Radar key={k} name={k} dataKey={k} stroke={COLORS[i%COLORS.length]} fill={COLORS[i%COLORS.length]} fillOpacity={0.18}/>
            ))}
            <Legend wrapperStyle={{ color:T.sub, fontSize:10 }}/>
          </ReRadar>
        );
      }
      case 'composed': {
        const barKey  = keys[0] || 'value';
        const lineKey = keys[1] || null;
        return (
          <ReComposed {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
            <XAxis dataKey="name" tick={axTick} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
            <YAxis tick={axTick} tickLine={false} axisLine={false} tickFormatter={fmtY}/>
            <Tooltip contentStyle={ttStyle} formatter={v => [fmtY(v)]}/>
            <Legend wrapperStyle={{ color:T.sub, fontSize:10 }}/>
            <Bar dataKey={barKey} fill={COLORS[0]} radius={[4,4,0,0]} fillOpacity={0.85}/>
            {lineKey && <Line type="monotone" dataKey={lineKey} stroke={COLORS[1]} strokeWidth={2.5} dot={false}/>}
          </ReComposed>
        );
      }
      default: return null;
    }
  })();

  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:'1rem',
      display:'flex', flexDirection:'column', gap:'.5rem', transition:'border-color .2s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'.5rem' }}>
        <div>
          <div style={{ fontWeight:600, fontSize:'.83rem', color:T.text }}>{initSpec.title}</div>
          {initSpec.description && <div style={{ fontSize:'.68rem', color:T.sub }}>{initSpec.description}</div>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'.22rem' }}>
          {TYPE_SWITCHER.map(({ type, Icon }) => (
            <button key={type} onClick={() => setActiveType(type)}
              style={{ background: activeType===type ? 'rgba(99,102,241,0.15)' : 'none',
                border:`1px solid ${activeType===type ? '#6366f1' : T.border}`, borderRadius:6,
                padding:'.2rem .35rem', cursor:'pointer', color: activeType===type ? '#6366f1' : T.sub, display:'flex' }}>
              <Icon size={10}/>
            </button>
          ))}
          <button onClick={onExpand} style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:6,
            padding:'.2rem .35rem', cursor:'pointer', color:T.sub, display:'flex', marginLeft:'.12rem' }}>
            <TrendingUp size={10}/>
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={218}>
        {chart || <div/>}
      </ResponsiveContainer>
    </div>
  );
}

// ─── AgentLeaderboard ──────────────────────────────────────────────────────────
function AgentLeaderboard({ agentData, T }) {
  if (!agentData?.length) return null;
  const maxVal = agentData[0]?.value || 1;
  const medals = ['🥇','🥈','🥉'];
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:'1.1rem' }}>
      <div style={{ fontWeight:700, fontSize:'.86rem', color:T.text, marginBottom:'.8rem',
        display:'flex', alignItems:'center', gap:'.5rem' }}>
        <Trophy size={13} style={{ color:'#f59e0b' }}/> Performance Leaderboard
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'.38rem' }}>
        {agentData.slice(0, 10).map((a, i) => (
          <div key={a.name} style={{ display:'flex', alignItems:'center', gap:'.65rem' }}>
            <div style={{ width:20, textAlign:'center', fontSize:'.75rem', flexShrink:0 }}>
              {i < 3 ? medals[i] : <span style={{ color:T.sub, fontWeight:600, fontSize:'.72rem' }}>{i+1}</span>}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.15rem' }}>
                <span style={{ fontSize:'.78rem', fontWeight:600, color:T.text,
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'60%' }}>{a.name}</span>
                <span style={{ fontSize:'.73rem', fontWeight:700, color:'#10b981', flexShrink:0 }}>
                  {formatKPIValue(a.value, 'payment')}
                </span>
              </div>
              <div style={{ height:4, background:T.hover, borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:3, width:`${(a.value/maxVal)*100}%`,
                  background: i===0 ? '#f59e0b' : i===1 ? '#94a3b8' : i===2 ? '#b45309' : '#6366f1', transition:'width .5s' }}/>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── DataTable ─────────────────────────────────────────────────────────────────
function DataTable({ rows, headers, T }) {
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const PER = 10;

  const sorted = useMemo(() => {
    if (!sortCol) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortCol] ?? '', bv = b[sortCol] ?? '';
      const n = parseFloat(av) - parseFloat(bv);
      const r = isNaN(n) ? String(av).localeCompare(String(bv)) : n;
      return sortDir === 'asc' ? r : -r;
    });
  }, [rows, sortCol, sortDir]);

  const visible = sorted.slice(page * PER, (page + 1) * PER);
  const total   = Math.ceil(rows.length / PER);

  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, overflow:'hidden' }}>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.76rem' }}>
          <thead>
            <tr style={{ background: T.hover }}>
              {headers.map(h => (
                <th key={h} onClick={() => { if (sortCol === h) setSortDir(d => d==='asc'?'desc':'asc'); else { setSortCol(h); setSortDir('asc'); } }}
                  style={{ padding:'.48rem .7rem', textAlign:'left', color:T.sub, fontWeight:700, fontSize:'.65rem',
                    textTransform:'uppercase', letterSpacing:'.04em', borderBottom:`1px solid ${T.border}`,
                    whiteSpace:'nowrap', cursor:'pointer', userSelect:'none' }}>
                  {h} {sortCol === h ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={i} style={{ borderBottom:`1px solid ${T.border}` }}
                onMouseEnter={e => e.currentTarget.style.background = T.hover}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {headers.map(h => (
                  <td key={h} style={{ padding:'.4rem .7rem', color:T.text, whiteSpace:'nowrap', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis' }}>
                    {String(row[h] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > 1 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'.45rem .7rem', borderTop:`1px solid ${T.border}`, fontSize:'.7rem', color:T.sub }}>
          <span>Showing {page*PER+1}–{Math.min((page+1)*PER, rows.length)} of {rows.length.toLocaleString()}</span>
          <div style={{ display:'flex', gap:'.28rem' }}>
            {[['← Prev', page>0, ()=>setPage(p=>p-1)], ['Next →', page<total-1, ()=>setPage(p=>p+1)]].map(([lbl, en, fn]) => (
              <button key={lbl} disabled={!en} onClick={fn}
                style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:6,
                  padding:'.16rem .5rem', cursor:en?'pointer':'not-allowed', color:en?T.text:T.sub }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AiDashboardMaker() {
  const { user } = useAuth();
  const rateLimit = useAiRateLimit('dashboard-maker');
  const store = useDashboardStore();
  const T = store.theme === 'dark' ? DARK : LIGHT;

  // Local state
  const [dataSource, setDataSource]   = useState('file');   // 'file' | 'url'
  const [dataQuality, setDataQuality] = useState(null);
  const [aiHealth, setAiHealth]       = useState(null);     // health check results

  // Init per-user storage when user changes
  useEffect(() => { store.initUser(user?.id || null); }, [user?.id]);

  // AI health check on mount
  useEffect(() => {
    const hasPuter = typeof window !== 'undefined' && !!(window.puter?.ai?.chat);
    setAiHealth({ gemini: 'checking', openai: 'checking', groq: 'checking', puter: hasPuter ? 'ok' : 'no_key' });
    fetch(`${API_BASE_URL}/api/ai/health`)
      .then(r => r.json())
      .then(d => setAiHealth(prev => ({
        ...prev,
        gemini: d.gemini || 'error',
        openai: d.openai || 'error',
        groq:   d.groq   || 'error',
      })))
      .catch(() => setAiHealth(prev => ({ ...prev, gemini: 'error', openai: 'error', groq: 'error' })));
  }, []);

  // Close col override dropdown on outside click
  useEffect(() => {
    const handler = () => {};
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // ── Recompute analysis on override changes ──────────────────────────────────
  const effectiveAnalysis = useMemo(() => {
    const { analysis, semanticOverrides } = store;
    if (!analysis || !Object.keys(semanticOverrides).length) return analysis;
    const sm = { ...analysis.colMeta };
    Object.entries(semanticOverrides).forEach(([col, st]) => {
      if (sm[col]) sm[col] = { ...sm[col], semanticType: st };
    });
    const getFirstST = (...types) => analysis.headers.find(h => types.includes(sm[h]?.semanticType)) || null;
    return {
      ...analysis, colMeta: sm,
      primaryDateCol:     getFirstST('date','datetime','month_col'),
      primaryAmountCol:   getFirstST('revenue','payment','collection','cost','profit','balance','invoice_amt','salary','emi','commission','numeric'),
      primaryAgentCol:    getFirstST('agent','employee','caller'),
      primaryStatusCol:   getFirstST('status'),
      primaryCategoryCol: getFirstST('category','product','region','channel','source','branch','department'),
    };
  }, [store.analysis, store.semanticOverrides]);

  // ── Derived intelligence (computed from effectiveAnalysis) ──────────────────
  const relationships = useMemo(() => effectiveAnalysis ? detectRelationships(effectiveAnalysis) : [], [effectiveAnalysis]);
  const columnGroups  = useMemo(() => effectiveAnalysis ? groupColumns(effectiveAnalysis) : [], [effectiveAnalysis]);
  const dashboardRecs = useMemo(() => effectiveAnalysis ? recommendDashboards(effectiveAnalysis) : [], [effectiveAnalysis]);
  const kpiPreviews   = useMemo(() => {
    if (!effectiveAnalysis || !store.rows.length) return [];
    return generateKPIs(effectiveAnalysis, store.rows.slice(0, 500), 6);
  }, [effectiveAnalysis]);
  const insights      = useMemo(() => {
    if (!effectiveAnalysis || !store.rows.length) return [];
    return generateInsights(effectiveAnalysis, store.rows);
  }, [effectiveAnalysis, store.rows]);

  // ── Process parsed data (shared by file and URL loading) ──────────────────
  const processData = useCallback((data, hdrs, sourceName = 'file') => {
    if (!data.length) { toast.error('Dataset is empty'); return; }
    const analysis = analyzeDataset(data, hdrs);
    const quality  = analyzeDataQuality(data, hdrs);
    store.setFile({ name: sourceName }, data, hdrs, analysis);
    setDataQuality(quality);
    toast.success(`Loaded ${data.length.toLocaleString()} rows × ${hdrs.length} columns`);
  }, []);

  // ── File parsing ────────────────────────────────────────────────────────────
  const handleFile = useCallback(async (f) => {
    if (!f) return;
    try {
      const buf  = await f.arrayBuffer();
      const wb   = XLSX.read(buf, { type:'array', cellDates:false });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { defval:'' });
      processData(data, Object.keys(data[0] || {}), f.name);
    } catch (err) {
      toast.error('Failed to read file: ' + err.message);
    }
  }, [processData]);

  // ── Dashboard generation ────────────────────────────────────────────────────
  const generateDashboard = async () => {
    if (store.loading) return;

    // Login mandatory
    if (!user) {
      toast.error('Please sign in to generate dashboards');
      return;
    }

    // Total dashboard limit (3 for non-admin users)
    if (!rateLimit.consume()) {
      toast.error(`Dashboard limit reached (${rateLimit.maxCalls} total). You cannot create more.`);
      return;
    }

    store.setLoading(true);
    store.setGenStage(0);
    store.setStep('generating');

    try {
      const ea = effectiveAnalysis || store.analysis;
      await new Promise(r => setTimeout(r, 280));
      store.setGenStage(1);

      const payload = {
        headers:         ea.headers,
        sampleRows:      store.rows.slice(0, 10),
        columnTypes:     Object.fromEntries(ea.headers.map(h => [h, ea.colMeta[h]?.dataType])),
        columnSemantics: Object.fromEntries(ea.headers.map(h => [h, ea.colMeta[h]?.semanticType])),
        userPrompt:      store.userPrompt,
        helperText:      store.columnHelp,
        rowCount:        store.rows.length,
      };

      let plan   = null;
      let source = 'engine';
      const localPlan = buildFallbackPlan(ea, store.userPrompt);
      const shouldCallAI = ea.needsAI || store.userPrompt.trim().length > 0;

      // ── Level 2: Gemini ───────────────────────────────────────────────────
      if (shouldCallAI) {
        try {
          const ctrl  = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 28000);
          const resp  = await fetch(`${API_BASE_URL}/api/ai/dashboard-plan`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify(payload), signal: ctrl.signal,
          });
          clearTimeout(timer);
          const data = await resp.json();
          if (data.success) { plan = data.plan; source = data.source || 'gemini'; }
          else {
            const msgs = { RATE_LIMITED:'AI rate limited', TIMEOUT:'AI timed out', PARSE_ERROR:'AI response invalid', EMPTY_RESPONSE:'AI returned empty' };
            toast(msgs[data.code] || 'AI unavailable — using intelligence engine', { icon:'⚡' });
          }
        } catch (netErr) {
          toast(netErr.name === 'AbortError' ? 'AI timed out — using intelligence engine' : 'Using local intelligence engine', { icon:'⚡' });
        }

        // ── Level 3: Puter AI ─────────────────────────────────────────────
        if (!plan && typeof window !== 'undefined' && window.puter?.ai?.chat) {
          toast('Trying Puter AI…', { icon:'☁', id:'puter-attempt' });
          try {
            const aiPayload = buildAIPayload(ea, store.userPrompt, store.columnHelp);
            const raw = await window.puter.ai.chat(
              `You are a BI expert. Return ONLY valid JSON: {"title":"","subtitle":"","insights":[],"charts":[{"type":"bar|line|area|pie","title":"","description":"","xCol":"","yCol":"","aggregation":"sum|count","timeSeries":false,"limit":15}]}\n\n${aiPayload}`,
              { model:'gpt-4o-mini' }
            );
            const txt = typeof raw === 'string' ? raw : raw?.message?.content || '';
            const m = txt.match(/\{[\s\S]*\}/);
            if (m) { plan = JSON.parse(m[0]); source = 'puter'; }
          } catch {}
          toast.dismiss('puter-attempt');
        }

        if (!plan && store.userPrompt.trim().length > 0) {
          toast('AI unavailable — intelligence engine is building your dashboard', { icon:'⚙', duration:4000 });
        }
      }

      if (!plan) { plan = localPlan; source = 'engine'; }
      store.setGenStage(2);

      // Build chart data
      const builtCharts = (plan.charts || []).map(spec => {
        let data;
        if (spec.timeSeries && ea.primaryDateCol) {
          data = buildDateTrends(store.rows, spec.xCol, spec.yCol || null, spec.timeGroupBy || 'month');
        } else {
          data = aggregateForChart(store.rows, spec.xCol, spec.yCol || null, spec.aggregation || 'sum', spec.limit || 20);
        }
        return { spec, data };
      }).filter(c => c.data && c.data.length > 0);

      const kpis         = generateKPIs(ea, store.rows);
      const engineInsights = generateInsights(ea, store.rows, 5);
      const aiInsights   = plan.insights || [];
      const allInsights  = [...aiInsights, ...engineInsights].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 6);

      // Agent leaderboard
      let agentData = null;
      if (ea.primaryAgentCol) {
        const totals = {};
        store.rows.forEach(r => {
          const ag = String(r[ea.primaryAgentCol] || '').trim();
          if (!ag) return;
          const v = ea.primaryAmountCol ? (parseFloat(String(r[ea.primaryAmountCol]||0).replace(/[₹Rs.,$ %]/g,''))||0) : 1;
          totals[ag] = (totals[ag]||0) + v;
        });
        agentData = Object.entries(totals).sort(([,a],[,b])=>b-a).slice(0,15).map(([name,value],i)=>({rank:i+1,name,value}));
      }

      const entry = {
        id:        `dash_${Date.now()}`,
        title:     plan.title || 'Dashboard',
        fileName:  store.file?.name || 'unknown',
        rowCount:  store.rows.length,
        headers:   ea.headers,
        createdAt: Date.now(),
        plan, kpis, theme: store.theme,
      };
      store.saveDashboardEntry(entry);
      store.setGenStage(3);
      await new Promise(r => setTimeout(r, 320));
      store.setDashboard({ plan:{ ...plan, insights:allInsights }, kpis, builtCharts, agentData, source, savedId:entry.id });

      const srcLabels = { gemini:'✦ Gemini AI', puter:'☁ Puter AI', engine:'⚙ Intelligence Engine' };
      toast.success(`Dashboard ready — ${srcLabels[source] || source}`);

    } catch (err) {
      toast.error('Generation failed: ' + err.message);
      store.setStep('schema');
    } finally {
      store.setLoading(false);
    }
  };

  const handleRestore = (d) => {
    const builtCharts = (d.plan?.charts || []).map(spec => {
      const data = spec.timeSeries
        ? buildDateTrends(store.rows, spec.xCol, spec.yCol||null, spec.timeGroupBy||'month')
        : aggregateForChart(store.rows, spec.xCol, spec.yCol||null, spec.aggregation||'sum', spec.limit||20);
      return { spec, data };
    }).filter(c => c.data?.length > 0);
    store.setDashboard({ ...d, builtCharts, source:'restored' });
  };

  const downloadCSV = () => {
    const { rows, headers, file } = store;
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h]||'').replace(/"/g,'""')}"`).join(','))].join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type:'text/csv' })),
      download: `${file?.name?.replace(/\.[^.]+$/,'') || 'export'}_dashboard.csv`,
    });
    a.click(); URL.revokeObjectURL(a.href);
    toast.success('CSV exported');
  };

  const sourceBadge = (src) => ({
    gemini:   { label:'✦ Gemini AI',  color:'#818cf8', bg:'rgba(99,102,241,0.12)'  },
    puter:    { label:'☁ Puter AI',   color:'#22d3ee', bg:'rgba(6,182,212,0.12)'   },
    engine:   { label:'⚙ Engine',     color:'#10b981', bg:'rgba(16,185,129,0.12)'  },
    restored: { label:'⏱ Restored',   color:'#94a3b8', bg:'rgba(148,163,184,0.1)'  },
  }[src] || { label:'⚙ Engine', color:'#10b981', bg:'rgba(16,185,129,0.12)' });

  const { step, genStage, loading, dashboard, expandedChart, showTable, theme, recent } = store;
  const { rows, headers, analysis } = store;

  return (
    <div style={{ minHeight:'100vh', background:T.page, color:T.text, fontFamily:'system-ui,sans-serif' }}>
      {/* Login gate — must be signed in */}
      {!user && <AiLoginGate toolName="AI Dashboard Maker" />}

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(99,102,241,0.3);border-radius:99px}
        *{box-sizing:border-box}
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ borderBottom:`1px solid ${T.border}`, padding:'.65rem 1.5rem',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        background:T.glass, position:'sticky', top:0, zIndex:50, backdropFilter:'blur(16px)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'.65rem' }}>
          <div style={{ width:32, height:32, background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
            borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 4px 12px rgba(99,102,241,0.35)' }}>
            <BarChart2 size={16} style={{ color:'#fff' }}/>
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:'.92rem' }}>AI Dashboard Maker</div>
            <div style={{ fontSize:'.62rem', color:T.sub }}>Autonomous Business Intelligence</div>
          </div>
          {dashboard?.source && (() => {
            const b = sourceBadge(dashboard.source);
            return (
              <span style={{ marginLeft:'.25rem', padding:'.14rem .5rem', borderRadius:100,
                fontSize:'.65rem', fontWeight:600, background:b.bg, color:b.color }}>{b.label}</span>
            );
          })()}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'.4rem' }}>
          {step === 'schema' && (
            <button onClick={() => { store.resetAll(); setDataQuality(null); }}
              style={{ display:'inline-flex', alignItems:'center', gap:'.3rem', background:T.input,
                border:`1px solid ${T.border}`, borderRadius:8, padding:'.36rem .7rem',
                cursor:'pointer', color:T.text, fontSize:'.74rem' }}>
              <ArrowLeft size={11}/> Back
            </button>
          )}
          {step === 'dashboard' && (
            <>
              <button onClick={downloadCSV}
                style={{ display:'inline-flex', alignItems:'center', gap:'.3rem', background:T.input,
                  border:`1px solid ${T.border}`, borderRadius:8, padding:'.36rem .7rem',
                  cursor:'pointer', color:T.text, fontSize:'.74rem' }}>
                <Download size={11}/> Export
              </button>
              <button onClick={() => store.setStep('schema')}
                style={{ display:'inline-flex', alignItems:'center', gap:'.3rem', background:T.input,
                  border:`1px solid ${T.border}`, borderRadius:8, padding:'.36rem .7rem',
                  cursor:'pointer', color:T.text, fontSize:'.74rem' }}>
                <ArrowLeft size={11}/> Back
              </button>
              <button onClick={() => store.setStep('schema')}
                style={{ display:'inline-flex', alignItems:'center', gap:'.3rem', background:T.input,
                  border:`1px solid ${T.border}`, borderRadius:8, padding:'.36rem .7rem',
                  cursor:'pointer', color:T.text, fontSize:'.74rem' }}>
                <RefreshCw size={11}/> Reconfigure
              </button>
              <button onClick={() => { store.resetAll(); setDataQuality(null); }}
                style={{ display:'inline-flex', alignItems:'center', gap:'.3rem', background:T.input,
                  border:`1px solid ${T.border}`, borderRadius:8, padding:'.36rem .7rem',
                  cursor:'pointer', color:T.text, fontSize:'.74rem' }}>
                <X size={11}/> New
              </button>
            </>
          )}
          {user && (
            <div style={{ display:'flex', alignItems:'center', gap:'.4rem', padding:'.28rem .6rem',
              background:T.input, border:`1px solid ${T.border}`, borderRadius:8 }}>
              {user.avatar
                ? <img src={user.avatar} alt="" style={{ width:18, height:18, borderRadius:'50%', objectFit:'cover' }}/>
                : <User size={12} style={{ color:T.sub }}/>}
              <span style={{ fontSize:'.7rem', color:T.sub, maxWidth:80, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {user.name || user.email}
              </span>
            </div>
          )}
          <button onClick={() => store.setTheme(theme === 'dark' ? 'light' : 'dark')}
            style={{ background:T.input, border:`1px solid ${T.border}`, borderRadius:8,
              padding:'.36rem', cursor:'pointer', display:'flex', alignItems:'center', color:T.sub }}>
            {theme === 'dark' ? <Sun size={13}/> : <Moon size={13}/>}
          </button>
        </div>
      </div>

      <div style={{ maxWidth:1280, margin:'0 auto', padding:'1.5rem 1.25rem' }}>

        {/* ── Upload step ───────────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div style={{ maxWidth:720, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:'2rem' }}>
              <div style={{ fontSize:'2rem', fontWeight:800, marginBottom:'.4rem',
                background:'linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                Turn data into dashboards
              </div>
              <div style={{ color:T.sub, fontSize:'.92rem' }}>
                Proprietary intelligence engine — understands your business automatically
              </div>
            </div>

            {/* Data source tabs */}
            <div style={{ display:'flex', gap:'.3rem', marginBottom:'1rem',
              background:T.input, border:`1px solid ${T.border}`, borderRadius:10, padding:'.25rem' }}>
              {[
                { id:'file', icon: Upload,    label:'Upload File'    },
                { id:'url',  icon: Link2,     label:'Paste URL'      },
              ].map(({ id, icon:Icon, label }) => (
                <button key={id} onClick={() => setDataSource(id)}
                  style={{ flex:1, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:'.4rem',
                    background: dataSource===id ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'none',
                    color: dataSource===id ? '#fff' : T.sub,
                    border:'none', borderRadius:8, padding:'.45rem .75rem', cursor:'pointer',
                    fontSize:'.8rem', fontWeight:600, transition:'all .15s',
                    boxShadow: dataSource===id ? '0 4px 12px rgba(99,102,241,0.3)' : 'none' }}>
                  <Icon size={13}/> {label}
                </button>
              ))}
            </div>

            {/* Data source content */}
            <div style={{ marginBottom:'1rem' }}>
              {dataSource === 'file' && <UploadZone onFile={handleFile} T={T}/>}
              {dataSource === 'url'  && (
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:'1.5rem' }}>
                  <UrlDataSource onData={processData} T={T}/>
                </div>
              )}
            </div>

            {/* Engine capabilities */}
            <div style={{ marginBottom:'.75rem', padding:'.75rem 1rem',
              background:'rgba(99,102,241,0.04)', border:'1px solid rgba(99,102,241,0.12)', borderRadius:12 }}>
              <div style={{ display:'flex', gap:'1.5rem', flexWrap:'wrap', justifyContent:'center' }}>
                {[
                  { icon:Cpu,         label:'Semantic Engine',     desc:'47 types auto-detected' },
                  { icon:GitBranch,   label:'Relationship Engine', desc:'Discovers business flows' },
                  { icon:Brain,       label:'AI Assist',           desc:'Gemini · Puter AI' },
                  { icon:FlaskConical,label:'Analytics Engine',    desc:'Stats, trends, anomalies' },
                ].map(({ icon:Icon, label, desc }) => (
                  <div key={label} style={{ display:'flex', alignItems:'center', gap:'.45rem' }}>
                    <Icon size={13} style={{ color:'#6366f1', flexShrink:0 }}/>
                    <div>
                      <div style={{ fontSize:'.72rem', fontWeight:600, color:T.text }}>{label}</div>
                      <div style={{ fontSize:'.65rem', color:T.sub }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Status */}
            {aiHealth && (
              <div style={{ marginBottom:'.75rem', padding:'.65rem .9rem',
                background:T.input, border:`1px solid ${T.border}`, borderRadius:10,
                display:'flex', gap:'.65rem', alignItems:'center', flexWrap:'wrap' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'.35rem' }}>
                  <Wifi size={11} style={{ color:'#6366f1' }}/>
                  <span style={{ fontSize:'.7rem', fontWeight:700, color:T.sub, textTransform:'uppercase', letterSpacing:'.04em' }}>AI Services</span>
                </div>
                <AIHealthBadge health={aiHealth} T={T}/>
              </div>
            )}

            {/* Privacy note */}
            <div style={{ marginBottom:'.75rem', padding:'.65rem .9rem',
              background:'rgba(16,185,129,0.04)', border:'1px solid rgba(16,185,129,0.1)', borderRadius:10,
              display:'flex', gap:'.55rem', alignItems:'flex-start' }}>
              <Info size={12} style={{ color:'#10b981', flexShrink:0, marginTop:2 }}/>
              <div style={{ fontSize:'.72rem', color:T.sub, lineHeight:1.5 }}>
                <strong style={{ color:'#34d399' }}>Privacy:</strong> Your dataset stays in the browser. Only column names, types, and 10 sample rows are sent to AI — never your full data.
              </div>
            </div>

            {/* Show dashboard usage badge + limit banner for logged-in users */}
            {user && (
              <div style={{ marginBottom: '.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AiRateLimitBadge hook={rateLimit} />
              </div>
            )}
            <AiRateLimitBanner hook={rateLimit} />

            {recent.length > 0 && (
              <div style={{ marginTop:'1.25rem' }}>
                <RecentDashboards dashboards={recent}
                  onRestore={d => { store.setFile({ name:d.fileName }, [], d.headers || [], null); handleRestore(d); }}
                  onDelete={id => store.deleteDashboard(id)}
                  T={T}/>
              </div>
            )}
          </div>
        )}

        {/* ── Schema / Intelligence step ─────────────────────────────────────── */}
        {step === 'schema' && analysis && (
          <IntelligenceCommandCenter
            analysis={analysis}
            effectiveAnalysis={effectiveAnalysis}
            semanticOverrides={store.semanticOverrides}
            setSemanticOverride={(col, type) => store.setSemanticOverride(col, type)}
            userPrompt={store.userPrompt}    setUserPrompt={store.setUserPrompt}
            columnHelp={store.columnHelp}    setColumnHelp={store.setColumnHelp}
            onGenerate={generateDashboard}
            loading={loading}
            T={T}
            onBack={() => { store.resetAll(); setDataQuality(null); }}
            relationships={relationships}
            columnGroups={columnGroups}
            dashboardRecs={dashboardRecs}
            insights={insights}
            dataQuality={dataQuality}
            kpiPreviews={kpiPreviews}
          />
        )}

        {/* ── Generating step ────────────────────────────────────────────────── */}
        {step === 'generating' && <GenerationProgress stage={genStage} T={T}/>}

        {/* ── Dashboard step ─────────────────────────────────────────────────── */}
        {step === 'dashboard' && dashboard && (() => {
          const { plan, kpis, builtCharts, agentData } = dashboard;
          const kpiCols = Math.min(kpis.length, 4);
          const laidOut = computeLayout(builtCharts.map(c => c.spec));
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
              <div>
                <div style={{ fontSize:'1.6rem', fontWeight:800, marginBottom:'.22rem' }}>{plan.title}</div>
                <div style={{ color:T.sub, fontSize:'.88rem' }}>{plan.subtitle}</div>
              </div>

              {kpis.length > 0 && (
                <div style={{ display:'grid', gridTemplateColumns:`repeat(${kpiCols},1fr)`, gap:'.85rem' }}>
                  {kpis.map((kpi, i) => <KpiCard key={kpi.id || i} kpi={kpi} T={T}/>)}
                </div>
              )}

              {plan.insights?.length > 0 && (
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:'1rem' }}>
                  <div style={{ fontWeight:600, fontSize:'.82rem', marginBottom:'.55rem',
                    display:'flex', alignItems:'center', gap:'.4rem' }}>
                    <Lightbulb size={12} style={{ color:'#6366f1' }}/> Key Insights
                    <span style={{ fontSize:'.63rem', color:T.sub, fontWeight:400, marginLeft:'.2rem' }}>
                      {dashboard.source === 'engine' ? '— generated by intelligence engine' : '— AI + engine combined'}
                    </span>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'.32rem' }}>
                    {plan.insights.map((ins, i) => (
                      <div key={i} style={{ display:'flex', gap:'.48rem', alignItems:'flex-start', fontSize:'.8rem', color:T.sub }}>
                        <CheckCircle size={11} style={{ color:'#10b981', flexShrink:0, marginTop:3 }}/>{ins.replace(/^[⚠↑]\s*/,'')}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {builtCharts.length > 0 && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                  {builtCharts.map((c, i) => {
                    const lo = laidOut.find(l => l.xCol === c.spec.xCol && l.yCol === c.spec.yCol);
                    const fullWidth = lo?.gridSpan === 2 || c.spec.width === 'full';
                    return (
                      <div key={i} style={{ gridColumn: fullWidth ? '1 / -1' : 'auto' }}>
                        <ChartWidget spec={c.spec} data={c.data} T={T} onExpand={() => store.setExpandedChart(c)}/>
                      </div>
                    );
                  })}
                </div>
              )}

              {agentData?.length > 0 && <AgentLeaderboard agentData={agentData} T={T}/>}

              <div>
                <button onClick={() => store.setShowTable(!showTable)}
                  style={{ display:'inline-flex', alignItems:'center', gap:'.35rem', background:T.input,
                    border:`1px solid ${T.border}`, borderRadius:8, padding:'.4rem .8rem',
                    cursor:'pointer', color:T.text, fontSize:'.76rem', marginBottom: showTable ? '.75rem' : 0 }}>
                  <Table2 size={11}/> {showTable ? 'Hide' : 'Show'} Raw Data Table
                </button>
                {showTable && rows.length > 0 && <DataTable rows={rows} headers={headers} T={T}/>}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Expanded chart modal ─────────────────────────────────────────────── */}
      {expandedChart && (
        <div onClick={() => store.setExpandedChart(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:1000,
            display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem', backdropFilter:'blur(10px)' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:20,
              padding:'1.5rem', width:'90vw', maxWidth:920 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <div>
                <div style={{ fontWeight:700, fontSize:'.96rem' }}>{expandedChart.spec.title}</div>
                {expandedChart.spec.description && <div style={{ fontSize:'.76rem', color:T.sub }}>{expandedChart.spec.description}</div>}
              </div>
              <button onClick={() => store.setExpandedChart(null)}
                style={{ background:'none', border:'none', cursor:'pointer', color:T.sub, display:'flex' }}>
                <X size={20}/>
              </button>
            </div>
            <div style={{ height:420 }}>
              <ChartWidget spec={expandedChart.spec} data={expandedChart.data} T={T} onExpand={() => {}}/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

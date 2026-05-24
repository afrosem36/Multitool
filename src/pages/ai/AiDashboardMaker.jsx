import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  Upload, FileSpreadsheet, Sparkles, BarChart2,
  Download, RefreshCw, X, CheckCircle, Table2,
  ArrowUpRight, Sun, Moon, Info,
  Clock, LayoutDashboard, ChevronRight,
  Database, Layers, GitBranch, Lightbulb, AlertTriangle, Target,
  LogIn, User, Shield, Brain, Cpu, FlaskConical, Link2, ChevronDown,
  Globe, ArrowLeft, Wifi,
  Share2, Check, Copy, Eye, Plus, Wand2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useAiRateLimit } from '../../hooks/useAiRateLimit';
import { AiLoginGate, AiRateLimitBanner, AiRateLimitBadge } from '../../components/shared/AiRateLimitGate';
import { useDashboardStore } from '../../store/dashboardStore';

// ── Engines ──────────────────────────────────────────────────────────────────
import { analyzeDataset, SEMANTIC_STYLE } from '../../engines/semanticEngine';
import { analyzeDataQuality } from '../../engines/analyticsEngine';
import { generateKPIs } from '../../engines/kpiEngine';
import { detectRelationships, groupColumns, recommendDashboards, REL_META } from '../../engines/relationshipEngine';
import { generateInsights } from '../../engines/insightEngine';
import { buildMultiTabPlan, normalizeAiPlan, planSignature } from '../../engines/tabPlanner';
import {
  DashboardCanvas, AgentLeaderboard, ChartWidget, buildChartData, ADVANCED_CHART_TYPES,
} from './dashboardComponents';
import BlueprintXPanel from './BlueprintXPanel';
import {
  toInternalChart, calculateKpiFromSpec, validateAIBlueprint, parseAIBlueprint,
  generateAIBlueprintPrompt,
} from '../../engines/blueprintSchema';

// ─── Constants ─────────────────────────────────────────────────────────────────

const DARK  = { page:'#07070f', card:'#0d0d1a', card2:'#111122', border:'rgba(255,255,255,0.07)', text:'#e2e8f0', sub:'#64748b', input:'rgba(255,255,255,0.05)', hover:'rgba(255,255,255,0.04)', glass:'rgba(13,13,26,0.85)' };
const LIGHT = { page:'#f0f4ff', card:'#ffffff',  card2:'#f8faff', border:'rgba(0,0,0,0.08)',       text:'#0f172a', sub:'#64748b', input:'rgba(0,0,0,0.04)',        hover:'rgba(0,0,0,0.03)',       glass:'rgba(255,255,255,0.9)' };
const FREE_DASHBOARD_LIMIT = 3;

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
  { id:'ai',     icon: Brain,       label:'AI analysis',             detail:'Gemini → OpenAI → Groq fallback chain'             },
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
// eslint-disable-next-line no-unused-vars
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
  rows,
}) {
  const ea = effectiveAnalysis || analysis;
  const { rowCount, avgConfidence, domain, colMeta } = ea;
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

      {/* ── BlueprintX — 3-mode dashboard generation ─────────────────────────── */}
      <BlueprintXPanel
        analysis={ea}
        rows={rows || []}
        headers={ea?.headers || []}
        userPrompt={userPrompt}
        columnHelp={columnHelp}
        onUserPromptChange={setUserPrompt}
        onColumnHelpChange={setColumnHelp}
        onGenerateBlueprint={onGenerate}
        loading={loading}
        T={T}
      />
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


// ─── AIHealthBadge ─────────────────────────────────────────────────────────────
function AIHealthBadge({ health, T }) {
  if (!health) return null;
  const services = [
    { key: 'gemini', label: 'Gemini',  model: 'gemini-3.1-flash-lite' },
    { key: 'openai', label: 'OpenAI',  model: 'gpt-4.1-mini'          },
    { key: 'groq',   label: 'Groq',    model: 'llama-3.3-70b'         },
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


// ─── Share Modal ──────────────────────────────────────────────────────────────
const CHART_TYPE_LABELS = {
  bar: 'Bar', horizontalBar: 'Horizontal Bar', stackedBar: 'Stacked Bar', line: 'Line',
  area: 'Area', pie: 'Pie', donut: 'Donut', composed: 'Composed', scatter: 'Scatter',
  radar: 'Radar', table: 'Table', heatmap: 'Heatmap', treemap: 'Treemap', funnel: 'Funnel',
  gauge: 'Gauge', radialBar: 'Radial Bar', waterfall: 'Waterfall', histogram: 'Histogram',
  correlationMatrix: 'Correlation Matrix', calendarHeatmap: 'Calendar Heatmap',
};

function getColumnSets(headers, analysis) {
  const colMeta = analysis?.colMeta || {};
  const numeric = headers.filter(h => colMeta[h]?.dataType === 'number' || colMeta[h]?.role === 'measure');
  const date = headers.filter(h => colMeta[h]?.dataType === 'date' || ['date','datetime','month_col','year_col','week_col','quarter_col'].includes(colMeta[h]?.semanticType));
  const category = headers.filter(h => !numeric.includes(h) && !['id','phone','email'].includes(colMeta[h]?.semanticType));
  const status = headers.filter(h => /status|stage|step|lifecycle|journey/i.test(h) || colMeta[h]?.semanticType === 'status');
  const percent = headers.filter(h => /percent|percentage|rate|ratio|achievement|conversion|sla/i.test(h) || ['percentage','rate','ratio'].includes(colMeta[h]?.semanticType));
  const target = headers.filter(h => /target|goal|quota|planned/i.test(h));
  return { numeric, date, category, status, percent, target };
}

function chartTypeInvalidReason(type, cols) {
  if (['line', 'area', 'calendarHeatmap'].includes(type) && cols.date.length < 1) return 'Needs a date column';
  if (type === 'scatter' && cols.numeric.length < 2) return 'Needs 2 numeric columns';
  if (type === 'correlationMatrix' && cols.numeric.length < 3) return 'Needs 3 numeric columns';
  if (['histogram', 'waterfall'].includes(type) && cols.numeric.length < 1) return 'Needs a numeric column';
  if (['heatmap', 'stackedBar'].includes(type) && cols.category.length < 2) return 'Needs 2 category/status columns';
  if (type === 'funnel' && cols.status.length < 1) return 'Needs a status/stage column';
  if (['gauge', 'radialBar'].includes(type) && cols.percent.length < 1 && !(cols.numeric.length && cols.target.length)) return 'Needs percent/rate or target columns';
  if (['pie', 'donut', 'treemap', 'radar'].includes(type) && cols.category.length < 1) return 'Needs a category column';
  return '';
}

function recommendChartIdeas(headers, analysis) {
  const cols = getColumnSets(headers, analysis);
  const ideas = [];
  if (analysis?.primaryAgentCol && analysis?.primaryStatusCol) ideas.push({ type:'heatmap', title:'Agent vs Status Heatmap', xCol:analysis.primaryAgentCol, yCol:analysis.primaryStatusCol, groupBy:analysis.primaryStatusCol, aggregation:'count', size:'wide' });
  if (analysis?.primaryCategoryCol && analysis?.primaryAmountCol) ideas.push({ type:'treemap', title:`${analysis.primaryCategoryCol} Contribution`, xCol:analysis.primaryCategoryCol, yCol:analysis.primaryAmountCol, aggregation:'sum', size:'medium' });
  if (analysis?.primaryStatusCol) ideas.push({ type:'funnel', title:`${analysis.primaryStatusCol} Funnel`, xCol:analysis.primaryStatusCol, aggregation:'count', size:'medium' });
  if (analysis?.primaryDateCol) ideas.push({ type:'calendarHeatmap', title:'Activity Calendar', xCol:analysis.primaryDateCol, yCol:analysis.primaryAmountCol || '', aggregation:analysis.primaryAmountCol ? 'sum' : 'count', size:'wide' });
  if (cols.numeric[0]) ideas.push({ type:'histogram', title:`${cols.numeric[0]} Distribution`, xCol:cols.numeric[0], yCol:cols.numeric[0], aggregation:'count', size:'medium' });
  if (cols.numeric.length >= 3) ideas.push({ type:'correlationMatrix', title:'Numeric Correlation Matrix', xCol:cols.numeric[0], yCol:cols.numeric[1], aggregation:'count', size:'wide' });
  if (analysis?.primaryAmountCol && cols.target[0]) ideas.push({ type:'gauge', title:`${analysis.primaryAmountCol} Achievement`, xCol:cols.target[0], aggregation:'average', size:'medium' });
  if (!ideas.length && headers[0]) ideas.push({ type:'bar', title:`${headers[0]} Breakdown`, xCol:headers[0], yCol:cols.numeric[0] || '', aggregation:cols.numeric[0] ? 'sum' : 'count', size:'medium' });
  return ideas.slice(0, 8);
}

function AddChartModal({ open, onClose, T, headers, analysis, dashboard, rows, onAdd }) {
  const cols = useMemo(() => getColumnSets(headers, analysis), [headers, analysis]);
  const ideas = useMemo(() => recommendChartIdeas(headers, analysis), [headers, analysis]);
  const [draft, setDraft] = useState({});

  useEffect(() => {
    if (!open) return;
    const idea = ideas[0] || {};
    setDraft({
      type: idea.type || 'bar', title: idea.title || 'New Chart',
      xCol: idea.xCol || headers[0] || '', yCol: idea.yCol || cols.numeric[0] || '',
      groupBy: idea.groupBy || (idea.type === 'heatmap' ? cols.category[1] || '' : ''),
      aggregation: idea.aggregation || 'count',
      tabId: dashboard?.plan?.tabs?.find(t => !t.isInsights)?.id || '',
      size: idea.size || 'medium',
    });
  }, [open, ideas, headers, cols.numeric, cols.category, dashboard]);

  if (!open) return null;
  const invalid = chartTypeInvalidReason(draft.type, cols);
  const needsNumericAgg = ['sum','average','min','max'].includes(draft.aggregation);
  const canAdd = !invalid && draft.title?.trim() && (draft.type === 'correlationMatrix' || draft.xCol) && (!needsNumericAgg || draft.yCol);
  const spec = {
    id: `custom_${Date.now()}_${draft.type}`,
    type: draft.type, title: draft.title || 'New Chart',
    description: `${CHART_TYPE_LABELS[draft.type] || draft.type} added locally`,
    xCol: draft.xCol || '', yCol: draft.yCol || null,
    valueColumn: draft.yCol || '', groupBy: draft.groupBy || '',
    aggregation: draft.aggregation === 'average' ? 'avg' : (draft.aggregation || 'count'),
    limit: 15, size: draft.size || 'medium',
    width: ['large','wide'].includes(draft.size) ? 'full' : 'half',
    reason: 'Added manually to answer an additional business question.',
  };
  const preview = buildChartData(spec, rows, analysis);

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:1150, background:'rgba(0,0,0,.72)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1.25rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ width:'min(980px, 100%)', maxHeight:'90vh', overflow:'auto', background:T.card, border:`1px solid ${T.border}`, borderRadius:16, padding:'1rem', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap:'1rem' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'.65rem' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontWeight:800, color:T.text }}>Add More Charts</div>
            <button onClick={onClose} style={{ background:'none', border:'none', color:T.sub, cursor:'pointer' }}><X size={18}/></button>
          </div>
          <input value={draft.title || ''} onChange={e => setDraft(d => ({ ...d, title:e.target.value }))} placeholder="Chart title" style={{ background:T.input, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, padding:'.5rem' }}/>
          <select value={draft.type || 'bar'} onChange={e => setDraft(d => ({ ...d, type:e.target.value }))} style={{ background:T.input, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, padding:'.5rem' }}>
            {ADVANCED_CHART_TYPES.filter(t => t !== 'kpiTrendCard').map(t => {
              const reason = chartTypeInvalidReason(t, cols);
              return <option key={t} value={t} disabled={!!reason}>{CHART_TYPE_LABELS[t] || t}{reason ? ` - ${reason}` : ''}</option>;
            })}
          </select>
          <select value={draft.xCol || ''} onChange={e => setDraft(d => ({ ...d, xCol:e.target.value }))} style={{ background:T.input, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, padding:'.5rem' }}>
            <option value="">Select X-axis</option>
            {headers.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
          <select value={draft.yCol || ''} onChange={e => setDraft(d => ({ ...d, yCol:e.target.value }))} style={{ background:T.input, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, padding:'.5rem' }}>
            <option value="">Count / no numeric metric</option>
            {cols.numeric.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
          {['heatmap','stackedBar'].includes(draft.type) && (
            <select value={draft.groupBy || ''} onChange={e => setDraft(d => ({ ...d, groupBy:e.target.value }))} style={{ background:T.input, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, padding:'.5rem' }}>
              <option value="">Select second dimension</option>
              {cols.category.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          )}
          <select value={draft.aggregation || 'count'} onChange={e => setDraft(d => ({ ...d, aggregation:e.target.value }))} style={{ background:T.input, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, padding:'.5rem' }}>
            {['count','sum','average','min','max','unique_count'].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={draft.tabId || ''} onChange={e => setDraft(d => ({ ...d, tabId:e.target.value }))} style={{ background:T.input, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, padding:'.5rem' }}>
            {(dashboard?.plan?.tabs || []).filter(t => !t.isInsights).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <select value={draft.size || 'medium'} onChange={e => setDraft(d => ({ ...d, size:e.target.value }))} style={{ background:T.input, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, padding:'.5rem' }}>
            {['small','medium','large','wide'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {invalid && <div style={{ color:'#fbbf24', fontSize:'.72rem' }}>{invalid}</div>}
          <div style={{ display:'flex', flexWrap:'wrap', gap:'.35rem' }}>
            {ideas.map((idea, i) => (
              <button key={i} onClick={() => setDraft(d => ({ ...d, ...idea, groupBy:idea.groupBy || '' }))}
                style={{ background:T.input, border:`1px solid ${T.border}`, borderRadius:7, color:T.sub, padding:'.3rem .45rem', cursor:'pointer', fontSize:'.68rem' }}>
                {idea.title}
              </button>
            ))}
          </div>
          <button disabled={!canAdd} onClick={() => onAdd(draft.tabId, spec, preview)}
            style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:'.35rem', border:'none', borderRadius:9, padding:'.62rem .9rem', cursor:canAdd?'pointer':'not-allowed', color:'#fff', background:canAdd?'linear-gradient(135deg,#6366f1,#8b5cf6)':T.input, fontWeight:700 }}>
            <Plus size={13}/> Add Chart
          </button>
        </div>
        <div style={{ minHeight:360 }}>
          <ChartWidget spec={spec} data={preview} T={T} readOnly/>
        </div>
      </div>
    </div>
  );
}

function ImproveReportModal({ open, onClose, T, prompt, pasted, setPasted, onCopyPrompt, onApply, warnings }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:1160, background:'rgba(0,0,0,.72)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1.25rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ width:'min(920px, 100%)', maxHeight:'90vh', overflow:'auto', background:T.card, border:`1px solid ${T.border}`, borderRadius:16, padding:'1rem', display:'grid', gap:'.8rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'.45rem', fontWeight:800, color:T.text }}><Wand2 size={15}/> Improve This Report</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.sub, cursor:'pointer' }}><X size={18}/></button>
        </div>
        <div style={{ fontSize:'.75rem', color:T.sub }}>Only headers, metadata, current tabs/chart ids, and up to 5 sample rows are included. Paste returned JSON additions below.</div>
        <textarea readOnly value={prompt} rows={8} style={{ width:'100%', background:T.input, border:`1px solid ${T.border}`, borderRadius:9, color:T.sub, padding:'.65rem', fontSize:'.72rem', fontFamily:'monospace' }}/>
        <button onClick={onCopyPrompt} style={{ justifySelf:'start', display:'inline-flex', alignItems:'center', gap:'.35rem', background:T.input, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, padding:'.45rem .75rem', cursor:'pointer' }}><Copy size={12}/> Copy Improvement Prompt</button>
        <textarea value={pasted} onChange={e => setPasted(e.target.value)} rows={8} placeholder="Paste JSON additions from ChatGPT/Gemini here..." style={{ width:'100%', background:T.input, border:`1px solid ${T.border}`, borderRadius:9, color:T.text, padding:'.65rem', fontSize:'.76rem', fontFamily:'monospace' }}/>
        {warnings?.length > 0 && <div style={{ color:'#fbbf24', fontSize:'.72rem' }}>{warnings.slice(0, 3).join(' | ')}</div>}
        <button onClick={onApply} style={{ justifySelf:'end', display:'inline-flex', alignItems:'center', gap:'.35rem', border:'none', borderRadius:9, padding:'.62rem .9rem', cursor:'pointer', color:'#fff', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', fontWeight:700 }}><Check size={13}/> Merge Valid Additions</button>
      </div>
    </div>
  );
}

function ShareModal({ open, onClose, T, dashboard, headers: _headers, apiBase, authToken }) {
  void _headers;
  const [expiry, setExpiry] = useState('24h');
  const [creating, setCreating] = useState(false);
  const [link, setLink] = useState(null);
  const [err, setErr] = useState(null);
  const [copied, setCopied] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setLink(null); setErr(null); setCreating(false); setCopied(false);
    }
  }, [open]);

  if (!open) return null;

  const buildSnapshot = () => {
    const plan = dashboard?.plan || {};
    // tabChartData[tabId] = [{ spec, data }, ...] — merge data into each chart spec
    const tabsWithData = (plan.tabs || []).map(t => {
      const liveCharts = dashboard?.tabChartData?.[t.id] || [];
      // Match each plan chart to its computed data by chart id
      const chartsOut = (t.charts || []).map(spec => {
        const match = liveCharts.find(x => x.spec?.id === spec.id) || liveCharts.find(x => x.spec?.title === spec.title);
        return { ...spec, data: match?.data || [] };
      });
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        summary: t.summary || '',
        insights: t.insights || [],
        kpis: t.kpis || [],
        recommendedActions: t.recommendedActions || [],
        charts: chartsOut,
        isForecast: t.isForecast || t.id === 'forecast',
        isInsights: t.isInsights || t.id === 'insights',
      };
    });

    return {
      title: plan.title || 'Shared Dashboard',
      subtitle: plan.subtitle || '',
      domain: plan.domain || null,
      confidence: plan.confidence || null,
      fileName: dashboard?.fileName || '',
      rowCount: dashboard?.rowCount || 0,
      insights: plan.insights || [],
      summary: plan.summary || '',
      tabs: tabsWithData,
      // Legacy flat charts
      charts: (dashboard?.builtCharts || []).map(c => ({ ...c.spec, data: c.data })),
      kpis: dashboard?.kpis || [],
      agentData: dashboard?.agentData || null,
      // headers OMITTED for privacy (column names can leak business info)
    };
  };

  const createLink = async () => {
    if (!dashboard) return;
    setCreating(true); setErr(null);
    try {
      const snapshot = buildSnapshot();
      const resp = await fetch(`${apiBase}/api/share/dashboard`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${authToken}` },
        body: JSON.stringify({ snapshot, expiry }),
      });
      const data = await resp.json();
      if (!data.success) { setErr(data.error || 'Failed to create share link'); return; }
      const url = `${window.location.origin}/report/share/${data.token}`;
      setLink({ url, token: data.token, expiresAt: data.expiresAt });
      toast.success('Share link created');
    } catch (e) {
      setErr(e.message || 'Network error');
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async () => {
    if (!link?.url) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed — select and copy manually');
    }
  };

  const revokeLink = async () => {
    if (!link?.token) return;
    if (!window.confirm('Revoke this share link? The shared report will no longer be accessible.')) return;
    try {
      const resp = await fetch(`${apiBase}/api/share/dashboard/${link.token}`, {
        method:'DELETE', headers:{ Authorization:`Bearer ${authToken}` },
      });
      const data = await resp.json();
      if (data.success) {
        setLink(null);
        toast.success('Link revoked');
      } else {
        toast.error(data.error || 'Revoke failed');
      }
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div onClick={onClose}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1100,
        display:'flex', alignItems:'center', justifyContent:'center', padding:'1.5rem', backdropFilter:'blur(8px)' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:18, padding:'1.5rem',
          width:'100%', maxWidth:520, display:'flex', flexDirection:'column', gap:'1rem' }}>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'.55rem' }}>
            <div style={{ width:34, height:34, borderRadius:10,
              background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 4px 12px rgba(99,102,241,0.35)' }}>
              <Share2 size={15} style={{ color:'#fff' }}/>
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:'1rem', color:T.text }}>Share Report</div>
              <div style={{ fontSize:'.7rem', color:T.sub }}>Read-only public link with expiry</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:T.sub, display:'flex' }}>
            <X size={18}/>
          </button>
        </div>

        <div style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)',
          borderRadius:9, padding:'.55rem .75rem', fontSize:'.72rem', color:T.sub, lineHeight:1.5 }}>
          <strong style={{ color:'#fbbf24' }}>⚠ Anyone with this link can view this report (read-only) until it expires.</strong>{' '}
          They cannot edit, re-run AI, or access your other dashboards.
        </div>

        <div>
          <label style={{ fontSize:'.72rem', fontWeight:700, color:T.sub, display:'block',
            marginBottom:'.35rem', textTransform:'uppercase', letterSpacing:'.05em' }}>Link Expiry</label>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'.4rem' }}>
            {[
              { id:'1h',  label:'1 hour'  },
              { id:'24h', label:'24 hours'},
              { id:'7d',  label:'7 days'  },
              { id:'30d', label:'30 days' },
            ].map(opt => (
              <button key={opt.id} onClick={() => setExpiry(opt.id)} disabled={!!link}
                style={{ padding:'.5rem .55rem', borderRadius:8, cursor: link ? 'not-allowed' : 'pointer',
                  background: expiry === opt.id ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : T.input,
                  color: expiry === opt.id ? '#fff' : T.text,
                  border: `1px solid ${expiry === opt.id ? '#6366f1' : T.border}`,
                  fontSize:'.74rem', fontWeight:600, opacity: link ? 0.6 : 1 }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {!link && (
          <button onClick={createLink} disabled={creating}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'.45rem',
              padding:'.7rem 1rem', background: creating ? T.input : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: creating ? T.sub : '#fff', border:'none', borderRadius:10, fontWeight:700, fontSize:'.86rem',
              cursor: creating ? 'wait' : 'pointer',
              boxShadow: creating ? 'none' : '0 4px 14px rgba(99,102,241,0.35)' }}>
            {creating
              ? <><RefreshCw size={13} style={{ animation:'spin 1s linear infinite' }}/> Creating share link…</>
              : <><Share2 size={13}/> Generate Share Link</>}
          </button>
        )}

        {err && (
          <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)',
            borderRadius:9, padding:'.55rem .75rem', fontSize:'.74rem', color:'#f87171' }}>
            ⚠ {err}
          </div>
        )}

        {link && (
          <div style={{ display:'flex', flexDirection:'column', gap:'.65rem' }}>
            <div style={{ fontSize:'.72rem', fontWeight:700, color:T.sub, textTransform:'uppercase', letterSpacing:'.05em' }}>
              Shareable Link
            </div>
            <div style={{ display:'flex', gap:'.4rem' }}>
              <input value={link.url} readOnly
                style={{ flex:1, background:T.input, border:`1px solid ${T.border}`, borderRadius:9,
                  padding:'.55rem .75rem', color:T.text, fontSize:'.78rem', fontFamily:'monospace', outline:'none' }}/>
              <button onClick={copyLink}
                style={{ display:'flex', alignItems:'center', gap:'.3rem', padding:'.55rem .85rem',
                  background: copied ? 'rgba(16,185,129,0.15)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  color: copied ? '#34d399' : '#fff',
                  border: copied ? '1px solid rgba(16,185,129,0.3)' : 'none',
                  borderRadius:9, cursor:'pointer', fontSize:'.78rem', fontWeight:600, whiteSpace:'nowrap' }}>
                {copied ? <><Check size={12}/> Copied</> : <><Copy size={12}/> Copy</>}
              </button>
            </div>
            <div style={{ fontSize:'.7rem', color:T.sub, display:'flex', alignItems:'center', gap:'.35rem' }}>
              <Clock size={11}/> Expires: <strong style={{ color:T.text }}>{new Date(link.expiresAt).toLocaleString()}</strong>
            </div>
            <div style={{ display:'flex', gap:'.4rem' }}>
              <button onClick={() => window.open(link.url, '_blank', 'noopener')}
                style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'.3rem',
                  background:T.input, border:`1px solid ${T.border}`, borderRadius:9, padding:'.45rem .7rem',
                  cursor:'pointer', color:T.text, fontSize:'.76rem', fontWeight:600 }}>
                <Eye size={11}/> Preview
              </button>
              <button onClick={revokeLink}
                style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'.3rem',
                  background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:9,
                  padding:'.45rem .7rem', cursor:'pointer', color:'#f87171', fontSize:'.76rem', fontWeight:600 }}>
                <X size={11}/> Revoke Link
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DashboardCanvas (multi-tab BI layout) ───────────────────────────────────
// ─── Main Component ────────────────────────────────────────────────────────────
export default function AiDashboardMaker() {
  const { user, token } = useAuth();
  const rateLimit = useAiRateLimit('dashboard-maker');
  const store = useDashboardStore();
  const T = store.theme === 'dark' ? DARK : LIGHT;
  const { step, genStage, loading, dashboard, expandedChart, showTable, theme, recent } = store;
  const { rows, headers, analysis } = store;

  // Local state
  const [dataSource, setDataSource]   = useState('file');   // 'file' | 'url'
  const [dataQuality, setDataQuality] = useState(null);
  const [aiHealth, setAiHealth]       = useState(null);     // health check results
  const [addChartOpen, setAddChartOpen] = useState(false);
  const [improveOpen, setImproveOpen] = useState(false);
  const [improvePaste, setImprovePaste] = useState('');
  const [improveWarnings, setImproveWarnings] = useState([]);

  // Init per-user storage when user changes (store deliberately excluded — initUser is stable)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { store.initUser(user?.id || null); }, [user?.id]);

  // AI health check on mount
  useEffect(() => {
    setAiHealth({ gemini: 'checking', openai: 'checking', groq: 'checking' });
    fetch(`${API_BASE_URL}/api/ai/health`)
      .then(r => r.json())
      .then(d => setAiHealth({
        gemini: d.gemini || 'error',
        openai: d.openai || 'error',
        groq:   d.groq   || 'error',
      }))
      .catch(() => setAiHealth({ gemini: 'error', openai: 'error', groq: 'error' }));
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
  }, [store]);

  // ── Derived intelligence (computed from effectiveAnalysis) ──────────────────
  const relationships = useMemo(() => effectiveAnalysis ? detectRelationships(effectiveAnalysis) : [], [effectiveAnalysis]);
  const columnGroups  = useMemo(() => effectiveAnalysis ? groupColumns(effectiveAnalysis) : [], [effectiveAnalysis]);
  const dashboardRecs = useMemo(() => effectiveAnalysis ? recommendDashboards(effectiveAnalysis) : [], [effectiveAnalysis]);
  const kpiPreviews   = useMemo(() => {
    if (!effectiveAnalysis || !store.rows.length) return [];
    return generateKPIs(effectiveAnalysis, store.rows.slice(0, 500), 6);
  }, [effectiveAnalysis, store.rows]);
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
  }, [store]);

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
  // ── Convert a Blueprint v1.0 → internal multi-tab plan + tab chart data ──
  const internalPlanFromBlueprint = useCallback((blueprint, ea) => {
    const dateCols = ea.headers.filter(h => ea.colMeta[h]?.dataType === 'date'
      || ea.colMeta[h]?.semanticType === 'date'
      || ea.colMeta[h]?.semanticType === 'datetime');

    const tabs = (blueprint.tabs || []).map(t => {
      const tabId = t.tabId || t.id;
      const isForecast = t.tabType === 'forecasting' || tabId === 'forecast';
      const isInsights = t.tabType === 'summary' || tabId === 'insights' || tabId === 'summary';
      const charts = (t.charts || []).map(bp => toInternalChart(bp, dateCols));
      // Convert v1.0 KPIs → display KPIs ready for KpiCard
      const kpis = (t.kpis || []).map(k => {
        const { value, formatted } = calculateKpiFromSpec(store.rows, k);
        return {
          id: k.id,
          label: k.name,
          value,
          formatted,
          change: null,
          changeLabel: '',
          icon: k.format === 'currency' ? 'currency' : k.format === 'percent' ? 'percent' : 'count',
        };
      });
      return {
        id: tabId,
        title: t.tabName || t.title || tabId,
        description: t.summary || t.description || '',
        summary: t.summary || '',
        insights: t.insights || [],
        recommendedActions: t.recommendedActions || [],
        kpis,
        charts,
        isForecast, isInsights,
      };
    });

    return {
      title: blueprint.reportTitle || blueprint.title || 'Dashboard',
      subtitle: blueprint.executiveSummary
        ? blueprint.executiveSummary.slice(0, 120)
        : `${store.rows.length.toLocaleString('en-IN')} rows · ${ea.headers.length} columns · ${blueprint.domain || 'generic'}`,
      domain: blueprint.domain,
      confidence: blueprint.confidence,
      summary: blueprint.executiveSummary || '',
      insights: [], // Tab-level insights cover this in BlueprintX
      tabs,
      charts: [], // tabs[] takes precedence
    };
  }, [store.rows]);

  /**
   * The single entry point from BlueprintXPanel.
   *  mode      'blueprintx' | 'multitool' | 'local'
   *  blueprint v1.0 blueprint (already validated) OR null (multitool fetches its own)
   */
  const generateDashboard = async (mode = 'multitool', blueprint = null) => {
    if (store.loading) return;

    // Login mandatory
    if (!user) {
      toast.error('Please sign in to generate dashboards');
      return;
    }

    // Total dashboard limit
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

      // ── Always have a deterministic multi-tab baseline ready ────────────
      const localMultiTabPlan = buildMultiTabPlan(ea, store.rows, store.userPrompt);

      let finalPlan = localMultiTabPlan;
      let finalSource = 'engine';

      if (mode === 'blueprintx' && blueprint) {
        // ── Path A: BlueprintX (user pasted JSON) — ZERO API CALL ─────────
        finalPlan = internalPlanFromBlueprint(blueprint, ea);
        finalSource = 'blueprintx';
      } else if (mode === 'local') {
        // ── Path B: Local Smart Builder — also no AI ──────────────────────
        // blueprint here is the v1.0 from createLocalSmartBlueprint — translate it too
        if (blueprint) finalPlan = internalPlanFromBlueprint(blueprint, ea);
        finalSource = 'engine';
      } else {
        // ── Path C: Multi Tool Hub AI — backend Gemini → OpenAI → Groq ──
        const payload = {
          headers:         ea.headers,
          sampleRows:      store.rows.slice(0, 5),
          columnTypes:     Object.fromEntries(ea.headers.map(h => [h, ea.colMeta[h]?.dataType])),
          columnSemantics: Object.fromEntries(ea.headers.map(h => [h, ea.colMeta[h]?.semanticType])),
          userPrompt:      store.userPrompt,
          helperText:      store.columnHelp,
          rowCount:        store.rows.length,
        };

        const sig = planSignature({
          headers: ea.headers, rowCount: store.rows.length,
          userPrompt: store.userPrompt, columnHelp: store.columnHelp,
        });
        const cached = store.getCachedPlan(sig);

        let aiPlan = null;
        let source = 'engine';

        if (cached) {
          aiPlan = cached.plan;
          source = cached.source || 'cache';
          toast('Using cached plan — no AI call made', { icon:'⚡', duration:3000 });
        } else {
          try {
            const ctrl  = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 28000);
            const resp  = await fetch(`${API_BASE_URL}/api/ai/dashboard-plan`, {
              method:'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify(payload), signal: ctrl.signal,
            });
            clearTimeout(timer);
            const data = await resp.json();
            if (data.success) { aiPlan = data.plan; source = data.source || 'gemini'; }
            else {
              const msgs = { RATE_LIMITED:'AI rate limited', TIMEOUT:'AI timed out', PARSE_ERROR:'AI response invalid', EMPTY_RESPONSE:'AI returned empty' };
              toast(msgs[data.code] || 'AI unavailable — using intelligence engine', { icon:'⚡' });
            }
          } catch (netErr) {
            toast(netErr.name === 'AbortError' ? 'AI timed out — using intelligence engine' : 'Using local intelligence engine', { icon:'⚡' });
          }
        }

        finalPlan = aiPlan
          ? normalizeAiPlan(aiPlan, ea, store.rows, store.userPrompt)
          : localMultiTabPlan;
        finalSource = aiPlan ? source : 'engine';

        if (aiPlan && !cached) store.setCachedPlan(sig, aiPlan, source);
      }

      store.setGenStage(2);

      // ── Build chart data for EVERY chart across EVERY tab ────────────────
      const tabChartData = {};
      (finalPlan.tabs || []).forEach(tab => {
        tabChartData[tab.id] = (tab.charts || [])
          .map(spec => ({ spec, data: buildChartData(spec, store.rows, ea) }))
          .filter(c => c.data && c.data.length > 0);
      });

      // Legacy flat charts (so old dashboards / fallback still work)
      const builtCharts = (finalPlan.charts || [])
        .map(spec => ({ spec, data: buildChartData(spec, store.rows, ea) }))
        .filter(c => c.data && c.data.length > 0);

      const allKPIs       = generateKPIs(ea, store.rows, 8);
      const engineInsights = generateInsights(ea, store.rows, 5);
      const planInsights   = finalPlan.insights || [];
      const allInsights    = [...planInsights, ...engineInsights]
        .filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 8);

      // Agent leaderboard (kept for backward compatibility)
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
        title:     finalPlan.title || 'Dashboard',
        fileName:  store.file?.name || 'unknown',
        rowCount:  store.rows.length,
        headers:   ea.headers,
        createdAt: Date.now(),
        plan: finalPlan, kpis: allKPIs, theme: store.theme,
      };
      store.saveDashboardEntry(entry);
      store.setGenStage(3);
      await new Promise(r => setTimeout(r, 320));
      store.setDashboard({
        plan: { ...finalPlan, insights: allInsights },
        kpis: allKPIs,
        builtCharts,
        tabChartData,
        agentData,
        source: finalSource,
        savedId: entry.id,
        fileName: store.file?.name || '',
        rowCount: store.rows.length,
      });

      const srcLabels = {
        gemini:     '✦ Gemini AI',
        openai:     '⚙ OpenAI',
        groq:       '⚡ Groq Llama',
        engine:     '⚙ Local Smart Builder',
        cache:      '⚡ Cached Plan',
        blueprintx: '✨ BlueprintX (your AI session — no app credits used)',
      };
      const tabCount = (finalPlan.tabs || []).length;
      toast.success(`Dashboard ready — ${tabCount} tabs · ${srcLabels[finalSource] || finalSource}`);

    } catch (err) {
      toast.error('Generation failed: ' + err.message);
      store.setStep('schema');
    } finally {
      store.setLoading(false);
    }
  };

  const handleRestore = (d) => {
    const ea = effectiveAnalysis || store.analysis || analyzeDataset(store.rows, d.headers || store.headers);

    // Per-tab data
    const tabChartData = {};
    (d.plan?.tabs || []).forEach(tab => {
      tabChartData[tab.id] = (tab.charts || [])
        .map(spec => ({ spec, data: buildChartData(spec, store.rows, ea) }))
        .filter(c => c.data && c.data.length > 0);
    });

    // Legacy flat fallback
    const builtCharts = (d.plan?.charts || [])
      .map(spec => ({ spec, data: buildChartData(spec, store.rows, ea) }))
      .filter(c => c.data && c.data.length > 0);

    store.setDashboard({
      ...d,
      builtCharts,
      tabChartData,
      source: 'restored',
      fileName: d.fileName,
      rowCount: d.rowCount,
    });
  };

  const addChartToDashboard = (tabId, spec, data) => {
    const currentDashboard = store.dashboard;
    if (!currentDashboard?.plan || !tabId) return;
    const nextPlan = {
      ...currentDashboard.plan,
      tabs: (currentDashboard.plan.tabs || []).map(t => t.id === tabId
        ? { ...t, charts: [...(t.charts || []), spec] }
        : t),
    };
    const nextTabChartData = {
      ...(currentDashboard.tabChartData || {}),
      [tabId]: [...(currentDashboard.tabChartData?.[tabId] || []), { spec, data }],
    };
    store.setDashboard({ ...currentDashboard, plan: nextPlan, tabChartData: nextTabChartData });
    store.setActiveTabId(tabId);
    setAddChartOpen(false);
    toast.success('Chart added locally');
  };

  const currentChartIds = useMemo(() => {
    const tabs = store.dashboard?.plan?.tabs || [];
    return tabs.flatMap(t => (t.charts || []).map(c => c.id || c.title)).filter(Boolean);
  }, [store.dashboard]);

  const improvePrompt = useMemo(() => {
    const currentDashboard = store.dashboard;
    if (!currentDashboard || !effectiveAnalysis) return '';
    const safeHeaders = effectiveAnalysis.headers || store.headers || [];
    const safeRows = store.rows || [];
    const base = generateAIBlueprintPrompt({
      headers: safeHeaders,
      analysis: effectiveAnalysis,
      sampleRows: safeRows.slice(0, 5),
      rowCount: safeRows.length,
      detectedDomain: effectiveAnalysis.domain || 'generic',
      userPrompt: store.userPrompt,
    });
    const existing = (currentDashboard.plan?.tabs || []).map(t => ({
      tabId: t.id,
      tabName: t.title,
      chartIds: (t.charts || []).map(c => c.id || c.title),
      chartTypes: (t.charts || []).map(c => c.type),
    }));
    return `${base}

IMPORTANT IMPROVEMENT MODE:
- Return ONLY additional tabs/charts/insights/recommendedActions that are missing.
- Do not repeat any existing chart id/title.
- Do not request full data or calculate values.
- Prefer missing advanced analysis opportunities.
- Existing report structure: ${JSON.stringify(existing)}
- Existing chart ids: ${currentChartIds.join(', ')}
- Return the same JSON blueprint shape, but include only new/additional tabs or charts.`;
  }, [store, effectiveAnalysis, currentChartIds]);

  const copyImprovePrompt = async () => {
    try {
      await navigator.clipboard.writeText(improvePrompt);
      toast.success('Improvement prompt copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  const applyImprovementPaste = () => {
    const currentDashboard = store.dashboard;
    if (!improvePaste.trim() || !currentDashboard || !effectiveAnalysis) {
      toast.error('Paste improvement JSON first');
      return;
    }
    const parsed = parseAIBlueprint(improvePaste);
    if (!parsed.ok) {
      setImproveWarnings([parsed.error || 'Could not parse JSON']);
      toast.error('Could not parse improvement JSON');
      return;
    }
    const safeHeaders = effectiveAnalysis.headers || store.headers || [];
    const safeRows = store.rows || [];
    const validation = validateAIBlueprint(parsed.blueprint, safeHeaders, effectiveAnalysis);
    setImproveWarnings(validation.warnings || []);
    if (!validation.valid) {
      toast.error(validation.errors?.[0] || 'No valid additions found');
      return;
    }
    const dateCols = safeHeaders.filter(h => effectiveAnalysis.colMeta?.[h]?.dataType === 'date');
    const existingIds = new Set(currentChartIds);
    const nextTabs = [...(currentDashboard.plan?.tabs || [])];
    const nextTabData = { ...(currentDashboard.tabChartData || {}) };

    (validation.cleanedBlueprint.tabs || []).forEach(t => {
      const incomingCharts = (t.charts || [])
        .map(c => toInternalChart(c, dateCols))
        .filter(c => !existingIds.has(c.id) && !existingIds.has(c.title));
      if (!incomingCharts.length && !(t.insights || []).length && !(t.recommendedActions || []).length) return;
      const matchIdx = nextTabs.findIndex(tab => tab.id === (t.tabId || t.id));
      const tabId = matchIdx >= 0 ? nextTabs[matchIdx].id : (t.tabId || t.id);
      const built = incomingCharts
        .map(spec => ({ spec, data: buildChartData(spec, safeRows, effectiveAnalysis) }))
        .filter(c => c.data?.length > 0);
      if (matchIdx >= 0) {
        nextTabs[matchIdx] = {
          ...nextTabs[matchIdx],
          charts: [...(nextTabs[matchIdx].charts || []), ...incomingCharts],
          insights: [...(nextTabs[matchIdx].insights || []), ...(t.insights || [])].slice(0, 8),
          recommendedActions: [...(nextTabs[matchIdx].recommendedActions || []), ...(t.recommendedActions || [])].slice(0, 8),
        };
      } else {
        nextTabs.push({
          id: tabId,
          title: t.tabName || t.title || tabId,
          description: t.summary || '',
          summary: t.summary || '',
          charts: incomingCharts,
          insights: t.insights || [],
          recommendedActions: t.recommendedActions || [],
          kpis: [],
          isForecast: t.tabType === 'forecasting',
          isInsights: t.tabType === 'summary',
        });
      }
      nextTabData[tabId] = [...(nextTabData[tabId] || []), ...built];
    });

    store.setDashboard({
      ...currentDashboard,
      plan: { ...currentDashboard.plan, tabs: nextTabs },
      tabChartData: nextTabData,
      source: currentDashboard.source === 'blueprintx' ? 'blueprintx' : currentDashboard.source,
    });
    setImproveOpen(false);
    setImprovePaste('');
    toast.success('Valid report improvements merged');
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
    gemini:     { label:'✦ Gemini AI',  color:'#818cf8', bg:'rgba(99,102,241,0.12)'  },
    blueprintx: { label:'✨ BlueprintX', color:'#22d3ee', bg:'rgba(6,182,212,0.12)' },
    groq:     { label:'⚡ Groq Llama', color:'#fb923c', bg:'rgba(249,115,22,0.12)' },
    engine:   { label:'⚙ Engine',     color:'#10b981', bg:'rgba(16,185,129,0.12)'  },
    restored: { label:'⏱ Restored',   color:'#94a3b8', bg:'rgba(148,163,184,0.1)'  },
  }[src] || { label:'⚙ Engine', color:'#10b981', bg:'rgba(16,185,129,0.12)' });

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
              <button onClick={() => setAddChartOpen(true)}
                style={{ display:'inline-flex', alignItems:'center', gap:'.3rem', background:T.input,
                  border:`1px solid ${T.border}`, borderRadius:8, padding:'.36rem .7rem',
                  cursor:'pointer', color:T.text, fontSize:'.74rem' }}>
                <Plus size={11}/> Add More Charts
              </button>
              <button onClick={() => setImproveOpen(true)}
                style={{ display:'inline-flex', alignItems:'center', gap:'.3rem', background:'rgba(34,211,238,0.1)',
                  border:'1px solid rgba(34,211,238,0.24)', borderRadius:8, padding:'.36rem .7rem',
                  cursor:'pointer', color:'#22d3ee', fontSize:'.74rem', fontWeight:600 }}>
                <Wand2 size={11}/> Improve This Report
              </button>
              <button onClick={() => store.openShareModal()}
                style={{ display:'inline-flex', alignItems:'center', gap:'.3rem',
                  background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff',
                  border:'none', borderRadius:8, padding:'.36rem .8rem',
                  cursor:'pointer', fontSize:'.74rem', fontWeight:600,
                  boxShadow:'0 4px 12px rgba(99,102,241,0.3)' }}>
                <Share2 size={11}/> Share
              </button>
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
                  { icon:Brain,       label:'AI Assist',           desc:'Gemini → OpenAI → Groq' },
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
                <strong style={{ color:'#34d399' }}>Privacy:</strong> Your dataset stays in the browser. Only column names, types, and up to 5 sample rows are sent to AI — never your full data.
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
            rows={rows}
          />
        )}

        {/* ── Generating step ────────────────────────────────────────────────── */}
        {step === 'generating' && <GenerationProgress stage={genStage} T={T}/>}

        {/* ── Dashboard step (multi-tab BI layout) ─────────────────────────── */}
        {step === 'dashboard' && dashboard && (
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            <DashboardCanvas
              dashboard={dashboard}
              rows={rows}
              headers={headers}
              analysis={effectiveAnalysis || analysis}
              activeTabId={store.activeTabId}
              onChangeTab={(id) => store.setActiveTabId(id)}
              onExpandChart={(c) => store.setExpandedChart(c)}
              T={T}
            />

            {/* Leaderboard (when an agent column is present, shown across all tabs) */}
            {dashboard.agentData?.length > 0 && <AgentLeaderboard agentData={dashboard.agentData} T={T}/>}

            {/* Raw data table (read-only toggle) */}
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
        )}
      </div>

      {/* ── Share Report Modal ─────────────────────────────────────────────── */}
      <AddChartModal
        open={addChartOpen}
        onClose={() => setAddChartOpen(false)}
        T={T}
        headers={headers}
        analysis={effectiveAnalysis || analysis}
        dashboard={dashboard}
        rows={rows}
        onAdd={addChartToDashboard}
      />

      <ImproveReportModal
        open={improveOpen}
        onClose={() => setImproveOpen(false)}
        T={T}
        prompt={improvePrompt}
        pasted={improvePaste}
        setPasted={setImprovePaste}
        onCopyPrompt={copyImprovePrompt}
        onApply={applyImprovementPaste}
        warnings={improveWarnings}
      />

      <ShareModal
        open={store.shareModalOpen}
        onClose={() => store.closeShareModal()}
        T={T}
        dashboard={dashboard}
        headers={headers}
        apiBase={API_BASE_URL}
        authToken={token}
      />

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

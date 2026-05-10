import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  Upload, FileSpreadsheet, Sparkles, BarChart2, TrendingUp,
  Download, RefreshCw, X, CheckCircle, Table2, Zap,
  ArrowUpRight, ArrowDownRight, Minus, Sun, Moon, Info,
  Clock, Trophy, LayoutDashboard, ChevronRight, AlertCircle,
  Database, Target, Users, DollarSign, Activity, BarChart,
  PieChart as PieIcon, LineChart as LineIcon,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  BarChart as ReBar, Bar,
  LineChart as ReLine, Line,
  AreaChart as ReArea, Area,
  PieChart as RePie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { API_BASE_URL } from '../../config';
import {
  analyzeDataset, generateChartSpecs, generateKPIs,
  aggregateForChart, buildDateTrends, buildFallbackPlan,
  buildAIPayload, formatKPIValue, DashboardStorage,
} from './dashboardEngine';

// ─── Palette & theme ──────────────────────────────────────────────────────────
const COLORS = ['#6366f1','#10b981','#f59e0b','#3b82f6','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16','#f97316'];

const DARK  = { page:'#0a0a12', card:'#0f0f1a', border:'rgba(255,255,255,0.07)', text:'#e2e8f0', sub:'#64748b', input:'rgba(255,255,255,0.05)', hover:'rgba(255,255,255,0.04)' };
const LIGHT = { page:'#f1f5f9', card:'#ffffff',  border:'rgba(0,0,0,0.08)',       text:'#0f172a', sub:'#64748b', input:'rgba(0,0,0,0.04)',        hover:'rgba(0,0,0,0.03)'       };

const SEMANTIC_STYLE = {
  date_col:     { bg:'rgba(99,102,241,0.12)',  color:'#818cf8', label:'Date'     },
  amount_col:   { bg:'rgba(16,185,129,0.12)',  color:'#34d399', label:'Amount'   },
  agent_col:    { bg:'rgba(139,92,246,0.12)',  color:'#a78bfa', label:'Agent'    },
  status_col:   { bg:'rgba(245,158,11,0.12)',  color:'#fbbf24', label:'Status'   },
  id_col:       { bg:'rgba(6,182,212,0.12)',   color:'#22d3ee', label:'ID'       },
  mobile_col:   { bg:'rgba(6,182,212,0.12)',   color:'#22d3ee', label:'Mobile'   },
  category_col: { bg:'rgba(251,146,60,0.12)',  color:'#fb923c', label:'Category' },
  name_col:     { bg:'rgba(148,163,184,0.1)',  color:'#94a3b8', label:'Name'     },
  numeric_col:  { bg:'rgba(16,185,129,0.08)',  color:'#6ee7b7', label:'Number'   },
  text_col:     { bg:'rgba(148,163,184,0.08)', color:'#94a3b8', label:'Text'     },
};

const ALL_SEMANTIC_TYPES = Object.keys(SEMANTIC_STYLE);

const GEN_STAGES = [
  { id: 'scan',   label: 'Scanning data patterns',     detail: 'Detecting column types, business rules and relationships' },
  { id: 'ai',     label: 'AI processing',               detail: 'Groq preprocessing → Gemini dashboard planning'          },
  { id: 'render', label: 'Building charts & KPIs',      detail: 'Aggregating data, computing metrics, rendering charts'   },
  { id: 'done',   label: 'Dashboard ready',             detail: 'Saved to history'                                        },
];

function relativeTime(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── UploadZone ───────────────────────────────────────────────────────────────
function UploadZone({ onFile, T, theme }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);

  const handle = useCallback((f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['xlsx','xls','csv'].includes(ext)) {
      toast.error('Please upload an Excel (.xlsx, .xls) or CSV file');
      return;
    }
    onFile(f);
  }, [onFile]);

  return (
    <div
      style={{
        border: `2px dashed ${drag ? '#6366f1' : T.border}`,
        borderRadius: 16,
        padding: '3rem 2rem',
        textAlign: 'center',
        cursor: 'pointer',
        background: drag ? 'rgba(99,102,241,0.06)' : T.input,
        transition: 'all .2s',
      }}
      onClick={() => inputRef.current?.click()}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer?.files?.[0]); }}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
    >
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }}
             onChange={e => handle(e.target.files?.[0])}/>
      <div style={{ width:56, height:56, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius:14,
                    display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.25rem' }}>
        <FileSpreadsheet size={26} style={{ color:'#fff' }}/>
      </div>
      <div style={{ fontWeight:700, fontSize:'1.1rem', color:T.text, marginBottom:'.4rem' }}>
        Drop your file here
      </div>
      <div style={{ color:T.sub, fontSize:'.875rem', marginBottom:'1rem' }}>
        or click to browse
      </div>
      <div style={{ display:'flex', gap:'.5rem', justifyContent:'center', flexWrap:'wrap' }}>
        {['.xlsx','.xls','.csv'].map(ext => (
          <span key={ext} style={{ display:'inline-flex', alignItems:'center', gap:'.25rem',
            padding:'.2rem .55rem', borderRadius:100, fontSize:'.72rem', fontWeight:600,
            background:'rgba(99,102,241,0.1)', color:'#6366f1', border:'1px solid rgba(99,102,241,0.2)' }}>
            {ext}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── RecentDashboards ─────────────────────────────────────────────────────────
function RecentDashboards({ dashboards, onRestore, onDelete, T, theme }) {
  if (!dashboards.length) return null;
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:'.5rem', marginBottom:'.75rem' }}>
        <Clock size={14} style={{ color:T.sub }}/>
        <span style={{ fontSize:'.8rem', fontWeight:600, color:T.sub, textTransform:'uppercase', letterSpacing:'.05em' }}>
          Recent Dashboards
        </span>
      </div>
      <div style={{ display:'flex', gap:'.75rem', overflowX:'auto', paddingBottom:'.5rem' }}>
        {dashboards.map(d => (
          <div key={d.id} style={{ minWidth:200, maxWidth:220, background:T.card, border:`1px solid ${T.border}`,
            borderRadius:12, padding:'.85rem', flexShrink:0, cursor:'pointer', transition:'.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#6366f1'}
            onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'.5rem' }}>
              <LayoutDashboard size={14} style={{ color:'#6366f1' }}/>
              <button onClick={e => { e.stopPropagation(); onDelete(d.id); }}
                style={{ background:'none', border:'none', cursor:'pointer', color:T.sub, padding:0, display:'flex' }}>
                <X size={12}/>
              </button>
            </div>
            <div style={{ fontWeight:600, fontSize:'.82rem', color:T.text, marginBottom:'.25rem',
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {d.title}
            </div>
            <div style={{ fontSize:'.72rem', color:T.sub, marginBottom:'.65rem' }}>
              {d.fileName} · {d.rowCount?.toLocaleString()} rows
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:'.68rem', color:T.sub }}>{relativeTime(d.createdAt)}</span>
              <button onClick={() => onRestore(d)}
                style={{ background:'rgba(99,102,241,0.1)', border:'none', cursor:'pointer', color:'#6366f1',
                  padding:'.2rem .6rem', borderRadius:6, fontSize:'.72rem', fontWeight:600, display:'flex', alignItems:'center', gap:'.25rem' }}>
                Restore <ChevronRight size={10}/>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SchemaPreview ────────────────────────────────────────────────────────────
function SchemaPreview({ analysis, semanticOverrides, setSemanticOverrides, userPrompt, setUserPrompt,
                          columnHelp, setColumnHelp, onGenerate, loading, T, theme, onBack }) {
  const { headers, colMeta, rowCount, relationships, semanticMap } = analysis;
  const effectiveSem = { ...semanticMap, ...semanticOverrides };

  const grouped = {};
  headers.forEach(h => {
    const st = effectiveSem[h];
    if (!grouped[st]) grouped[st] = [];
    grouped[st].push(h);
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
      {/* File summary */}
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:'1.1rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'.75rem', marginBottom:'.75rem', flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
            <CheckCircle size={16} style={{ color:'#10b981' }}/>
            <span style={{ fontWeight:600, color:T.text, fontSize:'.9rem' }}>
              {rowCount.toLocaleString()} rows · {headers.length} columns detected
            </span>
          </div>
          <button onClick={onBack} style={{ marginLeft:'auto', background:'none', border:`1px solid ${T.border}`,
            borderRadius:7, padding:'.3rem .7rem', cursor:'pointer', color:T.sub, fontSize:'.78rem', display:'flex', alignItems:'center', gap:'.3rem' }}>
            <Upload size={12}/> Change File
          </button>
        </div>

        {/* Detected patterns */}
        {relationships.length > 0 && (
          <div style={{ background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)',
            borderRadius:10, padding:'.75rem 1rem', marginBottom:'.85rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'.4rem', marginBottom:'.4rem', fontSize:'.78rem', fontWeight:600, color:'#a5b4fc' }}>
              <Sparkles size={12}/> Detected business patterns
            </div>
            {relationships.map((r, i) => (
              <div key={i} style={{ fontSize:'.78rem', color:T.sub, display:'flex', gap:'.4rem', alignItems:'center' }}>
                <span style={{ color:'#6366f1' }}>→</span> {r}
              </div>
            ))}
          </div>
        )}

        {/* Column type badges */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:'.4rem' }}>
          {headers.map(h => {
            const st = effectiveSem[h];
            const s = SEMANTIC_STYLE[st] || SEMANTIC_STYLE.text_col;
            return (
              <div key={h} style={{ display:'inline-flex', alignItems:'center', gap:'.35rem',
                background:s.bg, border:`1px solid ${s.color}22`, borderRadius:8, padding:'.25rem .6rem .25rem .5rem' }}>
                <span style={{ fontSize:'.78rem', fontWeight:600, color:s.color }}>{h}</span>
                <select value={st} onChange={e => setSemanticOverrides(o => ({ ...o, [h]: e.target.value }))}
                  style={{ background:'transparent', border:'none', color:s.color, fontSize:'.65rem',
                    cursor:'pointer', padding:0, outline:'none', fontWeight:500 }}>
                  {ALL_SEMANTIC_TYPES.map(t => (
                    <option key={t} value={t} style={{ background:'#1e1e2e', color:'#e2e8f0' }}>
                      {SEMANTIC_STYLE[t].label}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      {/* Column stats preview */}
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:'1.1rem' }}>
        <div style={{ fontWeight:600, fontSize:'.85rem', color:T.sub, marginBottom:'.75rem',
          textTransform:'uppercase', letterSpacing:'.05em' }}>Column Summary</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'.5rem' }}>
          {headers.slice(0, 12).map(h => {
            const m = colMeta[h];
            const st = effectiveSem[h];
            const s = SEMANTIC_STYLE[st] || SEMANTIC_STYLE.text_col;
            return (
              <div key={h} style={{ background:T.hover, borderRadius:8, padding:'.5rem .7rem',
                border:`1px solid ${T.border}` }}>
                <div style={{ fontSize:'.72rem', fontWeight:700, color:s.color, marginBottom:'.2rem',
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{h}</div>
                <div style={{ fontSize:'.68rem', color:T.sub }}>
                  {m.dataType === 'number' && m.sum !== undefined
                    ? `sum: ${formatKPIValue(m.sum, st)} · avg: ${formatKPIValue(m.avg, st)}`
                    : `${m.unique} unique · ${m.sample.slice(0,2).join(', ')}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Config */}
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:'1.1rem' }}>
        <div style={{ fontWeight:600, fontSize:'.88rem', color:T.text, marginBottom:'.85rem',
          display:'flex', alignItems:'center', gap:'.5rem' }}>
          <Sparkles size={15} style={{ color:'#6366f1' }}/> Configure Dashboard
          <span style={{ marginLeft:'.3rem', padding:'.15rem .5rem', borderRadius:100, fontSize:'.68rem',
            fontWeight:600, background:'rgba(99,102,241,0.1)', color:'#6366f1' }}>Optional</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
          <div>
            <label style={{ fontSize:'.78rem', fontWeight:600, color:T.sub, display:'block', marginBottom:'.35rem' }}>
              What dashboard do you want?
            </label>
            <textarea rows={3} value={userPrompt} onChange={e => setUserPrompt(e.target.value)}
              placeholder="e.g. Show agent-wise performance, monthly revenue trend, and payment status breakdown..."
              style={{ width:'100%', background:T.input, border:`1px solid ${T.border}`, borderRadius:8,
                color:T.text, padding:'.6rem .8rem', fontSize:'.85rem', outline:'none', resize:'vertical',
                fontFamily:'inherit', boxSizing:'border-box' }}/>
          </div>
          <div>
            <label style={{ fontSize:'.78rem', fontWeight:600, color:T.sub, display:'block', marginBottom:'.35rem' }}>
              Column explanations
            </label>
            <textarea rows={3} value={columnHelp} onChange={e => setColumnHelp(e.target.value)}
              placeholder={'e.g.\ncall_status = Answered / Not Answered\namount = payment in rupees'}
              style={{ width:'100%', background:T.input, border:`1px solid ${T.border}`, borderRadius:8,
                color:T.text, padding:'.6rem .8rem', fontSize:'.85rem', outline:'none', resize:'vertical',
                fontFamily:'inherit', boxSizing:'border-box' }}/>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'.75rem', flexWrap:'wrap' }}>
          <button onClick={onGenerate} disabled={loading}
            style={{ display:'inline-flex', alignItems:'center', gap:'.4rem',
              padding:'.55rem 1.2rem', background: loading ? '#334155' : '#6366f1',
              color: loading ? '#64748b' : '#fff', border:'none', borderRadius:9, fontWeight:600,
              fontSize:'.875rem', cursor: loading ? 'not-allowed' : 'pointer', transition:'.15s' }}>
            {loading
              ? <><RefreshCw size={14} style={{ animation:'spin 1s linear infinite' }}/> Generating…</>
              : <><Zap size={14}/> Generate Dashboard</>}
          </button>
          <span style={{ fontSize:'.78rem', color:T.sub }}>
            {userPrompt ? 'AI will build your custom dashboard' : 'Leave blank — AI auto-detects the best layout'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── GenerationProgress ───────────────────────────────────────────────────────
function GenerationProgress({ stage, T }) {
  return (
    <div style={{ maxWidth:480, margin:'4rem auto', textAlign:'center' }}>
      <div style={{ width:56, height:56, background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
        borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 2rem' }}>
        <BarChart2 size={26} style={{ color:'#fff' }}/>
      </div>
      <div style={{ fontWeight:700, fontSize:'1.2rem', color:T.text, marginBottom:'2rem' }}>
        Building your dashboard…
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'.75rem', textAlign:'left' }}>
        {GEN_STAGES.map((s, i) => {
          const status = i < stage ? 'done' : i === stage ? 'active' : 'pending';
          return (
            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'.75rem',
              background: status === 'active' ? 'rgba(99,102,241,0.08)' : T.card,
              border: `1px solid ${status === 'active' ? 'rgba(99,102,241,0.3)' : T.border}`,
              borderRadius:10, padding:'.65rem .9rem', transition:'.3s' }}>
              <div style={{ flexShrink:0, width:22, height:22, borderRadius:100,
                display:'flex', alignItems:'center', justifyContent:'center',
                background: status === 'done'   ? 'rgba(16,185,129,0.15)' :
                             status === 'active' ? 'rgba(99,102,241,0.15)' : T.hover }}>
                {status === 'done'   && <CheckCircle size={13} style={{ color:'#10b981' }}/>}
                {status === 'active' && <RefreshCw size={13} style={{ color:'#6366f1', animation:'spin 1s linear infinite' }}/>}
                {status === 'pending'&& <div style={{ width:6, height:6, borderRadius:100, background:T.sub }}/>}
              </div>
              <div>
                <div style={{ fontSize:'.83rem', fontWeight:600,
                  color: status === 'pending' ? T.sub : T.text }}>{s.label}</div>
                {status !== 'pending' && (
                  <div style={{ fontSize:'.72rem', color:T.sub, marginTop:'.1rem' }}>{s.detail}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────
function KpiCard({ kpi, T, theme }) {
  const pos = kpi.change !== null && kpi.change > 0;
  const neg = kpi.change !== null && kpi.change < 0;
  const icons = {
    currency: <DollarSign size={14} style={{ color:'#10b981' }}/>,
    count:    <Database   size={14} style={{ color:'#6366f1' }}/>,
    percent:  <Target     size={14} style={{ color:'#f59e0b' }}/>,
    person:   <Users      size={14} style={{ color:'#8b5cf6' }}/>,
    trend:    <Activity   size={14} style={{ color:'#3b82f6' }}/>,
  };
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:'1.1rem' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.6rem' }}>
        <div style={{ fontSize:'.72rem', fontWeight:700, color:T.sub, textTransform:'uppercase', letterSpacing:'.05em' }}>
          {kpi.label}
        </div>
        {icons[kpi.icon]}
      </div>
      <div style={{ fontSize:'1.75rem', fontWeight:800, color:T.text, lineHeight:1, marginBottom:'.5rem' }}>
        {kpi.formatted}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'.4rem' }}>
        {pos && <><ArrowUpRight size={13} style={{ color:'#10b981' }}/><span style={{ fontSize:'.75rem', color:'#10b981', fontWeight:600 }}>+{kpi.change?.toFixed(1)}%</span></>}
        {neg && <><ArrowDownRight size={13} style={{ color:'#ef4444' }}/><span style={{ fontSize:'.75rem', color:'#ef4444', fontWeight:600 }}>{kpi.change?.toFixed(1)}%</span></>}
        {!pos && !neg && kpi.icon !== 'person' && <><Minus size={12} style={{ color:T.sub }}/><span style={{ fontSize:'.75rem', color:T.sub }}>Stable</span></>}
        {kpi.changeLabel && <span style={{ fontSize:'.7rem', color:T.sub }}>{kpi.changeLabel}</span>}
      </div>
      {kpi.sparkline?.length >= 3 && (
        <div style={{ marginTop:'.6rem', height:30 }}>
          <ResponsiveContainer width="100%" height={30}>
            <ReArea data={kpi.sparkline.map((v,i) => ({ i, v }))} margin={{ top:0,right:0,bottom:0,left:0 }}>
              <Area type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={1.5}
                fill="rgba(99,102,241,0.15)" dot={false} isAnimationActive={false}/>
            </ReArea>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── ChartWidget ──────────────────────────────────────────────────────────────
const TYPE_SWITCHER = [
  { type:'bar',  Icon: BarChart  },
  { type:'line', Icon: LineIcon  },
  { type:'area', Icon: TrendingUp},
  { type:'pie',  Icon: PieIcon   },
];

function ChartWidget({ spec: initialSpec, data, T, theme, onExpand }) {
  const [activeType, setActiveType] = useState(initialSpec.type === 'hbar' ? 'bar' : initialSpec.type);
  const spec = { ...initialSpec, type: activeType };

  const chartData = data.length > 0 ? data : [];
  const keys = chartData.length > 0
    ? Object.keys(chartData[0]).filter(k => k !== 'name' && k !== 'growth' && k !== 'isPeak' && k !== 'isWorst')
    : ['value'];

  const fmtY = (v) => {
    if (v >= 1e7) return `${(v/1e7).toFixed(1)}Cr`;
    if (v >= 1e5) return `${(v/1e5).toFixed(1)}L`;
    if (v >= 1e3) return `${(v/1e3).toFixed(0)}K`;
    return Math.round(v).toLocaleString('en-IN');
  };

  const ttStyle = { background:T.card, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, fontSize:'.78rem' };
  const axTick  = { fill:T.sub, fontSize:11 };

  const renderChart = () => {
    const common = { data: chartData, margin:{ top:5, right:10, left:-10, bottom:5 } };
    switch (spec.type) {
      case 'bar':
        return (
          <ReBar {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
            <XAxis dataKey="name" tick={axTick} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
            <YAxis tick={axTick} tickLine={false} axisLine={false} tickFormatter={fmtY}/>
            <Tooltip contentStyle={ttStyle} formatter={(v) => [fmtY(v)]}/>
            <Legend wrapperStyle={{ color:T.sub, fontSize:12 }}/>
            {keys.map((k,i) => <Bar key={k} dataKey={k} fill={COLORS[i%COLORS.length]} radius={[4,4,0,0]}/>)}
          </ReBar>
        );
      case 'hbar':
        return (
          <ReBar layout="horizontal" {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false}/>
            <XAxis type="number" tick={axTick} tickLine={false} axisLine={false} tickFormatter={fmtY}/>
            <YAxis type="category" dataKey="name" width={120} tick={{ ...axTick, fontSize:10 }} tickLine={false} axisLine={false}/>
            <Tooltip contentStyle={ttStyle} formatter={(v) => [fmtY(v)]}/>
            {keys.map((k,i) => <Bar key={k} dataKey={k} fill={COLORS[i%COLORS.length]} radius={[0,4,4,0]}/>)}
          </ReBar>
        );
      case 'line':
        return (
          <ReLine {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
            <XAxis dataKey="name" tick={axTick} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
            <YAxis tick={axTick} tickLine={false} axisLine={false} tickFormatter={fmtY}/>
            <Tooltip contentStyle={ttStyle} formatter={(v) => [fmtY(v)]}/>
            <Legend wrapperStyle={{ color:T.sub, fontSize:12 }}/>
            {keys.map((k,i) => <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i%COLORS.length]}
              strokeWidth={2.5} dot={false} activeDot={{ r:4 }}/>)}
          </ReLine>
        );
      case 'area':
        return (
          <ReArea {...common}>
            <defs>
              {keys.map((k,i) => (
                <linearGradient key={k} id={`ag-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={COLORS[i%COLORS.length]} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS[i%COLORS.length]} stopOpacity={0}/>
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
            <XAxis dataKey="name" tick={axTick} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
            <YAxis tick={axTick} tickLine={false} axisLine={false} tickFormatter={fmtY}/>
            <Tooltip contentStyle={ttStyle} formatter={(v) => [fmtY(v)]}/>
            <Legend wrapperStyle={{ color:T.sub, fontSize:12 }}/>
            {keys.map((k,i) => (
              <Area key={k} type="monotone" dataKey={k} stroke={COLORS[i%COLORS.length]}
                strokeWidth={2.5} fill={`url(#ag-${i})`}/>
            ))}
          </ReArea>
        );
      case 'pie':
        return (
          <RePie>
            <Pie data={chartData} cx="50%" cy="50%" outerRadius={85} dataKey="value" nameKey="name"
              label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
            </Pie>
            <Tooltip contentStyle={ttStyle}/>
          </RePie>
        );
      default: return null;
    }
  };

  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:'1rem',
      display:'flex', flexDirection:'column', gap:'.5rem' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'.5rem' }}>
        <div>
          <div style={{ fontWeight:600, fontSize:'.85rem', color:T.text }}>{initialSpec.title}</div>
          {initialSpec.description && <div style={{ fontSize:'.72rem', color:T.sub }}>{initialSpec.description}</div>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'.3rem' }}>
          {TYPE_SWITCHER.filter(s => s.type !== 'hbar').map(({ type, Icon }) => (
            <button key={type} onClick={() => setActiveType(type)}
              style={{ background: activeType===type ? 'rgba(99,102,241,0.15)' : 'none',
                border:`1px solid ${activeType===type ? '#6366f1' : T.border}`,
                borderRadius:6, padding:'.25rem .4rem', cursor:'pointer', color: activeType===type ? '#6366f1' : T.sub,
                display:'flex', transition:'.15s' }}>
              <Icon size={12}/>
            </button>
          ))}
          <button onClick={onExpand}
            style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:6,
              padding:'.25rem .4rem', cursor:'pointer', color:T.sub, display:'flex', marginLeft:'.2rem' }}>
            <TrendingUp size={12}/>
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        {renderChart() || <div/>}
      </ResponsiveContainer>
    </div>
  );
}

// ─── AgentLeaderboard ─────────────────────────────────────────────────────────
function AgentLeaderboard({ agentData, amountLabel, T, theme }) {
  if (!agentData?.length) return null;
  const maxVal = agentData[0]?.value || 1;
  const medals = ['🥇','🥈','🥉'];
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:'1.1rem' }}>
      <div style={{ fontWeight:700, fontSize:'.88rem', color:T.text, marginBottom:'.85rem',
        display:'flex', alignItems:'center', gap:'.5rem' }}>
        <Trophy size={15} style={{ color:'#f59e0b' }}/> Agent Performance Leaderboard
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'.45rem' }}>
        {agentData.slice(0, 10).map((a, i) => (
          <div key={a.name} style={{ display:'flex', alignItems:'center', gap:'.75rem' }}>
            <div style={{ width:24, textAlign:'center', fontSize:'.8rem', flexShrink:0 }}>
              {i < 3 ? medals[i] : <span style={{ color:T.sub, fontWeight:600 }}>{i+1}</span>}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.2rem' }}>
                <span style={{ fontSize:'.82rem', fontWeight:600, color:T.text,
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'60%' }}>
                  {a.name}
                </span>
                <span style={{ fontSize:'.78rem', fontWeight:700, color:'#10b981', flexShrink:0 }}>
                  {formatKPIValue(a.value, 'amount_col')}
                </span>
              </div>
              <div style={{ height:5, background:T.hover, borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:3, transition:'width .5s',
                  width: `${(a.value / maxVal) * 100}%`,
                  background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#6366f1',
                }}/>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── DataTable ────────────────────────────────────────────────────────────────
function DataTable({ rows, headers, T }) {
  const [page, setPage]     = useState(0);
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

  const toggleSort = (h) => {
    if (sortCol === h) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(h); setSortDir('asc'); }
  };

  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, overflow:'hidden' }}>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.8rem' }}>
          <thead>
            <tr style={{ background: T.hover }}>
              {headers.map(h => (
                <th key={h} onClick={() => toggleSort(h)} style={{ padding:'.55rem .8rem', textAlign:'left',
                  color:T.sub, fontWeight:700, fontSize:'.72rem', textTransform:'uppercase', letterSpacing:'.04em',
                  borderBottom:`1px solid ${T.border}`, whiteSpace:'nowrap', cursor:'pointer', userSelect:'none' }}>
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
                  <td key={h} style={{ padding:'.45rem .8rem', color:T.text, whiteSpace:'nowrap',
                    maxWidth:160, overflow:'hidden', textOverflow:'ellipsis' }}>
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
          padding:'.5rem .8rem', borderTop:`1px solid ${T.border}`, fontSize:'.75rem', color:T.sub }}>
          <span>Showing {page*PER+1}–{Math.min((page+1)*PER, rows.length)} of {rows.length.toLocaleString()}</span>
          <div style={{ display:'flex', gap:'.35rem' }}>
            {[['← Prev', page>0, () => setPage(p=>p-1)], ['Next →', page<total-1, () => setPage(p=>p+1)]].map(([lbl, en, fn]) => (
              <button key={lbl} disabled={!en} onClick={fn}
                style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:6,
                  padding:'.2rem .6rem', cursor: en ? 'pointer':'not-allowed', color: en ? T.text : T.sub }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AiDashboardMaker() {
  const [theme, setTheme]               = useState('dark');
  const T = theme === 'dark' ? DARK : LIGHT;

  const [step, setStep]                 = useState('upload');
  const [file, setFile]                 = useState(null);
  const [rows, setRows]                 = useState([]);
  const [headers, setHeaders]           = useState([]);
  const [analysis, setAnalysis]         = useState(null);
  const [userPrompt, setUserPrompt]     = useState('');
  const [columnHelp, setColumnHelp]     = useState('');
  const [semanticOverrides, setSemOv]   = useState({});
  const [genStage, setGenStage]         = useState(0);
  const [loading, setLoading]           = useState(false);
  const [dashboard, setDashboard]       = useState(null);
  const [expandedChart, setExpChart]    = useState(null);
  const [showTable, setShowTable]       = useState(false);
  const [recent, setRecent]             = useState(() => DashboardStorage.load());
  const fileRef = useRef(null);

  const effectiveAnalysis = useMemo(() => {
    if (!analysis || !Object.keys(semanticOverrides).length) return analysis;
    const sm = { ...analysis.semanticMap, ...semanticOverrides };
    const getFirst = type => analysis.headers.find(h => sm[h] === type) || null;
    return {
      ...analysis,
      semanticMap:       sm,
      primaryDateCol:    getFirst('date_col'),
      primaryAmountCol:  getFirst('amount_col') || getFirst('numeric_col'),
      primaryAgentCol:   getFirst('agent_col'),
      primaryStatusCol:  getFirst('status_col'),
      primaryCategoryCol:getFirst('category_col'),
      idCols:            analysis.headers.filter(h => sm[h] === 'id_col'),
      mobileCols:        analysis.headers.filter(h => sm[h] === 'mobile_col'),
    };
  }, [analysis, semanticOverrides]);

  // ── File parsing ─────────────────────────────────────────────────────────
  const handleFile = useCallback(async (f) => {
    if (!f) return;
    setFile(f);
    try {
      const buf = await f.arrayBuffer();
      const wb  = XLSX.read(buf, { type:'array', cellDates:false });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { defval:'' });
      if (!data.length) { toast.error('File appears to be empty'); return; }

      const hdrs = Object.keys(data[0]);
      const analyzed = analyzeDataset(data, hdrs);

      setRows(data);
      setHeaders(hdrs);
      setAnalysis(analyzed);
      setSemOv({});
      setStep('schema');
      toast.success(`Loaded ${data.length.toLocaleString()} rows × ${hdrs.length} columns`);
    } catch (err) {
      toast.error('Failed to read file: ' + err.message);
    }
  }, []);

  // ── Dashboard generation ──────────────────────────────────────────────────
  const generateDashboard = async () => {
    if (loading) return;
    setLoading(true);
    setGenStage(0);
    setStep('generating');

    try {
      const ea = effectiveAnalysis || analysis;
      await new Promise(r => setTimeout(r, 350));
      setGenStage(1);

      const payload = {
        headers:         ea.headers,
        sampleRows:      rows.slice(0, 10),
        columnTypes:     Object.fromEntries(ea.headers.map(h => [h, ea.colMeta[h].dataType])),
        columnSemantics: ea.semanticMap,
        userPrompt,
        helperText:      columnHelp,
        rowCount:        rows.length,
      };

      let plan   = null;
      let source = 'local';

      // Primary: backend (Groq + Gemini)
      try {
        const ctrl  = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 28000);
        const resp  = await fetch(`${API_BASE_URL}/api/ai/dashboard-plan`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
          signal:  ctrl.signal,
        });
        clearTimeout(timer);
        const data = await resp.json();
        if (data.success) {
          plan   = data.plan;
          source = data.source || 'gemini';
        } else {
          const msgs = {
            RATE_LIMITED:   'AI rate limited — using smart auto-generation',
            TIMEOUT:        'AI timed out — using smart auto-generation',
            PARSE_ERROR:    'AI response invalid — using auto-generation',
            EMPTY_RESPONSE: 'AI returned empty — using auto-generation',
          };
          toast(msgs[data.code] || `AI unavailable — using auto-generation`, { icon:'⚡' });
        }
      } catch (netErr) {
        toast(netErr.name === 'AbortError' ? 'Request timed out — using auto-generation' : 'Network error — using auto-generation', { icon:'⚡' });
      }

      // Puter AI fallback
      if (!plan && typeof window !== 'undefined' && window.puter?.ai?.chat) {
        try {
          const aiPayload = buildAIPayload(ea, userPrompt, columnHelp);
          const puterResp = await window.puter.ai.chat(
            `You are a BI expert. Return ONLY valid JSON dashboard config (no markdown) with schema: {"title":"","subtitle":"","insights":[],"charts":[{"type":"bar|line|area|pie","title":"","description":"","xCol":"","yCol":"","aggregation":"sum|count","timeSeries":false,"limit":15}]}\n\nDataset:\n${aiPayload}`,
            { model: 'gpt-4o-mini' }
          );
          const raw = typeof puterResp === 'string' ? puterResp
            : puterResp?.message?.content || puterResp?.choices?.[0]?.message?.content || '';
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) { plan = JSON.parse(jsonMatch[0]); source = 'puter'; }
        } catch {}
      }

      // Local fallback
      if (!plan) {
        plan   = buildFallbackPlan(ea, userPrompt);
        source = 'local';
      }

      setGenStage(2);

      // Build chart data locally
      const builtCharts = (plan.charts || []).map(spec => {
        let data;
        if (spec.timeSeries && ea.primaryDateCol) {
          data = buildDateTrends(rows, spec.xCol, spec.yCol || null, spec.timeGroupBy || 'month');
        } else {
          data = aggregateForChart(rows, spec.xCol, spec.yCol || null, spec.aggregation || 'sum', spec.limit || 20);
        }
        return { spec, data };
      }).filter(c => c.data && c.data.length > 0);

      const kpis = generateKPIs(ea, rows);

      // Agent leaderboard
      let agentData = null;
      if (ea.primaryAgentCol) {
        const totals = {};
        const amtCol = ea.primaryAmountCol;
        rows.forEach(r => {
          const ag = String(r[ea.primaryAgentCol] || '').trim();
          if (!ag) return;
          const v = amtCol ? (parseFloat(String(r[amtCol]||0).replace(/[₹Rs.,$ %]/g,''))||0) : 1;
          totals[ag] = (totals[ag] || 0) + v;
        });
        agentData = Object.entries(totals).sort(([,a],[,b])=>b-a).slice(0,15).map(([name,value],i)=>({rank:i+1,name,value}));
      }

      // Persist to history
      const entry = {
        id:        `dash_${Date.now()}`,
        title:     plan.title || 'Dashboard',
        fileName:  file?.name || 'unknown',
        rowCount:  rows.length,
        headers:   ea.headers,
        createdAt: Date.now(),
        plan,
        kpis,
        theme,
      };
      DashboardStorage.save(entry);
      setRecent(DashboardStorage.load());

      setGenStage(3);
      await new Promise(r => setTimeout(r, 400));

      setDashboard({ plan, kpis, builtCharts, agentData, source, savedId: entry.id });
      setStep('dashboard');

      if (source === 'gemini')       toast.success('AI dashboard generated!');
      else if (source === 'groq_fallback') toast.success('Dashboard generated (Groq)');
      else if (source === 'puter')   toast.success('Dashboard generated via Puter AI');
      else                           toast.success('Smart dashboard generated!');

    } catch (err) {
      toast.error('Generation failed: ' + err.message);
      setStep('schema');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = (d) => {
    const builtCharts = (d.plan.charts || []).map(spec => {
      const data = spec.timeSeries
        ? buildDateTrends(rows, spec.xCol, spec.yCol || null, spec.timeGroupBy || 'month')
        : aggregateForChart(rows, spec.xCol, spec.yCol || null, spec.aggregation || 'sum', spec.limit || 20);
      return { spec, data };
    }).filter(c => c.data?.length > 0);
    setDashboard({ ...d, builtCharts, source: 'restored' });
    setStep('dashboard');
  };

  const downloadCSV = () => {
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => `"${String(r[h]||'').replace(/"/g,'""')}"`).join(',')),
    ].join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type:'text/csv' })),
      download: `${file?.name?.replace(/\.[^.]+$/,'') || 'export'}_dashboard.csv`,
    });
    a.click(); URL.revokeObjectURL(a.href);
    toast.success('CSV exported');
  };

  const resetAll = () => {
    setStep('upload'); setFile(null); setRows([]); setHeaders([]);
    setAnalysis(null); setDashboard(null); setUserPrompt(''); setColumnHelp(''); setSemOv({});
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:T.page, color:T.text, fontFamily:'system-ui,sans-serif' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(99,102,241,0.3);border-radius:99px}
      `}</style>

      {/* ── Header ── */}
      <div style={{ borderBottom:`1px solid ${T.border}`, padding:'.75rem 1.5rem',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        background:T.card, position:'sticky', top:0, zIndex:50, backdropFilter:'blur(12px)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'.6rem' }}>
          <div style={{ width:32, height:32, background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
            borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <BarChart2 size={17} style={{ color:'#fff' }}/>
          </div>
          <div>
            <div style={{ fontWeight:700, fontSize:'.95rem' }}>AI Dashboard Maker</div>
            <div style={{ fontSize:'.68rem', color:T.sub }}>Excel & CSV → Business Intelligence</div>
          </div>
          {dashboard?.source && (
            <span style={{ marginLeft:'.5rem', padding:'.15rem .5rem', borderRadius:100, fontSize:'.68rem', fontWeight:600,
              background: dashboard.source === 'gemini' ? 'rgba(99,102,241,0.12)' :
                          dashboard.source === 'groq_fallback' ? 'rgba(245,158,11,0.12)' :
                          'rgba(16,185,129,0.12)',
              color: dashboard.source === 'gemini' ? '#818cf8' :
                     dashboard.source === 'groq_fallback' ? '#fbbf24' : '#34d399' }}>
              {dashboard.source === 'gemini' ? '✦ Gemini AI' :
               dashboard.source === 'groq_fallback' ? '⚡ Groq AI' :
               dashboard.source === 'puter' ? '☁ Puter AI' : '⚙ Auto'}
            </span>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
          {step === 'dashboard' && (
            <>
              <button onClick={downloadCSV}
                style={{ display:'inline-flex', alignItems:'center', gap:'.35rem',
                  background:T.input, border:`1px solid ${T.border}`, borderRadius:8,
                  padding:'.4rem .8rem', cursor:'pointer', color:T.text, fontSize:'.78rem' }}>
                <Download size={13}/> Export
              </button>
              <button onClick={() => setStep('schema')}
                style={{ display:'inline-flex', alignItems:'center', gap:'.35rem',
                  background:T.input, border:`1px solid ${T.border}`, borderRadius:8,
                  padding:'.4rem .8rem', cursor:'pointer', color:T.text, fontSize:'.78rem' }}>
                <RefreshCw size={13}/> Reconfigure
              </button>
              <button onClick={resetAll}
                style={{ display:'inline-flex', alignItems:'center', gap:'.35rem',
                  background:T.input, border:`1px solid ${T.border}`, borderRadius:8,
                  padding:'.4rem .8rem', cursor:'pointer', color:T.text, fontSize:'.78rem' }}>
                <X size={13}/> New
              </button>
            </>
          )}
          <button onClick={() => setTheme(t => t==='dark'?'light':'dark')}
            style={{ background:T.input, border:`1px solid ${T.border}`, borderRadius:8,
              padding:'.4rem', cursor:'pointer', display:'flex', alignItems:'center', color:T.sub }}>
            {theme === 'dark' ? <Sun size={15}/> : <Moon size={15}/>}
          </button>
        </div>
      </div>

      <div style={{ maxWidth:1200, margin:'0 auto', padding:'1.75rem 1.25rem' }}>

        {/* ── Upload step ── */}
        {step === 'upload' && (
          <div style={{ maxWidth:660, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:'2.5rem' }}>
              <div style={{ fontSize:'2rem', fontWeight:800, marginBottom:'.5rem',
                background:'linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                Turn data into dashboards
              </div>
              <div style={{ color:T.sub }}>
                Upload Excel or CSV — get a professional BI dashboard in seconds
              </div>
            </div>
            <UploadZone onFile={handleFile} T={T} theme={theme}/>
            <div style={{ marginTop:'1rem', padding:'.75rem 1rem',
              background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)',
              borderRadius:10, display:'flex', gap:'.65rem', alignItems:'flex-start' }}>
              <Info size={14} style={{ color:'#6366f1', flexShrink:0, marginTop:2 }}/>
              <div style={{ fontSize:'.78rem', color:T.sub, lineHeight:1.6 }}>
                <strong style={{ color:'#a5b4fc' }}>Privacy:</strong> Data is processed locally in your browser.
                Only column names, types, and 10 sample rows are sent to AI — never your full dataset.
              </div>
            </div>
            {recent.length > 0 && (
              <div style={{ marginTop:'1.5rem' }}>
                <RecentDashboards dashboards={recent}
                  onRestore={d => {
                    setFile({ name: d.fileName });
                    setRows([]); setHeaders(d.headers || []);
                    handleRestore(d);
                  }}
                  onDelete={id => { DashboardStorage.remove(id); setRecent(DashboardStorage.load()); }}
                  T={T} theme={theme}/>
              </div>
            )}
          </div>
        )}

        {/* ── Schema step ── */}
        {step === 'schema' && analysis && (
          <SchemaPreview
            analysis={effectiveAnalysis || analysis}
            semanticOverrides={semanticOverrides}
            setSemanticOverrides={setSemOv}
            userPrompt={userPrompt} setUserPrompt={setUserPrompt}
            columnHelp={columnHelp} setColumnHelp={setColumnHelp}
            onGenerate={generateDashboard}
            loading={loading}
            T={T} theme={theme}
            onBack={resetAll}
          />
        )}

        {/* ── Generating step ── */}
        {step === 'generating' && (
          <GenerationProgress stage={genStage} T={T}/>
        )}

        {/* ── Dashboard step ── */}
        {step === 'dashboard' && dashboard && (() => {
          const { plan, kpis, builtCharts, agentData } = dashboard;
          const kpiCols = Math.min(kpis.length, 4);
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
              {/* Title */}
              <div>
                <div style={{ fontSize:'1.6rem', fontWeight:800, marginBottom:'.25rem' }}>{plan.title}</div>
                <div style={{ color:T.sub }}>{plan.subtitle}</div>
              </div>

              {/* KPIs */}
              {kpis.length > 0 && (
                <div style={{ display:'grid', gridTemplateColumns:`repeat(${kpiCols},1fr)`, gap:'1rem' }}>
                  {kpis.map((kpi,i) => <KpiCard key={kpi.id||i} kpi={kpi} T={T} theme={theme}/>)}
                </div>
              )}

              {/* Insights */}
              {plan.insights?.length > 0 && (
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:'1rem' }}>
                  <div style={{ fontWeight:600, fontSize:'.85rem', marginBottom:'.65rem',
                    display:'flex', alignItems:'center', gap:'.4rem' }}>
                    <Sparkles size={14} style={{ color:'#6366f1' }}/> AI Insights
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'.4rem' }}>
                    {plan.insights.map((ins,i) => (
                      <div key={i} style={{ display:'flex', gap:'.5rem', alignItems:'flex-start',
                        fontSize:'.84rem', color:T.sub }}>
                        <CheckCircle size={13} style={{ color:'#10b981', flexShrink:0, marginTop:2 }}/>{ins}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Charts */}
              {builtCharts.length > 0 && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                  {builtCharts.map((c,i) => (
                    <ChartWidget key={i} spec={c.spec} data={c.data} T={T} theme={theme}
                      onExpand={() => setExpChart(c)}/>
                  ))}
                </div>
              )}

              {/* Agent Leaderboard */}
              {agentData?.length > 0 && (
                <AgentLeaderboard agentData={agentData}
                  amountLabel={(effectiveAnalysis||analysis)?.primaryAmountCol || 'Amount'}
                  T={T} theme={theme}/>
              )}

              {/* Data Table */}
              <div>
                <button onClick={() => setShowTable(s=>!s)}
                  style={{ display:'inline-flex', alignItems:'center', gap:'.35rem',
                    background:T.input, border:`1px solid ${T.border}`, borderRadius:8,
                    padding:'.4rem .85rem', cursor:'pointer', color:T.text, fontSize:'.8rem',
                    marginBottom: showTable ? '.75rem' : 0 }}>
                  <Table2 size={13}/> {showTable ? 'Hide' : 'Show'} Raw Data Table
                </button>
                {showTable && rows.length > 0 && <DataTable rows={rows} headers={headers} T={T}/>}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Expanded chart modal ── */}
      {expandedChart && (
        <div onClick={() => setExpChart(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:1000,
            display:'flex', alignItems:'center', justifyContent:'center',
            padding:'2rem', backdropFilter:'blur(8px)' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:18,
              padding:'1.5rem', width:'90vw', maxWidth:900 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <div>
                <div style={{ fontWeight:700, fontSize:'1rem' }}>{expandedChart.spec.title}</div>
                {expandedChart.spec.description && <div style={{ fontSize:'.8rem', color:T.sub }}>{expandedChart.spec.description}</div>}
              </div>
              <button onClick={() => setExpChart(null)}
                style={{ background:'none', border:'none', cursor:'pointer', color:T.sub, display:'flex' }}>
                <X size={20}/>
              </button>
            </div>
            <div style={{ height:400 }}>
              <ChartWidget spec={expandedChart.spec} data={expandedChart.data}
                T={T} theme={theme} onExpand={() => {}}/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Play, Upload, Trash2, Table, AlertCircle, Clock,
  BarChart2, Download, ChevronLeft, ChevronRight, X, Copy,
  Check, RefreshCw, History, ExternalLink, Zap, Eye, Hash,
  Filter, TrendingUp, Search,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { EditorState } from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, highlightActiveLine,
  ViewPlugin, WidgetType, Decoration,
} from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { sql as sqlLang } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import ToolHeader from '../../components/shared/ToolHeader';
import RelatedTools from '../../components/shared/RelatedTools';

// ─── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 50;
const CHART_COLORS = ['#6366f1','#8b5cf6','#d946ef','#3b82f6','#10b981','#f59e0b','#ef4444','#06b6d4','#84cc16','#f97316'];
const SQL_KW = ['SELECT','FROM','WHERE','AND','OR','NOT','IN','IS','NULL','LIKE','ORDER','BY','GROUP','HAVING','LIMIT','OFFSET','DISTINCT','AS','JOIN','LEFT','RIGHT','INNER','ON','COUNT','SUM','AVG','MIN','MAX','CASE','WHEN','THEN','ELSE','END','BETWEEN','UNION','ALL','ASC','DESC','ROUND','STRFTIME','LENGTH','UPPER','LOWER','TRIM'];

// ─── sql.js singleton — try npm package, fall back to CDN ─────────────────────
const CDN_JS   = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js';
const CDN_WASM = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.wasm';

async function _loadEngine() {
  // Attempt 1 — npm package (handles multiple Vite/esbuild export shapes)
  try {
    const mod = await import('sql.js');
    const candidate = mod.default ?? mod;
    const fn = typeof candidate === 'function' ? candidate
             : typeof candidate?.default === 'function' ? candidate.default
             : null;
    if (fn) {
      const engine = await fn({ locateFile: () => '/sql-wasm.wasm' });
      if (typeof engine?.Database === 'function') return engine; // sanity-check
    }
  } catch { /* fall through to CDN */ }

  // Attempt 2 — CDN script tag (bypasses all bundler interop issues)
  await new Promise((resolve, reject) => {
    if (typeof window.initSqlJs === 'function') return resolve();
    const s = document.createElement('script');
    s.src = CDN_JS;
    s.onload  = resolve;
    s.onerror = () => reject(new Error('Could not load SQL engine. Check your internet connection.'));
    document.head.appendChild(s);
  });
  return window.initSqlJs({ locateFile: () => CDN_WASM });
}

let _enginePromise = null;
function getSqlEngine() {
  if (!_enginePromise) {
    _enginePromise = _loadEngine().catch(err => { _enginePromise = null; throw err; });
  }
  return _enginePromise;
}

async function buildDb(tables) {
  const SQL = await getSqlEngine();
  const db = new SQL.Database();
  for (const t of tables) {
    db.run(`CREATE TABLE IF NOT EXISTS "${t.name}" (${t.columns.map(c => `"${c}" TEXT`).join(', ')})`);
    if (t.rows.length > 0) {
      const ph = t.columns.map(() => '?').join(', ');
      const stmt = db.prepare(`INSERT INTO "${t.name}" VALUES (${ph})`);
      for (const row of t.rows) stmt.run(t.columns.map(c => String(row[c] ?? '')));
      stmt.free();
    }
  }
  return db;
}

// ─── File parsing ───────────────────────────────────────────────────────────────
function toTableName(filename) {
  return filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^(\d)/, '_$1').toLowerCase().slice(0, 60) || 'data';
}

async function parseFile(file) {
  const buf = await file.arrayBuffer();
  const wb  = XLSX.read(buf, { type: 'array' });
  const ws  = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (raw.length < 2) throw new Error('File appears empty or has only a header row.');
  const columns = raw[0].map((c, i) => (String(c || `col${i}`).replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1') || `col${i}`));
  const rows    = raw.slice(1).map(row => { const o = {}; columns.forEach((col, i) => { o[col] = row[i] ?? ''; }); return o; });
  return { name: toTableName(file.name), columns, rows };
}

// ─── Column type detection (for schema display) ─────────────────────────────────
const TYPE_COLOR = {
  numeric: '#10b981', currency: '#f59e0b', percentage: '#8b5cf6',
  date: '#06b6d4', location: '#ec4899', categorical: '#6366f1',
  id: '#94a3b8',
};
const TYPE_LABEL = {
  numeric: '123', currency: '$', percentage: '%',
  date: '📅', location: '📍', categorical: '◈', id: '#',
};

function detectType(col, values) {
  const lower = col.toLowerCase();
  const sample = values.filter(v => v !== null && v !== undefined && v !== '').slice(0, 80);
  if (!sample.length) return 'categorical';
  if (/(?:^|_)(id)$/.test(lower)) return 'id';
  if (/date|time|year|month|day|created|updated|timestamp/.test(lower)) return 'date';
  if (/price|cost|revenue|salary|income|amount|sales|profit/.test(lower)) return 'currency';
  if (/rate|percent|ratio|score/.test(lower)) return 'percentage';
  if (/city|state|country|region|location/.test(lower)) return 'location';
  const numCount = sample.map(v => String(v).replace(/[$,€£%\s]/g, '')).filter(v => !isNaN(parseFloat(v))).length;
  if (numCount / sample.length > 0.8) return 'numeric';
  return 'categorical';
}

function getColumnTypes(table) {
  const types = {};
  for (const col of table.columns) {
    types[col] = detectType(col, table.rows.map(r => r[col]));
  }
  return types;
}

// ─── Starter query suggestions based on actual table columns ───────────────────
function buildStarters(table) {
  if (!table) return [];
  const tn   = `"${table.name}"`;
  const cols  = table.columns;
  const types  = getColumnTypes(table);

  const numCols = cols.filter(c => ['numeric','currency','percentage'].includes(types[c]));
  const catCols = cols.filter(c => types[c] === 'categorical');
  const dateCols = cols.filter(c => types[c] === 'date');

  const starters = [
    { icon: Eye,       label: 'Preview',       sql: `SELECT *\nFROM ${tn}\nLIMIT 10;` },
    { icon: Hash,      label: 'Count rows',    sql: `SELECT COUNT(*) AS total_rows\nFROM ${tn};` },
  ];

  if (numCols[0]) starters.push({
    icon: TrendingUp, label: `Stats on ${numCols[0]}`,
    sql: `SELECT\n  MIN("${numCols[0]}") AS min_val,\n  MAX("${numCols[0]}") AS max_val,\n  ROUND(AVG("${numCols[0]}"), 2) AS avg_val,\n  ROUND(SUM("${numCols[0]}"), 2) AS total\nFROM ${tn};`,
  });

  if (catCols[0]) starters.push({
    icon: Filter, label: `Group by ${catCols[0]}`,
    sql: `SELECT "${catCols[0]}",\n  COUNT(*) AS count\nFROM ${tn}\nGROUP BY "${catCols[0]}"\nORDER BY count DESC\nLIMIT 15;`,
  });

  if (numCols[0] && catCols[0]) starters.push({
    icon: BarChart2, label: `Top by ${numCols[0]}`,
    sql: `SELECT "${catCols[0]}",\n  ROUND(SUM("${numCols[0]}"), 2) AS total\nFROM ${tn}\nGROUP BY "${catCols[0]}"\nORDER BY total DESC\nLIMIT 10;`,
  });

  if (dateCols[0] && numCols[0]) starters.push({
    icon: TrendingUp, label: 'Monthly trend',
    sql: `SELECT\n  STRFTIME('%Y-%m', "${dateCols[0]}") AS month,\n  ROUND(SUM("${numCols[0]}"), 2) AS total,\n  COUNT(*) AS records\nFROM ${tn}\nGROUP BY month\nORDER BY month ASC;`,
  });

  starters.push({
    icon: Search, label: 'Missing values',
    sql: `SELECT ${cols.slice(0, 5).map(c => `\n  SUM(CASE WHEN "${c}" IS NULL OR "${c}" = '' THEN 1 ELSE 0 END) AS ${c.slice(0,14)}_nulls`).join(',')}\nFROM ${tn};`,
  });

  return starters;
}

// ─── Chart helpers ──────────────────────────────────────────────────────────────
function detectChartType(results) {
  if (!results || results.columns.length !== 2 || results.values.length < 2) return null;
  const vals = results.values.map(r => parseFloat(r[1]));
  if (vals.filter(v => !isNaN(v)).length / vals.length < 0.8) return null;
  if (results.values.map(r => String(r[0] ?? '')).some(v => /^\d{4}-\d{2}/.test(v))) return 'line';
  if (results.values.length <= 8) return 'pie';
  return 'bar';
}

function chartData(results) {
  if (!results) return [];
  return results.values.map(row => {
    const obj = {};
    results.columns.forEach((col, i) => { obj[col] = isNaN(parseFloat(row[i])) ? (row[i] ?? '') : parseFloat(row[i]); });
    return obj;
  });
}

function fmtNum(n) {
  if (n === undefined || n === null) return '—';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}

function exportCSV(results) {
  const csv = [results.columns.join(','), ...results.values.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'results.csv' });
  a.click();
}

// ─── Ghost text (inline autocomplete) ──────────────────────────────────────────
class GhostWidget extends WidgetType {
  constructor(text) { super(); this.text = text; }
  eq(o) { return o.text === this.text; }
  toDOM() {
    const s = document.createElement('span');
    s.textContent = this.text;
    s.setAttribute('aria-hidden', 'true');
    s.style.cssText = 'color:rgba(148,163,184,0.35);pointer-events:none;font-style:italic;';
    return s;
  }
  ignoreEvent() { return true; }
}

function buildGhostExt(tablesRef) {
  const hint = (partial, tables) => {
    const up = partial.toUpperCase();
    const kw = SQL_KW.find(k => k.startsWith(up) && k.length > up.length);
    if (kw) return kw.slice(up.length);
    const lo = partial.toLowerCase();
    for (const t of tables) {
      if (t.name.toLowerCase().startsWith(lo) && t.name.length > lo.length) return t.name.slice(lo.length);
      for (const c of t.columns) if (c.toLowerCase().startsWith(lo) && c.length > lo.length) return c.slice(lo.length);
    }
    return null;
  };

  const plugin = ViewPlugin.fromClass(class {
    constructor(v) { this.decorations = this._c(v); }
    update(u) { if (u.docChanged || u.selectionSet) this.decorations = this._c(u.view); }
    _c(view) {
      const sel = view.state.selection.main;
      if (!sel.empty) return Decoration.none;
      const line = view.state.doc.lineAt(sel.from);
      const before = line.text.slice(0, sel.from - line.from);
      const m = before.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
      if (!m || m[1].length < 2) return Decoration.none;
      const h = hint(m[1], tablesRef.current);
      if (!h) return Decoration.none;
      return Decoration.set([Decoration.widget({ widget: new GhostWidget(h), side: 1 }).range(sel.from)]);
    }
  }, { decorations: v => v.decorations });

  const accept = keymap.of([{
    key: 'Tab', run: view => {
      const sel = view.state.selection.main;
      if (!sel.empty) return false;
      const line = view.state.doc.lineAt(sel.from);
      const before = line.text.slice(0, sel.from - line.from);
      const m = before.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
      if (!m || m[1].length < 2) return false;
      const h = hint(m[1], tablesRef.current);
      if (!h) return false;
      view.dispatch({ changes: { from: sel.from, insert: h }, selection: { anchor: sel.from + h.length } });
      return true;
    },
  }]);
  return [plugin, accept];
}

// ─── Simple SQL formatter ───────────────────────────────────────────────────────
function formatSQL(raw) {
  const KWS = ['SELECT','FROM','WHERE','GROUP BY','ORDER BY','HAVING','LIMIT','OFFSET',
    'LEFT JOIN','RIGHT JOIN','INNER JOIN','FULL JOIN','CROSS JOIN','JOIN','ON',
    'UNION ALL','UNION','AND','OR','CASE','WHEN','THEN','ELSE','END'];
  let s = raw.replace(/\s+/g, ' ').trim();
  for (const kw of KWS) {
    s = s.replace(new RegExp(`(?<=[^\\w]|^)${kw}(?=[^\\w]|$)`, 'gi'), `\n${kw.toUpperCase()}`);
  }
  return s.split('\n').map(l => l.trim()).filter(Boolean).join('\n');
}

// ─── CSS ────────────────────────────────────────────────────────────────────────
const CSS = `
  .sp-wrap { display:grid; grid-template-columns:220px 1fr; gap:0.75rem; align-items:flex-start; }
  .sp-panel { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:12px; overflow:hidden; }
  .sp-hdr { padding:0.48rem 0.85rem; background:rgba(0,0,0,0.28); border-bottom:1px solid rgba(255,255,255,0.06); font-size:0.69rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.07em; display:flex; align-items:center; gap:0.35rem; }
  .sp-tbl-row { display:flex; align-items:center; justify-content:space-between; padding:0.48rem 0.75rem; cursor:pointer; font-size:0.79rem; transition:background 0.12s; }
  .sp-tbl-row:hover { background:rgba(255,255,255,0.04); }
  .sp-tbl-row.active { background:rgba(99,102,241,0.13); color:#a5b4fc; }
  .sp-col-row { padding:0.24rem 0.75rem; font-size:0.73rem; color:var(--text-secondary); border-bottom:1px solid rgba(255,255,255,0.03); font-family:monospace; display:flex; align-items:center; gap:0.35rem; }
  .sp-rt { width:100%; border-collapse:collapse; font-size:0.79rem; table-layout:auto; }
  .sp-rt th { padding:0.46rem 0.7rem; background:#1a1a2e; color:#a5b4fc; text-align:left; font-weight:700; border-bottom:2px solid rgba(99,102,241,0.3); white-space:nowrap; position:sticky; top:0; z-index:2; font-size:0.73rem; box-shadow:0 1px 0 rgba(99,102,241,0.2); }
  .sp-rt th.sp-rn { color:#475569; font-weight:400; width:36px; min-width:36px; }
  .sp-rt td { padding:0.36rem 0.7rem; border-bottom:1px solid rgba(255,255,255,0.04); color:var(--text-primary); max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .sp-rt td.sp-rn { color:#475569; font-size:0.7rem; text-align:right; user-select:none; }
  .sp-rt tbody tr:nth-child(even) td { background:rgba(255,255,255,0.012); }
  .sp-rt tbody tr:hover td { background:rgba(99,102,241,0.06) !important; }
  .sp-rw { overflow:auto; max-height:440px; }
  .sp-btn { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.09); border-radius:8px; padding:0.34rem 0.65rem; font-size:0.76rem; color:var(--text-secondary); cursor:pointer; display:flex; align-items:center; gap:0.3rem; transition:all 0.13s; white-space:nowrap; }
  .sp-btn:hover { border-color:rgba(99,102,241,0.4); color:#a5b4fc; background:rgba(99,102,241,0.07); }
  .sp-btn:disabled { opacity:0.35; cursor:not-allowed; }
  .sp-starter { display:flex; align-items:center; gap:0.35rem; padding:0.3rem 0.65rem; border-radius:20px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); font-size:0.74rem; color:var(--text-secondary); cursor:pointer; transition:all 0.13s; white-space:nowrap; }
  .sp-starter:hover { background:rgba(99,102,241,0.1); border-color:rgba(99,102,241,0.35); color:#a5b4fc; }
  .sp-htab { flex:1; padding:0.28rem 0; border-radius:6px; font-size:0.72rem; font-weight:600; display:flex; align-items:center; justify-content:center; gap:0.3rem; border:none; cursor:pointer; transition:all 0.13s; }
  .sp-hist-row { padding:0.42rem 0.75rem; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.04); font-size:0.72rem; font-family:monospace; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:background 0.12s; display:flex; align-items:center; gap:0.35rem; }
  .sp-hist-row:hover { background:rgba(255,255,255,0.04); color:var(--text-primary); }
  .sp-col-click:hover { background:rgba(255,255,255,0.03); cursor:pointer; }
  .cm-editor { border-radius:0 !important; }
  @keyframes spin { to { transform:rotate(360deg); } }
  @media(max-width:768px) { .sp-wrap { grid-template-columns:1fr; } }
`;

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function SqlPractice() {
  const [tables,       setTables]       = useState([]);
  const [query,        setQuery]        = useState('');
  const [results,      setResults]      = useState(null);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [execTime,     setExecTime]     = useState(null);
  const [activeTable,  setActiveTable]  = useState('');
  const [showChart,    setShowChart]    = useState(false);
  const [chartType,    setChartType]    = useState('bar');
  const [page,         setPage]         = useState(1);
  const [history,      setHistory]      = useState([]);
  const [isDragging,   setIsDragging]   = useState(false);
  const [copied,       setCopied]       = useState(false);
  const [sideTab,      setSideTab]      = useState('tables');

  const dbRef              = useRef(null);
  const fileInputRef       = useRef(null);
  const editorContainerRef = useRef(null);
  const editorViewRef      = useRef(null);
  const tablesRef          = useRef(tables);
  const runQueryRef        = useRef(null);
  const queryRef           = useRef(query);

  useEffect(() => { tablesRef.current = tables; }, [tables]);
  useEffect(() => { queryRef.current  = query;  }, [query]);

  const activeInfo   = useMemo(() => tables.find(t => t.name === activeTable), [tables, activeTable]);
  const starters     = useMemo(() => buildStarters(activeInfo),                [activeInfo]);
  const autoChart    = useMemo(() => detectChartType(results),                 [results]);
  const cData        = useMemo(() => chartData(results),                       [results]);
  const pagedValues  = useMemo(() => results ? results.values.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : [], [results, page]);
  const totalPages   = useMemo(() => results ? Math.ceil(results.rowCount / PAGE_SIZE) : 1, [results]);
  const colTypes     = useMemo(() => activeInfo ? getColumnTypes(activeInfo) : {}, [activeInfo]);

  // Warm up WASM engine early so first Run is instant
  useEffect(() => { getSqlEngine().catch(() => {}); }, []);

  // ── File handling ──────────────────────────────────────────────────────────────
  const handleFiles = useCallback(async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const parsed  = await Promise.all(Array.from(files).map(parseFile));
      const merged  = [...tablesRef.current];
      for (const t of parsed) {
        const idx = merged.findIndex(x => x.name === t.name);
        if (idx >= 0) merged[idx] = t; else merged.push(t);
      }
      setTables(merged);
      setActiveTable(merged[0].name);
      dbRef.current = null; // will be rebuilt on first run
      const first = parsed[0];
      setQuery(`SELECT *\nFROM "${first.name}"\nLIMIT 10;`);
      toast.success(`Loaded ${parsed.map(t => t.name).join(', ')} — ready to query!`);
    } catch (e) {
      toast.error(e.message || 'Could not parse file');
    } finally {
      setUploading(false);
    }
  }, []);

  // ── Run SQL ────────────────────────────────────────────────────────────────────
  const runQuery = useCallback(async (sqlOverride) => {
    const sql = sqlOverride ?? queryRef.current;
    if (!sql?.trim()) return;
    if (!tablesRef.current.length) { toast.error('Upload a file first'); return; }
    setLoading(true); setError(''); setResults(null); setPage(1);
    const t0 = performance.now();
    try {
      if (!dbRef.current) dbRef.current = await buildDb(tablesRef.current);
      const res     = dbRef.current.exec(sql);
      const elapsed = (performance.now() - t0).toFixed(1);
      setExecTime(elapsed);
      if (!res?.length) {
        setResults({ columns: [], values: [], rowCount: 0 });
        toast.success('Query ran — no rows returned');
      } else {
        const { columns, values } = res[0];
        const ct = detectChartType({ columns, values, rowCount: values.length });
        setResults({ columns, values, rowCount: values.length });
        setShowChart(!!ct);
        setChartType(ct || 'bar');
      }
      setHistory(h => [{ sql, time: elapsed, ts: Date.now() }, ...h].slice(0, 30));
    } catch (e) {
      // Give the user an actionable error message
      let msg = e.message || 'Unknown error';
      if (msg.includes('no such table')) {
        const available = tablesRef.current.map(t => t.name).join(', ');
        msg = `${msg}. Available tables: ${available}`;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { runQueryRef.current = runQuery; }, [runQuery]);

  // ── Remove table ──────────────────────────────────────────────────────────────
  const removeTable = useCallback((name) => {
    const updated = tablesRef.current.filter(t => t.name !== name);
    setTables(updated);
    dbRef.current = null;
    if (activeTable === name) {
      setActiveTable(updated[0]?.name || '');
      setQuery(updated[0] ? `SELECT *\nFROM "${updated[0].name}"\nLIMIT 10;` : '');
    }
    if (!updated.length) setResults(null);
  }, [activeTable]);

  // ── Copy ──────────────────────────────────────────────────────────────────────
  const copyQuery = useCallback(() => {
    navigator.clipboard.writeText(queryRef.current);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

  // ── Starter click ─────────────────────────────────────────────────────────────
  const runStarter = useCallback((sql) => {
    setQuery(sql);
    setTimeout(() => runQueryRef.current?.(sql), 30);
  }, []);

  // ── ChatGPT ───────────────────────────────────────────────────────────────────
  const openChatGPT = useCallback(() => {
    const table = activeInfo || tablesRef.current[0];
    if (!table) { toast.error('Upload a file first'); return; }
    const types  = getColumnTypes(table);
    const numC   = table.columns.filter(c => ['numeric','currency','percentage'].includes(types[c]));
    const catC   = table.columns.filter(c => types[c] === 'categorical');
    const dateC  = table.columns.filter(c => types[c] === 'date');
    const prompt =
`I have a SQLite table called "${table.name}" with ${table.rows.length.toLocaleString()} rows.

All columns: ${table.columns.join(', ')}
${numC.length  ? `Numeric columns: ${numC.join(', ')}` : ''}
${catC.length  ? `Category columns: ${catC.join(', ')}` : ''}
${dateC.length ? `Date columns: ${dateC.join(', ')}` : ''}

I want to practise SQL using this real dataset. Please give me a list of SQL queries from beginner to advanced level, covering:
1. Basic SELECT, WHERE, ORDER BY, LIMIT
2. Aggregations: COUNT, SUM, AVG, MIN, MAX
3. GROUP BY and HAVING
4. Subqueries
5. CTEs (WITH clause)
6. Window functions: ROW_NUMBER, RANK, LEAD, LAG
7. Complex analytical queries

For each query, write the exact SQL using the real column and table names above, and add a short one-line comment explaining what the query does.`;
    window.open(`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`, '_blank', 'noopener,noreferrer');
  }, [activeInfo]);

  // ── CodeMirror setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!editorContainerRef.current || editorViewRef.current) return;

    const customCompletion = ctx => {
      const word = ctx.matchBefore(/[\w.]*/);
      if (!word || (word.from === word.to && !ctx.explicit)) return null;
      const before  = ctx.state.doc.sliceString(0, word.from).toUpperCase().trimEnd();
      const lastKw  = before.match(/\b(SELECT|FROM|JOIN|WHERE|AND|OR|GROUP\s+BY|ORDER\s+BY|HAVING|ON|SET)\s*[\w\s,"`.]*?$/)?.[1]?.replace(/\s+/g, ' ');
      const fromCtx = lastKw === 'FROM' || lastKw === 'JOIN';
      const selCtx  = ['SELECT','WHERE','AND','OR','GROUP BY','ORDER BY','HAVING','ON','SET'].includes(lastKw);
      const opts    = [];
      if (fromCtx) {
        for (const t of tablesRef.current) opts.push({ label: t.name, type: 'class', detail: `${t.rows?.length ?? ''} rows`, boost: 20 });
      } else if (selCtx) {
        for (const t of tablesRef.current)
          for (const c of t.columns) opts.push({ label: c, type: 'property', detail: t.name, boost: 15 });
      }
      for (const kw of SQL_KW) opts.push({ label: kw, type: 'keyword', boost: 1 });
      for (const t of tablesRef.current) {
        if (!fromCtx) opts.push({ label: t.name, type: 'class', detail: 'table', boost: 5 });
        if (!selCtx) for (const c of t.columns) opts.push({ label: c, type: 'property', detail: t.name, boost: 3 });
      }
      return { from: word.from, options: opts, validFor: /^\w*$/ };
    };

    const view = new EditorView({
      state: EditorState.create({
        doc: queryRef.current,
        extensions: [
          sqlLang(), oneDark, lineNumbers(), highlightActiveLine(),
          ...buildGhostExt(tablesRef),
          autocompletion({ override: [customCompletion], activateOnTyping: true, maxRenderedOptions: 14 }),
          keymap.of([
            ...defaultKeymap, ...completionKeymap,
            { key: 'Ctrl-Enter', run: () => { runQueryRef.current?.(); return true; } },
            { key: 'Mod-Enter',  run: () => { runQueryRef.current?.(); return true; } },
          ]),
          EditorView.updateListener.of(u => { if (u.docChanged) setQuery(u.state.doc.toString()); }),
          EditorView.theme({
            '&':                            { background: 'rgba(8,8,18,0.97)', minHeight: '200px' },
            '.cm-scroller':                 { fontFamily: "'Fira Code','JetBrains Mono',monospace", overflow: 'auto' },
            '.cm-content':                  { padding: '1rem 0', minHeight: '200px' },
            '.cm-focused':                  { outline: 'none !important' },
            '.cm-line':                     { padding: '0 1rem', lineHeight: '1.85' },
            '.cm-gutters':                  { background: 'rgba(0,0,0,0.45)', borderRight: '1px solid rgba(255,255,255,0.06)', color: '#475569', paddingRight: '6px' },
            '.cm-activeLineGutter':         { background: 'rgba(99,102,241,0.12)' },
            '.cm-tooltip-autocomplete':     { background: '#0d0d1a !important', border: '1px solid rgba(99,102,241,0.35) !important', borderRadius: '10px !important', boxShadow: '0 8px 32px rgba(0,0,0,0.7) !important' },
            '.cm-tooltip-autocomplete ul li':                { padding: '4px 10px !important', fontSize: '0.8rem !important' },
            '.cm-tooltip-autocomplete ul li[aria-selected]': { background: 'rgba(99,102,241,0.28) !important', color: '#a5b4fc !important' },
          }),
        ],
      }),
      parent: editorContainerRef.current,
    });
    editorViewRef.current = view;
    return () => { view.destroy(); editorViewRef.current = null; };
  // Re-run when first table appears so editorContainerRef is guaranteed in DOM
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!tables.length]);

  // Sync external query state → editor (when starter is clicked)
  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;
    if (view.state.doc.toString() !== query)
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: query } });
  }, [query]);

  // ─── Empty / upload state ──────────────────────────────────────────────────────
  if (!tables.length) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
        <ToolHeader
          title="SQL Practice"
          description="Upload any CSV or Excel file and start querying instantly — 100% in your browser, nothing uploaded to a server."
          icon={Database}
          toolId="sql-practice"
        />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          style={{ maxWidth: 540, margin: '2.5rem auto' }}>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? '#6366f1' : 'rgba(99,102,241,0.4)'}`,
              borderRadius: 20, padding: '3.5rem 2rem', textAlign: 'center', cursor: 'pointer',
              background: isDragging ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.2s',
            }}>
            <motion.div animate={{ y: isDragging ? -6 : 0 }} transition={{ type: 'spring', stiffness: 260 }}>
              <div style={{ width: 68, height: 68, borderRadius: 18, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', boxShadow: '0 8px 32px rgba(99,102,241,0.4)' }}>
                <Upload size={30} color="#fff" />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                {uploading ? 'Analyzing your data…' : 'Drop your CSV or Excel file here'}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
                Or click to browse · your data never leaves this browser
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                {['.csv', '.xlsx', '.xls'].map(ext => (
                  <span key={ext} style={{ padding: '0.28rem 0.7rem', borderRadius: 20, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.28)', fontSize: '0.76rem', color: '#a5b4fc' }}>{ext}</span>
                ))}
              </div>
            </motion.div>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" multiple hidden onChange={e => handleFiles(e.target.files)} />

          {/* Feature hints */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem', marginTop: '1.25rem' }}>
            {[
              { icon: Zap,       title: 'Instant queries', desc: 'Run SQL right in your browser — no server' },
              { icon: BarChart2, title: 'Auto charts',     desc: 'Results visualised automatically' },
              { icon: ExternalLink, title: 'AI help',      desc: 'Ask ChatGPT for practice queries' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} style={{ padding: '0.9rem 0.75rem', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
                <Icon size={18} style={{ color: '#6366f1', marginBottom: '0.4rem' }} />
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{title}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{desc}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <RelatedTools currentToolId="sql-practice" category="utilities" />
      </div>
    );
  }

  // ─── Main IDE layout ───────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', padding: '1.25rem 1rem' }}>
      <style>{CSS}</style>

      {/* Top toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <button className="sp-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Upload size={13} />{uploading ? 'Loading…' : 'Add File'}
        </button>
        <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" multiple hidden onChange={e => handleFiles(e.target.files)} />

        <button className="sp-btn" onClick={copyQuery}>
          {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy SQL</>}
        </button>

        {results && (
          <button className="sp-btn" onClick={() => exportCSV(results)}>
            <Download size={13} /> Export CSV
          </button>
        )}

        {/* ChatGPT — right-aligned */}
        <button
          onClick={openChatGPT}
          style={{
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.38rem 0.9rem',
            background: 'linear-gradient(135deg,rgba(16,163,127,0.15),rgba(16,163,127,0.07))',
            border: '1px solid rgba(16,163,127,0.4)',
            borderRadius: 8, cursor: 'pointer',
            fontSize: '0.78rem', fontWeight: 600, color: '#34d399',
            transition: 'all 0.14s',
          }}
          onMouseOver={e => { e.currentTarget.style.background='rgba(16,163,127,0.22)'; e.currentTarget.style.borderColor='rgba(16,163,127,0.65)'; }}
          onMouseOut={e => { e.currentTarget.style.background='linear-gradient(135deg,rgba(16,163,127,0.15),rgba(16,163,127,0.07))'; e.currentTarget.style.borderColor='rgba(16,163,127,0.4)'; }}
          title="Opens ChatGPT with a prompt tailored to your table columns — get queries from beginner to advanced"
        >
          <ExternalLink size={13} /> Ask ChatGPT for practice queries
        </button>
      </div>

      <div className="sp-wrap">
        {/* ── LEFT SIDEBAR ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {/* Tab toggle */}
          <div style={{ display: 'flex', gap: '0.2rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 9, padding: '0.17rem' }}>
            {[['tables','Tables',<Table size={11}/>],['history','History',<History size={11}/>]].map(([k,label,icon]) => (
              <button key={k} className="sp-htab"
                style={{ background: sideTab===k ? 'rgba(99,102,241,0.2)' : 'none', color: sideTab===k ? '#a5b4fc' : 'var(--text-secondary)' }}
                onClick={() => setSideTab(k)}>
                {icon}{label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {sideTab === 'tables' ? (
              <motion.div key="t" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {/* Table list */}
                <div className="sp-panel">
                  <div className="sp-hdr"><Database size={10}/> Tables ({tables.length})</div>
                  {tables.map(t => (
                    <div key={t.name} className={`sp-tbl-row${activeTable===t.name?' active':''}`} onClick={() => setActiveTable(t.name)}>
                      <span style={{ display:'flex', alignItems:'center', gap:'0.38rem', overflow:'hidden', minWidth:0 }}>
                        <Table size={11} style={{ flexShrink:0 }}/>
                        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</span>
                        <span style={{ fontSize:'0.65rem', color:'var(--text-secondary)', flexShrink:0 }}>({t.rows.length.toLocaleString()})</span>
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); removeTable(t.name); }}
                        style={{ background:'none', border:'none', color:'#475569', cursor:'pointer', padding:2, flexShrink:0, lineHeight:0 }}
                        title="Remove table">
                        <Trash2 size={11}/>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Schema */}
                {activeInfo && (
                  <div className="sp-panel">
                    <div className="sp-hdr">Schema — {activeInfo.name}</div>
                    <div style={{ maxHeight:260, overflowY:'auto' }}>
                      {activeInfo.columns.map(col => {
                        const type = colTypes[col] || 'categorical';
                        return (
                          <div key={col} className="sp-col-row">
                            <span style={{ color: TYPE_COLOR[type], fontWeight:700, fontSize:'0.68rem', flexShrink:0, minWidth:14 }}>
                              {TYPE_LABEL[type]}
                            </span>
                            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{col}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tips */}
                <div style={{ padding:'0.55rem 0.7rem', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:9, fontSize:'0.7rem', color:'var(--text-secondary)', lineHeight:1.8 }}>
                  <strong style={{ color:'var(--text-primary)', display:'block', marginBottom:'0.1rem' }}>Keyboard shortcuts</strong>
                  <span style={{ color:'#a5b4fc' }}>Ctrl+Enter</span> — Run query<br/>
                  <span style={{ color:'#a5b4fc' }}>Tab</span> — Accept suggestion<br/>
                  <span style={{ color:'#a5b4fc' }}>Ctrl+Space</span> — Open suggestions
                </div>
              </motion.div>
            ) : (
              <motion.div key="h" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
                <div className="sp-panel">
                  <div className="sp-hdr"><History size={10}/> Query history</div>
                  {history.length === 0 ? (
                    <p style={{ padding:'1.2rem', fontSize:'0.78rem', color:'var(--text-secondary)', textAlign:'center' }}>
                      No queries yet — run one!
                    </p>
                  ) : history.map((h, i) => (
                    <div key={i} className="sp-hist-row"
                      onClick={() => setQuery(h.sql)}
                      title={`Click to restore:\n${h.sql}`}>
                      <span style={{ color:'#6366f1', fontSize:'0.63rem', flexShrink:0 }}>{h.time}ms</span>
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{h.sql.split('\n')[0]}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── CENTER ────────────────────────────────────────────────────────────── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'0.7rem', minWidth:0 }}>

          {/* Editor */}
          <div className="sp-panel">
            <div className="sp-hdr" style={{ justifyContent:'space-between' }}>
              SQL Editor
              <span style={{ fontSize:'0.62rem', color:'#475569', fontWeight:400, textTransform:'none', letterSpacing:0 }}>
                Ctrl+Enter to run
              </span>
            </div>
            <div ref={editorContainerRef} style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', minHeight:200 }}/>
            {/* Run bar */}
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.5rem 0.85rem', background:'rgba(0,0,0,0.18)' }}>
              <button
                onClick={() => runQuery()}
                disabled={loading}
                style={{
                  display:'flex', alignItems:'center', gap:'0.42rem',
                  padding:'0.44rem 1.15rem',
                  background: loading ? 'rgba(99,102,241,0.35)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  border:'none', borderRadius:8, cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize:'0.86rem', fontWeight:700, color:'#fff',
                  boxShadow: loading ? 'none' : '0 2px 14px rgba(99,102,241,0.45)',
                  transition:'all 0.14s',
                }}>
                {loading
                  ? <><RefreshCw size={13} style={{ animation:'spin 0.9s linear infinite' }}/> Running…</>
                  : <><Play size={13}/> Run</>}
              </button>
              <button
                className="sp-btn"
                onClick={() => setQuery(formatSQL(queryRef.current))}
                title="Auto-format SQL (puts each clause on its own line)"
              >
                <Zap size={13}/> Format
              </button>
              {execTime && !error && (
                <span style={{ fontSize:'0.73rem', color:'var(--text-secondary)', display:'flex', alignItems:'center', gap:'0.28rem' }}>
                  <Clock size={11}/>{execTime}ms
                </span>
              )}
              {results && (
                <span style={{ fontSize:'0.73rem', color:'var(--text-secondary)', marginLeft:'auto' }}>
                  {results.rowCount.toLocaleString()} row{results.rowCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Starter query pills */}
          {starters.length > 0 && (
            <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', alignItems:'center' }}>
              <span style={{ fontSize:'0.68rem', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:700, marginRight:'0.1rem' }}>
                Quick:
              </span>
              {starters.map(s => (
                <button key={s.label} className="sp-starter" onClick={() => runStarter(s.sql)}>
                  <s.icon size={11}/>{s.label}
                </button>
              ))}
            </div>
          )}

          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                style={{ display:'flex', alignItems:'flex-start', gap:'0.6rem', padding:'0.7rem 1rem', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.22)', borderRadius:10, color:'#f87171', fontSize:'0.82rem' }}>
                <AlertCircle size={15} style={{ flexShrink:0, marginTop:1 }}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, marginBottom:'0.1rem' }}>Query error</div>
                  <div style={{ fontFamily:'monospace', opacity:0.9 }}>{error}</div>
                </div>
                <button onClick={() => setError('')} style={{ background:'none', border:'none', color:'#f87171', cursor:'pointer', lineHeight:0, padding:2 }}><X size={13}/></button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results panel */}
          <AnimatePresence>
            {results && (
              <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} className="sp-panel">
                <div className="sp-hdr" style={{ justifyContent:'space-between' }}>
                  Results — {results.rowCount.toLocaleString()} row{results.rowCount !== 1 ? 's' : ''}
                  <div style={{ display:'flex', gap:'0.35rem' }}>
                    {results.rowCount > 0 && (
                      <button className="sp-btn" style={{ padding:'0.18rem 0.5rem', fontSize:'0.67rem' }} onClick={() => exportCSV(results)}>
                        <Download size={10}/> CSV
                      </button>
                    )}
                    {autoChart && (
                      <button className="sp-btn" style={{ padding:'0.18rem 0.5rem', fontSize:'0.67rem', color: showChart ? '#a5b4fc' : 'var(--text-secondary)' }} onClick={() => setShowChart(v => !v)}>
                        <BarChart2 size={10}/>{showChart ? 'Hide chart' : 'Show chart'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Chart */}
                <AnimatePresence>
                  {showChart && cData.length > 0 && results.columns.length >= 2 && (
                    <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:255 }} exit={{ opacity:0, height:0 }}
                      style={{ padding:'0.75rem 1rem', borderBottom:'1px solid rgba(255,255,255,0.06)', overflow:'hidden' }}>
                      <div style={{ display:'flex', gap:'0.35rem', marginBottom:'0.5rem' }}>
                        {(['bar','line','pie']).filter(t => t === autoChart || t === 'bar').map(t => (
                          <button key={t} onClick={() => setChartType(t)}
                            style={{ padding:'0.18rem 0.55rem', borderRadius:5, fontSize:'0.7rem', fontWeight:600, border:'1px solid', cursor:'pointer', background: chartType===t ? 'rgba(99,102,241,0.22)' : 'none', borderColor: chartType===t ? 'rgba(99,102,241,0.55)' : 'rgba(255,255,255,0.1)', color: chartType===t ? '#a5b4fc' : 'var(--text-secondary)', transition:'all 0.13s' }}>
                            {t.charAt(0).toUpperCase()+t.slice(1)}
                          </button>
                        ))}
                      </div>
                      <ResponsiveContainer width="100%" height={188}>
                        {chartType === 'pie' ? (
                          <PieChart>
                            <Pie data={cData} dataKey={results.columns[1]} nameKey={results.columns[0]} cx="50%" cy="50%" outerRadius={72}
                              label={({ name, percent }) => `${String(name).slice(0,14)} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                              {cData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]}/>)}
                            </Pie>
                            <Tooltip contentStyle={{ background:'#12121e', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:'0.76rem' }}/>
                          </PieChart>
                        ) : chartType === 'line' ? (
                          <LineChart data={cData} margin={{ top:5, right:16, left:0, bottom:28 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                            <XAxis dataKey={results.columns[0]} tick={{ fill:'#64748b', fontSize:11 }} angle={-30} textAnchor="end" interval="preserveStartEnd"/>
                            <YAxis tick={{ fill:'#64748b', fontSize:11 }} tickFormatter={fmtNum}/>
                            <Tooltip contentStyle={{ background:'#12121e', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:'0.76rem' }} formatter={v=>[fmtNum(+v), results.columns[1]]}/>
                            <Line type="monotone" dataKey={results.columns[1]} stroke="#6366f1" strokeWidth={2} dot={cData.length < 30}/>
                          </LineChart>
                        ) : (
                          <BarChart data={cData} margin={{ top:5, right:16, left:0, bottom:28 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                            <XAxis dataKey={results.columns[0]} tick={{ fill:'#64748b', fontSize:11 }} angle={-30} textAnchor="end" interval={0}/>
                            <YAxis tick={{ fill:'#64748b', fontSize:11 }} tickFormatter={fmtNum}/>
                            <Tooltip contentStyle={{ background:'#12121e', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:'0.76rem' }} formatter={v=>[fmtNum(+v), results.columns[1]]}/>
                            <Bar dataKey={results.columns[1]} radius={[4,4,0,0]}>
                              {cData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]}/>)}
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Table */}
                {results.columns.length === 0 ? (
                  <p style={{ padding:'1rem 1.25rem', color:'var(--text-secondary)', fontSize:'0.84rem' }}>
                    Query ran successfully — no rows returned.
                  </p>
                ) : (
                  <>
                    <div className="sp-rw">
                      <table className="sp-rt">
                        <thead>
                          <tr>
                            <th className="sp-rn">#</th>
                            {results.columns.map(c => <th key={c}>{c}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {pagedValues.map((row, i) => (
                            <tr key={i}>
                              <td className="sp-rn">{(page - 1) * PAGE_SIZE + i + 1}</td>
                              {row.map((cell, j) => <td key={j} title={String(cell??'')}>{String(cell??'')}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalPages > 1 && (
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.6rem', padding:'0.5rem', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                        <button className="sp-btn" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} style={{ padding:'0.22rem 0.45rem' }}><ChevronLeft size={13}/></button>
                        <span style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>Page {page} / {totalPages}</span>
                        <button className="sp-btn" onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages} style={{ padding:'0.22rem 0.45rem' }}><ChevronRight size={13}/></button>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div style={{ marginTop:'2rem' }}>
        <RelatedTools currentToolId="sql-practice" category="utilities"/>
      </div>
    </div>
  );
}

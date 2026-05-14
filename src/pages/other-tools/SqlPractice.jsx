import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Play, Upload, Trash2, Table, AlertCircle, Clock,
  BarChart2, TrendingUp, Download, Sparkles, Hash, Calendar,
  MapPin, DollarSign, Percent, Tag, Info, Eye, History,
  ChevronLeft, ChevronRight, X, Search, Copy, Check, Code,
  Zap, Filter, Layers, FileText, RefreshCw, MessageSquare,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, ViewPlugin, WidgetType, Decoration } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { sql as sqlLang } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import ToolHeader from '../../components/shared/ToolHeader';
import RelatedTools from '../../components/shared/RelatedTools';

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 50;
const CHART_COLORS = ['#6366f1','#8b5cf6','#d946ef','#3b82f6','#10b981','#f59e0b','#ef4444','#06b6d4','#84cc16','#f97316'];
const SQL_KW = [
  'SELECT','FROM','WHERE','AND','OR','NOT','IN','IS','NULL','LIKE','ORDER','BY','GROUP',
  'HAVING','LIMIT','OFFSET','DISTINCT','AS','JOIN','LEFT','RIGHT','INNER','OUTER','FULL',
  'CROSS','ON','INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE','DROP',
  'ALTER','ADD','COLUMN','PRIMARY','KEY','COUNT','SUM','AVG','MIN','MAX','COALESCE',
  'IFNULL','CASE','WHEN','THEN','ELSE','END','BETWEEN','EXISTS','UNION','ALL','ASC',
  'DESC','ROUND','STRFTIME','LENGTH','UPPER','LOWER','TRIM','SUBSTR','REPLACE','CAST',
];

// ─── Utilities ────────────────────────────────────────────────────────────────
function toTableName(filename) {
  return filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^(\d)/, '_$1').toLowerCase().slice(0, 60) || 'data';
}

function detectColumnType(colName, values) {
  const lower = colName.toLowerCase();
  const sample = values.filter(v => v !== null && v !== undefined && v !== '').slice(0, 100);
  if (!sample.length) return 'categorical';

  if (/\b(uuid|guid)\b/.test(lower)) return 'id';
  if (/(?:^|_)(id)$/.test(lower) && new Set(sample.slice(0,20).map(String)).size === Math.min(sample.slice(0,20).length, 20)) return 'id';
  if (/date|time|year|month|day|created|updated|timestamp|period/.test(lower)) return 'date';
  if (/price|cost|revenue|salary|income|pay|wage|amount|fee|charge|sales|profit|budget/.test(lower)) return 'currency';
  if (/rate|percent|ratio|pct|score/.test(lower)) return 'percentage';
  if (/city|state|country|region|address|zip|postal|location|area|district/.test(lower)) return 'location';

  const strs = sample.map(v => String(v).trim());
  const numericCount = strs.filter(v => !isNaN(parseFloat(v.replace(/[$,€£%\s]/g, '')))).length;
  if (numericCount / strs.length > 0.8) return 'numeric';

  const datePattern = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}|^\d{1,2}[-/]\d{1,2}[-/]\d{4}|^\d{4}$/;
  if (strs.filter(v => datePattern.test(v)).length / strs.length > 0.6) return 'date';

  return 'categorical';
}

function analyzeDataset(table) {
  const { columns, rows } = table;
  const numericColumns = [], categoricalColumns = [], dateColumns = [];
  const columnStats = {};

  for (const col of columns) {
    const values = rows.map(r => r[col]);
    const type = detectColumnType(col, values);
    const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
    const nullCount = values.length - nonNull.length;
    const unique = new Set(nonNull.map(String)).size;
    columnStats[col] = { type, nullCount, nullPct: Math.round(nullCount / Math.max(values.length, 1) * 100), unique };

    if (['numeric','currency','percentage'].includes(type)) {
      numericColumns.push(col);
      const nums = nonNull.map(v => parseFloat(String(v).replace(/[$,€£%\s]/g, ''))).filter(n => !isNaN(n));
      if (nums.length) {
        columnStats[col].min = Math.min(...nums);
        columnStats[col].max = Math.max(...nums);
        columnStats[col].avg = nums.reduce((a, b) => a + b, 0) / nums.length;
        columnStats[col].sum = nums.reduce((a, b) => a + b, 0);
      }
    } else if (type === 'date') {
      dateColumns.push(col);
    } else if (type !== 'id') {
      categoricalColumns.push(col);
      const freq = {};
      nonNull.slice(0, 1000).forEach(v => { const k = String(v); freq[k] = (freq[k] || 0) + 1; });
      columnStats[col].topCategories = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5);
    }
  }

  const totalCells = rows.length * columns.length;
  const totalNull = Object.values(columnStats).reduce((s, c) => s + c.nullCount, 0);
  return { rowCount: rows.length, columnCount: columns.length, numericColumns, categoricalColumns, dateColumns, columnStats, completeness: totalCells ? Math.round((1 - totalNull / totalCells) * 100) : 100 };
}

function generateSuggestions(table) {
  if (!table?.insights) return [];
  const { name, insights, columns } = table;
  const { numericColumns: nc = [], categoricalColumns: cc = [], dateColumns: dc = [] } = insights;
  const tn = `"${name}"`;
  const suggs = [];

  suggs.push({ id: 'preview', title: 'Preview data', desc: 'First 10 rows', sql: `SELECT * FROM ${tn} LIMIT 10;`, Icon: Eye, color: '#6366f1', cat: 'Explore' });
  suggs.push({ id: 'count', title: 'Row count', desc: 'Total records', sql: `SELECT COUNT(*) as total_rows FROM ${tn};`, Icon: Hash, color: '#8b5cf6', cat: 'Explore' });

  const nullExpr = columns.slice(0, 5).map(c => `SUM(CASE WHEN "${c}" IS NULL OR "${c}" = '' THEN 1 ELSE 0 END) as ${c.slice(0,18)}_nulls`).join(',\n  ');
  suggs.push({ id: 'nulls', title: 'Missing values', desc: 'Null count per column', sql: `SELECT\n  ${nullExpr}\nFROM ${tn};`, Icon: Search, color: '#f59e0b', cat: 'Quality' });

  if (nc.length > 0) {
    const col = nc[0];
    suggs.push({ id: `stats-${col}`, title: `${col} stats`, desc: 'Min, max, avg, sum', sql: `SELECT\n  ROUND(MIN("${col}"), 2) as min_val,\n  ROUND(MAX("${col}"), 2) as max_val,\n  ROUND(AVG("${col}"), 2) as avg_val,\n  ROUND(SUM("${col}"), 2) as total\nFROM ${tn};`, Icon: TrendingUp, color: '#10b981', cat: 'Analytics' });
    if (cc.length > 0) {
      suggs.push({ id: `top-by-${col}`, title: `Top ${cc[0]} by ${col}`, desc: 'Ranked breakdown', sql: `SELECT "${cc[0]}",\n  ROUND(SUM("${col}"), 2) as total_${col.slice(0,12)},\n  COUNT(*) as records\nFROM ${tn}\nGROUP BY "${cc[0]}"\nORDER BY total_${col.slice(0,12)} DESC\nLIMIT 10;`, Icon: BarChart2, color: '#3b82f6', cat: 'Analytics' });
    }
  }

  if (cc.length > 0) {
    suggs.push({ id: `dist-${cc[0]}`, title: `${cc[0]} breakdown`, desc: 'Distribution by category', sql: `SELECT "${cc[0]}",\n  COUNT(*) as count,\n  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM ${tn}), 1) as pct\nFROM ${tn}\nGROUP BY "${cc[0]}"\nORDER BY count DESC\nLIMIT 15;`, Icon: Filter, color: '#ec4899', cat: 'Analytics' });
    suggs.push({ id: `dup-${cc[0]}`, title: 'Duplicate check', desc: `Repeated ${cc[0]} values`, sql: `SELECT "${cc[0]}",\n  COUNT(*) as occurrences\nFROM ${tn}\nGROUP BY "${cc[0]}"\nHAVING occurrences > 1\nORDER BY occurrences DESC;`, Icon: Layers, color: '#ef4444', cat: 'Quality' });
  }

  if (dc.length > 0 && nc.length > 0) {
    suggs.push({ id: 'monthly', title: 'Monthly trend', desc: `${nc[0]} over time`, sql: `SELECT strftime('%Y-%m', "${dc[0]}") as month,\n  ROUND(SUM("${nc[0]}"), 2) as total,\n  COUNT(*) as records\nFROM ${tn}\nGROUP BY month\nORDER BY month ASC;`, Icon: TrendingUp, color: '#06b6d4', cat: 'Trends' });
  }

  if (nc.length > 1) {
    suggs.push({ id: 'compare', title: 'Compare metrics', desc: `${nc[0]} vs ${nc[1]}`, sql: `SELECT\n  ROUND(AVG("${nc[0]}"), 2) as avg_${nc[0].slice(0,12)},\n  ROUND(AVG("${nc[1]}"), 2) as avg_${nc[1].slice(0,12)}\nFROM ${tn};`, Icon: Zap, color: '#f59e0b', cat: 'Analytics' });
  }

  return suggs;
}

function parseNaturalLanguage(text, table) {
  if (!table) return 'SELECT * FROM data LIMIT 10;';
  const lower = text.toLowerCase().trim();
  const { name, insights = {}, columns } = table;
  const tn = `"${name}"`;
  const nc = insights.numericColumns || [];
  const cc = insights.categoricalColumns || [];
  const dc = insights.dateColumns || [];

  const findCol = (pool) => {
    for (const c of pool) {
      if (lower.includes(c.toLowerCase().replace(/_/g, ' ')) || lower.includes(c.toLowerCase())) return c;
    }
    return pool[0];
  };

  const numCol = findCol(nc);
  const catCol = findCol(cc);
  const dateCol = findCol(dc);
  const topM = lower.match(/top\s+(\d+)|first\s+(\d+)/);
  const limit = topM ? (topM[1] || topM[2] || '10') : '10';

  if (/null|missing|empty|blank/.test(lower)) {
    const checks = columns.slice(0, 5).map(c => `"${c}" IS NULL OR "${c}" = ''`).join(' OR ');
    return `SELECT *\nFROM ${tn}\nWHERE ${checks}\nLIMIT 100;`;
  }
  if (/duplicate|repeated/.test(lower) && catCol) {
    return `SELECT "${catCol}", COUNT(*) as count\nFROM ${tn}\nGROUP BY "${catCol}"\nHAVING count > 1\nORDER BY count DESC;`;
  }
  if (/month|week|year|trend|over time/.test(lower) && dateCol) {
    const period = /week/.test(lower) ? `strftime('%Y-%W', "${dateCol}")` : /year/.test(lower) ? `strftime('%Y', "${dateCol}")` : `strftime('%Y-%m', "${dateCol}")`;
    const agg = numCol ? `ROUND(SUM("${numCol}"), 2) as total` : `COUNT(*) as count`;
    return `SELECT ${period} as period, ${agg}\nFROM ${tn}\nGROUP BY period\nORDER BY period ASC;`;
  }
  if (/average|avg|mean/.test(lower) && numCol) {
    if (catCol) return `SELECT "${catCol}",\n  ROUND(AVG("${numCol}"), 2) as avg_value\nFROM ${tn}\nGROUP BY "${catCol}"\nORDER BY avg_value DESC\nLIMIT ${limit};`;
    return `SELECT ROUND(AVG("${numCol}"), 2) as average FROM ${tn};`;
  }
  if (/total|sum/.test(lower) && numCol) {
    if (catCol) return `SELECT "${catCol}",\n  ROUND(SUM("${numCol}"), 2) as total\nFROM ${tn}\nGROUP BY "${catCol}"\nORDER BY total DESC\nLIMIT ${limit};`;
    return `SELECT ROUND(SUM("${numCol}"), 2) as total FROM ${tn};`;
  }
  if (/count|how many|number of/.test(lower)) {
    if (catCol) return `SELECT "${catCol}", COUNT(*) as count\nFROM ${tn}\nGROUP BY "${catCol}"\nORDER BY count DESC\nLIMIT ${limit};`;
    return `SELECT COUNT(*) as total_rows FROM ${tn};`;
  }
  if (/top|best|highest|most|largest/.test(lower) && numCol) {
    return `SELECT *\nFROM ${tn}\nORDER BY "${numCol}" DESC\nLIMIT ${limit};`;
  }
  if (catCol && numCol) {
    return `SELECT "${catCol}", ROUND(SUM("${numCol}"), 2) as total\nFROM ${tn}\nGROUP BY "${catCol}"\nORDER BY total DESC\nLIMIT ${limit};`;
  }
  return `SELECT * FROM ${tn} LIMIT ${limit};`;
}

function detectChartType(results) {
  if (!results || results.columns.length !== 2 || results.values.length < 2) return null;
  const vals2 = results.values.map(r => parseFloat(r[1]));
  if (vals2.filter(v => !isNaN(v)).length / vals2.length < 0.8) return null;
  const vals1 = results.values.map(r => String(r[0] ?? ''));
  if (vals1.some(v => /^\d{4}-\d{2}/.test(v))) return 'line';
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

async function parseFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (raw.length < 2) throw new Error('File appears empty or has only headers.');
  const columns = raw[0].map((c, i) => (String(c || `col${i}`).replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1') || `col${i}`));
  const rows = raw.slice(1).map(row => { const o = {}; columns.forEach((col, i) => { o[col] = row[i] ?? ''; }); return o; });
  return { name: toTableName(file.name), columns, rows };
}

async function initDb(tables) {
  const SQL = (await import('sql.js')).default;
  const engine = await SQL({ locateFile: () => '/sql-wasm.wasm' });
  const db = new engine.Database();
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

function exportCSV(results) {
  if (!results?.columns?.length) return;
  const csv = [results.columns.join(','), ...results.values.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'results.csv' });
  a.click();
}

const TYPE_ICON = { numeric: Hash, currency: DollarSign, percentage: Percent, date: Calendar, location: MapPin, categorical: Tag, id: Hash, unknown: Info };
const TYPE_COLOR = { numeric: '#10b981', currency: '#f59e0b', percentage: '#8b5cf6', date: '#06b6d4', location: '#ec4899', categorical: '#6366f1', id: '#94a3b8', unknown: '#475569' };

// ─── Ghost Text (inline autocomplete) ─────────────────────────────────────────
class GhostWidget extends WidgetType {
  constructor(text) { super(); this.text = text; }
  eq(other) { return other.text === this.text; }
  toDOM() {
    const span = document.createElement('span');
    span.textContent = this.text;
    span.setAttribute('aria-hidden', 'true');
    span.style.cssText = 'color:rgba(148,163,184,0.38);pointer-events:none;font-style:italic;';
    return span;
  }
  ignoreEvent() { return true; }
}

function buildGhostExtension(tablesRef) {
  const resolveHint = (partial, tables) => {
    const upper = partial.toUpperCase();
    const kwMatch = SQL_KW.find(k => k.startsWith(upper) && k.length > upper.length);
    if (kwMatch) return kwMatch.slice(upper.length);
    const lower = partial.toLowerCase();
    for (const t of tables) {
      if (t.name.toLowerCase().startsWith(lower) && t.name.length > lower.length)
        return t.name.slice(lower.length);
      for (const col of t.columns) {
        if (col.toLowerCase().startsWith(lower) && col.length > lower.length)
          return col.slice(lower.length);
      }
    }
    return null;
  };

  const ghostPlugin = ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = this._compute(view); }
    update(u) { if (u.docChanged || u.selectionSet) this.decorations = this._compute(u.view); }
    _compute(view) {
      const sel = view.state.selection.main;
      if (!sel.empty) return Decoration.none;
      const pos = sel.from;
      const line = view.state.doc.lineAt(pos);
      const before = line.text.slice(0, pos - line.from);
      const m = before.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
      if (!m || m[1].length < 2) return Decoration.none;
      const hint = resolveHint(m[1], tablesRef.current);
      if (!hint) return Decoration.none;
      return Decoration.set([Decoration.widget({ widget: new GhostWidget(hint), side: 1 }).range(pos)]);
    }
  }, { decorations: v => v.decorations });

  const ghostAccept = keymap.of([{
    key: 'Tab',
    run: (view) => {
      const sel = view.state.selection.main;
      if (!sel.empty) return false;
      const pos = sel.from;
      const line = view.state.doc.lineAt(pos);
      const before = line.text.slice(0, pos - line.from);
      const m = before.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
      if (!m || m[1].length < 2) return false;
      const hint = resolveHint(m[1], tablesRef.current);
      if (!hint) return false;
      view.dispatch({ changes: { from: pos, insert: hint }, selection: { anchor: pos + hint.length } });
      return true;
    },
  }]);

  return [ghostPlugin, ghostAccept];
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function SqlPractice() {
  const [tables, setTables] = useState([]);
  const [query, setQuery] = useState('SELECT * FROM data LIMIT 10;');
  const [mode, setMode] = useState('sql');
  const [nlQuery, setNlQuery] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [execTime, setExecTime] = useState(null);
  const [activeTable, setActiveTable] = useState('');
  const [showChart, setShowChart] = useState(false);
  const [chartType, setChartType] = useState('bar');
  const [page, setPage] = useState(1);
  const [queryHistory, setQueryHistory] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sideTab, setSideTab] = useState('tables');

  const dbRef = useRef(null);
  const fileInputRef = useRef(null);
  const editorContainerRef = useRef(null);
  const editorViewRef = useRef(null);
  const tablesRef = useRef(tables);
  const runQueryRef = useRef(null);
  const queryRef = useRef(query);

  useEffect(() => { tablesRef.current = tables; }, [tables]);
  useEffect(() => { queryRef.current = query; }, [query]);

  const activeTableInfo = useMemo(() => tables.find(t => t.name === activeTable), [tables, activeTable]);
  const suggestions = useMemo(() => generateSuggestions(activeTableInfo), [activeTableInfo]);
  const autoChartType = useMemo(() => detectChartType(results), [results]);
  const cData = useMemo(() => chartData(results), [results]);
  const pagedValues = useMemo(() => results ? results.values.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : [], [results, page]);
  const totalPages = useMemo(() => results ? Math.ceil(results.rowCount / PAGE_SIZE) : 1, [results]);

  // ── File handling ──
  const handleFiles = useCallback(async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const parsed = await Promise.all(Array.from(files).map(parseFile));
      const merged = [...tablesRef.current];
      for (const t of parsed) {
        t.insights = analyzeDataset(t);
        const idx = merged.findIndex(x => x.name === t.name);
        if (idx >= 0) merged[idx] = t; else merged.push(t);
      }
      setTables(merged);
      setActiveTable(merged[0].name);
      dbRef.current = null;
      setQuery(`SELECT * FROM "${parsed[0].name}" LIMIT 10;`);
      toast.success(`Loaded ${parsed.map(t => t.name).join(', ')}`);
    } catch (e) {
      toast.error(e.message || 'Failed to parse file');
    } finally {
      setUploading(false);
    }
  }, []);

  // ── Run SQL query ──
  const runQuery = useCallback(async () => {
    if (!query.trim()) return;
    if (!tablesRef.current.length) { toast.error('Upload a file first'); return; }
    setLoading(true); setError(''); setResults(null); setPage(1);
    const t0 = performance.now();
    try {
      if (!dbRef.current) dbRef.current = await initDb(tablesRef.current);
      const res = dbRef.current.exec(query);
      const elapsed = (performance.now() - t0).toFixed(1);
      setExecTime(elapsed);
      if (!res?.length) {
        setResults({ columns: [], values: [], rowCount: 0 });
        toast.success('Query executed — no rows returned');
      } else {
        const { columns, values } = res[0];
        setResults({ columns, values, rowCount: values.length });
        setShowChart(!!detectChartType({ columns, values, rowCount: values.length }));
        setChartType(detectChartType({ columns, values, rowCount: values.length }) || 'bar');
      }
      setQueryHistory(h => [{ sql: query, time: elapsed, ts: Date.now() }, ...h].slice(0, 20));
    } catch (e) {
      setError(e.message || 'Query error');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { runQueryRef.current = runQuery; }, [runQuery]);

  // ── AI mode run ──
  const runNl = useCallback(() => {
    if (!nlQuery.trim() || !activeTableInfo) return;
    const generated = parseNaturalLanguage(nlQuery, activeTableInfo);
    setQuery(generated);
    setMode('sql');
    setTimeout(() => runQueryRef.current?.(), 50);
  }, [nlQuery, activeTableInfo]);

  // ── Remove table ──
  const removeTable = useCallback((name) => {
    const updated = tablesRef.current.filter(t => t.name !== name);
    setTables(updated);
    dbRef.current = null;
    if (activeTable === name) setActiveTable(updated[0]?.name || '');
    if (!updated.length) { setResults(null); setQuery('SELECT * FROM data LIMIT 10;'); }
  }, [activeTable]);

  // ── Copy query ──
  const copyQuery = useCallback(() => {
    navigator.clipboard.writeText(query);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [query]);

  // ── CodeMirror setup ──
  useEffect(() => {
    if (!editorContainerRef.current) return;
    if (editorViewRef.current) return; // already initialized

    // Context-aware completion: suggest columns after SELECT/WHERE/GROUP BY, tables after FROM/JOIN
    const customCompletion = (ctx) => {
      const word = ctx.matchBefore(/[\w.]*/);
      if (!word || (word.from === word.to && !ctx.explicit)) return null;

      const textBefore = ctx.state.doc.sliceString(0, word.from).toUpperCase().trimEnd();
      const lastKw = textBefore.match(/\b(SELECT|FROM|JOIN|WHERE|AND|OR|GROUP\s+BY|ORDER\s+BY|HAVING|ON|SET)\s*[\w\s,"`.]*?$/)
        ?.[1]?.replace(/\s+/g, ' ');

      const isAfterFrom = lastKw === 'FROM' || lastKw === 'JOIN';
      const isAfterSelect = ['SELECT', 'WHERE', 'AND', 'OR', 'GROUP BY', 'ORDER BY', 'HAVING', 'ON', 'SET'].includes(lastKw);

      const options = [];

      // High-priority context-aware suggestions
      if (isAfterFrom) {
        for (const t of tablesRef.current) {
          options.push({ label: t.name, type: 'class', detail: `${t.rows?.length ?? ''} rows`, boost: 20 });
        }
      } else if (isAfterSelect) {
        for (const t of tablesRef.current) {
          for (const col of t.columns) {
            const st = t.insights?.columnStats?.[col];
            options.push({ label: col, type: 'property', detail: `${t.name} · ${st?.type ?? ''}`, boost: 15 });
          }
        }
      }

      // Always available: keywords
      for (const kw of SQL_KW) options.push({ label: kw, type: 'keyword', boost: 1 });

      // Always available: tables + columns
      for (const t of tablesRef.current) {
        if (!isAfterFrom) options.push({ label: t.name, type: 'class', detail: 'table', boost: 5 });
        if (!isAfterSelect) {
          for (const col of t.columns) {
            options.push({ label: col, type: 'property', detail: t.name, boost: 3 });
          }
        }
      }

      return { from: word.from, options, validFor: /^\w*$/ };
    };

    const ghostExt = buildGhostExtension(tablesRef);

    const view = new EditorView({
      state: EditorState.create({
        doc: queryRef.current,
        extensions: [
          sqlLang(),
          oneDark,
          lineNumbers(),
          highlightActiveLine(),
          // Ghost text (inline) must come before completionKeymap so Tab is handled first
          ...ghostExt,
          autocompletion({ override: [customCompletion], activateOnTyping: true, maxRenderedOptions: 12 }),
          keymap.of([
            ...defaultKeymap,
            ...completionKeymap,
            { key: 'Ctrl-Enter', run: () => { runQueryRef.current?.(); return true; } },
            { key: 'Mod-Enter', run: () => { runQueryRef.current?.(); return true; } },
          ]),
          EditorView.updateListener.of(u => { if (u.docChanged) setQuery(u.state.doc.toString()); }),
          EditorView.theme({
            '&': { background: 'rgba(10,10,20,0.9)', minHeight: '160px' },
            '.cm-scroller': { fontFamily: "'Fira Code','JetBrains Mono','Consolas',monospace", overflow: 'auto' },
            '.cm-content': { padding: '1rem 0', minHeight: '160px' },
            '.cm-focused': { outline: 'none !important' },
            '.cm-line': { padding: '0 1rem', lineHeight: '1.75' },
            '.cm-gutters': { background: 'rgba(0,0,0,0.5)', borderRight: '1px solid rgba(255,255,255,0.06)', color: '#475569', paddingRight: '6px' },
            '.cm-activeLineGutter': { background: 'rgba(99,102,241,0.12)' },
            '.cm-tooltip-autocomplete': { background: '#1a1a2e !important', border: '1px solid rgba(99,102,241,0.3) !important', borderRadius: '8px !important', boxShadow: '0 8px 32px rgba(0,0,0,0.5) !important' },
            '.cm-tooltip-autocomplete ul li': { padding: '4px 10px !important', fontSize: '0.8rem !important' },
            '.cm-tooltip-autocomplete ul li[aria-selected]': { background: 'rgba(99,102,241,0.25) !important', color: '#a5b4fc !important' },
          }),
        ],
      }),
      parent: editorContainerRef.current,
    });

    editorViewRef.current = view;
    return () => { view.destroy(); editorViewRef.current = null; };
  // Re-run when tables first appear so editorContainerRef.current is guaranteed to be in the DOM
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!tables.length]);

  // Sync external query → editor (when suggestion clicked)
  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;
    if (view.state.doc.toString() !== query) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: query } });
    }
  }, [query]);

  // ── Empty state ──
  if (!tables.length) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
        <ToolHeader title="SQL Practice" description="Upload CSV or Excel and query your data instantly — fully in-browser, no server." icon={Database} toolId="sql-practice" />
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ maxWidth: 560, margin: '2.5rem auto' }}>
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? '#6366f1' : 'rgba(99,102,241,0.35)'}`,
              borderRadius: 20,
              padding: '3.5rem 2rem',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragging ? 'rgba(99,102,241,0.07)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.2s ease',
              backdropFilter: 'blur(12px)',
            }}
          >
            <motion.div animate={{ y: isDragging ? -6 : 0 }} transition={{ type: 'spring', stiffness: 300 }}>
              <div style={{ width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', boxShadow: '0 8px 32px rgba(99,102,241,0.4)' }}>
                <Upload size={32} color="#fff" />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                {uploading ? 'Analyzing your data…' : 'Drop your file here'}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                CSV or Excel — your data stays in the browser, 100% private
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                {['Sales data', 'Customer list', 'Inventory', 'Survey results'].map(t => (
                  <span key={t} style={{ padding: '0.3rem 0.75rem', borderRadius: 20, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', fontSize: '0.78rem', color: '#a5b4fc' }}>{t}</span>
                ))}
              </div>
            </motion.div>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" multiple hidden onChange={e => handleFiles(e.target.files)} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: '1.5rem' }}>
            {[
              { Icon: Sparkles, label: 'Smart insights', desc: 'Auto-detect column types & stats' },
              { Icon: MessageSquare, label: 'AI suggestions', desc: 'One-click query cards' },
              { Icon: BarChart2, label: 'Live charts', desc: 'Visualize results instantly' },
            ].map(({ Icon, label, desc }) => (
              <div key={label} style={{ padding: '1rem', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
                <Icon size={20} style={{ color: '#6366f1', marginBottom: '0.5rem' }} />
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{label}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{desc}</div>
              </div>
            ))}
          </div>
        </motion.div>
        <RelatedTools currentToolId="sql-practice" category="utilities" />
      </div>
    );
  }

  // ── Main layout ──
  return (
    <div style={{ maxWidth: 1380, margin: '0 auto', padding: '1.5rem 1rem' }}>
      <style>{`
        .sp-layout { display: grid; grid-template-columns: 230px 1fr 270px; gap: 0.875rem; align-items: flex-start; }
        .sp-panel { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; overflow: hidden; }
        .sp-panel-hdr { padding: 0.55rem 0.9rem; background: rgba(0,0,0,0.25); border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 0.72rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; display: flex; align-items: center; justify-content: space-between; }
        .sp-tbl-item { display: flex; align-items: center; justify-content: space-between; padding: 0.55rem 0.8rem; cursor: pointer; transition: background 0.15s; font-size: 0.82rem; }
        .sp-tbl-item:hover { background: rgba(255,255,255,0.04); }
        .sp-tbl-item.active { background: rgba(99,102,241,0.12); color: #a5b4fc; }
        .sp-col-item { padding: 0.28rem 0.8rem; font-size: 0.75rem; color: var(--text-secondary); border-bottom: 1px solid rgba(255,255,255,0.03); font-family: monospace; display: flex; align-items: center; gap: 0.4rem; }
        .sp-results-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        .sp-results-table th { padding: 0.5rem 0.7rem; background: rgba(99,102,241,0.1); color: #a5b4fc; text-align: left; font-weight: 700; border-bottom: 2px solid rgba(99,102,241,0.2); white-space: nowrap; position: sticky; top: 0; z-index: 1; font-size: 0.75rem; }
        .sp-results-table td { padding: 0.4rem 0.7rem; border-bottom: 1px solid rgba(255,255,255,0.04); color: var(--text-primary); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sp-results-table tr:hover td { background: rgba(255,255,255,0.025); }
        .sp-results-wrap { overflow: auto; max-height: 380px; }
        .sp-card { padding: 0.6rem 0.85rem; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); cursor: pointer; transition: all 0.18s; }
        .sp-card:hover { border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.06); transform: translateY(-1px); }
        .sp-btn-ghost { background: none; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0.35rem 0.7rem; font-size: 0.78rem; color: var(--text-secondary); cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 0.35rem; }
        .sp-btn-ghost:hover { border-color: rgba(99,102,241,0.4); color: #a5b4fc; background: rgba(99,102,241,0.06); }
        .sp-mode-btn { padding: 0.4rem 1rem; border-radius: 8px; font-size: 0.8rem; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; }
        .sp-mode-btn.active { background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff; box-shadow: 0 2px 12px rgba(99,102,241,0.4); }
        .sp-mode-btn.inactive { background: rgba(255,255,255,0.05); color: var(--text-secondary); }
        .sp-mode-btn.inactive:hover { background: rgba(255,255,255,0.08); color: var(--text-primary); }
        .sp-stat-card { padding: 0.75rem; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); }
        .sp-history-item { padding: 0.5rem 0.8rem; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 0.75rem; font-family: monospace; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: background 0.15s; }
        .sp-history-item:hover { background: rgba(255,255,255,0.04); color: var(--text-primary); }
        @media (max-width: 900px) { .sp-layout { grid-template-columns: 1fr; } }
        @media (max-width: 600px) { .sp-layout { gap: 0.5rem; } }
        .cm-editor { border-radius: 0; }
      `}</style>

      <ToolHeader title="SQL Practice" description="AI-powered data exploration — upload, query, and visualize in seconds." icon={Database} toolId="sql-practice" />

      {/* Mode toggle + top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '0.25rem' }}>
          <button className={`sp-mode-btn ${mode === 'sql' ? 'active' : 'inactive'}`} onClick={() => setMode('sql')}><Code size={13} style={{ display: 'inline', marginRight: 5 }} />SQL Mode</button>
          <button className={`sp-mode-btn ${mode === 'ai' ? 'active' : 'inactive'}`} onClick={() => setMode('ai')}><Sparkles size={13} style={{ display: 'inline', marginRight: 5 }} />AI Mode</button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="sp-btn-ghost" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload size={13} />{uploading ? 'Loading…' : 'Add File'}
          </button>
          {results && <button className="sp-btn-ghost" onClick={() => exportCSV(results)}><Download size={13} />Export CSV</button>}
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" multiple hidden onChange={e => handleFiles(e.target.files)} />
        </div>
      </div>

      <div className="sp-layout">
        {/* ── LEFT SIDEBAR ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '0.2rem' }}>
            {[['tables','Tables',Table],['history','History',History]].map(([k, label, Icon]) => (
              <button key={k} onClick={() => setSideTab(k)} style={{ flex: 1, padding: '0.3rem 0', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', border: 'none', cursor: 'pointer', background: sideTab === k ? 'rgba(99,102,241,0.2)' : 'none', color: sideTab === k ? '#a5b4fc' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
                <Icon size={12} />{label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {sideTab === 'tables' && (
              <motion.div key="tables" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div className="sp-panel">
                  <div className="sp-panel-hdr">Tables ({tables.length})</div>
                  {tables.map(t => (
                    <div key={t.name} className={`sp-tbl-item${activeTable === t.name ? ' active' : ''}`} onClick={() => setActiveTable(t.name)}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
                        <Table size={12} style={{ flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', flexShrink: 0 }}>({t.rows.length})</span>
                      </span>
                      <button onClick={e => { e.stopPropagation(); removeTable(t.name); }} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 2, flexShrink: 0 }}><Trash2 size={11} /></button>
                    </div>
                  ))}
                </div>

                {activeTableInfo && (
                  <div className="sp-panel">
                    <div className="sp-panel-hdr">Schema — {activeTableInfo.name}</div>
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                      {activeTableInfo.columns.map(col => {
                        const st = activeTableInfo.insights?.columnStats?.[col];
                        const Ico = TYPE_ICON[st?.type || 'categorical'] || Tag;
                        const clr = TYPE_COLOR[st?.type || 'categorical'];
                        return (
                          <div key={col} className="sp-col-item">
                            <Ico size={10} style={{ color: clr, flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col}</span>
                            {st?.nullPct > 0 && <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: '#f59e0b', flexShrink: 0 }}>{st.nullPct}% null</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="sp-panel" style={{ padding: '0.7rem 0.85rem', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.25rem' }}>Tips</strong>
                  Ctrl+Enter to run · Tab to autocomplete · Ctrl+Space for suggestions
                </div>
              </motion.div>
            )}

            {sideTab === 'history' && (
              <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="sp-panel">
                  <div className="sp-panel-hdr">Recent queries</div>
                  {queryHistory.length === 0 && <p style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>No queries yet</p>}
                  {queryHistory.map((h, i) => (
                    <div key={i} className="sp-history-item" onClick={() => { setQuery(h.sql); setMode('sql'); }} title={h.sql}>
                      <span style={{ color: '#6366f1', fontSize: '0.68rem', marginRight: '0.4rem' }}>{h.time}ms</span>
                      {h.sql.split('\n')[0]}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── CENTER: Editor + Suggestions + Results ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0 }}>

          {/* Query area */}
          <div className="sp-panel">
            <div className="sp-panel-hdr">
              {mode === 'sql' ? 'SQL Editor' : 'AI Query'}
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {mode === 'sql' && (
                  <button className="sp-btn-ghost" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={copyQuery}>
                    {copied ? <><Check size={11} />Copied</> : <><Copy size={11} />Copy</>}
                  </button>
                )}
              </div>
            </div>

            {/* SQL editor — always in DOM so CodeMirror never loses its mount point */}
            <div style={{ display: mode === 'sql' ? 'block' : 'none' }}>
              <div ref={editorContainerRef} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', minHeight: 160, overflow: 'hidden' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0.85rem', background: 'rgba(0,0,0,0.15)' }}>
                <button className="btn-primary" onClick={runQuery} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
                  {loading ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />Running…</> : <><Play size={13} />Run Query</>}
                </button>
                {execTime && !error && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Clock size={11} />{execTime}ms</span>}
                {results && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>{results.rowCount.toLocaleString()} row{results.rowCount !== 1 ? 's' : ''}</span>}
              </div>
            </div>

            {/* AI mode — always in DOM too, just hidden */}
            <div style={{ display: mode === 'ai' ? 'block' : 'none', padding: '1rem' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>Describe what you want to see — no SQL needed.</p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  value={nlQuery}
                  onChange={e => setNlQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runNl()}
                  placeholder={`e.g. "top 10 customers by revenue" or "monthly trend"`}
                  style={{ flex: 1, padding: '0.6rem 0.9rem', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', fontSize: '0.875rem', outline: 'none' }}
                />
                <button className="btn-primary" onClick={runNl} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                  <Zap size={13} />Generate
                </button>
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {[
                  activeTableInfo?.insights?.numericColumns?.[0] && `top 10 by ${activeTableInfo.insights.numericColumns[0]}`,
                  activeTableInfo?.insights?.dateColumns?.[0] && 'monthly trend',
                  activeTableInfo?.insights?.categoricalColumns?.[0] && `breakdown by ${activeTableInfo.insights.categoricalColumns[0]}`,
                  'find missing values',
                ].filter(Boolean).map(hint => (
                  <button key={hint} onClick={() => setNlQuery(hint)} style={{ padding: '0.25rem 0.65rem', borderRadius: 20, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', fontSize: '0.75rem', color: '#a5b4fc', cursor: 'pointer', transition: 'all 0.15s' }}>
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Suggestion cards */}
          {suggestions.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Sparkles size={11} style={{ color: '#6366f1' }} /> AI Suggestions
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '0.5rem' }}>
                {suggestions.map(s => (
                  <motion.div key={s.id} className="sp-card" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => { setQuery(s.sql); setMode('sql'); setTimeout(() => runQueryRef.current?.(), 50); }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, background: `${s.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <s.Icon size={13} style={{ color: s.color }} />
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{s.title}</span>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{s.desc}</p>
                    <span style={{ fontSize: '0.65rem', color: s.color, marginTop: '0.4rem', display: 'block', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{s.cat}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: '#f87171', fontSize: '0.82rem', fontFamily: 'monospace' }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
                <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}><X size={13} /></button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
          <AnimatePresence>
            {results && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="sp-panel">
                <div className="sp-panel-hdr">
                  Results — {results.rowCount.toLocaleString()} row{results.rowCount !== 1 ? 's' : ''}
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {autoChartType && (
                      <button className="sp-btn-ghost" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', color: showChart ? '#a5b4fc' : 'var(--text-secondary)' }} onClick={() => setShowChart(v => !v)}>
                        <BarChart2 size={11} />{showChart ? 'Hide' : 'Chart'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Chart */}
                <AnimatePresence>
                  {showChart && cData.length > 0 && results.columns.length >= 2 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 260 }} exit={{ opacity: 0, height: 0 }} style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
                        {['bar','line','pie'].filter(t => t === autoChartType || t === 'bar').map(t => (
                          <button key={t} onClick={() => setChartType(t)} style={{ padding: '0.2rem 0.6rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, border: '1px solid', cursor: 'pointer', background: chartType === t ? 'rgba(99,102,241,0.2)' : 'none', borderColor: chartType === t ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)', color: chartType === t ? '#a5b4fc' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </button>
                        ))}
                      </div>
                      <ResponsiveContainer width="100%" height={195}>
                        {chartType === 'pie' ? (
                          <PieChart>
                            <Pie data={cData} dataKey={results.columns[1]} nameKey={results.columns[0]} cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${String(name).slice(0,12)} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                              {cData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ background: '#1e1e28', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.78rem' }} />
                          </PieChart>
                        ) : chartType === 'line' ? (
                          <LineChart data={cData} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis dataKey={results.columns[0]} tick={{ fill: '#64748b', fontSize: 11 }} angle={-30} textAnchor="end" interval="preserveStartEnd" />
                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={fmtNum} />
                            <Tooltip contentStyle={{ background: '#1e1e28', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.78rem' }} formatter={v => [fmtNum(+v), results.columns[1]]} />
                            <Line type="monotone" dataKey={results.columns[1]} stroke="#6366f1" strokeWidth={2} dot={cData.length < 30} />
                          </LineChart>
                        ) : (
                          <BarChart data={cData} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis dataKey={results.columns[0]} tick={{ fill: '#64748b', fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={fmtNum} />
                            <Tooltip contentStyle={{ background: '#1e1e28', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.78rem' }} formatter={v => [fmtNum(+v), results.columns[1]]} />
                            <Bar dataKey={results.columns[1]} radius={[4, 4, 0, 0]}>
                              {cData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </motion.div>
                  )}
                </AnimatePresence>

                {results.columns.length === 0 ? (
                  <p style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Query ran successfully with no output.</p>
                ) : (
                  <>
                    <div className="sp-results-wrap">
                      <table className="sp-results-table">
                        <thead><tr>{results.columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
                        <tbody>
                          {pagedValues.map((row, i) => (
                            <tr key={i}>{row.map((cell, j) => <td key={j} title={String(cell ?? '')}>{String(cell ?? '')}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalPages > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <button className="sp-btn-ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '0.25rem 0.5rem' }}><ChevronLeft size={14} /></button>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Page {page} / {totalPages}</span>
                        <button className="sp-btn-ghost" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '0.25rem 0.5rem' }}><ChevronRight size={14} /></button>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── RIGHT PANEL: Insights ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {activeTableInfo?.insights && (() => {
            const ins = activeTableInfo.insights;
            return (
              <>
                <div className="sp-panel">
                  <div className="sp-panel-hdr"><Sparkles size={11} style={{ color: '#6366f1' }} /> Dataset Overview</div>
                  <div style={{ padding: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {[
                      { label: 'Rows', value: ins.rowCount.toLocaleString(), color: '#6366f1' },
                      { label: 'Columns', value: ins.columnCount, color: '#8b5cf6' },
                      { label: 'Completeness', value: `${ins.completeness}%`, color: ins.completeness > 90 ? '#10b981' : '#f59e0b' },
                      { label: 'Numeric cols', value: ins.numericColumns.length, color: '#10b981' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="sp-stat-card">
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color }}>{value}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Numeric column stats */}
                {ins.numericColumns.length > 0 && (
                  <div className="sp-panel">
                    <div className="sp-panel-hdr"><Hash size={11} style={{ color: '#10b981' }} /> Numeric Columns</div>
                    <div style={{ padding: '0.5rem' }}>
                      {ins.numericColumns.slice(0, 4).map(col => {
                        const st = ins.columnStats[col];
                        return (
                          <div key={col} style={{ padding: '0.5rem', borderRadius: 8, marginBottom: '0.4rem', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.1)' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.3rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.25rem' }}>
                              {[['min', fmtNum(st.min)], ['avg', fmtNum(st.avg)], ['max', fmtNum(st.max)]].map(([k, v]) => (
                                <div key={k} style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#10b981' }}>{v}</div>
                                  <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Categorical top values */}
                {ins.categoricalColumns.length > 0 && (
                  <div className="sp-panel">
                    <div className="sp-panel-hdr"><Tag size={11} style={{ color: '#6366f1' }} /> Top Categories</div>
                    <div style={{ padding: '0.5rem' }}>
                      {ins.categoricalColumns.slice(0, 2).map(col => {
                        const st = ins.columnStats[col];
                        const tops = st.topCategories || [];
                        const total = tops.reduce((s, [, c]) => s + c, 0);
                        return (
                          <div key={col} style={{ marginBottom: '0.75rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.3rem', paddingLeft: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col}</div>
                            {tops.map(([val, cnt], i) => (
                              <div key={val} style={{ marginBottom: '0.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.1rem' }}>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{String(val).slice(0, 20)}</span>
                                  <span style={{ fontSize: '0.7rem', color: '#a5b4fc', flexShrink: 0 }}>{Math.round(cnt / total * 100)}%</span>
                                </div>
                                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', borderRadius: 2, width: `${Math.round(cnt / total * 100)}%`, background: CHART_COLORS[i % CHART_COLORS.length], transition: 'width 0.5s ease' }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quick actions */}
                <div className="sp-panel">
                  <div className="sp-panel-hdr"><Zap size={11} style={{ color: '#f59e0b' }} /> Quick Actions</div>
                  <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {[
                      { label: 'Summary stats', sql: `SELECT COUNT(*) as rows${ins.numericColumns.slice(0,2).map(c => `,\n  ROUND(AVG("${c}"),2) as avg_${c.slice(0,10)},\n  ROUND(SUM("${c}"),2) as total_${c.slice(0,10)}`).join('')}\nFROM "${activeTableInfo.name}";` },
                      { label: 'Null analysis', sql: `SELECT ${activeTableInfo.columns.slice(0,5).map(c => `SUM(CASE WHEN "${c}" IS NULL OR "${c}"='' THEN 1 ELSE 0 END) as ${c.slice(0,14)}_nulls`).join(',\n  ')}\nFROM "${activeTableInfo.name}";` },
                      ...(ins.categoricalColumns[0] ? [{ label: `Top ${ins.categoricalColumns[0]}`, sql: `SELECT "${ins.categoricalColumns[0]}", COUNT(*) as count\nFROM "${activeTableInfo.name}"\nGROUP BY "${ins.categoricalColumns[0]}"\nORDER BY count DESC\nLIMIT 10;` }] : []),
                      ...(ins.dateColumns[0] && ins.numericColumns[0] ? [{ label: 'Monthly trend', sql: `SELECT strftime('%Y-%m',"${ins.dateColumns[0]}") as month, ROUND(SUM("${ins.numericColumns[0]}"),2) as total\nFROM "${activeTableInfo.name}"\nGROUP BY month ORDER BY month;` }] : []),
                    ].map(({ label, sql }) => (
                      <button key={label} onClick={() => { setQuery(sql); setMode('sql'); setTimeout(() => runQueryRef.current?.(), 50); }}
                        style={{ width: '100%', textAlign: 'left', padding: '0.45rem 0.6rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.15s' }}
                        onMouseOver={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; e.currentTarget.style.color = '#a5b4fc'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; }}
                        onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
                      >
                        <FileText size={11} style={{ flexShrink: 0 }} />{label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <RelatedTools currentToolId="sql-practice" category="utilities" />
      </div>
    </div>
  );
}

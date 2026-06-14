import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Play, Upload, Table, Clock,
  BarChart2, Download, ChevronLeft, ChevronRight, X, Copy,
  RefreshCw, ExternalLink, Zap, Eye, Hash,
  Filter, TrendingUp, Search, ArrowUp, ArrowDown,
  Command, MoreHorizontal,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  ScatterChart, Scatter, ZAxis,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { EditorState } from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, highlightActiveLine,
  ViewPlugin, WidgetType, Decoration,
} from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { sql as sqlLang } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import ToolHeader from '../../components/shared/ToolHeader';
import RelatedTools from '../../components/shared/RelatedTools';

// ─── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 50;
const CHART_COLORS = ['#6366f1','#8b5cf6','#d946ef','#3b82f6','#10b981','#f59e0b','#ef4444','#06b6d4','#84cc16','#f97316'];
const SQL_KW = ['SELECT','FROM','WHERE','AND','OR','NOT','IN','IS','NULL','LIKE','ORDER','BY','GROUP','HAVING','LIMIT','OFFSET','DISTINCT','AS','JOIN','LEFT','RIGHT','INNER','FULL','CROSS','ON','COUNT','SUM','AVG','MIN','MAX','CASE','WHEN','THEN','ELSE','END','BETWEEN','UNION','ALL','ASC','DESC','ROUND','STRFTIME','LENGTH','UPPER','LOWER','TRIM','REPLACE','SUBSTR','INSTR','COALESCE','NULLIF','ABS','TYPEOF','CAST','HOUR','MINUTE','SECOND','MONTH','YEAR','DAY','QUARTER','WEEK','MONTHNAME','DAYNAME','DAYOFWEEK','DATEDIFF','DATEADD','DENSE_RANK','RANK','ROW_NUMBER','OVER','PARTITION','WITH','CREATE','TABLE','INSERT','INTO','VALUES','UPDATE','SET','DELETE','DROP','ALTER','VIEW','INDEX','UNIQUE','PRIMARY','KEY','FOREIGN','REFERENCES','DEFAULT','AUTOINCREMENT','EXISTS','IF','IIF','NOT','ISNULL','NVL','CONCAT','LEFT','RIGHT','REVERSE','LPAD','RPAD','REPEAT','CEIL','CEILING','FLOOR','POWER','POW','SQRT','MOD','LOG','LOG10','EXP','SIGN','GREATEST','LEAST','PRINTF','DATE','TIME','DATETIME','CURRENT_DATE','CURRENT_TIMESTAMP','EXPLAIN','PRAGMA'];
const SQL_SNIPPETS = [
  { label: 'SELECT template', apply: 'SELECT *\nFROM ""\nLIMIT 10;', detail: 'query starter' },
  { label: 'GROUP BY aggregate', apply: 'SELECT "", COUNT(*) AS count\nFROM ""\nGROUP BY ""\nORDER BY count DESC;', detail: 'aggregate query' },
  { label: 'JOIN template', apply: 'SELECT a.*, b.*\nFROM "" a\nINNER JOIN "" b\n  ON a."" = b."";', detail: 'join query' },
  { label: 'CASE expression', apply: 'CASE\n  WHEN  THEN \n  ELSE \nEND', detail: 'conditional value' },
  { label: 'WITH CTE', apply: 'WITH base AS (\n  SELECT *\n  FROM ""\n)\nSELECT *\nFROM base;', detail: 'common table expression' },
  { label: 'ROW_NUMBER window', apply: 'ROW_NUMBER() OVER (PARTITION BY "" ORDER BY "" DESC) AS row_num', detail: 'window function' },
  { label: 'Monthly trend', apply: 'SELECT STRFTIME(\'%Y-%m\', "") AS month,\n  COUNT(*) AS records\nFROM ""\nGROUP BY month\nORDER BY month;', detail: 'date grouping' },
];

function sqlIdentifierApply(name) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
    ? name
    : `"${String(name).replace(/"/g, '""')}"`;
}

// ─── sql.js singleton ──────────────────────────────────────────────────────────
const CDN_JS   = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js';
const CDN_WASM = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.wasm';

// ─── Web Worker: off-main-thread query execution ───────────────────────────────
const WORKER_SRC = `
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
let db = null;

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[$,%\\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseDate(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();
  const normalized = /^\\d{4}-\\d{1,2}-\\d{1,2}$/.test(s) ? s + 'T00:00:00Z' : s;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function datePart(part, v) {
  const d = parseDate(v);
  if (!d) return null;
  const p = String(part || '').toLowerCase();
  if (p === 'year' || p === 'yy' || p === 'yyyy') return d.getUTCFullYear();
  if (p === 'quarter' || p === 'qq' || p === 'q') return Math.floor(d.getUTCMonth() / 3) + 1;
  if (p === 'month' || p === 'mm' || p === 'm') return d.getUTCMonth() + 1;
  if (p === 'day' || p === 'dd' || p === 'd') return d.getUTCDate();
  if (p === 'hour' || p === 'hh') return d.getUTCHours();
  if (p === 'minute' || p === 'mi' || p === 'n') return d.getUTCMinutes();
  if (p === 'second' || p === 'ss' || p === 's') return d.getUTCSeconds();
  if (p === 'weekday' || p === 'dow') return d.getUTCDay() + 1;
  return null;
}

function addDate(part, amount, value) {
  const d = parseDate(value);
  const n = Number(amount);
  if (!d || !Number.isFinite(n)) return null;
  const p = String(part || '').toLowerCase();
  if (p === 'year' || p === 'yy' || p === 'yyyy') d.setUTCFullYear(d.getUTCFullYear() + n);
  else if (p === 'quarter' || p === 'qq' || p === 'q') d.setUTCMonth(d.getUTCMonth() + n * 3);
  else if (p === 'month' || p === 'mm' || p === 'm') d.setUTCMonth(d.getUTCMonth() + n);
  else if (p === 'hour' || p === 'hh') d.setUTCHours(d.getUTCHours() + n);
  else if (p === 'minute' || p === 'mi' || p === 'n') d.setUTCMinutes(d.getUTCMinutes() + n);
  else if (p === 'second' || p === 'ss' || p === 's') d.setUTCSeconds(d.getUTCSeconds() + n);
  else d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function diffDate(args) {
  const hasPart = args.length >= 3;
  const part = hasPart ? String(args[0] || 'day').toLowerCase() : 'day';
  const a = parseDate(args[hasPart ? 1 : 0]);
  const b = parseDate(args[hasPart ? 2 : 1]);
  if (!a || !b) return null;
  const ms = b - a;
  if (part === 'year') return b.getUTCFullYear() - a.getUTCFullYear();
  if (part === 'month') return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (part === 'hour') return Math.trunc(ms / 3600000);
  if (part === 'minute') return Math.trunc(ms / 60000);
  if (part === 'second') return Math.trunc(ms / 1000);
  return Math.trunc(ms / 86400000);
}

function regFns(d) {
  d.create_function('HOUR',      v => v ? +String(v).slice(11,13)||0 : null);
  d.create_function('MINUTE',    v => v ? +String(v).slice(14,16)||0 : null);
  d.create_function('SECOND',    v => v ? +String(v).slice(17,19)||0 : null);
  d.create_function('MONTH',     v => v ? +String(v).slice(5,7)||0   : null);
  d.create_function('YEAR',      v => v ? +String(v).slice(0,4)||0   : null);
  d.create_function('DAY',       v => v ? +String(v).slice(8,10)||0  : null);
  d.create_function('QUARTER',   v => { const d = parseDate(v); return d ? Math.floor(d.getUTCMonth() / 3) + 1 : null; });
  d.create_function('WEEK',      v => { const d = parseDate(v); if(!d) return null; const first = Date.UTC(d.getUTCFullYear(),0,1); return Math.floor(((d - first) / 86400000 + new Date(first).getUTCDay()) / 7) + 1; });
  d.create_function('DATEPART',  (part, v) => datePart(part, v));
  d.create_function('MONTHNAME', v => { if(!v) return null; return MONTHS[+String(v).slice(5,7)-1]||null; });
  d.create_function('DAYNAME',   v => { if(!v) return null; const t=new Date(String(v)+'T00:00:00Z'); return isNaN(t)?null:DAYS[t.getUTCDay()]; });
  d.create_function('DAYOFWEEK', v => { if(!v) return null; const t=new Date(String(v)+'T00:00:00Z'); return isNaN(t)?null:t.getUTCDay()+1; });
  d.create_function('DATEDIFF',  (...args) => diffDate(args));
  d.create_function('DATEADD',   (part, amount, value) => addDate(part, amount, value));
  // ISNULL / NVL compat
  d.create_function('ISNULL',    (v, def) => (v === null || v === undefined || v === '') ? def : v);
  d.create_function('NVL',       (v, def) => (v === null || v === undefined || v === '') ? def : v);
  d.create_function('IF',        (cond, a, b) => cond ? a : b);
  d.create_function('IIF',       (cond, a, b) => cond ? a : b);
  d.create_function('CONCAT',    (...args) => args.map(v => v ?? '').join(''));
  d.create_function('LEFT',      (s, n) => String(s ?? '').slice(0, Math.max(0, Number(n) || 0)));
  d.create_function('RIGHT',     (s, n) => { const str = String(s ?? ''); return str.slice(Math.max(0, str.length - (Number(n) || 0))); });
  d.create_function('REVERSE',   s => String(s ?? '').split('').reverse().join(''));
  d.create_function('LPAD',      (s, n, p) => String(s ?? '').padStart(n, p ?? ' '));
  d.create_function('RPAD',      (s, n, p) => String(s ?? '').padEnd(n, p ?? ' '));
  d.create_function('REPEAT',    (s, n) => String(s ?? '').repeat(Math.max(0, Number(n) || 0)));
  d.create_function('CEIL',      v => { const n = num(v); return n === null ? null : Math.ceil(n); });
  d.create_function('CEILING',   v => { const n = num(v); return n === null ? null : Math.ceil(n); });
  d.create_function('FLOOR',     v => { const n = num(v); return n === null ? null : Math.floor(n); });
  d.create_function('POWER',     (a, b) => Math.pow(num(a) ?? 0, num(b) ?? 0));
  d.create_function('POW',       (a, b) => Math.pow(num(a) ?? 0, num(b) ?? 0));
  d.create_function('SQRT',      v => { const n = num(v); return n === null ? null : Math.sqrt(n); });
  d.create_function('MOD',       (a, b) => { const x = num(a), y = num(b); return x === null || !y ? null : x % y; });
  d.create_function('LOG',       v => { const n = num(v); return n && n > 0 ? Math.log(n) : null; });
  d.create_function('LOG10',     v => { const n = num(v); return n && n > 0 ? Math.log10(n) : null; });
  d.create_function('EXP',       v => { const n = num(v); return n === null ? null : Math.exp(n); });
  d.create_function('SIGN',      v => { const n = num(v); return n === null ? null : Math.sign(n); });
  d.create_function('GREATEST',  (...args) => { const vals = args.filter(v => v !== null && v !== undefined && v !== ''); return vals.length ? Math.max(...vals.map(v => num(v) ?? Number.NEGATIVE_INFINITY)) : null; });
  d.create_function('LEAST',     (...args) => { const vals = args.filter(v => v !== null && v !== undefined && v !== ''); return vals.length ? Math.min(...vals.map(v => num(v) ?? Number.POSITIVE_INFINITY)) : null; });
}

// Return live schema from the worker DB (tables + columns + row counts)
function getSchema() {
  try {
    const tblRes = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    if (!tblRes.length) return [];
    return tblRes[0].values.map(([name]) => {
      const cols = db.exec("PRAGMA table_info([" + name + "])");
      const columns = cols.length ? cols[0].values.map(r => r[1]) : [];
      const cnt = db.exec("SELECT COUNT(*) FROM [" + name + "]");
      const rowCount = cnt.length ? (cnt[0].values[0][0] ?? 0) : 0;
      return { name, columns, rowCount };
    });
  } catch { return []; }
}

self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      importScripts(data.cdnJs);
      const SQL = await initSqlJs({ locateFile: () => data.cdnWasm });
      if (db) db.close();
      db = new SQL.Database(new Uint8Array(data.buffer));
      regFns(db);
      self.postMessage({ type: 'ready', msgId: data.msgId });
    } catch(e) { self.postMessage({ type: 'error', error: e.message, msgId: data.msgId }); }
  }
  if (data.type === 'exec') {
    try {
      const t0 = performance.now();
      const res = db.exec(data.sql);
      const elapsed = (performance.now() - t0).toFixed(1);
      const rowsModified = db.getRowsModified ? db.getRowsModified() : 0;
      const schema = getSchema();
      self.postMessage({ type: 'result', res: res||[], elapsed, rowsModified, schema, msgId: data.msgId });
    } catch(e) { self.postMessage({ type: 'error', error: e.message, msgId: data.msgId }); }
  }
};
`;

let _workerBlobUrl = null;
function getWorkerBlobUrl() {
  if (!_workerBlobUrl) _workerBlobUrl = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'application/javascript' }));
  return _workerBlobUrl;
}

// ─── sql.js engine loader ──────────────────────────────────────────────────────
async function _loadEngine() {
  try {
    const mod = await import('sql.js');
    const candidate = mod.default ?? mod;
    const fn = typeof candidate === 'function' ? candidate
             : typeof candidate?.default === 'function' ? candidate.default : null;
    if (fn) {
      const engine = await fn({ locateFile: () => '/sql-wasm.wasm' });
      if (typeof engine?.Database === 'function') return engine;
    }
  } catch { /* fall through */ }
  await new Promise((resolve, reject) => {
    if (typeof window.initSqlJs === 'function') return resolve();
    const s = document.createElement('script');
    s.src = CDN_JS;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load SQL engine. Check your internet connection.'));
    document.head.appendChild(s);
  });
  return window.initSqlJs({ locateFile: () => CDN_WASM });
}

let _enginePromise = null;
function getSqlEngine() {
  if (!_enginePromise) _enginePromise = _loadEngine().catch(err => { _enginePromise = null; throw err; });
  return _enginePromise;
}

function sqlNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[$,%\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseSqlDate(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();
  const d = new Date(/^\d{4}-\d{1,2}-\d{1,2}$/.test(s) ? `${s}T00:00:00Z` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sqlDatePart(part, value) {
  const d = parseSqlDate(value);
  if (!d) return null;
  const p = String(part || '').toLowerCase();
  if (['year','yy','yyyy'].includes(p)) return d.getUTCFullYear();
  if (['quarter','qq','q'].includes(p)) return Math.floor(d.getUTCMonth() / 3) + 1;
  if (['month','mm','m'].includes(p)) return d.getUTCMonth() + 1;
  if (['day','dd','d'].includes(p)) return d.getUTCDate();
  if (['hour','hh'].includes(p)) return d.getUTCHours();
  if (['minute','mi','n'].includes(p)) return d.getUTCMinutes();
  if (['second','ss','s'].includes(p)) return d.getUTCSeconds();
  if (['weekday','dow'].includes(p)) return d.getUTCDay() + 1;
  return null;
}

function sqlDateAdd(part, amount, value) {
  const d = parseSqlDate(value);
  const n = Number(amount);
  if (!d || !Number.isFinite(n)) return null;
  const p = String(part || '').toLowerCase();
  if (['year','yy','yyyy'].includes(p)) d.setUTCFullYear(d.getUTCFullYear() + n);
  else if (['quarter','qq','q'].includes(p)) d.setUTCMonth(d.getUTCMonth() + n * 3);
  else if (['month','mm','m'].includes(p)) d.setUTCMonth(d.getUTCMonth() + n);
  else if (['hour','hh'].includes(p)) d.setUTCHours(d.getUTCHours() + n);
  else if (['minute','mi','n'].includes(p)) d.setUTCMinutes(d.getUTCMinutes() + n);
  else if (['second','ss','s'].includes(p)) d.setUTCSeconds(d.getUTCSeconds() + n);
  else d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function sqlDateDiff(...args) {
  const hasPart = args.length >= 3;
  const part = hasPart ? String(args[0] || 'day').toLowerCase() : 'day';
  const a = parseSqlDate(args[hasPart ? 1 : 0]);
  const b = parseSqlDate(args[hasPart ? 2 : 1]);
  if (!a || !b) return null;
  const ms = b - a;
  if (part === 'year') return b.getUTCFullYear() - a.getUTCFullYear();
  if (part === 'month') return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (part === 'hour') return Math.trunc(ms / 3600000);
  if (part === 'minute') return Math.trunc(ms / 60000);
  if (part === 'second') return Math.trunc(ms / 1000);
  return Math.trunc(ms / 86400000);
}

function registerSqlFunctions(db) {
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  db.create_function('HOUR',      v => v ? +String(v).slice(11,13)||0 : null);
  db.create_function('MINUTE',    v => v ? +String(v).slice(14,16)||0 : null);
  db.create_function('SECOND',    v => v ? +String(v).slice(17,19)||0 : null);
  db.create_function('MONTH',     v => v ? +String(v).slice(5,7)||0   : null);
  db.create_function('YEAR',      v => v ? +String(v).slice(0,4)||0   : null);
  db.create_function('DAY',       v => v ? +String(v).slice(8,10)||0  : null);
  db.create_function('QUARTER',   v => { const d = parseSqlDate(v); return d ? Math.floor(d.getUTCMonth() / 3) + 1 : null; });
  db.create_function('WEEK',      v => { const d = parseSqlDate(v); if (!d) return null; const first = Date.UTC(d.getUTCFullYear(), 0, 1); return Math.floor(((d - first) / 86400000 + new Date(first).getUTCDay()) / 7) + 1; });
  db.create_function('DATEPART',  (part, v) => sqlDatePart(part, v));
  db.create_function('MONTHNAME', v => { if(!v) return null; return MONTHS[+String(v).slice(5,7)-1]||null; });
  db.create_function('DAYNAME',   v => { if(!v) return null; const t=new Date(String(v)+'T00:00:00Z'); return isNaN(t)?null:DAYS[t.getUTCDay()]; });
  db.create_function('DAYOFWEEK', v => { if(!v) return null; const t=new Date(String(v)+'T00:00:00Z'); return isNaN(t)?null:t.getUTCDay()+1; });
  db.create_function('DATEDIFF',  (...args) => sqlDateDiff(...args));
  db.create_function('DATEADD',   (part, amount, value) => sqlDateAdd(part, amount, value));
  db.create_function('ISNULL',    (v, def) => (v === null || v === undefined || v === '') ? def : v);
  db.create_function('NVL',       (v, def) => (v === null || v === undefined || v === '') ? def : v);
  db.create_function('IF',        (cond, a, b) => cond ? a : b);
  db.create_function('IIF',       (cond, a, b) => cond ? a : b);
  db.create_function('CONCAT',    (...args) => args.map(v => v ?? '').join(''));
  db.create_function('LEFT',      (s, n) => String(s ?? '').slice(0, Math.max(0, Number(n) || 0)));
  db.create_function('RIGHT',     (s, n) => { const str = String(s ?? ''); return str.slice(Math.max(0, str.length - (Number(n) || 0))); });
  db.create_function('REVERSE',   s => String(s ?? '').split('').reverse().join(''));
  db.create_function('LPAD',      (s, n, p) => String(s ?? '').padStart(n, p ?? ' '));
  db.create_function('RPAD',      (s, n, p) => String(s ?? '').padEnd(n, p ?? ' '));
  db.create_function('REPEAT',    (s, n) => String(s ?? '').repeat(Math.max(0, Number(n) || 0)));
  db.create_function('CEIL',      v => { const n = sqlNum(v); return n === null ? null : Math.ceil(n); });
  db.create_function('CEILING',   v => { const n = sqlNum(v); return n === null ? null : Math.ceil(n); });
  db.create_function('FLOOR',     v => { const n = sqlNum(v); return n === null ? null : Math.floor(n); });
  db.create_function('POWER',     (a, b) => Math.pow(sqlNum(a) ?? 0, sqlNum(b) ?? 0));
  db.create_function('POW',       (a, b) => Math.pow(sqlNum(a) ?? 0, sqlNum(b) ?? 0));
  db.create_function('SQRT',      v => { const n = sqlNum(v); return n === null ? null : Math.sqrt(n); });
  db.create_function('MOD',       (a, b) => { const x = sqlNum(a), y = sqlNum(b); return x === null || !y ? null : x % y; });
  db.create_function('LOG',       v => { const n = sqlNum(v); return n && n > 0 ? Math.log(n) : null; });
  db.create_function('LOG10',     v => { const n = sqlNum(v); return n && n > 0 ? Math.log10(n) : null; });
  db.create_function('EXP',       v => { const n = sqlNum(v); return n === null ? null : Math.exp(n); });
  db.create_function('SIGN',      v => { const n = sqlNum(v); return n === null ? null : Math.sign(n); });
  db.create_function('GREATEST',  (...args) => { const vals = args.filter(v => v !== null && v !== undefined && v !== ''); return vals.length ? Math.max(...vals.map(v => sqlNum(v) ?? Number.NEGATIVE_INFINITY)) : null; });
  db.create_function('LEAST',     (...args) => { const vals = args.filter(v => v !== null && v !== undefined && v !== ''); return vals.length ? Math.min(...vals.map(v => sqlNum(v) ?? Number.POSITIVE_INFINITY)) : null; });
}

async function buildDb(tables) {
  const SQL = await getSqlEngine();
  const db = new SQL.Database();
  registerSqlFunctions(db);
  for (const t of tables) {
    db.run(`CREATE TABLE IF NOT EXISTS "${t.name}" (${t.columns.map(c => `"${c}" TEXT`).join(', ')})`);
    if (t.rows.length > 0) {
      const ph = t.columns.map(() => '?').join(', ');
      const stmt = db.prepare(`INSERT INTO "${t.name}" VALUES (${ph})`);
      for (const row of t.rows) stmt.run(t.columns.map(c => {
        const v = row[c];
        return typeof v === 'string' ? v.trim() : String(v ?? '');
      }));
      stmt.free();
    }
  }
  return db;
}

// ─── File parsing ──────────────────────────────────────────────────────────────
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
  const columns = raw[0].map((c, i) => (String(c || `col${i}`).trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1') || `col${i}`));
  const rows    = raw.slice(1).map(row => {
    const o = {};
    columns.forEach((col, i) => {
      const v = row[i];
      o[col] = typeof v === 'string' ? v.trim() : (v ?? '');
    });
    return o;
  });
  return { name: toTableName(file.name), columns, rows };
}

async function loadSampleData() {
  const res  = await fetch('/sample-pizza-sales.csv');
  const text = await res.text();
  return parseFile(new File([text], 'sample-pizza-sales.csv', { type: 'text/csv' }));
}

// ─── Column type detection ─────────────────────────────────────────────────────
const TYPE_COLOR = { numeric:'#10b981', currency:'#f59e0b', percentage:'#8b5cf6', date:'#06b6d4', location:'#ec4899', categorical:'#6366f1', id:'#94a3b8' };
const TYPE_LABEL = { numeric:'123', currency:'$', percentage:'%', date:'📅', location:'📍', categorical:'◈', id:'#' };

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
  for (const col of table.columns) types[col] = detectType(col, table.rows.map(r => r[col]));
  return types;
}

// ─── Chart analysis ────────────────────────────────────────────────────────────
function fmtNum(n) {
  if (n === undefined || n === null) return '—';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}

function generateCaption(type, columns, values) {
  try {
    if (type === 'bar' || type === 'hbar' || type === 'donut') {
      const nums = values.map(r => parseFloat(r[1])).filter(v => !isNaN(v));
      if (!nums.length) return null;
      const maxIdx = nums.indexOf(Math.max(...nums));
      if (type === 'donut') {
        const total = nums.reduce((s, n) => s + n, 0);
        const pct = total > 0 ? ((nums[maxIdx] / total) * 100).toFixed(0) : 0;
        return `${String(values[maxIdx][0]).slice(0, 22)} makes up ${pct}% of total`;
      }
      const sorted = [...nums].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const ratio  = median > 0 ? (nums[maxIdx] / median).toFixed(1) : null;
      return `${String(values[maxIdx][0]).slice(0, 22)} leads with ${fmtNum(nums[maxIdx])}${ratio && ratio !== '1.0' ? `, ${ratio}× above median` : ''}`;
    }
    if (type === 'line' || type === 'area') {
      const nums = values.map(r => parseFloat(r[1])).filter(v => !isNaN(v));
      if (nums.length < 2) return null;
      const maxIdx   = nums.indexOf(Math.max(...nums));
      const pctRaw   = ((nums[nums.length - 1] - nums[0]) / Math.abs(nums[0])) * 100;
      const pct      = Math.abs(pctRaw).toFixed(0);
      const dir      = pctRaw >= 0 ? 'up' : 'down';
      return `Peaked at ${String(values[maxIdx][0]).slice(0, 12)} (${fmtNum(nums[maxIdx])}), ${pct}% ${dir} overall`;
    }
    if (type === 'scatter') {
      const xs = values.map(r => parseFloat(r[0])).filter(v => !isNaN(v));
      const ys = values.map(r => parseFloat(r[1])).filter(v => !isNaN(v));
      if (xs.length < 3) return null;
      const n  = Math.min(xs.length, ys.length);
      const xm = xs.slice(0, n).reduce((s, v) => s + v, 0) / n;
      const ym = ys.slice(0, n).reduce((s, v) => s + v, 0) / n;
      const num = xs.slice(0, n).reduce((s, v, i) => s + (v - xm) * (ys[i] - ym), 0);
      const den = Math.sqrt(xs.slice(0, n).reduce((s, v) => s + (v - xm) ** 2, 0) * ys.slice(0, n).reduce((s, v) => s + (v - ym) ** 2, 0));
      const r   = den > 0 ? (num / den).toFixed(2) : 0;
      const strength = Math.abs(r) > 0.7 ? 'Strong' : Math.abs(r) > 0.4 ? 'Moderate' : 'Weak';
      const dir = r >= 0 ? 'positive' : 'negative';
      return `${strength} ${dir} correlation (r = ${r}) between ${columns[0]} and ${columns[1]}`;
    }
  } catch { /* ignore */ }
  return null;
}

function analyzeChart(results) {
  const none = { type: null, altTypes: [], caption: null, autoShow: false, axisConfig: null };
  if (!results || !results.columns.length || !results.values.length) return none;
  const { columns, values, rowCount } = results;
  const colCount = columns.length;

  const isNumericCol = idx => {
    const nums = values.map(r => parseFloat(r[idx])).filter(v => !isNaN(v));
    return nums.length / values.length > 0.75;
  };
  const isDateCol = idx => {
    const name = columns[idx].toLowerCase();
    if (/date|month|year|week|day/.test(name)) return true;
    return values.slice(0, 5).some(r => /^\d{4}[-/]\d{1,2}/.test(String(r[idx] ?? '')));
  };
  const avgLabelLen = idx => {
    const ls = values.map(r => String(r[idx] ?? ''));
    return ls.reduce((s, l) => s + l.length, 0) / ls.length;
  };
  const numericIndexes = columns.map((_, i) => isNumericCol(i) ? i : -1).filter(i => i >= 0);
  const categoryIndexes = columns.map((_, i) => (!isNumericCol(i) && !isDateCol(i)) ? i : -1).filter(i => i >= 0);

  // 1. Stat cards: 1 row, 2-8 numeric cols
  if (rowCount === 1 && colCount >= 2 && colCount <= 8 && columns.every((_, i) => isNumericCol(i)))
    return { type: 'stat-cards', altTypes: [], caption: null, autoShow: true, axisConfig: null };

  // 2. Time series
  if (isDateCol(0) && colCount >= 2 && isNumericCol(1)) {
    const type = rowCount <= 15 ? 'line' : 'area';
    const altTypes = rowCount <= 15 ? ['area'] : ['line'];
    if (colCount === 3 && isNumericCol(2)) altTypes.push('multiline');
    return { type, altTypes, caption: generateCaption(type, columns, values), autoShow: true, axisConfig: colCount === 3 ? { x: columns[0], y: columns[1], y2: columns[2] } : null };
  }

  // 3. Scatter: 2 numeric cols
  if (colCount === 2 && isNumericCol(0) && isNumericCol(1))
    return { type: 'scatter', altTypes: [], caption: generateCaption('scatter', columns, values), autoShow: false, axisConfig: null };

  // 3b. Bubble/scatter: 3 numeric cols
  if (colCount === 3 && isNumericCol(0) && isNumericCol(1) && isNumericCol(2))
    return { type: 'bubble', altTypes: ['scatter'], caption: generateCaption('scatter', columns, values), autoShow: true, axisConfig: { x: columns[0], y: columns[1], size: columns[2] } };

  // 4. Histogram: 1 numeric col, many distinct values
  if (colCount === 1 && isNumericCol(0)) {
    const distinct = new Set(values.map(r => r[0])).size;
    if (distinct >= 15) return { type: 'histogram', altTypes: [], caption: null, autoShow: false, axisConfig: null };
  }

  // 5. Donut: cat + num, ≤8 rows, all positive
  if (colCount === 2 && !isNumericCol(0) && isNumericCol(1) && rowCount <= 8) {
    const allPos = values.every(r => parseFloat(r[1]) >= 0);
    if (allPos) return { type: 'donut', altTypes: ['bar', 'hbar'], caption: generateCaption('donut', columns, values), autoShow: true, axisConfig: null };
  }

  // 6. Horizontal bar: long labels
  if (colCount === 2 && !isNumericCol(0) && isNumericCol(1) && avgLabelLen(0) > 10)
    return { type: 'hbar', altTypes: ['bar', 'donut'], caption: generateCaption('hbar', columns, values), autoShow: true, axisConfig: null };

  // 7. Bar: cat + num, ≤30 rows
  if (colCount === 2 && !isNumericCol(0) && isNumericCol(1) && rowCount <= 30)
    return { type: 'bar', altTypes: ['hbar', 'donut'], caption: generateCaption('bar', columns, values), autoShow: true, axisConfig: null };

  // 8. Multi-line: date + 2 numeric
  if (colCount === 3 && isDateCol(0) && isNumericCol(1) && isNumericCol(2))
    return { type: 'multiline', altTypes: ['stacked-bar'], caption: null, autoShow: true, axisConfig: { x: columns[0], y: columns[1], y2: columns[2] } };

  // 9. Stacked bar: cat + 2 numeric
  if (colCount === 3 && !isNumericCol(0) && isNumericCol(1) && isNumericCol(2))
    return { type: 'stacked-bar', altTypes: ['multiline', 'bar'], caption: null, autoShow: true, axisConfig: { x: columns[0], y: columns[1], y2: columns[2] } };

  // 10. Category/date + series + value, e.g. region/status/count or month/product/revenue.
  if (colCount === 3 && numericIndexes.length === 1 && categoryIndexes.length >= 1) {
    const valueIdx = numericIndexes[0];
    const xIdx = isDateCol(0) || !isNumericCol(0) ? 0 : categoryIndexes[0];
    const seriesIdx = [0, 1, 2].find(i => i !== xIdx && i !== valueIdx && !isNumericCol(i));
    if (seriesIdx !== undefined) {
      const type = isDateCol(xIdx) ? 'series-line' : 'grouped-bar';
      const altTypes = isDateCol(xIdx) ? ['grouped-bar', 'stacked-series'] : ['stacked-series', 'series-line'];
      return { type, altTypes, caption: null, autoShow: true, axisConfig: { x: columns[xIdx], series: columns[seriesIdx], y: columns[valueIdx] } };
    }
  }

  // 11. Three columns with one label and two numeric measures, even when the label is date-like/categorical.
  if (colCount === 3 && numericIndexes.length === 2) {
    const xIdx = [0, 1, 2].find(i => !numericIndexes.includes(i)) ?? 0;
    const [yIdx, y2Idx] = numericIndexes;
    return { type: isDateCol(xIdx) ? 'multiline' : 'stacked-bar', altTypes: ['bar', 'multiline'], caption: null, autoShow: true, axisConfig: { x: columns[xIdx], y: columns[yIdx], y2: columns[y2Idx] } };
  }

  return none;
}

function buildHistogramBins(values, colIdx = 0) {
  const nums = values.map(r => parseFloat(r[colIdx])).filter(v => !isNaN(v));
  if (!nums.length) return [];
  const min   = Math.min(...nums);
  const max   = Math.max(...nums);
  const bins  = Math.min(12, Math.ceil(Math.sqrt(nums.length)));
  const bw    = (max - min) / bins || 1;
  const buckets = Array.from({ length: bins }, (_, i) => ({ range: `${fmtNum(min + i * bw)}`, count: 0 }));
  for (const n of nums) {
    const bi = Math.min(Math.floor((n - min) / bw), bins - 1);
    buckets[bi].count++;
  }
  return buckets;
}

function chartData(results) {
  if (!results) return [];
  return results.values.map(row => {
    const obj = {};
    results.columns.forEach((col, i) => { obj[col] = isNaN(parseFloat(row[i])) ? (row[i] ?? '') : parseFloat(row[i]); });
    return obj;
  });
}

function seriesChartData(rows, axisConfig) {
  if (!rows?.length || !axisConfig?.x || !axisConfig?.series || !axisConfig?.y) return { data: [], keys: [] };
  const grouped = new Map();
  const keys = new Set();
  for (const row of rows) {
    const x = String(row[axisConfig.x] ?? '');
    const series = String(row[axisConfig.series] ?? 'Series');
    const value = parseFloat(row[axisConfig.y]);
    if (!grouped.has(x)) grouped.set(x, { [axisConfig.x]: x });
    grouped.get(x)[series] = (grouped.get(x)[series] || 0) + (Number.isFinite(value) ? value : 0);
    keys.add(series);
  }
  return { data: Array.from(grouped.values()), keys: Array.from(keys).slice(0, 12) };
}

// ─── Export helpers ────────────────────────────────────────────────────────────
function exportCSV(results) {
  const csv = [results.columns.join(','), ...results.values.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'results.csv' });
  a.click();
}

function exportJSON(results) {
  const data = results.values.map(row => Object.fromEntries(results.columns.map((c, i) => [c, row[i]])));
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), download: 'results.json' });
  a.click();
}

// ─── Starter queries ───────────────────────────────────────────────────────────
function buildStarters(table, allTables = []) {
  if (!table) return [];
  const tn      = `"${table.name}"`;
  const cols    = table.columns;
  const types   = getColumnTypes(table);
  const numCols = cols.filter(c => ['numeric','currency','percentage'].includes(types[c]));
  const catCols = cols.filter(c => types[c] === 'categorical');
  const dateCols = cols.filter(c => types[c] === 'date');

  const starters = [
    { icon: Eye,       label: 'Preview',        sql: `SELECT *\nFROM ${tn}\nLIMIT 10;` },
    { icon: Hash,      label: 'Count rows',     sql: `SELECT COUNT(*) AS total_rows\nFROM ${tn};` },
  ];
  if (numCols[0]) starters.push({ icon: TrendingUp, label: `Stats on ${numCols[0]}`, sql: `SELECT\n  MIN("${numCols[0]}") AS min_val,\n  MAX("${numCols[0]}") AS max_val,\n  ROUND(AVG("${numCols[0]}"), 2) AS avg_val,\n  ROUND(SUM("${numCols[0]}"), 2) AS total\nFROM ${tn};` });
  if (catCols[0]) starters.push({ icon: Filter, label: `Group by ${catCols[0]}`, sql: `SELECT "${catCols[0]}",\n  COUNT(*) AS count\nFROM ${tn}\nGROUP BY "${catCols[0]}"\nORDER BY count DESC\nLIMIT 15;` });
  if (numCols[0] && catCols[0]) starters.push({ icon: BarChart2, label: `Top by ${numCols[0]}`, sql: `SELECT "${catCols[0]}",\n  ROUND(SUM("${numCols[0]}"), 2) AS total\nFROM ${tn}\nGROUP BY "${catCols[0]}"\nORDER BY total DESC\nLIMIT 10;` });
  if (dateCols[0] && numCols[0]) starters.push({ icon: TrendingUp, label: 'Monthly trend', sql: `SELECT\n  STRFTIME('%Y-%m', "${dateCols[0]}") AS month,\n  ROUND(SUM("${numCols[0]}"), 2) AS total,\n  COUNT(*) AS records\nFROM ${tn}\nGROUP BY month\nORDER BY month ASC;` });
  starters.push({ icon: Search, label: 'Missing values', sql: `SELECT ${cols.slice(0, 5).map(c => `\n  SUM(CASE WHEN "${c}" IS NULL OR "${c}" = '' THEN 1 ELSE 0 END) AS ${c.slice(0,14)}_nulls`).join(',')}\nFROM ${tn};` });

  // JOIN starter (when 2+ tables are loaded)
  const otherTables = allTables.filter(t => t.name !== table.name);
  if (otherTables.length > 0) {
    const t2 = otherTables[0];
    const shared = cols.find(c => t2.columns.includes(c));
    const joinCol = shared || cols[0];
    starters.push({ icon: ExternalLink, label: `JOIN ${t2.name}`, sql: `SELECT a.*, b.*\nFROM ${tn} a\nINNER JOIN "${t2.name}" b\n  ON a."${joinCol}" = b."${joinCol}"\nLIMIT 20;` });
    starters.push({ icon: ExternalLink, label: `LEFT JOIN ${t2.name}`, sql: `SELECT a."${cols[0]}", b."${t2.columns[0]}",\n  COUNT(*) AS count\nFROM ${tn} a\nLEFT JOIN "${t2.name}" b\n  ON a."${joinCol}" = b."${joinCol}"\nGROUP BY a."${cols[0]}"\nORDER BY count DESC;` });
    starters.push({ icon: Database, label: 'UNION ALL', sql: `SELECT "${cols[0]}" AS col1, '${table.name}' AS source\nFROM ${tn}\nUNION ALL\nSELECT "${t2.columns[0]}" AS col1, '${t2.name}' AS source\nFROM "${t2.name}";` });
  }

  // CREATE TABLE + INSERT template
  starters.push({ icon: Database, label: 'Create new table', sql: `-- Create a new table\nCREATE TABLE IF NOT EXISTS new_table (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  name TEXT NOT NULL,\n  value REAL DEFAULT 0,\n  created_at TEXT DEFAULT CURRENT_TIMESTAMP\n);\n\n-- Insert rows\nINSERT INTO new_table (name, value) VALUES\n  ('Alice', 42.5),\n  ('Bob', 87.3),\n  ('Carol', 15.0);\n\n-- View results\nSELECT * FROM new_table;` });

  return starters;
}

// ─── Ghost-text autocomplete ───────────────────────────────────────────────────
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
  const accept = keymap.of([{ key: 'Tab', run: view => {
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
  }}]);
  return [plugin, accept];
}

// ─── SQL formatter ─────────────────────────────────────────────────────────────
function formatSQL(raw) {
  const KWS = ['SELECT','FROM','WHERE','GROUP BY','ORDER BY','HAVING','LIMIT','OFFSET',
    'LEFT JOIN','RIGHT JOIN','INNER JOIN','FULL JOIN','CROSS JOIN','JOIN','ON',
    'UNION ALL','UNION','AND','OR','CASE','WHEN','THEN','ELSE','END'];
  let s = raw.replace(/\s+/g, ' ').trim();
  for (const kw of KWS) s = s.replace(new RegExp(`(?<=[^\\w]|^)${kw}(?=[^\\w]|$)`, 'gi'), `\n${kw.toUpperCase()}`);
  return s.split('\n').map(l => l.trim()).filter(Boolean).join('\n');
}

function cleanSqlForRun(raw) {
  const input = String(raw || '');
  let out = '';
  let quote = null;
  let pendingSpace = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];

    if (quote) {
      out += ch;
      if (ch === quote) {
        if (next === quote && (quote === '\'' || quote === '"')) {
          out += next;
          i += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (ch === '\'' || ch === '"' || ch === '`') {
      if (pendingSpace && out && !out.endsWith('\n') && !/[ (,[=<>+\-*/%]$/.test(out)) out += ' ';
      pendingSpace = false;
      quote = ch;
      out += ch;
      continue;
    }

    if (ch === '-' && next === '-') {
      if (pendingSpace && out && !out.endsWith('\n')) out += ' ';
      pendingSpace = false;
      while (i < input.length && input[i] !== '\n') {
        out += input[i];
        i += 1;
      }
      if (!out.endsWith('\n')) out += '\n';
      continue;
    }

    if (/\s/.test(ch)) {
      pendingSpace = true;
      if (ch === '\n' && !out.endsWith('\n')) {
        out = out.replace(/[ \t]+$/g, '');
        out += '\n';
        pendingSpace = false;
      }
      continue;
    }

    if (pendingSpace && out && !out.endsWith('\n') && !/[ (,[=<>+\-*/%]$/.test(out) && !/[),.;=<>+\-*/%]/.test(ch)) {
      out += ' ';
    }
    pendingSpace = false;
    out += ch;
  }

  return out
    .split('\n')
    .map(line => line.trim())
    .filter((line, idx, lines) => line || (idx > 0 && idx < lines.length - 1))
    .join('\n')
    .trim();
}

// ─── Relative time ─────────────────────────────────────────────────────────────
function relTime(ts) {
  const d = Date.now() - ts;
  if (d < 60000) return 'just now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  return `${Math.floor(d / 3600000)}h ago`;
}

// ─── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
  /* ── Top schema/table bar ── */
  .sp-top-bar { display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap; padding:0.55rem 0.9rem; background:rgba(0,0,0,0.22); border:1px solid rgba(255,255,255,0.07); border-radius:14px; margin-bottom:0.75rem; min-height:44px; }
  .sp-tbl-chip { display:inline-flex; align-items:center; gap:0.3rem; padding:0.28rem 0.55rem 0.28rem 0.6rem; border-radius:20px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); cursor:pointer; transition:all 0.13s; font-size:0.75rem; color:var(--text-secondary); white-space:nowrap; }
  .sp-tbl-chip.active { background:rgba(99,102,241,0.14); border-color:rgba(99,102,241,0.45); color:#a5b4fc; }
  .sp-tbl-chip:hover { border-color:rgba(99,102,241,0.3); color:var(--text-primary); }
  .sp-bar-sep { width:1px; height:20px; background:rgba(255,255,255,0.1); flex-shrink:0; margin:0 0.15rem; }
  .sp-ccol { display:inline-flex; align-items:center; gap:0.22rem; padding:0.18rem 0.5rem; border-radius:14px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); font-size:0.69rem; color:var(--text-secondary); cursor:pointer; font-family:monospace; transition:background 0.1s; white-space:nowrap; }
  .sp-ccol:hover { background:rgba(99,102,241,0.09); color:#a5b4fc; }
  /* ── Editor/Results split ── */
  .sp-split { display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; align-items:flex-start; }
  /* ── Shared panel/table ── */
  .sp-panel { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:12px; overflow:hidden; }
  .sp-hdr { padding:0.48rem 0.85rem; background:rgba(0,0,0,0.28); border-bottom:1px solid rgba(255,255,255,0.06); font-size:0.69rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.07em; display:flex; align-items:center; gap:0.35rem; }
  .sp-rt { width:100%; border-collapse:collapse; font-size:0.79rem; table-layout:auto; }
  .sp-rt th { padding:0.46rem 0.7rem; background:#1a1a2e; color:#a5b4fc; text-align:left; font-weight:700; border-bottom:2px solid rgba(99,102,241,0.3); white-space:nowrap; position:sticky; top:0; z-index:2; font-size:0.73rem; box-shadow:0 2px 6px rgba(0,0,0,0.5); cursor:pointer; user-select:none; }
  .sp-rt th:hover { background:#1e1e38; }
  .sp-rt th.sp-rn { color:#475569; font-weight:400; width:36px; min-width:36px; cursor:default; }
  .sp-rt td { padding:0.36rem 0.7rem; border-bottom:1px solid rgba(255,255,255,0.04); color:var(--text-primary); max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer; }
  .sp-rt td.expanded { white-space:normal; max-width:none; word-break:break-word; background:rgba(99,102,241,0.04) !important; }
  .sp-rt td.sp-rn { color:#475569; font-size:0.7rem; text-align:right; user-select:none; cursor:default; }
  .sp-rt tbody tr:nth-child(even) td { background:rgba(255,255,255,0.012); }
  .sp-rt tbody tr:hover td { background:rgba(99,102,241,0.06) !important; }
  .sp-rw { overflow:auto; max-height:380px; }
  .sp-preview-rw { overflow:auto; max-height:320px; }
  /* ── Buttons ── */
  .sp-btn { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.09); border-radius:8px; padding:0.34rem 0.65rem; font-size:0.76rem; color:var(--text-secondary); cursor:pointer; display:flex; align-items:center; gap:0.3rem; transition:all 0.13s; white-space:nowrap; }
  .sp-btn:hover { border-color:rgba(99,102,241,0.4); color:#a5b4fc; background:rgba(99,102,241,0.07); }
  .sp-btn:disabled { opacity:0.35; cursor:not-allowed; }
  .sp-btn-ghost { background:none; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:0.34rem 0.65rem; font-size:0.76rem; color:var(--text-secondary); cursor:pointer; display:flex; align-items:center; gap:0.3rem; transition:all 0.13s; white-space:nowrap; }
  .sp-btn-ghost:hover { border-color:rgba(99,102,241,0.35); color:#a5b4fc; }
  .sp-lim-btn { padding:0.2rem 0.55rem; border-radius:6px; border:1px solid rgba(255,255,255,0.09); background:none; font-size:0.72rem; color:var(--text-secondary); cursor:pointer; transition:all 0.12s; }
  .sp-lim-btn.active { background:rgba(99,102,241,0.18); border-color:rgba(99,102,241,0.45); color:#a5b4fc; font-weight:700; }
  .sp-starter { display:flex; align-items:center; gap:0.35rem; padding:0.3rem 0.65rem; border-radius:20px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); font-size:0.74rem; color:var(--text-secondary); cursor:pointer; transition:all 0.13s; white-space:nowrap; max-width:160px; overflow:hidden; text-overflow:ellipsis; }
  .sp-starter:hover { background:rgba(99,102,241,0.1); border-color:rgba(99,102,241,0.35); color:#a5b4fc; }
  .sp-icon-btn { background:none; border:none; color:var(--text-secondary); cursor:pointer; padding:0.3rem; border-radius:7px; display:flex; align-items:center; justify-content:center; transition:all 0.13s; }
  .sp-icon-btn:hover { background:rgba(255,255,255,0.07); color:var(--text-primary); }
  /* ── History/overflow ── */
  .sp-hist-row { padding:0.5rem 0.85rem; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.04); transition:background 0.12s; }
  .sp-hist-row:hover { background:rgba(255,255,255,0.04); }
  .sp-stat-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:1.25rem 1rem; text-align:center; transition:all 0.15s; }
  .sp-stat-card:hover { border-color:rgba(99,102,241,0.35); background:rgba(99,102,241,0.05); }
  .sp-chart-pill { display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:7px; border:1px solid rgba(255,255,255,0.1); background:none; cursor:pointer; transition:all 0.13s; color:var(--text-secondary); }
  .sp-chart-pill:hover { border-color:rgba(99,102,241,0.4); color:#a5b4fc; }
  .sp-chart-pill.active { background:rgba(99,102,241,0.2); border-color:rgba(99,102,241,0.55); color:#a5b4fc; }
  .sp-overflow-menu { position:absolute; top:calc(100% + 6px); left:0; background:#0d0d1a; border:1px solid rgba(99,102,241,0.3); border-radius:10px; padding:0.3rem; min-width:155px; z-index:100; box-shadow:0 8px 32px rgba(0,0,0,0.6); }
  .sp-overflow-item { display:flex; align-items:center; gap:0.5rem; padding:0.42rem 0.7rem; border-radius:7px; font-size:0.78rem; color:var(--text-secondary); cursor:pointer; transition:background 0.1s; white-space:nowrap; }
  .sp-overflow-item:hover { background:rgba(99,102,241,0.13); color:#a5b4fc; }
  .sp-palette-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.65); z-index:1000; display:flex; align-items:flex-start; justify-content:center; padding-top:16vh; }
  .sp-palette { background:#0d0d1a; border:1px solid rgba(99,102,241,0.4); border-radius:14px; width:520px; max-width:92vw; box-shadow:0 24px 80px rgba(0,0,0,0.8); overflow:hidden; }
  .sp-palette-input { width:100%; background:none; border:none; border-bottom:1px solid rgba(255,255,255,0.07); padding:0.9rem 1rem; font-size:0.92rem; color:var(--text-primary); outline:none; }
  .sp-palette-item { display:flex; align-items:center; gap:0.6rem; padding:0.55rem 1rem; cursor:pointer; font-size:0.82rem; color:var(--text-secondary); transition:background 0.08s; }
  .sp-palette-item.active { background:rgba(99,102,241,0.16); color:#a5b4fc; }
  .sp-palette-item:hover { background:rgba(255,255,255,0.04); }
  .sp-palette-cat { padding:0.3rem 1rem; font-size:0.64rem; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#475569; }
  .sp-hist-popover { position:absolute; top:calc(100% + 6px); right:0; background:#0d0d1a; border:1px solid rgba(99,102,241,0.3); border-radius:12px; width:310px; max-height:360px; overflow-y:auto; z-index:100; box-shadow:0 8px 32px rgba(0,0,0,0.6); }
  .sp-skeleton { height:34px; border-radius:6px; background:linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  @keyframes spin { to { transform:rotate(360deg); } }
  .cm-editor { border-radius:0 !important; }
  @media(max-width:900px) { .sp-split { grid-template-columns:1fr; } }
`;

// ─── CodeMirror light theme ─────────────────────────────────────────────────────
const CM_LIGHT_THEME = EditorView.theme({
  '&':                            { background: '#f8fafc', minHeight: '200px' },
  '.cm-scroller':                 { fontFamily: "'Fira Code','JetBrains Mono',monospace", overflow: 'auto' },
  '.cm-content':                  { padding: '1rem 0', minHeight: '200px', color: '#0f172a' },
  '.cm-focused':                  { outline: 'none !important' },
  '.cm-line':                     { padding: '0 1rem', lineHeight: '1.85' },
  '.cm-gutters':                  { background: '#e2e8f0', borderRight: '1px solid #cbd5e1', color: '#94a3b8', paddingRight: '6px' },
  '.cm-activeLineGutter':         { background: '#dde3f0' },
  '.cm-selectionBackground':      { background: '#c7d2fe !important' },
  '.cm-activeLine':               { background: 'rgba(99,102,241,0.06)' },
  '.cm-tooltip-autocomplete':     { background: '#fff !important', border: '1px solid #c7d2fe !important', borderRadius: '10px !important', boxShadow: '0 8px 32px rgba(0,0,0,0.15) !important' },
  '.cm-tooltip-autocomplete ul li':                { padding: '4px 10px !important', fontSize: '0.8rem !important', color: '#0f172a' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { background: 'rgba(99,102,241,0.15) !important', color: '#4338ca !important' },
});

const CM_DARK_THEME = EditorView.theme({
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
});

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function SqlPractice() {
  // ── Core state ─────────────────────────────────────────────────────────────────
  const [tables,         setTables]         = useState([]);
  const [query,          setQuery]          = useState('');
  const [results,        setResults]        = useState(null);
  const [error,          setError]          = useState('');
  const [loading,        setLoading]        = useState(false);
  const [uploading,      setUploading]      = useState(false);
  const [execTime,       setExecTime]       = useState(null);
  const [activeTable,    setActiveTable]    = useState('');
  const [page,           setPage]           = useState(1);
  const [history,        setHistory]        = useState([]);
  const [isDragging,     setIsDragging]     = useState(false);
  const [scratchMode,    setScratchMode]    = useState(false);
  const [previewLimit,   setPreviewLimit]   = useState(10);
  const [previewData,    setPreviewData]    = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError,   setPreviewError]   = useState('');
  const [previewTable,   setPreviewTable]   = useState('');
  // ── UI / chart state ────────────────────────────────────────────────────────────
  const [showChart,      setShowChart]      = useState(false);
  const [chartType,      setChartType]      = useState('bar');
  const [xAxis,          setXAxis]          = useState(null);
  const [yAxis,          setYAxis]          = useState(null);
  // ── Sidebar / toolbar state ─────────────────────────────────────────────────────
  const [showHistory,    setShowHistory]    = useState(false);
  const [showOverflow,   setShowOverflow]   = useState(false);
  const [starterExpanded,setStarterExpanded]= useState(false);
  // ── Results interactivity ───────────────────────────────────────────────────────
  const [sortCol,        setSortCol]        = useState(null);
  const [sortDir,        setSortDir]        = useState('asc');
  const [expandedCell,   setExpandedCell]   = useState(null);
  // ── Cmd+K palette ───────────────────────────────────────────────────────────────
  const [showPalette,    setShowPalette]    = useState(false);
  const [paletteQuery,   setPaletteQuery]   = useState('');
  const [paletteIdx,     setPaletteIdx]     = useState(0);
  // ── Theme ───────────────────────────────────────────────────────────────────────
  const [isDark,         setIsDark]         = useState(() => !document.documentElement.classList.contains('light'));

  // ── Refs ────────────────────────────────────────────────────────────────────────
  const dbRef              = useRef(null);
  const workerRef          = useRef(null);
  const workerReadyRef     = useRef(false);
  const queryMsgIdRef      = useRef(0);
  const previewMsgIdRef    = useRef(0);
  const previewLimitRef    = useRef(10);
  const fileInputRef       = useRef(null);
  const editorContainerRef = useRef(null);
  const editorViewRef      = useRef(null);
  const tablesRef          = useRef(tables);
  const activeTableRef     = useRef(activeTable);
  const runQueryRef        = useRef(null);
  const queryRef           = useRef(query);
  const historyBtnRef      = useRef(null);
  const overflowBtnRef     = useRef(null);
  const paletteInputRef    = useRef(null);

  useEffect(() => { tablesRef.current      = tables; },      [tables]);
  useEffect(() => { activeTableRef.current = activeTable; }, [activeTable]);
  useEffect(() => { queryRef.current       = query; },       [query]);
  useEffect(() => { previewLimitRef.current = previewLimit; }, [previewLimit]);

  // ── Theme observer ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(!document.documentElement.classList.contains('light')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────────────────
  const activeInfo   = useMemo(() => tables.find(t => t.name === activeTable), [tables, activeTable]);
  const starters     = useMemo(() => buildStarters(activeInfo, tables), [activeInfo, tables]);
  const chartAnalysis= useMemo(() => analyzeChart(results), [results]);
  const cData        = useMemo(() => chartData(results), [results]);
  const colTypes     = useMemo(() => activeInfo ? getColumnTypes(activeInfo) : {}, [activeInfo]);
  const filteredCols = useMemo(() => activeInfo ? activeInfo.columns : [], [activeInfo]);

  const sortedValues = useMemo(() => {
    if (!results || !sortCol) return results?.values ?? [];
    const idx = results.columns.indexOf(sortCol);
    if (idx === -1) return results.values;
    const sorted = [...results.values].sort((a, b) => {
      const av = parseFloat(a[idx]), bv = parseFloat(b[idx]);
      const cmp = !isNaN(av) && !isNaN(bv) ? av - bv : String(a[idx] ?? '').localeCompare(String(b[idx] ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [results, sortCol, sortDir]);

  const pagedValues  = useMemo(() => sortedValues.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [sortedValues, page]);
  const totalPages   = useMemo(() => results ? Math.ceil(results.rowCount / PAGE_SIZE) : 1, [results]);

  // Reset sort when results change
  useEffect(() => { setSortCol(null); setSortDir('asc'); setExpandedCell(null); }, [results]);

  // Auto-show chart based on analysis
  useEffect(() => {
    if (chartAnalysis.type) {
      setShowChart(chartAnalysis.autoShow);
      setChartType(chartAnalysis.type);
    } else {
      setShowChart(false);
    }
    if (chartAnalysis.axisConfig) {
      setXAxis(chartAnalysis.axisConfig.x);
      setYAxis(chartAnalysis.axisConfig.y);
    }
  }, [chartAnalysis]);

  // ── WASM warm-up ───────────────────────────────────────────────────────────────
  useEffect(() => { getSqlEngine().catch(() => {}); }, []);

  // ── Cmd+K global shortcut ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowPalette(v => !v); setPaletteQuery(''); setPaletteIdx(0); }
      if (e.key === 'Escape') { setShowPalette(false); setShowHistory(false); setShowOverflow(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => { if (showPalette) setTimeout(() => paletteInputRef.current?.focus(), 30); }, [showPalette]);

  // ── Close popovers on outside click ────────────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      if (showHistory && historyBtnRef.current && !historyBtnRef.current.contains(e.target) && !e.target.closest('.sp-hist-popover')) setShowHistory(false);
      if (showOverflow && overflowBtnRef.current && !overflowBtnRef.current.contains(e.target) && !e.target.closest('.sp-overflow-menu')) setShowOverflow(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showHistory, showOverflow]);

  // ── File handling ───────────────────────────────────────────────────────────────
  const handleFiles = useCallback(async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const parsed = await Promise.all(Array.from(files).map(parseFile));
      const merged = [...tablesRef.current];
      for (const t of parsed) {
        const idx = merged.findIndex(x => x.name === t.name);
        if (idx >= 0) merged[idx] = t; else merged.push(t);
      }
      setTables(merged);
      setActiveTable(merged[0].name);
      setScratchMode(false);
      dbRef.current = null;
      workerReadyRef.current = false;
      setQuery(`SELECT *\nFROM "${parsed[0].name}"\nLIMIT 10;`);
      toast.success(`Loaded ${parsed.map(t => t.name).join(', ')} — ready to query!`);
    } catch (e) {
      toast.error(e.message || 'Could not parse file');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleSampleData = useCallback(async () => {
    setUploading(true);
    try {
      const t = await loadSampleData();
      const merged = [...tablesRef.current];
      const idx = merged.findIndex(x => x.name === t.name);
      if (idx >= 0) merged[idx] = t; else merged.push(t);
      setTables(merged);
      setActiveTable(t.name);
      setScratchMode(false);
      dbRef.current = null;
      workerReadyRef.current = false;
      setQuery(`SELECT *\nFROM "${t.name}"\nLIMIT 10;`);
      toast.success(`Loaded sample pizza sales data — ready to query!`);
    } catch (e) {
      toast.error('Could not load sample data');
    } finally {
      setUploading(false);
    }
  }, []);

  // ── Run SQL ─────────────────────────────────────────────────────────────────────
  const runQuery = useCallback(async (sqlOverride) => {
    let sql = cleanSqlForRun(sqlOverride ?? queryRef.current);
    if (!sql?.trim()) return;
    if (sql !== queryRef.current) setQuery(sql);

    // Auto-fix partial queries that start with a clause keyword instead of SELECT/INSERT/etc.
    const trimmed = sql.trim().toUpperCase();
    const clauseOnly = /^(JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|INNER\s+JOIN|FULL\s+JOIN|CROSS\s+JOIN|ON\s|WHERE\s|GROUP\s+BY|ORDER\s+BY|HAVING\s|UNION\s|LIMIT\s|OFFSET\s)/.test(trimmed);
    if (clauseOnly) {
      const activeT = tablesRef.current.find(t => t.name === activeTableRef.current) || tablesRef.current[0];
      if (activeT) {
        sql = `SELECT *\nFROM "${activeT.name}"\n${sql.trim()}`;
        setQuery(sql);
      }
    }

    queryMsgIdRef.current += 1;
    setLoading(true); setError(''); setResults(null); setPage(1);

    try {
      if (!dbRef.current) dbRef.current = await buildDb(tablesRef.current);

      if (!workerRef.current) {
        workerRef.current = new Worker(getWorkerBlobUrl());
        workerRef.current.onmessage = ({ data }) => { workerRef.current._handlers?.[data.msgId]?.(data); };
        workerRef.current._handlers = {};
      }
      const worker = workerRef.current;
      const send = (msg, transfer = []) => new Promise((resolve, reject) => {
        worker._handlers[msg.msgId] = (data) => {
          delete worker._handlers[msg.msgId];
          if (data.type === 'error') reject(new Error(data.error));
          else resolve(data);
        };
        worker.postMessage(msg, transfer);
      });

      if (!workerReadyRef.current) {
        const initId = ++queryMsgIdRef.current;
        const buf = dbRef.current.export();
        await send({ type: 'init', cdnJs: CDN_JS, cdnWasm: CDN_WASM, buffer: buf.buffer, msgId: initId }, [buf.buffer]);
        workerReadyRef.current = true;
      }

      const execId = ++queryMsgIdRef.current;
      const { res, elapsed, rowsModified, schema } = await send({ type: 'exec', sql, msgId: execId });
      if (execId !== queryMsgIdRef.current) return;

      setExecTime(elapsed);

      // Sync tables state from worker schema (DDL may have added/dropped tables)
      if (schema) {
        setTables(prevTables => {
          const existing = new Map(prevTables.map(t => [t.name, t]));
          const newTables = schema.map(s => {
            if (existing.has(s.name)) {
              const prev = existing.get(s.name);
              return JSON.stringify(prev.columns) !== JSON.stringify(s.columns)
                ? { ...prev, columns: s.columns }
                : prev;
            }
            return { name: s.name, columns: s.columns, rows: [] };
          });
          return newTables;
        });
        setActiveTable(at => {
          const names = new Set(schema.map(s => s.name));
          const next = names.has(at) ? at : (schema[0]?.name || '');
          if (next) setPreviewTable(next);
          else {
            setPreviewTable('');
            setPreviewData(null);
            setPreviewError('');
          }
          setTimeout(() => {
            if (next) runPreview(next, previewLimitRef.current);
          }, 80);
          return next;
        });
      }

      // Determine operation type for user-friendly status
      const upperSql = sql.trim().toUpperCase().replace(/--[^\n]*/g, '').trim();
      const isDDL = /^(CREATE|DROP|ALTER)\s/.test(upperSql);
      const isDML = !isDDL && (rowsModified ?? 0) > 0 && !res?.length;

      if (!res?.length) {
        if (isDDL) {
          const verb = upperSql.startsWith('CREATE TABLE') ? 'Table created'
                     : upperSql.startsWith('CREATE VIEW')  ? 'View created'
                     : upperSql.startsWith('CREATE INDEX') ? 'Index created'
                     : upperSql.startsWith('DROP')         ? 'Dropped successfully'
                     : upperSql.startsWith('ALTER')        ? 'Table altered'
                     : 'Statement executed';
          setResults({ columns: ['Status'], values: [[`✓ ${verb} successfully`]], rowCount: 1, statusOnly: true });
        } else if (isDML) {
          const n = rowsModified ?? 0;
          setResults({ columns: ['Status'], values: [[`✓ ${n} row${n !== 1 ? 's' : ''} affected`]], rowCount: 1, statusOnly: true });
        } else {
          setResults({ columns: [], values: [], rowCount: 0 });
        }
      } else {
        const { columns, values } = res[0];
        setResults({ columns, values, rowCount: values.length });
      }
      setHistory(h => [{ sql, time: elapsed, ts: Date.now(), rowCount: res?.[0]?.values?.length ?? (rowsModified ?? 0) }, ...h].slice(0, 30));
    } catch (e) {
      let msg = e.message || 'Unknown error';
      const knownTables = tablesRef.current.map(t => t.name);
      if (msg.includes('no such table') && knownTables.length) msg = `${msg}. Available tables: ${knownTables.join(', ')}`;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { runQueryRef.current = runQuery; }, [runQuery]);

  // ── Preview runner ───────────────────────────────────────────────────────────────
  const runPreview = useCallback(async (tableName, limit) => {
    if (!tableName) { setPreviewData(null); return; }
    const pid = ++previewMsgIdRef.current;
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const sql = `SELECT * FROM "${tableName}" LIMIT ${limit}`;
      let res;
      if (workerRef.current && workerReadyRef.current) {
        const data = await new Promise((resolve, reject) => {
          const id = 'pv-' + pid;
          workerRef.current._handlers[id] = d => {
            delete workerRef.current._handlers[id];
            if (d.type === 'error') reject(new Error(d.error));
            else resolve(d);
          };
          workerRef.current.postMessage({ type: 'exec', sql, msgId: id });
        });
        res = data.res;
      } else if (dbRef.current) {
        res = dbRef.current.exec(sql);
      }
      if (pid !== previewMsgIdRef.current) return;
      if (res?.length) setPreviewData({ columns: res[0].columns, values: res[0].values, tableName });
      else setPreviewData({ columns: [], values: [], tableName });
    } catch (e) {
      if (pid !== previewMsgIdRef.current) return;
      setPreviewData(null);
      setPreviewError(e?.message || 'Could not refresh data preview.');
    } finally {
      if (pid === previewMsgIdRef.current) setPreviewLoading(false);
    }
  }, []);

  // Sync previewTable with activeTable when it changes
  useEffect(() => {
    if (activeTable) setPreviewTable(activeTable);
  }, [activeTable]);

  // Refresh preview when previewTable or previewLimit changes
  useEffect(() => {
    if (previewTable && tables.some(t => t.name === previewTable)) runPreview(previewTable, previewLimit);
    else {
      setPreviewData(null);
      setPreviewError('');
    }
  }, [previewTable, previewLimit, runPreview, tables]);

  // ── Remove table ────────────────────────────────────────────────────────────────
  const removeTable = useCallback((name) => {
    const updated = tablesRef.current.filter(t => t.name !== name);
    setTables(updated);
    dbRef.current = null;
    workerReadyRef.current = false;
    if (activeTable === name) {
      setActiveTable(updated[0]?.name || '');
      setQuery(updated[0] ? `SELECT *\nFROM "${updated[0].name}"\nLIMIT 10;` : '');
    }
    if (!updated.length) setResults(null);
  }, [activeTable]);

  // ── Starter click ───────────────────────────────────────────────────────────────
  const runStarter = useCallback((sql) => {
    setQuery(sql);
    setTimeout(() => runQueryRef.current?.(sql), 30);
  }, []);

  // ── Column click → insert at cursor ────────────────────────────────────────────
  const insertColumn = useCallback((col) => {
    const view = editorViewRef.current;
    if (!view) return;
    const sel = view.state.selection.main;
    view.dispatch({ changes: { from: sel.from, insert: `"${col}"` }, selection: { anchor: sel.from + col.length + 2 } });
    view.focus();
  }, []);

  // ── Sort ────────────────────────────────────────────────────────────────────────
  const handleSort = useCallback((col) => {
    setSortCol(prev => {
      if (prev !== col) { setSortDir('asc'); return col; }
      setSortDir(d => { if (d === 'asc') return 'desc'; setSortCol(null); return 'asc'; });
      return prev;
    });
    setPage(1);
  }, []);

  // ── ChatGPT ─────────────────────────────────────────────────────────────────────
  const openChatGPT = useCallback(() => {
    const table = activeInfo || tablesRef.current[0];
    if (!table) { toast.error('Upload a file first'); return; }
    const types = getColumnTypes(table);
    const numC  = table.columns.filter(c => ['numeric','currency','percentage'].includes(types[c]));
    const catC  = table.columns.filter(c => types[c] === 'categorical');
    const dateC = table.columns.filter(c => types[c] === 'date');
    const prompt = `I have a SQLite table called "${table.name}" with ${table.rows.length.toLocaleString()} rows.\n\nAll columns: ${table.columns.join(', ')}\n${numC.length ? `Numeric columns: ${numC.join(', ')}` : ''}\n${catC.length ? `Category columns: ${catC.join(', ')}` : ''}\n${dateC.length ? `Date columns: ${dateC.join(', ')}` : ''}\n\nI want to practise SQL. Please give me a list of queries from beginner to advanced, covering SELECT, WHERE, aggregations, GROUP BY, subqueries, CTEs, and window functions. Use the real column and table names.`;
    window.open(`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`, '_blank', 'noopener,noreferrer');
  }, [activeInfo]);

  // ── Cmd+K palette commands ───────────────────────────────────────────────────────
  const paletteCommands = useMemo(() => {
    const cmds = [];
    if (tables.length) {
      cmds.push({ cat: 'Tables', label: `Switch to ${activeTable}`, icon: Table, action: () => {} });
      for (const t of tables) cmds.push({ cat: 'Tables', label: t.name, icon: Table, action: () => { setActiveTable(t.name); setShowPalette(false); } });
    }
    for (const s of starters) cmds.push({ cat: 'Quick queries', label: s.label, icon: s.icon, action: () => { runStarter(s.sql); setShowPalette(false); } });
    cmds.push({ cat: 'Actions', label: 'Format SQL', icon: Zap, action: () => { setQuery(formatSQL(queryRef.current)); setShowPalette(false); } });
    cmds.push({ cat: 'Actions', label: 'Clear results', icon: X, action: () => { setResults(null); setError(''); setShowPalette(false); } });
    if (results) {
      cmds.push({ cat: 'Actions', label: 'Export CSV', icon: Download, action: () => { exportCSV(results); setShowPalette(false); } });
      cmds.push({ cat: 'Actions', label: 'Export JSON', icon: Download, action: () => { exportJSON(results); setShowPalette(false); } });
      if (chartAnalysis.type) cmds.push({ cat: 'Actions', label: showChart ? 'Hide chart' : 'Show chart', icon: BarChart2, action: () => { setShowChart(v => !v); setShowPalette(false); } });
    }
    cmds.push({ cat: 'Help', label: 'Ask ChatGPT for queries', icon: ExternalLink, action: () => { openChatGPT(); setShowPalette(false); } });
    return cmds;
  }, [tables, starters, results, showChart, chartAnalysis, activeTable, openChatGPT, runStarter]);

  const filteredCmds = useMemo(() => {
    if (!paletteQuery) return paletteCommands.filter((_, i) => i < 10);
    const q = paletteQuery.toLowerCase();
    return paletteCommands.filter(c => c.label.toLowerCase().includes(q) || c.cat.toLowerCase().includes(q)).slice(0, 12);
  }, [paletteCommands, paletteQuery]);

  // ── CodeMirror setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!editorContainerRef.current || editorViewRef.current) return;

    const customCompletion = ctx => {
      const word = ctx.matchBefore(/[\w.]*/);
      if (!word || (word.from === word.to && !ctx.explicit)) return null;
      const before = ctx.state.doc.sliceString(0, word.from).toUpperCase().trimEnd();
      const lastKw = before.match(/\b(SELECT|FROM|JOIN|WHERE|AND|OR|GROUP\s+BY|ORDER\s+BY|HAVING|ON|SET)\s*[\w\s,"`.]*?$/)?.[1]?.replace(/\s+/g, ' ');
      const fromCtx = lastKw === 'FROM' || lastKw === 'JOIN';
      const selCtx  = ['SELECT','WHERE','AND','OR','GROUP BY','ORDER BY','HAVING','ON','SET'].includes(lastKw);

      // Parse table aliases from FROM/JOIN clauses for alias.column completion
      const fullDocBefore = ctx.state.doc.sliceString(0, word.from);
      const aliases = new Map(); // alias -> table name
      // Match: FROM "table" alias, FROM table AS alias, JOIN "table" alias, etc.
      const aliasRegex = /(?:FROM|JOIN|INNER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|FULL\s+JOIN|CROSS\s+JOIN)\s+["']?([a-zA-Z_]\w*)["']?\s+(?:AS\s+)?([a-zA-Z_]\w*)/gi;
      for (const match of fullDocBefore.matchAll(aliasRegex)) {
        const tbl = match[1];
        const alias = match[2];
        const table = tablesRef.current.find(t => t.name.toLowerCase() === tbl.toLowerCase());
        if (table) aliases.set(alias.toUpperCase(), table.name);
      }

      // Check if typing "alias.column"
      const wordStr = word ? ctx.state.doc.sliceString(word.from, word.to) : '';
      const dotMatch = wordStr.match(/^([a-zA-Z_]\w*)\.(.*)$/);
      const aliasPrefix = dotMatch?.[1]?.toUpperCase();
      const colPrefix = dotMatch?.[2]?.toLowerCase() || '';

      const opts = [];

      if (dotMatch && aliases.has(aliasPrefix)) {
        const table = tablesRef.current.find(t => t.name === aliases.get(aliasPrefix));
        const options = (table?.columns || [])
          .filter(c => c.toLowerCase().startsWith(colPrefix))
          .map(c => ({ label: c, apply: sqlIdentifierApply(c), type: 'property', detail: table.name, boost: 50 }));
        return { from: word.from + aliasPrefix.length + 1, options, validFor: /^[\w]*$/ };
      }

      // Snippets and higher-level query patterns.
      for (const s of SQL_SNIPPETS) opts.push({ ...s, type: 'text', boost: 45 });

      // Aliases and columns are most useful in expression contexts.
      for (const [alias, tbl] of aliases) opts.push({ label: alias, apply: `${alias}.`, type: 'variable', detail: `alias for ${tbl}`, boost: 35 });
      if (selCtx || ctx.explicit) {
        for (const t of tablesRef.current) {
          for (const c of t.columns) opts.push({ label: c, apply: sqlIdentifierApply(c), type: 'property', detail: t.name, boost: 25 });
        }
      }

      // Context-specific suggestions
      if (fromCtx || ctx.explicit) for (const t of tablesRef.current) opts.push({ label: t.name, apply: sqlIdentifierApply(t.name), type: 'class', detail: `${t.rows?.length ?? ''} rows`, boost: 30 });

      // Keywords (lowest priority)
      for (const kw of SQL_KW) opts.push({ label: kw, type: 'keyword', boost: 1 });

      return { from: word.from, options: opts, validFor: /^[\w.]*$/ };
    };

    const view = new EditorView({
      state: EditorState.create({
        doc: queryRef.current,
        extensions: [
          sqlLang(), isDark ? oneDark : [], isDark ? CM_DARK_THEME : CM_LIGHT_THEME,
          lineNumbers(), highlightActiveLine(),
          closeBrackets(),
          ...buildGhostExt(tablesRef),
          autocompletion({ override: [customCompletion], activateOnTyping: true, maxRenderedOptions: 14 }),
          keymap.of([
            ...closeBracketsKeymap, ...completionKeymap, ...defaultKeymap,
            { key: 'Ctrl-Enter', run: () => { runQueryRef.current?.(); return true; } },
            { key: 'Mod-Enter',  run: () => { runQueryRef.current?.(); return true; } },
            { key: 'Shift-Enter', run: () => { runQueryRef.current?.(); return true; } },
          ]),
          EditorView.updateListener.of(u => { if (u.docChanged) setQuery(u.state.doc.toString()); }),
        ],
      }),
      parent: editorContainerRef.current,
    });
    editorViewRef.current = view;
    return () => { view.destroy(); editorViewRef.current = null; };
  // Recreate when table presence, scratch mode, or theme changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!tables.length, scratchMode, isDark]);

  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;
    if (view.state.doc.toString() !== query)
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: query } });
  }, [query]);

  // ── CHART RENDERER ──────────────────────────────────────────────────────────────
  const TOOLTIP_STYLE = { background: isDark ? '#12121e' : '#fff', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, fontSize: '0.76rem' };

  function renderChart(type) {
    if (!cData.length) return null;
    const col0 = results.columns[0], col1 = results.columns[1];
    const axX  = xAxis ?? col0, axY = yAxis ?? col1;

    if (type === 'histogram') {
      const bins = buildHistogramBins(results.values, 0);
      return (
        <BarChart data={bins} margin={{ top:5, right:16, left:0, bottom:10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
          <XAxis dataKey="range" tick={{ fill:'#64748b', fontSize:10 }}/>
          <YAxis tick={{ fill:'#64748b', fontSize:11 }} tickFormatter={fmtNum}/>
          <Tooltip contentStyle={TOOLTIP_STYLE}/>
          <Bar dataKey="count" fill="#6366f1" radius={[3,3,0,0]}/>
        </BarChart>
      );
    }
    if (type === 'donut') {
      return (
        <PieChart>
          <Pie data={cData} dataKey={col1} nameKey={col0} cx="50%" cy="50%" innerRadius={44} outerRadius={78}
            label={({ name, percent }) => `${String(name).slice(0,12)} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
            {cData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]}/>)}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE}/>
        </PieChart>
      );
    }
    if (type === 'hbar') {
      return (
        <BarChart data={cData} layout="vertical" margin={{ top:5, right:24, left:0, bottom:5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false}/>
          <XAxis type="number" tick={{ fill:'#64748b', fontSize:11 }} tickFormatter={fmtNum}/>
          <YAxis type="category" dataKey={col0} tick={{ fill:'#64748b', fontSize:11 }} width={110}/>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [fmtNum(+v), col1]}/>
          <Bar dataKey={col1} radius={[0,4,4,0]}>
            {cData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]}/>)}
          </Bar>
        </BarChart>
      );
    }
    if (type === 'scatter') {
      return (
        <ScatterChart margin={{ top:5, right:16, left:0, bottom:5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
          <XAxis dataKey={axX} name={axX} tick={{ fill:'#64748b', fontSize:11 }} tickFormatter={fmtNum}/>
          <YAxis dataKey={axY} name={axY} tick={{ fill:'#64748b', fontSize:11 }} tickFormatter={fmtNum}/>
          <ZAxis range={[40, 40]}/>
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ strokeDasharray:'3 3' }}/>
          <Scatter data={cData} fill="#6366f1" fillOpacity={0.75}/>
        </ScatterChart>
      );
    }
    if (type === 'bubble') {
      const sizeKey = chartAnalysis.axisConfig?.size ?? results.columns[2];
      return (
        <ScatterChart margin={{ top:5, right:16, left:0, bottom:5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
          <XAxis dataKey={axX} name={axX} tick={{ fill:'#64748b', fontSize:11 }} tickFormatter={fmtNum}/>
          <YAxis dataKey={axY} name={axY} tick={{ fill:'#64748b', fontSize:11 }} tickFormatter={fmtNum}/>
          <ZAxis dataKey={sizeKey} range={[45, 420]} name={sizeKey}/>
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ strokeDasharray:'3 3' }}/>
          <Scatter data={cData} fill="#6366f1" fillOpacity={0.65}/>
        </ScatterChart>
      );
    }
    if (type === 'grouped-bar' || type === 'stacked-series') {
      const { data, keys } = seriesChartData(cData, chartAnalysis.axisConfig);
      if (!data.length || !keys.length) return null;
      return (
        <BarChart data={data} margin={{ top:5, right:16, left:0, bottom:28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
          <XAxis dataKey={chartAnalysis.axisConfig.x} tick={{ fill:'#64748b', fontSize:11 }} angle={-30} textAnchor="end" interval={0}/>
          <YAxis tick={{ fill:'#64748b', fontSize:11 }} tickFormatter={fmtNum}/>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => fmtNum(+v)}/>
          <Legend/>
          {keys.map((key, i) => (
            <Bar key={key} dataKey={key} stackId={type === 'stacked-series' ? 'series' : undefined} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={type === 'stacked-series' ? [0,0,0,0] : [4,4,0,0]}/>
          ))}
        </BarChart>
      );
    }
    if (type === 'series-line') {
      const { data, keys } = seriesChartData(cData, chartAnalysis.axisConfig);
      if (!data.length || !keys.length) return null;
      return (
        <LineChart data={data} margin={{ top:5, right:16, left:0, bottom:28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
          <XAxis dataKey={chartAnalysis.axisConfig.x} tick={{ fill:'#64748b', fontSize:11 }} angle={-30} textAnchor="end" interval="preserveStartEnd"/>
          <YAxis tick={{ fill:'#64748b', fontSize:11 }} tickFormatter={fmtNum}/>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => fmtNum(+v)}/>
          <Legend/>
          {keys.map((key, i) => (
            <Line key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={data.length < 24}/>
          ))}
        </LineChart>
      );
    }
    if (type === 'area') {
      return (
        <AreaChart data={cData} margin={{ top:5, right:16, left:0, bottom:28 }}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
          <XAxis dataKey={axX} tick={{ fill:'#64748b', fontSize:11 }} angle={-30} textAnchor="end" interval="preserveStartEnd"/>
          <YAxis tick={{ fill:'#64748b', fontSize:11 }} tickFormatter={fmtNum}/>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [fmtNum(+v), axY]}/>
          <Area type="monotone" dataKey={axY} stroke="#6366f1" strokeWidth={2} fill="url(#areaGrad)" dot={cData.length < 20}/>
        </AreaChart>
      );
    }
    if (type === 'multiline') {
      const y2 = chartAnalysis.axisConfig?.y2 ?? results.columns[2];
      return (
        <LineChart data={cData} margin={{ top:5, right:16, left:0, bottom:28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
          <XAxis dataKey={axX} tick={{ fill:'#64748b', fontSize:11 }} angle={-30} textAnchor="end" interval="preserveStartEnd"/>
          <YAxis tick={{ fill:'#64748b', fontSize:11 }} tickFormatter={fmtNum}/>
          <Tooltip contentStyle={TOOLTIP_STYLE}/>
          <Legend/>
          <Line type="monotone" dataKey={axY} stroke="#6366f1" strokeWidth={2} dot={cData.length < 20}/>
          <Line type="monotone" dataKey={y2} stroke="#10b981" strokeWidth={2} dot={cData.length < 20}/>
        </LineChart>
      );
    }
    if (type === 'stacked-bar') {
      const y2 = chartAnalysis.axisConfig?.y2 ?? results.columns[2];
      return (
        <BarChart data={cData} margin={{ top:5, right:16, left:0, bottom:28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
          <XAxis dataKey={axX} tick={{ fill:'#64748b', fontSize:11 }} angle={-30} textAnchor="end" interval={0}/>
          <YAxis tick={{ fill:'#64748b', fontSize:11 }} tickFormatter={fmtNum}/>
          <Tooltip contentStyle={TOOLTIP_STYLE}/>
          <Legend/>
          <Bar dataKey={axY} stackId="a" fill="#6366f1" radius={[0,0,0,0]}/>
          <Bar dataKey={y2} stackId="a" fill="#10b981" radius={[4,4,0,0]}/>
        </BarChart>
      );
    }
    // line (default time-series)
    if (type === 'line') {
      return (
        <LineChart data={cData} margin={{ top:5, right:16, left:0, bottom:28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
          <XAxis dataKey={axX} tick={{ fill:'#64748b', fontSize:11 }} angle={-30} textAnchor="end" interval="preserveStartEnd"/>
          <YAxis tick={{ fill:'#64748b', fontSize:11 }} tickFormatter={fmtNum}/>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [fmtNum(+v), axY]}/>
          <Line type="monotone" dataKey={axY} stroke="#6366f1" strokeWidth={2} dot={cData.length < 30}/>
        </LineChart>
      );
    }
    // bar (default)
    return (
      <BarChart data={cData} margin={{ top:5, right:16, left:0, bottom:28 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
        <XAxis dataKey={axX} tick={{ fill:'#64748b', fontSize:11 }} angle={-30} textAnchor="end" interval={0}/>
        <YAxis tick={{ fill:'#64748b', fontSize:11 }} tickFormatter={fmtNum}/>
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [fmtNum(+v), axY]}/>
        <Bar dataKey={axY} radius={[4,4,0,0]}>
          {cData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]}/>)}
        </Bar>
      </BarChart>
    );
  }

  // ── Stat Cards renderer ─────────────────────────────────────────────────────────
  function renderStatCards() {
    if (!results || !results.values.length) return null;
    const row = results.values[0];
    const cols = results.columns;
    return (
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(cols.length, 4)}, 1fr)`, gap:'1rem', padding:'1.25rem' }}>
        {cols.map((col, i) => {
          const val = row[i];
          const num = parseFloat(val);
          const lower = col.toLowerCase();
          const Icon = lower.includes('count') || lower.includes('total_rows') ? Hash
                     : lower.includes('max') ? ArrowUp
                     : lower.includes('min') ? ArrowDown
                     : lower.includes('sum') || lower.includes('total') ? TrendingUp
                     : null;
          return (
            <div key={col} className="sp-stat-card">
              {Icon && <Icon size={18} style={{ color:'#6366f1', marginBottom:'0.5rem', display:'block', margin:'0 auto 0.5rem' }}/>}
              <div style={{ fontSize:'0.69rem', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'0.5rem' }}>{col}</div>
              <div style={{ fontSize:'1.75rem', fontWeight:800, color:'var(--text-primary)', lineHeight:1, letterSpacing:'-0.02em' }}>{isNaN(num) ? String(val ?? '—') : fmtNum(num)}</div>
            </div>
          );
        })}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ── UPLOAD SCREEN ────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  if (!tables.length && !scratchMode) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
        <ToolHeader title="SQL Practice" description="Upload any CSV or Excel file and start querying instantly — 100% in your browser, nothing uploaded to a server." icon={Database} toolId="sql-practice"/>

        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}
          style={{ maxWidth:520, margin:'2.5rem auto' }}>

          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border:`2px dashed ${isDragging ? '#6366f1' : 'rgba(99,102,241,0.4)'}`,
              borderRadius:22, padding:'5rem 2.5rem', textAlign:'center', cursor:'pointer',
              background: isDragging ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
              transition:'all 0.2s',
            }}>
            <motion.div animate={{ y: isDragging ? -8 : 0, scale: isDragging ? 1.04 : 1 }} transition={{ type:'spring', stiffness:260 }}>
              <div style={{ width:72, height:72, borderRadius:20, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.35rem', boxShadow:'0 8px 32px rgba(99,102,241,0.4)' }}>
                <Upload size={30} color="#fff"/>
              </div>
              <h3 style={{ fontSize:'1.2rem', fontWeight:700, marginBottom:'0.5rem', color:'var(--text-primary)' }}>
                {uploading ? 'Loading…' : 'Drop your CSV or Excel file here'}
              </h3>
              <p style={{ color:'var(--text-secondary)', fontSize:'0.88rem', marginBottom:'1.25rem' }}>
                Or click to browse · your data never leaves this browser
              </p>
              <div style={{ display:'flex', gap:'0.5rem', justifyContent:'center', flexWrap:'wrap' }}>
                {['.csv', '.xlsx', '.xls'].map(ext => (
                  <span key={ext} style={{ padding:'0.28rem 0.7rem', borderRadius:20, background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.28)', fontSize:'0.76rem', color:'#a5b4fc' }}>{ext}</span>
                ))}
              </div>
            </motion.div>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" multiple hidden onChange={e => handleFiles(e.target.files)}/>

          <div style={{ textAlign:'center', marginTop:'1.1rem', display:'flex', gap:'1.5rem', justifyContent:'center', flexWrap:'wrap' }}>
            <button onClick={handleSampleData} disabled={uploading}
              style={{ background:'none', border:'none', color:'var(--text-secondary)', cursor:'pointer', fontSize:'0.84rem', textDecoration:'underline', textUnderlineOffset:3, opacity: uploading ? 0.5 : 1, transition:'color 0.15s' }}
              onMouseOver={e => e.currentTarget.style.color='#a5b4fc'}
              onMouseOut={e => e.currentTarget.style.color='var(--text-secondary)'}>
              Try with sample data →
            </button>
            <button onClick={() => {
              setScratchMode(true);
              setQuery('');
            }} disabled={uploading}
              style={{ background:'none', border:'none', color:'var(--text-secondary)', cursor:'pointer', fontSize:'0.84rem', textDecoration:'underline', textUnderlineOffset:3, transition:'color 0.15s' }}
              onMouseOver={e => e.currentTarget.style.color='#a5b4fc'}
              onMouseOut={e => e.currentTarget.style.color='var(--text-secondary)'}>
              Write SQL from scratch →
            </button>
          </div>
        </motion.div>

        <RelatedTools currentToolId="sql-practice" category="utilities"/>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ── MAIN IDE ─────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  const visibleStarters = starterExpanded ? starters : starters.slice(0, 4);

  return (
    <div style={{ maxWidth:1300, margin:'0 auto', padding:'1.25rem 1rem' }}>
      <style>{CSS}</style>

      {/* ── Cmd+K Palette ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showPalette && (
          <motion.div className="sp-palette-backdrop" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowPalette(false); }}>
            <motion.div className="sp-palette" initial={{ y:-20, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:-10, opacity:0 }}>
              <input ref={paletteInputRef} className="sp-palette-input" placeholder="Search commands…"
                value={paletteQuery} onChange={e => { setPaletteQuery(e.target.value); setPaletteIdx(0); }}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setPaletteIdx(i => Math.min(i+1, filteredCmds.length-1)); }
                  if (e.key === 'ArrowUp')   { e.preventDefault(); setPaletteIdx(i => Math.max(i-1, 0)); }
                  if (e.key === 'Enter')     { filteredCmds[paletteIdx]?.action(); }
                  if (e.key === 'Escape')    { setShowPalette(false); }
                }}/>
              <div style={{ maxHeight:320, overflowY:'auto', padding:'0.3rem 0' }}>
                {filteredCmds.length === 0 && <div style={{ padding:'1rem', textAlign:'center', color:'var(--text-secondary)', fontSize:'0.82rem' }}>No commands found</div>}
                {filteredCmds.map((cmd, i) => {
                  const showCat = i === 0 || filteredCmds[i-1].cat !== cmd.cat;
                  return (
                    <React.Fragment key={`${cmd.cat}-${cmd.label}`}>
                      {showCat && <div className="sp-palette-cat">{cmd.cat}</div>}
                      <div className={`sp-palette-item${i === paletteIdx ? ' active' : ''}`}
                        onClick={cmd.action} onMouseEnter={() => setPaletteIdx(i)}>
                        <cmd.icon size={13} style={{ flexShrink:0, opacity:0.7 }}/>
                        {cmd.label}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
              <div style={{ padding:'0.45rem 1rem', borderTop:'1px solid rgba(255,255,255,0.06)', fontSize:'0.66rem', color:'#475569', display:'flex', gap:'0.9rem' }}>
                <span>↑↓ navigate</span><span>↵ run</span><span>Esc close</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOP BAR: Schema + Tables ────────────────────────────────────────────── */}
      <div className="sp-top-bar">
        {/* Table chips */}
        {tables.map(t => (
          <div key={t.name} className={`sp-tbl-chip${activeTable===t.name?' active':''}`}
            onClick={() => setActiveTable(t.name)}>
            <Table size={11} style={{ flexShrink:0 }}/>
            <span style={{ fontWeight:600 }}>{t.name}</span>
            <span style={{ fontSize:'0.66rem', opacity:0.6 }}>({(t.rows?.length ?? 0).toLocaleString()})</span>
            <button onClick={e => { e.stopPropagation(); removeTable(t.name); }}
              style={{ background:'none', border:'none', color:'inherit', cursor:'pointer', padding:'0 0 0 2px', lineHeight:0, opacity:0.55 }}
              title="Remove">
              <X size={10}/>
            </button>
          </div>
        ))}

        {/* Divider + column chips for active table */}
        {activeInfo && activeInfo.columns.length > 0 && (
          <>
            <div className="sp-bar-sep"/>
            <div style={{ display:'flex', gap:'0.3rem', flexWrap:'wrap', alignItems:'center' }}>
              {filteredCols.slice(0, 10).map(col => {
                const type = colTypes[col] || 'categorical';
                return (
                  <span key={col} className="sp-ccol" onClick={() => insertColumn(col)} title={`Insert "${col}"`}>
                    <span style={{ color:TYPE_COLOR[type], fontWeight:700, fontSize:'0.65rem' }}>{TYPE_LABEL[type]}</span>
                    {col}
                  </span>
                );
              })}
              {activeInfo.columns.length > 10 && (
                <span style={{ fontSize:'0.69rem', color:'var(--text-secondary)', opacity:0.7 }}>
                  +{activeInfo.columns.length - 10} cols
                </span>
              )}
            </div>
          </>
        )}

        {/* Right-aligned controls */}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.35rem' }}>
          <button className="sp-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ padding:'0.28rem 0.6rem' }}>
            <Upload size={12}/>{uploading ? 'Loading…' : 'Add File'}
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" multiple hidden onChange={e => handleFiles(e.target.files)}/>

          {/* History */}
          <div style={{ position:'relative' }}>
            <button ref={historyBtnRef} className="sp-icon-btn" onClick={() => setShowHistory(v => !v)} title="Query history">
              <Clock size={15}/>
            </button>
            <AnimatePresence>
              {showHistory && (
                <motion.div className="sp-hist-popover" initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-4 }}>
                  <div className="sp-hdr" style={{ borderRadius:0 }}>Query history</div>
                  {history.length === 0
                    ? <p style={{ padding:'1rem', fontSize:'0.8rem', color:'var(--text-secondary)', textAlign:'center' }}>No queries yet</p>
                    : history.map((h, i) => (
                      <div key={i} className="sp-hist-row" onClick={() => { setQuery(h.sql); setShowHistory(false); }}>
                        <div style={{ fontSize:'0.78rem', color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'monospace' }}>
                          {h.sql.replace(/\s+/g, ' ').slice(0, 55)}{h.sql.length > 55 ? '…' : ''}
                        </div>
                        <div style={{ display:'flex', gap:'0.6rem', marginTop:'0.2rem', fontSize:'0.68rem', color:'var(--text-secondary)' }}>
                          <span>{h.rowCount.toLocaleString()} rows</span>
                          <span>{h.time}ms</span>
                          <span style={{ marginLeft:'auto' }}>{relTime(h.ts)}</span>
                        </div>
                      </div>
                    ))
                  }
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Overflow menu */}
          <div style={{ position:'relative' }}>
            <button ref={overflowBtnRef} className="sp-icon-btn" onClick={() => setShowOverflow(v => !v)} title="More options">
              <MoreHorizontal size={15}/>
            </button>
            <AnimatePresence>
              {showOverflow && (
                <motion.div className="sp-overflow-menu" style={{ left:'auto', right:0 }} initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-4 }}>
                  <div className="sp-overflow-item" onClick={() => { navigator.clipboard.writeText(queryRef.current); setShowOverflow(false); toast.success('Copied!'); }}>
                    <Copy size={12}/> Copy SQL
                  </div>
                  {results && results.rowCount > 0 && !results.statusOnly && <>
                    <div className="sp-overflow-item" onClick={() => { exportCSV(results); setShowOverflow(false); }}>
                      <Download size={12}/> Export CSV
                    </div>
                    <div className="sp-overflow-item" onClick={() => { exportJSON(results); setShowOverflow(false); }}>
                      <Download size={12}/> Export JSON
                    </div>
                  </>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Ctrl+K palette */}
          <button className="sp-icon-btn" onClick={() => { setShowPalette(true); setPaletteQuery(''); setPaletteIdx(0); }} title="Command palette (Ctrl+K)">
            <Command size={15}/>
          </button>

          {/* ChatGPT */}
          <button className="sp-icon-btn" onClick={openChatGPT} title="Ask ChatGPT for practice queries">
            <ExternalLink size={15}/>
          </button>
        </div>
      </div>

      {/* ── MIDDLE: Editor LEFT + Results RIGHT ─────────────────────────────────── */}
      <div className="sp-split">

        {/* ── LEFT: SQL Editor ─────────────────────────────────────────────────── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem', minWidth:0 }}>

          {/* Editor panel */}
          <div className="sp-panel">
            <div className="sp-hdr" style={{ justifyContent:'space-between' }}>
              <span style={{ display:'flex', alignItems:'center', gap:'0.35rem' }}><Database size={10}/> SQL Editor</span>
              <span style={{ fontSize:'0.63rem', opacity:0.5, fontWeight:400, textTransform:'none', letterSpacing:0 }}>Shift+Enter or Ctrl+Enter to run · Tab accepts hint</span>
            </div>
            <div ref={editorContainerRef} style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', minHeight:220 }}/>
            {/* Run bar */}
            <div style={{ display:'flex', alignItems:'center', gap:'0.55rem', padding:'0.45rem 0.75rem', background:'rgba(0,0,0,0.18)', flexWrap:'wrap' }}>
              <button onClick={() => runQuery()} disabled={loading} title="Run query (Shift+Enter or Ctrl+Enter)"
                style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.44rem 1.2rem',
                  background: loading ? 'rgba(99,102,241,0.35)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  border:'none', borderRadius:8, cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize:'0.88rem', fontWeight:700, color:'#fff',
                  boxShadow: loading ? 'none' : '0 2px 12px rgba(99,102,241,0.4)', transition:'all 0.14s' }}>
                {loading ? <><RefreshCw size={13} style={{ animation:'spin 0.9s linear infinite' }}/> Running…</> : <><Play size={13}/> Run</>}
              </button>
              <button className="sp-btn-ghost" onClick={() => setQuery(formatSQL(queryRef.current))} title="Auto-format SQL" style={{ padding:'0.3rem 0.6rem' }}>
                <Zap size={12}/> Format
              </button>
              {execTime && !error && (
                <span style={{ fontSize:'0.71rem', color:'var(--text-secondary)', display:'flex', alignItems:'center', gap:'0.25rem' }}>
                  <Clock size={11}/>{execTime}ms
                </span>
              )}
              {results && !results.statusOnly && (
                <span style={{ fontSize:'0.71rem', color:'var(--text-secondary)', marginLeft:'auto' }}>
                  {results.rowCount.toLocaleString()} row{results.rowCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Starter pills */}
          {starters.length > 0 && (
            <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap', alignItems:'center' }}>
              {visibleStarters.map(s => (
                <button key={s.label} className="sp-starter" onClick={() => runStarter(s.sql)} title={s.label}>
                  <s.icon size={11}/>{s.label.slice(0, 20)}{s.label.length > 20 ? '…' : ''}
                </button>
              ))}
              {starters.length > 4 && (
                <button className="sp-starter" onClick={() => setStarterExpanded(v => !v)}
                  style={{ background:'none', border:'1px dashed rgba(255,255,255,0.12)', color:'var(--text-secondary)' }}>
                  {starterExpanded ? '← less' : `+${starters.length - 4} more`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Results ──────────────────────────────────────────────────── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem', minWidth:0 }}>

          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', borderLeft:'3px solid #ef4444', background:'rgba(239,68,68,0.06)', padding:'0.5rem 0.85rem', borderRadius:'0 6px 6px 0', fontFamily:'monospace', fontSize:'0.8rem', color:'#f87171', gap:'0.5rem' }}>
                <span style={{ flex:1, wordBreak:'break-word' }}>{error}</span>
                <button onClick={() => setError('')} style={{ background:'none', border:'none', color:'#f87171', cursor:'pointer', padding:0, lineHeight:0, flexShrink:0 }}>✕</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Skeleton loader */}
          {loading && !results && (
            <div className="sp-panel" style={{ padding:'0.75rem' }}>
              {[0,1,2,3].map(i => (
                <div key={i} className="sp-skeleton" style={{ marginBottom: i < 3 ? '0.5rem' : 0, animationDelay:`${i * 0.12}s` }}/>
              ))}
            </div>
          )}

          {/* Visualize pill */}
          {results && chartAnalysis.type && !chartAnalysis.autoShow && !showChart && (
            <button className="sp-starter" onClick={() => setShowChart(true)}
              style={{ alignSelf:'flex-start', border:'1px solid rgba(99,102,241,0.35)', color:'#a5b4fc', background:'rgba(99,102,241,0.07)' }}>
              <BarChart2 size={11}/> Visualize →
            </button>
          )}

          {/* Results panel */}
          <AnimatePresence>
            {results && (
              <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} className="sp-panel">
                <div className="sp-hdr" style={{ justifyContent:'space-between' }}>
                  <span>Results — {results.rowCount.toLocaleString()} row{results.rowCount !== 1 ? 's' : ''}</span>
                  <div style={{ display:'flex', gap:'0.4rem', alignItems:'center' }}>
                    {chartAnalysis.type && chartAnalysis.type !== 'stat-cards' && (
                      <button className="sp-btn" style={{ padding:'0.18rem 0.5rem', fontSize:'0.68rem' }} onClick={() => setShowChart(v => !v)}>
                        <BarChart2 size={10}/>{showChart ? 'Hide chart' : 'Show chart'}
                      </button>
                    )}
                    {results.rowCount > 0 && !results.statusOnly && (
                      <button className="sp-btn" style={{ padding:'0.18rem 0.5rem', fontSize:'0.68rem' }} onClick={() => exportCSV(results)}>
                        <Download size={10}/> CSV
                      </button>
                    )}
                  </div>
                </div>

                {chartAnalysis.type === 'stat-cards' && renderStatCards()}

                {chartAnalysis.type !== 'stat-cards' && (
                  <AnimatePresence>
                    {showChart && cData.length > 0 && (
                      <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                        style={{ padding:'0.75rem 1rem', borderBottom:'1px solid rgba(255,255,255,0.06)', overflow:'hidden' }}>
                        {chartAnalysis.caption && (
                          <div style={{ fontSize:'0.78rem', color:'var(--text-secondary)', marginBottom:'0.5rem', fontStyle:'italic' }}>
                            {chartAnalysis.caption}
                          </div>
                        )}
                        {chartAnalysis.altTypes.length > 0 && (
                          <div style={{ display:'flex', gap:'0.3rem', marginBottom:'0.5rem', alignItems:'center' }}>
                            {[chartAnalysis.type, ...chartAnalysis.altTypes].map(t => {
                              const icons = { bar:BarChart2, hbar:BarChart2, line:TrendingUp, area:TrendingUp, donut:Search, scatter:Search, bubble:Search, histogram:BarChart2, multiline:TrendingUp, 'stacked-bar':BarChart2, 'grouped-bar':BarChart2, 'stacked-series':BarChart2, 'series-line':TrendingUp };
                              const Icon = icons[t] || BarChart2;
                              return (
                                <button key={t} className={`sp-chart-pill${chartType===t?' active':''}`} onClick={() => setChartType(t)} title={t}>
                                  <Icon size={12}/>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {chartAnalysis.axisConfig && (
                          <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.5rem', alignItems:'center', fontSize:'0.74rem', color:'var(--text-secondary)' }}>
                            <span>X:</span>
                            <select value={xAxis ?? ''} onChange={e => setXAxis(e.target.value)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:5, padding:'0.15rem 0.35rem', fontSize:'0.74rem', color:'var(--text-primary)' }}>
                              {results.columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <span>Y:</span>
                            <select value={yAxis ?? ''} onChange={e => setYAxis(e.target.value)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:5, padding:'0.15rem 0.35rem', fontSize:'0.74rem', color:'var(--text-primary)' }}>
                              {results.columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            {chartAnalysis.axisConfig.y2 && <span>Y2: {chartAnalysis.axisConfig.y2}</span>}
                            {chartAnalysis.axisConfig.series && <span>Series: {chartAnalysis.axisConfig.series}</span>}
                            {chartAnalysis.axisConfig.size && <span>Size: {chartAnalysis.axisConfig.size}</span>}
                          </div>
                        )}
                        <ResponsiveContainer width="100%" height={210}>
                          {renderChart(chartType) || <div/>}
                        </ResponsiveContainer>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}

                {chartAnalysis.type !== 'stat-cards' && (
                  results.columns.length === 0 ? (
                    <p style={{ padding:'1rem 1.25rem', color:'var(--text-secondary)', fontSize:'0.84rem' }}>Query ran successfully — no rows returned.</p>
                  ) : results.statusOnly ? (
                    <p style={{ padding:'1rem 1.25rem', color:'#10b981', fontSize:'0.88rem', fontWeight:600 }}>{results.values[0][0]}</p>
                  ) : (
                    <>
                      <div className="sp-rw">
                        <table className="sp-rt">
                          <thead>
                            <tr>
                              <th className="sp-rn">#</th>
                              {results.columns.map(c => (
                                <th key={c} onClick={() => handleSort(c)} title={`Sort by ${c}`}>
                                  {c}{sortCol === c ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {pagedValues.map((row, i) => (
                              <tr key={i}>
                                <td className="sp-rn">{(page - 1) * PAGE_SIZE + i + 1}</td>
                                {row.map((cell, j) => {
                                  const key = `${(page-1)*PAGE_SIZE+i}-${j}`;
                                  const expanded = expandedCell === key;
                                  return (
                                    <td key={j} className={expanded ? 'expanded' : ''} title={expanded ? '' : String(cell??'')}
                                      onClick={() => setExpandedCell(expanded ? null : key)}>
                                      {String(cell??'')}
                                    </td>
                                  );
                                })}
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
                  )
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── BOTTOM: Data Preview ─────────────────────────────────────────────────── */}
      {tables.length > 0 && (
        <div className="sp-panel" style={{ marginTop:'0.75rem' }}>
          <div className="sp-hdr" style={{ justifyContent:'space-between' }}>
            {/* Left: label + table selector */}
            <div style={{ display:'flex', alignItems:'center', gap:'0.55rem' }}>
              <Eye size={11}/>
              <span>Data Preview</span>
              {tables.length > 1 && (
                <select value={previewTable} onChange={e => setPreviewTable(e.target.value)}
                  style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'0.18rem 0.45rem', fontSize:'0.72rem', color:'var(--text-primary)', outline:'none', cursor:'pointer' }}>
                  {tables.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
              )}
              {tables.length === 1 && (
                <span style={{ color:'#a5b4fc', fontWeight:600 }}>{previewTable || tables[0]?.name}</span>
              )}
              {previewLoading && (
                <RefreshCw size={11} style={{ animation:'spin 0.9s linear infinite', opacity:0.5 }}/>
              )}
            </div>
            {/* Right: row limit buttons */}
            <div style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
              <span style={{ fontSize:'0.65rem', color:'var(--text-secondary)', marginRight:'0.2rem' }}>Rows:</span>
              {[10, 20, 50].map(n => (
                <button key={n} className={`sp-lim-btn${previewLimit===n?' active':''}`} onClick={() => setPreviewLimit(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Preview table */}
          {previewError ? (
            <p style={{ padding:'0.85rem 1rem', color:'#f87171', fontSize:'0.82rem', fontFamily:'monospace' }}>
              {previewError}
            </p>
          ) : previewData && previewData.columns.length > 0 ? (
            <div className="sp-preview-rw">
              <table className="sp-rt">
                <thead>
                  <tr>
                    <th className="sp-rn">#</th>
                    {previewData.columns.map(c => <th key={c}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {previewData.values.map((row, i) => (
                    <tr key={i}>
                      <td className="sp-rn">{i + 1}</td>
                      {row.map((cell, j) => (
                        <td key={j} title={String(cell??'')}>{String(cell??'')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : previewData && previewData.columns.length === 0 ? (
            <p style={{ padding:'0.85rem 1rem', color:'var(--text-secondary)', fontSize:'0.82rem' }}>Table is empty — insert rows to see data here.</p>
          ) : (
            <div style={{ padding:'0.75rem' }}>
              {[0,1,2].map(i => <div key={i} className="sp-skeleton" style={{ marginBottom: i < 2 ? '0.4rem' : 0, animationDelay:`${i*0.1}s` }}/>)}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop:'2rem' }}>
        <RelatedTools currentToolId="sql-practice" category="utilities"/>
      </div>
    </div>
  );
}

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Database, Play, Upload, Trash2, Table, AlertCircle, Clock } from 'lucide-react';

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'LIKE',
  'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT', 'AS',
  'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'ON',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE',
  'DROP', 'ALTER', 'ADD', 'COLUMN', 'INDEX', 'PRIMARY', 'KEY', 'UNIQUE',
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'IFNULL', 'CASE', 'WHEN',
  'THEN', 'ELSE', 'END', 'BETWEEN', 'EXISTS', 'UNION', 'ALL', 'ASC', 'DESC',
  'TRIM', 'UPPER', 'LOWER', 'LENGTH', 'SUBSTR', 'REPLACE', 'CAST', 'ROUND',
];
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import ToolHeader from '../../components/shared/ToolHeader';
import RelatedTools from '../../components/shared/RelatedTools';

// Sanitize a string for use as a SQL table name
function toTableName(filename) {
  return filename
    .replace(/\.[^.]+$/, '')       // remove extension
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^(\d)/, '_$1')       // can't start with digit
    .toLowerCase()
    .slice(0, 60) || 'data';
}

// Parse an uploaded file (CSV or XLSX) into { name, columns, rows }
async function parseFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (raw.length < 2) throw new Error('File appears to be empty or has only headers.');
  const columns = raw[0].map((c, i) => (String(c || `col${i}`).replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1') || `col${i}`));
  const rows = raw.slice(1).map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i] ?? ''; });
    return obj;
  });
  return { name: toTableName(file.name), columns, rows };
}

// Load sql.js lazily and create an in-memory database
async function initDb(tables) {
  const SQL = (await import('sql.js')).default;
  // Point to the WASM file served from node_modules via Vite's public dir
  const sql = await SQL({
    locateFile: (file) => `https://sql.js.org/dist/${file}`
  });
  const db = new sql.Database();
  for (const table of tables) {
    const cols = table.columns.map(c => `"${c}" TEXT`).join(', ');
    db.run(`CREATE TABLE IF NOT EXISTS "${table.name}" (${cols})`);
    if (table.rows.length > 0) {
      const placeholders = table.columns.map(() => '?').join(', ');
      const stmt = db.prepare(`INSERT INTO "${table.name}" VALUES (${placeholders})`);
      for (const row of table.rows) {
        stmt.run(table.columns.map(c => String(row[c] ?? '')));
      }
      stmt.free();
    }
  }
  return db;
}

const EXAMPLE_QUERY = 'SELECT * FROM data LIMIT 10;';

export default function SqlPractice() {
  const [tables, setTables] = useState([]);
  const [query, setQuery] = useState(EXAMPLE_QUERY);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [execTime, setExecTime] = useState(null);
  const [activeTable, setActiveTable] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const dbRef = useRef(null);
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newTables = [];
      for (const file of Array.from(files)) {
        const parsed = await parseFile(file);
        newTables.push(parsed);
      }
      const merged = [...tables];
      for (const t of newTables) {
        const idx = merged.findIndex(x => x.name === t.name);
        if (idx >= 0) merged[idx] = t; else merged.push(t);
      }
      setTables(merged);
      if (merged.length > 0 && !activeTable) setActiveTable(merged[0].name);
      dbRef.current = null; // Force DB rebuild on next run
      // Set example query with actual table name
      setQuery(`SELECT * FROM ${newTables[0].name} LIMIT 10;`);
      toast.success(`Loaded ${newTables.map(t => t.name).join(', ')}`);
    } catch (e) {
      toast.error(e.message || 'Failed to parse file');
    } finally {
      setUploading(false);
    }
  };

  const runQuery = useCallback(async () => {
    if (!query.trim()) return;
    if (tables.length === 0) { toast.error('Upload a CSV or Excel file first'); return; }
    setLoading(true);
    setError('');
    setResults(null);
    const t0 = performance.now();
    try {
      if (!dbRef.current) {
        dbRef.current = await initDb(tables);
      }
      const db = dbRef.current;
      const res = db.exec(query);
      const elapsed = (performance.now() - t0).toFixed(1);
      setExecTime(elapsed);
      if (!res || res.length === 0) {
        setResults({ columns: [], values: [], rowCount: 0 });
        toast.success('Query executed — no rows returned');
      } else {
        const { columns, values } = res[0];
        setResults({ columns, values, rowCount: values.length });
      }
    } catch (e) {
      setError(e.message || 'Query error');
    } finally {
      setLoading(false);
    }
  }, [query, tables]);

  // Compute the partial word being typed at the cursor
  const getWordAtCursor = (text, pos) => {
    let start = pos;
    while (start > 0 && /[a-zA-Z_]/.test(text[start - 1])) start--;
    return { word: text.slice(start, pos).toUpperCase(), start };
  };

  const updateSuggestion = (text, pos) => {
    const { word } = getWordAtCursor(text, pos);
    if (word.length < 2) { setSuggestion(''); return; }
    const match = SQL_KEYWORDS.find(k => k.startsWith(word) && k !== word);
    setSuggestion(match || '');
  };

  const handleEditorChange = (e) => {
    setQuery(e.target.value);
    updateSuggestion(e.target.value, e.target.selectionStart);
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runQuery();
      return;
    }
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault();
      const el = editorRef.current;
      const pos = el.selectionStart;
      const { word, start } = getWordAtCursor(query, pos);
      const before = query.slice(0, start);
      const after = query.slice(pos);
      const newQuery = before + suggestion + after;
      setQuery(newQuery);
      setSuggestion('');
      // Move cursor to end of inserted keyword
      requestAnimationFrame(() => {
        const newPos = start + suggestion.length;
        el.setSelectionRange(newPos, newPos);
      });
      return;
    }
    if (e.key === 'Escape') setSuggestion('');
  };

  const removeTable = (name) => {
    const updated = tables.filter(t => t.name !== name);
    setTables(updated);
    dbRef.current = null;
    if (activeTable === name) setActiveTable(updated[0]?.name || '');
    if (updated.length === 0) { setResults(null); setQuery(EXAMPLE_QUERY); }
  };

  const activeTableInfo = tables.find(t => t.name === activeTable);

  return (
    <div className="container" style={{ maxWidth: '1300px', margin: '0 auto', padding: '2rem 1rem' }}>
      <style>{`
        .sql-layout { display: grid; grid-template-columns: 260px 1fr; gap: 1rem; align-items: flex-start; }
        .sql-sidebar { display: flex; flex-direction: column; gap: 0.75rem; }
        .sql-main { display: flex; flex-direction: column; gap: 0.75rem; }
        .sql-panel { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden; }
        .sql-panel-header { padding: 0.6rem 1rem; background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.07); font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
        .sql-table-item { display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.85rem; cursor: pointer; transition: background 0.15s; font-size: 0.875rem; }
        .sql-table-item:hover { background: rgba(255,255,255,0.04); }
        .sql-table-item.active { background: rgba(99,102,241,0.1); color: #a5b4fc; }
        .sql-col-list { max-height: 200px; overflow-y: auto; }
        .sql-col-item { padding: 0.3rem 0.85rem; font-size: 0.78rem; color: var(--text-secondary); border-bottom: 1px solid rgba(255,255,255,0.03); font-family: monospace; }
        .sql-editor { width: 100%; min-height: 120px; padding: 0.85rem 1rem; background: rgba(0,0,0,0.3); border: none; color: #e2e8f0; font-family: 'Fira Code', 'Consolas', monospace; font-size: 0.875rem; line-height: 1.7; resize: vertical; outline: none; }
        .sql-results-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
        .sql-results-table th { padding: 0.55rem 0.75rem; background: rgba(99,102,241,0.12); color: #a5b4fc; text-align: left; font-weight: 700; border-bottom: 2px solid rgba(99,102,241,0.25); white-space: nowrap; font-size: 0.8rem; letter-spacing: 0.02em; position: sticky; top: 0; z-index: 1; }
        .sql-autocomplete-hint { font-size: 0.76rem; color: #6366f1; padding: 0.3rem 0.85rem; background: rgba(99,102,241,0.06); border-top: 1px solid rgba(99,102,241,0.1); display: flex; align-items: center; gap: 0.4rem; min-height: 28px; }
        .sql-results-table td { padding: 0.45rem 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.04); color: var(--text-primary); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sql-results-table tr:hover td { background: rgba(255,255,255,0.02); }
        .sql-results-wrapper { overflow: auto; max-height: 420px; }
        .sql-upload-zone { border: 2px dashed rgba(99,102,241,0.3); border-radius: 12px; padding: 1.5rem; text-align: center; cursor: pointer; transition: border-color 0.2s, background 0.2s; }
        .sql-upload-zone:hover { border-color: rgba(99,102,241,0.6); background: rgba(99,102,241,0.05); }
        .sql-error { display: flex; align-items: flex-start; gap: 0.6rem; padding: 0.75rem 1rem; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; color: #f87171; font-size: 0.85rem; font-family: monospace; }
        @media (max-width: 768px) { .sql-layout { grid-template-columns: 1fr; } }
      `}</style>

      <ToolHeader
        title="SQL Practice"
        description="Upload CSV or Excel files and run SQL queries directly in your browser. No server required."
        icon={Database}
        toolId="sql-practice"
      />

      {tables.length === 0 ? (
        <div style={{ maxWidth: 560, margin: '2rem auto' }}>
          <div
            className="sql-upload-zone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); }}
            onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
          >
            <Upload size={36} style={{ color: '#6366f1', marginBottom: '0.75rem' }} />
            <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Drop a CSV or Excel file here</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>or click to browse — your data never leaves your browser</p>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" multiple hidden onChange={e => handleFiles(e.target.files)} />
        </div>
      ) : (
        <div className="sql-layout">
          {/* Sidebar: tables + schema */}
          <div className="sql-sidebar">
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <button
                className="btn-secondary"
                style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload size={14} /> {uploading ? 'Loading...' : 'Add File'}
              </button>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" multiple hidden onChange={e => handleFiles(e.target.files)} />
            </div>

            <div className="sql-panel">
              <div className="sql-panel-header">Tables ({tables.length})</div>
              {tables.map(t => (
                <div key={t.name} className={`sql-table-item${activeTable === t.name ? ' active' : ''}`} onClick={() => setActiveTable(t.name)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Table size={13} /> {t.name}
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>({t.rows.length})</span>
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); removeTable(t.name); }}
                    style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 2 }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            {activeTableInfo && (
              <div className="sql-panel">
                <div className="sql-panel-header">Columns — {activeTableInfo.name}</div>
                <div className="sql-col-list">
                  {activeTableInfo.columns.map(col => (
                    <div key={col} className="sql-col-item">{col}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="sql-panel" style={{ padding: '0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <strong style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-primary)' }}>Tip</strong>
              Ctrl+Enter to run · Tab to complete SQL keywords<br />
              Supports SELECT, WHERE, ORDER BY, LIMIT, JOIN and more.
            </div>
          </div>

          {/* Main: editor + results */}
          <div className="sql-main">
            <div className="sql-panel">
              <div className="sql-panel-header">SQL Editor</div>
              <textarea
                ref={editorRef}
                className="sql-editor"
                value={query}
                onChange={handleEditorChange}
                onKeyDown={handleKeyDown}
                onClick={e => updateSuggestion(e.target.value, e.target.selectionStart)}
                spellCheck={false}
                placeholder="SELECT * FROM data LIMIT 10;"
              />
              <div className="sql-autocomplete-hint">
                {suggestion
                  ? <><kbd style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 4, padding: '0 5px', fontSize: '0.72rem', fontFamily: 'monospace' }}>Tab</kbd> to complete: <strong style={{ fontFamily: 'monospace' }}>{suggestion}</strong></>
                  : <span style={{ color: 'var(--text-secondary)' }}>Ctrl+Enter to run · Tab to autocomplete SQL keywords</span>
                }
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.85rem', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)' }}>
                <button
                  className="btn-primary"
                  onClick={runQuery}
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 1.1rem' }}
                >
                  <Play size={14} /> {loading ? 'Running...' : 'Run Query'}
                </button>
                {execTime && !error && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Clock size={12} /> {execTime}ms
                  </span>
                )}
                {results && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                    {results.rowCount} row{results.rowCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {error && (
              <div className="sql-error">
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

            {results && (
              <div className="sql-panel">
                <div className="sql-panel-header">
                  Results — {results.rowCount} row{results.rowCount !== 1 ? 's' : ''}
                </div>
                {results.columns.length === 0 ? (
                  <p style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Query ran successfully with no output (e.g. INSERT/UPDATE/CREATE).</p>
                ) : (
                  <div className="sql-results-wrapper">
                    <table className="sql-results-table">
                      <thead>
                        <tr>{results.columns.map(c => <th key={c}>{c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {results.values.map((row, i) => (
                          <tr key={i}>{row.map((cell, j) => <td key={j} title={String(cell ?? '')}>{String(cell ?? '')}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <RelatedTools currentToolId="sql-practice" category="utilities" />
    </div>
  );
}

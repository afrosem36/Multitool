import React, { useState, useEffect } from 'react';
import { Database, Copy, Download, RefreshCw, ChevronLeft, Code, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import ToolHeader from '../../components/shared/ToolHeader';
import RelatedTools from '../../components/shared/RelatedTools';

export default function SqlFormatter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [dialect, setDialect] = useState('PostgreSQL');

  useEffect(() => {
    const timer = setTimeout(() => {
      if (input.trim()) {
        formatSql(input);
      } else {
        setOutput('');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [input, dialect]);

  const formatSql = (sql) => {
    // Basic SQL formatting logic
    let formatted = sql
      .replace(/\s+/g, ' ') // Collapse spaces
      .replace(/\s*,\s*/g, ',\n  ') // New line after commas in SELECT
      .replace(/\b(SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|LIMIT|INSERT INTO|UPDATE|DELETE|SET|VALUES|CREATE TABLE|ALTER TABLE|DROP TABLE)\b/gi, (match) => {
        return '\n' + match.toUpperCase();
      })
      .replace(/\b(AND|OR|ON|IN|AS|IS|NULL|NOT|LIKE|EXISTS|BETWEEN|DISTINCT|COUNT|SUM|AVG|MIN|MAX)\b/gi, (match) => {
        return match.toUpperCase();
      })
      .split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .join('\n');

    // Dialect specific casing (example)
    if (dialect === 'SQLite') {
      formatted = formatted.toLowerCase(); // Just an example of dialect change
    }

    setOutput(highlightSql(formatted));
  };

  const highlightSql = (sql) => {
    // Basic syntax highlighting
    return sql.replace(/(".*?"|'.*?'|`.*?`|\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|GROUP|BY|ORDER|HAVING|LIMIT|INSERT|INTO|UPDATE|DELETE|SET|VALUES|CREATE|TABLE|ALTER|DROP|AND|OR|ON|IN|AS|IS|NULL|NOT|LIKE|EXISTS|BETWEEN|DISTINCT|COUNT|SUM|AVG|MIN|MAX)\b|\b\d+\b|--.*)/gi, function (match) {
      let cls = 'sql-keyword';
      if (/^['"`]/.test(match)) {
        cls = 'sql-string';
      } else if (/^\d+$/.test(match)) {
        cls = 'sql-number';
      } else if (/^--/.test(match)) {
        cls = 'sql-comment';
      }
      return '<span class="' + cls + '">' + match + '</span>';
    });
  };

  const handleCopy = () => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = output;
    navigator.clipboard.writeText(tempDiv.innerText);
    toast.success('Formatted SQL copied!');
  };

  const handleDownload = () => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = output;
    const blob = new Blob([tempDiv.innerText], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <style>{`
        .sql-keyword { color: #a78bfa; font-weight: 700; }
        .sql-string { color: #4ade80; }
        .sql-number { color: #fbbf24; }
        .sql-comment { color: #94a3b8; font-style: italic; }
        .sql-pre { 
          margin: 0; 
          font-family: 'Fira Code', 'Roboto Mono', monospace; 
          font-size: 0.95rem; 
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-all;
        }
      `}</style>

      <Link to="/utilities" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', textDecoration: 'none' }}>
        <ChevronLeft size={16} /> Back to Utilities
      </Link>

      <ToolHeader 
        title="SQL Query Formatter" 
        description="Beautify your raw SQL queries with proper indentation and keyword highlighting. Supports multiple dialects including MySQL, PostgreSQL, and SQLite."
      />

      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Settings size={18} color="var(--text-secondary)" />
            <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>SQL Dialect:</span>
            <select 
              value={dialect} 
              onChange={(e) => setDialect(e.target.value)}
              style={{ padding: '0.6rem 1rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white', outline: 'none' }}
            >
              <option>PostgreSQL</option>
              <option>MySQL</option>
              <option>SQLite</option>
            </select>
          </div>
          
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem' }}>
            <button onClick={handleCopy} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Copy size={16} /> Copy
            </button>
            <button onClick={handleDownload} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Download size={16} /> Download .sql
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem', height: '550px' }}>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>RAW SQL INPUT</span>
            <button onClick={() => setInput('')} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <RefreshCw size={14} /> Clear
            </button>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="SELECT * FROM users WHERE active = 1 JOIN orders ON users.id = orders.user_id..."
            style={{ flex: 1, padding: '1.5rem', background: 'transparent', border: 'none', color: 'white', fontFamily: 'monospace', fontSize: '0.95rem', outline: 'none', resize: 'none' }}
          />
        </div>

        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <span style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>FORMATTED SQL</span>
          </div>
          <div style={{ flex: 1, padding: '1.5rem', overflow: 'auto', background: 'rgba(255,255,255,0.02)' }}>
            {output ? (
              <pre className="sql-pre" dangerouslySetInnerHTML={{ __html: output }} />
            ) : (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '4rem' }}>
                <Code size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <p>Formatted SQL will appear here as you type</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <RelatedTools currentToolId="sql-formatter" category="utilities" />
    </div>
  );
}

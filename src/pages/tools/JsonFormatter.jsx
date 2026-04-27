import React, { useState, useEffect } from 'react';
import { Code, Copy, Trash2, Check, AlertCircle, Maximize2, Minimize2, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import ToolHeader from '../../components/shared/ToolHeader';
import RelatedTools from '../../components/shared/RelatedTools';

export default function JsonFormatter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!input.trim()) {
      setOutput('');
      setError(null);
      return;
    }
    validateAndFormat(input, false);
  }, [input]);

  const validateAndFormat = (jsonStr, forcePretty = false) => {
    try {
      const obj = JSON.parse(jsonStr);
      setError(null);
      if (forcePretty) {
        setInput(JSON.stringify(obj, null, 2));
      }
      setOutput(highlightJson(obj));
    } catch (e) {
      const message = e.message;
      const lineMatch = message.match(/line (\d+)/);
      setError({
        message: message,
        line: lineMatch ? lineMatch[1] : null
      });
      setOutput('');
    }
  };

  const highlightJson = (obj) => {
    const json = JSON.stringify(obj, null, 2);
    // Very basic syntax highlighting using regex and span classes
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return '<span class="' + cls + '">' + match + '</span>';
    });
  };

  const handleFormat = () => {
    if (input) validateAndFormat(input, true);
  };

  const handleMinify = () => {
    try {
      const obj = JSON.parse(input);
      const minified = JSON.stringify(obj);
      setInput(minified);
      validateAndFormat(minified);
    } catch (e) {
      toast.error('Invalid JSON');
    }
  };

  const handleClear = () => {
    setInput('');
    setOutput('');
    setError(null);
  };

  const handleCopy = () => {
    if (input) {
      try {
        const obj = JSON.parse(input);
        navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
        toast.success('JSON copied to clipboard!');
      } catch (e) {
        navigator.clipboard.writeText(input);
        toast.success('Text copied to clipboard!');
      }
    }
  };

  return (
    <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <style>{`
        .json-key { color: #93c5fd; }
        .json-string { color: #4ade80; }
        .json-number { color: #fbbf24; }
        .json-boolean { color: #f472b6; }
        .json-null { color: #94a3b8; }
        .json-pre { 
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
        title="JSON Formatter & Validator" 
        description="Clean, format, and validate your JSON data instantly. Supports prettifying, minifying, and real-time syntax highlighting."
      />

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={handleFormat} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Maximize2 size={16} /> Format
        </button>
        <button onClick={handleMinify} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Minimize2 size={16} /> Minify
        </button>
        <button onClick={handleCopy} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Copy size={16} /> Copy
        </button>
        <button onClick={handleClear} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
          <Trash2 size={16} /> Clear
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem', height: '600px' }}>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>RAW INPUT</span>
            {error ? (
              <span style={{ color: '#f87171', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <AlertCircle size={14} /> Invalid JSON {error.line && `at line ${error.line}`}
              </span>
            ) : (
              <span style={{ color: '#4ade80', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Check size={14} /> Valid JSON
              </span>
            )}
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste your JSON here..."
            style={{
              flex: 1,
              width: '100%',
              padding: '1.25rem',
              background: 'rgba(0,0,0,0.2)',
              border: 'none',
              color: 'white',
              fontFamily: 'monospace',
              fontSize: '0.95rem',
              outline: 'none',
              resize: 'none'
            }}
          />
        </div>

        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
            <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>FORMATTED OUTPUT</span>
          </div>
          <div style={{ 
            flex: 1, 
            padding: '1.25rem', 
            overflow: 'auto', 
            background: 'rgba(255,255,255,0.02)' 
          }}>
            {error ? (
              <div style={{ color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <h4 style={{ margin: '0 0 0.5rem' }}>Error parsing JSON</h4>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>{error.message}</p>
              </div>
            ) : output ? (
              <pre className="json-pre" dangerouslySetInnerHTML={{ __html: output }} />
            ) : (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem' }}>
                Formatted JSON will appear here
              </div>
            )}
          </div>
        </div>
      </div>

      <RelatedTools currentToolId="json-formatter" category="utilities" />
    </div>
  );
}

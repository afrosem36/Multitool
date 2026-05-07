import React, { useState, useEffect, useRef } from 'react';
import {
  Database, Plus, Trash2, Copy, Sparkles,
  ChevronLeft, RefreshCw, AlertCircle, Layout,
  Check, Wifi, WifiOff, Clock, Zap, ChevronDown,
  Info, CheckCircle2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AdSenseUnit from '../../components/shared/AdSenseUnit';
import { triggerAd } from '../../utils/adTrigger';
import { toast } from 'react-hot-toast';
import { API_BASE_URL } from '../../config';
import { useAuth } from '../../context/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXAMPLES = [
  { label: 'Top 10 by signup', text: 'Show top 10 users ordered by signup date descending' },
  { label: 'Count by city', text: 'Count the number of users grouped by city' },
  { label: 'Last 30 days', text: 'Find all records created in the last 30 days' },
  { label: 'Gmail users', text: 'Show all users where email contains gmail' },
  { label: 'Avg by category', text: 'Get the average value grouped by category' },
  { label: 'Active users', text: 'Find all active users who logged in this week' },
];

const MAX_RETRIES = 2;
const TIMEOUT_MS = 15000;

// ─── Syntax Highlighter ───────────────────────────────────────────────────────

const KEYWORDS = /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|INSERT|INTO|UPDATE|DELETE|SET|VALUES|CREATE|TABLE|ALTER|DROP|AND|OR|ON|IN|AS|IS|NULL|NOT|LIKE|EXISTS|BETWEEN|DISTINCT|COUNT|SUM|AVG|MIN|MAX|CASE|WHEN|THEN|ELSE|END|WITH|UNION|ALL|ASC|DESC)\b/gi;

function highlightSql(sql) {
  if (!sql) return '';
  return sql
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/(".*?"|'.*?'|`.*?`)/g, m => `<span class="tsql-string">${m}</span>`)
    .replace(/\b(\d+\.?\d*)\b/g, m => `<span class="tsql-number">${m}</span>`)
    .replace(/(--[^\n]*)/g, m => `<span class="tsql-comment">${m}</span>`)
    .replace(KEYWORDS, m => `<span class="tsql-keyword">${m.toUpperCase()}</span>`);
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    idle: { icon: <Database size={12} />, label: 'Ready', color: '#64748b' },
    generating: { icon: <RefreshCw size={12} className="spin" />, label: 'Generating…', color: '#f59e0b' },
    success: { icon: <CheckCircle2 size={12} />, label: 'Generated', color: '#22c55e' },
    error: { icon: <AlertCircle size={12} />, label: 'Error', color: '#ef4444' },
    retrying: { icon: <RefreshCw size={12} className="spin" />, label: 'Retrying…', color: '#a78bfa' },
  };
  const s = map[status] || map.idle;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
      fontSize: '0.75rem', fontWeight: '600', color: s.color,
      padding: '0.3rem 0.75rem', borderRadius: '99px',
      background: `${s.color}18`, border: `1px solid ${s.color}40`,
    }}>
      {s.icon} {s.label}
    </span>
  );
}

// ─── Error Panel ──────────────────────────────────────────────────────────────

function ErrorPanel({ error, onRetry, retryCount }) {
  const isNetwork = error.toLowerCase().includes('network') || error.toLowerCase().includes('fetch');
  const isTimeout = error.toLowerCase().includes('timeout');
  const isAuth = error.toLowerCase().includes('401') || error.toLowerCase().includes('auth') || error.toLowerCase().includes('api key');
  const isGroq = error.toLowerCase().includes('groq') || error.toLowerCase().includes('rate');

  let hint = 'Please try again or adjust your question.';
  if (isNetwork) hint = 'Check your internet connection and try again.';
  if (isTimeout) hint = 'The request timed out. Try a simpler question.';
  if (isAuth) hint = 'The Groq API key may be missing or invalid. Contact the site admin.';
  if (isGroq) hint = 'Groq rate limit reached. Wait a moment then try again.';

  return (
    <div style={{
      margin: 'auto', textAlign: 'center', padding: '2rem',
      maxWidth: '420px',
    }}>
      <div style={{
        width: '56px', height: '56px', borderRadius: '50%',
        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 1.25rem',
      }}>
        {isNetwork ? <WifiOff size={24} color="#ef4444" /> :
          isTimeout ? <Clock size={24} color="#ef4444" /> :
            <AlertCircle size={24} color="#ef4444" />}
      </div>

      <p style={{ color: '#f87171', fontWeight: '700', marginBottom: '0.5rem', fontSize: '1rem' }}>
        {isNetwork ? 'Connection Error' : isTimeout ? 'Request Timed Out' : isAuth ? 'Auth Error' : 'Generation Failed'}
      </p>
      <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.5rem', lineHeight: 1.6 }}>{hint}</p>
      <p style={{
        fontSize: '0.78rem', color: '#475569', fontFamily: 'monospace',
        background: 'rgba(0,0,0,0.3)', padding: '0.5rem 1rem',
        borderRadius: '8px', marginBottom: '1.5rem', wordBreak: 'break-all',
      }}>
        {error}
      </p>

      {retryCount < MAX_RETRIES && (
        <button onClick={onRetry} className="btn-secondary" style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.7rem 1.5rem',
        }}>
          <RefreshCw size={16} /> Retry {retryCount > 0 ? `(${retryCount}/${MAX_RETRIES})` : ''}
        </button>
      )}
      {retryCount >= MAX_RETRIES && (
        <p style={{ color: '#475569', fontSize: '0.8rem' }}>
          Max retries reached. Please check your connection or try later.
        </p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TextToSql() {
  const { user, token } = useAuth();
  const [credits, setCredits] = useState(null);
  const [question, setQuestion] = useState('');
  const [tableName, setTableName] = useState(() => localStorage.getItem('tsql-table') || 'users');
  const [columns, setColumns] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tsql-cols')) || ['id', 'name', 'email', 'city', 'created_at']; }
    catch { return ['id', 'name', 'email', 'city', 'created_at']; }
  });
  const [rawSql, setRawSql] = useState('');
  const [highlighted, setHighlighted] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(true);
  const [latencyMs, setLatencyMs] = useState(null);
  const abortRef = useRef(null);

  // Persist schema
  useEffect(() => {
    localStorage.setItem('tsql-table', tableName);
    localStorage.setItem('tsql-cols', JSON.stringify(columns));
  }, [tableName, columns]);

  // Cleanup on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  // Fetch credits on mount (only when logged in)
  useEffect(() => {
    if (!user || !token) return;
    fetch(`${API_BASE_URL}/api/text-to-sql/credits`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.data) setCredits(d.data); })
      .catch(() => {});
  }, [user, token]);

  // ── API Call ────────────────────────────────────────────────────────────────

  const callApi = async (attempt = 0) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const timeoutId = setTimeout(() => abortRef.current.abort(), TIMEOUT_MS);

    const schema = `Table: ${tableName}\nColumns: ${columns.filter(Boolean).join(', ')}`;
    const t0 = Date.now();

    try {
      const res = await fetch(`${API_BASE_URL}/api/text-to-sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question, schema }),
        signal: abortRef.current.signal,
      });

      clearTimeout(timeoutId);
      setLatencyMs(Date.now() - t0);

      const text = await res.text();
      let json;
      try { json = JSON.parse(text); }
      catch { throw new Error(`Server returned non-JSON (${res.status}): ${text.slice(0, 120)}`); }

      if (res.status === 429) {
        throw new Error(json?.error || `Daily limit of ${json?.creditsTotal || 20} credits reached. Resets at midnight UTC.`);
      }

      if (!res.ok) {
        throw new Error(json?.error || `HTTP ${res.status}: ${res.statusText}`);
      }

      // Update credits from response
      if (json.creditsUsed !== undefined) {
        setCredits(prev => prev ? {
          ...prev,
          creditsUsed: json.creditsUsed,
          creditsRemaining: json.creditsTotal - json.creditsUsed,
        } : null);
      }

      const sql = json?.data?.sql;
      if (!sql) throw new Error('Server responded OK but returned no SQL. Check backend logs.');

      return sql.trim();

    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') throw new Error('Request timed out after 15 seconds.');
      throw err;
    }
  };

  // ── Generate ────────────────────────────────────────────────────────────────

  const generate = async (attempt = 0) => {
    if (!question.trim()) return toast.error('Enter a question first');
    if (!tableName.trim()) return toast.error('Enter a table name');
    if (columns.some(c => !c.trim())) return toast.error('All columns need names');
    if (attempt === 0) triggerAd(); // only on first attempt, not retries

    setStatus(attempt === 0 ? 'generating' : 'retrying');
    setError(null);

    try {
      const sql = await callApi(attempt);
      setRawSql(sql);
      setHighlighted(highlightSql(sql));
      setStatus('success');
      setRetryCount(0);
      toast.success('SQL generated!', { icon: '⚡' });
    } catch (err) {
      console.error('[TextToSql] Error:', err);
      setError(err.message);
      setStatus('error');
      setRetryCount(attempt + 1);
      toast.error(err.message.slice(0, 60));
    }
  };

  const handleRetry = () => generate(retryCount);

  // ── Copy ────────────────────────────────────────────────────────────────────

  const handleCopy = async () => {
    if (!rawSql) return;
    try {
      await navigator.clipboard.writeText(rawSql);
      setCopied(true);
      toast.success('Copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed');
    }
  };

  // ── Columns ─────────────────────────────────────────────────────────────────

  const addCol = () => { if (columns.length < 10) setColumns([...columns, '']); else toast.error('Max 10 columns'); };
  const removeCol = i => { if (columns.length > 1) setColumns(columns.filter((_, j) => j !== i)); else toast.error('Need at least 1 column'); };
  const updateCol = (i, v) => setColumns(prev => { const n = [...prev]; n[i] = v; return n; });

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem 2rem' }}>

      {/* Global styles */}
      <style>{`
        .tsql-keyword { color: #a78bfa; font-weight: 700; }
        .tsql-string  { color: #4ade80; }
        .tsql-number  { color: #fbbf24; }
        .tsql-comment { color: #64748b; font-style: italic; }
        .tsql-pre     {
          margin: 0;
          font-family: 'Fira Code', 'JetBrains Mono', 'Roboto Mono', monospace;
          font-size: 0.97rem;
          line-height: 1.75;
          white-space: pre-wrap;
          word-break: break-word;
          color: #e2e8f0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.9s linear infinite; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .fade-in { animation: fadeIn 0.35s ease forwards; }
        @keyframes pulse-border {
          0%,100% { border-color: rgba(167,139,250,0.3); }
          50%      { border-color: rgba(167,139,250,0.8); }
        }
        .generating-border { animation: pulse-border 1.2s ease infinite; }
        .schema-col-input:focus { border-color: var(--accent-primary) !important; outline: none; }
      `}</style>

      {/* Back */}
      <Link to="/utilities" style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
        color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem',
        marginBottom: '1.5rem',
      }}>
        <ChevronLeft size={16} /> Back to Utilities
      </Link>

      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '10px',
            background: 'linear-gradient(135deg,#7c3aed,#2563eb)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={20} color="white" />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800' }}>AI Text → SQL</h1>
          <StatusBadge status={status} />
        </div>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Type a plain-English question, define your schema, and get production-ready SQL instantly via Groq Llama-3.
        </p>
      </div>

      {/* Credit bar (logged in) */}
      {user && credits && (
        <>
          {credits.unlimited ? (
            <div style={{
              padding: '1rem 1.5rem', borderRadius: '12px', marginBottom: '1.5rem',
              background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Zap size={11} color="#34d399" />
                Daily Credits
              </span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34d399',
                display: 'flex', alignItems: 'center', gap: 4 }}>
                ∞ Unlimited
              </span>
            </div>
          ) : (
            <div style={{
              padding: '1rem 1.5rem', borderRadius: '12px', marginBottom: '1.5rem',
              background: credits.creditsRemaining <= 5 ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
              border: `1px solid ${credits.creditsRemaining <= 5 ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Zap size={18} color={credits.creditsRemaining <= 5 ? '#ef4444' : '#22c55e'} />
                <div>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '0.95rem' }}>
                    {credits.creditsRemaining} credits remaining today
                  </p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {credits.creditsUsed} of {credits.creditsTotal} used · Resets at midnight UTC
                  </p>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: '200px', maxWidth: '300px' }}>
                <div style={{ height: '6px', borderRadius: '99px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(credits.creditsUsed / credits.creditsTotal) * 100}%`,
                    borderRadius: '99px',
                    background: credits.creditsRemaining <= 5
                      ? 'linear-gradient(90deg,#ef4444,#f97316)'
                      : 'linear-gradient(90deg,#22c55e,#16a34a)',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Not logged in warning */}
      {!user && (
        <div style={{
          padding: '1.25rem 1.5rem', borderRadius: '12px', marginBottom: '1.5rem',
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
        }}>
          <AlertCircle size={20} color="#f59e0b" />
          <div>
            <p style={{ margin: 0, fontWeight: '700', color: '#fbbf24' }}>Login required</p>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Please <Link to="/login" style={{ color: '#f59e0b' }}>log in</Link> to use the AI Text-to-SQL generator. You get 20 free credits per day.
            </p>
          </div>
        </div>
      )}

      {/* Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── Left column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Question input */}
          <div className="glass-panel" style={{ padding: '1.75rem' }}>
            <label style={{
              display: 'block', fontSize: '0.78rem', fontWeight: '700',
              color: 'var(--text-secondary)', letterSpacing: '0.08em',
              textTransform: 'uppercase', marginBottom: '0.75rem',
            }}>
              Your Question
            </label>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate(0); }}
              placeholder="e.g. Show me all users who signed up last month from Lahore…"
              rows={4}
              style={{
                width: '100%', padding: '1rem', borderRadius: '10px',
                background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)',
                color: 'white', fontSize: '1.05rem', resize: 'vertical',
                outline: 'none', fontFamily: 'inherit', lineHeight: 1.6,
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
            />

            {/* Example chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.9rem', marginBottom: '1.25rem' }}>
              {EXAMPLES.map(ex => (
                <button key={ex.label} onClick={() => setQuestion(ex.text)} style={{
                  padding: '0.4rem 0.9rem', borderRadius: '99px', cursor: 'pointer',
                  background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)',
                  color: '#a78bfa', fontSize: '0.8rem', fontWeight: '600',
                  transition: 'all 0.2s',
                }}
                  onMouseOver={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.18)'; }}
                  onMouseOut={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.08)'; }}
                >
                  {ex.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => generate(0)}
              disabled={
                !user ||
                status === 'generating' ||
                status === 'retrying' ||
                (credits && !credits.unlimited && credits.creditsRemaining <= 0)
              }
              className="btn-primary"
              style={{
                width: '100%', padding: '1rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                fontSize: '1rem', fontWeight: '700', borderRadius: '10px',
                opacity: (!user || status === 'generating' || status === 'retrying' || (credits && !credits.unlimited && credits.creditsRemaining <= 0)) ? 0.6 : 1,
                cursor: (!user || status === 'generating' || status === 'retrying' || (credits && !credits.unlimited && credits.creditsRemaining <= 0)) ? 'not-allowed' : 'pointer',
              }}
            >
              {(status === 'generating' || status === 'retrying')
                ? <><RefreshCw size={18} className="spin" /> {status === 'retrying' ? `Retrying (${retryCount}/${MAX_RETRIES})…` : 'Generating…'}</>
                : !user
                  ? <><AlertCircle size={18} /> Login to Generate</>
                  : (credits && !credits.unlimited && credits.creditsRemaining <= 0)
                    ? <><AlertCircle size={18} /> No Credits Left Today</>
                    : <><Sparkles size={18} /> Generate SQL  <span style={{ fontSize: '0.8rem', opacity: 0.7, fontWeight: 400 }}>Ctrl+Enter</span></>
              }
            </button>
          </div>

          {/* Output */}
          <div
            className={`glass-panel ${status === 'generating' || status === 'retrying' ? 'generating-border' : ''}`}
            style={{ overflow: 'hidden', border: '1px solid var(--border-color)' }}
          >
            {/* Output header */}
            <div style={{
              padding: '0.9rem 1.25rem',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(0,0,0,0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontWeight: '700', fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  SQL Output
                </span>
                {latencyMs && status === 'success' && (
                  <span style={{ fontSize: '0.72rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Zap size={11} /> {latencyMs}ms
                  </span>
                )}
              </div>
              <button
                onClick={handleCopy}
                disabled={!rawSql}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  background: 'none', border: 'none', cursor: rawSql ? 'pointer' : 'not-allowed',
                  color: copied ? '#22c55e' : 'var(--text-secondary)',
                  fontSize: '0.85rem', fontWeight: '600',
                  opacity: rawSql ? 1 : 0.4,
                  transition: 'color 0.2s',
                }}
              >
                {copied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy SQL</>}
              </button>
            </div>

            {/* Output body */}
            <div style={{ padding: '1.75rem', background: '#080f1a', minHeight: '240px', display: 'flex', flexDirection: 'column' }}>
              {status === 'error' && error ? (
                <ErrorPanel error={error} onRetry={handleRetry} retryCount={retryCount} />
              ) : highlighted ? (
                <pre className="tsql-pre fade-in" dangerouslySetInnerHTML={{ __html: highlighted }} />
              ) : (
                <div style={{ margin: 'auto', textAlign: 'center', color: '#334155' }}>
                  {status === 'generating' || status === 'retrying' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                      <RefreshCw size={36} className="spin" color="#7c3aed" />
                      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Groq Llama-3 is thinking…</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      <Database size={40} style={{ opacity: 0.15 }} />
                      <p style={{ fontSize: '0.9rem', opacity: 0.5 }}>Your SQL will appear here</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ── Right column: Schema Builder ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            {/* Schema header */}
            <button
              onClick={() => setSchemaOpen(o => !o)}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', background: 'none', border: 'none',
                cursor: 'pointer', padding: 0, marginBottom: schemaOpen ? '1.25rem' : 0,
              }}
            >
              <span style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layout size={16} color="var(--accent-primary)" /> Schema Builder
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{columns.filter(Boolean).length}/10</span>
                <ChevronDown size={16} color="var(--text-secondary)" style={{ transform: schemaOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </div>
            </button>

            {schemaOpen && (
              <div className="fade-in">
                {/* Table name */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>
                    Table Name
                  </label>
                  <input
                    value={tableName}
                    onChange={e => setTableName(e.target.value)}
                    placeholder="users"
                    style={{
                      width: '100%', padding: '0.7rem 0.9rem', borderRadius: '8px',
                      background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)',
                      color: 'white', fontSize: '0.95rem', boxSizing: 'border-box',
                      outline: 'none',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                  />
                </div>

                {/* Columns */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>
                    Columns
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {columns.map((col, i) => (
                      <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: '#475569', width: '18px', textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                        <input
                          className="schema-col-input"
                          value={col}
                          onChange={e => updateCol(i, e.target.value)}
                          placeholder={`column_${i + 1}`}
                          style={{
                            flex: 1, padding: '0.55rem 0.75rem', borderRadius: '7px',
                            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)',
                            color: 'white', fontSize: '0.88rem',
                          }}
                        />
                        <button
                          onClick={() => removeCol(i)}
                          title="Remove"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '0.25rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                          onMouseOver={e => e.currentTarget.style.color = '#ef4444'}
                          onMouseOut={e => e.currentTarget.style.color = '#475569'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {columns.length < 10 && (
                    <button onClick={addCol} style={{
                      marginTop: '0.75rem', width: '100%',
                      padding: '0.65rem', borderRadius: '8px', cursor: 'pointer',
                      background: 'rgba(59,130,246,0.07)', border: '1px dashed rgba(59,130,246,0.35)',
                      color: '#60a5fa', fontSize: '0.85rem', fontWeight: '600',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                      transition: 'background 0.2s',
                    }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(59,130,246,0.14)'}
                      onMouseOut={e => e.currentTarget.style.background = 'rgba(59,130,246,0.07)'}
                    >
                      <Plus size={15} /> Add Column
                    </button>
                  )}
                </div>

                {/* Schema preview */}
                <div style={{
                  marginTop: '1.25rem', padding: '0.9rem',
                  background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
                  fontFamily: 'monospace', fontSize: '0.78rem', color: '#64748b',
                  lineHeight: 1.7,
                }}>
                  <span style={{ color: '#a78bfa', fontWeight: 700 }}>TABLE </span>
                  <span style={{ color: '#38bdf8' }}>{tableName || '…'}</span>
                  {'\n'}
                  {columns.filter(Boolean).map((c, i) => (
                    <span key={i} style={{ display: 'block', paddingLeft: '1rem', color: '#94a3b8' }}>↳ {c}</span>
                  ))}
                </div>

                {/* Saved indicator */}
                <div style={{
                  marginTop: '1rem', padding: '0.6rem 0.9rem',
                  background: 'rgba(34,197,94,0.05)', borderRadius: '8px',
                  border: '1px solid rgba(34,197,94,0.15)',
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  fontSize: '0.78rem', color: '#4ade80',
                }}>
                  <Check size={13} /> Auto-saved to browser
                </div>
              </div>
            )}
          </div>

          {/* Tip */}
          <div style={{
            padding: '1rem 1.25rem', borderRadius: '12px',
            background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)',
          }}>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
              <Info size={15} color="#60a5fa" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <p style={{ margin: '0 0 0.3rem', fontSize: '0.8rem', fontWeight: '700', color: '#93c5fd' }}>Pro Tip</p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 }}>
                  Include specific filters like "last 30 days" or "where city = Lahore" for more accurate results. Press <kbd style={{ background: '#1e293b', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem' }}>Ctrl+Enter</kbd> to generate.
                </p>
              </div>
            </div>
          </div>

          {/* Connection status */}
          <div style={{
            padding: '0.75rem 1rem', borderRadius: '10px',
            background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            fontSize: '0.8rem', color: 'var(--text-secondary)',
          }}>
            <Wifi size={14} color="#22c55e" />
            Powered by <strong style={{ color: '#e2e8f0' }}>Groq Llama-3</strong>
            <span style={{ marginLeft: 'auto', color: '#22c55e', fontWeight: '600' }}>Free</span>
          </div>

        </div>
      </div>

      <AdSenseUnit slot="9876543210" />

      {/* Mobile responsive */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns: '1fr 360px'"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
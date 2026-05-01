import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RotateCcw, Download, Copy, Save, Share2, Rocket, X, Monitor, Code, FileCode, Zap, ZapOff, ChevronLeft, Terminal, LayoutDashboard, ExternalLink, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import LZString from 'lz-string';
import { useAuth } from '../../context/AuthContext';
import AuthModal from '../../components/AuthModal';

const STORAGE_KEY = 'html-ide-projects';
const MAX_SAVED = 5;
const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const DEFAULT_HTML = `<div class="container">
  <h1>Hello World!</h1>
  <p>Start editing to see live preview.</p>
  <button id="btn" onclick="handleClick()">Click Me</button>
</div>`;

const DEFAULT_CSS = `* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.container { text-align: center; padding: 2rem; }

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  background: linear-gradient(90deg, #00d4ff, #7c3aed);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

p { color: #94a3b8; margin-bottom: 1.5rem; }

button {
  background: linear-gradient(90deg, #00d4ff, #7c3aed);
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

button:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(0, 212, 255, 0.3);
}`;

const DEFAULT_JS = `function handleClick() {
  const btn = document.getElementById('btn');
  btn.textContent = 'Clicked! 🎉';
  btn.style.background = 'linear-gradient(90deg, #10b981, #3b82f6)';
  setTimeout(() => {
    btn.textContent = 'Click Me';
    btn.style.background = 'linear-gradient(90deg, #00d4ff, #7c3aed)';
  }, 2000);
}`;

const CONSOLE_CAPTURE_JS = `
const _origLog = console.log;
const _origErr = console.error;
const _origWarn = console.warn;
console.log = (...a) => { window.parent.postMessage({ type:'console', method:'log', args: a.map(String) }, '*'); _origLog(...a); };
console.error = (...a) => { window.parent.postMessage({ type:'console', method:'error', args: a.map(String) }, '*'); _origErr(...a); };
console.warn = (...a) => { window.parent.postMessage({ type:'console', method:'warn', args: a.map(String) }, '*'); _origWarn(...a); };
window.onerror = (msg, src, line) => { window.parent.postMessage({ type:'console', method:'error', args: [\`\${msg} (line \${line})\`] }, '*'); };
`;

function getSrcDoc(html, css, js) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>${css}</style></head><body>${html}<script>${CONSOLE_CAPTURE_JS}${js}<\/script></body></html>`;
}

function loadProjects() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveProjects(projects) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects.slice(0, MAX_SAVED)));
}

export default function HtmlIde() {
  const navigate = useNavigate();
  const { user, apiFetch } = useAuth();

  const [html, setHtml] = useState(DEFAULT_HTML);
  const [css, setCss] = useState(DEFAULT_CSS);
  const [js, setJs] = useState(DEFAULT_JS);
  const [projectName, setProjectName] = useState('Untitled Project');
  const [activeTab, setActiveTab] = useState('html');
  const [autoRun, setAutoRun] = useState(true);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [showConsole, setShowConsole] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [showProjectsPanel, setShowProjectsPanel] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authAction, setAuthAction] = useState('');
  const [showDashboard, setShowDashboard] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployName, setDeployName] = useState('');
  const [savedProjects, setSavedProjects] = useState(loadProjects);
  const [myDeployments, setMyDeployments] = useState([]);
  const [loadingDeployments, setLoadingDeployments] = useState(false);

  const deployBaseUrl = `${import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:8787'}/d`;

  const debounceRef = useRef(null);
  const iframeRef = useRef(null);

  // Fetch user deployments when dashboard is opened
  useEffect(() => {
    if (showDashboard && user) {
      fetchDeployments();
    }
  }, [showDashboard, user]);

  const fetchDeployments = async () => {
    setLoadingDeployments(true);
    try {
      const res = await apiFetch('/api/deployments');
      const data = await res.json();
      setMyDeployments(data.data || []);
    } catch (err) {
      toast.error('Failed to load deployments');
    } finally {
      setLoadingDeployments(false);
    }
  };

  const handleDeploy = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    if (!deployName) {
      toast.error('Please enter a project name for the URL');
      return;
    }

    setIsDeploying(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error('Failed to load payment gateway');

      // 1. Create Order
      const orderRes = await apiFetch('/api/deploy/create-order', {
        method: 'POST',
      });
      const order = await orderRes.json();

      if (order.error) throw new Error(order.error);
      console.log('ORDER:', order);

      // 2. Open Razorpay
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        order_id: order.id || order.order_id,
        name: 'MultiTool Deploy',
        description: `Deploy ${projectName}`,
        handler: async (response) => {
          try {
            // 3. Verify and Save
            const verifyRes = await apiFetch('/api/deploy/verify-and-save', {
              method: 'POST',
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                projectName,
                slug: deployName,
                html,
                css,
                js
              }),
            });
            const verifyData = await verifyRes.json();
            
            if (verifyData.error) throw new Error(verifyData.error);

            toast.success('Successfully deployed!');
            setShowDeployModal(false);
            // Optionally redirect to dashboard or show the link
            window.open(verifyData.data.url, '_blank');
            fetchDeployments();
          } catch (err) {
            toast.error(err.message || 'Deployment verification failed');
          }
        },
        prefill: {
          email: user.email,
        },
        theme: {
          color: '#6366f1',
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error(err.message || 'Payment initiation failed');
    } finally {
      setIsDeploying(false);
    }
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    if (authAction === 'dashboard') {
      setShowDashboard(true);
    } else if (authAction === 'deploy') {
      setDeployName(projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
      setShowDeployModal(true);
    }
    setAuthAction('');
  };

  const handleDeleteDeployment = async (id) => {
    if (!confirm('Are you sure you want to delete this deployment?')) return;
    try {
      await apiFetch(`/api/deployments/${id}`, { method: 'DELETE' });
      toast.success('Deployment deleted');
      fetchDeployments();
    } catch (err) {
      toast.error('Failed to delete deployment');
    }
  };

  // Load from URL hash on mount (shared project)
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      try {
        const decoded = LZString.decompressFromEncodedURIComponent(hash);
        if (decoded) {
          const { html: h, css: c, js: j, name: n } = JSON.parse(decoded);
          if (h !== undefined) setHtml(h);
          if (c !== undefined) setCss(c);
          if (j !== undefined) setJs(j);
          if (n) setProjectName(n);
          toast.success('Shared project loaded!');
        }
      } catch {
        // Ignore corrupt hash
      }
    }
  }, []);

  // Esc key exits IDE
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && !showDeployModal && !showProjectsPanel) {
        navigate('/utilities');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate, showDeployModal, showProjectsPanel]);

  // Console capture from iframe
  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data?.type === 'console') {
        setConsoleLogs(prev => [...prev.slice(-100), {
          method: e.data.method,
          args: e.data.args,
          ts: new Date().toLocaleTimeString()
        }]);
        if (!showConsole) setShowConsole(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [showConsole]);

  // Debounced auto-run
  const triggerPreview = useCallback(() => {
    setPreviewKey(k => k + 1);
  }, []);

  useEffect(() => {
    if (!autoRun) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(triggerPreview, 500);
    return () => clearTimeout(debounceRef.current);
  }, [html, css, js, autoRun, triggerPreview]);

  const handleSave = () => {
    const project = { name: projectName, html, css, js, savedAt: new Date().toISOString() };
    const existing = loadProjects();
    const idx = existing.findIndex(p => p.name === projectName);
    if (idx >= 0) existing[idx] = project;
    else existing.unshift(project);
    saveProjects(existing);
    setSavedProjects(loadProjects());
    toast.success(`"${projectName}" saved!`);
  };

  const handleLoad = (project) => {
    setHtml(project.html);
    setCss(project.css);
    setJs(project.js);
    setProjectName(project.name);
    setShowProjectsPanel(false);
    window.location.hash = '';
    toast.success(`Loaded "${project.name}"`);
  };

  const handleDeleteProject = (name) => {
    const updated = loadProjects().filter(p => p.name !== name);
    saveProjects(updated);
    setSavedProjects(updated);
  };

  const handleShare = () => {
    const encoded = LZString.compressToEncodedURIComponent(JSON.stringify({ html, css, js, name: projectName }));
    const url = `${window.location.origin}${window.location.pathname}#${encoded}`;
    window.location.hash = encoded;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Share link copied to clipboard!');
    });
  };

  const handleDownload = () => {
    const content = getSrcDoc(html, css, js);
    const blob = new Blob([content], { type: 'text/html' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${projectName}.html` });
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('Downloaded as HTML file');
  };

  const handleReset = () => {
    setHtml(DEFAULT_HTML);
    setCss(DEFAULT_CSS);
    setJs(DEFAULT_JS);
    setProjectName('Untitled Project');
    setConsoleLogs([]);
    window.location.hash = '';
    toast.success('Editor reset to defaults');
  };

  const getCode = () => ({ html, css, js }[activeTab]);
  const setCode = (v) => ({ html: setHtml, css: setCss, js: setJs }[activeTab](v));

  const VOID_TAGS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);

  const handleIdeKeyDown = (e) => {
    const el = e.target;
    const { selectionStart: ss, selectionEnd: se, value } = el;

    if (e.key === 'Tab') {
      e.preventDefault();
      if (ss === se) {
        // No selection — insert 2 spaces
        const next = value.slice(0, ss) + '  ' + value.slice(se);
        setCode(next);
        requestAnimationFrame(() => el.setSelectionRange(ss + 2, ss + 2));
      } else {
        // Multi-line indent / dedent
        const before = value.slice(0, ss);
        const selected = value.slice(ss, se);
        const after = value.slice(se);
        if (e.shiftKey) {
          const result = selected.replace(/^ {1,2}/gm, '');
          setCode(before + result + after);
          requestAnimationFrame(() => el.setSelectionRange(ss, ss + result.length));
        } else {
          const result = selected.replace(/^/gm, '  ');
          setCode(before + result + after);
          requestAnimationFrame(() => el.setSelectionRange(ss, ss + result.length));
        }
      }
      return;
    }

    // Auto-close HTML tags on '>'
    if (e.key === '>' && activeTab === 'html') {
      const before = value.slice(0, ss);
      const match = before.match(/<([a-zA-Z][a-zA-Z0-9]*)([^>]*)$/);
      if (match) {
        const tag = match[1].toLowerCase();
        const attrs = match[2];
        if (!VOID_TAGS.has(tag) && !attrs.trimEnd().endsWith('/')) {
          e.preventDefault();
          const insert = `></${tag}>`;
          const next = before + insert + value.slice(se);
          setCode(next);
          requestAnimationFrame(() => el.setSelectionRange(ss + 1, ss + 1));
          return;
        }
      }
    }
  };

  const tabColor = { html: '#f97316', css: '#3b82f6', js: '#f59e0b' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0d0d14', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        .ide-titlebar { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 1rem; background: #12121c; border-bottom: 1px solid rgba(255,255,255,0.07); flex-shrink: 0; }
        .ide-project-name { background: transparent; border: 1px solid transparent; color: #e2e8f0; font-size: 0.9rem; font-weight: 500; padding: 0.25rem 0.5rem; border-radius: 6px; outline: none; width: 200px; transition: border-color 0.2s; }
        .ide-project-name:hover, .ide-project-name:focus { border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); }
        .ide-btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.8rem; border-radius: 6px; border: none; font-size: 0.8rem; font-weight: 500; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .ide-btn-primary { background: #6366f1; color: white; }
        .ide-btn-primary:hover { background: #4f46e5; }
        .ide-btn-ghost { background: rgba(255,255,255,0.06); color: #94a3b8; }
        .ide-btn-ghost:hover { background: rgba(255,255,255,0.12); color: #e2e8f0; }
        .ide-btn-run { background: #10b981; color: white; }
        .ide-btn-run:hover { background: #059669; }
        .ide-btn-danger { background: rgba(239,68,68,0.1); color: #f87171; }
        .ide-btn-danger:hover { background: rgba(239,68,68,0.2); }
        .ide-body { display: grid; grid-template-columns: 1fr 1fr; flex: 1; overflow: hidden; gap: 0; }
        .ide-editor-col { display: flex; flex-direction: column; border-right: 1px solid rgba(255,255,255,0.07); overflow: hidden; }
        .ide-tabs { display: flex; background: #0a0a12; border-bottom: 1px solid rgba(255,255,255,0.07); flex-shrink: 0; }
        .ide-tab { padding: 0.6rem 1.1rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; border: none; background: transparent; color: #64748b; border-bottom: 2px solid transparent; transition: all 0.15s; letter-spacing: 0.02em; }
        .ide-tab:hover { color: #94a3b8; }
        .ide-tab.active-html { color: #f97316; border-bottom-color: #f97316; background: rgba(249,115,22,0.06); }
        .ide-tab.active-css { color: #3b82f6; border-bottom-color: #3b82f6; background: rgba(59,130,246,0.06); }
        .ide-tab.active-js { color: #f59e0b; border-bottom-color: #f59e0b; background: rgba(245,158,11,0.06); }
        .ide-textarea { flex: 1; width: 100%; padding: 1rem; background: #0d0d14; border: none; color: #e2e8f0; font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace; font-size: 0.85rem; line-height: 1.7; resize: none; outline: none; overflow-y: auto; }
        .ide-preview-col { display: flex; flex-direction: column; overflow: hidden; }
        .ide-preview-header { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.85rem; background: #12121c; border-bottom: 1px solid rgba(255,255,255,0.07); flex-shrink: 0; font-size: 0.78rem; color: #64748b; }
        .ide-iframe { flex: 1; border: none; background: white; }
        .ide-console { flex-shrink: 0; max-height: 160px; overflow-y: auto; background: #07070d; border-top: 1px solid rgba(255,255,255,0.07); font-family: monospace; font-size: 0.75rem; }
        .ide-console-header { display: flex; align-items: center; justify-content: space-between; padding: 0.35rem 0.85rem; background: #0a0a12; border-bottom: 1px solid rgba(255,255,255,0.07); position: sticky; top: 0; font-size: 0.75rem; color: #64748b; }
        .ide-console-line { padding: 0.2rem 0.85rem; border-bottom: 1px solid rgba(255,255,255,0.03); }
        .ide-console-line.log { color: #94a3b8; }
        .ide-console-line.error { color: #f87171; }
        .ide-console-line.warn { color: #fbbf24; }
        .ide-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
        .ide-modal { background: #1a1a28; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 1.5rem; width: 420px; max-width: 90vw; }
        .ide-modal h3 { font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem; }
        .ide-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #e2e8f0; padding: 0.6rem 0.8rem; font-size: 0.9rem; outline: none; margin-bottom: 1rem; }
        .ide-input:focus { border-color: #6366f1; }
        .ide-projects-list { max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; }
        .ide-project-item { display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.8rem; background: rgba(255,255,255,0.04); border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); cursor: pointer; transition: background 0.15s; }
        .ide-project-item:hover { background: rgba(255,255,255,0.08); }
        .ide-esc-hint { font-size: 0.7rem; color: #334155; margin-left: auto; }
        @media (max-width: 900px) { .ide-body { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; } .ide-editor-col { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.07); } }
      `}</style>

      {/* Title Bar */}
      <div className="ide-titlebar">
        <button className="ide-btn ide-btn-ghost" onClick={() => navigate('/utilities')} title="Back to Utilities (Esc)">
          <ChevronLeft size={14} /> Exit
        </button>

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 0.25rem' }} />

        <Code size={14} style={{ color: '#6366f1', flexShrink: 0 }} />
        <input
          className="ide-project-name"
          value={projectName}
          onChange={e => setProjectName(e.target.value)}
          placeholder="Project name..."
        />

        <div style={{ flex: 1 }} />

        <button className="ide-btn ide-btn-run" onClick={triggerPreview} title="Run (auto-run is on by default)">
          <Play size={13} /> Run
        </button>

        <button
          className="ide-btn ide-btn-ghost"
          onClick={() => setAutoRun(a => !a)}
          title={autoRun ? 'Auto-run ON — click to disable' : 'Auto-run OFF — click to enable'}
          style={{ color: autoRun ? '#10b981' : '#64748b' }}
        >
          {autoRun ? <Zap size={13} /> : <ZapOff size={13} />}
          {autoRun ? 'Live' : 'Manual'}
        </button>

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 0.25rem' }} />

        <button className="ide-btn ide-btn-ghost" onClick={handleSave} title="Save to browser storage">
          <Save size={13} /> Save
        </button>
        <button className="ide-btn ide-btn-ghost" onClick={() => setShowProjectsPanel(true)} title="Open saved projects">
          Open
        </button>
        <button className="ide-btn ide-btn-ghost" onClick={handleShare} title="Generate shareable link">
          <Share2 size={13} /> Share
        </button>
        <button className="ide-btn ide-btn-ghost" onClick={handleDownload} title="Download as HTML file">
          <Download size={13} />
        </button>
        <button
          className="ide-btn ide-btn-ghost"
          onClick={() => {
            if (!user) {
              setAuthAction('dashboard');
              setShowAuthModal(true);
              return;
            }
            setShowDashboard(true);
          }}
          title="View my deployments"
        >
          <LayoutDashboard size={13} /> My Deployments
        </button>
        <button
          className="ide-btn ide-btn-primary"
          onClick={() => {
            if (!user) {
              setAuthAction('deploy');
              setShowAuthModal(true);
              return;
            }
            setDeployName(projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
            setShowDeployModal(true);
          }}
          title="Deploy as live site"
        >
          <Rocket size={13} /> Deploy
        </button>
        <button className="ide-btn ide-btn-danger" onClick={handleReset} title="Reset to defaults">
          <RotateCcw size={13} />
        </button>

        <span className="ide-esc-hint">Esc to exit</span>
      </div>

      {/* Main Editor + Preview */}
      <div className="ide-body">
        <div className="ide-editor-col">
          <div className="ide-tabs">
            {[['html', 'HTML', '#f97316'], ['css', 'CSS', '#3b82f6'], ['js', 'JS', '#f59e0b']].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`ide-tab${activeTab === id ? ` active-${id}` : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            className="ide-textarea"
            value={getCode()}
            onChange={e => setCode(e.target.value)}
            onKeyDown={handleIdeKeyDown}
            spellCheck={false}
            placeholder={activeTab === 'html' ? '<!-- HTML here -->' : activeTab === 'css' ? '/* CSS here */' : '// JS here'}
            style={{ caretColor: tabColor[activeTab] }}
          />
          <div style={{ flexShrink: 0, padding: '0.2rem 0.85rem', background: '#0a0a12', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.7rem', color: '#334155', display: 'flex', gap: '1rem' }}>
            <span><kbd style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 3, padding: '0 4px' }}>Tab</kbd> indent</span>
            <span><kbd style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 3, padding: '0 4px' }}>Shift+Tab</kbd> dedent</span>
            {activeTab === 'html' && <span><kbd style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 3, padding: '0 4px' }}>&gt;</kbd> auto-close tag</span>}
          </div>
        </div>

        <div className="ide-preview-col">
          <div className="ide-preview-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Monitor size={12} /> Live Preview
            </span>
            <button
              className="ide-btn ide-btn-ghost"
              onClick={() => setShowConsole(c => !c)}
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
            >
              <Terminal size={11} /> Console {consoleLogs.length > 0 && `(${consoleLogs.length})`}
            </button>
          </div>
          <iframe
            ref={iframeRef}
            key={previewKey}
            srcDoc={getSrcDoc(html, css, js)}
            className="ide-iframe"
            title="Preview"
            sandbox="allow-scripts"
          />
          {showConsole && (
            <div className="ide-console">
              <div className="ide-console-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Terminal size={11} /> Console</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setConsoleLogs([])} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '0.72rem' }}>Clear</button>
                  <button onClick={() => setShowConsole(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}><X size={12} /></button>
                </div>
              </div>
              {consoleLogs.length === 0 ? (
                <div style={{ padding: '0.5rem 0.85rem', color: '#334155', fontStyle: 'italic' }}>No output yet</div>
              ) : consoleLogs.map((log, i) => (
                <div key={i} className={`ide-console-line ${log.method}`}>
                  <span style={{ opacity: 0.4, marginRight: '0.5rem' }}>{log.ts}</span>
                  {log.args.join(' ')}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Saved Projects Modal */}
      {showProjectsPanel && (
        <div className="ide-modal-overlay" onClick={() => setShowProjectsPanel(false)}>
          <div className="ide-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Saved Projects</h3>
              <button onClick={() => setShowProjectsPanel(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            {savedProjects.length === 0 ? (
              <p style={{ color: '#475569', textAlign: 'center', padding: '1rem 0' }}>No saved projects yet. Click Save to store your work.</p>
            ) : (
              <div className="ide-projects-list">
                {savedProjects.map(p => (
                  <div key={p.name} className="ide-project-item">
                    <div onClick={() => handleLoad(p)} style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{p.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#475569' }}>{p.savedAt ? new Date(p.savedAt).toLocaleString() : ''}</div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteProject(p.name); }}
                      style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: '0.25rem' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deploy Modal */}
      {showDeployModal && (
        <div className="ide-modal-overlay" onClick={() => setShowDeployModal(false)}>
          <div className="ide-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Rocket size={18} style={{ color: '#6366f1' }} /> Deploy Project
              </h3>
              <button onClick={() => setShowDeployModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Deploy your project as a live website with a custom URL.
            </p>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>Project name (URL slug)</label>
            <input
              className="ide-input"
              value={deployName}
              onChange={e => setDeployName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              placeholder="my-project"
            />
            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#a5b4fc' }}>
              Your site will be live at:<br />
              <strong style={{ color: '#c7d2fe' }}>{deployBaseUrl}/{deployName || 'your-project'}</strong>
            </div>
            <button
              className="ide-btn ide-btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontSize: '0.9rem' }}
              onClick={handleDeploy}
              disabled={isDeploying}
            >
              <Rocket size={15} /> {isDeploying ? 'Processing...' : 'Deploy for ₹1000'}
            </button>
            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#334155', marginTop: '0.75rem' }}>
              One-time payment • Custom URL • Instant hosting
            </p>
          </div>
        </div>
      )}

      {/* Deployments Dashboard Modal */}
      {showDashboard && (
        <div className="ide-modal-overlay" onClick={() => setShowDashboard(false)}>
          <div className="ide-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>My Deployments</h3>
              <button onClick={() => setShowDashboard(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            {loadingDeployments ? (
              <p style={{ color: '#64748b', textAlign: 'center' }}>Loading deployments…</p>
            ) : myDeployments.length === 0 ? (
              <p style={{ color: '#64748b', textAlign: 'center' }}>No deployments yet. Click Deploy to publish your project.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.85rem', maxHeight: '340px', overflowY: 'auto' }}>
                {myDeployments.map((deployment) => (
                  <div key={deployment.id} style={{ padding: '0.9rem', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{deployment.project_name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{deployBaseUrl}/{deployment.slug}</div>
                      </div>
                      <button
                        className="ide-btn ide-btn-danger"
                        style={{ padding: '0.35rem 0.6rem' }}
                        onClick={() => handleDeleteDeployment(deployment.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                      <button
                        className="ide-btn ide-btn-ghost"
                        onClick={() => window.open(`${deployBaseUrl}/${deployment.slug}`, '_blank')}
                      >
                        Open live site
                      </button>
                      <button
                        className="ide-btn ide-btn-ghost"
                        onClick={() => { setProjectName(deployment.project_name); setHtml(deployment.html); setCss(deployment.css); setJs(deployment.js); setShowDashboard(false); toast.success('Loaded deployment into editor'); }}
                      >
                        Load into editor
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          setAuthAction('');
        }}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, RotateCcw, Download, Save, Share2, Rocket, X, Monitor, Code,
  Zap, ZapOff, ChevronLeft, Terminal, LayoutDashboard, ExternalLink,
  Trash2, Smartphone, Tablet, Command, Keyboard,
  PanelLeft, PanelRight, Rows, Columns, RefreshCw, Check, Plus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import LZString from 'lz-string';
import { useAuth } from '../../context/AuthContext';
import AuthModal from '../../components/AuthModal';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, foldKeymap } from '@codemirror/language';
import { closeBrackets, autocompletion, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { lintKeymap } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';
import { html as langHtml } from '@codemirror/lang-html';
import { css as langCss } from '@codemirror/lang-css';
import { javascript as langJs } from '@codemirror/lang-javascript';

const STORAGE_KEY = 'html-ide-v2-projects';
const MAX_SAVED = 10;

const DEFAULT_HTML = `<div class="container">
  <h1>Hello World!</h1>
  <p>Start editing to see live preview.</p>
  <button id="btn" onclick="handleClick()">Click Me</button>
</div>`;

const DEFAULT_CSS = `* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
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
  btn.textContent = 'Clicked! \u{1F389}';
  btn.style.background = 'linear-gradient(90deg, #10b981, #3b82f6)';
  setTimeout(() => {
    btn.textContent = 'Click Me';
    btn.style.background = 'linear-gradient(90deg, #00d4ff, #7c3aed)';
  }, 2000);
}`;

const CONSOLE_CAPTURE = `
const _o=console.log,_e=console.error,_w=console.warn,_i=console.info;
const _p=(m,a)=>window.parent.postMessage({type:'console',method:m,args:a.map(x=>{try{return typeof x==='object'?JSON.stringify(x,null,2):String(x)}catch{return String(x)}})}, '*');
console.log=(...a)=>{_p('log',a);_o(...a)};
console.error=(...a)=>{_p('error',a);_e(...a)};
console.warn=(...a)=>{_p('warn',a);_w(...a)};
console.info=(...a)=>{_p('info',a);_i(...a)};
window.onerror=(m,s,l,c)=>_p('error',[m+' (line '+l+':'+c+')']);
window.addEventListener('unhandledrejection',e=>_p('error',['Unhandled Promise: '+e.reason]));
`;

function getSrcDoc(html, css, js) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>${css}</style></head><body>${html}<script>${CONSOLE_CAPTURE}\n${js}<\/script></body></html>`;
}
function loadProjects() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function saveProjects(p) { localStorage.setItem(STORAGE_KEY, JSON.stringify(p.slice(0, MAX_SAVED))); }

const CDN_LIBRARIES = [
  { name: 'Tailwind CSS',    desc: 'Utility-first CSS framework',  code: '<script src="https://cdn.tailwindcss.com"></script>' },
  { name: 'Alpine.js',       desc: 'Minimal reactive framework',   code: '<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>' },
  { name: 'GSAP',            desc: 'Professional animation',       code: '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>' },
  { name: 'Three.js',        desc: '3D graphics in browser',       code: '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>' },
  { name: 'Anime.js',        desc: 'Lightweight animation engine', code: '<script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js"></script>' },
  { name: 'Chart.js',        desc: 'Beautiful data charts',        code: '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>' },
  { name: 'D3.js',           desc: 'Data-driven documents',        code: '<script src="https://d3js.org/d3.v7.min.js"></script>' },
  { name: 'p5.js',           desc: 'Creative coding & canvas',     code: '<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>' },
  { name: 'Matter.js',       desc: '2D physics engine',            code: '<script src="https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js"></script>' },
  { name: 'Confetti',        desc: 'Celebration particles',        code: '<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>' },
  { name: 'Typed.js',        desc: 'Typewriter animation',         code: '<script src="https://unpkg.com/typed.js@2.0.16/dist/typed.umd.js"></script>' },
  { name: 'Lodash',          desc: 'Utility functions',            code: '<script src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js"></script>' },
  { name: 'Axios',           desc: 'HTTP client',                  code: '<script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>' },
  { name: 'AOS',             desc: 'Animate on scroll',            code: '<link rel="stylesheet" href="https://unpkg.com/aos@2.3.1/dist/aos.css">\n<script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>' },
  { name: 'Bootstrap 5',     desc: 'CSS component framework',      code: '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">\n<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>' },
  { name: 'Swiper',          desc: 'Touch slider',                 code: '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css">\n<script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>' },
  { name: 'Font Awesome 6',  desc: '6000+ icons',                  code: '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">' },
  { name: 'Inter Font',      desc: 'Google Fonts — Inter',         code: '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">' },
  { name: 'Howler.js',       desc: 'Web audio',                    code: '<script src="https://cdnjs.cloudflare.com/ajax/libs/howler/2.2.3/howler.min.js"></script>' },
  { name: 'Socket.io Client',desc: 'Real-time comms',              code: '<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>' },
];

const COMMANDS = [
  { id: 'run',            label: 'Run Preview',              shortcut: 'Ctrl+Enter',   cat: 'Preview' },
  { id: 'toggle-autorun', label: 'Toggle Auto-run',          shortcut: 'Ctrl+Shift+R', cat: 'Preview' },
  { id: 'toggle-console', label: 'Toggle Console',           shortcut: 'Ctrl+`',       cat: 'Preview' },
  { id: 'device-desktop', label: 'Preview: Desktop',         shortcut: '',             cat: 'Preview' },
  { id: 'device-tablet',  label: 'Preview: Tablet (768px)',  shortcut: '',             cat: 'Preview' },
  { id: 'device-mobile',  label: 'Preview: Mobile (375px)',  shortcut: '',             cat: 'Preview' },
  { id: 'open-new-tab',   label: 'Open Preview in New Tab',  shortcut: '',             cat: 'Preview' },
  { id: 'save',           label: 'Save Project',             shortcut: 'Ctrl+S',       cat: 'File' },
  { id: 'open-projects',  label: 'Open Saved Projects',      shortcut: 'Ctrl+O',       cat: 'File' },
  { id: 'share',          label: 'Share — copy link',        shortcut: 'Ctrl+Shift+S', cat: 'File' },
  { id: 'download',       label: 'Download as HTML',         shortcut: 'Ctrl+Shift+D', cat: 'File' },
  { id: 'format',         label: 'Format CSS',               shortcut: 'Alt+Shift+F',  cat: 'File' },
  { id: 'copy-html',      label: 'Copy HTML to clipboard',   shortcut: '',             cat: 'File' },
  { id: 'copy-css',       label: 'Copy CSS to clipboard',    shortcut: '',             cat: 'File' },
  { id: 'copy-js',        label: 'Copy JS to clipboard',     shortcut: '',             cat: 'File' },
  { id: 'reset',          label: 'Reset Editor',             shortcut: '',             cat: 'File' },
  { id: 'deploy',         label: 'Deploy Project',           shortcut: '',             cat: 'Deploy' },
  { id: 'dashboard',      label: 'My Deployments',           shortcut: '',             cat: 'Deploy' },
  { id: 'tab-html',       label: 'Switch to HTML',           shortcut: 'Alt+H',        cat: 'Navigate' },
  { id: 'tab-css',        label: 'Switch to CSS',            shortcut: 'Alt+C',        cat: 'Navigate' },
  { id: 'tab-js',         label: 'Switch to JS',             shortcut: 'Alt+J',        cat: 'Navigate' },
  { id: 'libraries',      label: 'Add CDN Library',          shortcut: 'Alt+L',        cat: 'Navigate' },
  { id: 'layout-split',   label: 'Layout: Split',            shortcut: 'Alt+1',        cat: 'Layout' },
  { id: 'layout-editor',  label: 'Layout: Editor Only',      shortcut: 'Alt+2',        cat: 'Layout' },
  { id: 'layout-preview', label: 'Layout: Preview Only',     shortcut: 'Alt+3',        cat: 'Layout' },
  { id: 'layout-stacked', label: 'Layout: Stacked',          shortcut: 'Alt+4',        cat: 'Layout' },
  { id: 'shortcuts',      label: 'Keyboard Shortcuts',       shortcut: 'Ctrl+/',       cat: 'Help' },
];

const SHORTCUTS = [
  ['Ctrl+K','Command palette'],['Ctrl+Enter','Run preview'],['Ctrl+S','Save'],
  ['Ctrl+O','Open projects'],['Ctrl+Shift+S','Share link'],['Ctrl+Shift+D','Download'],
  ['Ctrl+Shift+R','Toggle auto-run'],['Ctrl+`','Toggle console'],['Ctrl+/','Shortcuts'],
  ['Alt+1','Split layout'],['Alt+2','Editor only'],['Alt+3','Preview only'],['Alt+4','Stacked'],
  ['Alt+H','HTML tab'],['Alt+C','CSS tab'],['Alt+J','JS tab'],['Alt+L','Libraries'],
  ['Alt+Shift+F','Format CSS'],['Ctrl+F','Find in editor'],['Ctrl+H','Find & replace'],
  ['Ctrl+Z','Undo'],['Ctrl+Shift+Z','Redo'],['Ctrl+D','Select next match'],
  ['Tab','Indent'],['Shift+Tab','Dedent'],['Ctrl+]','Fold'],['Ctrl+[','Unfold'],
  ['Esc','Close modal / Exit IDE'],
];

const CAT_COLORS = { Preview:'#6366f1', File:'#10b981', Deploy:'#f97316', Navigate:'#3b82f6', Layout:'#8b5cf6', Help:'#64748b' };

function createEditor(container, lang, doc, onChange, onCursor) {
  return new EditorView({
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(), highlightActiveLineGutter(), highlightSpecialChars(),
        history(), drawSelection(), dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(), syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(), closeBrackets(),
        autocompletion({ closeOnBlur: false }),
        rectangularSelection(), crosshairCursor(),
        highlightActiveLine(), highlightSelectionMatches(),
        foldGutter(),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, ...lintKeymap, indentWithTab]),
        lang,
        oneDark,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChange(u.state.doc.toString());
          if (u.selectionSet || u.docChanged) {
            const h = u.state.selection.main.head;
            const l = u.state.doc.lineAt(h);
            onCursor({ line: l.number, col: h - l.from + 1, length: u.state.doc.length });
          }
        }),
        EditorView.theme({
          '&': { height: '100%', background: '#0d0d14' },
          '.cm-editor': { height: '100%' },
          '.cm-scroller': { fontFamily: "'Fira Code','JetBrains Mono','Cascadia Code',Consolas,monospace", fontSize: '0.84rem', lineHeight: '1.7', overflow: 'auto' },
          '.cm-content': { padding: '0.75rem 0', minHeight: '100%', caretColor: '#6366f1' },
          '.cm-focused': { outline: 'none' },
          '.cm-gutters': { background: '#0a0a12', borderRight: '1px solid rgba(255,255,255,0.05)', color: '#3a3f55' },
          '.cm-lineNumbers .cm-gutterElement': { minWidth: '3.5ch', paddingRight: '0.75rem' },
          '.cm-activeLineGutter': { background: 'rgba(99,102,241,0.07)', color: '#6366f1' },
          '.cm-activeLine': { background: 'rgba(99,102,241,0.04)' },
          '&.cm-focused .cm-selectionBackground,.cm-selectionBackground': { background: 'rgba(99,102,241,0.25) !important' },
          '.cm-cursor': { borderLeft: '2px solid #6366f1' },
          '.cm-matchingBracket': { background: 'rgba(99,102,241,0.2)', borderRadius: '2px', outline: '1px solid rgba(99,102,241,0.4)' },
          '.cm-tooltip.cm-tooltip-autocomplete': { background: '#1a1b26', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden' },
          '.cm-completionLabel': { color: '#e2e8f0' },
          '.cm-completionDetail': { color: '#475569', marginLeft: '0.5rem', fontSize: '0.8em' },
          '.cm-completionMatchedText': { color: '#6366f1', fontWeight: '700', textDecoration: 'none' },
          '.cm-tooltip-autocomplete ul li[aria-selected]': { background: 'rgba(99,102,241,0.2)' },
          '.cm-panels': { background: '#0a0a12', borderTop: '1px solid rgba(255,255,255,0.07)' },
          '.cm-search': { padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
          '.cm-search input,.cm-search select': { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0', borderRadius: '5px', padding: '3px 8px', fontSize: '0.8rem', outline: 'none' },
          '.cm-search input:focus': { borderColor: '#6366f1' },
          '.cm-search button': { background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', borderRadius: '5px', padding: '3px 10px', fontSize: '0.78rem', cursor: 'pointer' },
          '.cm-search button:hover': { background: 'rgba(99,102,241,0.3)' },
          '.cm-search label': { color: '#64748b', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' },
          '.cm-searchMatch': { background: 'rgba(245,158,11,0.2)', borderRadius: '2px', outline: '1px solid rgba(245,158,11,0.4)' },
          '.cm-searchMatch.cm-searchMatch-selected': { background: 'rgba(245,158,11,0.45)' },
          '.cm-foldGutter .cm-gutterElement': { cursor: 'pointer', color: '#3a3f55' },
          '.cm-foldGutter .cm-gutterElement:hover': { color: '#6366f1' },
        }),
      ],
    }),
    parent: container,
  });
}

export default function HtmlIde() {
  const navigate = useNavigate();
  const { user, apiFetch } = useAuth();

  const [html, setHtml] = useState(DEFAULT_HTML);
  const [css, setCss] = useState(DEFAULT_CSS);
  const [js, setJs] = useState(DEFAULT_JS);
  const [projectName, setProjectName] = useState('Untitled Project');
  const [activeTab, setActiveTab] = useState('html');
  const [isDirty, setIsDirty] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, col: 1, length: DEFAULT_HTML.length });

  const [autoRun, setAutoRun] = useState(true);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewDevice, setPreviewDevice] = useState('desktop');
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [showConsole, setShowConsole] = useState(false);
  const [consoleFilter, setConsoleFilter] = useState('all');

  const [layout, setLayout] = useState('split');
  const [splitPos, setSplitPos] = useState(50);

  const [showProjects, setShowProjects] = useState(false);
  const [showDeploy, setShowDeploy] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authAction, setAuthAction] = useState('');
  const [showDashboard, setShowDashboard] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [palQ, setPalQ] = useState('');
  const [palIdx, setPalIdx] = useState(0);
  const [libSearch, setLibSearch] = useState('');

  const [deployStep, setDeployStep] = useState('name');
  const [deploySlug, setDeploySlug] = useState('');
  const [deployedUrl, setDeployedUrl] = useState('');
  const [savedProjects, setSavedProjects] = useState(loadProjects);
  const [deployments, setDeployments] = useState([]);
  const [loadingDeps, setLoadingDeps] = useState(false);

  const siteBase = import.meta.env.VITE_SITE_URL || 'https://multitoolhub.space';

  const refHtmlEl = useRef(null), refCssEl = useRef(null), refJsEl = useRef(null);
  const refHtmlV = useRef(null), refCssV = useRef(null), refJsV = useRef(null);
  const debRef = useRef(null), iframeRef = useRef(null), bodyRef = useRef(null);
  const dragRef = useRef(false), palInputRef = useRef(null), palListRef = useRef(null);
  const onCursorRef = useRef((c) => setCursor(c));

  // Init CodeMirror
  useEffect(() => {
    const mk = (setter) => (v) => { setter(v); setIsDirty(true); };
    const oc = (c) => onCursorRef.current(c);
    if (refHtmlEl.current && !refHtmlV.current) refHtmlV.current = createEditor(refHtmlEl.current, langHtml(), DEFAULT_HTML, mk(setHtml), oc);
    if (refCssEl.current && !refCssV.current) refCssV.current = createEditor(refCssEl.current, langCss(), DEFAULT_CSS, mk(setCss), oc);
    if (refJsEl.current && !refJsV.current) refJsV.current = createEditor(refJsEl.current, langJs(), DEFAULT_JS, mk(setJs), oc);
    return () => {
      refHtmlV.current?.destroy(); refHtmlV.current = null;
      refCssV.current?.destroy(); refCssV.current = null;
      refJsV.current?.destroy(); refJsV.current = null;
    };
  }, []);

  // Focus active editor + update cursor on tab switch
  useEffect(() => {
    const m = { html: refHtmlV, css: refCssV, js: refJsV };
    const v = m[activeTab]?.current;
    if (!v) return;
    setTimeout(() => v.focus(), 30);
    const h = v.state.selection.main.head;
    const l = v.state.doc.lineAt(h);
    setCursor({ line: l.number, col: h - l.from + 1, length: v.state.doc.length });
  }, [activeTab]);

  // Sync state → CM (for external loads)
  useEffect(() => { const v = refHtmlV.current; if (!v) return; const c = v.state.doc.toString(); if (c !== html) v.dispatch({ changes: { from: 0, to: c.length, insert: html } }); }, [html]);
  useEffect(() => { const v = refCssV.current; if (!v) return; const c = v.state.doc.toString(); if (c !== css) v.dispatch({ changes: { from: 0, to: c.length, insert: css } }); }, [css]);
  useEffect(() => { const v = refJsV.current; if (!v) return; const c = v.state.doc.toString(); if (c !== js) v.dispatch({ changes: { from: 0, to: c.length, insert: js } }); }, [js]);

  // Load from URL hash
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    try {
      const d = LZString.decompressFromEncodedURIComponent(hash);
      if (d) {
        const { html: h, css: c, js: j, name: n } = JSON.parse(d);
        if (h !== undefined) setHtml(h);
        if (c !== undefined) setCss(c);
        if (j !== undefined) setJs(j);
        if (n) setProjectName(n);
        toast.success('Shared project loaded!');
      }
    } catch {}
  }, []);

  const triggerPreview = useCallback(() => setPreviewKey(k => k + 1), []);

  useEffect(() => {
    if (!autoRun) return;
    clearTimeout(debRef.current);
    debRef.current = setTimeout(triggerPreview, 600);
    return () => clearTimeout(debRef.current);
  }, [html, css, js, autoRun, triggerPreview]);

  useEffect(() => {
    const h = (e) => {
      if (e.data?.type !== 'console') return;
      setConsoleLogs(p => [...p.slice(-299), { method: e.data.method, args: e.data.args, ts: new Date().toLocaleTimeString() }]);
      setShowConsole(true);
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current || !bodyRef.current) return;
      const rect = bodyRef.current.getBoundingClientRect();
      const pct = layout === 'stacked'
        ? ((e.clientY - rect.top) / rect.height) * 100
        : ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPos(Math.max(20, Math.min(80, pct)));
    };
    const onUp = () => { dragRef.current = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [layout]);

  useEffect(() => {
    const h = (e) => {
      const c = e.ctrlKey || e.metaKey, s = e.shiftKey, a = e.altKey;
      if (c && e.key === 'k') { e.preventDefault(); setShowPalette(p => !p); setPalQ(''); setPalIdx(0); return; }
      if (c && e.key === 'Enter') { e.preventDefault(); triggerPreview(); return; }
      if (c && !s && !a && e.key === 's') { e.preventDefault(); doSave(); return; }
      if (c && s && e.key === 'S') { e.preventDefault(); doShare(); return; }
      if (c && s && e.key === 'D') { e.preventDefault(); doDownload(); return; }
      if (c && s && e.key === 'R') { e.preventDefault(); setAutoRun(x => !x); return; }
      if (c && e.key === '`') { e.preventDefault(); setShowConsole(x => !x); return; }
      if (c && !s && e.key === 'o') { e.preventDefault(); setShowProjects(true); return; }
      if (c && e.key === '/') { e.preventDefault(); setShowShortcuts(x => !x); return; }
      if (a && e.key === '1') { e.preventDefault(); setLayout('split'); return; }
      if (a && e.key === '2') { e.preventDefault(); setLayout('editor'); return; }
      if (a && e.key === '3') { e.preventDefault(); setLayout('preview'); return; }
      if (a && e.key === '4') { e.preventDefault(); setLayout('stacked'); return; }
      if (a && e.key === 'h') { e.preventDefault(); setActiveTab('html'); return; }
      if (a && e.key === 'c') { e.preventDefault(); setActiveTab('css'); return; }
      if (a && e.key === 'j') { e.preventDefault(); setActiveTab('js'); return; }
      if (a && e.key === 'l') { e.preventDefault(); setActiveTab('libraries'); return; }
      if (a && s && e.key === 'F') { e.preventDefault(); doFormat(); return; }
      if (e.key === 'Escape') {
        if (showPalette) { setShowPalette(false); return; }
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (showProjects) { setShowProjects(false); return; }
        if (showDeploy) { setShowDeploy(false); return; }
        if (showDashboard) { setShowDashboard(false); return; }
        navigate('/utilities');
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [navigate, showPalette, showShortcuts, showProjects, showDeploy, showDashboard, triggerPreview]);

  useEffect(() => { if (showPalette) setTimeout(() => palInputRef.current?.focus(), 20); }, [showPalette]);
  useEffect(() => { setPalIdx(0); }, [palQ]);
  useEffect(() => { palListRef.current?.children[palIdx]?.scrollIntoView({ block: 'nearest' }); }, [palIdx]);
  useEffect(() => { if (showDashboard && user) fetchDeps(); }, [showDashboard, user]);

  const doSave = useCallback(() => {
    const p = { name: projectName, html, css, js, savedAt: new Date().toISOString() };
    const ex = loadProjects();
    const i = ex.findIndex(x => x.name === projectName);
    if (i >= 0) ex[i] = p; else ex.unshift(p);
    saveProjects(ex); setSavedProjects(loadProjects()); setIsDirty(false);
    toast.success(`Saved "${projectName}"`);
  }, [projectName, html, css, js]);

  const doShare = useCallback(() => {
    const enc = LZString.compressToEncodedURIComponent(JSON.stringify({ html, css, js, name: projectName }));
    window.location.hash = enc;
    navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#${enc}`).then(() => toast.success('Share link copied!'));
  }, [html, css, js, projectName]);

  const doDownload = useCallback(() => {
    const blob = new Blob([getSrcDoc(html, css, js)], { type: 'text/html' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${projectName}.html` });
    a.click(); URL.revokeObjectURL(a.href); toast.success('Downloaded!');
  }, [html, css, js, projectName]);

  const doFormat = useCallback(() => {
    if (activeTab !== 'css') { toast('Ctrl+F for search, use the CM search panel for find/replace', { icon: 'ℹ️' }); return; }
    const v = refCssV.current; if (!v) return;
    const raw = v.state.doc.toString();
    try {
      const fmt = raw.replace(/\s*{\s*/g, ' {\n  ').replace(/;\s*(?=[^\s}])/g, ';\n  ').replace(/\s*}\s*/g, '\n}\n\n').replace(/,\s*(?=[^\s])/g, ',\n').replace(/\n{3,}/g, '\n\n').trim();
      v.dispatch({ changes: { from: 0, to: raw.length, insert: fmt } });
      toast.success('CSS formatted');
    } catch { toast.error('Format failed'); }
  }, [activeTab]);

  const addLib = (lib) => {
    setHtml(prev => {
      const tag = `  ${lib.code}`;
      return /<\/head>/i.test(prev) ? prev.replace(/<\/head>/i, `${tag}\n</head>`) : `${tag}\n${prev}`;
    });
    setIsDirty(true); setActiveTab('html'); toast.success(`Added ${lib.name}`);
  };

  const fetchDeps = async () => {
    setLoadingDeps(true);
    try { const r = await apiFetch('/api/deployments'); const d = await r.json(); setDeployments(d.data || []); }
    catch { toast.error('Failed to load deployments'); }
    finally { setLoadingDeps(false); }
  };

  const doDeploy = async () => {
    if (!deploySlug) { toast.error('Enter a project name'); return; }
    setDeployStep('deploying');
    try {
      const r = await apiFetch('/api/deploy/free', { method: 'POST', body: JSON.stringify({ projectName, slug: deploySlug, html, css, js }) });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setDeployedUrl(d.url); setDeployStep('success'); fetchDeps(); toast.success('Deployed!');
    } catch (err) { toast.error(err.message || 'Deployment failed'); setDeployStep('name'); }
  };

  const doDeleteDep = async (id) => {
    if (!confirm('Delete this deployment?')) return;
    try { await apiFetch(`/api/deployments/${id}`, { method: 'DELETE' }); toast.success('Deleted'); fetchDeps(); }
    catch { toast.error('Failed'); }
  };

  const onAuthSuccess = () => {
    setShowAuth(false);
    if (authAction === 'dashboard') setShowDashboard(true);
    else if (authAction === 'deploy') { setDeploySlug(projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')); setDeployStep('name'); setShowDeploy(true); }
    setAuthAction('');
  };

  const doDeployClick = () => {
    if (!user) { setAuthAction('deploy'); setShowAuth(true); return; }
    setDeploySlug(projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
    setDeployStep('name'); setShowDeploy(true);
  };

  const runCommand = useCallback((id) => {
    setShowPalette(false);
    const actions = {
      run: () => triggerPreview(),
      'toggle-autorun': () => setAutoRun(x => !x),
      'toggle-console': () => setShowConsole(x => !x),
      'device-desktop': () => setPreviewDevice('desktop'),
      'device-tablet': () => setPreviewDevice('tablet'),
      'device-mobile': () => setPreviewDevice('mobile'),
      'open-new-tab': () => { const w = window.open('','_blank'); w.document.write(getSrcDoc(html,css,js)); w.document.close(); },
      save: doSave,
      'open-projects': () => setShowProjects(true),
      share: doShare,
      download: doDownload,
      format: doFormat,
      'copy-html': () => navigator.clipboard.writeText(html).then(() => toast.success('HTML copied!')),
      'copy-css': () => navigator.clipboard.writeText(css).then(() => toast.success('CSS copied!')),
      'copy-js': () => navigator.clipboard.writeText(js).then(() => toast.success('JS copied!')),
      reset: () => { if (!confirm('Reset?')) return; setHtml(DEFAULT_HTML); setCss(DEFAULT_CSS); setJs(DEFAULT_JS); setProjectName('Untitled Project'); setConsoleLogs([]); setIsDirty(false); window.location.hash = ''; toast.success('Reset'); },
      deploy: doDeployClick,
      dashboard: () => { if (!user) { setAuthAction('dashboard'); setShowAuth(true); } else setShowDashboard(true); },
      'tab-html': () => setActiveTab('html'),
      'tab-css': () => setActiveTab('css'),
      'tab-js': () => setActiveTab('js'),
      libraries: () => setActiveTab('libraries'),
      'layout-split': () => setLayout('split'),
      'layout-editor': () => setLayout('editor'),
      'layout-preview': () => setLayout('preview'),
      'layout-stacked': () => setLayout('stacked'),
      shortcuts: () => setShowShortcuts(true),
    };
    actions[id]?.();
  }, [triggerPreview, doSave, doShare, doDownload, doFormat, html, css, js, user]);

  const filteredCmds = palQ
    ? COMMANDS.filter(c => c.label.toLowerCase().includes(palQ.toLowerCase()) || c.cat.toLowerCase().includes(palQ.toLowerCase()))
    : COMMANDS;

  const filteredLogs = consoleFilter === 'all' ? consoleLogs : consoleLogs.filter(l => l.method === consoleFilter);

  const bodyGrid = () => {
    if (layout === 'editor') return { display: 'grid', gridTemplateColumns: '1fr' };
    if (layout === 'preview') return { display: 'grid', gridTemplateColumns: '1fr' };
    if (layout === 'stacked') return { display: 'grid', gridTemplateRows: `${splitPos}% 4px 1fr` };
    return { display: 'grid', gridTemplateColumns: `${splitPos}% 4px 1fr` };
  };

  const TC = { html: '#f97316', css: '#3b82f6', js: '#f59e0b', libraries: '#10b981' };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'#0d0d14', color:'#e2e8f0', fontFamily:'system-ui,sans-serif', overflow:'hidden' }}>
      <style>{`
        .i-tb{display:flex;align-items:center;gap:.42rem;padding:.38rem .65rem;background:#08080f;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0;overflow-x:auto;scrollbar-width:none}
        .i-tb::-webkit-scrollbar{display:none}
        .i-pn{background:transparent;border:1px solid transparent;color:#e2e8f0;font-size:.87rem;font-weight:500;padding:.18rem .42rem;border-radius:5px;outline:none;max-width:165px;min-width:70px;transition:.15s}
        .i-pn:hover,.i-pn:focus{border-color:rgba(255,255,255,.12);background:rgba(255,255,255,.04)}
        .dv{width:1px;height:16px;background:rgba(255,255,255,.07);margin:0 .05rem;flex-shrink:0}
        .b{display:inline-flex;align-items:center;gap:.3rem;padding:.26rem .58rem;border-radius:5px;border:none;font-size:.76rem;font-weight:500;cursor:pointer;transition:.12s;white-space:nowrap;flex-shrink:0}
        .bp{background:#6366f1;color:#fff}.bp:hover{background:#4f46e5;transform:translateY(-1px)}
        .bg{background:rgba(255,255,255,.05);color:#94a3b8}.bg:hover{background:rgba(255,255,255,.1);color:#e2e8f0}
        .bg.on{background:rgba(99,102,241,.15);color:#a5b4fc}
        .br{background:#10b981;color:#fff}.br:hover{background:#059669}
        .bd{background:rgba(239,68,68,.08);color:#f87171}.bd:hover{background:rgba(239,68,68,.18)}
        .bg{background:rgba(255,255,255,.05);color:#94a3b8}
        .grp{display:flex;background:rgba(255,255,255,.04);border-radius:6px;border:1px solid rgba(255,255,255,.06)}
        .grp .b{border-radius:0;background:transparent;padding:.26rem .48rem}.grp .b:hover,.grp .b.on{background:rgba(99,102,241,.2);color:#a5b4fc}
        .i-ec{display:flex;flex-direction:column;overflow:hidden;border-right:1px solid rgba(255,255,255,.06)}
        .i-tabs{display:flex;align-items:center;background:#07070d;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0}
        .tab{padding:.5rem .9rem;font-size:.76rem;font-weight:600;cursor:pointer;border:none;background:transparent;color:#475569;border-bottom:2px solid transparent;transition:.12s;white-space:nowrap}
        .tab:hover{color:#94a3b8}
        .tbi{background:none;border:none;color:#475569;cursor:pointer;padding:.35rem .52rem;display:flex;align-items:center;transition:.12s}.tbi:hover{color:#94a3b8}
        .i-sb{display:flex;align-items:center;gap:.5rem;padding:.2rem .65rem;background:#07070d;border-top:1px solid rgba(255,255,255,.05);flex-shrink:0;font-size:.7rem;color:#3d4460}
        .sbb{background:none;border:none;color:#3d4460;cursor:pointer;display:inline-flex;align-items:center;gap:.25rem;font-size:.7rem;padding:.08rem .28rem;border-radius:3px;transition:.12s}.sbb:hover{color:#94a3b8}
        .i-dh{background:rgba(255,255,255,.04);z-index:10;transition:background .15s;cursor:col-resize}.i-dh:hover,.i-dh:active{background:#6366f1}
        .i-dh.hz{cursor:row-resize}
        .i-pc{display:flex;flex-direction:column;overflow:hidden}
        .i-ph{display:flex;align-items:center;gap:.32rem;padding:.36rem .65rem;background:#0a0a12;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0;font-size:.73rem;color:#475569}
        .dvb{background:rgba(255,255,255,.04);border:none;color:#475569;cursor:pointer;padding:.22rem .4rem;border-radius:4px;display:flex;align-items:center;transition:.12s}.dvb:hover{background:rgba(255,255,255,.08);color:#94a3b8}.dvb.on{background:rgba(99,102,241,.2);color:#a5b4fc}
        .i-con{flex-shrink:0;height:188px;display:flex;flex-direction:column;background:#06060c;border-top:1px solid rgba(255,255,255,.06);font-family:'Fira Code',Consolas,monospace;font-size:.74rem}
        .i-ch{display:flex;align-items:center;justify-content:space-between;padding:.26rem .65rem;background:#0a0a12;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0}
        .cl{padding:.14rem .65rem;border-bottom:1px solid rgba(255,255,255,.02);display:flex;align-items:baseline;gap:.4rem;font-size:.72rem}
        .cl.log{color:#94a3b8}.cl.error{color:#f87171;background:rgba(248,113,113,.04)}.cl.warn{color:#fbbf24;background:rgba(251,191,36,.04)}.cl.info{color:#60a5fa}
        .cm{font-size:.63rem;font-weight:700;text-transform:uppercase;opacity:.5;min-width:2.3rem}
        .mo{position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:1000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px)}
        .md{background:#111119;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:1.35rem;width:440px;max-width:93vw;box-shadow:0 28px 80px rgba(0,0,0,.65)}
        .md h3{font-size:.96rem;font-weight:600;margin-bottom:.85rem}
        .ii{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:7px;color:#e2e8f0;padding:.5rem .75rem;font-size:.875rem;outline:none;margin-bottom:.75rem;box-sizing:border-box}
        .ii:focus{border-color:#6366f1}
        .pl{max-height:290px;overflow-y:auto;display:flex;flex-direction:column;gap:.32rem}
        .pi{display:flex;align-items:center;justify-content:space-between;padding:.52rem .72rem;background:rgba(255,255,255,.03);border-radius:7px;border:1px solid rgba(255,255,255,.06);cursor:pointer;transition:background .12s}
        .pi:hover{background:rgba(255,255,255,.07)}
        .pal{background:#111119;border:1px solid rgba(255,255,255,.12);border-radius:14px;width:580px;max-width:95vw;overflow:hidden;box-shadow:0 36px 80px rgba(0,0,0,.7)}
        .pal-in{width:100%;background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,.08);color:#e2e8f0;padding:.9rem 1.15rem;font-size:.93rem;outline:none;box-sizing:border-box}
        .pal-in::placeholder{color:#2d3748}
        .pal-ls{max-height:370px;overflow-y:auto;padding:.35rem}
        .pit{display:flex;align-items:center;justify-content:space-between;padding:.5rem .76rem;border-radius:7px;cursor:pointer;transition:background .08s}
        .pit:hover,.pit.sel{background:rgba(99,102,241,.14)}
        .i-lib{display:flex;flex-direction:column;flex:1;overflow:hidden}
        .lit{padding:.56rem .65rem;border-radius:7px;cursor:pointer;transition:background .1s;border:1px solid transparent;margin-bottom:.2rem}
        .lit:hover{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.08)}
        .sg{display:grid;grid-template-columns:1fr 1fr;gap:.45rem;max-height:390px;overflow-y:auto}
        .sr{display:flex;align-items:center;justify-content:space-between;padding:.35rem .52rem;background:rgba(255,255,255,.03);border-radius:5px}
        .sk{font-family:monospace;font-size:.69rem;color:#a5b4fc;background:rgba(99,102,241,.1);padding:.07rem .36rem;border-radius:3px;border:1px solid rgba(99,102,241,.2);white-space:nowrap}
        .sl{font-size:.75rem;color:#64748b}
        .cfb{background:none;border:none;cursor:pointer;padding:.12rem .3rem;border-radius:3px;font-size:.7rem;transition:.12s;font-family:monospace;color:#475569}.cfb:hover{background:rgba(255,255,255,.07);color:#94a3b8}.cfb.on{color:#a5b4fc}
        @media(max-width:720px){.sg{grid-template-columns:1fr}}
      `}</style>

      {/* Titlebar */}
      <div className="i-tb">
        <button className="b bg" onClick={() => navigate('/utilities')}><ChevronLeft size={12}/> Exit</button>
        <div className="dv"/>
        <Code size={12} style={{ color:'#6366f1', flexShrink:0 }}/>
        <input className="i-pn" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Project name…"/>
        {isDirty && <span style={{ width:6, height:6, background:'#f59e0b', borderRadius:'50%', flexShrink:0 }} title="Unsaved changes"/>}
        <div style={{ flex:1 }}/>
        <button className="b br" onClick={triggerPreview} title="Run (Ctrl+Enter)"><Play size={11}/> Run</button>
        <button className={`b bg ${autoRun ? 'on' : ''}`} onClick={() => setAutoRun(x => !x)} style={{ color: autoRun ? '#10b981' : undefined }} title="Toggle auto-run (Ctrl+Shift+R)">
          {autoRun ? <Zap size={11}/> : <ZapOff size={11}/>} {autoRun ? 'Live' : 'Manual'}
        </button>
        <div className="dv"/>
        <button className="b bg" onClick={doSave} title="Save (Ctrl+S)"><Save size={11}/> Save</button>
        <button className="b bg" onClick={() => setShowProjects(true)} title="Open projects (Ctrl+O)">Open</button>
        <button className="b bg" onClick={doShare} title="Share (Ctrl+Shift+S)"><Share2 size={11}/></button>
        <button className="b bg" onClick={doDownload} title="Download (Ctrl+Shift+D)"><Download size={11}/></button>
        <div className="dv"/>
        <div className="grp">
          {[['split','Split',Columns,'Alt+1'],['editor','Editor Only',PanelLeft,'Alt+2'],['preview','Preview Only',PanelRight,'Alt+3'],['stacked','Stacked',Rows,'Alt+4']].map(([id,label,Icon,sc]) => (
            <button key={id} className={`b ${layout===id ? 'on' : ''}`} onClick={() => setLayout(id)} title={`${label} (${sc})`}><Icon size={11}/></button>
          ))}
        </div>
        <div className="dv"/>
        <button className="b bg" onClick={() => { if (!user) { setAuthAction('dashboard'); setShowAuth(true); } else setShowDashboard(true); }} title="My deployments"><LayoutDashboard size={11}/></button>
        <button className="b bp" onClick={doDeployClick} title="Deploy"><Rocket size={11}/> Deploy</button>
        <button className="b bg" onClick={() => { setShowPalette(true); setPalQ(''); setPalIdx(0); }} title="Command palette (Ctrl+K)"><Command size={11}/></button>
        <button className="b bd" onClick={() => { if(!confirm('Reset editor to defaults?')) return; setHtml(DEFAULT_HTML); setCss(DEFAULT_CSS); setJs(DEFAULT_JS); setProjectName('Untitled Project'); setConsoleLogs([]); setIsDirty(false); window.location.hash=''; toast.success('Reset'); }} title="Reset to defaults"><RotateCcw size={11}/></button>
      </div>

      {/* Main body */}
      <div ref={bodyRef} style={{ ...bodyGrid(), flex:1, overflow:'hidden' }}>

        {/* Editor column */}
        {layout !== 'preview' && (
          <div className="i-ec">
            <div className="i-tabs">
              {[['html','HTML'],['css','CSS'],['js','JS'],['libraries','Libraries']].map(([id,label]) => (
                <button key={id} className="tab" onClick={() => setActiveTab(id)}
                  style={activeTab===id ? { color:TC[id], borderBottomColor:TC[id], background:`rgba(${id==='html'?'249,115,22':id==='css'?'59,130,246':id==='js'?'245,158,11':'16,185,129'},.06)` } : {}}>
                  {label}
                </button>
              ))}
              <div style={{ flex:1 }}/>
              <button className="tbi" onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts (Ctrl+/)"><Keyboard size={11}/></button>
            </div>

            {/* CodeMirror instances — all mounted, visibility toggled */}
            <div style={{ position:'relative', flex:1, overflow:'hidden', display: activeTab==='libraries' ? 'none' : 'flex', flexDirection:'column' }}>
              <div ref={refHtmlEl} style={{ position:'absolute', inset:0, visibility:activeTab==='html'?'visible':'hidden', pointerEvents:activeTab==='html'?'auto':'none' }}/>
              <div ref={refCssEl}  style={{ position:'absolute', inset:0, visibility:activeTab==='css'?'visible':'hidden',  pointerEvents:activeTab==='css'?'auto':'none' }}/>
              <div ref={refJsEl}   style={{ position:'absolute', inset:0, visibility:activeTab==='js'?'visible':'hidden',   pointerEvents:activeTab==='js'?'auto':'none' }}/>
            </div>

            {/* Libraries panel */}
            {activeTab === 'libraries' && (
              <div className="i-lib">
                <div style={{ padding:'.58rem .65rem', borderBottom:'1px solid rgba(255,255,255,.06)', flexShrink:0 }}>
                  <input className="ii" style={{ marginBottom:0 }} placeholder="Search libraries…" value={libSearch} onChange={e => setLibSearch(e.target.value)} autoFocus/>
                  <div style={{ fontSize:'.7rem', color:'#2d3748', marginTop:'.35rem' }}>Click to inject into HTML &lt;head&gt;</div>
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:'.45rem .55rem' }}>
                  {CDN_LIBRARIES.filter(l => l.name.toLowerCase().includes(libSearch.toLowerCase()) || l.desc.toLowerCase().includes(libSearch.toLowerCase())).map(lib => (
                    <div key={lib.name} className="lit" onClick={() => addLib(lib)}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ fontWeight:600, fontSize:'.83rem' }}>{lib.name}</span>
                        <Plus size={12} style={{ color:'#475569', flexShrink:0 }}/>
                      </div>
                      <div style={{ fontSize:'.71rem', color:'#475569', marginTop:'.1rem' }}>{lib.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status bar */}
            <div className="i-sb">
              <span style={{ color:TC[activeTab]||'#64748b', fontWeight:700, textTransform:'uppercase', fontSize:'.67rem', letterSpacing:'.04em' }}>
                {activeTab === 'libraries' ? 'CDN' : activeTab}
              </span>
              {activeTab !== 'libraries' && (
                <><span style={{ color:'#1e2435' }}>·</span>
                <span>Ln {cursor.line} · Col {cursor.col}</span>
                <span style={{ color:'#1e2435' }}>·</span>
                <span>{cursor.length} chars</span></>
              )}
              <div style={{ flex:1 }}/>
              {isDirty && <span style={{ color:'#f59e0b', fontWeight:700, fontSize:'.68rem' }}>● unsaved</span>}
              <button className="sbb" onClick={() => setShowConsole(x => !x)}><Terminal size={9}/> Console{consoleLogs.length>0 && ` (${consoleLogs.length})`}</button>
            </div>
          </div>
        )}

        {/* Drag handle */}
        {(layout==='split'||layout==='stacked') && (
          <div className={`i-dh${layout==='stacked'?' hz':''}`}
            onMouseDown={() => { dragRef.current=true; document.body.style.cursor=layout==='stacked'?'row-resize':'col-resize'; document.body.style.userSelect='none'; }}/>
        )}

        {/* Preview column */}
        {layout !== 'editor' && (
          <div className="i-pc">
            <div className="i-ph">
              <Monitor size={10}/>
              <span style={{ fontWeight:600, color:'#64748b' }}>Preview</span>
              <div style={{ display:'flex', gap:'.18rem', marginLeft:'.25rem' }}>
                {[['desktop',Monitor,'Desktop'],['tablet',Tablet,'Tablet (768px)'],['mobile',Smartphone,'Mobile (375px)']].map(([id,Icon,label]) => (
                  <button key={id} className={`dvb ${previewDevice===id?'on':''}`} onClick={() => setPreviewDevice(id)} title={label}><Icon size={11}/></button>
                ))}
              </div>
              <div style={{ flex:1 }}/>
              <button className="b bg" style={{ padding:'.16rem .4rem', fontSize:'.7rem' }} onClick={triggerPreview} title="Refresh"><RefreshCw size={9}/></button>
              <button className="b bg" style={{ padding:'.16rem .4rem', fontSize:'.7rem' }} onClick={() => { const w=window.open('','_blank'); w.document.write(getSrcDoc(html,css,js)); w.document.close(); }} title="Open in new tab"><ExternalLink size={9}/></button>
            </div>

            <div style={{ flex:1, overflow:'hidden', display:'flex', alignItems:'stretch', justifyContent:'center', background:'#07070d' }}>
              <div style={{ width: previewDevice==='mobile'?'375px':previewDevice==='tablet'?'768px':'100%', maxWidth:'100%', display:'flex', flexDirection:'column', transition:'width .35s cubic-bezier(.4,0,.2,1)', boxShadow: previewDevice!=='desktop'?'0 0 0 1px rgba(255,255,255,.07),0 24px 60px rgba(0,0,0,.4)':undefined }}>
                {previewDevice !== 'desktop' && (
                  <div style={{ background:'#0f0f1a', padding:'5px 12px', borderBottom:'1px solid rgba(255,255,255,.06)', fontSize:'.68rem', color:'#3a3f55', display:'flex', alignItems:'center', justifyContent:'center', gap:'.4rem', flexShrink:0 }}>
                    {previewDevice==='mobile' ? <Smartphone size={9}/> : <Tablet size={9}/>}
                    {previewDevice==='mobile' ? '375 × viewport (iPhone)' : '768 × viewport (iPad)'}
                  </div>
                )}
                <iframe ref={iframeRef} key={previewKey} srcDoc={getSrcDoc(html,css,js)} style={{ flex:1, border:'none', background:'#fff', display:'block' }} title="Preview" sandbox="allow-scripts"/>
              </div>
            </div>

            {showConsole && (
              <div className="i-con">
                <div className="i-ch">
                  <span style={{ display:'flex', alignItems:'center', gap:'.35rem', color:'#64748b', fontSize:'.72rem' }}>
                    <Terminal size={10}/> Console <span style={{ color:'#1e2435' }}>·</span> <span style={{ color:'#3a3f55' }}>{consoleLogs.length}</span>
                  </span>
                  <div style={{ display:'flex', gap:'.25rem', alignItems:'center' }}>
                    {['all','log','warn','error','info'].map(f => (
                      <button key={f} className={`cfb ${consoleFilter===f?'on':''}`} onClick={() => setConsoleFilter(f)}>{f}</button>
                    ))}
                    <button onClick={() => setConsoleLogs([])} style={{ background:'none', border:'none', color:'#475569', cursor:'pointer', fontSize:'.7rem', padding:'.08rem .28rem' }}>clear</button>
                    <button onClick={() => setShowConsole(false)} style={{ background:'none', border:'none', color:'#475569', cursor:'pointer', display:'flex' }}><X size={11}/></button>
                  </div>
                </div>
                <div style={{ overflowY:'auto', flex:1 }}>
                  {filteredLogs.length === 0
                    ? <div style={{ padding:'.5rem .65rem', color:'#2d3748', fontStyle:'italic', fontSize:'.72rem' }}>No output. Try console.log() in your JS.</div>
                    : filteredLogs.map((log,i) => (
                      <div key={i} className={`cl ${log.method}`}>
                        <span className="cm">{log.method}</span>
                        <span style={{ opacity:.28, fontSize:'.66rem', flexShrink:0 }}>{log.ts}</span>
                        <span style={{ wordBreak:'break-word', whiteSpace:'pre-wrap' }}>{log.args.join(' ')}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Command Palette */}
      {showPalette && (
        <div className="mo" onClick={() => setShowPalette(false)}>
          <div className="pal" onClick={e => e.stopPropagation()}>
            <input ref={palInputRef} className="pal-in" placeholder="Type a command or search…" value={palQ} onChange={e => setPalQ(e.target.value)}
              onKeyDown={e => {
                if (e.key==='ArrowDown') { e.preventDefault(); setPalIdx(i => Math.min(i+1, filteredCmds.length-1)); }
                else if (e.key==='ArrowUp') { e.preventDefault(); setPalIdx(i => Math.max(i-1, 0)); }
                else if (e.key==='Enter') { e.preventDefault(); if (filteredCmds[palIdx]) runCommand(filteredCmds[palIdx].id); }
                else if (e.key==='Escape') setShowPalette(false);
              }}
            />
            <div ref={palListRef} className="pal-ls">
              {filteredCmds.length === 0
                ? <div style={{ padding:'1rem', textAlign:'center', color:'#334155', fontSize:'.84rem' }}>No commands found</div>
                : filteredCmds.map((cmd,i) => (
                  <div key={cmd.id} className={`pit ${i===palIdx?'sel':''}`} onClick={() => runCommand(cmd.id)}>
                    <div style={{ display:'flex', alignItems:'center', gap:'.55rem' }}>
                      <span style={{ fontSize:'.63rem', fontWeight:700, color:CAT_COLORS[cmd.cat]||'#64748b', textTransform:'uppercase', minWidth:'4.2rem', letterSpacing:'.04em' }}>{cmd.cat}</span>
                      <span style={{ fontSize:'.875rem', color:'#e2e8f0' }}>{cmd.label}</span>
                    </div>
                    {cmd.shortcut && <span style={{ fontSize:'.69rem', color:'#475569', background:'rgba(255,255,255,.06)', padding:'.08rem .42rem', borderRadius:'3px', fontFamily:'monospace', flexShrink:0 }}>{cmd.shortcut}</span>}
                  </div>
                ))}
            </div>
            <div style={{ padding:'.4rem .75rem', borderTop:'1px solid rgba(255,255,255,.06)', display:'flex', gap:'.85rem', fontSize:'.68rem', color:'#2d3748' }}>
              <span>↑↓ navigate</span><span>↵ execute</span><span>Esc close</span>
            </div>
          </div>
        </div>
      )}

      {/* Shortcuts Modal */}
      {showShortcuts && (
        <div className="mo" onClick={() => setShowShortcuts(false)}>
          <div className="md" style={{ width:560, maxWidth:'95vw' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
              <h3 style={{ margin:0, display:'flex', alignItems:'center', gap:'.45rem' }}><Keyboard size={14} style={{ color:'#6366f1' }}/> Keyboard Shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer' }}><X size={15}/></button>
            </div>
            <div className="sg">
              {SHORTCUTS.map(([key,label]) => (
                <div key={key} className="sr"><span className="sl">{label}</span><span className="sk">{key}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Saved Projects Modal */}
      {showProjects && (
        <div className="mo" onClick={() => setShowProjects(false)}>
          <div className="md" onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
              <h3 style={{ margin:0 }}>Saved Projects <span style={{ color:'#334155', fontSize:'.78rem', fontWeight:400 }}>({savedProjects.length}/{MAX_SAVED})</span></h3>
              <button onClick={() => setShowProjects(false)} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer' }}><X size={15}/></button>
            </div>
            {savedProjects.length === 0
              ? <p style={{ color:'#3a3f55', textAlign:'center', padding:'1.5rem 0', fontSize:'.86rem' }}>No saved projects. Press Ctrl+S to save.</p>
              : <div className="pl">
                  {savedProjects.map(p => (
                    <div key={p.name} className="pi">
                      <div onClick={() => { setHtml(p.html); setCss(p.css); setJs(p.js); setProjectName(p.name); setShowProjects(false); setIsDirty(false); window.location.hash=''; toast.success(`Loaded "${p.name}"`); }} style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:600, fontSize:'.875rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize:'.69rem', color:'#3a3f55', marginTop:'.1rem' }}>
                          {p.savedAt ? new Date(p.savedAt).toLocaleString() : ''}
                          {' · '}{Math.round(((p.html?.length||0)+(p.css?.length||0)+(p.js?.length||0))/1024*10)/10} KB
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); const u=loadProjects().filter(x=>x.name!==p.name); saveProjects(u); setSavedProjects(u); }} style={{ background:'none', border:'none', color:'#3a3f55', cursor:'pointer', padding:'.22rem', flexShrink:0 }}><X size={12}/></button>
                    </div>
                  ))}
                </div>}
          </div>
        </div>
      )}

      {/* Deploy Modal */}
      {showDeploy && (
        <div className="mo" onClick={() => setShowDeploy(false)}>
          <div className="md" onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.7rem' }}>
              <h3 style={{ margin:0, display:'flex', alignItems:'center', gap:'.45rem' }}><Rocket size={14} style={{ color:'#6366f1' }}/> Deploy Project</h3>
              <button onClick={() => setShowDeploy(false)} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer' }}><X size={15}/></button>
            </div>
            {(deployStep==='name'||deployStep==='deploying') && (
              <>
                <p style={{ color:'#475569', fontSize:'.83rem', marginBottom:'.95rem' }}>Deploy as a free live website with a custom URL.</p>
                <label style={{ fontSize:'.77rem', color:'#94a3b8', display:'block', marginBottom:'.32rem' }}>URL slug</label>
                <input className="ii" value={deploySlug} onChange={e => setDeploySlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'-'))} placeholder="my-project" disabled={deployStep==='deploying'}/>
                <div style={{ background:'rgba(99,102,241,.07)', border:'1px solid rgba(99,102,241,.18)', borderRadius:8, padding:'.65rem', marginBottom:'.95rem', fontSize:'.79rem', color:'#8b8fc7' }}>
                  <strong style={{ color:'#a5b4fc' }}>{siteBase}/p/you/{deploySlug||'your-project'}</strong>
                </div>
                <button className="b bp" style={{ width:'100%', justifyContent:'center', padding:'.65rem', fontSize:'.88rem' }} onClick={doDeploy} disabled={deployStep==='deploying'}>
                  <Rocket size={13}/> {deployStep==='deploying' ? 'Deploying…' : 'Deploy Free'}
                </button>
                <p style={{ textAlign:'center', fontSize:'.71rem', color:'#2d3748', marginTop:'.55rem' }}>Free · Custom URL · Instant</p>
              </>
            )}
            {deployStep==='success' && (
              <div style={{ textAlign:'center', padding:'.5rem 0' }}>
                <Check size={34} style={{ color:'#10b981', margin:'0 auto .65rem' }}/>
                <p style={{ color:'#10b981', fontWeight:600, marginBottom:'.35rem' }}>Deployed!</p>
                <a href={deployedUrl} target="_blank" rel="noreferrer" style={{ color:'#a5b4fc', fontSize:'.84rem', wordBreak:'break-all' }}>{deployedUrl}</a>
                <div style={{ display:'flex', gap:'.45rem', marginTop:'1rem' }}>
                  <button className="b bp" style={{ flex:1, justifyContent:'center' }} onClick={() => window.open(deployedUrl,'_blank')}><ExternalLink size={11}/> Open</button>
                  <button className="b bg" style={{ flex:1, justifyContent:'center' }} onClick={() => setShowDeploy(false)}>Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deployments Dashboard */}
      {showDashboard && (
        <div className="mo" onClick={() => setShowDashboard(false)}>
          <div className="md" style={{ width:500 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
              <h3 style={{ margin:0 }}>My Deployments</h3>
              <button onClick={() => setShowDashboard(false)} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer' }}><X size={15}/></button>
            </div>
            {loadingDeps
              ? <p style={{ color:'#475569', textAlign:'center', padding:'1rem' }}>Loading…</p>
              : deployments.length === 0
                ? <p style={{ color:'#3a3f55', textAlign:'center', padding:'1.5rem 0', fontSize:'.86rem' }}>No deployments yet.</p>
                : <div style={{ display:'flex', flexDirection:'column', gap:'.65rem', maxHeight:'350px', overflowY:'auto' }}>
                    {deployments.map(d => (
                      <div key={d.id} style={{ padding:'.8rem', borderRadius:10, background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.07)' }}>
                        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'.45rem' }}>
                          <div>
                            <div style={{ fontWeight:600, fontSize:'.875rem' }}>{d.project_name}</div>
                            <div style={{ fontSize:'.74rem', color:'#475569', marginTop:'.18rem' }}>
                              {d.username ? `${siteBase}/p/${d.username}/${d.slug}` : `${siteBase}/d/${d.slug}`}
                              {d.views>0 && <span style={{ marginLeft:'.4rem', color:'#6366f1' }}>· {d.views} views</span>}
                            </div>
                          </div>
                          <button className="b bd" style={{ padding:'.24rem .45rem', flexShrink:0 }} onClick={() => doDeleteDep(d.id)}><Trash2 size={11}/></button>
                        </div>
                        <div style={{ display:'flex', gap:'.35rem', marginTop:'.6rem', flexWrap:'wrap' }}>
                          <button className="b bg" style={{ fontSize:'.72rem' }} onClick={() => window.open(d.username?`${siteBase}/p/${d.username}/${d.slug}`:`${siteBase}/d/${d.slug}`,'_blank')}><ExternalLink size={10}/> Open</button>
                          <button className="b bg" style={{ fontSize:'.72rem' }} onClick={() => { setProjectName(d.project_name); setHtml(d.html); setCss(d.css); setJs(d.js); setShowDashboard(false); toast.success('Loaded into editor'); }}>Load into editor</button>
                        </div>
                      </div>
                    ))}
                  </div>}
          </div>
        </div>
      )}

      <AuthModal isOpen={showAuth} onClose={() => { setShowAuth(false); setAuthAction(''); }} onSuccess={onAuthSuccess}/>
    </div>
  );
}

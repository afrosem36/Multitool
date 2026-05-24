/**
 * BLUEPRINTX PANEL — three-mode dashboard creation UI
 * ─────────────────────────────────────────────────────────────────────────────
 * Mounted inside the schema/intelligence step of AiDashboardMaker.
 *
 * Three modes:
 *  1. Multi Tool Hub AI  → backend Gemini → OpenAI → Groq (uses app credits)
 *  2. BlueprintX         → user pastes ChatGPT/Gemini JSON (zero app credits) — RECOMMENDED
 *  3. Local Smart Builder → fully deterministic, no AI at all
 *
 * Each mode resolves to the same internal multi-tab plan, so the downstream
 * DashboardCanvas does not need to know which mode produced it.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Brain, Sparkles, Cpu, MessageSquare, ClipboardPaste,
  CheckCircle, AlertTriangle, Zap, RefreshCw, ExternalLink,
  Wand2, Eye, Layers, ListChecks, X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  generateAIBlueprintPrompt, openChatGPTWithBlueprintPrompt, openGeminiWithBlueprintPrompt,
  parseAIBlueprint, validateAIBlueprint, createLocalSmartBlueprint,
  hashDatasetSignature, getCachedBlueprint, setCachedBlueprint,
} from '../../engines/blueprintSchema';

// Modes ────────────────────────────────────────────────────────────────────────
const MODES = [
  {
    id: 'blueprintx',
    name: 'BlueprintX',
    badge: 'RECOMMENDED',
    badgeColor: '#22d3ee',
    tagline: 'Plan with ChatGPT/Gemini. Build locally.',
    description: 'Lowest API usage. Best control. Works even without backend AI credits.',
    Icon: Wand2,
    accent: '#22d3ee',
  },
  {
    id: 'multitool',
    name: 'Multi Tool Hub AI',
    badge: 'AUTOMATIC',
    badgeColor: '#818cf8',
    tagline: 'Backend AI generates the blueprint automatically.',
    description: 'Gemini 3.1 Flash Lite → OpenAI gpt-4.1-mini → Groq llama-3.3-70b fallback. Uses app API credits.',
    Icon: Brain,
    accent: '#818cf8',
  },
  {
    id: 'local',
    name: 'Local Smart Builder',
    badge: 'NO AI',
    badgeColor: '#10b981',
    tagline: 'Fully deterministic — instant, zero cost.',
    description: 'Uses the intelligence engine only. No API calls anywhere. Always works.',
    Icon: Cpu,
    accent: '#10b981',
  },
];

// ─── Mode Card ───────────────────────────────────────────────────────────────
function ModeCard({ mode, active, onClick, T }) {
  const Icon = mode.Icon;
  return (
    <button onClick={onClick}
      style={{
        textAlign:'left', cursor:'pointer', borderRadius:14, padding:'1rem 1.1rem',
        background: active ? `${mode.accent}10` : T.card,
        border: `1px solid ${active ? `${mode.accent}55` : T.border}`,
        boxShadow: active ? `0 4px 18px ${mode.accent}25` : 'none',
        display:'flex', flexDirection:'column', gap:'.55rem',
        transition:'all .15s', position:'relative',
      }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'.5rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
          <div style={{ width:30, height:30, borderRadius:8,
            background: `${mode.accent}18`, border: `1px solid ${mode.accent}40`,
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Icon size={14} style={{ color: mode.accent }}/>
          </div>
          <div style={{ fontWeight:700, fontSize:'.9rem', color:T.text }}>{mode.name}</div>
        </div>
        <span style={{ padding:'.15rem .5rem', borderRadius:100, fontSize:'.6rem', fontWeight:800,
          background: `${mode.badgeColor}15`, color: mode.badgeColor, border: `1px solid ${mode.badgeColor}30`,
          letterSpacing:'.05em' }}>
          {mode.badge}
        </span>
      </div>
      <div style={{ fontSize:'.75rem', color:T.text, fontWeight:600, lineHeight:1.4 }}>
        {mode.tagline}
      </div>
      <div style={{ fontSize:'.7rem', color:T.sub, lineHeight:1.5 }}>
        {mode.description}
      </div>
      {active && (
        <div style={{ position:'absolute', top:'.5rem', right:'.5rem' }}>
          <CheckCircle size={12} style={{ color: mode.accent }}/>
        </div>
      )}
    </button>
  );
}

// ─── Validation Stats ────────────────────────────────────────────────────────
function ValidationStatsPanel({ validation, T, source }) {
  if (!validation) return null;
  const { valid, errors, warnings, stats } = validation;
  const okColor = valid ? '#10b981' : '#ef4444';
  return (
    <div style={{ background: valid ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
      border: `1px solid ${valid ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.25)'}`,
      borderRadius:12, padding:'.85rem 1rem', display:'flex', flexDirection:'column', gap:'.55rem' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'.4rem' }}>
        {valid ? <CheckCircle size={13} style={{ color: okColor }}/> : <AlertTriangle size={13} style={{ color: okColor }}/>}
        <span style={{ fontSize:'.82rem', fontWeight:700, color: okColor }}>
          {valid ? 'Blueprint valid' : 'Blueprint invalid'}
        </span>
        {source === 'blueprintx' && valid && (
          <span style={{ marginLeft:'auto', fontSize:'.66rem', fontWeight:600, color:'#22d3ee',
            background:'rgba(34,211,238,0.1)', border:'1px solid rgba(34,211,238,0.25)',
            borderRadius:100, padding:'.18rem .55rem' }}>
            API SAVED — your own ChatGPT/Gemini was used
          </span>
        )}
      </div>

      {valid && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'.4rem' }}>
          {[
            { label:'Valid Tabs',    value: stats.validTabs,    accent: '#10b981' },
            { label:'Valid Charts',  value: stats.validCharts,  accent: '#10b981' },
            { label:'Valid KPIs',    value: stats.validKpis,    accent: '#10b981' },
            { label:'Dropped Charts',value: stats.invalidCharts,accent: stats.invalidCharts > 0 ? '#f59e0b' : T.sub },
            { label:'Dropped KPIs',  value: stats.invalidKpis,  accent: stats.invalidKpis > 0 ? '#f59e0b' : T.sub },
          ].map(s => (
            <div key={s.label} style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${T.border}`,
              borderRadius:8, padding:'.35rem .5rem', textAlign:'center' }}>
              <div style={{ fontSize:'1rem', fontWeight:800, color: s.accent }}>{s.value}</div>
              <div style={{ fontSize:'.58rem', color:T.sub, textTransform:'uppercase', letterSpacing:'.04em', marginTop:'.1rem' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {errors.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'.25rem' }}>
          {errors.map((e, i) => (
            <div key={i} style={{ fontSize:'.72rem', color:'#f87171' }}>
              <span style={{ fontWeight:700 }}>✗</span> {e}
            </div>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <details style={{ marginTop:'.1rem' }}>
          <summary style={{ fontSize:'.7rem', color:T.sub, cursor:'pointer', fontWeight:600 }}>
            {warnings.length} warning{warnings.length === 1 ? '' : 's'} (click to view)
          </summary>
          <div style={{ marginTop:'.4rem', display:'flex', flexDirection:'column', gap:'.2rem',
            maxHeight:120, overflowY:'auto' }}>
            {warnings.map((w, i) => (
              <div key={i} style={{ fontSize:'.68rem', color:'#fbbf24' }}>
                <span style={{ fontWeight:700 }}>!</span> {w}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Main BlueprintX Panel ───────────────────────────────────────────────────
/**
 * Props:
 *  analysis          — semantic analysis output
 *  rows              — full row data (used locally for cache signature + final build)
 *  headers           — column names
 *  userPrompt        — user's freeform goal text
 *  columnHelp        — user's column hint text
 *  T                 — theme tokens
 *  onUserPromptChange, onColumnHelpChange — state writeback
 *  onGenerateBlueprint(mode, blueprintOrNull) — parent commits the dashboard.
 *      mode: 'blueprintx' | 'multitool' | 'local'
 *      blueprintOrNull: cleaned Blueprint v1.0 (or null → parent uses local builder)
 *  loading           — parent says it's building
 */
export default function BlueprintXPanel({
  analysis, rows, headers, userPrompt, columnHelp,
  onUserPromptChange, onColumnHelpChange,
  onGenerateBlueprint, loading, T,
}) {
  const [activeMode, setActiveMode] = useState('blueprintx');
  const [pastedText, setPastedText] = useState('');
  const [validation, setValidation] = useState(null);   // { valid, errors, warnings, stats, cleanedBlueprint }
  const [validationSource, setValidationSource] = useState(null); // 'blueprintx' | 'local'

  // Build the prompt once per (headers, prompt, columnHelp) change
  const blueprintPrompt = useMemo(() => {
    if (!analysis?.headers?.length) return '';
    return generateAIBlueprintPrompt({
      headers: analysis.headers,
      analysis,
      sampleRows: rows.slice(0, 5),
      rowCount: rows.length,
      detectedDomain: analysis.domain || 'generic',
      userPrompt: (userPrompt || '') + (columnHelp ? `\n\nColumn hints:\n${columnHelp}` : ''),
    });
  }, [analysis, rows, userPrompt, columnHelp]);

  const sig = useMemo(() => {
    if (!analysis?.headers?.length) return null;
    const semanticTypes = Object.fromEntries(analysis.headers.map(h => [h, analysis.colMeta?.[h]?.semanticType || '']));
    return hashDatasetSignature(analysis.headers, rows.length, semanticTypes);
  }, [analysis, rows]);

  // ── Mode actions ──────────────────────────────────────────────────────────

  const askChatGPT = useCallback(() => {
    if (!blueprintPrompt) return;
    const opened = openChatGPTWithBlueprintPrompt(blueprintPrompt);
    if (opened) toast('ChatGPT opened — copy the JSON it returns and paste it below', { icon:'✦', duration:5000 });
    else        toast('Prompt copied to clipboard — paste it into a new ChatGPT chat', { icon:'📋', duration:5000 });
  }, [blueprintPrompt]);

  const askGemini = useCallback(() => {
    if (!blueprintPrompt) return;
    const opened = openGeminiWithBlueprintPrompt(blueprintPrompt);
    if (opened) toast('Gemini opened — copy the JSON it returns and paste it below', { icon:'✦', duration:5000 });
    else        toast('Prompt copied to clipboard — paste it into a new Gemini chat', { icon:'📋', duration:5000 });
  }, [blueprintPrompt]);

  const copyPrompt = useCallback(async () => {
    if (!blueprintPrompt) return;
    try {
      await navigator.clipboard.writeText(blueprintPrompt);
      toast.success('Blueprint prompt copied');
    } catch {
      toast.error('Copy failed — select the prompt below and copy manually');
    }
  }, [blueprintPrompt]);

  const validatePaste = useCallback(() => {
    if (!pastedText.trim()) {
      toast.error('Paste your AI blueprint JSON first');
      return;
    }
    const parsed = parseAIBlueprint(pastedText);
    if (!parsed.ok) {
      setValidation({ valid:false, errors:[parsed.error || 'Could not parse JSON'], warnings:[], stats:{ validTabs:0, validCharts:0, validKpis:0, invalidCharts:0, invalidKpis:0 } });
      setValidationSource('blueprintx');
      return;
    }
    const v = validateAIBlueprint(parsed.blueprint, analysis?.headers || [], analysis || {});
    setValidation(v);
    setValidationSource('blueprintx');
    if (v.valid) {
      if (sig) setCachedBlueprint(sig, v.cleanedBlueprint, 'blueprintx');
      toast.success(`Blueprint valid — ${v.stats.validTabs} tabs, ${v.stats.validCharts} charts`);
    } else {
      toast.error('Blueprint invalid — see errors below');
    }
  }, [pastedText, analysis, sig]);

  const buildFromPaste = useCallback(() => {
    if (!validation?.valid || !validation.cleanedBlueprint) {
      toast.error('Validate the blueprint first');
      return;
    }
    onGenerateBlueprint('blueprintx', validation.cleanedBlueprint);
  }, [validation, onGenerateBlueprint]);

  const buildMultiToolHub = useCallback(() => {
    onGenerateBlueprint('multitool', null);
  }, [onGenerateBlueprint]);

  const buildLocal = useCallback(() => {
    // Generate locally and pass through (no API call anywhere)
    const local = createLocalSmartBlueprint(rows, analysis?.headers || [], analysis || {}, userPrompt);
    onGenerateBlueprint('local', local);
  }, [rows, analysis, userPrompt, onGenerateBlueprint]);

  // ── Render ────────────────────────────────────────────────────────────────
  const active = MODES.find(m => m.id === activeMode);

  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:'1.15rem 1.25rem',
      display:'flex', flexDirection:'column', gap:'1rem' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'.4rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
          <Sparkles size={14} style={{ color:'#818cf8' }}/>
          <span style={{ fontSize:'.85rem', fontWeight:700, color:T.text }}>AI Dashboard Blueprint</span>
        </div>
        <span style={{ fontSize:'.68rem', color:T.sub }}>
          AI is the architect · Your app is the builder
        </span>
      </div>

      {/* Mode selector cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'.7rem' }}>
        {MODES.map(m => (
          <ModeCard key={m.id} mode={m} active={activeMode === m.id} onClick={() => setActiveMode(m.id)} T={T}/>
        ))}
      </div>

      {/* Custom prompt / column hints (used by all 3 modes) */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.7rem' }}>
        <div>
          <label style={{ fontSize:'.7rem', fontWeight:700, color:T.sub, display:'block',
            marginBottom:'.3rem', textTransform:'uppercase', letterSpacing:'.04em' }}>
            Custom goal <span style={{ opacity:.5, fontWeight:400, textTransform:'none' }}>(optional)</span>
          </label>
          <textarea rows={3} value={userPrompt} onChange={e => onUserPromptChange(e.target.value)}
            placeholder="e.g. Focus on agent performance and collection trends"
            style={{ width:'100%', background:T.input, border:`1px solid ${T.border}`, borderRadius:9,
              color:T.text, padding:'.5rem .65rem', fontSize:'.78rem', outline:'none', resize:'none',
              fontFamily:'inherit', boxSizing:'border-box' }}/>
        </div>
        <div>
          <label style={{ fontSize:'.7rem', fontWeight:700, color:T.sub, display:'block',
            marginBottom:'.3rem', textTransform:'uppercase', letterSpacing:'.04em' }}>
            Column hints <span style={{ opacity:.5, fontWeight:400, textTransform:'none' }}>(optional)</span>
          </label>
          <textarea rows={3} value={columnHelp} onChange={e => onColumnHelpChange(e.target.value)}
            placeholder={'e.g.\ncall_status = Answered / Not Answered\namount = payment in rupees'}
            style={{ width:'100%', background:T.input, border:`1px solid ${T.border}`, borderRadius:9,
              color:T.text, padding:'.5rem .65rem', fontSize:'.78rem', outline:'none', resize:'none',
              fontFamily:'inherit', boxSizing:'border-box' }}/>
        </div>
      </div>

      {/* ── Mode-specific actions ── */}

      {/* BLUEPRINTX MODE — manual paste */}
      {activeMode === 'blueprintx' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'.7rem' }}>
          <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
            <button onClick={askChatGPT}
              style={{ display:'inline-flex', alignItems:'center', gap:'.35rem',
                padding:'.45rem .85rem', background:'linear-gradient(135deg,#10a37f,#0d8d6e)', color:'#fff',
                border:'none', borderRadius:9, cursor:'pointer', fontSize:'.76rem', fontWeight:600,
                boxShadow:'0 3px 10px rgba(16,163,127,0.3)' }}>
              <MessageSquare size={11}/> Ask ChatGPT <ExternalLink size={10} style={{ opacity:.7 }}/>
            </button>
            <button onClick={askGemini}
              style={{ display:'inline-flex', alignItems:'center', gap:'.35rem',
                padding:'.45rem .85rem', background:'linear-gradient(135deg,#1a73e8,#185abc)', color:'#fff',
                border:'none', borderRadius:9, cursor:'pointer', fontSize:'.76rem', fontWeight:600,
                boxShadow:'0 3px 10px rgba(26,115,232,0.3)' }}>
              <Sparkles size={11}/> Ask Gemini <ExternalLink size={10} style={{ opacity:.7 }}/>
            </button>
            <button onClick={copyPrompt}
              style={{ display:'inline-flex', alignItems:'center', gap:'.35rem',
                padding:'.45rem .85rem', background:T.input, color:T.text,
                border:`1px solid ${T.border}`, borderRadius:9, cursor:'pointer', fontSize:'.76rem', fontWeight:600 }}>
              <ClipboardPaste size={11}/> Copy Prompt
            </button>
          </div>

          <div>
            <label style={{ fontSize:'.7rem', fontWeight:700, color:T.sub, display:'block',
              marginBottom:'.3rem', textTransform:'uppercase', letterSpacing:'.04em' }}>
              Paste AI Blueprint JSON here
            </label>
            <textarea
              rows={6}
              value={pastedText}
              onChange={e => { setPastedText(e.target.value); setValidation(null); }}
              placeholder={`{\n  "version": "1.0",\n  "reportTitle": "...",\n  "tabs": [...]\n}`}
              style={{ width:'100%', background:T.input, border:`1px solid ${T.border}`, borderRadius:9,
                color:T.text, padding:'.55rem .7rem', fontSize:'.74rem', outline:'none', resize:'vertical',
                fontFamily:'monospace', boxSizing:'border-box' }}/>
          </div>

          <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
            <button onClick={validatePaste} disabled={!pastedText.trim()}
              style={{ display:'inline-flex', alignItems:'center', gap:'.35rem',
                padding:'.5rem 1rem', background: pastedText.trim() ? T.input : T.hover,
                color: pastedText.trim() ? T.text : T.sub,
                border:`1px solid ${T.border}`, borderRadius:9,
                cursor: pastedText.trim() ? 'pointer' : 'not-allowed', fontSize:'.78rem', fontWeight:600 }}>
              <Eye size={11}/> Validate Blueprint
            </button>
            <button onClick={buildFromPaste} disabled={!validation?.valid || loading}
              style={{ display:'inline-flex', alignItems:'center', gap:'.35rem',
                padding:'.5rem 1.1rem',
                background: (validation?.valid && !loading) ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : T.hover,
                color: (validation?.valid && !loading) ? '#fff' : T.sub,
                border:'none', borderRadius:9,
                cursor: (validation?.valid && !loading) ? 'pointer' : 'not-allowed',
                fontSize:'.82rem', fontWeight:700,
                boxShadow: (validation?.valid && !loading) ? '0 4px 12px rgba(99,102,241,0.35)' : 'none' }}>
              {loading
                ? <><RefreshCw size={12} style={{ animation:'spin 1s linear infinite' }}/> Building…</>
                : <><Zap size={12}/> Build Dashboard From Blueprint</>}
            </button>
          </div>

          <ValidationStatsPanel validation={validation} T={T} source={validationSource}/>
        </div>
      )}

      {/* MULTI TOOL HUB AI MODE — backend auto */}
      {activeMode === 'multitool' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'.7rem' }}>
          <div style={{ fontSize:'.72rem', color:T.sub, lineHeight:1.5,
            padding:'.55rem .75rem', background:'rgba(129,140,248,0.05)',
            border:'1px solid rgba(129,140,248,0.15)', borderRadius:9 }}>
            <strong style={{ color:'#a5b4fc' }}>Heads up:</strong> This uses the app's backend AI credits.
            Fallback order: <strong>Gemini 3.1 Flash Lite</strong> → <strong>OpenAI gpt-4.1-mini</strong> → <strong>Groq llama-3.3-70b</strong>.
            If all three fail, the app falls back to Local Smart Builder automatically.
          </div>
          <button onClick={buildMultiToolHub} disabled={loading}
            style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:'.4rem',
              padding:'.6rem 1.2rem',
              background: loading ? T.hover : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: loading ? T.sub : '#fff', border:'none', borderRadius:10,
              cursor: loading ? 'not-allowed' : 'pointer', fontWeight:700, fontSize:'.86rem',
              boxShadow: loading ? 'none' : '0 4px 14px rgba(99,102,241,0.35)', alignSelf:'flex-start' }}>
            {loading
              ? <><RefreshCw size={13} style={{ animation:'spin 1s linear infinite' }}/> Generating…</>
              : <><Brain size={13}/> Generate Blueprint with Multi Tool Hub AI</>}
          </button>
        </div>
      )}

      {/* LOCAL MODE — no AI */}
      {activeMode === 'local' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'.7rem' }}>
          <div style={{ fontSize:'.72rem', color:T.sub, lineHeight:1.5,
            padding:'.55rem .75rem', background:'rgba(16,185,129,0.05)',
            border:'1px solid rgba(16,185,129,0.15)', borderRadius:9 }}>
            <strong style={{ color:'#34d399' }}>Local-only:</strong> No API call to any provider. The intelligence engine
            picks tabs, KPIs and charts deterministically from your column semantics.
            Best when you want zero cost and instant results.
          </div>
          <button onClick={buildLocal} disabled={loading}
            style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:'.4rem',
              padding:'.6rem 1.2rem',
              background: loading ? T.hover : 'linear-gradient(135deg,#10b981,#059669)',
              color: loading ? T.sub : '#fff', border:'none', borderRadius:10,
              cursor: loading ? 'not-allowed' : 'pointer', fontWeight:700, fontSize:'.86rem',
              boxShadow: loading ? 'none' : '0 4px 14px rgba(16,185,129,0.35)', alignSelf:'flex-start' }}>
            {loading
              ? <><RefreshCw size={13} style={{ animation:'spin 1s linear infinite' }}/> Building…</>
              : <><Cpu size={13}/> Use Local Smart Builder</>}
          </button>
        </div>
      )}
    </div>
  );
}

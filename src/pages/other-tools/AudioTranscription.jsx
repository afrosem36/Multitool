import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AlertTriangle, AudioLines, Brain, Check, ChevronDown, ChevronUp,
  ClipboardCheck, Copy, Download, FileAudio, FileText, Hash,
  Info, Loader, Lock, MessageSquare, Mic, Plus, RefreshCw,
  Settings2, Sparkles, Trash2, Upload, UserCircle2, X, Zap,
  CheckCircle2, Circle, ArrowRight, Globe, Shield, BarChart3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import ToolHeader from '../../components/shared/ToolHeader';
import { useAuth } from '../../context/AuthContext';
import { callAI, buildImproveTextPrompt, buildQaAnalysisPrompt, parseQaReport } from './audioAiHelpers';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_MB        = 500;
const MAX_FILE_BYTES     = MAX_FILE_MB * 1024 * 1024;
const ACCEPTED_AUDIO     = 'audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.webm';
const RETRY_ATTEMPTS     = 3;
const RETRY_DELAYS       = [1000, 2500, 5000];
const CHUNK_DURATION_SEC = 240;
const CHUNK_TRIGGER_SEC  = 290;
const GROQ_DIARIZE_MODEL = 'llama-3.1-8b-instant';
const FILLER_WORDS       = /\b(um+|uh+|hmm+|like|you know|i mean|sort of|kind of|basically|literally|actually|honestly|right\??|okay\??|so+|well+|anyway)\b/gi;

const SPEAKER_COLORS = [
  { bg:'rgba(56,189,248,0.08)',  border:'rgba(56,189,248,0.25)',  badge:'#38bdf8' },
  { bg:'rgba(167,139,250,0.08)', border:'rgba(167,139,250,0.25)', badge:'#a78bfa' },
  { bg:'rgba(52,211,153,0.08)',  border:'rgba(52,211,153,0.25)',  badge:'#34d399' },
  { bg:'rgba(251,191,36,0.08)',  border:'rgba(251,191,36,0.25)',  badge:'#fbbf24' },
  { bg:'rgba(248,113,113,0.08)', border:'rgba(248,113,113,0.25)', badge:'#f87171' },
];

const TRANSCRIPTION_MODES = [
  { value:'cheetah', label:'Cheetah', emoji:'🐆', badge:'Fast',     model:'whisper-large-v3-turbo' },
  { value:'dolphin', label:'Dolphin', emoji:'🐬', badge:'Balanced', model:'whisper-large-v3' },
  { value:'whale',   label:'Whale',   emoji:'🐳', badge:'Accurate', model:'whisper-large-v3' },
];

const OUTPUT_LANGUAGES = [
  { value:'original',   label:'🌐 Original (auto)' },
  { value:'english',    label:'🇬🇧 English' },
  { value:'hinglish',   label:'🇮🇳 Hinglish' },
  { value:'hindi',      label:'🇮🇳 Hindi' },
  { value:'spanish',    label:'🇪🇸 Spanish' },
  { value:'french',     label:'🇫🇷 French' },
  { value:'german',     label:'🇩🇪 German' },
  { value:'arabic',     label:'🇸🇦 Arabic' },
  { value:'portuguese', label:'🇧🇷 Portuguese' },
  { value:'russian',    label:'🇷🇺 Russian' },
  { value:'japanese',   label:'🇯🇵 Japanese' },
  { value:'korean',     label:'🇰🇷 Korean' },
  { value:'chinese',    label:'🇨🇳 Chinese' },
  { value:'turkish',    label:'🇹🇷 Turkish' },
  { value:'italian',    label:'🇮🇹 Italian' },
  { value:'dutch',      label:'🇳🇱 Dutch' },
];

const DEFAULT_QA_PARAMS = [
  { name:'Greeting',           marks:10 },
  { name:'Call Opening',       marks:10 },
  { name:'Situation Handling', marks:20 },
  { name:'Closing',            marks:10 },
];

// Pipeline stage definitions
const PIPELINE_STAGES = [
  { id:'uploading',    label:'Uploading',     icon:Upload },
  { id:'transcribing', label:'Transcribing',  icon:Mic },
  { id:'translating',  label:'Translating',   icon:Globe },
  { id:'analyzing',    label:'QA Analysis',   icon:BarChart3 },
  { id:'improving',    label:'Improving',     icon:Sparkles },
];

// ─── Audio utilities ──────────────────────────────────────────────────────────
function audioBufferToWavBlob(buffer) {
  const samples  = buffer.getChannelData(0);
  const dataSize = samples.length * 2;
  const ab       = new ArrayBuffer(44 + dataSize);
  const view     = new DataView(ab);
  const wr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
  wr(0,'RIFF'); view.setUint32(4,36+dataSize,true);
  wr(8,'WAVE'); wr(12,'fmt ');
  view.setUint32(16,16,true); view.setUint16(20,1,true);
  view.setUint16(22,1,true);  view.setUint32(24,buffer.sampleRate,true);
  view.setUint32(28,buffer.sampleRate*2,true); view.setUint16(32,2,true);
  view.setUint16(34,16,true); wr(36,'data'); view.setUint32(40,dataSize,true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    off += 2;
  }
  return new Blob([ab], { type:'audio/wav' });
}

async function splitAudioIntoChunks(file, onProgress) {
  const TARGET_SR   = 16000;
  const OVERLAP_SEC = 2;
  const audioCtx    = new AudioContext();
  const decoded     = await audioCtx.decodeAudioData(await file.arrayBuffer());
  await audioCtx.close();
  const srcSR        = decoded.sampleRate;
  const chunkSamples = Math.floor(srcSR * CHUNK_DURATION_SEC);
  const overlapSamp  = Math.floor(srcSR * OVERLAP_SEC);
  const stepSamples  = chunkSamples - overlapSamp;
  const totalSrc     = decoded.length;
  const numChunks    = Math.ceil((totalSrc - overlapSamp) / stepSamples);
  const blobs        = [];
  for (let i = 0; i < numChunks; i++) {
    const start  = i * stepSamples;
    const end    = Math.min(start + chunkSamples, totalSrc);
    const srcLen = end - start;
    const dstLen = Math.ceil(srcLen * TARGET_SR / srcSR);
    const off    = new OfflineAudioContext(1, dstLen, TARGET_SR);
    const mono   = off.createGain();
    mono.gain.value = 1 / decoded.numberOfChannels;
    mono.connect(off.destination);
    for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
      const tmp = new AudioBuffer({ length:srcLen, numberOfChannels:1, sampleRate:srcSR });
      tmp.getChannelData(0).set(decoded.getChannelData(ch).subarray(start, end));
      const src = off.createBufferSource();
      src.buffer = tmp; src.connect(mono); src.start(0);
    }
    blobs.push(audioBufferToWavBlob(await off.startRendering()));
    onProgress?.(i + 1, numChunks);
  }
  return { blobs, overlapSec:OVERLAP_SEC, stepSec:CHUNK_DURATION_SEC - OVERLAP_SEC };
}

function stitchChunks(transcripts) {
  if (transcripts.length === 0) return '';
  if (transcripts.length === 1) return transcripts[0];
  let result = transcripts[0];
  for (let i = 1; i < transcripts.length; i++) {
    const prev  = result.trimEnd();
    const next  = transcripts[i].trimStart();
    const pWords = prev.split(/\s+/);
    const nWords = next.split(/\s+/);
    let overlap  = 0;
    const maxCheck = Math.min(12, pWords.length, nWords.length);
    for (let len = maxCheck; len >= 1; len--) {
      if (pWords.slice(-len).join(' ').toLowerCase() === nWords.slice(0,len).join(' ').toLowerCase()) {
        overlap = len; break;
      }
    }
    const trimmedNext = overlap > 0 ? nWords.slice(overlap).join(' ') : next;
    result = prev + (trimmedNext ? ' ' + trimmedNext : '');
  }
  return result.trim();
}

async function getAudioDurationMin(file) {
  return new Promise(resolve => {
    const url   = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(audio.duration / 60); };
    audio.onerror          = () => { URL.revokeObjectURL(url); resolve(0); };
  });
}

async function parseJsonResponse(res) {
  const text = await res.text();
  let data;
  try   { data = text ? JSON.parse(text) : {}; }
  catch { throw new Error('Server returned invalid JSON'); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function apiFetchWithRetry(apiFetch, url, options = {}, attempts = RETRY_ATTEMPTS) {
  for (let i = 0; i < attempts; i++) {
    let res;
    try { res = await apiFetch(url, options); }
    catch (netErr) {
      if (i === attempts - 1) throw netErr;
      await new Promise(r => setTimeout(r, RETRY_DELAYS[i]));
      continue;
    }
    const noRetry = [400,401,403,404,413,429].includes(res.status);
    try { return await parseJsonResponse(res); }
    catch (err) {
      if (i === attempts - 1 || noRetry) throw err;
      await new Promise(r => setTimeout(r, RETRY_DELAYS[i]));
    }
  }
}

async function runDiarizationEngine(rawTranscript, apiFetch) {
  const escaped = rawTranscript.replace(/"/g, "'");
  const prompt = `You are an expert speaker diarization engine. Split the transcript into speaker turns.
RULES: Label speakers as "Speaker 1", "Speaker 2", etc. Do NOT change any wording.
Return ONLY valid JSON: [{"speaker":"Speaker 1","text":"..."},{"speaker":"Speaker 2","text":"..."}]
If one speaker: [{"speaker":"Speaker 1","text":"${escaped}"}]
TRANSCRIPT: ${rawTranscript}`;
  try {
    const res  = await apiFetch('/api/groq/chat', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ model:GROQ_DIARIZE_MODEL, messages:[{role:'user',content:prompt}], temperature:0.1, max_tokens:4096 }),
    });
    const data = await parseJsonResponse(res);
    const raw  = data?.choices?.[0]?.message?.content || data?.data?.content || data?.content || '';
    const clean = raw.replace(/```json|```/gi,'').trim();
    const parsed = JSON.parse(clean);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Empty');
    return parsed.filter(b => typeof b.speaker === 'string' && typeof b.text === 'string' && b.text.trim());
  } catch {
    return [{ speaker:'Speaker 1', text:rawTranscript }];
  }
}

function blocksToPlainText(blocks) {
  return blocks.map(b => `[${b.speaker}]: ${b.text}`).join('\n\n');
}

function cleanBlock(text, opts = {}) {
  if (!text) return '';
  let t = text.trim()
    .replace(/\s+/g,' ')
    .replace(/\s([.,!?;:])/g,'$1')
    .replace(/([.,!?;:])(?=[^\s])/g,'$1 ')
    .replace(/(^\s*|[.!?]\s+)([a-z])/g,(_,pre,ch)=>pre+ch.toUpperCase())
    .replace(/\[BLANK_AUDIO\]/gi,'').trim()
    .replace(/(\.\s*){3,}/g,'...');
  if (opts.stripFillers) t = t.replace(FILLER_WORDS,'').replace(/\s{2,}/g,' ').trim();
  if (opts.smartParagraphs) t = t.replace(/([.!?])\s{2,}([A-Z])/g,'$1\n\n$2');
  return (t.charAt(0).toUpperCase() + t.slice(1)).trim();
}

function runTextEngine(raw, opts = {}) {
  if (!raw) return '';
  const hasSpeakerMarkers = /^\[Speaker \d+\]:/m.test(raw);
  if (hasSpeakerMarkers) {
    return raw.split(/\n{2,}/).map(block => {
      const m = block.match(/^\[(.+?)\]:\s*([\s\S]*)$/);
      if (!m) return block;
      return `[${m[1]}]: ${cleanBlock(m[2], opts)}`;
    }).join('\n\n');
  }
  return cleanBlock(raw, opts);
}

function computeStats(text) {
  if (!text) return null;
  const plain = text.replace(/^\[Speaker \d+\]:\s*/gm,'');
  const words = plain.trim().split(/\s+/).filter(Boolean);
  const sents = plain.split(/[.!?]+/).filter(s => s.trim().length > 2);
  const avgWL = words.reduce((s,w) => s + w.replace(/[^a-z]/gi,'').length, 0) / Math.max(words.length, 1);
  const avgSL = words.length / Math.max(sents.length, 1);
  const fk    = Math.max(0, Math.min(100, 206.835 - 1.015 * avgSL - 84.6 * (avgWL / 4.5)));
  return {
    wordCount:        words.length,
    sentenceCount:    sents.length,
    readabilityLabel: fk > 70 ? 'Easy' : fk > 50 ? 'Moderate' : 'Complex',
    estimatedReadMin: Math.ceil(words.length / 200),
  };
}

function generateSRT(text) {
  const plain = text.replace(/^\[Speaker \d+\]:\s*/gm,'');
  const sents = plain.split(/(?<=[.!?])\s+/).filter(Boolean);
  let srt = '', t = 0;
  sents.forEach((s, i) => {
    const dur = Math.max(2, Math.ceil(s.split(' ').length * 0.4));
    const fmt = sec => `${String(Math.floor(sec/3600)).padStart(2,'0')}:${String(Math.floor((sec%3600)/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')},000`;
    srt += `${i+1}\n${fmt(t)} --> ${fmt(t+dur)}\n${s}\n\n`;
    t += dur;
  });
  return srt;
}

function downloadFile(content, filename, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type:mime }));
  a.download = filename;
  a.click();
}

// ─── Build AI translation prompt ──────────────────────────────────────────────
function buildTranslationPrompt(transcript, targetLanguage) {
  return [
    { role:'system', content:`You are a professional translator. Translate the following transcript to ${targetLanguage}.
RULES:
- Preserve ALL speaker labels ([Speaker N]:) exactly
- Preserve timestamps if present
- Keep names and proper nouns unchanged
- Make the translation sound natural and professional
- Return ONLY the translated transcript, nothing else.` },
    { role:'user', content:`Translate to ${targetLanguage}:\n\n${transcript}` },
  ];
}

// ─── SpeakerBlocks renderer ───────────────────────────────────────────────────
const SpeakerBlocks = memo(({ text }) => {
  if (!text) {
    return (
      <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
        minHeight:200, gap:'0.75rem', color:'var(--text-secondary)', textAlign:'center', padding:'2rem' }}>
        <FileAudio size={36} style={{ opacity:0.2 }} />
        <span style={{ fontSize:'0.9rem', opacity:0.6 }}>Transcript will appear here after processing</span>
      </div>
    );
  }

  const hasTags = /^\[Speaker \d+\]:/m.test(text);
  if (!hasTags) {
    return <pre style={{ whiteSpace:'pre-wrap', lineHeight:1.8, margin:0, fontSize:'0.92rem', color:'var(--text-primary)' }}>{text}</pre>;
  }

  const colorMap = {};
  let nextSlot = 0;

  return (
    <div>
      {text.split(/\n{2,}/).filter(b=>b.trim()).map((block, idx) => {
        const match = block.match(/^\[(.+?)\]:\s*([\s\S]*)$/);
        if (!match) return <p key={idx} style={{ margin:'0 0 0.5rem', whiteSpace:'pre-wrap' }}>{block}</p>;

        const speaker = match[1];
        const content = match[2].trim();

        if (colorMap[speaker] === undefined) {
          colorMap[speaker] = nextSlot % SPEAKER_COLORS.length;
          nextSlot++;
        }
        const c = SPEAKER_COLORS[colorMap[speaker]];

        return (
          <div key={idx} style={{ background:c.bg, border:`1px solid ${c.border}`,
            borderRadius:12, padding:'0.85rem 1rem', marginBottom:'0.75rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.5rem' }}>
              <UserCircle2 size={13} color={c.badge} />
              <span style={{ fontSize:'0.7rem', fontWeight:700, color:c.badge,
                letterSpacing:'0.06em', textTransform:'uppercase' }}>{speaker}</span>
            </div>
            <p style={{ margin:0, lineHeight:1.8, color:'var(--text-primary)', whiteSpace:'pre-wrap', fontSize:'0.92rem' }}>
              {content}
            </p>
          </div>
        );
      })}
    </div>
  );
});

// ─── QA Report renderer ───────────────────────────────────────────────────────
const QAReportView = memo(({ report, onExport }) => {
  if (!report) return null;
  const pct = Math.round((report.finalScore / report.totalMarks) * 100);
  const perfColor = { Excellent:'#34d399', Good:'#60a5fa', Average:'#fbbf24', 'Below Average':'#f87171' }[report.performance] || '#9ca3af';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
      {/* Score header */}
      <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
        borderRadius:16, padding:'1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between',
        flexWrap:'wrap', gap:'1rem' }}>
        <div>
          <div style={{ fontSize:'0.78rem', color:'var(--text-secondary)', marginBottom:'0.4rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>Final Score</div>
          <div style={{ fontSize:'2.5rem', fontWeight:700, color:perfColor, lineHeight:1 }}>
            {report.finalScore}<span style={{ fontSize:'1.1rem', color:'var(--text-secondary)' }}>/{report.totalMarks}</span>
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:'1rem', fontWeight:600, color:perfColor, marginBottom:'0.25rem' }}>{report.performance}</div>
          <div style={{ fontSize:'0.85rem', color:'var(--text-secondary)' }}>{pct}% score</div>
        </div>
      </div>

      {/* Score bar */}
      <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:4, height:6, overflow:'hidden' }}>
        <motion.div initial={{ width:0 }} animate={{ width:`${pct}%` }} transition={{ duration:0.8, ease:'easeOut' }}
          style={{ height:'100%', background:perfColor, borderRadius:4 }} />
      </div>

      {/* Parameters */}
      <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
        {report.parameters.map((p, i) => (
          <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
            borderRadius:12, padding:'1rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
              <span style={{ fontSize:'0.88rem', fontWeight:500, color:'var(--text-primary)' }}>{p.name}</span>
              <span style={{ fontSize:'0.88rem', fontWeight:700, color:'var(--accent-primary)' }}>
                {p.score}<span style={{ color:'var(--text-secondary)', fontWeight:400 }}>/{p.maxScore}</span>
              </span>
            </div>
            <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:3, height:4, marginBottom:'0.6rem', overflow:'hidden' }}>
              <motion.div initial={{ width:0 }} animate={{ width:`${(p.score/p.maxScore)*100}%` }}
                transition={{ duration:0.6, delay:i*0.08 }}
                style={{ height:'100%', background:'var(--accent-primary)', borderRadius:3 }} />
            </div>
            <p style={{ margin:0, fontSize:'0.8rem', color:'var(--text-secondary)', lineHeight:1.5 }}>{p.feedback}</p>
          </div>
        ))}
      </div>

      {/* Strengths & Areas */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
        <div style={{ background:'rgba(52,211,153,0.07)', border:'1px solid rgba(52,211,153,0.2)',
          borderRadius:12, padding:'1rem' }}>
          <div style={{ fontSize:'0.78rem', fontWeight:700, color:'#34d399', marginBottom:'0.6rem',
            textTransform:'uppercase', letterSpacing:'0.05em' }}>✓ Strengths</div>
          <ul style={{ margin:0, paddingLeft:'1rem', display:'flex', flexDirection:'column', gap:'0.4rem' }}>
            {report.strengths.map((s,i) => <li key={i} style={{ fontSize:'0.82rem', color:'var(--text-primary)', lineHeight:1.5 }}>{s}</li>)}
          </ul>
        </div>
        <div style={{ background:'rgba(248,113,113,0.07)', border:'1px solid rgba(248,113,113,0.2)',
          borderRadius:12, padding:'1rem' }}>
          <div style={{ fontSize:'0.78rem', fontWeight:700, color:'#f87171', marginBottom:'0.6rem',
            textTransform:'uppercase', letterSpacing:'0.05em' }}>↑ Improve</div>
          <ul style={{ margin:0, paddingLeft:'1rem', display:'flex', flexDirection:'column', gap:'0.4rem' }}>
            {report.areasToImprove.map((a,i) => <li key={i} style={{ fontSize:'0.82rem', color:'var(--text-primary)', lineHeight:1.5 }}>{a}</li>)}
          </ul>
        </div>
      </div>

      {/* Summary */}
      {report.summary && (
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
          borderRadius:12, padding:'1rem' }}>
          <div style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text-secondary)', marginBottom:'0.5rem',
            textTransform:'uppercase', letterSpacing:'0.05em' }}>Summary</div>
          <p style={{ margin:0, fontSize:'0.88rem', color:'var(--text-primary)', lineHeight:1.7 }}>{report.summary}</p>
        </div>
      )}
    </div>
  );
});

// ─── Pipeline Stage Tracker ───────────────────────────────────────────────────
const PipelineTracker = memo(({ stages, currentStage, providerNote, progress, showTranslation, showQA }) => {
  const activeStages = stages.filter(s => {
    if (s.id === 'translating' && !showTranslation) return false;
    if (s.id === 'analyzing'   && !showQA)          return false;
    return true;
  });

  const getStatus = (stageId) => {
    const activeIds  = activeStages.map(s => s.id);
    const curIdx     = activeIds.indexOf(currentStage);
    const stageIdx   = activeIds.indexOf(stageId);
    if (currentStage === 'done') return 'done';
    if (stageIdx < curIdx)  return 'done';
    if (stageIdx === curIdx) return 'active';
    return 'pending';
  };

  return (
    <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)',
      borderRadius:16, padding:'1.5rem' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:'1.25rem' }}>
        <span style={{ fontWeight:600, fontSize:'0.95rem' }}>Processing Pipeline</span>
        {providerNote && (
          <span style={{ fontSize:'0.72rem', padding:'2px 8px', borderRadius:20,
            background:'rgba(99,102,241,0.15)', color:'#818cf8' }}>{providerNote}</span>
        )}
      </div>

      {/* Stage steps */}
      <div style={{ display:'flex', alignItems:'center', gap:'0.25rem', flexWrap:'wrap', marginBottom:'1.25rem' }}>
        {activeStages.map((stage, idx) => {
          const status = getStatus(stage.id);
          return (
            <React.Fragment key={stage.id}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.35rem', minWidth:70 }}>
                <div style={{ width:36, height:36, borderRadius:'50%', display:'flex',
                  alignItems:'center', justifyContent:'center',
                  background: status === 'done'   ? 'rgba(52,211,153,0.15)' :
                              status === 'active' ? 'rgba(99,102,241,0.2)' :
                              'rgba(255,255,255,0.05)',
                  border: `1.5px solid ${status === 'done' ? '#34d399' : status === 'active' ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                  transition: 'all 0.3s ease' }}>
                  {status === 'done' ? <CheckCircle2 size={16} color="#34d399" /> :
                   status === 'active' ? (
                     <motion.div animate={{ rotate: 360 }} transition={{ repeat:Infinity, duration:1.2 }}>
                       <Loader size={16} color="#6366f1" />
                     </motion.div>
                   ) : <Circle size={14} color="rgba(255,255,255,0.2)" />}
                </div>
                <span style={{ fontSize:'0.68rem', textAlign:'center', lineHeight:1.2,
                  color: status === 'active' ? '#f3f4f6' : 'var(--text-secondary)' }}>
                  {stage.label}
                </span>
              </div>
              {idx < activeStages.length - 1 && (
                <ArrowRight size={14} color="rgba(255,255,255,0.15)" style={{ flexShrink:0, marginBottom:14 }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Progress bar */}
      {currentStage && currentStage !== 'done' && (
        <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:4, height:4, overflow:'hidden' }}>
          <motion.div animate={{ width:`${progress}%` }} transition={{ duration:0.4 }}
            style={{ height:'100%', background:'linear-gradient(90deg,#6366f1,#a78bfa)', borderRadius:4 }} />
        </div>
      )}
    </div>
  );
});

// ─── Login Modal ──────────────────────────────────────────────────────────────
const LoginModal = memo(({ open, onClose, pathname }) => {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000,backdropFilter:'blur(6px)' }}>
      <motion.div initial={{ scale:0.9 }} animate={{ scale:1 }}
        onClick={e=>e.stopPropagation()}
        style={{ background:'#1a1a1a',border:'1px solid #333',borderRadius:20,
          padding:'2rem',maxWidth:380,width:'100%',textAlign:'center' }}>
        <Lock size={40} color="#6366f1" style={{ marginBottom:'1rem' }} />
        <h3 style={{ margin:'0 0 0.5rem' }}>Login Required</h3>
        <p style={{ color:'var(--text-secondary)', fontSize:'0.9rem', margin:'0 0 1.5rem', lineHeight:1.6 }}>
          Audio transcription requires a signed-in account.
        </p>
        <div style={{ display:'grid', gap:'0.75rem' }}>
          <Link to="/login" state={{ from:pathname }} className="btn-primary"
            style={{ textDecoration:'none', textAlign:'center', padding:'0.9rem', display:'block', borderRadius:10 }}>
            Sign In
          </Link>
          <Link to="/signup" state={{ from:pathname }} className="btn-secondary"
            style={{ textDecoration:'none', textAlign:'center', padding:'0.9rem', display:'block', borderRadius:10 }}>
            Create Account
          </Link>
        </div>
      </motion.div>
    </div>
  );
});

// ─── Stat badge ───────────────────────────────────────────────────────────────
const StatBadge = ({ label, value, color = 'var(--accent-primary)' }) => (
  <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
    borderRadius:10, padding:'0.55rem 0.85rem', textAlign:'center', minWidth:72 }}>
    <div style={{ fontSize:'1.05rem', fontWeight:700, color }}>{value}</div>
    <div style={{ fontSize:'0.65rem', color:'var(--text-secondary)', marginTop:2 }}>{label}</div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AudioTranscription() {
  const { user, apiFetch } = useAuth();
  const location           = useLocation();

  // Upload state
  const [file, setFile]           = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef              = useRef(null);
  const [audioDurMin, setAudioDurMin] = useState(0);

  // Config state
  const [mode, setMode]                         = useState('dolphin');
  const [outputLanguage, setOutputLanguage]     = useState('original');
  const [speakerRecognition, setSpeakerRecognition] = useState(true);
  const [qaMode, setQaMode]                     = useState(false);
  const [showAdvanced, setShowAdvanced]         = useState(false);

  // QA params state
  const [qaParams, setQaParams]                 = useState(DEFAULT_QA_PARAMS);
  const [newParamName, setNewParamName]         = useState('');
  const [newParamMarks, setNewParamMarks]       = useState(10);

  // Pipeline state
  const [pipelineStage, setPipelineStage]       = useState(null);
  const [pipelineProgress, setPipelineProgress] = useState(0);
  const [providerNote, setProviderNote]         = useState('');
  const [pipelineError, setPipelineError]       = useState(null);
  const abortRef                                = useRef(false);

  // Results state
  const [rawTranscript, setRawTranscript]           = useState('');
  const [transcript, setTranscript]                 = useState('');
  const [translatedTranscript, setTranslatedTranscript] = useState('');
  const [improvedTranscript, setImprovedTranscript] = useState('');
  const [qaReport, setQaReport]                     = useState(null);

  // Tab state
  const [activeTab, setActiveTab] = useState('original');

  // Per-tab improving state
  const [isImprovingOriginal, setIsImprovingOriginal]       = useState(false);
  const [isImprovingTranslation, setIsImprovingTranslation] = useState(false);
  const [isRunningQA, setIsRunningQA]                       = useState(false);

  // UI state
  const [showLoginModal, setShowLoginModal] = useState(false);

  const sessionCache = useRef(new Map());
  const isDone       = pipelineStage === 'done';

  // Stats
  const transcriptStats = useMemo(() => computeStats(transcript),          [transcript]);
  const improvedStats   = useMemo(() => computeStats(improvedTranscript),  [improvedTranscript]);
  const totalQAMarks    = useMemo(() => qaParams.reduce((s,p) => s + (Number(p.marks)||0), 0), [qaParams]);

  const needsTranslation = outputLanguage !== 'original';

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFile = useCallback(async (f) => {
    if (!f || !f.type.startsWith('audio/') && !/\.(mp3|wav|m4a|aac|flac|ogg|webm)$/i.test(f.name)) {
      toast.error('Please upload a valid audio file');
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      toast.error(`File too large (max ${MAX_FILE_MB} MB)`);
      return;
    }
    setFile(f);
    setPipelineStage(null);
    setPipelineError(null);
    setRawTranscript('');
    setTranscript('');
    setTranslatedTranscript('');
    setImprovedTranscript('');
    setQaReport(null);
    const dur = await getAudioDurationMin(f);
    setAudioDurMin(dur);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  // ── Main pipeline ──────────────────────────────────────────────────────────
  const runPipeline = useCallback(async () => {
    if (!file) return;
    if (!user) { setShowLoginModal(true); return; }

    abortRef.current = false;
    setPipelineError(null);
    setTranslatedTranscript('');
    setImprovedTranscript('');
    setQaReport(null);
    setActiveTab('original');

    const modeConfig = TRANSCRIPTION_MODES.find(m => m.value === mode) || TRANSCRIPTION_MODES[1];

    try {
      // STEP 1 — Upload / validate
      setPipelineStage('uploading');
      setPipelineProgress(10);
      setProviderNote('Groq Whisper');

      const cacheKey = `${file.name}-${file.size}-${file.lastModified}-${mode}`;
      let rawText = sessionCache.current.get(cacheKey);

      if (!rawText) {
        // STEP 2 — Transcribe (with chunking if needed)
        setPipelineStage('transcribing');
        setPipelineProgress(20);

        const needsChunking = audioDurMin * 60 > CHUNK_TRIGGER_SEC;

        if (needsChunking) {
          setProviderNote(`Chunking ${Math.ceil(audioDurMin / (CHUNK_DURATION_SEC / 60))} segments…`);
          const { blobs } = await splitAudioIntoChunks(file, (cur, tot) => {
            setPipelineProgress(20 + Math.round((cur / tot) * 20));
          });
          const partials = [];
          for (let i = 0; i < blobs.length; i++) {
            if (abortRef.current) throw new Error('Cancelled');
            setProviderNote(`Transcribing chunk ${i+1}/${blobs.length}…`);
            setPipelineProgress(40 + Math.round((i / blobs.length) * 20));
            const fd = new FormData();
            fd.append('audio', blobs[i], 'chunk.wav');
            fd.append('model', modeConfig.model);
            const data = await apiFetchWithRetry(apiFetch, '/api/transcribe', { method:'POST', body:fd });
            partials.push(data.text || data.transcription || '');
          }
          rawText = stitchChunks(partials);
        } else {
          setProviderNote('Groq Whisper');
          const fd = new FormData();
          fd.append('audio', file);
          fd.append('model', modeConfig.model);
          const data = await apiFetchWithRetry(apiFetch, '/api/transcribe', { method:'POST', body:fd });
          rawText = data.text || data.transcription || '';
        }

        sessionCache.current.set(cacheKey, rawText);
      }

      setPipelineProgress(60);
      setRawTranscript(rawText);

      // Speaker diarization
      let processedText = rawText;
      if (speakerRecognition) {
        setProviderNote('Speaker diarization…');
        const blocks = await runDiarizationEngine(rawText, apiFetch);
        processedText = blocksToPlainText(blocks);
      }

      const cleaned = runTextEngine(processedText, { smartParagraphs:true });
      setTranscript(cleaned);
      setPipelineProgress(70);

      // STEP 3 — Translation
      if (needsTranslation && !abortRef.current) {
        setPipelineStage('translating');
        setProviderNote('Translating with Puter AI…');
        setPipelineProgress(72);
        try {
          const translated = await callAI(
            buildTranslationPrompt(cleaned, outputLanguage),
            { apiFetch, onProvider: p => setProviderNote(p === 'puter' ? 'Puter AI' : 'Groq (fallback)') }
          );
          setTranslatedTranscript(translated);
        } catch (err) {
          toast.error('Translation failed — original transcript available');
          setTranslatedTranscript('');
        }
        setPipelineProgress(82);
      }

      // STEP 4 — QA Analysis
      if (qaMode && !abortRef.current) {
        setPipelineStage('analyzing');
        setProviderNote('QA Analysis with Puter AI…');
        setPipelineProgress(84);
        try {
          const qaText = await callAI(
            buildQaAnalysisPrompt(cleaned, qaParams, totalQAMarks),
            { apiFetch, onProvider: p => setProviderNote(p === 'puter' ? 'Puter AI' : 'Groq (fallback)') }
          );
          const report = parseQaReport(qaText);
          setQaReport(report);
          setActiveTab('qa');
        } catch (err) {
          toast.error('QA analysis failed — transcript still available');
        }
        setPipelineProgress(92);
      }

      // STEP 5 — Auto-improve transcript
      if (!abortRef.current) {
        setPipelineStage('improving');
        setProviderNote('Improving transcript…');
        setPipelineProgress(94);
        try {
          const improved = await callAI(
            buildImproveTextPrompt(cleaned),
            { apiFetch, onProvider: p => setProviderNote(p === 'puter' ? 'Puter AI' : 'Groq (fallback)') }
          );
          setImprovedTranscript(improved);
        } catch {
          setImprovedTranscript('');
        }
        setPipelineProgress(100);
      }

      setPipelineStage('done');
      setProviderNote('');
      if (!qaMode) setActiveTab(needsTranslation ? 'translation' : 'improved');
      toast.success('Transcription complete!');

    } catch (err) {
      if (err.message === 'Cancelled') {
        setPipelineStage(null);
        setProviderNote('');
        return;
      }
      console.error('[Pipeline]', err);
      setPipelineError(err.message || 'Pipeline failed');
      setPipelineStage(null);
      setProviderNote('');
      toast.error('Processing failed: ' + (err.message || 'Unknown error'));
    }
  }, [file, user, mode, speakerRecognition, outputLanguage, qaMode, qaParams, totalQAMarks, apiFetch, audioDurMin, needsTranslation]);

  // ── On-demand improve ──────────────────────────────────────────────────────
  const handleImproveOriginal = async () => {
    if (!transcript || isImprovingOriginal) return;
    setIsImprovingOriginal(true);
    try {
      const result = await callAI(
        buildImproveTextPrompt(transcript),
        { apiFetch, onProvider: () => {} }
      );
      setImprovedTranscript(result);
      setActiveTab('improved');
      toast.success('Transcript improved');
    } catch { toast.error('Improvement failed'); }
    finally { setIsImprovingOriginal(false); }
  };

  const handleImproveTranslation = async () => {
    if (!translatedTranscript || isImprovingTranslation) return;
    setIsImprovingTranslation(true);
    try {
      const result = await callAI(
        buildImproveTextPrompt(translatedTranscript),
        { apiFetch, onProvider: () => {} }
      );
      setTranslatedTranscript(result);
      toast.success('Translation improved');
    } catch { toast.error('Improvement failed'); }
    finally { setIsImprovingTranslation(false); }
  };

  const handleRunQA = async () => {
    if (!transcript || isRunningQA) return;
    setIsRunningQA(true);
    try {
      const qaText = await callAI(
        buildQaAnalysisPrompt(transcript, qaParams, totalQAMarks),
        { apiFetch, onProvider: () => {} }
      );
      const report = parseQaReport(qaText);
      setQaReport(report);
      setActiveTab('qa');
      toast.success('QA analysis complete');
    } catch { toast.error('QA analysis failed'); }
    finally { setIsRunningQA(false); }
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = (text, format, label) => {
    if (!text) return;
    const base = (file?.name || 'transcript').replace(/\.[^.]+$/, '');
    if (format === 'txt')  downloadFile(text, `${base}-${label}.txt`, 'text/plain');
    if (format === 'srt')  downloadFile(generateSRT(text), `${base}-${label}.srt`, 'text/plain');
    if (format === 'json') downloadFile(JSON.stringify({ transcript:text, file:file?.name, date:new Date().toISOString() }, null, 2), `${base}-${label}.json`, 'application/json');
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied!'));
  };

  const isPipelineRunning = pipelineStage && pipelineStage !== 'done';
  const canStart          = file && !isPipelineRunning;

  // ── Tabs config ────────────────────────────────────────────────────────────
  const tabs = useMemo(() => [
    { id:'original',    label:'Original',    show:true,             hasContent:!!transcript },
    { id:'improved',    label:'Improved',    show:true,             hasContent:!!improvedTranscript },
    { id:'translation', label:'Translation', show:needsTranslation, hasContent:!!translatedTranscript },
    { id:'qa',          label:'QA Analysis', show:qaMode,           hasContent:!!qaReport },
  ].filter(t => t.show), [transcript, improvedTranscript, translatedTranscript, qaReport, needsTranslation, qaMode]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', fontFamily:"'Inter', system-ui, sans-serif" }}>
      <ToolHeader
        title="AI Transcription"
        description="Professional audio transcription with AI pipeline — speaker recognition, translation, and QA analysis"
        icon={<AudioLines size={22} />}
      />

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'2rem 1rem', display:'flex', flexDirection:'column', gap:'1.5rem' }}>

        {/* ── Upload + Config Row ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:'1.5rem', alignItems:'start' }}>

          {/* Left: Upload card */}
          <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
            {/* Dropzone */}
            <div
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !isPipelineRunning && fileInputRef.current?.click()}
              style={{ border:`2px dashed ${isDragOver ? '#6366f1' : file ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.12)'}`,
                borderRadius:16, padding:'2rem 1.5rem', textAlign:'center',
                background: isDragOver ? 'rgba(99,102,241,0.06)' : file ? 'rgba(99,102,241,0.04)' : 'rgba(255,255,255,0.02)',
                cursor: isPipelineRunning ? 'default' : 'pointer', transition:'all 0.2s' }}>
              <input ref={fileInputRef} type="file" accept={ACCEPTED_AUDIO} hidden
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

              {file ? (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.75rem' }}>
                  <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(99,102,241,0.15)',
                    display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <FileAudio size={24} color="#6366f1" />
                  </div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:'0.95rem', marginBottom:'0.25rem' }}>{file.name}</div>
                    <div style={{ color:'var(--text-secondary)', fontSize:'0.8rem' }}>
                      {(file.size/1024/1024).toFixed(2)} MB · {audioDurMin > 0 ? `${Math.floor(audioDurMin)}m ${Math.round((audioDurMin%1)*60)}s` : 'Calculating…'}
                    </div>
                  </div>
                  {!isPipelineRunning && (
                    <button onClick={e => { e.stopPropagation(); setFile(null); setPipelineStage(null); setRawTranscript(''); setTranscript(''); }}
                      style={{ background:'none', border:'none', color:'var(--text-secondary)', cursor:'pointer',
                        display:'flex', alignItems:'center', gap:4, fontSize:'0.8rem' }}>
                      <Trash2 size={13} /> Remove
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.75rem', padding:'0.5rem' }}>
                  <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(255,255,255,0.06)',
                    display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Upload size={22} color="var(--text-secondary)" />
                  </div>
                  <div>
                    <div style={{ fontWeight:600, marginBottom:'0.25rem' }}>Drop audio here or click to browse</div>
                    <div style={{ color:'var(--text-secondary)', fontSize:'0.8rem' }}>
                      MP3, WAV, M4A, AAC, FLAC, OGG · Max {MAX_FILE_MB} MB
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Mode selector */}
            <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
              <label style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-secondary)',
                textTransform:'uppercase', letterSpacing:'0.05em' }}>Transcription Mode</label>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.5rem' }}>
                {TRANSCRIPTION_MODES.map(m => (
                  <button key={m.value} onClick={() => setMode(m.value)}
                    style={{ padding:'0.75rem 0.5rem', borderRadius:12, cursor:'pointer', textAlign:'center',
                      border: `1.5px solid ${mode === m.value ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                      background: mode === m.value ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
                      transition:'all 0.2s' }}>
                    <div style={{ fontSize:'1.3rem', marginBottom:'0.25rem' }}>{m.emoji}</div>
                    <div style={{ fontSize:'0.8rem', fontWeight:600 }}>{m.label}</div>
                    <div style={{ fontSize:'0.65rem', color:'var(--text-secondary)', marginTop:2 }}>{m.badge}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Pipeline error */}
            {pipelineError && (
              <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)',
                borderRadius:12, padding:'1rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                <AlertTriangle size={18} color="#f87171" />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'0.85rem', fontWeight:600, color:'#f87171' }}>Pipeline Failed</div>
                  <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginTop:2 }}>{pipelineError}</div>
                </div>
                <button onClick={runPipeline} style={{ background:'none', border:'1px solid rgba(239,68,68,0.3)',
                  borderRadius:8, padding:'0.4rem 0.75rem', color:'#f87171', cursor:'pointer', fontSize:'0.8rem',
                  display:'flex', alignItems:'center', gap:4 }}>
                  <RefreshCw size={13} /> Retry
                </button>
              </div>
            )}
          </div>

          {/* Right: Config card */}
          <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:16, padding:'1.25rem', display:'flex', flexDirection:'column', gap:'1rem' }}>

            <div style={{ fontSize:'0.8rem', fontWeight:700, color:'var(--text-secondary)',
              textTransform:'uppercase', letterSpacing:'0.05em' }}>Pipeline Settings</div>

            {/* Output language */}
            <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
              <label style={{ fontSize:'0.78rem', color:'var(--text-secondary)' }}>Output Language</label>
              <select value={outputLanguage} onChange={e => setOutputLanguage(e.target.value)}
                style={{ padding:'0.6rem 0.75rem', background:'rgba(255,255,255,0.06)',
                  border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, color:'var(--text-primary)',
                  fontSize:'0.85rem', cursor:'pointer' }}>
                {OUTPUT_LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              {outputLanguage !== 'original' && (
                <div style={{ fontSize:'0.72rem', color:'#818cf8',
                  display:'flex', alignItems:'center', gap:4 }}>
                  <Globe size={11} /> Audio → original language → {outputLanguage}
                </div>
              )}
            </div>

            {/* Speaker recognition toggle */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:'0.85rem', fontWeight:500 }}>Speaker Recognition</div>
                <div style={{ fontSize:'0.72rem', color:'var(--text-secondary)' }}>Label [Speaker N]: blocks</div>
              </div>
              <button onClick={() => setSpeakerRecognition(v => !v)}
                style={{ width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
                  background: speakerRecognition ? '#6366f1' : 'rgba(255,255,255,0.1)',
                  position:'relative', transition:'background 0.2s' }}>
                <span style={{ position:'absolute', top:2, left: speakerRecognition ? 22 : 2,
                  width:20, height:20, borderRadius:'50%', background:'#fff',
                  transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.3)' }} />
              </button>
            </div>

            {/* QA Mode toggle */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:'0.85rem', fontWeight:500, display:'flex', alignItems:'center', gap:5 }}>
                  <BarChart3 size={14} color="#a78bfa" /> QA Analysis Mode
                </div>
                <div style={{ fontSize:'0.72rem', color:'var(--text-secondary)' }}>Score call quality with AI</div>
              </div>
              <button onClick={() => setQaMode(v => !v)}
                style={{ width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
                  background: qaMode ? '#a78bfa' : 'rgba(255,255,255,0.1)',
                  position:'relative', transition:'background 0.2s' }}>
                <span style={{ position:'absolute', top:2, left: qaMode ? 22 : 2,
                  width:20, height:20, borderRadius:'50%', background:'#fff',
                  transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.3)' }} />
              </button>
            </div>

            {/* QA Params editor */}
            <AnimatePresence>
              {qaMode && (
                <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
                  exit={{ opacity:0, height:0 }} style={{ overflow:'hidden' }}>
                  <div style={{ borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:'0.9rem',
                    display:'flex', flexDirection:'column', gap:'0.6rem' }}>
                    <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--text-secondary)',
                      textTransform:'uppercase', letterSpacing:'0.05em' }}>
                      QA Parameters · Total: {totalQAMarks} marks
                    </div>
                    {qaParams.map((p,i) => (
                      <div key={i} style={{ display:'flex', gap:'0.4rem', alignItems:'center' }}>
                        <input value={p.name} onChange={e => setQaParams(prev => prev.map((x,j) => j===i?{...x,name:e.target.value}:x))}
                          style={{ flex:1, padding:'0.35rem 0.6rem', background:'rgba(255,255,255,0.06)',
                            border:'1px solid rgba(255,255,255,0.1)', borderRadius:7,
                            color:'var(--text-primary)', fontSize:'0.8rem' }} />
                        <input type="number" value={p.marks} min={1} max={100}
                          onChange={e => setQaParams(prev => prev.map((x,j) => j===i?{...x,marks:parseInt(e.target.value)||0}:x))}
                          style={{ width:54, padding:'0.35rem 0.5rem', background:'rgba(255,255,255,0.06)',
                            border:'1px solid rgba(255,255,255,0.1)', borderRadius:7,
                            color:'var(--text-primary)', fontSize:'0.8rem', textAlign:'center' }} />
                        <button onClick={() => setQaParams(prev => prev.filter((_,j)=>j!==i))}
                          style={{ background:'none', border:'none', color:'var(--text-secondary)', cursor:'pointer', padding:4 }}>
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    <div style={{ display:'flex', gap:'0.4rem' }}>
                      <input value={newParamName} onChange={e => setNewParamName(e.target.value)}
                        placeholder="Add parameter…"
                        style={{ flex:1, padding:'0.35rem 0.6rem', background:'rgba(255,255,255,0.06)',
                          border:'1px solid rgba(255,255,255,0.1)', borderRadius:7,
                          color:'var(--text-primary)', fontSize:'0.8rem' }} />
                      <input type="number" value={newParamMarks} min={1} max={100}
                        onChange={e => setNewParamMarks(parseInt(e.target.value)||0)}
                        style={{ width:54, padding:'0.35rem 0.5rem', background:'rgba(255,255,255,0.06)',
                          border:'1px solid rgba(255,255,255,0.1)', borderRadius:7,
                          color:'var(--text-primary)', fontSize:'0.8rem', textAlign:'center' }} />
                      <button onClick={() => { if(newParamName.trim()){ setQaParams(prev=>[...prev,{name:newParamName.trim(),marks:newParamMarks}]); setNewParamName(''); setNewParamMarks(10); }}}
                        style={{ background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.3)',
                          borderRadius:7, padding:'0.35rem 0.6rem', color:'#818cf8', cursor:'pointer' }}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Start button */}
            <button
              onClick={canStart ? runPipeline : isPipelineRunning ? () => { abortRef.current = true; } : undefined}
              disabled={!file}
              style={{ width:'100%', padding:'0.9rem', borderRadius:12, border:'none', cursor: file ? 'pointer' : 'not-allowed',
                fontWeight:700, fontSize:'0.95rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem',
                background: !file ? 'rgba(255,255,255,0.06)' :
                           isPipelineRunning ? 'rgba(239,68,68,0.15)' :
                           'linear-gradient(135deg,#6366f1,#a78bfa)',
                color: !file ? 'var(--text-secondary)' : isPipelineRunning ? '#f87171' : '#fff',
                transition:'all 0.2s', boxShadow: file && !isPipelineRunning ? '0 4px 20px rgba(99,102,241,0.3)' : 'none' }}>
              {isPipelineRunning ? (
                <><motion.div animate={{ rotate:360 }} transition={{ repeat:Infinity, duration:1 }}><Loader size={18} /></motion.div> Stop Pipeline</>
              ) : (
                <><Zap size={18} /> {isDone ? 'Re-Transcribe' : 'Start Pipeline'}</>
              )}
            </button>
          </div>
        </div>

        {/* ── Pipeline progress tracker ── */}
        <AnimatePresence>
          {(isPipelineRunning || isDone) && (
            <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
              <PipelineTracker
                stages={PIPELINE_STAGES}
                currentStage={pipelineStage}
                providerNote={providerNote}
                progress={pipelineProgress}
                showTranslation={needsTranslation}
                showQA={qaMode}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Results section ── */}
        <AnimatePresence>
          {(transcript || isDone) && (
            <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}
              style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)',
                borderRadius:20, overflow:'hidden' }}>

              {/* Tab bar */}
              <div style={{ display:'flex', alignItems:'center', gap:0,
                borderBottom:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.02)',
                overflowX:'auto', flexWrap:'nowrap' }}>
                {tabs.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    style={{ padding:'0.85rem 1.25rem', border:'none', cursor:'pointer', whiteSpace:'nowrap',
                      background:'transparent', fontWeight: activeTab === tab.id ? 600 : 400,
                      fontSize:'0.88rem', color: activeTab === tab.id ? '#f3f4f6' : 'var(--text-secondary)',
                      borderBottom: activeTab === tab.id ? '2px solid #6366f1' : '2px solid transparent',
                      transition:'all 0.2s', display:'flex', alignItems:'center', gap:'0.4rem' }}>
                    {tab.label}
                    {tab.hasContent && (
                      <span style={{ width:6, height:6, borderRadius:'50%', background:'#34d399', display:'inline-block' }} />
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={{ padding:'1.5rem' }}>

                {/* Original tab */}
                {activeTab === 'original' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                    {/* Stats row */}
                    {transcriptStats && (
                      <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
                        <StatBadge label="Words"    value={transcriptStats.wordCount.toLocaleString()} />
                        <StatBadge label="Sentences" value={transcriptStats.sentenceCount} />
                        <StatBadge label="Read Time" value={`${transcriptStats.estimatedReadMin}m`} color="#34d399" />
                        <StatBadge label="Readability" value={transcriptStats.readabilityLabel} color="#fbbf24" />
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                      <button onClick={() => handleCopy(transcript)}
                        style={{ padding:'0.5rem 0.9rem', background:'rgba(255,255,255,0.06)',
                          border:'1px solid rgba(255,255,255,0.1)', borderRadius:9, cursor:'pointer',
                          fontSize:'0.82rem', display:'flex', alignItems:'center', gap:'0.4rem',
                          color:'var(--text-primary)' }}>
                        <Copy size={13} /> Copy
                      </button>
                      <button onClick={handleImproveOriginal} disabled={isImprovingOriginal}
                        style={{ padding:'0.5rem 0.9rem', background:'rgba(99,102,241,0.1)',
                          border:'1px solid rgba(99,102,241,0.25)', borderRadius:9, cursor:'pointer',
                          fontSize:'0.82rem', display:'flex', alignItems:'center', gap:'0.4rem',
                          color:'#818cf8' }}>
                        {isImprovingOriginal ? <Loader size={13} /> : <Sparkles size={13} />}
                        {isImprovingOriginal ? 'Improving…' : 'Improve'}
                      </button>
                      {qaMode && (
                        <button onClick={handleRunQA} disabled={isRunningQA}
                          style={{ padding:'0.5rem 0.9rem', background:'rgba(167,139,250,0.1)',
                            border:'1px solid rgba(167,139,250,0.25)', borderRadius:9, cursor:'pointer',
                            fontSize:'0.82rem', display:'flex', alignItems:'center', gap:'0.4rem',
                            color:'#a78bfa' }}>
                          {isRunningQA ? <Loader size={13} /> : <BarChart3 size={13} />}
                          {isRunningQA ? 'Analyzing…' : 'Run QA'}
                        </button>
                      )}
                      {['txt','srt','json'].map(fmt => (
                        <button key={fmt} onClick={() => handleExport(transcript, fmt, 'original')}
                          style={{ padding:'0.5rem 0.75rem', background:'rgba(255,255,255,0.04)',
                            border:'1px solid rgba(255,255,255,0.08)', borderRadius:9, cursor:'pointer',
                            fontSize:'0.78rem', display:'flex', alignItems:'center', gap:'0.35rem',
                            color:'var(--text-secondary)' }}>
                          <Download size={12} /> .{fmt}
                        </button>
                      ))}
                    </div>

                    {/* Transcript content */}
                    <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:12,
                      border:'1px solid rgba(255,255,255,0.06)', padding:'1.25rem',
                      maxHeight:480, overflowY:'auto' }}>
                      <SpeakerBlocks text={transcript} />
                    </div>
                  </div>
                )}

                {/* Improved tab */}
                {activeTab === 'improved' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                    {improvedStats && (
                      <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
                        <StatBadge label="Words"    value={improvedStats.wordCount.toLocaleString()} />
                        <StatBadge label="Sentences" value={improvedStats.sentenceCount} />
                        <StatBadge label="Read Time" value={`${improvedStats.estimatedReadMin}m`} color="#34d399" />
                        <StatBadge label="Readability" value={improvedStats.readabilityLabel} color="#fbbf24" />
                      </div>
                    )}

                    <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                      <button onClick={() => handleCopy(improvedTranscript)}
                        style={{ padding:'0.5rem 0.9rem', background:'rgba(255,255,255,0.06)',
                          border:'1px solid rgba(255,255,255,0.1)', borderRadius:9, cursor:'pointer',
                          fontSize:'0.82rem', display:'flex', alignItems:'center', gap:'0.4rem',
                          color:'var(--text-primary)' }}>
                        <Copy size={13} /> Copy
                      </button>
                      <button onClick={handleImproveOriginal} disabled={isImprovingOriginal}
                        style={{ padding:'0.5rem 0.9rem', background:'rgba(99,102,241,0.1)',
                          border:'1px solid rgba(99,102,241,0.25)', borderRadius:9, cursor:'pointer',
                          fontSize:'0.82rem', display:'flex', alignItems:'center', gap:'0.4rem',
                          color:'#818cf8' }}>
                        {isImprovingOriginal ? <Loader size={13} /> : <RefreshCw size={13} />}
                        Re-improve
                      </button>
                      {['txt','srt','json'].map(fmt => (
                        <button key={fmt} onClick={() => handleExport(improvedTranscript, fmt, 'improved')}
                          style={{ padding:'0.5rem 0.75rem', background:'rgba(255,255,255,0.04)',
                            border:'1px solid rgba(255,255,255,0.08)', borderRadius:9, cursor:'pointer',
                            fontSize:'0.78rem', display:'flex', alignItems:'center', gap:'0.35rem',
                            color:'var(--text-secondary)' }}>
                          <Download size={12} /> .{fmt}
                        </button>
                      ))}
                    </div>

                    {improvedTranscript ? (
                      <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:12,
                        border:'1px solid rgba(255,255,255,0.06)', padding:'1.25rem',
                        maxHeight:480, overflowY:'auto' }}>
                        <SpeakerBlocks text={improvedTranscript} />
                      </div>
                    ) : (
                      <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-secondary)' }}>
                        <Sparkles size={32} style={{ opacity:0.2, marginBottom:'0.75rem', display:'block', margin:'0 auto 0.75rem' }} />
                        <div style={{ fontSize:'0.9rem' }}>No improved transcript yet</div>
                        <div style={{ fontSize:'0.8rem', marginTop:'0.4rem', opacity:0.6 }}>
                          Click "Improve" on the Original tab to generate
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Translation tab */}
                {activeTab === 'translation' && needsTranslation && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                    <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', alignItems:'center' }}>
                      <span style={{ fontSize:'0.78rem', padding:'3px 10px', borderRadius:20,
                        background:'rgba(99,102,241,0.12)', color:'#818cf8' }}>
                        {OUTPUT_LANGUAGES.find(l=>l.value===outputLanguage)?.label || outputLanguage}
                      </span>
                      <div style={{ flex:1 }} />
                      <button onClick={() => handleCopy(translatedTranscript)}
                        style={{ padding:'0.5rem 0.9rem', background:'rgba(255,255,255,0.06)',
                          border:'1px solid rgba(255,255,255,0.1)', borderRadius:9, cursor:'pointer',
                          fontSize:'0.82rem', display:'flex', alignItems:'center', gap:'0.4rem',
                          color:'var(--text-primary)' }}>
                        <Copy size={13} /> Copy
                      </button>
                      <button onClick={handleImproveTranslation} disabled={isImprovingTranslation}
                        style={{ padding:'0.5rem 0.9rem', background:'rgba(99,102,241,0.1)',
                          border:'1px solid rgba(99,102,241,0.25)', borderRadius:9, cursor:'pointer',
                          fontSize:'0.82rem', display:'flex', alignItems:'center', gap:'0.4rem',
                          color:'#818cf8' }}>
                        {isImprovingTranslation ? <Loader size={13} /> : <Sparkles size={13} />}
                        Polish
                      </button>
                      {['txt','srt'].map(fmt => (
                        <button key={fmt} onClick={() => handleExport(translatedTranscript, fmt, 'translation')}
                          style={{ padding:'0.5rem 0.75rem', background:'rgba(255,255,255,0.04)',
                            border:'1px solid rgba(255,255,255,0.08)', borderRadius:9, cursor:'pointer',
                            fontSize:'0.78rem', display:'flex', alignItems:'center', gap:'0.35rem',
                            color:'var(--text-secondary)' }}>
                          <Download size={12} /> .{fmt}
                        </button>
                      ))}
                    </div>

                    {translatedTranscript ? (
                      <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:12,
                        border:'1px solid rgba(255,255,255,0.06)', padding:'1.25rem',
                        maxHeight:480, overflowY:'auto' }}>
                        <SpeakerBlocks text={translatedTranscript} />
                      </div>
                    ) : (
                      <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-secondary)' }}>
                        <Globe size={32} style={{ opacity:0.2, marginBottom:'0.75rem', display:'block', margin:'0 auto 0.75rem' }} />
                        <div style={{ fontSize:'0.9rem' }}>Translation will appear here after processing</div>
                      </div>
                    )}
                  </div>
                )}

                {/* QA tab */}
                {activeTab === 'qa' && qaMode && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                    {!qaReport ? (
                      <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-secondary)' }}>
                        <BarChart3 size={32} style={{ opacity:0.2, marginBottom:'0.75rem', display:'block', margin:'0 auto 0.75rem' }} />
                        <div style={{ fontSize:'0.9rem', marginBottom:'0.75rem' }}>QA analysis not run yet</div>
                        <button onClick={handleRunQA} disabled={!transcript || isRunningQA}
                          style={{ padding:'0.7rem 1.5rem', background:'rgba(167,139,250,0.15)',
                            border:'1px solid rgba(167,139,250,0.3)', borderRadius:10, cursor:'pointer',
                            fontSize:'0.88rem', display:'inline-flex', alignItems:'center', gap:'0.5rem',
                            color:'#a78bfa', fontWeight:600 }}>
                          {isRunningQA ? <Loader size={15} /> : <BarChart3 size={15} />}
                          {isRunningQA ? 'Analyzing…' : 'Run QA Analysis'}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end' }}>
                          <button onClick={handleRunQA} disabled={isRunningQA}
                            style={{ padding:'0.5rem 0.9rem', background:'rgba(255,255,255,0.06)',
                              border:'1px solid rgba(255,255,255,0.1)', borderRadius:9, cursor:'pointer',
                              fontSize:'0.82rem', display:'flex', alignItems:'center', gap:'0.4rem',
                              color:'var(--text-secondary)' }}>
                            {isRunningQA ? <Loader size={13} /> : <RefreshCw size={13} />}
                            Re-analyze
                          </button>
                          <button onClick={() => {
                            const lines = [
                              `QA Analysis Report`,
                              `Score: ${qaReport.finalScore}/${qaReport.totalMarks} — ${qaReport.performance}`,
                              '', ...qaReport.parameters.map(p => `${p.name}: ${p.score}/${p.maxScore}\n${p.feedback}`),
                              '',`Strengths:\n${qaReport.strengths.map(s=>`• ${s}`).join('\n')}`,
                              '',`Areas to Improve:\n${qaReport.areasToImprove.map(a=>`• ${a}`).join('\n')}`,
                              '',`Summary: ${qaReport.summary}`,
                            ].join('\n');
                            downloadFile(lines, 'qa-report.txt', 'text/plain');
                          }} style={{ padding:'0.5rem 0.9rem', background:'rgba(255,255,255,0.06)',
                            border:'1px solid rgba(255,255,255,0.1)', borderRadius:9, cursor:'pointer',
                            fontSize:'0.82rem', display:'flex', alignItems:'center', gap:'0.4rem',
                            color:'var(--text-secondary)' }}>
                            <Download size={13} /> Export Report
                          </button>
                        </div>
                        <QAReportView report={qaReport} />
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Login Modal */}
      <LoginModal open={showLoginModal} onClose={() => setShowLoginModal(false)} pathname={location.pathname} />
    </div>
  );
}

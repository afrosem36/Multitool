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
import { useAiRateLimit } from '../../hooks/useAiRateLimit';
import { AiLoginGate, AiRateLimitBanner, AiRateLimitBadge } from '../../components/shared/AiRateLimitGate';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_MB        = 500;
const MAX_FILE_BYTES     = MAX_FILE_MB * 1024 * 1024;
const ACCEPTED_AUDIO     = 'audio/*';
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

// ─── Rule-based QA patterns (Phase 6 — deterministic, no AI) ────────────────
const QA_RULE_CHECKS = [
  { id:'greeting',   label:'Greeting',              category:'Opening',    maxScore:10, patterns:[/thank you for (calling|contacting|reaching)/i,/good (morning|afternoon|evening)/i,/how (may|can) (i|we) (help|assist)/i,/my name is\s+\w+/i] },
  { id:'recording',  label:'Recording Disclosure',  category:'Compliance', maxScore:15, patterns:[/recorded|recording/i,/for quality (purposes|assurance|monitoring)/i,/call may be (recorded|monitored)/i,/on a recorded line/i] },
  { id:'identity',   label:'Identity Verification', category:'Compliance', maxScore:15, patterns:[/verify|verification/i,/account holder/i,/authorized (to make|person)/i,/may i (speak|know) (who|your name)/i,/confirm (your|the) (name|account|identity)/i] },
  { id:'empathy',    label:'Empathy Statement',     category:'Soft Skills',maxScore:10, patterns:[/i (understand|can imagine|can see|see that)/i,/i('m| am) (sorry|sincerely sorry)/i,/i (apologize)/i,/that must be (frustrating|difficult)/i] },
  { id:'hold',       label:'Hold Permission',        category:'Process',    maxScore: 5, patterns:[/can i (put|place) you on hold/i,/may i (put|place) you on hold/i,/would you mind holding/i,/one moment (please|while)/i] },
  { id:'closing',    label:'Proper Closing',         category:'Closing',    maxScore:10, patterns:[/anything else (i|we) can (help|assist)/i,/is there anything else/i,/thank you for (calling|your time|being)/i,/have a (great|good|wonderful|nice) (day|evening)/i] },
];

const NEGATIVE_QA_CHECKS = [
  { id:'abusive',   label:'Abusive Language',    patterns:[/\b(idiot|stupid|shut up|moron|hell with)\b/i], penalty:25 },
  { id:'dead_air',  label:'Dead Air Markers',     patterns:[/\[blank_audio\]|\[silence\]|\[no audio\]/i],   penalty:10 },
];

// ─── NLP word lists (Phase 7 — lightweight, no model needed) ────────────────
const STOP_WORDS = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','is','are','was','were','be','been','have','has','had','do','does','did','will','would','could','should','may','might','i','you','he','she','it','we','they','me','him','her','us','them','my','your','his','its','our','their','this','that','these','those','what','which','who','when','where','how','not','no','yes','ok','okay','so','just','very','also','then','than','now','even','only','can','get','got','go','well','said','tell','ask','know','one','two','three','four','five','six','seven','eight','nine','ten']);

const POSITIVE_WORDS = new Set(['great','good','excellent','wonderful','happy','pleased','helpful','perfect','thank','appreciate','love','enjoy','satisfied','resolved','absolutely','outstanding','fantastic','amazing','sure','definitely','certainly','glad','delighted']);
const NEGATIVE_WORDS = new Set(['bad','terrible','awful','horrible','frustrated','angry','upset','disappointed','unacceptable','wrong','problem','issue','complaint','never','hate','worst','useless','ridiculous','absurd','impossible','waste','confusing','unclear','unhappy','dissatisfied','escalate','manager','supervisor','cancel','refund']);

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

function parseDiarizationBlocks(raw) {
  const clean = raw.replace(/```json|```/gi, '').trim();
  const parsed = JSON.parse(clean);
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Empty');
  return parsed.filter(b => typeof b.speaker === 'string' && typeof b.text === 'string' && b.text.trim());
}

async function runDiarizationEngine(rawTranscript, apiFetch) {
  const wordCount = rawTranscript.split(/\s+/).length;
  // Truncate for Groq to prevent 413 — use first 600 words as speaker pattern sample
  const GROQ_MAX_WORDS = 600;
  const groqInput  = wordCount > GROQ_MAX_WORDS
    ? rawTranscript.split(/\s+/).slice(0, GROQ_MAX_WORDS).join(' ')
    : rawTranscript;
  const escaped    = groqInput.replace(/"/g, "'");
  const promptText = `You are an expert speaker diarization engine. Split the transcript into speaker turns.
RULES: Label speakers as "Speaker 1", "Speaker 2", etc. Do NOT change any wording.
Return ONLY valid JSON: [{"speaker":"Speaker 1","text":"..."},{"speaker":"Speaker 2","text":"..."}]
If one speaker: [{"speaker":"Speaker 1","text":"${escaped}"}]
TRANSCRIPT: ${groqInput}`;

  // 1. Try Groq (fast, cheap) — only for transcripts under limit
  if (wordCount <= GROQ_MAX_WORDS * 1.5) {
    try {
      const res  = await apiFetch('/api/groq/chat', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ model:GROQ_DIARIZE_MODEL, messages:[{role:'user',content:promptText}], temperature:0.1, max_tokens:4096 }),
      });
      const data = await parseJsonResponse(res);
      const raw  = data?.choices?.[0]?.message?.content || data?.data?.content || data?.content || '';
      return parseDiarizationBlocks(raw);
    } catch {
      // fall through to Gemini → OpenAI
    }
  }

  // 2. Fallback: Gemini → OpenAI via /api/ai/generate
  try {
    const messages = [
      { role: 'system', content: 'You are a speaker diarization engine. Return ONLY valid JSON array, no extra text.' },
      { role: 'user',   content: promptText },
    ];
    const res = await apiFetch('/api/ai/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.text?.trim()) return parseDiarizationBlocks(data.text);
    }
  } catch {
    // fall through to single-speaker
  }

  return [{ speaker:'Speaker 1', text:rawTranscript }];
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

// ─── Timestamp helpers ────────────────────────────────────────────────────────
function fmtSec(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function parseSpeakerBlocks(text) {
  if (!text) return [];
  const hasSpeakers = /^\[Speaker \d+\]:/m.test(text);
  if (!hasSpeakers) return [{ speaker: null, text: text.trim() }];
  return text.split(/\n{2,}/).filter(b => b.trim()).map(block => {
    const m = block.match(/^\[(.+?)\]:\s*([\s\S]*)$/);
    return m ? { speaker: m[1], text: m[2].trim() } : { speaker: null, text: block.trim() };
  });
}

function estimateTimestamps(blocks, totalDurMin) {
  if (!totalDurMin || totalDurMin <= 0) return blocks.map(b => ({ ...b, startSec: null, endSec: null }));
  const totalWords = blocks.reduce((s, b) => s + b.text.split(/\s+/).filter(Boolean).length, 0);
  const totalSec   = totalDurMin * 60;
  let elapsed = 0;
  return blocks.map(block => {
    const words    = block.text.split(/\s+/).filter(Boolean).length;
    const fraction = totalWords > 0 ? words / totalWords : 0;
    const dur      = fraction * totalSec;
    const start    = elapsed;
    elapsed += dur;
    return { ...block, startSec: Math.round(start), endSec: Math.round(elapsed) };
  });
}

// ─── Local improvement engine (no AI, no credits) ────────────────────────────
function improveBlock(text) {
  if (!text) return '';
  let t = text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\[BLANK_AUDIO\]/gi, '').replace(/\[MUSIC\]/gi, '').replace(/\[NOISE\]/gi, '')
    .replace(/\s([.,!?;:])/g, '$1')
    .replace(/([.,!?;:])(?=[^\s\d"'])/g, '$1 ')
    .replace(FILLER_WORDS, '')
    .replace(/\s{2,}/g, ' ')
    // Remove Whisper phrase duplications
    .replace(/(\b(?:\w+\s+){1,4}\w+)\s+\1/gi, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/(\.\s*){4,}/g, '...')
    .replace(/(^|[.!?]\s+)([a-z])/g, (_, pre, ch) => pre + ch.toUpperCase())
    .trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

function runImproveEngine(raw) {
  if (!raw) return '';
  const hasSpeakers = /^\[Speaker \d+\]:/m.test(raw);
  if (hasSpeakers) {
    return raw.split(/\n{2,}/).map(block => {
      const m = block.match(/^\[(.+?)\]:\s*([\s\S]*)$/);
      if (!m) return block.trim();
      const improved = improveBlock(m[2]);
      return improved ? `[${m[1]}]: ${improved}` : '';
    }).filter(Boolean).join('\n\n');
  }
  return improveBlock(raw);
}

// ─── Phase 6: Rule-based QA scorer (deterministic, zero AI cost) ─────────────
function runRuleBasedQA(transcript, blocks) {
  const checks = [];
  let totalMax = 0, totalScore = 0;
  for (const rule of QA_RULE_CHECKS) {
    const passed = rule.patterns.some(p => p.test(transcript));
    const score  = passed ? rule.maxScore : 0;
    totalMax  += rule.maxScore;
    totalScore += score;
    checks.push({ ...rule, passed, score });
  }
  const penalties = [];
  for (const neg of NEGATIVE_QA_CHECKS) {
    if (neg.patterns.some(p => p.test(transcript))) {
      penalties.push({ label: neg.label, penalty: neg.penalty });
      totalScore = Math.max(0, totalScore - neg.penalty);
    }
  }
  const shortTurns = blocks.filter(b => b.speaker && b.text.split(/\s+/).length < 4).length;
  if (shortTurns >= 6) {
    penalties.push({ label: `Possible interruptions (${shortTurns} very short turns)`, penalty: 5 });
    totalScore = Math.max(0, totalScore - 5);
  }
  const pct = totalMax > 0 ? Math.round((Math.min(totalScore, totalMax) / totalMax) * 100) : 0;
  return { checks, penalties, score: Math.min(totalScore, totalMax), maxScore: totalMax, pct,
    grade: pct >= 85 ? 'Excellent' : pct >= 70 ? 'Good' : pct >= 50 ? 'Average' : 'Below Average' };
}

// ─── Phase 7: Lightweight NLP (no model, no API) ─────────────────────────────
function extractKeywords(text, topN = 12) {
  const plain = text.replace(/^\[Speaker \d+\]:\s*/gm, '').toLowerCase();
  const words  = plain.match(/\b[a-z]{4,}\b/g) || [];
  const freq   = {};
  for (const w of words) { if (!STOP_WORDS.has(w)) freq[w] = (freq[w] || 0) + 1; }
  return Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0, topN).map(([word, count]) => ({ word, count }));
}

function detectSentiment(text) {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  let pos = 0, neg = 0;
  for (const w of words) {
    if (POSITIVE_WORDS.has(w)) pos++;
    if (NEGATIVE_WORDS.has(w)) neg++;
  }
  const total = pos + neg;
  if (total === 0) return { label:'Neutral', score:0.5, pos:0, neg:0 };
  const score = pos / total;
  return { label: score > 0.6 ? 'Positive' : score < 0.4 ? 'Negative' : 'Neutral', score, pos, neg };
}

function computeSpeakerStats(blocks, durMin) {
  const map = {};
  for (const b of blocks) {
    if (!b.speaker) continue;
    if (!map[b.speaker]) map[b.speaker] = { words:0, turns:0 };
    map[b.speaker].words += b.text.split(/\s+/).filter(Boolean).length;
    map[b.speaker].turns += 1;
  }
  const totalWords = Object.values(map).reduce((s,v) => s+v.words, 0);
  return Object.entries(map).map(([name, data]) => ({
    name,
    words: data.words,
    turns: data.turns,
    pct:   totalWords > 0 ? Math.round((data.words / totalWords) * 100) : 0,
    estDurMin: durMin > 0 ? Math.round((data.words / Math.max(totalWords,1)) * durMin * 10) / 10 : null,
  }));
}

function buildAnalytics(transcript, durMin) {
  if (!transcript) return null;
  const blocks      = parseSpeakerBlocks(transcript);
  const keywords    = extractKeywords(transcript);
  const sentiment   = detectSentiment(transcript);
  const speakerStats = computeSpeakerStats(blocks, durMin);
  const ruleQA      = runRuleBasedQA(transcript, blocks);
  return { keywords, sentiment, speakerStats, ruleQA };
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
const SpeakerBlocks = memo(({ text, durMin }) => {
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

  const rawBlocks = parseSpeakerBlocks(text);
  const blocks    = durMin > 0 ? estimateTimestamps(rawBlocks, durMin) : rawBlocks.map(b => ({ ...b, startSec: null, endSec: null }));
  const colorMap  = {};
  let nextSlot    = 0;

  return (
    <div>
      {blocks.map((block, idx) => {
        if (!block.speaker) return <p key={idx} style={{ margin:'0 0 0.5rem', whiteSpace:'pre-wrap' }}>{block.text}</p>;

        if (colorMap[block.speaker] === undefined) {
          colorMap[block.speaker] = nextSlot % SPEAKER_COLORS.length;
          nextSlot++;
        }
        const c = SPEAKER_COLORS[colorMap[block.speaker]];

        return (
          <div key={idx} style={{ background:c.bg, border:`1px solid ${c.border}`,
            borderRadius:12, padding:'0.85rem 1rem', marginBottom:'0.75rem' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.5rem' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                <UserCircle2 size={13} color={c.badge} />
                <span style={{ fontSize:'0.7rem', fontWeight:700, color:c.badge,
                  letterSpacing:'0.06em', textTransform:'uppercase' }}>{block.speaker}</span>
              </div>
              {block.startSec != null && (
                <span style={{ fontSize:'0.65rem', color:'var(--text-secondary)', fontFamily:'monospace',
                  letterSpacing:'0.03em', background:'rgba(255,255,255,0.05)',
                  padding:'1px 6px', borderRadius:4 }}>
                  {fmtSec(block.startSec)} – {fmtSec(block.endSec)}
                </span>
              )}
            </div>
            <p style={{ margin:0, lineHeight:1.8, color:'var(--text-primary)', whiteSpace:'pre-wrap', fontSize:'0.92rem' }}>
              {block.text}
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

// ─── Credits Bar ─────────────────────────────────────────────────────────────
const CreditsBar = memo(({ credits, onRefresh }) => {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh?.();
    setTimeout(() => setRefreshing(false), 600);
  };

  // Skeleton while loading
  if (!credits) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:'0.45rem',
        background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)',
        borderRadius:10, padding:'0.7rem 0.85rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ width:80, height:10, borderRadius:4, background:'rgba(255,255,255,0.08)' }} />
          <div style={{ width:40, height:10, borderRadius:4, background:'rgba(255,255,255,0.08)' }} />
        </div>
        <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:4, height:5 }} />
      </div>
    );
  }

  const { creditsUsed, creditsRemaining, creditsTotal, unlimited } = credits;

  // Unlimited account — show a special badge
  if (unlimited) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        background:'rgba(52,211,153,0.07)', border:'1px solid rgba(52,211,153,0.2)',
        borderRadius:10, padding:'0.7rem 0.85rem' }}>
        <span style={{ fontSize:'0.72rem', fontWeight:600, color:'var(--text-secondary)',
          textTransform:'uppercase', letterSpacing:'0.05em', display:'flex', alignItems:'center', gap:5 }}>
          <Zap size={11} color="#34d399" />
          Daily Credits
        </span>
        <span style={{ fontSize:'0.78rem', fontWeight:700, color:'#34d399',
          display:'flex', alignItems:'center', gap:4 }}>
          ∞ Unlimited
        </span>
      </div>
    );
  }

  const usedPct = Math.round((creditsUsed / creditsTotal) * 100);
  const isLow   = creditsRemaining <= 2 && creditsRemaining > 0;
  const isEmpty = creditsRemaining === 0;

  const accentColor = isEmpty ? '#ef4444' : isLow ? '#f59e0b' : '#818cf8';
  const barColor    = isEmpty
    ? '#ef4444'
    : isLow
    ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
    : 'linear-gradient(90deg,#6366f1,#a78bfa)';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0.45rem',
      background: isEmpty ? 'rgba(239,68,68,0.06)' : isLow ? 'rgba(245,158,11,0.06)' : 'rgba(99,102,241,0.06)',
      border: `1px solid ${isEmpty ? 'rgba(239,68,68,0.2)' : isLow ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.15)'}`,
      borderRadius:10, padding:'0.7rem 0.85rem' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:'0.72rem', fontWeight:600, color:'var(--text-secondary)',
          textTransform:'uppercase', letterSpacing:'0.05em', display:'flex', alignItems:'center', gap:5 }}>
          <Zap size={11} color={accentColor} />
          Daily Credits
        </span>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:'0.78rem', fontWeight:700, color:accentColor }}>
            {creditsRemaining}
            <span style={{ fontWeight:400, color:'var(--text-secondary)', fontSize:'0.72rem' }}>
              /{creditsTotal} left
            </span>
          </span>
          <button onClick={handleRefresh}
            style={{ background:'none', border:'none', cursor:'pointer', padding:2,
              color:'var(--text-secondary)', opacity: refreshing ? 0.4 : 0.7,
              display:'flex', alignItems:'center' }}>
            <motion.div animate={{ rotate: refreshing ? 360 : 0 }}
              transition={{ duration:0.5, ease:'easeInOut' }}>
              <RefreshCw size={10} />
            </motion.div>
          </button>
        </div>
      </div>
      <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:4, height:5, overflow:'hidden' }}>
        <motion.div
          key={creditsUsed}
          initial={{ width:0 }}
          animate={{ width:`${usedPct}%` }}
          transition={{ duration:0.6, ease:'easeOut' }}
          style={{ height:'100%', background:barColor, borderRadius:4 }}
        />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:'0.68rem', color:'var(--text-secondary)' }}>
          {creditsUsed} used today
        </span>
        {isEmpty && (
          <span style={{ fontSize:'0.68rem', color:'#f87171', fontWeight:500 }}>
            Resets at midnight
          </span>
        )}
        {isLow && !isEmpty && (
          <span style={{ fontSize:'0.68rem', color:'#f59e0b', fontWeight:500 }}>
            Running low
          </span>
        )}
      </div>
    </div>
  );
});

// ─── Insights Panel (local analytics, zero AI cost) ──────────────────────────
const InsightsPanel = memo(({ analytics }) => {
  if (!analytics) return null;
  const { keywords, sentiment, speakerStats, ruleQA } = analytics;
  const sentColor  = sentiment.label === 'Positive' ? '#34d399' : sentiment.label === 'Negative' ? '#f87171' : '#94a3b8';
  const gradeColor = { Excellent:'#34d399', Good:'#60a5fa', Average:'#fbbf24', 'Below Average':'#f87171' }[ruleQA.grade] || '#9ca3af';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>

      {/* Top row: Sentiment + QA Pre-Score */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'1.25rem' }}>
          <div style={{ fontSize:'0.7rem', fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.75rem' }}>Conversation Sentiment</div>
          <div style={{ fontSize:'1.8rem', fontWeight:700, color:sentColor, marginBottom:'0.2rem' }}>{sentiment.label}</div>
          <div style={{ display:'flex', gap:'0.75rem', fontSize:'0.75rem', marginBottom:'0.7rem' }}>
            <span style={{ color:'#34d399' }}>+{sentiment.pos} positive signals</span>
            <span style={{ color:'#f87171' }}>-{sentiment.neg} negative</span>
          </div>
          <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:4, height:5, overflow:'hidden' }}>
            <div style={{ width:`${Math.round(sentiment.score*100)}%`, height:'100%', background:sentColor, borderRadius:4 }} />
          </div>
        </div>

        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'1.25rem' }}>
          <div style={{ fontSize:'0.7rem', fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.75rem' }}>
            QA Pre-Score &nbsp;<span style={{ color:'#34d399', fontWeight:500, fontSize:'0.65rem', textTransform:'none' }}>Rule-Based · Free · No Credits</span>
          </div>
          <div style={{ fontSize:'1.8rem', fontWeight:700, color:gradeColor, lineHeight:1 }}>
            {ruleQA.score}<span style={{ fontSize:'1rem', color:'var(--text-secondary)', fontWeight:400 }}>/{ruleQA.maxScore}</span>
          </div>
          <div style={{ fontSize:'0.8rem', color:gradeColor, margin:'0.2rem 0 0.7rem' }}>{ruleQA.grade} · {ruleQA.pct}%</div>
          <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:4, height:5, overflow:'hidden' }}>
            <div style={{ width:`${ruleQA.pct}%`, height:'100%', background:gradeColor, borderRadius:4 }} />
          </div>
        </div>
      </div>

      {/* Speaker Breakdown */}
      {speakerStats.length > 0 && (
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'1.25rem' }}>
          <div style={{ fontSize:'0.7rem', fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.9rem' }}>Speaker Breakdown</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.7rem' }}>
            {speakerStats.map((sp, i) => {
              const c = SPEAKER_COLORS[i % SPEAKER_COLORS.length];
              return (
                <div key={sp.name}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.3rem' }}>
                    <span style={{ fontSize:'0.82rem', fontWeight:600, color:c.badge }}>{sp.name}</span>
                    <span style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>
                      {sp.words.toLocaleString()} words · {sp.turns} turns · {sp.pct}%
                      {sp.estDurMin != null && <> · ~{sp.estDurMin}m</>}
                    </span>
                  </div>
                  <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:3, height:5, overflow:'hidden' }}>
                    <motion.div initial={{ width:0 }} animate={{ width:`${sp.pct}%` }} transition={{ duration:0.6, delay:i*0.1 }}
                      style={{ height:'100%', background:c.badge, borderRadius:3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Automated QA Checklist */}
      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'1.25rem' }}>
        <div style={{ fontSize:'0.7rem', fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.9rem' }}>
          Automated QA Checklist &nbsp;
          <span style={{ color:'#6366f1', fontWeight:400, fontSize:'0.65rem', textTransform:'none' }}>Phrase detection · Deterministic · No AI required</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.45rem' }}>
          {ruleQA.checks.map(check => (
            <div key={check.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'0.6rem 0.9rem', borderRadius:9,
              background: check.passed ? 'rgba(52,211,153,0.06)' : 'rgba(248,113,113,0.04)',
              border: `1px solid ${check.passed ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.12)'}` }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                <span style={{ fontSize:'0.78rem', fontWeight:700, color: check.passed ? '#34d399' : '#f87171', minWidth:12 }}>
                  {check.passed ? '✓' : '✗'}
                </span>
                <span style={{ fontSize:'0.82rem', color:'var(--text-primary)' }}>{check.label}</span>
                <span style={{ fontSize:'0.68rem', color:'var(--text-secondary)', padding:'1px 6px', borderRadius:4, background:'rgba(255,255,255,0.05)' }}>{check.category}</span>
              </div>
              <span style={{ fontSize:'0.78rem', fontWeight:700, color: check.passed ? '#34d399' : 'var(--text-secondary)', minWidth:32, textAlign:'right' }}>
                {check.score}/{check.maxScore}
              </span>
            </div>
          ))}
          {ruleQA.penalties.map((pen, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'0.6rem 0.9rem', borderRadius:9,
              background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.18)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                <span style={{ fontSize:'0.78rem', color:'#f87171' }}>⚠</span>
                <span style={{ fontSize:'0.82rem', color:'var(--text-primary)' }}>{pen.label}</span>
              </div>
              <span style={{ fontSize:'0.78rem', fontWeight:700, color:'#f87171' }}>-{pen.penalty}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Keywords */}
      {keywords.length > 0 && (
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:'1.25rem' }}>
          <div style={{ fontSize:'0.7rem', fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.9rem' }}>
            Key Topics &amp; Entities
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'0.45rem' }}>
            {keywords.map(({ word, count }) => (
              <span key={word} style={{ padding:'0.3rem 0.75rem', borderRadius:999,
                background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.22)',
                fontSize:'0.78rem', color:'#a5b4fc', display:'flex', alignItems:'center', gap:'0.35rem' }}>
                {word}
                <span style={{ fontSize:'0.65rem', color:'rgba(165,180,252,0.5)', fontWeight:600 }}>×{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// ─── Animated Audio Wave Icon ─────────────────────────────────────────────────
const BAR_CONFIGS = [
  { delay: 0,    minH: 5,  maxH: 18, dur: 0.85 },
  { delay: 0.18, minH: 9,  maxH: 28, dur: 0.95 },
  { delay: 0.08, minH: 7,  maxH: 22, dur: 0.78 },
  { delay: 0.28, minH: 10, maxH: 30, dur: 1.0  },
  { delay: 0.14, minH: 6,  maxH: 20, dur: 0.88 },
];

const AnimatedAudioWave = ({ size = 48, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={{ display:'block', overflow:'visible' }}>
    <defs>
      <linearGradient id="audioWaveGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stopColor="#6366f1" />
        <stop offset="100%" stopColor="#a78bfa" />
      </linearGradient>
      <filter id="audioWaveGlow">
        <feGaussianBlur stdDeviation="0.6" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
    {BAR_CONFIGS.map((bar, i) => (
      <motion.rect
        key={i}
        x={1.2 + i * 4.4}
        width={3}
        rx={1.5}
        fill="url(#audioWaveGrad)"
        filter="url(#audioWaveGlow)"
        animate={{
          height: [bar.minH, bar.maxH, bar.minH],
          y:      [(24 - bar.minH) / 2, (24 - bar.maxH) / 2, (24 - bar.minH) / 2],
          opacity:[0.7, 1, 0.7],
        }}
        transition={{
          duration: bar.dur,
          repeat:   Infinity,
          delay:    bar.delay,
          ease:     'easeInOut',
        }}
      />
    ))}
  </svg>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AudioTranscription() {
  const { user, apiFetch } = useAuth();
  const location           = useLocation();
  const rateLimit          = useAiRateLimit('audio-transcription');

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

  // Credits state
  const [credits, setCredits] = useState(null); // { creditsUsed, creditsRemaining, creditsTotal }

  // Local analytics (computed from transcript, zero AI cost)
  const analytics = useMemo(() => buildAnalytics(transcript, audioDurMin), [transcript, audioDurMin]);

  const fetchCredits = useCallback(async () => {
    if (!user) return;
    try {
      const res  = await apiFetch('/api/transcribe/credits');
      const json = await res.json();
      if (json?.data) setCredits(json.data);
    } catch { /* silent */ }
  }, [user, apiFetch]);

  useEffect(() => { fetchCredits(); }, [fetchCredits]);

  const sessionCache = useRef(new Map());
  const isDone       = pipelineStage === 'done';

  // Stats
  const transcriptStats = useMemo(() => computeStats(transcript),          [transcript]);
  const improvedStats   = useMemo(() => computeStats(improvedTranscript),  [improvedTranscript]);
  const totalQAMarks    = useMemo(() => qaParams.reduce((s,p) => s + (Number(p.marks)||0), 0), [qaParams]);

  const needsTranslation = outputLanguage !== 'original';

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFile = useCallback(async (f) => {
    if (!f) {
      toast.error('Please upload a valid audio file');
      return;
    }
    const isAudioMime = f.type.startsWith('audio/');
    const audioExtensions = /\.(mp3|wav|m4a|aac|flac|ogg|webm|mpeg|mp4|m4b|wma|opus|aiff|alac)$/i;
    const isAudioFile = isAudioMime || audioExtensions.test(f.name);

    if (!isAudioFile) {
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
    // Login is mandatory — show gate if not logged in
    if (!user) { setShowLoginModal(true); return; }
    // Client-side rate limit check
    if (!rateLimit.consume()) {
      toast.error(`Transcription limit reached. Resets in ${rateLimit.resetIn}.`);
      return;
    }

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
            fd.append('file', blobs[i], 'chunk.wav');
            fd.append('model', modeConfig.model);
            fd.append('firstChunk', i === 0 ? 'true' : 'false');
            const data = await apiFetchWithRetry(apiFetch, '/api/transcribe', { method:'POST', body:fd });
            partials.push(data.data?.transcript || data.text || data.transcription || '');
          }
          rawText = stitchChunks(partials);
        } else {
          setProviderNote('Groq Whisper');
          const fd = new FormData();
          fd.append('file', file);
          fd.append('model', modeConfig.model);
          const data = await apiFetchWithRetry(apiFetch, '/api/transcribe', { method:'POST', body:fd });
          rawText = data.data?.transcript || data.text || data.transcription || '';
          if (data.creditsUsed != null && data.creditsTotal != null) {
            setCredits({ creditsUsed: data.creditsUsed, creditsRemaining: data.creditsTotal - data.creditsUsed, creditsTotal: data.creditsTotal });
          }
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
        setProviderNote('Translating…');
        setPipelineProgress(72);
        try {
          const translated = await callAI(
            buildTranslationPrompt(cleaned, outputLanguage),
            { apiFetch, onProvider: p => setProviderNote(({ puter: 'Puter AI', gemini: 'Gemini Flash', openai: 'OpenAI' }[p] || p)) }
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
        setProviderNote('QA Analysis…');
        setPipelineProgress(84);
        try {
          const qaText = await callAI(
            buildQaAnalysisPrompt(cleaned, qaParams, totalQAMarks),
            { apiFetch, onProvider: p => setProviderNote(({ puter: 'Puter AI', gemini: 'Gemini Flash', openai: 'OpenAI' }[p] || p)) }
          );
          const report = parseQaReport(qaText);
          setQaReport(report);
          setActiveTab('qa');
        } catch (err) {
          toast.error('QA analysis failed — transcript still available');
        }
        setPipelineProgress(92);
      }

      // STEP 5 — Improve transcript locally (no AI, no credits)
      if (!abortRef.current) {
        setPipelineStage('improving');
        setProviderNote('Local engine');
        setPipelineProgress(94);
        setImprovedTranscript(runImproveEngine(cleaned));
        setPipelineProgress(100);
      }

      setPipelineStage('done');
      setProviderNote('');
      if (!qaMode) setActiveTab(needsTranslation ? 'translation' : 'improved');
      fetchCredits();
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
  }, [file, user, mode, speakerRecognition, outputLanguage, qaMode, qaParams, totalQAMarks, apiFetch, audioDurMin, needsTranslation, fetchCredits]);

  // ── On-demand improve ──────────────────────────────────────────────────────
  const handleImproveOriginal = () => {
    if (!transcript || isImprovingOriginal) return;
    setIsImprovingOriginal(true);
    setImprovedTranscript(runImproveEngine(transcript));
    setActiveTab('improved');
    toast.success('Transcript cleaned');
    setIsImprovingOriginal(false);
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
      toast.success('Translation polished');
    } catch {
      // Local fallback — AI polish failed
      setTranslatedTranscript(runImproveEngine(translatedTranscript));
      toast.success('Translation cleaned locally');
    }
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
  const creditsExhausted  = user && credits != null && !credits.unlimited && credits.creditsRemaining === 0;
  const canStart          = file && !isPipelineRunning && !creditsExhausted;

  // ── Tabs config ────────────────────────────────────────────────────────────
  const tabs = useMemo(() => [
    { id:'original',    label:'Original',    show:true,             hasContent:!!rawTranscript },
    { id:'improved',    label:'Improved',    show:true,             hasContent:!!improvedTranscript },
    { id:'analytics',   label:'Analytics',   show:true,             hasContent:!!analytics },
    { id:'translation', label:'Translation', show:needsTranslation, hasContent:!!translatedTranscript },
    { id:'qa',          label:'QA Analysis', show:qaMode,           hasContent:!!qaReport },
  ].filter(t => t.show), [rawTranscript, improvedTranscript, analytics, translatedTranscript, qaReport, needsTranslation, qaMode]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', fontFamily:"'Inter', system-ui, sans-serif" }}>
      {/* Login gate — must be logged in to use this tool */}
      {!user && <AiLoginGate toolName="AI Transcription" />}

      <ToolHeader
        title="AI Transcription"
        description="Professional audio transcription with AI pipeline — speaker recognition, translation, and QA analysis"
        icon={AnimatedAudioWave}
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
                      All audio formats supported (MP3, WAV, M4A, MPEG, AAC, FLAC, OGG, WebM, etc.) · Max {MAX_FILE_MB} MB
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

            {/* Credits balance */}
            {user && <CreditsBar credits={credits} onRefresh={fetchCredits} />}

            {/* Rate limit banner */}
            <AiRateLimitBanner hook={rateLimit} />

            {/* Start button */}
            <button
              onClick={canStart && rateLimit.allowed ? runPipeline : isPipelineRunning ? () => { abortRef.current = true; } : undefined}
              disabled={(!file && !isPipelineRunning) || (!isPipelineRunning && !rateLimit.allowed)}
              title={creditsExhausted ? 'Daily limit reached — resets at midnight' : !rateLimit.allowed ? `Limit reached. Resets in ${rateLimit.resetIn}` : undefined}
              style={{ width:'100%', padding:'0.9rem', borderRadius:12, border:'none',
                cursor: isPipelineRunning ? 'pointer' : (canStart && rateLimit.allowed) ? 'pointer' : 'not-allowed',
                fontWeight:700, fontSize:'0.95rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem',
                background: isPipelineRunning ? 'rgba(239,68,68,0.15)' :
                           (!rateLimit.allowed || creditsExhausted) ? 'rgba(239,68,68,0.08)' :
                           !file             ? 'rgba(255,255,255,0.06)' :
                           'linear-gradient(135deg,#6366f1,#a78bfa)',
                color: isPipelineRunning ? '#f87171' :
                       (!rateLimit.allowed || creditsExhausted) ? '#f87171' :
                       !file             ? 'var(--text-secondary)' : '#fff',
                transition:'all 0.2s',
                boxShadow: (canStart && rateLimit.allowed && !isPipelineRunning) ? '0 4px 20px rgba(99,102,241,0.3)' : 'none' }}>
              {isPipelineRunning ? (
                <><motion.div animate={{ rotate:360 }} transition={{ repeat:Infinity, duration:1 }}><Loader size={18} /></motion.div> Stop Pipeline</>
              ) : !rateLimit.allowed ? (
                <><Lock size={18} /> Limit Reached · Resets in {rateLimit.resetIn}</>
              ) : creditsExhausted ? (
                <><Lock size={18} /> No Credits Left</>
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

                {/* Original tab — raw Whisper output, no formatting */}
                {activeTab === 'original' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                    <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', alignItems:'center' }}>
                      <span style={{ fontSize:'0.72rem', color:'var(--text-secondary)', padding:'2px 8px',
                        borderRadius:4, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>
                        Raw Whisper Output
                      </span>
                      <div style={{ flex:1 }} />
                      <button onClick={() => handleCopy(rawTranscript)}
                        style={{ padding:'0.5rem 0.9rem', background:'rgba(255,255,255,0.06)',
                          border:'1px solid rgba(255,255,255,0.1)', borderRadius:9, cursor:'pointer',
                          fontSize:'0.82rem', display:'flex', alignItems:'center', gap:'0.4rem',
                          color:'var(--text-primary)' }}>
                        <Copy size={13} /> Copy
                      </button>
                      <button onClick={() => downloadFile(rawTranscript, `${(file?.name||'transcript').replace(/\.[^.]+$/,'')}-raw.txt`, 'text/plain')}
                        style={{ padding:'0.5rem 0.75rem', background:'rgba(255,255,255,0.04)',
                          border:'1px solid rgba(255,255,255,0.08)', borderRadius:9, cursor:'pointer',
                          fontSize:'0.78rem', display:'flex', alignItems:'center', gap:'0.35rem',
                          color:'var(--text-secondary)' }}>
                        <Download size={12} /> .txt
                      </button>
                    </div>
                    <div style={{ background:'rgba(255,255,255,0.02)', borderRadius:12,
                      border:'1px solid rgba(255,255,255,0.06)', padding:'1.25rem',
                      maxHeight:480, overflowY:'auto' }}>
                      {rawTranscript ? (
                        <pre style={{ whiteSpace:'pre-wrap', lineHeight:1.8, margin:0, fontSize:'0.9rem',
                          color:'var(--text-primary)', fontFamily:"'Inter', system-ui, sans-serif" }}>
                          {rawTranscript}
                        </pre>
                      ) : (
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                          minHeight:160, gap:'0.75rem', color:'var(--text-secondary)', textAlign:'center' }}>
                          <FileAudio size={32} style={{ opacity:0.2 }} />
                          <span style={{ fontSize:'0.9rem', opacity:0.6 }}>Transcript will appear here after processing</span>
                        </div>
                      )}
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
                        <SpeakerBlocks text={improvedTranscript} durMin={audioDurMin} />
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

                {/* Analytics tab */}
                {activeTab === 'analytics' && (
                  analytics ? (
                    <InsightsPanel analytics={analytics} />
                  ) : (
                    <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-secondary)' }}>
                      <BarChart3 size={32} style={{ opacity:0.2, marginBottom:'0.75rem', display:'block', margin:'0 auto 0.75rem' }} />
                      <div style={{ fontSize:'0.9rem' }}>Analytics will appear after transcription</div>
                    </div>
                  )
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

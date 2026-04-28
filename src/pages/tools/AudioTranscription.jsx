import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  AudioLines,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ClipboardCheck,
  Copy,
  Download,
  FileAudio,
  FileText,
  Filter,
  Hash,
  Info,
  LoaderCircle,
  Lock,
  MessageSquare,
  Mic,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import ToolHeader from '../../components/shared/ToolHeader';
import { useAuth } from '../../context/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const DAILY_LIMIT = 10;
const MAX_FILE_MB = 25;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const ACCEPTED_AUDIO = 'audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.webm';
const RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [1000, 2500, 5000];

const FILLER_WORDS = /\b(um+|uh+|hmm+|like|you know|i mean|sort of|kind of|basically|literally|actually|honestly|right\??|okay\??|so+|well+|anyway)\b/gi;

const TRANSCRIPTION_MODES = [
  { value: 'cheetah', label: 'Cheetah', emoji: '🐆', badge: 'Fastest',      desc: 'Quick draft — best for short clear audio',   model: 'whisper-large-v3-turbo' },
  { value: 'dolphin', label: 'Dolphin', emoji: '🐬', badge: 'Balanced',     desc: 'Smart balance of speed and accuracy',         model: 'whisper-large-v3'       },
  { value: 'whale',   label: 'Whale',   emoji: '🐳', badge: 'Most Accurate', desc: 'Full power — best for complex / noisy audio', model: 'distil-whisper-large-v3-en' },
];

const OUTPUT_LANGUAGES = [
  { value: 'english',  label: '🇬🇧 English'  },
  { value: 'hinglish', label: '🇮🇳 Hinglish'  },
  { value: 'original', label: '🌐 Original'   },
];

const EXPORT_FORMATS = [
  { value: 'txt',  label: 'Plain Text (.txt)',   icon: FileText   },
  { value: 'srt',  label: 'Subtitles (.srt)',     icon: MessageSquare },
  { value: 'json', label: 'JSON with metadata',  icon: Hash       },
];

// ─── Utility helpers ──────────────────────────────────────────────────────────
async function hashFile(file) {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function parseJsonResponse(res) {
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; }
  catch { throw new Error('Server returned invalid JSON'); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function apiFetchWithRetry(apiFetch, url, options = {}, attempts = RETRY_ATTEMPTS) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await apiFetch(url, options);
      return await parseJsonResponse(res);
    } catch (err) {
      const isLast = i === attempts - 1;
      const isRetryable = !err.message.includes('400') && !err.message.includes('401');
      if (isLast || !isRetryable) throw err;
      await new Promise(r => setTimeout(r, RETRY_DELAYS[i]));
    }
  }
}

// ─── Text Engine ──────────────────────────────────────────────────────────────
function runTextEngine(raw, opts = {}) {
  if (!raw) return '';
  let text = raw.trim();

  // 1. Normalize whitespace
  text = text.replace(/\s+/g, ' ');

  // 2. Fix spacing around punctuation
  text = text.replace(/\s([.,!?;:])/g, '$1');
  text = text.replace(/([.,!?;:])(?=[^\s])/g, '$1 ');

  // 3. Capitalize first letter of sentences
  text = text.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, pre, ch) => pre + ch.toUpperCase());

  // 4. Fix common Whisper artifacts
  text = text.replace(/\[BLANK_AUDIO\]/gi, '').trim();
  text = text.replace(/\[inaudible\]/gi, '[inaudible]');
  text = text.replace(/(\.\s*){3,}/g, '...');

  // 5. Number normalization
  if (opts.normalizeNumbers) {
    const wordNums = { zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,
      ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,
      eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90 };
    text = text.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-](one|two|three|four|five|six|seven|eight|nine)\b/gi,
      (_, tens, ones) => (wordNums[tens.toLowerCase()] + wordNums[ones.toLowerCase()]).toString());
    text = text.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/gi,
      m => wordNums[m.toLowerCase()]?.toString() ?? m);
  }

  // 6. Smart paragraph breaks (pause markers / topic shifts heuristic)
  if (opts.smartParagraphs) {
    text = text.replace(/([.!?])\s{2,}([A-Z])/g, '$1\n\n$2');
    text = text.replace(/([.!?])\s(?=(however|but|so|therefore|meanwhile|suddenly|later|then|next|finally|first|second|third)\b)/gi, '$1\n\n');
  }

  // 7. Strip filler words
  if (opts.stripFillers) {
    text = text.replace(FILLER_WORDS, '').replace(/\s{2,}/g, ' ').trim();
  }

  // 8. Final capitalization pass
  text = text.charAt(0).toUpperCase() + text.slice(1);

  return text.trim();
}

function computeStats(text) {
  if (!text) return null;
  const words = text.trim().split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 2);
  const avgWordLen = words.reduce((s, w) => s + w.replace(/[^a-z]/gi, '').length, 0) / Math.max(words.length, 1);
  // Flesch-Kincaid readability approximation
  const avgSentLen = words.length / Math.max(sentences.length, 1);
  const fk = Math.max(0, Math.min(100, 206.835 - 1.015 * avgSentLen - 84.6 * (avgWordLen / 4.5)));
  return {
    wordCount: words.length,
    charCount: text.length,
    sentenceCount: sentences.length,
    readabilityScore: Math.round(fk),
    readabilityLabel: fk > 70 ? 'Easy' : fk > 50 ? 'Moderate' : 'Complex',
    estimatedReadMin: Math.ceil(words.length / 200),
  };
}

function generateSRT(text) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  let srt = '';
  let t = 0;
  sentences.forEach((s, i) => {
    const dur = Math.max(2, Math.ceil(s.split(' ').length * 0.4));
    const fmt = sec => {
      const h = String(Math.floor(sec / 3600)).padStart(2, '0');
      const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
      const ss = String(sec % 60).padStart(2, '0');
      return `${h}:${m}:${ss},000`;
    };
    srt += `${i + 1}\n${fmt(t)} --> ${fmt(t + dur)}\n${s}\n\n`;
    t += dur;
  });
  return srt;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function LoginRequiredModal({ open, onClose, pathname }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} className="glass-panel" style={modalBox}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <div style={iconBox('#3b82f6')}><Lock size={20} color="#60a5fa" /></div>
            <div>
              <h3 style={{ margin:0 }}>Login Required</h3>
              <p style={{ margin:0, color:'var(--text-secondary)', fontSize:'0.9rem' }}>Audio transcription is available to signed-in users only.</p>
            </div>
          </div>
          <button onClick={onClose} style={ghostBtn}><X size={18} /></button>
        </div>
        <div style={{ display:'grid', gap:'0.75rem' }}>
          <Link to="/login" state={{ from: pathname }} className="btn-primary" style={fullBtn}>Sign In</Link>
          <Link to="/signup" state={{ from: pathname }} className="btn-secondary" style={fullBtn}>Create Account</Link>
        </div>
      </div>
    </div>
  );
}

function StatBadge({ label, value, color = 'var(--accent-primary)' }) {
  return (
    <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', padding:'0.6rem 0.85rem', textAlign:'center', minWidth:'80px' }}>
      <div style={{ fontSize:'1.2rem', fontWeight:700, color }}>{value}</div>
      <div style={{ fontSize:'0.72rem', color:'var(--text-secondary)', marginTop:'2px', textTransform:'uppercase', letterSpacing:'0.04em' }}>{label}</div>
    </div>
  );
}

function PreflightWarning({ file }) {
  if (!file) return null;
  const mb = file.size / 1024 / 1024;
  const warn = mb > MAX_FILE_MB;
  const caution = mb > 15;
  if (!warn && !caution) return null;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.65rem 0.9rem', borderRadius:'10px',
      background: warn ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
      border: `1px solid ${warn ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
      marginTop:'0.75rem', fontSize:'0.85rem' }}>
      <AlertTriangle size={15} color={warn ? '#ef4444' : '#f59e0b'} />
      <span style={{ color: warn ? '#fca5a5' : '#fcd34d' }}>
        {warn ? `File exceeds ${MAX_FILE_MB} MB limit. Please trim or compress the audio.` : `Large file (${mb.toFixed(1)} MB) — Whale mode recommended for accuracy.`}
      </span>
    </div>
  );
}

// ─── Inline style helpers ─────────────────────────────────────────────────────
const overlay = { position:'fixed', inset:0, background:'rgba(2,6,23,0.75)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem', zIndex:2000 };
const modalBox = { width:'100%', maxWidth:'440px', padding:'1.5rem', border:'1px solid rgba(255,255,255,0.12)' };
const iconBox = c => ({ width:40, height:40, borderRadius:12, background:`${c}22`, display:'flex', alignItems:'center', justifyContent:'center' });
const ghostBtn = { background:'transparent', border:'none', color:'var(--text-secondary)', cursor:'pointer', padding:'0.25rem' };
const fullBtn  = { textDecoration:'none', textAlign:'center', padding:'0.95rem 1rem', display:'block' };

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AudioTranscription() {
  const { user, apiFetch } = useAuth();
  const location = useLocation();

  // File state
  const [file, setFile]         = useState(null);
  const [fileHash, setFileHash] = useState('');
  const fileInputRef             = useRef(null);

  // Transcription config
  const [mode, setMode]                   = useState('dolphin');
  const [outputLanguage, setOutputLanguage] = useState('english');
  const [speakerRecognition, setSpeakerRecognition] = useState(false);
  const [transcribeToEnglish, setTranscribeToEnglish] = useState(false);
  const [restoreAudio, setRestoreAudio]   = useState(false);
  const [showAdvanced, setShowAdvanced]   = useState(false);

  // Text engine options
  const [normalizeNumbers, setNormalizeNumbers]   = useState(false);
  const [smartParagraphs, setSmartParagraphs]     = useState(true);
  const [stripFillers, setStripFillers]           = useState(false);

  // Results
  const [rawTranscript, setRawTranscript] = useState('');
  const [transcript, setTranscript]       = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress]           = useState(0);
  const [progressLabel, setProgressLabel] = useState('');

  // QA mode
  const [qaMode, setQaMode]         = useState(false);
  const [editableText, setEditableText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [showDiff, setShowDiff]     = useState(false);

  // Credits
  const [credits, setCredits]             = useState({ creditsUsed:0, creditsRemaining:DAILY_LIMIT, creditsTotal:DAILY_LIMIT });
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);

  // UI
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [sessionCache]                    = useState(new Map()); // hash → transcript

  // ── Credits fetch ──
  useEffect(() => {
    if (!user) { setCredits({ creditsUsed:0, creditsRemaining:DAILY_LIMIT, creditsTotal:DAILY_LIMIT }); return; }
    setIsLoadingCredits(true);
    apiFetchWithRetry(apiFetch, '/api/transcribe/credits')
      .then(d => { if (d.data) setCredits(d.data); })
      .catch(() => {})
      .finally(() => setIsLoadingCredits(false));
  }, [apiFetch, user]);

  // ── Sync editable text when transcript changes ──
  useEffect(() => { setEditableText(transcript); }, [transcript]);

  // ── Re-run text engine when options change ──
  useEffect(() => {
    if (!rawTranscript) return;
    setTranscript(runTextEngine(rawTranscript, { normalizeNumbers, smartParagraphs, stripFillers }));
  }, [rawTranscript, normalizeNumbers, smartParagraphs, stripFillers]);

  const stats = useMemo(() => computeStats(qaMode ? editableText : transcript), [qaMode, editableText, transcript]);

  const canTranscribe = useMemo(() =>
    !!user && !!file && !isTranscribing && credits.creditsRemaining > 0 && file.size <= MAX_FILE_BYTES,
  [user, file, isTranscribing, credits.creditsRemaining]);

  const handleBlockedAction = () => { if (!user) { setShowLoginModal(true); return true; } return false; };

  // ── File selection ──
  const handleFileChange = useCallback(async (e) => {
    if (handleBlockedAction()) return;
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      toast.error(`File too large — max ${MAX_FILE_MB} MB`);
      return;
    }
    setFile(f);
    setTranscript('');
    setRawTranscript('');
    toast.success('Audio file ready');
    const hash = await hashFile(f);
    setFileHash(hash);
    if (sessionCache.has(hash)) {
      const cached = sessionCache.get(hash);
      setRawTranscript(cached);
      toast('♻️ Loaded from session cache — no credit used', { icon: '💾' });
    }
  }, [sessionCache]);

  // Drag & drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    if (handleBlockedAction()) return;
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    const synth = { target: { files: [f] } };
    handleFileChange(synth);
  }, [handleFileChange]);

  // ── Transcribe ──
  const handleTranscribe = async () => {
    if (handleBlockedAction()) return;
    if (!file) { toast.error('Upload an audio file first'); return; }
    if (sessionCache.has(fileHash)) {
      setRawTranscript(sessionCache.get(fileHash));
      toast('♻️ Loaded from cache', { icon:'💾' });
      return;
    }

    setIsTranscribing(true);
    setProgress(5);
    setProgressLabel('Pre-flight checks…');

    const selectedMode = TRANSCRIPTION_MODES.find(m => m.value === mode);

    try {
      setProgress(20); setProgressLabel('Uploading audio…');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('outputLanguage', transcribeToEnglish ? 'english' : outputLanguage);
      formData.append('model', selectedMode.model);
      formData.append('speakerRecognition', speakerRecognition);
      formData.append('restoreAudio', restoreAudio);

      setProgress(45); setProgressLabel(`Transcribing with ${selectedMode.label} engine…`);
      const data = await apiFetchWithRetry(apiFetch, '/api/transcribe', { method:'POST', body:formData });

      setProgress(80); setProgressLabel('Running Text Engine…');
      const raw = data?.data?.transcript || '';
      setRawTranscript(raw);
      sessionCache.set(fileHash, raw);

      // Update credits
      if (typeof data.creditsUsed === 'number') {
        setCredits({
          creditsUsed: data.creditsUsed,
          creditsRemaining: Math.max(0, (data.creditsTotal || DAILY_LIMIT) - data.creditsUsed),
          creditsTotal: data.creditsTotal || DAILY_LIMIT,
        });
      }

      setProgress(100); setProgressLabel('Done!');
      toast.success(`Transcription complete — ${selectedMode.label} mode`);
    } catch (err) {
      toast.error(err.message || 'Transcription failed');
    } finally {
      setTimeout(() => { setIsTranscribing(false); setProgress(0); setProgressLabel(''); }, 600);
    }
  };

  // ── QA: Find & Replace ──
  const handleReplace = () => {
    if (!searchTerm) return;
    const updated = editableText.replace(new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi'), replaceTerm);
    setEditableText(updated);
    toast.success('Replacement applied');
  };

  // ── Export ──
  const handleExport = (fmt) => {
    const text = qaMode ? editableText : transcript;
    if (!text) return;

    let content, mime, ext;
    if (fmt === 'txt')  { content = text; mime = 'text/plain'; ext = 'txt'; }
    if (fmt === 'srt')  { content = generateSRT(text); mime = 'text/plain'; ext = 'srt'; }
    if (fmt === 'json') {
      content = JSON.stringify({ transcript: text, stats, file: file?.name, mode, outputLanguage, createdAt: new Date().toISOString() }, null, 2);
      mime = 'application/json'; ext = 'json';
    }

    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `transcript.${ext}`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported as .${ext}`);
  };

  const copyText = async () => {
    const text = qaMode ? editableText : transcript;
    if (!text) return;
    await navigator.clipboard.writeText(text).then(() => toast.success('Copied!')).catch(() => toast.error('Copy failed'));
  };

  const clearSession = () => { setFile(null); setTranscript(''); setRawTranscript(''); setFileHash(''); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const highlightSearch = (text) => {
    if (!searchTerm || !qaMode) return text;
    const parts = text.split(new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'));
    return parts.map((p, i) => p.toLowerCase() === searchTerm.toLowerCase()
      ? <mark key={i} style={{ background:'rgba(251,191,36,0.35)', borderRadius:'3px', color:'inherit' }}>{p}</mark>
      : p);
  };

  const activeText = qaMode ? editableText : transcript;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="container" style={{ maxWidth:'1140px', margin:'0 auto', padding:'2rem' }}>

      {/* Back */}
      <Link to="/utilities" className="btn-secondary" style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem', marginBottom:'1.5rem', textDecoration:'none' }}>
        <ChevronLeft size={16} /> Back to Utilities
      </Link>

      <ToolHeader
        title="Audio Transcription"
        description="Upload audio and get clean, structured text powered by Groq Whisper with our built-in Text Engine for punctuation, paragraph breaks, and filler word removal."
        icon={AudioLines}
        toolId="audio-transcription"
      />

      {/* ── Credit / Auth Banner ── */}
      <div className="glass-panel" style={{ padding:'1.25rem 1.5rem', marginBottom:'1.5rem',
        border: user ? '1px solid rgba(59,130,246,0.22)' : '1px solid rgba(245,158,11,0.26)',
        background: user ? 'rgba(59,130,246,0.06)' : 'rgba(245,158,11,0.08)' }}>
        {user ? (
          <div style={{ display:'flex', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap', alignItems:'center' }}>
            <div>
              <p style={{ margin:0, fontWeight:700 }}>Daily transcription quota</p>
              <p style={{ margin:'0.35rem 0 0', color:'var(--text-secondary)', fontSize:'0.9rem' }}>
                {isLoadingCredits ? 'Refreshing credits…' : `${credits.creditsRemaining} of ${credits.creditsTotal} remaining today`}
              </p>
            </div>
            <div style={{ minWidth:'220px', flex:'1 1 220px' }}>
              <div style={{ height:'8px', borderRadius:'999px', overflow:'hidden', background:'rgba(255,255,255,0.08)' }}>
                <div style={{ height:'100%', width:`${(credits.creditsUsed / Math.max(credits.creditsTotal,1))*100}%`,
                  background:'linear-gradient(90deg,#38bdf8,#818cf8)', transition:'width 0.3s ease' }} />
              </div>
              <p style={{ margin:'0.4rem 0 0', fontSize:'0.78rem', color:'var(--text-secondary)' }}>
                {credits.creditsRemaining === 0 ? '⚠️ Quota exhausted — resets at midnight' : `${credits.creditsUsed} used`}
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap', alignItems:'center' }}>
            <div>
              <p style={{ margin:0, fontWeight:700 }}>Authentication required</p>
              <p style={{ margin:'0.35rem 0 0', color:'var(--text-secondary)', fontSize:'0.9rem' }}>Sign in to use Groq Whisper and track your daily quota.</p>
            </div>
            <button onClick={() => setShowLoginModal(true)} className="btn-primary" style={{ padding:'0.85rem 1rem' }}>Login to Continue</button>
          </div>
        )}
      </div>

      {/* ── Main Grid ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(100%,320px),1fr))', gap:'1.5rem' }}>

        {/* LEFT — Upload & Settings */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>

          {/* Transcription Mode */}
          <div className="glass-panel" style={{ padding:'1.25rem 1.5rem' }}>
            <p style={{ margin:'0 0 0.9rem', fontWeight:700, display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <Zap size={16} color="var(--accent-primary)" /> Transcription Mode
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.6rem' }}>
              {TRANSCRIPTION_MODES.map(m => (
                <button key={m.value} onClick={() => setMode(m.value)}
                  title={m.desc}
                  style={{ background: mode === m.value ? 'rgba(56,189,248,0.18)' : 'rgba(255,255,255,0.04)',
                    border: mode === m.value ? '1.5px solid rgba(56,189,248,0.55)' : '1px solid var(--border-color)',
                    borderRadius:'12px', padding:'0.7rem 0.4rem', cursor:'pointer', transition:'all 0.2s',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:'0.3rem' }}>
                  <span style={{ fontSize:'1.5rem' }}>{m.emoji}</span>
                  <span style={{ fontWeight:700, fontSize:'0.88rem', color: mode === m.value ? '#38bdf8' : 'var(--text-primary)' }}>{m.label}</span>
                  <span style={{ fontSize:'0.68rem', color:'var(--text-secondary)' }}>{m.badge}</span>
                </button>
              ))}
            </div>
            <p style={{ margin:'0.75rem 0 0', fontSize:'0.82rem', color:'var(--text-secondary)' }}>
              {TRANSCRIPTION_MODES.find(m2 => m2.value === mode)?.desc}
            </p>
          </div>

          {/* Upload Drop Zone */}
          <div className="glass-panel" style={{ padding:'1.5rem' }}>
            <h3 style={{ marginTop:0, display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <Upload size={16} color="var(--accent-primary)" /> Upload Audio
            </h3>
            <p style={{ color:'var(--text-secondary)', marginTop:0, fontSize:'0.9rem' }}>MP3, WAV, M4A, AAC, FLAC, OGG, WEBM — max {MAX_FILE_MB} MB</p>

            <label htmlFor="audio-upload"
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'0.75rem',
                minHeight:'180px', borderRadius:'16px', border:'2px dashed var(--border-color)',
                background:'rgba(255,255,255,0.02)', cursor: user ? 'pointer' : 'not-allowed',
                opacity: user ? 1 : 0.7, textAlign:'center', padding:'1.5rem', transition:'border-color 0.2s' }}
              onClick={e => { if (!user) { e.preventDefault(); setShowLoginModal(true); } }}>
              <input ref={fileInputRef} id="audio-upload" type="file" hidden accept={ACCEPTED_AUDIO} onChange={handleFileChange} />
              <div style={iconBox('#3b82f6')}><Mic size={20} color="#60a5fa" /></div>
              <div>
                <strong>{file ? file.name : 'Drop or choose an audio file'}</strong>
                <p style={{ margin:'0.45rem 0 0', color:'var(--text-secondary)', fontSize:'0.85rem' }}>
                  {file ? `${(file.size/1024/1024).toFixed(2)} MB · ${file.type || 'audio'}` : 'Drag & drop supported'}
                </p>
              </div>
            </label>

            <PreflightWarning file={file} />

            {/* Output Language */}
            <div style={{ marginTop:'1rem' }}>
              <p style={{ margin:'0 0 0.6rem', fontWeight:600, fontSize:'0.9rem' }}>Output Language</p>
              <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                {OUTPUT_LANGUAGES.map(opt => (
                  <label key={opt.value} style={{ display:'inline-flex', alignItems:'center', gap:'0.4rem',
                    padding:'0.45rem 0.7rem', borderRadius:'10px', border:'1px solid var(--border-color)', cursor:'pointer',
                    background: outputLanguage === opt.value ? 'rgba(56,189,248,0.16)' : 'rgba(255,255,255,0.03)', fontSize:'0.85rem' }}>
                    <input type="radio" name="outputLanguage" value={opt.value} checked={outputLanguage === opt.value}
                      onChange={e => setOutputLanguage(e.target.value)} style={{ accentColor:'#38bdf8' }} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Advanced Settings Toggle */}
            <button onClick={() => setShowAdvanced(v => !v)}
              style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginTop:'1rem', background:'transparent',
                border:'none', color:'var(--text-secondary)', cursor:'pointer', fontSize:'0.88rem', padding:0 }}>
              <Users size={14} /> Speaker Recognition & More Settings
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showAdvanced && (
              <div style={{ marginTop:'0.85rem', display:'flex', flexDirection:'column', gap:'0.6rem',
                padding:'0.9rem', borderRadius:'12px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
                {[
                  { val:speakerRecognition, set:setSpeakerRecognition, icon:Users,   label:'Recognize Speakers',   desc:'Labels sections with who is speaking' },
                  { val:transcribeToEnglish,set:setTranscribeToEnglish,icon:Filter,  label:'Transcribe to English', desc:'Force output in English regardless of source' },
                  { val:restoreAudio,       set:setRestoreAudio,       icon:Sparkles,label:'Restore Audio',         desc:'AI noise reduction — use for poor quality audio only' },
                ].map(({ val, set, icon:Icon, label, desc }) => (
                  <label key={label} style={{ display:'flex', alignItems:'flex-start', gap:'0.75rem', cursor:'pointer' }}>
                    <input type="checkbox" checked={val} onChange={e => set(e.target.checked)}
                      style={{ marginTop:'3px', accentColor:'#38bdf8' }} />
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontWeight:600, fontSize:'0.88rem' }}>
                        <Icon size={13} /> {label}
                      </div>
                      <div style={{ fontSize:'0.78rem', color:'var(--text-secondary)' }}>{desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Text Engine Options */}
          <div className="glass-panel" style={{ padding:'1.25rem 1.5rem' }}>
            <p style={{ margin:'0 0 0.9rem', fontWeight:700, display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <Settings2 size={16} color="var(--accent-primary)" /> Text Engine
            </p>
            {[
              { val:smartParagraphs,  set:setSmartParagraphs,  label:'Smart Paragraph Breaks',   desc:'Auto-split text at natural topic transitions' },
              { val:stripFillers,     set:setStripFillers,     label:'Remove Filler Words',       desc:'Strip "um", "uh", "like", "you know", etc.' },
              { val:normalizeNumbers, set:setNormalizeNumbers, label:'Normalize Numbers',         desc:'Convert "twenty three" → "23"' },
            ].map(({ val, set, label, desc }) => (
              <label key={label} style={{ display:'flex', alignItems:'flex-start', gap:'0.75rem', cursor:'pointer', marginBottom:'0.55rem' }}>
                <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} style={{ marginTop:'3px', accentColor:'#38bdf8' }} />
                <div>
                  <div style={{ fontWeight:600, fontSize:'0.88rem' }}>{label}</div>
                  <div style={{ fontSize:'0.78rem', color:'var(--text-secondary)' }}>{desc}</div>
                </div>
              </label>
            ))}
          </div>

          {/* Action Buttons */}
          <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
            <button onClick={handleTranscribe} disabled={!canTranscribe} className="btn-primary"
              style={{ flex:'1 1 200px', opacity: canTranscribe ? 1 : 0.55, cursor: canTranscribe ? 'pointer' : 'not-allowed',
                display:'inline-flex', alignItems:'center', justifyContent:'center', gap:'0.5rem' }}>
              {isTranscribing
                ? <><LoaderCircle size={17} className="spin" /> Transcribing…</>
                : <><FileAudio size={17} /> {user ? 'Transcribe Audio' : 'Login Required'}</>}
            </button>
            <button onClick={clearSession} className="btn-secondary" style={{ flex:'0 0 auto' }}>
              <Trash2 size={16} />
            </button>
          </div>

          {/* Progress Bar */}
          {isTranscribing && (
            <div style={{ marginTop:'0.25rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:'4px' }}>
                <span>{progressLabel}</span><span>{progress}%</span>
              </div>
              <div style={{ height:'6px', borderRadius:'999px', background:'rgba(255,255,255,0.08)', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${progress}%`, background:'linear-gradient(90deg,#38bdf8,#818cf8)', transition:'width 0.4s ease' }} />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Transcript Panel */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>

          {/* Transcript Header */}
          <div className="glass-panel" style={{ padding:'1.5rem', flex:1, display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:'0.5rem' }}>
              <div>
                <h3 style={{ margin:0, display:'flex', alignItems:'center', gap:'0.5rem' }}>
                  <FileText size={16} color="var(--accent-primary)" /> Transcript
                </h3>
                <p style={{ margin:'0.25rem 0 0', color:'var(--text-secondary)', fontSize:'0.85rem' }}>
                  {sessionCache.has(fileHash) && transcript ? '♻️ Loaded from session cache' : 'Processed by Text Engine'}
                </p>
              </div>
              <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                <button onClick={() => setQaMode(v => !v)} className={qaMode ? 'btn-primary' : 'btn-secondary'}
                  style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'0.82rem', padding:'0.5rem 0.8rem' }}
                  title="Quality Analyst Mode">
                  <ClipboardCheck size={14} /> QA Mode
                </button>
                {rawTranscript && transcript && rawTranscript !== transcript && (
                  <button onClick={() => setShowDiff(v => !v)} className="btn-secondary"
                    style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'0.82rem', padding:'0.5rem 0.8rem' }}>
                    <RefreshCw size={14} /> {showDiff ? 'Hide' : 'Show'} Diff
                  </button>
                )}
                <button onClick={copyText} disabled={!activeText} className="btn-secondary"
                  style={{ opacity: activeText ? 1 : 0.5, cursor: activeText ? 'pointer' : 'not-allowed' }}>
                  <Copy size={15} />
                </button>
              </div>
            </div>

            {/* Stats Bar */}
            {stats && (
              <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginBottom:'1rem' }}>
                <StatBadge label="Words"     value={stats.wordCount}       />
                <StatBadge label="Sentences" value={stats.sentenceCount}   />
                <StatBadge label="Read Time" value={`${stats.estimatedReadMin}m`} />
                <StatBadge label="Readability" value={stats.readabilityLabel}
                  color={stats.readabilityLabel==='Easy'?'#4ade80':stats.readabilityLabel==='Moderate'?'#facc15':'#f87171'} />
              </div>
            )}

            {/* QA: Find & Replace */}
            {qaMode && (
              <div style={{ padding:'0.85rem', borderRadius:'12px', background:'rgba(255,255,255,0.04)',
                border:'1px solid rgba(255,255,255,0.08)', marginBottom:'1rem', display:'flex', flexDirection:'column', gap:'0.6rem' }}>
                <p style={{ margin:0, fontWeight:700, fontSize:'0.85rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                  <Search size={13} /> Find &amp; Replace
                </p>
                <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                  <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Find…"
                    style={{ flex:'1 1 100px', padding:'0.4rem 0.65rem', borderRadius:'8px', border:'1px solid var(--border-color)',
                      background:'rgba(255,255,255,0.05)', color:'var(--text-primary)', fontSize:'0.85rem' }} />
                  <input value={replaceTerm} onChange={e => setReplaceTerm(e.target.value)} placeholder="Replace with…"
                    style={{ flex:'1 1 100px', padding:'0.4rem 0.65rem', borderRadius:'8px', border:'1px solid var(--border-color)',
                      background:'rgba(255,255,255,0.05)', color:'var(--text-primary)', fontSize:'0.85rem' }} />
                  <button onClick={handleReplace} className="btn-primary"
                    style={{ fontSize:'0.82rem', padding:'0.4rem 0.8rem', display:'flex', alignItems:'center', gap:'0.35rem' }}>
                    <RefreshCw size={12} /> Replace
                  </button>
                </div>
              </div>
            )}

            {/* Diff Viewer */}
            {showDiff && rawTranscript && transcript && (
              <div style={{ padding:'0.85rem', borderRadius:'12px', background:'rgba(255,255,255,0.03)',
                border:'1px solid rgba(255,255,255,0.08)', marginBottom:'1rem', fontSize:'0.82rem' }}>
                <p style={{ margin:'0 0 0.5rem', fontWeight:700, fontSize:'0.85rem' }}>Before / After Text Engine</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
                  <div>
                    <p style={{ margin:'0 0 0.35rem', color:'#f87171', fontSize:'0.78rem', fontWeight:600 }}>RAW</p>
                    <div style={{ background:'rgba(239,68,68,0.07)', borderRadius:'8px', padding:'0.6rem',
                      color:'var(--text-secondary)', lineHeight:1.6, maxHeight:'120px', overflowY:'auto', whiteSpace:'pre-wrap' }}>
                      {rawTranscript}
                    </div>
                  </div>
                  <div>
                    <p style={{ margin:'0 0 0.35rem', color:'#4ade80', fontSize:'0.78rem', fontWeight:600 }}>CLEANED</p>
                    <div style={{ background:'rgba(74,222,128,0.07)', borderRadius:'8px', padding:'0.6rem',
                      color:'var(--text-secondary)', lineHeight:1.6, maxHeight:'120px', overflowY:'auto', whiteSpace:'pre-wrap' }}>
                      {transcript}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Main Text Area */}
            {qaMode ? (
              <textarea value={editableText} onChange={e => setEditableText(e.target.value)}
                style={{ flex:1, minHeight:'280px', borderRadius:'14px', border:'1px solid rgba(56,189,248,0.3)',
                  background:'rgba(2,6,23,0.45)', padding:'1rem', whiteSpace:'pre-wrap', lineHeight:1.75,
                  color:'var(--text-primary)', resize:'vertical', fontFamily:'inherit', fontSize:'0.95rem',
                  outline:'none', width:'100%', boxSizing:'border-box' }} />
            ) : (
              <div style={{ flex:1, minHeight:'280px', borderRadius:'14px', border:'1px solid var(--border-color)',
                background:'rgba(2,6,23,0.45)', padding:'1rem', whiteSpace:'pre-wrap', lineHeight:1.75,
                color: transcript ? 'var(--text-primary)' : 'var(--text-secondary)', overflowY:'auto' }}>
                {transcript ? (searchTerm ? highlightSearch(transcript) : transcript) : 'Transcribed text will appear here after processing.'}
              </div>
            )}

            {/* Info note */}
            {transcript && !qaMode && (
              <p style={{ margin:'0.6rem 0 0', fontSize:'0.78rem', color:'var(--text-secondary)', display:'flex', alignItems:'center', gap:'0.35rem' }}>
                <Info size={12} /> Enable QA Mode to edit the transcript inline.
              </p>
            )}
          </div>

          {/* Export Panel */}
          {transcript && (
            <div className="glass-panel" style={{ padding:'1.25rem 1.5rem' }}>
              <p style={{ margin:'0 0 0.85rem', fontWeight:700, display:'flex', alignItems:'center', gap:'0.5rem' }}>
                <Download size={15} color="var(--accent-primary)" /> Export Transcript
              </p>
              <div style={{ display:'flex', gap:'0.6rem', flexWrap:'wrap' }}>
                {EXPORT_FORMATS.map(({ value, label, icon:Icon }) => (
                  <button key={value} onClick={() => handleExport(value)} className="btn-secondary"
                    style={{ display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.83rem', padding:'0.55rem 0.85rem' }}>
                    <Icon size={13} /> {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <LoginRequiredModal open={showLoginModal} onClose={() => setShowLoginModal(false)} pathname={location.pathname} />

      <style>{`
        .spin { animation: spin 0.9s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        textarea:focus { border-color: rgba(56,189,248,0.5) !important; }
      `}</style>
    </div>
  );
}
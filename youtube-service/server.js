'use strict';
require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const fs       = require('fs');
const os       = require('os');
const path     = require('path');
const { execSync, execFile } = require('child_process');
const { v4: uuidv4 }  = require('uuid');
const ffmpegPath       = require('ffmpeg-static');
const ffmpeg           = require('fluent-ffmpeg');
const YTDlpWrap        = require('yt-dlp-wrap').default;

ffmpeg.setFfmpegPath(ffmpegPath);

// Resolve yt-dlp binary: env override → PATH lookup → Windows default location
function resolveYtDlpBinary() {
  if (process.env.YTDLP_PATH) return process.env.YTDLP_PATH;
  try {
    const { execSync } = require('child_process');
    const cmd = process.platform === 'win32' ? 'where yt-dlp' : 'which yt-dlp';
    return execSync(cmd, { encoding: 'utf8' }).trim().split('\n')[0].trim();
  } catch {
    return 'yt-dlp'; // fallback: rely on PATH at exec time
  }
}
const YTDLP_BIN = resolveYtDlpBinary();

const PORT          = process.env.PORT             || 3001;
const TMP_DIR       = process.env.TMP_DIR           || os.tmpdir();
const TEMP_TTL      = parseInt(process.env.TEMP_TTL_MINUTES || '5', 10) * 60 * 1000;
const WORKER_SECRET = process.env.WORKER_SECRET     || ''; // shared secret with Cloudflare Worker

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:8787')
  .split(',')
  .map((s) => s.trim());

const app = express();
app.use(express.json());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  credentials: true,
}));

// Guard: if WORKER_SECRET is set, every request must carry the matching header.
// In local dev WORKER_SECRET is empty so no check is done.
app.use((req, res, next) => {
  if (!WORKER_SECRET) return next(); // dev mode — no secret required
  if (req.headers['x-worker-secret'] === WORKER_SECRET) return next();
  res.status(401).json({ error: 'Unauthorized' });
});

// ─── yt-dlp setup ────────────────────────────────────────────────────────────

const ytDlp = new YTDlpWrap(YTDLP_BIN);

// Check / update yt-dlp on startup
function tryUpdateYtDlp() {
  try {
    execSync('yt-dlp --update-to stable', { stdio: 'ignore', timeout: 30000 });
    console.log('[yt-dlp] Updated / verified latest stable');
  } catch {
    console.warn('[yt-dlp] Update check skipped (not in PATH or no internet)');
  }
}
tryUpdateYtDlp();

// ─── In-memory per-IP download queue (max 1 active per IP) ───────────────────

const activeDownloads = new Map(); // ip → true

// ─── Temp file registry (auto-delete after TTL) ───────────────────────────────

const tempFiles = new Set();

function registerTemp(filePath) {
  tempFiles.add(filePath);
  setTimeout(() => deleteTemp(filePath), TEMP_TTL);
}

function deleteTemp(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* already gone */ }
  tempFiles.delete(filePath);
}

// ─── Shared yt-dlp args ──────────────────────────────────────────────────────

const COMMON_ARGS = [
  '--no-playlist',
  '--no-warnings',
  '--user-agent',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  '--add-header', 'Accept-Language:en-US,en;q=0.9',
];

// ─── Logging helper ──────────────────────────────────────────────────────────

function log(level, msg, meta = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...meta }));
}

// ─── /health ─────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── GET /info?url= ──────────────────────────────────────────────────────────

app.get('/info', async (req, res) => {
  const { url } = req.query;
  if (!url || !isYouTubeUrl(url)) {
    return res.status(400).json({ error: 'Invalid or missing YouTube URL.' });
  }

  try {
    const raw = await ytDlp.getVideoInfo(url, [...COMMON_ARGS]);

    if (raw.is_live) {
      return res.status(422).json({ error: 'Live streams are not supported.' });
    }

    // Build a clean format list from available heights
    const heights = [...new Set(
      (raw.formats || [])
        .filter((f) => f.height)
        .map((f) => f.height)
        .sort((a, b) => b - a)
    )];
    const formats = heights.slice(0, 6).map((h) => `${h}p`);
    formats.push('audio');

    res.json({
      title:     raw.title     || 'Unknown title',
      thumbnail: raw.thumbnail || null,
      duration:  raw.duration  || 0,
      channel:   raw.uploader  || raw.channel || '',
      formats,
    });
  } catch (err) {
    const msg = parseYtDlpError(err);
    log('error', 'info failed', { url, msg });
    res.status(500).json({ error: msg });
  }
});

// ─── POST /download ──────────────────────────────────────────────────────────
// Body: { url: string, quality: '1080p' | '720p' | ... | 'audio' }

app.post('/download', async (req, res) => {
  const { url, quality = 'best' } = req.body || {};
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;

  if (!url || !isYouTubeUrl(url)) {
    return res.status(400).json({ error: 'Invalid or missing YouTube URL.' });
  }

  // Queue enforcement
  if (activeDownloads.get(ip)) {
    return res.status(429).json({ error: 'A download is already in progress. Please wait.' });
  }
  activeDownloads.set(ip, true);

  const sessionId  = uuidv4();
  const audioOnly  = quality === 'audio';
  const outExt     = audioOnly ? 'mp3' : 'mp4';
  const outPath    = path.join(TMP_DIR, `yt_${sessionId}.${outExt}`);

  log('info', 'download started', { url, quality, ip, sessionId });

  try {
    const fallbackSteps = audioOnly
      ? [
          { fmt: 'bestaudio/best', label: 'best audio' },
        ]
      : buildVideoFallbacks(quality);

    let usedLabel = '';
    let succeeded = false;

    for (const step of fallbackSteps) {
      try {
        await downloadWithFfmpeg(url, step.fmt, outPath, audioOnly);
        usedLabel = step.label;
        succeeded = true;
        break;
      } catch (err) {
        log('warn', `fallback: ${step.label} failed`, { err: err.message, sessionId });
      }
    }

    if (!succeeded) {
      activeDownloads.delete(ip);
      return res.status(500).json({ error: 'All download formats failed. The video may be unavailable or restricted.' });
    }

    registerTemp(outPath);

    const stat     = fs.statSync(outPath);
    const filename = sanitizeFilename(`video_${sessionId}.${outExt}`);

    log('info', 'download success', { url, usedLabel, bytes: stat.size, sessionId });

    res.setHeader('Content-Type',        audioOnly ? 'audio/mpeg' : 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length',      stat.size);
    res.setHeader('X-Format-Used',       usedLabel);

    const stream = fs.createReadStream(outPath);
    stream.pipe(res);
    stream.on('close', () => deleteTemp(outPath));
    stream.on('error', () => deleteTemp(outPath));

  } catch (err) {
    deleteTemp(outPath);
    const msg = parseYtDlpError(err);
    log('error', 'download error', { url, quality, msg, sessionId });
    res.status(500).json({ error: msg });
  } finally {
    activeDownloads.delete(ip);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isYouTubeUrl(url) {
  try {
    const u = new URL(url);
    return /youtube\.com|youtu\.be/.test(u.hostname);
  } catch {
    return false;
  }
}

function buildVideoFallbacks(quality) {
  // quality looks like '1080p', '720p', etc.
  const height = parseInt(quality, 10) || 0;
  const steps = [];

  if (height >= 1080) {
    steps.push({ fmt: 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio', label: '1080p' });
  }
  if (height >= 720) {
    steps.push({ fmt: 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio',   label: '720p' });
  }
  // always include these fallbacks in order
  steps.push({ fmt: 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio', label: '480p' });
  steps.push({ fmt: 'best[ext=mp4]/best', label: 'best pre-merged' });
  steps.push({ fmt: 'bestaudio/best',     label: 'audio-only fallback' });

  // Deduplicate by label
  const seen = new Set();
  return steps.filter((s) => { if (seen.has(s.label)) return false; seen.add(s.label); return true; });
}

function downloadWithFfmpeg(url, fmt, outPath, audioOnly) {
  return new Promise((resolve, reject) => {
    const args = [
      ...COMMON_ARGS,
      '-f', fmt,
      '--merge-output-format', audioOnly ? 'mp3' : 'mp4',
      '--ffmpeg-location', ffmpegPath,
      '-o', outPath,
      '--no-part',
      url,
    ];

    ytDlp.exec(args)
      .on('ytDlpEvent', (type, data) => {
        if (type === 'download' && data.includes('%')) log('debug', 'progress', { data });
      })
      .on('error',  reject)
      .on('close',  (code) => {
        if (code === 0 && fs.existsSync(outPath)) resolve();
        else reject(new Error(`yt-dlp exited with code ${code}`));
      });
  });
}

function parseYtDlpError(err) {
  const msg = err?.message || String(err);
  if (/private/i.test(msg))             return 'This video is private and cannot be downloaded.';
  if (/age.?restrict/i.test(msg))       return 'Age-restricted videos are not supported.';
  if (/not available/i.test(msg))       return 'Video not available in your region or has been removed.';
  if (/live/i.test(msg))                return 'Live streams are not supported.';
  if (/copyright/i.test(msg))           return 'This video is blocked due to copyright restrictions.';
  if (/unavailable/i.test(msg))         return 'Video unavailable. It may have been deleted or made private.';
  return 'Download failed. The video may be restricted or temporarily unavailable.';
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  log('info', `youtube-service listening on port ${PORT}`);
});

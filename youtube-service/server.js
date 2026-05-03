import 'dotenv/config';
import { execSync } from 'node:child_process';
import cors from 'cors';
import express from 'express';
import ffmpegPath from 'ffmpeg-static';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import pkg from 'yt-dlp-wrap';
const { default: YTDlpWrap } = pkg;

// ESM compatibility for __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8080;
const TMP_DIR = process.env.TMP_DIR || os.tmpdir();
const MAX_CONCURRENT = Number.parseInt(process.env.MAX_CONCURRENT || '10', 10);
const TEMP_TTL = Number.parseInt(process.env.TEMP_TTL_MINUTES || '10', 10) * 60 * 1000;
const JOB_TTL = Number.parseInt(process.env.JOB_TTL_MINUTES || '20', 10) * 60 * 1000;
const PROXY_DISABLE_MS = Number.parseInt(process.env.PROXY_DISABLE_MINUTES || '5', 10) * 60 * 1000;
const MAX_DOWNLOADS_PER_WINDOW = Number.parseInt(process.env.DOWNLOAD_RATE_LIMIT || '5', 10);
const RATE_WINDOW_MS = Number.parseInt(process.env.RATE_WINDOW_MINUTES || '10', 10) * 60 * 1000;

const DEFAULT_WORKERS = ['worker-1', 'worker-2', 'worker-3'];
const USER_WAIT_MESSAGE = 'This is a high-performance downloader that supports 4K and 8K with audio merging. Please wait while your job is processed.';
const QUEUE_WAIT_DETAIL = 'Please wait. High-quality downloads (4K/8K with audio) require processing time.';
const RETRYING_MESSAGE = 'Retrying on another server...';
const AVERAGE_JOB_SECONDS_MIN = Number.parseInt(process.env.AVERAGE_JOB_SECONDS_MIN || '20', 10);
const AVERAGE_JOB_SECONDS_MAX = Number.parseInt(process.env.AVERAGE_JOB_SECONDS_MAX || '60', 10);
const JOB_TIMEOUT_MS = Number.parseInt(process.env.JOB_TIMEOUT_MS || '30000', 10);
const MAX_JOB_RETRIES = Number.parseInt(process.env.MAX_JOB_RETRIES || '3', 10);
const WORKERS = (process.env.WORKERS || DEFAULT_WORKERS.join(','))
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const PROXIES = (process.env.PROXY_LIST || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

function getRandomProxy() {
  if (!PROXIES.length) return null;
  return PROXIES[Math.floor(Math.random() * PROXIES.length)];
}

function log(level, message, meta = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, message, ...meta }));
}

function resolveYtDlpBinary() {
  // IMPORTANT: Only use yt-dlp binary path, NEVER secrets
  if (process.env.YTDLP_PATH) {
    console.log('[YTDLP] Using YTDLP_PATH env var:', process.env.YTDLP_PATH);
    return process.env.YTDLP_PATH;
  }
  try {
    const cmd = process.platform === 'win32' ? 'where yt-dlp' : 'which yt-dlp';
    const path = execSync(cmd, { encoding: 'utf8' }).trim().split('\n')[0].trim();
    console.log('[YTDLP] Found yt-dlp at:', path);
    return path;
  } catch (err) {
    console.log('[YTDLP] which/where failed, using fallback "yt-dlp":', err.message);
    return 'yt-dlp';
  }
}

console.log('[STARTUP] Server initialization starting...');

let ytDlp = null;
try {
  console.log('[STARTUP] Initializing yt-dlp...');
  const ytDlpBinary = resolveYtDlpBinary();
  console.log('[STARTUP] yt-dlp binary path:', ytDlpBinary);
  // SECURITY: Ensure we NEVER use WORKER_SECRET or any auth token here
  if (ytDlpBinary.includes('secret') || ytDlpBinary.includes('SECRET') || ytDlpBinary.includes('token')) {
    throw new Error('CRITICAL: yt-dlp binary path contains a secret! This must NEVER happen.');
  }
  ytDlp = new (YTDlpWrap.default || YTDlpWrap)(ytDlpBinary);
  console.log('[STARTUP] yt-dlp instance created successfully');
  
  try {
    execSync('yt-dlp --update-to stable', { stdio: 'ignore', timeout: 30000 });
    log('info', 'yt-dlp verified');
    console.log('[STARTUP] yt-dlp verified and updated');
  } catch (updateError) {
    log('warn', 'yt-dlp update skipped', { error: updateError.message });
    console.log('[STARTUP] yt-dlp update skipped:', updateError.message);
  }
} catch (initError) {
  log('error', 'yt-dlp initialization failed', { error: initError.message });
  console.error('[STARTUP] CRITICAL: yt-dlp initialization failed:', initError.message);
  console.error('[STARTUP] Downloads will fail, but server will continue running');
  ytDlp = null;
}

let workerIndex = 0;
let activeJobs = 0;
const queue = [];
const jobs = new Map();
const rateLimits = new Map();

function getClientIp(req) {
  return (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
    .toString()
    .split(',')[0]
    .trim();
}

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateLimits.set(ip, entry);
  }
  entry.count += 1;
  return entry.count <= MAX_DOWNLOADS_PER_WINDOW;
}

function estimateWaitRange(position) {
  const minSeconds = Math.max(10, position * AVERAGE_JOB_SECONDS_MIN);
  const maxSeconds = Math.max(minSeconds, position * AVERAGE_JOB_SECONDS_MAX);
  return `${minSeconds}-${maxSeconds} seconds`;
}

function updateQueuedJobMetadata() {
  queue.forEach((job, index) => {
    job.queuePosition = index + 1;
    job.estimatedWait = estimateWaitRange(job.queuePosition);
    job.message = QUEUE_WAIT_DETAIL;
  });
}

function startQueuedJobs() {
  while (activeJobs < MAX_CONCURRENT && queue.length > 0) {
    const nextJob = queue.shift();
    activeJobs += 1;
    nextJob.status = 'starting';
    nextJob.queuePosition = 0;
    nextJob.estimatedWait = '0-20 seconds';
    nextJob.message = USER_WAIT_MESSAGE;
    nextJob.startedAt = Date.now();
    runDownloadWithFailover(nextJob)
      .catch((error) => {
        nextJob.status = 'error';
        nextJob.error = parseYtDlpError(error);
        nextJob.message = 'Retrying with another server...';
        log('error', 'unhandled download failure', { jobId: nextJob.jobId, error: error.message });
      })
      .finally(() => {
        activeJobs = Math.max(0, activeJobs - 1);
        startQueuedJobs();
      });
  }
  updateQueuedJobMetadata();
}

function scheduleJob(job) {
  if (activeJobs < MAX_CONCURRENT) {
    activeJobs += 1;
    job.status = 'starting';
    job.queuePosition = 0;
    job.estimatedWait = '0-20 seconds';
    job.message = USER_WAIT_MESSAGE;
    job.startedAt = Date.now();
    runDownloadWithFailover(job)
      .catch((error) => {
        job.status = 'error';
        job.error = parseYtDlpError(error);
        job.message = 'Retrying with another server...';
        log('error', 'unhandled download failure', { jobId: job.jobId, error: error.message });
      })
      .finally(() => {
        activeJobs = Math.max(0, activeJobs - 1);
        startQueuedJobs();
      });
    return;
  }

  queue.push(job);
  job.status = 'queued';
  updateQueuedJobMetadata();
}

function getNextWorker() {
  const worker = WORKERS[workerIndex % WORKERS.length] || 'worker-1';
  workerIndex += 1;
  return worker;
}

function getWorkerSequence() {
  const firstWorker = getNextWorker();
  const remainingWorkers = (WORKERS.length ? WORKERS : ['worker-1']).filter((worker) => worker !== firstWorker);
  return [firstWorker, ...remainingWorkers];
}


function isYouTubeUrl(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === 'youtu.be' || hostname.endsWith('.youtube.com') || hostname === 'youtube.com';
  } catch {
    return false;
  }
}

function normalizeQuality(quality = 'best') {
  const value = String(quality).toLowerCase().replace(/p$/, '');
  if (value === '8k' || value === '4320') return '8k';
  if (value === '4k' || value === '2160') return '4k';
  if (value === '1080') return '1080';
  if (value === '720') return '720';
  return 'best';
}

function formatExpression(quality) {
  switch (normalizeQuality(quality)) {
    case '8k':
      return 'bv*[height<=4320]+ba/best';
    case '4k':
      return 'bv*[height<=2160]+ba/best';
    case '1080':
      return 'bv*[height<=1080]+ba/best';
    case '720':
      return 'bv*[height<=720]+ba/best';
    default:
      return 'bv*+ba/best';
  }
}

function fallbackQualities(quality) {
  const wanted = normalizeQuality(quality);
  const order = wanted === '8k'
    ? ['8k', '4k', '1080', '720', 'best']
    : wanted === '4k'
    ? ['4k', '1080', '720', 'best']
    : wanted === '1080'
      ? ['1080', '720', 'best']
      : wanted === '720'
        ? ['720', 'best']
        : ['best'];
  return [...new Set(order)];
}

function baseArgs(proxy) {
  const args = [
    '--no-playlist',
    '--no-warnings',
    '--newline',
    '--force-overwrites',
    '--user-agent',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    '--add-header',
    'Accept-Language:en-US,en;q=0.9',
  ];
  if (proxy) args.push('--proxy', proxy);
  return args;
}

function safeDelete(filePath) {
  if (!filePath) return;
  fs.promises.unlink(filePath).catch(() => {});
}

function cleanupJob(jobId, delay = JOB_TTL) {
  setTimeout(() => {
    const job = jobs.get(jobId);
    if (!job) return;
    safeDelete(job.filePath);
    jobs.delete(jobId);
  }, delay);
}

function createJob({ url, quality, ip }) {
  const jobId = uuidv4();
  const filePath = path.join(TMP_DIR, `youtube_${jobId}.mp4`);
  const job = {
    jobId,
    url,
    quality: normalizeQuality(quality),
    status: 'queued',
    progress: 0,
    percent: 0,
    speed: '',
    eta: '',
    worker: '',
    proxy: '',
    formatUsed: '',
    filePath,
    fileSize: 0,
    filename: `youtube_${jobId}.mp4`,
    error: null,
    message: USER_WAIT_MESSAGE,
    retryCount: 0,
    maxRetries: MAX_JOB_RETRIES,
    attemptHistory: [],
    activeProcess: null,
    queuePosition: 0,
    estimatedWait: '0-20 seconds',
    createdAt: Date.now(),
    startedAt: null,
    completedAt: null,
    ip,
  };
  jobs.set(jobId, job);
  cleanupJob(jobId);
  return job;
}

const PROGRESS_RE = /\[download\]\s+(\d+(?:\.\d+)?)%.*?(?:at\s+(\S+))?.*?(?:ETA\s+(\S+))?/i;
const MERGE_RE = /\[Merger\]|Merging formats|Destination:/i;

function updateProgress(job, line) {
  const text = String(line);
  const match = PROGRESS_RE.exec(text);
  if (match) {
    const value = Number.parseFloat(match[1]);
    if (Number.isFinite(value)) {
      job.progress = Math.min(98, value);
      job.percent = job.progress;
    }
    if (match[2]) job.speed = match[2];
    if (match[3]) job.eta = match[3];
    return;
  }
  if (MERGE_RE.test(text)) {
    job.status = 'merging';
    job.progress = Math.max(job.progress, 99);
    job.percent = job.progress;
  }
}

function runYtDlp(job, quality, proxy, worker) {
  return new Promise((resolve, reject) => {
    if (!ytDlp) {
      return reject(new Error('yt-dlp is not initialized. Server startup failed.'));
    }

    const args = [
      ...baseArgs(proxy),
      '-f',
      formatExpression(quality),
      '--merge-output-format',
      'mp4',
      '--ffmpeg-location',
      ffmpegPath,
      '-o',
      job.filePath,
      '--no-part',
      job.url,
    ];

    job.status = 'downloading';
    job.worker = worker;
    job.proxy = proxy ? redactProxy(proxy.url) : 'direct';
    job.formatUsed = quality;
    job.progress = 0;
    job.percent = 0;
    job.message = USER_WAIT_MESSAGE;
    let settled = false;
    const child = ytDlp.exec(args);
    job.activeProcess = child;

    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      job.activeProcess = null;
      handler(value);
    };

    const timeoutId = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // Ignore cleanup errors - retry path handles recovery.
      }
      finish(reject, new Error(`Download timed out after ${JOB_TIMEOUT_MS}ms`));
    }, JOB_TIMEOUT_MS);

    child
      .on('ytDlpEvent', (_eventType, eventData) => updateProgress(job, eventData))
      .on('error', (error) => finish(reject, error))
      .on('close', (code) => {
        if (code === 0 && fs.existsSync(job.filePath)) {
          finish(resolve);
          return;
        }
        finish(reject, new Error(`yt-dlp exited with code ${code}`));
      });
  });
}

async function runDownloadWithFailover(job) {
  const qualities = fallbackQualities(job.quality);
  const errors = [];
  let lastAssignedWorker = '';
  const workerSequence = getWorkerSequence();
  const attemptPlan = [];

  for (const worker of workerSequence) {
    for (const quality of qualities) {
      attemptPlan.push({ worker, quality });
    }
  }

  for (let retryIndex = 0; retryIndex < Math.min(MAX_JOB_RETRIES, attemptPlan.length); retryIndex += 1) {
    const { worker, quality } = attemptPlan[retryIndex];
    lastAssignedWorker = worker;
    const proxy = getRandomProxy();
    safeDelete(job.filePath);
    job.retryCount = retryIndex;
    job.status = retryIndex === 0 ? 'downloading' : 'retrying';
    job.worker = worker;
    job.proxy = proxy || 'direct';
    job.formatUsed = quality;
    job.message = retryIndex === 0 ? USER_WAIT_MESSAGE : RETRYING_MESSAGE;
    job.attemptHistory.push({
      retry: retryIndex + 1,
      worker,
      quality,
      proxy: proxy || 'direct',
      startedAt: Date.now(),
    });
    log('info', 'download attempt', {
      jobId: job.jobId,
      retry: retryIndex + 1,
      worker,
      quality,
      proxy: proxy || 'direct',
    });

    try {
      await runYtDlp(job, quality, proxy, worker);
      const stat = fs.statSync(job.filePath);
      job.fileSize = stat.size;
      job.filename = sanitizeFilename(`${job.jobId}_${quality}.mp4`);
      job.status = 'ready';
      job.progress = 100;
      job.percent = 100;
      job.completedAt = Date.now();
      job.message = USER_WAIT_MESSAGE;
      log('info', 'download ready', { jobId: job.jobId, worker, quality, bytes: job.fileSize });
      return;
    } catch (error) {
      errors.push(error);
      job.error = parseYtDlpError(error);
      job.status = 'retrying';
      job.message = RETRYING_MESSAGE;
      log('warn', 'download attempt failed', {
        jobId: job.jobId,
        retry: retryIndex + 1,
        worker,
        quality,
        error: error.message,
      });
      if (job.activeProcess) {
        try {
          job.activeProcess.kill('SIGKILL');
        } catch {
          // Ignore cleanup errors and continue retrying.
        }
        job.activeProcess = null;
      }
    }
  }

  job.status = 'error';
  job.error = errors.length ? parseYtDlpError(errors[errors.length - 1]) : 'Download failed.';
  job.worker = lastAssignedWorker || getNextWorker();
  job.message = RETRYING_MESSAGE;
}

async function getVideoInfo(url) {
  if (!ytDlp) {
    throw new Error('yt-dlp is not initialized. Server startup failed.');
  }

  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const proxy = getRandomProxy();
      if (proxy) console.log(`[VIDEO-INFO] Attempt ${attempt + 1}/3 using proxy:`, proxy);

      const raw = await ytDlp.getVideoInfo(url, baseArgs(proxy));

      if (raw.is_live) {
        const error = new Error('Live streams are not supported.');
        error.statusCode = 422;
        throw error;
      }

      return {
        title: raw.title || 'Unknown title',
        thumbnail: raw.thumbnail || null,
        duration: raw.duration || 0,
        channel: raw.uploader || raw.channel || '',
        formats: ['best', '720', '1080', '4k', '8k'],
      };
    } catch (error) {
      console.log(`[VIDEO-INFO] Attempt ${attempt + 1} failed:`, error.message);
      lastError = error;
    }
  }

  throw lastError || new Error('Unable to fetch video info after 3 attempts.');
}

function parseYtDlpError(error) {
  const message = error?.message || String(error);
  if (/private/i.test(message)) return 'This video is private and cannot be downloaded.';
  if (/age.?restrict/i.test(message)) return 'Age-restricted videos are not supported.';
  if (/not available|unavailable/i.test(message)) return 'Video unavailable. It may have been removed, blocked, or made private.';
  if (/live/i.test(message)) return 'Live streams are not supported.';
  if (/copyright/i.test(message)) return 'This video is blocked due to copyright restrictions.';
  if (/sign.?in|login/i.test(message)) return 'This video requires sign-in and cannot be downloaded.';
  if (/timed out|timeout/i.test(message)) return RETRYING_MESSAGE;
  if (/proxy/i.test(message)) return RETRYING_MESSAGE;
  return 'Download failed. The video may be restricted or temporarily unavailable.';
}

function sanitizeFilename(name) {
  return String(name || 'video.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');
}

const WORKER_SECRET = process.env.WORKER_SECRET || '';

const app = express();

// 1. CORS — must be first so preflight OPTIONS responses include the right headers
app.use(cors({
  origin: [
    'https://www.multitoolhub.space',
    'https://multitoolhub.space',
    'http://localhost:5173',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());

// 2. Debug logger
app.use((req, res, next) => {
  console.log('[REQUEST]', req.method, req.path, { origin: req.headers.origin || 'no-origin', ts: new Date().toISOString() });
  next();
});

// 3. JSON body parser
app.use(express.json({ limit: '1mb' }));

// 4. Auth guard — only active when WORKER_SECRET is set in env
// YouTube API routes are open because they're rate-limited by the Cloudflare Worker
app.use((req, res, next) => {
  const OPEN_PATHS = ['/', '/api/health', '/health', '/api/test-cors'];
  if (OPEN_PATHS.includes(req.path)) return next();
  if (req.path.startsWith('/api/auth')) return next();
  if (req.path.startsWith('/api/video-info')) return next();
  if (req.path.startsWith('/api/download')) return next();
  if (req.path.startsWith('/api/progress')) return next();
  if (!WORKER_SECRET) return next(); // dev mode — no secret configured
  if (req.headers.authorization !== `Bearer ${WORKER_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }
  return next();
});

// Health / root
app.get('/', (_req, res) => res.send('Server is alive'));

app.get('/api/health', (_req, res) => res.type('text/plain').send('OK'));
app.get('/health', (_req, res) => res.json({
  status: 'ok',
  active: activeJobs,
  queued: queue.length,
  workers: WORKERS,
  proxies: PROXIES.length,
}));

// CORS test endpoint
app.get('/api/test-cors', (req, res) => {
  try {
    return res.json({
      success: true,
      message: 'CORS is working ✅',
      origin: req.headers.origin || 'no origin',
      timestamp: new Date().toISOString(),
      serverFile: __filename,
      ytDlpReady: !!ytDlp,
    });
  } catch (error) {
    console.error('[TEST-CORS] Route error:', error);
    return res.status(500).json({ error: 'Test route failed', message: error.message });
  }
});

app.post('/api/video-info', async (req, res) => {
  console.log('[VIDEO-INFO] Request received:', { url: req.body?.url });

  const { url } = req.body || {};
  if (!url || !isYouTubeUrl(url)) {
    console.log('[VIDEO-INFO] Invalid URL:', url);
    return res.status(400).json({ error: 'Invalid or missing YouTube URL.', code: 'INVALID_URL' });
  }

  try {
    console.log('[VIDEO-INFO] Getting video info for:', url);
    const info = await getVideoInfo(url);
    console.log('[VIDEO-INFO] Success - returning info');
    return res.json(info);
  } catch (error) {
    console.log('[VIDEO-INFO] Error:', error.message);
    const status = error.statusCode || 500;
    return res.status(status).json({ error: parseYtDlpError(error), code: 'VIDEO_INFO_FAILED' });
  }
});

app.post('/api/download', (req, res) => {
  const ip = getClientIp(req);
  const withinSoftLimit = checkRateLimit(ip);

  const { url, quality = 'best' } = req.body || {};
  if (!url || !isYouTubeUrl(url)) {
    return res.status(400).json({ error: 'Invalid or missing YouTube URL.', code: 'INVALID_URL' });
  }

  const job = createJob({ url, quality, ip });
  if (!withinSoftLimit) {
    job.message = QUEUE_WAIT_DETAIL;
  }
  scheduleJob(job);
  res.status(202).json({
    jobId: job.jobId,
    status: job.status,
    position: job.queuePosition,
    estimatedWait: job.estimatedWait,
    message: job.status === 'queued' ? QUEUE_WAIT_DETAIL : USER_WAIT_MESSAGE,
    progressUrl: `/api/progress/${job.jobId}`,
    downloadUrl: `/api/download/${job.jobId}/file`,
  });
});

app.get('/api/progress/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found or expired.', code: 'JOB_NOT_FOUND' });

  return res.json({
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    percent: job.progress,
    position: job.queuePosition,
    estimatedWait: job.estimatedWait,
    speed: job.speed,
    eta: job.eta,
    worker: job.worker,
    proxy: job.proxy,
    formatUsed: job.formatUsed,
    error: job.error,
    message: job.message,
    downloadUrl: job.status === 'ready' ? `/api/download/${job.jobId}/file` : null,
  });
});

app.get('/api/download/:id/file', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found or expired.', code: 'JOB_NOT_FOUND' });
  if (job.status === 'error') return res.status(500).json({ error: job.error || 'Download failed.', code: 'DOWNLOAD_FAILED' });
  if (job.status !== 'ready') return res.status(202).json({ error: 'File is not ready yet.', status: job.status });
  if (!fs.existsSync(job.filePath)) return res.status(410).json({ error: 'File expired.', code: 'FILE_EXPIRED' });

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`);
  res.setHeader('Content-Length', job.fileSize);

  const stream = fs.createReadStream(job.filePath);
  stream.pipe(res);
  stream.on('close', () => {
    safeDelete(job.filePath);
    jobs.delete(job.jobId);
  });
  stream.on('error', () => safeDelete(job.filePath));
});

app.delete('/api/download/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.', code: 'JOB_NOT_FOUND' });
  job.status = 'cancelled';
  safeDelete(job.filePath);
  jobs.delete(job.jobId);
  return res.json({ ok: true });
});

// Compatibility aliases for the existing Cloudflare proxy during rollout.
app.post('/info', async (req, res) => {
  req.url = '/api/video-info';
  app.handle(req, res);
});

app.post('/download', (req, res) => {
  req.url = '/api/download';
  app.handle(req, res);
});

app.get('/progress/:id', (req, res) => {
  req.url = `/api/progress/${req.params.id}`;
  app.handle(req, res);
});

app.get('/file/:id', (req, res) => {
  req.url = `/api/download/${req.params.id}/file`;
  app.handle(req, res);
});

app.delete('/job/:id', (req, res) => {
  req.url = `/api/download/${req.params.id}`;
  app.handle(req, res);
});

setInterval(() => {
  const now = Date.now();
  for (const [jobId, job] of jobs.entries()) {
    if (now - job.createdAt > JOB_TTL) {
      safeDelete(job.filePath);
      jobs.delete(jobId);
    }
  }
  updateQueuedJobMetadata();
}, Math.min(TEMP_TTL, JOB_TTL)).unref();

app.use((error, _req, res, _next) => {
  console.error('[ERROR HANDLER]', {
    message: error.message,
    stack: error.stack,
    code: error.code,
  });
  log('error', 'request failed', { error: error.message, code: error.code });
  res.status(500).json({ 
    error: 'Internal server error.', 
    code: 'INTERNAL_ERROR',
    message: error.message,
  });
});

const server = app.listen(PORT, () => {
  log('info', 'youtube downloader backend started', {
    port: PORT,
    maxConcurrent: MAX_CONCURRENT,
    workers: WORKERS.length,
    proxies: PROXIES.length,
    queueEnabled: true,
    ytDlpReady: !!ytDlp,
  });
  console.log('[STARTUP] Server listening on port', PORT);
  console.log('[STARTUP] yt-dlp status:', ytDlp ? 'READY' : 'FAILED (server degraded)');
  console.log('[STARTUP] Test route: GET /api/test-cors');
});

server.on('error', (error) => {
  console.error('[SERVER ERROR]', error);
  log('error', 'server error', { error: error.message });
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT EXCEPTION]', error);
  log('error', 'uncaught exception', { error: error.message });
  process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
  log('error', 'unhandled rejection', { reason: String(reason) });
});

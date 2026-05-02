import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { execSync } from 'node:child_process';
import cors from 'cors';
import express from 'express';
import ffmpegPath from 'ffmpeg-static';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import pkg from 'yt-dlp-wrap';
const { default: YTDlpWrap } = pkg;

const PORT = process.env.PORT || 8080;
const TMP_DIR = process.env.TMP_DIR || os.tmpdir();
const WORKER_SECRET = process.env.WORKER_SECRET || '';
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
const JWT_SECRET = process.env.JWT_SECRET || '';
const AUTH_STORE_DIR = process.env.AUTH_STORE_DIR || path.join(process.cwd(), '.data');
const AUTH_STORE_PATH = process.env.AUTH_STORE_PATH || path.join(AUTH_STORE_DIR, 'auth-store.json');
const WORKERS = (process.env.WORKERS || DEFAULT_WORKERS.join(','))
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const PROXIES = (process.env.PROXY_LIST || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map((url) => ({ url, failures: 0, disabledUntil: 0 }));

function log(level, message, meta = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, message, ...meta }));
}

function ensureAuthStore() {
  if (!fs.existsSync(AUTH_STORE_DIR)) {
    fs.mkdirSync(AUTH_STORE_DIR, { recursive: true });
  }
  if (!fs.existsSync(AUTH_STORE_PATH)) {
    fs.writeFileSync(AUTH_STORE_PATH, JSON.stringify({ users: [], passwordResets: [] }, null, 2));
  }
}

function readAuthStore() {
  ensureAuthStore();
  try {
    const raw = fs.readFileSync(AUTH_STORE_PATH, 'utf8');
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      passwordResets: Array.isArray(parsed.passwordResets) ? parsed.passwordResets : [],
    };
  } catch (error) {
    log('error', 'failed to read auth store', { error: error.message });
    return { users: [], passwordResets: [] };
  }
}

function writeAuthStore(store) {
  ensureAuthStore();
  fs.writeFileSync(AUTH_STORE_PATH, JSON.stringify(store, null, 2));
}

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name || user.email.split('@')[0],
  };
}

function createUserToken(user) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return jwt.sign(
    { id: user.id, email: user.email, name: user.name || '' },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return '';
  return authHeader.slice(7).trim();
}

function requireUserAuth(req, res, next) {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!JWT_SECRET) {
    return res.status(500).json({ error: 'JWT_SECRET is not configured.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const store = readAuthStore();
    const user = store.users.find((entry) => entry.id === payload.id);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.user = sanitizeUser(user);
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

function createPasswordResetToken(store, userId) {
  const token = uuidv4().replace(/-/g, '');
  const expiresAt = Date.now() + (15 * 60 * 1000);

  store.passwordResets = store.passwordResets.filter((entry) => entry.userId !== userId && !entry.used);
  store.passwordResets.push({
    token,
    userId,
    expiresAt,
    used: false,
    createdAt: Date.now(),
  });

  return token;
}

function consumePasswordReset(store, token) {
  const reset = store.passwordResets.find((entry) => entry.token === token && !entry.used);
  if (!reset) return null;
  if (reset.expiresAt <= Date.now()) return null;
  reset.used = true;
  reset.usedAt = Date.now();
  return reset;
}

function resolveYtDlpBinary() {
  if (process.env.YTDLP_PATH) return process.env.YTDLP_PATH;
  try {
    const cmd = process.platform === 'win32' ? 'where yt-dlp' : 'which yt-dlp';
    return execSync(cmd, { encoding: 'utf8' }).trim().split('\n')[0].trim();
  } catch {
    return 'yt-dlp';
  }
}

const ytDlp = new (YTDlpWrap.default || YTDlpWrap)(resolveYtDlpBinary());

try {
  execSync('yt-dlp --update-to stable', { stdio: 'ignore', timeout: 30000 });
  log('info', 'yt-dlp verified');
} catch {
  log('warn', 'yt-dlp update skipped');
}

let proxyIndex = 0;
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

function authMiddleware(req, res, next) {
  if (req.path === '/api/health' || req.path === '/health') return next();
  if (req.path === '/api/test-cors') return next();
  if (req.path.startsWith('/api/auth')) return next();
  if (!WORKER_SECRET) return next();

  if (req.headers.authorization === `Bearer ${WORKER_SECRET}`) return next();
  return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
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

function getNextProxy() {
  if (!PROXIES.length) return null;
  const now = Date.now();
  for (let index = 0; index < PROXIES.length; index += 1) {
    const proxy = PROXIES[proxyIndex % PROXIES.length];
    proxyIndex += 1;
    if (now >= proxy.disabledUntil) return proxy;
  }

  const soonest = PROXIES.reduce((best, proxy) => (proxy.disabledUntil < best.disabledUntil ? proxy : best));
  soonest.failures = 0;
  soonest.disabledUntil = 0;
  return soonest;
}

function markProxySuccess(proxy) {
  if (!proxy) return;
  proxy.failures = 0;
  proxy.disabledUntil = 0;
}

function markProxyFailure(proxy) {
  if (!proxy) return;
  proxy.failures += 1;
  if (proxy.failures >= 3) {
    proxy.disabledUntil = Date.now() + PROXY_DISABLE_MS;
    log('warn', 'proxy disabled temporarily', { proxy: redactProxy(proxy.url), failures: proxy.failures });
  }
}

function redactProxy(url) {
  return url.replace(/\/\/([^:@]+):([^@]+)@/, '//***:***@');
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
  if (proxy) args.push('--proxy', proxy.url);
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
    const proxy = getNextProxy();
    safeDelete(job.filePath);
    job.retryCount = retryIndex;
    job.status = retryIndex === 0 ? 'downloading' : 'retrying';
    job.worker = worker;
    job.proxy = proxy ? redactProxy(proxy.url) : 'direct';
    job.formatUsed = quality;
    job.message = retryIndex === 0 ? USER_WAIT_MESSAGE : RETRYING_MESSAGE;
    job.attemptHistory.push({
      retry: retryIndex + 1,
      worker,
      quality,
      proxy: proxy ? redactProxy(proxy.url) : 'direct',
      startedAt: Date.now(),
    });
    log('info', 'download attempt', {
      jobId: job.jobId,
      retry: retryIndex + 1,
      worker,
      quality,
      proxy: proxy ? redactProxy(proxy.url) : 'direct',
    });

    try {
      await runYtDlp(job, quality, proxy, worker);
      markProxySuccess(proxy);
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
      markProxyFailure(proxy);
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
  const attempts = PROXIES.length ? Math.max(2, Math.min(PROXIES.length, 3)) : 1;
  let lastError;

  for (let index = 0; index < attempts; index += 1) {
    const proxy = getNextProxy();
    try {
      const raw = await ytDlp.getVideoInfo(url, baseArgs(proxy));
      markProxySuccess(proxy);
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
      markProxyFailure(proxy);
      lastError = error;
    }
  }

  throw lastError || new Error('Unable to fetch video info.');
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

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors({
  origin: [
    'https://www.multitoolhub.space',
    'http://localhost:5173',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());

// Health check route
app.get('/', (req, res) => {
  res.send('Server is alive');
});

// Debug logger middleware
app.use((req, res, next) => {
  console.log('[REQUEST]', req.method, req.path, { origin: req.headers.origin || 'no-origin', ts: new Date().toISOString() });
  next();
});

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
  res.json({
    success: true,
    message: 'CORS is working ✅',
    origin: req.headers.origin || 'no origin',
    timestamp: new Date().toISOString(),
    serverFile: __filename,
  });
});

app.post('/api/auth/register', (req, res) => {
  const { email: rawEmail, password, name: rawName } = req.body || {};
  const email = normalizeEmail(rawEmail);

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const store = readAuthStore();
  const existing = store.users.find((entry) => entry.email === email);
  if (existing) {
    return res.status(400).json({ error: 'Email already exists' });
  }

  const user = {
    id: uuidv4(),
    email,
    name: String(rawName || email.split('@')[0]).trim() || email.split('@')[0],
    passwordHash: bcrypt.hashSync(String(password), 10),
    createdAt: Date.now(),
  };

  store.users.push(user);
  writeAuthStore(store);

  return res.json({
    data: {
      user: sanitizeUser(user),
      token: createUserToken(user),
    },
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email: rawEmail, password } = req.body || {};
  const email = normalizeEmail(rawEmail);

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const store = readAuthStore();
  const user = store.users.find((entry) => entry.email === email);

  if (!user || !bcrypt.compareSync(String(password), user.passwordHash || '')) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  return res.json({
    data: {
      user: sanitizeUser(user),
      token: createUserToken(user),
    },
  });
});

app.post('/api/auth/google', async (req, res) => {
  const { token } = req.body || {};

  if (!token) {
    return res.status(400).json({ error: 'Token missing' });
  }

  try {
    const googleResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    const googleData = await googleResponse.json();

    if (!googleResponse.ok || googleData.error || !googleData.email) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    const email = normalizeEmail(googleData.email);
    const name = String(googleData.name || googleData.given_name || email.split('@')[0]).trim();
    const store = readAuthStore();
    let user = store.users.find((entry) => entry.email === email);

    if (!user) {
      user = {
        id: uuidv4(),
        email,
        name,
        passwordHash: bcrypt.hashSync(uuidv4(), 10),
        createdAt: Date.now(),
      };
      store.users.push(user);
      writeAuthStore(store);
    }

    return res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
        token: createUserToken(user),
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Server error', message: error.message });
  }
});

app.get('/api/auth/me', requireUserAuth, (req, res) => {
  return res.json({ data: { user: req.user } });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const { email: rawEmail } = req.body || {};
  const email = normalizeEmail(rawEmail);

  if (!email) {
    return res.json({ message: 'If that email exists a reset link has been sent' });
  }

  const store = readAuthStore();
  const user = store.users.find((entry) => entry.email === email);

  if (user) {
    const token = createPasswordResetToken(store, user.id);
    writeAuthStore(store);
    log('info', 'password reset requested', {
      email,
      resetLink: `${process.env.FRONTEND_URL || 'https://www.multitoolhub.space'}/reset-password?token=${token}`,
    });
  }

  return res.json({ message: 'If that email exists a reset link has been sent' });
});

app.get('/api/auth/verify-reset-token/:token', (req, res) => {
  const store = readAuthStore();
  const reset = store.passwordResets.find((entry) => entry.token === req.params.token && !entry.used);

  if (!reset || reset.expiresAt <= Date.now()) {
    return res.json({ valid: false, error: 'Token expired or invalid' });
  }

  return res.json({ valid: true });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  const store = readAuthStore();
  const reset = consumePasswordReset(store, token);
  if (!reset) {
    return res.status(400).json({ error: 'Token expired or invalid' });
  }

  const user = store.users.find((entry) => entry.id === reset.userId);
  if (!user) {
    return res.status(400).json({ error: 'Token expired or invalid' });
  }

  user.passwordHash = bcrypt.hashSync(String(newPassword), 10);
  user.updatedAt = Date.now();
  writeAuthStore(store);

  return res.json({ message: 'Password reset successfully' });
});

app.use(authMiddleware);

app.post('/api/video-info', async (req, res) => {
  const { url } = req.body || {};
  if (!url || !isYouTubeUrl(url)) {
    return res.status(400).json({ error: 'Invalid or missing YouTube URL.', code: 'INVALID_URL' });
  }

  try {
    const info = await getVideoInfo(url);
    return res.json(info);
  } catch (error) {
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
  const store = readAuthStore();
  const nextPasswordResets = store.passwordResets.filter((entry) => !entry.used && entry.expiresAt > now);
  if (nextPasswordResets.length !== store.passwordResets.length) {
    store.passwordResets = nextPasswordResets;
    writeAuthStore(store);
  }
  updateQueuedJobMetadata();
}, Math.min(TEMP_TTL, JOB_TTL)).unref();

app.use((error, _req, res, _next) => {
  log('error', 'request failed', { error: error.message });
  res.status(500).json({ error: 'Internal server error.', code: 'INTERNAL_ERROR' });
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
});

server.on('error', (error) => {
  log('error', 'server error', { error: error.message });
  process.exit(1);
});

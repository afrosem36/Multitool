import 'dotenv/config';
import crypto from "crypto";
import { execSync } from 'node:child_process';
import cors from 'cors';
import express from 'express';
import ffmpegPath from 'ffmpeg-static';
import fs from 'node:fs';
import os from 'node:os';
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import YTDlpWrapPackage from 'yt-dlp-wrap';
import { S3Client, HeadObjectCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
const YTDlpWrap = YTDlpWrapPackage.default || YTDlpWrapPackage;

// ESM compatibility for __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cloudflare R2 CDN client
let r2Client = null;
const R2_BUCKET = process.env.R2_BUCKET || 'videos';
const R2_CDN_URL = process.env.R2_CDN_URL || '';
const R2_ENDPOINT = process.env.R2_ENDPOINT || '';
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY || '';
const R2_SECRET_KEY = process.env.R2_SECRET_KEY || '';

function initR2() {
  if (!R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
    console.log('[R2] Skipped - missing credentials');
    return;
  }
  try {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET_KEY,
      },
    });
    console.log('[R2] CDN initialized');
  } catch (err) {
    console.error('[R2] Init failed:', err.message);
  }
}

const PORT = process.env.PORT || 8080;
const TMP_DIR = process.env.TMP_DIR || os.tmpdir();
const MAX_CONCURRENT = Number.parseInt(process.env.MAX_CONCURRENT || '3', 10);
const MAX_CONCURRENT_PREMIUM = Number.parseInt(process.env.MAX_CONCURRENT_PREMIUM || '6', 10);
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
const QUEUE_SECONDS_PER_JOB = Number.parseInt(process.env.QUEUE_SECONDS_PER_JOB || '5', 10);
const JOB_TIMEOUT_MS = Number.parseInt(process.env.JOB_TIMEOUT_MS || '1800000', 10);
const MAX_JOB_RETRIES = Number.parseInt(process.env.MAX_JOB_RETRIES || '5', 10);
const WORKERS = (process.env.WORKERS || DEFAULT_WORKERS.join(','))
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://www.multitoolhub.space,https://multitoolhub.space,http://localhost:5173')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const PROXIES = (process.env.PROXY_LIST || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const failedProxies = new Map();

function redactProxy(proxy) {
  if (!proxy) return '';
  try {
    const parsed = new URL(proxy);
    if (parsed.username || parsed.password) {
      parsed.username = parsed.username ? '***' : '';
      parsed.password = parsed.password ? '***' : '';
    }
    return parsed.toString();
  } catch {
    return String(proxy).replace(/\/\/([^:@/]+):([^@/]+)@/, '//***:***@');
  }
}

function pruneFailedProxies() {
  const now = Date.now();
  for (const [proxy, failedAt] of failedProxies.entries()) {
    if (now - failedAt > PROXY_DISABLE_MS) failedProxies.delete(proxy);
  }
}

function getWorkingProxy() {
  pruneFailedProxies();
  const available = PROXIES.filter((proxy) => !failedProxies.has(proxy));
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function markProxyFailed(proxy) {
  if (!proxy) return;
  failedProxies.set(proxy, Date.now());
}

function log(level, message, meta = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, message, ...meta }));
}

function shellQuote(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

// R2 CDN cache helpers
function getCacheKey(url, quality) {
  const hash = crypto
    .createHash("sha256")
    .update(`${url}:${quality}`)
    .digest("hex")
    .slice(0, 16);

  return `yt-${hash}-${quality}.mp4`;
}

async function checkCacheExists(key) {
  if (!r2Client || !R2_CDN_URL) return false;
  try {
    await r2Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    console.log('⚡ CDN HIT — skipping download');
    return true;
  } catch {
    return false;
  }
}

async function uploadToR2(filePath, key) {
  if (!r2Client || !R2_CDN_URL || !fs.existsSync(filePath)) return null;
  try {
    const fileSize = fs.statSync(filePath).size;
    const fileStream = fs.createReadStream(filePath);
    await r2Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: fileStream,
      ContentType: 'video/mp4',
    }));
    const cdnUrl = R2_CDN_URL ? `${R2_CDN_URL}/${key}` : `https://cdn.example.com/${key}`;
    log('info', 'uploaded to r2', { key, size: fileSize, cdnUrl });
    return cdnUrl;
  } catch (err) {
    log('warn', 'r2 upload failed', { key, error: err.message });
    return null;
  }
}

function deleteFromR2(key) {
  if (!r2Client) return;
  setTimeout(async () => {
    try {
      await r2Client.send(new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      }));
      log('info', 'deleted from r2', { key });
    } catch (err) {
      log('warn', 'r2 delete failed', { key, error: err.message });
    }
  }, 10 * 60 * 1000);
}

async function getCDNUrl(key) {
  if (!r2Client) return null;
  try {
    await r2Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return R2_CDN_URL ? `${R2_CDN_URL}/${key}` : null;
  } catch {
    return null;
  }
}

console.log('[STARTUP] Server initialization starting...');
initR2();

let ytDlp = null;
try {
  console.log('[STARTUP] Initializing yt-dlp...');
  const ytDlpBinary = process.env.YTDLP_PATH || 'yt-dlp';
  console.log('[STARTUP] yt-dlp binary path:', ytDlpBinary);
  if (/secret|token/i.test(ytDlpBinary)) {
    throw new Error('CRITICAL: yt-dlp binary path contains a secret! This must NEVER happen.');
  }
  ytDlp = new YTDlpWrap(ytDlpBinary);
  console.log('[STARTUP] yt-dlp instance created successfully');

  try {
    execSync(`${shellQuote(ytDlpBinary)} --version`, { stdio: 'pipe' });
    console.log('[YTDLP] Binary verified');
    log('info', 'yt-dlp binary verified');
  } catch (verifyError) {
    console.error('[YTDLP] NOT FOUND:', verifyError.message);
    throw verifyError;
  }
} catch (initError) {
  log('error', 'yt-dlp initialization failed', { error: initError.message });
  console.error('[STARTUP] CRITICAL: yt-dlp initialization failed:', initError.message);
  console.error('[STARTUP] Downloads will fail, but server will continue running');
  ytDlp = null;
}

let workerIndex = 0;
let activeJobs = 0;
let activePremiumJobs = 0;
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

function isPremium(user) {
  if (!user) return false;
  const plan = String(user.plan || user.tier || user.subscription || '').toLowerCase();
  return plan === 'premium' || plan === 'pro' || user.isPremium === true;
}

function getRequestUser(req) {
  const headerPlan = req.headers['x-user-plan'] || req.headers['x-plan'];
  return {
    plan: req.body?.user?.plan || req.body?.plan || headerPlan || 'free',
    isPremium: req.body?.user?.isPremium || req.body?.isPremium,
  };
}

function estimateWaitSeconds(position) {
  return Math.max(0, Number(position || 0) * QUEUE_SECONDS_PER_JOB);
}

function formatWaitSeconds(seconds) {
  return `${Math.max(0, Number(seconds || 0))} seconds`;
}

function estimateWaitRange(position) {
  const minSeconds = Math.max(10, position * AVERAGE_JOB_SECONDS_MIN);
  const maxSeconds = Math.max(minSeconds, position * AVERAGE_JOB_SECONDS_MAX);
  return `${minSeconds}-${maxSeconds} seconds`;
}

function updateQueuedJobMetadata() {
  queue.forEach((job, index) => {
    job.queuePosition = index + 1;
    job.estimatedWaitSeconds = estimateWaitSeconds(job.queuePosition);
    job.estimatedWait = formatWaitSeconds(job.estimatedWaitSeconds);
    job.message = QUEUE_WAIT_DETAIL;
  });
}

function getNextRunnableQueueIndex() {
  const hasPremiumCapacity = activeJobs < MAX_CONCURRENT_PREMIUM;
  const hasStandardCapacity = activeJobs < MAX_CONCURRENT;
  if (!hasPremiumCapacity) return -1;
  if (hasStandardCapacity) return 0;
  return queue.findIndex((job) => job.premium);
}

function startQueuedJobs() {
  while (queue.length > 0) {
    const nextIndex = getNextRunnableQueueIndex();
    if (nextIndex < 0) break;
    const [nextJob] = queue.splice(nextIndex, 1);
    activeJobs += 1;
    if (nextJob.premium) activePremiumJobs += 1;
    nextJob.status = 'starting';
    nextJob.queuePosition = 0;
    nextJob.estimatedWaitSeconds = 0;
    nextJob.estimatedWait = '0 seconds';
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
        if (nextJob.premium) activePremiumJobs = Math.max(0, activePremiumJobs - 1);
        startQueuedJobs();
      });
  }
  updateQueuedJobMetadata();
}

function scheduleJob(job) {
  if (job.premium) queue.unshift(job);
  else queue.push(job);
  job.status = 'queued';
  updateQueuedJobMetadata();
  startQueuedJobs();
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
    '--quiet',
    '--progress',
    '--no-warnings',
    '--newline',
    '--force-overwrites',
    // android client avoids YouTube download throttling — do NOT use web here
    '--extractor-args',
    'youtube:player_client=android',
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanupJob(jobId, delay = JOB_TTL) {
  setTimeout(() => {
    const job = jobs.get(jobId);
    if (!job) return;
    safeDelete(job.filePath);
    jobs.delete(jobId);
  }, delay);
}

function createJob({ url, quality, ip, user, title = '', duration = 0, formats = [] }) {
  const jobId = uuidv4();
  const normalizedQuality = normalizeQuality(quality);
  const cacheKey = getCacheKey(url, normalizedQuality);
  const filePath = path.join(TMP_DIR, `youtube_${jobId}.mp4`);
  const premium = isPremium(user);
  const job = {
    jobId,
    url,
    quality: normalizedQuality,
    premium,
    cacheKey,
    cached: false,
    cachedUrl: null,
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
    title,
    duration,
    formats,
    downloadUrl: `/api/download/${jobId}/file`,
    error: null,
    message: USER_WAIT_MESSAGE,
    retryCount: 0,
    maxRetries: MAX_JOB_RETRIES,
    attemptHistory: [],
    activeProcess: null,
    queuePosition: 0,
    estimatedWaitSeconds: 0,
    estimatedWait: '0 seconds',
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
    job.proxy = proxy ? redactProxy(proxy) : 'direct';
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
  // Check cache first for instant delivery
  if (await checkCacheExists(job.cacheKey)) {
    job.status = 'ready';
    job.progress = 100;
    job.percent = 100;
    job.cached = true;
    job.cachedUrl = await getCDNUrl(job.cacheKey);
    job.message = 'Video ready (cached)';
    job.completedAt = Date.now();
    log('info', 'cache hit', { jobId: job.jobId, key: job.cacheKey });
    return;
  }

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
    const proxy = getWorkingProxy();
    safeDelete(job.filePath);
    job.retryCount = retryIndex;
    job.status = retryIndex === 0 ? 'downloading' : 'retrying';
    job.worker = worker;
    job.proxy = proxy ? redactProxy(proxy) : 'direct';
    job.formatUsed = quality;
    job.message = retryIndex === 0 ? USER_WAIT_MESSAGE : RETRYING_MESSAGE;
    job.attemptHistory.push({
      retry: retryIndex + 1,
      worker,
      quality,
      proxy: proxy ? redactProxy(proxy) : 'direct',
      startedAt: Date.now(),
    });
    log('info', 'download attempt', {
      jobId: job.jobId,
      retry: retryIndex + 1,
      worker,
      quality,
      proxy: proxy ? redactProxy(proxy) : 'direct',
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

      // Upload to R2 CDN for caching
      if (r2Client) {
        job.message = 'Uploading to CDN...';
        const cdnUrl = await uploadToR2(job.filePath, job.cacheKey);
        if (cdnUrl) {
          job.cached = true;
          job.cachedUrl = cdnUrl;
          job.message = 'Video ready (cached)';
          deleteFromR2(job.cacheKey);
        }
      }
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
      markProxyFailed(proxy);
      if (retryIndex < Math.min(MAX_JOB_RETRIES, attemptPlan.length) - 1) {
        await delay(800);
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
  for (let attempt = 0; attempt < MAX_JOB_RETRIES; attempt += 1) {
    const proxy = getWorkingProxy();
    try {
      if (proxy) log('info', 'video info using proxy', { attempt: attempt + 1, proxy: redactProxy(proxy) });

      const args = [
        url,
        '-J',
        '--no-playlist',
        '--quiet',
        '--extractor-args',
        'youtube:player_client=web,android',
      ];
      if (proxy) args.push('--proxy', proxy);

      const stdout = await ytDlp.execPromise(args);
      const raw = typeof stdout === 'string' ? JSON.parse(stdout) : stdout;

      if (raw.is_live) {
        const error = new Error('Live streams are not supported.');
        error.statusCode = 422;
        throw error;
      }

      // Detect actual available resolutions from the format list
      const availableHeights = new Set();
      for (const fmt of (raw.formats || [])) {
        if (fmt.height && fmt.height > 0 && fmt.vcodec && fmt.vcodec !== 'none') {
          availableHeights.add(fmt.height);
        }
      }
      const maxHeight = availableHeights.size > 0 ? Math.max(...availableHeights) : 0;
      const qualityOptions = [];
      if (maxHeight >= 4320) qualityOptions.push('8k');
      if (maxHeight >= 2160) qualityOptions.push('4k');
      if (maxHeight >= 1080) qualityOptions.push('1080');
      if (maxHeight >= 720) qualityOptions.push('720');
      qualityOptions.push('best');

      return {
        title: raw.title || 'Unknown title',
        thumbnail: raw.thumbnail || null,
        duration: raw.duration || 0,
        channel: raw.uploader || raw.channel || '',
        formats: qualityOptions,
        maxHeight,
      };
    } catch (error) {
      log('warn', 'video info attempt failed', { attempt: attempt + 1, error: error.message, proxy: proxy ? redactProxy(proxy) : 'direct' });
      markProxyFailed(proxy);
      lastError = error;
      if (attempt < MAX_JOB_RETRIES - 1) await delay(800);
    }
  }

  throw lastError || new Error(`Unable to fetch video info after ${MAX_JOB_RETRIES} attempts.`);
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
  origin: ALLOWED_ORIGINS,
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
  activePremium: activePremiumJobs,
  queued: queue.length,
  workers: WORKERS,
  proxies: PROXIES.length,
  failedProxies: failedProxies.size,
  maxConcurrent: MAX_CONCURRENT,
  maxConcurrentPremium: MAX_CONCURRENT_PREMIUM,
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
    return res.json({
      success: true,
      ...info,
      downloadUrl: null,
    });
  } catch (error) {
    console.log('[VIDEO-INFO] Error:', error.message);
    const status = error.statusCode || 500;
    return res.status(status).json({ error: parseYtDlpError(error), code: 'VIDEO_INFO_FAILED' });
  }
});

app.post('/api/download', async (req, res) => {
  const ip = getClientIp(req);
  const withinSoftLimit = checkRateLimit(ip);

  const { url, quality = 'best', title = '', duration = 0, formats = [] } = req.body || {};
  if (!url || !isYouTubeUrl(url)) {
    return res.status(400).json({ error: 'Invalid or missing YouTube URL.', code: 'INVALID_URL' });
  }

  // Check cache before creating a job
  const normalizedQuality = normalizeQuality(quality);
  const cacheKey = getCacheKey(url, normalizedQuality);

  if (await checkCacheExists(cacheKey)) {
    console.log('⚡ CDN HIT — skipping download');
    const cdnUrl = R2_CDN_URL ? `${R2_CDN_URL}/${cacheKey}` : null;
    return res.json({
      success: true,
      cached: true,
      url: cdnUrl,
      message: 'Video ready (cached)',
    });
  }

  const user = getRequestUser(req);
  const job = createJob({ url, quality, ip, user, title, duration, formats });
  if (!withinSoftLimit) {
    job.message = QUEUE_WAIT_DETAIL;
  }
  scheduleJob(job);
  res.status(202).json({
    success: true,
    jobId: job.jobId,
    status: job.status,
    position: job.queuePosition,
    estimatedWaitSeconds: job.estimatedWaitSeconds,
    estimatedWait: job.estimatedWait,
    premium: job.premium,
    title: job.title,
    duration: job.duration,
    formats: job.formats,
    message: job.status === 'queued' ? QUEUE_WAIT_DETAIL : USER_WAIT_MESSAGE,
    progressUrl: `/api/progress/${job.jobId}`,
    downloadUrl: job.downloadUrl,
  });
});

app.get('/api/progress/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found or expired.', code: 'JOB_NOT_FOUND' });

  return res.json({
    success: job.status === 'ready',
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    percent: job.progress,
    position: job.queuePosition,
    estimatedWaitSeconds: job.estimatedWaitSeconds,
    estimatedWait: job.estimatedWait,
    speed: job.speed,
    eta: job.eta,
    worker: job.worker,
    proxy: job.proxy,
    formatUsed: job.formatUsed,
    premium: job.premium,
    title: job.title,
    duration: job.duration,
    formats: job.formats,
    error: job.error,
    message: job.message,
    downloadUrl: job.status === 'ready' ? job.downloadUrl : null,
  });
});

app.get('/api/download/:id/file', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found or expired.', code: 'JOB_NOT_FOUND' });
  if (job.status === 'error') return res.status(500).json({ error: job.error || 'Download failed.', code: 'DOWNLOAD_FAILED' });
  if (job.status !== 'ready') return res.status(202).json({ error: 'File is not ready yet.', status: job.status });

  // If cached in CDN → redirect instantly
  if (job.cached && job.cachedUrl) {
    console.log('⚡ Redirecting to CDN:', job.cachedUrl);
    return res.redirect(job.cachedUrl);
  }

  // Fallback to local file (first request)
  if (!fs.existsSync(job.filePath)) {
    return res.status(410).json({ error: 'File expired.', code: 'FILE_EXPIRED' });
  }

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`);
  res.setHeader('Content-Length', job.fileSize);
  res.setHeader('X-Format-Used', job.formatUsed);

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
  if (job.activeProcess) {
    try {
      job.activeProcess.kill('SIGKILL');
    } catch {
      // Ignore cleanup errors.
    }
  }
  const queuedIndex = queue.findIndex((queuedJob) => queuedJob.jobId === job.jobId);
  if (queuedIndex >= 0) queue.splice(queuedIndex, 1);
  safeDelete(job.filePath);
  jobs.delete(job.jobId);
  updateQueuedJobMetadata();
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

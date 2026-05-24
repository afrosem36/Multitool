import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import * as cheerio from 'cheerio';

const app = new Hono();

const ALLOWED_ORIGINS = [
  "https://www.multitoolhub.space",
  "https://multitoolhub.space",
];

function getCorsHeaders(origin) {
  const isLocalhost = origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (!origin || isLocalhost || ALLOWED_ORIGINS.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    };
  }
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function getPublicOrigin(c) {
  if (c.env.SHORT_DOMAIN && !c.env.SHORT_DOMAIN.includes('localhost')) {
    return c.env.SHORT_DOMAIN;
  }
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}

function getFrontendOrigin(c) {
  return c.env.FRONTEND_URL || 'http://localhost:5173';
}

function getDb(env) {
  return env.multitool_db || env.DB;
}

function getTodayUtcDate() {
  return new Date().toISOString().split('T')[0];
}

async function checkUserQuota(db, userId, toolId) {
  if (!userId) return 0;
  try {
    const today = getTodayUtcDate();
    const quota = await db.prepare(
      'SELECT count FROM tool_quotas WHERE user_id = ? AND tool_id = ? AND date = ?'
    ).bind(userId, toolId, today).first();
    return quota?.count || 0;
  } catch (err) {
    console.warn(`Failed to check quota for user ${userId}: ${err.message}`);
    return 0; // Assume no quota if check fails
  }
}

async function userExists(db, userId) {
  if (!userId) return false;
  try {
    const result = await db.prepare('SELECT 1 FROM users WHERE id = ? LIMIT 1').bind(userId).first();
    return !!result;
  } catch {
    return false;
  }
}

async function incrementUserQuota(db, userId, toolId) {
  const today = getTodayUtcDate();
  try {
    await db.prepare(`
      INSERT INTO tool_quotas (user_id, tool_id, date, count)
      VALUES (?, ?, ?, 1)
      ON CONFLICT (user_id, tool_id, date)
      DO UPDATE SET count = count + 1
    `).bind(userId, toolId, today).run();
  } catch (err) {
    console.warn(`Failed to increment quota for user ${userId}: ${err.message}`);
  }
}

// Accounts with unlimited access — exempt from all daily quotas
const UNLIMITED_EMAILS = new Set(['afrosem36@gmail.com']);

function hasUnlimitedCredits(user, toolId) {
  const email = (user?.email ?? '').toLowerCase().trim();
  if (UNLIMITED_EMAILS.has(email)) return true;
  return false;
}

function getRequiredEnvValue(env, key) {
  const value = env[key];
  if (typeof value !== 'string') return '';
  return value.trim();
}

function containsDevanagari(text = '') {
  return /[\u0900-\u097F]/.test(text);
}

function sanitizeFileName(name = 'file') {
  const parts = name.split('.');
  const extension = parts.length > 1 ? `.${parts.pop()}` : '';
  const baseName = parts.join('.')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '');
  return `${baseName || 'file'}${extension}`;
}

function sanitizeSlug(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

async function slugExists(db, slug) {
  const result = await db.prepare('SELECT 1 FROM links WHERE slug = ? LIMIT 1').bind(slug).first();
  return !!result;
}

async function generateUniqueSlug(db, base) {
  let slug = sanitizeSlug(base || nanoid(8));
  if (!slug) slug = nanoid(8).toLowerCase();
  let candidate = slug;
  let attempts = 0;

  while (attempts < 6) {
    if (!(await slugExists(db, candidate))) return candidate;
    candidate = `${slug}-${nanoid(4).toLowerCase()}`;
    attempts += 1;
  }

  throw new Error('Could not generate a unique slug');
}

function getGatePageUrl(c, slug) {
  return `${getFrontendOrigin(c)}/gate/${slug}`;
}

function getBackgroundFileUrl(c, slug) {
  return `${getPublicOrigin(c)}/api/s/${slug}/background-file`;
}

function getDownloadUrl(c, slug) {
  return `${getPublicOrigin(c)}/api/s/${slug}/download`;
}

const MAX_SHARE_FILE_SIZE = 250 * 1024 * 1024;
function getShareValidationError({ originalName, size }) {
  if (!originalName) return 'File name is required';
  if (!Number.isFinite(Number(size)) || Number(size) <= 0) return 'Invalid file size';
  if (Number(size) > MAX_SHARE_FILE_SIZE) return 'File size exceeds the 250 MB limit';
  return null;
}

// Cloudflare Access JWT validation middleware
const cloudflareAccessMiddleware = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    c.set('user', null);
    return await next(); // Proceed as anonymous
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = await verify(token, c.env.JWT_SECRET, "HS256");
    c.set('user', payload);
  } catch (err) {
    console.error('JWT Verify Error:', err.message);
    c.set('user', null);
  }
  await next();
};

const authMiddleware = cloudflareAccessMiddleware;

const requireAuth = async (c, next) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  await next();
};

// Auth middleware AFTER CORS
app.use('/api/*', authMiddleware);

app.get('/api/health', (c) => {
  return c.json({ ok: true });
});

// ==========================================
// YOUTUBE DOWNLOADER PROXY
// Rate-limits requests then proxies to the youtube-service microservice.
// Set YOUTUBE_SERVICE_URL in Worker env vars (e.g. https://your-service.railway.app)
// ==========================================

// Simple in-memory rate limiter: max 3 requests per IP per 10 minutes
const ytRateMap = new Map(); // ip → { count, resetAt }
const YT_MAX    = 3;
const YT_WINDOW = 10 * 60 * 1000;

function ytRateCheck(ip) {
  const now = Date.now();
  let entry  = ytRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + YT_WINDOW };
    ytRateMap.set(ip, entry);
  }
  entry.count += 1;
  return entry.count <= YT_MAX;
}

function getYtServiceUrl(c) {
  return (c.env.API_URL || c.env.YOUTUBE_SERVICE_URL || '').replace(/\/$/, '');
}

function getYtConfigError(c) {
  const serviceUrl = getYtServiceUrl(c);
  if (serviceUrl) return null;
  return c.json({
    error: 'YouTube service not configured.',
    detail: 'Set API_URL to the Railway backend URL in Worker variables. YOUTUBE_SERVICE_URL is supported as a fallback.',
  }, 503);
}

function getYtAuthHeaders(c, extra = {}) {
  const secret = c.env.WORKER_SECRET || '';
  return {
    ...extra,
    ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
  };
}

async function readJsonResponse(response, fallbackMessage) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: fallbackMessage };
  }
}

app.post('/api/video-info', async (c) => {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  if (!ytRateCheck(ip)) {
    return c.json({ error: 'Too many requests. Please wait a few minutes.' }, 429);
  }

  const serviceUrl = getYtServiceUrl(c);
  const configError = getYtConfigError(c);
  if (configError) return configError;

  let body;
  try { body = await c.req.json(); } catch { body = {}; }

  try {
    const upstream = await fetch(`${serviceUrl}/api/video-info`, {
      method: 'POST',
      headers: getYtAuthHeaders(c, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const data = await readJsonResponse(upstream, 'Video info failed.');
    return c.json(data, upstream.status);
  } catch (err) {
    if (err.name === 'TimeoutError') return c.json({ error: 'Video info fetch timed out.' }, 504);
    return c.json({ error: 'Failed to reach download service.' }, 502);
  }
});

app.post('/api/download', async (c) => {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  if (!ytRateCheck(ip)) {
    return c.json({ error: 'Too many requests. Please wait a few minutes.' }, 429);
  }

  const serviceUrl = getYtServiceUrl(c);
  const configError = getYtConfigError(c);
  if (configError) return configError;

  let body;
  try { body = await c.req.json(); } catch { body = {}; }

  try {
    const upstream = await fetch(`${serviceUrl}/api/download`, {
      method: 'POST',
      headers: getYtAuthHeaders(c, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const data = await readJsonResponse(upstream, 'Download failed.');
    return c.json(data, upstream.status);
  } catch (err) {
    if (err.name === 'TimeoutError') return c.json({ error: 'Service timeout. Try again.' }, 504);
    return c.json({ error: 'Failed to reach download service.' }, 502);
  }
});

app.get('/api/progress/:id', async (c) => {
  const serviceUrl = getYtServiceUrl(c);
  const configError = getYtConfigError(c);
  if (configError) return configError;

  try {
    const upstream = await fetch(`${serviceUrl}/api/progress/${c.req.param('id')}`, {
      headers: getYtAuthHeaders(c),
      signal: AbortSignal.timeout(8000),
    });
    const data = await readJsonResponse(upstream, 'Progress check failed.');
    return c.json(data, upstream.status);
  } catch (err) {
    if (err.name === 'TimeoutError') return c.json({ error: 'Progress check timed out.' }, 504);
    return c.json({ error: 'Failed to reach download service.' }, 502);
  }
});

app.get('/api/download/:id/file', async (c) => {
  const serviceUrl = getYtServiceUrl(c);
  const configError = getYtConfigError(c);
  if (configError) return configError;

  try {
    const upstream = await fetch(`${serviceUrl}/api/download/${c.req.param('id')}/file`, {
      headers: getYtAuthHeaders(c),
      signal: AbortSignal.timeout(120000),
    });

    if (!upstream.ok || upstream.status === 202) {
      const data = await readJsonResponse(upstream, 'File not ready.');
      return c.json(data, upstream.status);
    }

    const headers = new Headers();
    ['content-type', 'content-disposition', 'content-length'].forEach((header) => {
      const value = upstream.headers.get(header);
      if (value) headers.set(header, value);
    });
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (err) {
    if (err.name === 'TimeoutError') return c.json({ error: 'File download timed out.' }, 504);
    return c.json({ error: 'Failed to reach download service.' }, 502);
  }
});

app.delete('/api/download/:id', async (c) => {
  const serviceUrl = getYtServiceUrl(c);
  const configError = getYtConfigError(c);
  if (configError) return configError;

  try {
    const upstream = await fetch(`${serviceUrl}/api/download/${c.req.param('id')}`, {
      method: 'DELETE',
      headers: getYtAuthHeaders(c),
      signal: AbortSignal.timeout(8000),
    });
    const data = await readJsonResponse(upstream, 'Cancel request failed.');
    return c.json(data, upstream.status);
  } catch (err) {
    if (err.name === 'TimeoutError') return c.json({ error: 'Cancel request timed out.' }, 504);
    return c.json({ error: 'Failed to reach download service.' }, 502);
  }
});

app.get('/api/youtube/info', async (c) => {
  const ip  = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  const url = c.req.query('url');

  if (!url) return c.json({ error: 'Missing url parameter.' }, 400);
  if (!ytRateCheck(ip)) {
    return c.json({ error: 'Too many requests. Please wait a few minutes.' }, 429);
  }

  const serviceUrl = getYtServiceUrl(c);
  const configError = getYtConfigError(c);
  if (configError) return configError;

  try {
    const upstream = await fetch(`${serviceUrl}/api/video-info`, {
      method: 'POST',
      headers: getYtAuthHeaders(c, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await readJsonResponse(upstream, 'Video info failed.');
    return c.json(data, upstream.status);
  } catch (err) {
    if (err.name === 'TimeoutError') return c.json({ error: 'Video info fetch timed out.' }, 504);
    return c.json({ error: 'Failed to reach download service.' }, 502);
  }
});

// POST /api/youtube/download — now async: returns { jobId } immediately
app.post('/api/youtube/download', async (c) => {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';

  if (!ytRateCheck(ip)) {
    return c.json({ error: 'Too many requests. Please wait a few minutes.' }, 429);
  }

  const serviceUrl = getYtServiceUrl(c);
  const configError = getYtConfigError(c);
  if (configError) return configError;

  let body;
  try { body = await c.req.json(); } catch { body = {}; }

  try {
    const upstream = await fetch(`${serviceUrl}/api/download`, {
      method:  'POST',
      headers: getYtAuthHeaders(c, { 'Content-Type': 'application/json' }),
      body:   JSON.stringify(body),
      signal: AbortSignal.timeout(10000), // just enqueues — fast
    });
    const data = await readJsonResponse(upstream, 'Download failed.');
    return c.json(data, upstream.status);
  } catch (err) {
    if (err.name === 'TimeoutError') return c.json({ error: 'Service timeout. Try again.' }, 504);
    return c.json({ error: 'Failed to reach download service.' }, 502);
  }
});

// GET /api/youtube/progress/:id — poll job progress (no rate limit — polling is cheap)
app.get('/api/youtube/progress/:id', async (c) => {
  const serviceUrl = getYtServiceUrl(c);
  const configError = getYtConfigError(c);
  if (configError) return configError;

  try {
    const upstream = await fetch(`${serviceUrl}/api/progress/${c.req.param('id')}`, {
      headers: getYtAuthHeaders(c),
      signal:  AbortSignal.timeout(8000),
    });
    const data = await readJsonResponse(upstream, 'Progress check failed.');
    return c.json(data, upstream.status);
  } catch (err) {
    if (err.name === 'TimeoutError') return c.json({ error: 'Progress check timed out.' }, 504);
    return c.json({ error: 'Failed to reach download service.' }, 502);
  }
});

// GET /api/youtube/file/:id — stream completed file (no rate limit — already paid for)
app.get('/api/youtube/file/:id', async (c) => {
  const serviceUrl = getYtServiceUrl(c);
  const configError = getYtConfigError(c);
  if (configError) return configError;

  try {
    const upstream = await fetch(`${serviceUrl}/api/download/${c.req.param('id')}/file`, {
      headers: getYtAuthHeaders(c),
      signal:  AbortSignal.timeout(120000),
    });

    if (!upstream.ok) {
      const err = await readJsonResponse(upstream, 'File not ready.');
      return c.json(err, upstream.status);
    }

    const headers = new Headers();
    ['content-type', 'content-disposition', 'content-length', 'x-format-used'].forEach((h) => {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    });
    return new Response(upstream.body, { status: 200, headers });
  } catch (err) {
    if (err.name === 'TimeoutError') return c.json({ error: 'File download timed out.' }, 504);
    return c.json({ error: 'Failed to reach download service.' }, 502);
  }
});

app.delete('/api/youtube/progress/:id', async (c) => {
  const serviceUrl = getYtServiceUrl(c);
  const configError = getYtConfigError(c);
  if (configError) return configError;

  try {
    const upstream = await fetch(`${serviceUrl}/api/download/${c.req.param('id')}`, {
      method: 'DELETE',
      headers: getYtAuthHeaders(c),
      signal: AbortSignal.timeout(8000),
    });
    const data = await readJsonResponse(upstream, 'Cancel request failed.');
    return c.json(data, upstream.status);
  } catch (err) {
    if (err.name === 'TimeoutError') return c.json({ error: 'Cancel request timed out.' }, 504);
    return c.json({ error: 'Failed to reach download service.' }, 502);
  }
});

function isValidRazorpayAmount(amount) {
  return Number.isFinite(Number(amount)) && Number(amount) >= 100;
}

function encodeBasicAuth(id, secret) {
  const payload = `${id}:${secret}`;
  return `Basic ${btoa(unescape(encodeURIComponent(payload)))}`;
}

async function computeRazorpaySignature(secret, payload) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

app.post('/api/create-order', async (c) => {
  let body = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const amount = Number(body.amount);
  const currency = String(body.currency || 'INR').toUpperCase();
  const receipt = String(body.receipt || `receipt_${Date.now()}`);

  if (!isValidRazorpayAmount(amount)) {
    return c.json({ error: 'Amount must be a number and at least 100 paise' }, 400);
  }

  const keyId = c.env.RAZORPAY_KEY_ID || '';
  const keySecret = c.env.RAZORPAY_KEY_SECRET || '';

  if (!keyId || !keySecret) {
    return c.json({ error: 'Payment gateway is not configured' }, 500);
  }

  try {
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: encodeBasicAuth(keyId, keySecret),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount, currency, receipt }),
    });

    const razorpayData = await razorpayResponse.json();

    if (razorpayResponse.status === 401) {
      return c.json({ error: 'Razorpay authentication failed' }, 401);
    }

    if (!razorpayResponse.ok) {
      return c.json({
        error: razorpayData.error?.description || razorpayData.error?.reason || 'Razorpay order creation failed',
        details: razorpayData,
      }, 500);
    }

    return c.json({
      order_id: razorpayData.id,
      amount: razorpayData.amount,
      currency: razorpayData.currency,
      receipt: razorpayData.receipt,
    });
  } catch (error) {
    console.error('Razorpay create order error:', error);
    return c.json({ error: 'Unable to create Razorpay order' }, 500);
  }
});

app.post('/api/verify-payment', async (c) => {
  let body = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const paymentId = String(body.razorpay_payment_id || '').trim();
  const orderId = String(body.razorpay_order_id || '').trim();
  const signature = String(body.razorpay_signature || '').trim();

  if (!paymentId || !orderId || !signature) {
    return c.json({ error: 'razorpay_payment_id, razorpay_order_id and razorpay_signature are required' }, 400);
  }

  const keySecret = c.env.RAZORPAY_KEY_SECRET || '';
  if (!keySecret) {
    return c.json({ error: 'Payment gateway is not configured' }, 500);
  }

  try {
    const expectedSignature = await computeRazorpaySignature(keySecret, `${orderId}|${paymentId}`);
    if (expectedSignature !== signature) {
      return c.json({ error: 'Invalid payment signature' }, 400);
    }

    return c.json({ success: true, message: 'Payment verified successfully' });
  } catch (error) {
    console.error('Razorpay verify signature error:', error);
    return c.json({ error: 'Unable to verify payment signature' }, 500);
  }
});

app.post('/api/auth/google', async (c) => {
  console.log("🔥 HIT GOOGLE AUTH ROUTE");
  try {
    let body = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    const token = body.token;
    console.log("📦 BODY:", body);

    if (!token) {
      console.log("❌ No token received");
      return c.json({ error: "Token missing" }, 400);
    }

    console.log("🔑 Token received");
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    console.log("🌐 Google response status:", googleRes.status);

    const googleData = await googleRes.json();
    console.log("👤 Google user:", googleData);

    if (googleData.error) {
      console.log("❌ Invalid token");
      return c.json({ error: "Invalid Google token", details: googleData }, 401);
    }

    const email = googleData.email;
    const name = googleData.name || "User";
    const sanitizedEmail = email.trim().toLowerCase();

    console.log("💾 Saving user...");
    let user = await c.env.multitool_db.prepare('SELECT * FROM users WHERE email = ?').bind(sanitizedEmail).first();

    if (!user) {
      const id = nanoid();
      const dummyHash = bcrypt.hashSync(nanoid(), 10);
      // Try to insert with oauth_provider, fallback to without if column doesn't exist
      try {
        await c.env.multitool_db.prepare('INSERT INTO users (id, name, email, password_hash, oauth_provider) VALUES (?, ?, ?, ?, ?)')
          .bind(id, name, sanitizedEmail, dummyHash, 'google').run();
      } catch (err) {
        if (err.message.includes('oauth_provider')) {
          // Column doesn't exist yet, insert without it
          await c.env.multitool_db.prepare('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)')
            .bind(id, name, sanitizedEmail, dummyHash).run();
        } else {
          throw err;
        }
      }
      user = { id, name, email: sanitizedEmail, oauth_provider: 'google' };
    } else if (user.oauth_provider === undefined || user.oauth_provider === null) {
      // Try to update existing user to mark as google
      try {
        await c.env.multitool_db.prepare('UPDATE users SET oauth_provider = ? WHERE id = ?')
          .bind('google', user.id).run();
      } catch (err) {
        // Column doesn't exist yet, ignore
        console.warn('Cannot update oauth_provider - column might not exist yet:', err.message);
      }
    }
    console.log("✅ User saved");

    if (!c.env.JWT_SECRET) {
      console.error("JWT_SECRET missing");
      return c.json({ error: "Server misconfigured" }, 500);
    }
    const exp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
    const payload = { id: user.id, email: user.email, exp };
    const jwtToken = await sign(payload, c.env.JWT_SECRET, "HS256");

    return c.json({
      success: true,
      data: {
        token: jwtToken,
        user: { id: user.id, email: user.email, name: user.name }
      }
    });
  } catch (err) {
    console.log("💥 ERROR:", err);
    return c.json({ error: "Server error", message: err.message }, 500);
  }
});

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

app.post('/api/auth/register', async (c) => {
  let body = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const { email: rawEmail, password } = body;
  if (!rawEmail || !password) return c.json({ error: 'Email and password required' }, 400);

  const email = rawEmail.trim().toLowerCase();

  const existing = await c.env.multitool_db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return c.json({ error: 'Email already exists' }, 400);

  const id = nanoid();
  const hash = bcrypt.hashSync(password, 10);
  await c.env.multitool_db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').bind(id, email, hash).run();

  const exp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
  const payload = { id, email, exp };
  const token = await sign(payload, c.env.JWT_SECRET, "HS256");
  return c.json({ data: { user: { id, email }, token } });
});

// ==========================================
// DEPLOYMENT ROUTES
// ==========================================

app.post('/api/deploy/create-order', requireAuth, async (c) => {
  const amount = 100000; // ₹1000 in paise
  const currency = 'INR';
  const receipt = `deploy_${nanoid(10)}`;

  const keyId = c.env.RAZORPAY_KEY_ID || '';
  const keySecret = c.env.RAZORPAY_KEY_SECRET || '';

  if (!keyId || !keySecret) {
    return c.json({ error: 'Payment gateway is not configured' }, 500);
  }

  try {
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: encodeBasicAuth(keyId, keySecret),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount, currency, receipt }),
    });

    const razorpayData = await razorpayResponse.json();

    if (!razorpayResponse.ok) {
      return c.json({
        error: razorpayData.error?.description || 'Razorpay order creation failed',
        details: razorpayData,
      }, 500);
    }

    return c.json({
      id: razorpayData.id,
      amount: razorpayData.amount,
      currency: razorpayData.currency,
      receipt: razorpayData.receipt,
    });
  } catch (error) {
    console.error('Razorpay deploy order error:', error);
    return c.json({ error: 'Unable to create payment order' }, 500);
  }
});

app.post('/api/deploy/verify-and-save', requireAuth, async (c) => {
  const user = c.get('user');
  let body = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const { 
    razorpay_payment_id, 
    razorpay_order_id, 
    razorpay_signature,
    projectName,
    slug: requestedSlug,
    html,
    css,
    js
  } = body;

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return c.json({ error: 'Payment details required' }, 400);
  }

  const keySecret = c.env.RAZORPAY_KEY_SECRET || '';
  try {
    const expectedSignature = await computeRazorpaySignature(keySecret, `${razorpay_order_id}|${razorpay_payment_id}`);
    if (expectedSignature !== razorpay_signature) {
      return c.json({ error: 'Invalid payment signature' }, 400);
    }

    // Verify slug uniqueness
    const db = getDb(c.env);
    const existing = await db.prepare('SELECT id FROM deployments WHERE slug = ?').bind(requestedSlug).first();
    if (existing) {
      return c.json({ error: 'Slug already taken, please choose another name' }, 400);
    }

    const id = nanoid();
    await db.prepare(`
      INSERT INTO deployments (id, user_id, project_name, slug, html, css, js, payment_id, order_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, 
      user.id, 
      projectName || 'Untitled', 
      requestedSlug, 
      html || '', 
      css || '', 
      js || '', 
      razorpay_payment_id, 
      razorpay_order_id
    ).run();

    return c.json({ 
      success: true, 
      data: { 
        id, 
        slug: requestedSlug,
        url: `${getPublicOrigin(c)}/d/${requestedSlug}`
      } 
    });
  } catch (error) {
    console.error('Verify and save error:', error);
    return c.json({ error: 'Failed to complete deployment' }, 500);
  }
});

// Free deploy — no payment required
app.post('/api/deploy/free', requireAuth, async (c) => {
  const user = c.get('user');
  let body = {};
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const { projectName, slug: rawSlug, html, css, js } = body;
  if (!projectName || !html) return c.json({ error: 'projectName and html are required' }, 400);

  const slug = (rawSlug || projectName).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!slug) return c.json({ error: 'Invalid project name' }, 400);

  // Derive username from name or email
  const username = (user.name || user.email.split('@')[0]).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  const db = getDb(c.env);
  const id = nanoid();

  try {
    const existing = await db.prepare('SELECT id, user_id FROM deployments WHERE slug = ?').bind(slug).first();
    if (existing && existing.user_id !== user.id) {
      return c.json({ error: 'That project name is already taken. Choose another.' }, 409);
    }

    if (existing) {
      await db.prepare(`UPDATE deployments SET html=?,css=?,js=?,project_name=?,username=?,updated_at=CURRENT_TIMESTAMP WHERE slug=? AND user_id=?`)
        .bind(html, css || '', js || '', projectName, username, slug, user.id).run();
    } else {
      await db.prepare(`INSERT INTO deployments (id,user_id,project_name,slug,html,css,js,username,views) VALUES (?,?,?,?,?,?,?,?,0)`)
        .bind(id, user.id, projectName, slug, html, css || '', js || '', username).run();
    }

    const url = `${c.env.FRONTEND_URL || 'https://multitoolhub.space'}/p/${username}/${slug}`;
    return c.json({ success: true, url, slug, username });
  } catch (error) {
    console.error('Free deploy error:', error);
    return c.json({ error: 'Deployment failed' }, 500);
  }
});

app.get('/api/deployments', requireAuth, async (c) => {
  const user = c.get('user');
  const db = getDb(c.env);
  try {
    const result = await db.prepare('SELECT id, project_name, slug, username, views, created_at, updated_at FROM deployments WHERE user_id = ? ORDER BY created_at DESC')
      .bind(user.id)
      .all();
    return c.json({ data: result.results || [] });
  } catch (error) {
    return c.json({ error: 'Failed to fetch deployments' }, 500);
  }
});

app.post('/api/deployments/:id/update', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  let body = {};
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const { html, css, js, projectName } = body;
  const db = getDb(c.env);

  try {
    const deployment = await db.prepare('SELECT id FROM deployments WHERE id = ? AND user_id = ?')
      .bind(id, user.id)
      .first();

    if (!deployment) return c.json({ error: 'Deployment not found' }, 404);

    await db.prepare(`
      UPDATE deployments 
      SET html = ?, css = ?, js = ?, project_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(html, css, js, projectName, id).run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to update deployment' }, 500);
  }
});

app.delete('/api/deployments/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const db = getDb(c.env);
  try {
    await db.prepare('DELETE FROM deployments WHERE id = ? AND user_id = ?').bind(id, user.id).run();
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to delete deployment' }, 500);
  }
});

function renderProject(project) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.project_name || 'Project'}</title>
  <style>${project.css || ''}</style>
</head>
<body>
  ${project.html || ''}
  <script>${project.js || ''}</script>
</body>
</html>`;
}

// Legacy /d/:slug route — still works, increments views
app.get('/d/:slug', async (c) => {
  const slug = c.req.param('slug');
  const db = getDb(c.env);
  try {
    const project = await db.prepare('SELECT html, css, js, project_name FROM deployments WHERE slug = ?').bind(slug).first();
    if (!project) return c.text('Project not found', 404);
    c.executionCtx?.waitUntil(db.prepare('UPDATE deployments SET views = views + 1 WHERE slug = ?').bind(slug).run());
    return c.html(renderProject(project));
  } catch (error) {
    return c.text('Error loading project', 500);
  }
});

// Deployed projects: /p/:username/:project
app.get('/p/:username/:project', async (c) => {
  const username = c.req.param('username');
  const project = c.req.param('project');
  const db = getDb(c.env);
  try {
    const row = await db.prepare('SELECT html, css, js, project_name FROM deployments WHERE username = ? AND slug = ?')
      .bind(username, project).first();
    if (!row) return c.text('Project not found', 404);
    c.executionCtx?.waitUntil(db.prepare('UPDATE deployments SET views = views + 1 WHERE username = ? AND slug = ?').bind(username, project).run());
    return c.html(renderProject(row));
  } catch (error) {
    return c.text('Error loading project', 500);
  }
});

app.post('/api/auth/login', async (c) => {
  let body = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const { email: rawEmail, password } = body;
  if (!rawEmail || !password) return c.json({ error: 'Email and password required' }, 400);
  const email = rawEmail.trim().toLowerCase();

  const user = await c.env.multitool_db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();

  if (!user) {
    console.log('Login failed: User not found for email:', email);
    return c.json({ error: 'Invalid email or password' }, 401);
  }
  try {
    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
      console.log('Login failed: Password mismatch for email:', email);
      return c.json({ error: 'Invalid email or password' }, 401);
    }
  } catch (err) {
    console.error('bcrypt compareSync error:', err);
    return c.json({ error: 'Server error during login' }, 500);
  }

  const exp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
  const payload = { id: user.id, email: user.email, exp };
  const token = await sign(payload, c.env.JWT_SECRET, "HS256");
  return c.json({ data: { user: { id: user.id, email: user.email }, token } });
});

app.get('/api/auth/me', requireAuth, async (c) => {
  const user = c.get('user');
  return c.json({ data: { user } });
});

app.post('/api/auth/forgot-password', async (c) => {
  let body = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ message: 'If that email exists a reset link has been sent' });
  }
  const { email: rawEmail } = body;
  const email = rawEmail?.trim().toLowerCase();

  if (!email) return c.json({ message: 'If that email exists a reset link has been sent' });

  const user = await c.env.multitool_db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();

  if (user) {
    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await c.env.multitool_db
  .prepare('INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)')
  .bind(token, user.id, expiresAt)
  .run();

    const resetLink = `${c.env.FRONTEND_URL}/reset-password?token=${token}`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: c.env.FROM_EMAIL,
        to: email,
        subject: 'Reset Your Password - MultiTool',
        html: `<div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background: #f9fafb; border-radius: 8px;">
          <h2 style="color: #4f46e5;">Reset Your Password</h2>
          <p>You requested a password reset for your MultiTool account. Click the button below to set a new password. This link will expire in 15 minutes.</p>
          <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0;">Reset Password</a>
          <p style="font-size: 14px; color: #6b7280;">If you didn't request this, you can safely ignore this email.</p>
        </div>`
      })
    });
  }

  return c.json({ message: 'If that email exists a reset link has been sent' });
});

app.get('/api/auth/verify-reset-token/:token', async (c) => {
  const token = c.req.param('token');
  const reset = await c.env.multitool_db.prepare('SELECT * FROM password_resets WHERE token = ? AND used = 0').bind(token).first();

  if (!reset) return c.json({ valid: false, error: 'Token expired or invalid' });

  if (new Date(reset.expires_at).getTime() <= Date.now()) {
    return c.json({ valid: false, error: 'Token expired or invalid' });
  }

  return c.json({ valid: true });
});

app.post('/api/auth/reset-password', async (c) => {
  let body = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }
  const { token, newPassword } = body;

  const reset = await c.env.multitool_db.prepare('SELECT * FROM password_resets WHERE token = ? AND used = 0').bind(token).first();
  if (!reset || new Date(reset.expires_at).getTime() <= Date.now()) {
    return c.json({ error: 'Token expired or invalid' }, 400);
  }

  const hash = bcrypt.hashSync(newPassword, 10);

  await c.env.multitool_db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, reset.user_id).run();
  await c.env.multitool_db.prepare('UPDATE password_resets SET used = 1 WHERE token = ?').bind(token).run();

  return c.json({ message: 'Password reset successfully' });
});

// ==========================================
// ANALYTICS ROUTES
// ==========================================

app.get('/api/share/analytics', requireAuth, async (c) => {
  const db = getDb(c.env);
  const user = c.get('user');
  const userId = user.id;

  const links = await db.prepare(
    `SELECT slug, original_name, size, long_url, download_count, created_at, expires_at, r2_key, requires_data_collection
     FROM links WHERE user_id = ? ORDER BY created_at DESC`
  ).bind(userId).all();

  const now = new Date();

  const linksWithMeta = await Promise.all((links.results || []).map(async (link) => {
    const lastClick = await db.prepare(
      'SELECT timestamp FROM analytics WHERE slug = ? ORDER BY timestamp DESC LIMIT 1'
    ).bind(link.slug).first();

    const leadsRow = await db.prepare(
      'SELECT COUNT(*) as count FROM analytics WHERE slug = ? AND visitor_data IS NOT NULL'
    ).bind(link.slug).first();

    return {
      slug: link.slug,
      originalName: link.original_name,
      size: link.size,
      longUrl: link.long_url,
      downloadCount: link.download_count || 0,
      createdAt: link.created_at,
      uploadedAt: link.created_at,
      expiresAt: link.expires_at,
      isExpired: link.expires_at ? new Date(link.expires_at) <= now : false,
      lastClicked: lastClick?.timestamp || null,
      leadsCount: leadsRow?.count || 0,
    };
  }));

  const totalClicks = linksWithMeta.reduce((sum, l) => sum + l.downloadCount, 0);

  const uniqueRow = await db.prepare(
    `SELECT COUNT(DISTINCT a.ip) as count FROM analytics a
     INNER JOIN links l ON a.slug = l.slug WHERE l.user_id = ?`
  ).bind(userId).first();

  const sparklineRows = await db.prepare(
    `SELECT DATE(a.timestamp) as date, COUNT(*) as clicks FROM analytics a
     INNER JOIN links l ON a.slug = l.slug
     WHERE l.user_id = ?
     GROUP BY DATE(a.timestamp) ORDER BY date ASC LIMIT 30`
  ).bind(userId).all();

  const countriesRows = await db.prepare(
    `SELECT a.country as name, COUNT(*) as value FROM analytics a
     INNER JOIN links l ON a.slug = l.slug
     WHERE l.user_id = ? AND a.country IS NOT NULL
     GROUP BY a.country ORDER BY value DESC LIMIT 5`
  ).bind(userId).all();

  const referersRows = await db.prepare(
    `SELECT COALESCE(a.referer, 'Direct') as name, COUNT(*) as value FROM analytics a
     INNER JOIN links l ON a.slug = l.slug
     WHERE l.user_id = ?
     GROUP BY a.referer ORDER BY value DESC LIMIT 5`
  ).bind(userId).all();

  const leadsRows = await db.prepare(
    `SELECT a.slug, a.timestamp, a.ip, a.visitor_data FROM analytics a
     INNER JOIN links l ON a.slug = l.slug
     WHERE l.user_id = ? AND a.visitor_data IS NOT NULL
     ORDER BY a.timestamp DESC LIMIT 100`
  ).bind(userId).all();

  const leads = (leadsRows.results || []).map(row => {
    let data = {};
    try { data = JSON.parse(row.visitor_data); } catch {}
    return { slug: row.slug, timestamp: row.timestamp, ip: row.ip, data };
  });

  return c.json({
    data: {
      totalClicks,
      uniqueVisitors: uniqueRow?.count || 0,
      links: linksWithMeta,
      sparkline: sparklineRows.results || [],
      topCountries: countriesRows.results || [],
      topReferers: referersRows.results || [],
      leads,
    }
  });
});

// Get all links for the authenticated user
app.get('/api/links', requireAuth, async (c) => {
  const db = getDb(c.env);
  const user = c.get('user');
  const rows = await db.prepare(
    `SELECT slug, long_url, original_name, expires_at, created_at
     FROM links WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`
  ).bind(user.id).all();
  return c.json({ data: rows.results || [] });
});

// Delete specific slugs (URL shortener links or file shares)
app.delete('/api/links', requireAuth, async (c) => {
  const db = getDb(c.env);
  const user = c.get('user');
  let body = {};
  try { body = await c.req.json(); } catch {}
  const { slugs } = body;
  if (!Array.isArray(slugs) || slugs.length === 0) {
    return c.json({ error: 'slugs array required' }, 400);
  }

  const placeholders = slugs.map(() => '?').join(',');
  const rows = await db.prepare(
    `SELECT slug, r2_key FROM links WHERE slug IN (${placeholders}) AND user_id = ?`
  ).bind(...slugs, user.id).all();

  const bucket = c.env.MY_BUCKET;
  for (const row of (rows.results || [])) {
    if (row.r2_key && bucket) {
      try { await bucket.delete(row.r2_key); } catch {}
    }
  }

  await db.prepare(
    `DELETE FROM links WHERE slug IN (${placeholders}) AND user_id = ?`
  ).bind(...slugs, user.id).run();

  await db.prepare(
    `DELETE FROM analytics WHERE slug IN (${placeholders})`
  ).bind(...slugs).run();

  return c.json({ message: `Deleted ${slugs.length} item(s)` });
});

// Delete all links of a type (urls or files)
app.delete('/api/links/all', requireAuth, async (c) => {
  const db = getDb(c.env);
  const user = c.get('user');
  const type = c.req.query('type') || 'urls';

  const condition = type === 'files' ? 'original_name IS NOT NULL' : 'original_name IS NULL';
  const rows = await db.prepare(
    `SELECT slug, r2_key FROM links WHERE user_id = ? AND ${condition}`
  ).bind(user.id).all();

  const bucket = c.env.MY_BUCKET;
  for (const row of (rows.results || [])) {
    if (row.r2_key && bucket) {
      try { await bucket.delete(row.r2_key); } catch {}
    }
  }

  const slugList = (rows.results || []).map(r => r.slug);
  if (slugList.length > 0) {
    const placeholders = slugList.map(() => '?').join(',');
    await db.prepare(
      `DELETE FROM analytics WHERE slug IN (${placeholders})`
    ).bind(...slugList).run();
  }

  await db.prepare(
    `DELETE FROM links WHERE user_id = ? AND ${condition}`
  ).bind(user.id).run();

  return c.json({ message: `Deleted all ${type}` });
});

// ==========================================
// FEEDBACK ROUTES
// ==========================================

app.get('/api/feedback', requireAuth, async (c) => {
  const db = getDb(c.env);
  const rows = await db.prepare(
    'SELECT id, email, message, created_at FROM feedback ORDER BY created_at DESC LIMIT 100'
  ).all();
  return c.json({ data: rows.results || [] });
});

app.post('/api/feedback', async (c) => {
  const db = getDb(c.env);
  let body = {};
  try { body = await c.req.json(); } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }
  const { email, message } = body;
  if (!message) return c.json({ error: 'Message required' }, 400);
  await db.prepare('INSERT INTO feedback (email, message) VALUES (?, ?)').bind(email || null, message).run();
  return c.json({ success: true });
});

app.post('/api/upload-asset', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!file || typeof file === 'string') {
    return c.json({ error: 'File is required' }, 400);
  }

  if (file.size > MAX_SHARE_FILE_SIZE) {
    return c.json({ error: 'File size exceeds the 250 MB limit' }, 413);
  }

  const bucket = c.env.MY_BUCKET;
  if (!bucket) {
    return c.json({ error: 'R2 bucket is not configured' }, 500);
  }

  const key = `uploads/${Date.now()}-${nanoid(10)}-${sanitizeFileName(file.name || 'asset')}`;
  try {
    const arrayBuffer = await file.arrayBuffer();
    await bucket.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
      },
      customMetadata: {
        originalName: sanitizeFileName(file.name || 'asset'),
      },
    });
  } catch (err) {
    console.error('Upload asset error:', err);
    return c.json({ error: 'Failed to upload asset' }, 500);
  }

  return c.json({ data: { key } });
});

// ── Admin background management ──────────────────────────────────

const ADMIN_EMAIL = 'afrosem36@gmail.com';

app.post('/api/admin/upload-background', requireAuth, async (c) => {
  const user = c.get('user');
  if (user?.email !== ADMIN_EMAIL) return c.json({ error: 'Forbidden' }, 403);

  const formData = await c.req.formData();
  const file = formData.get('file');
  if (!file || typeof file === 'string') return c.json({ error: 'File is required' }, 400);

  const bucket = c.env.MY_BUCKET;
  if (!bucket) return c.json({ error: 'R2 bucket is not configured' }, 500);

  const safeName = sanitizeFileName(file.name || 'background').replace(/\//g, '_');
  const key = `bg_${Date.now()}_${nanoid(8)}_${safeName}`;

  try {
    const arrayBuffer = await file.arrayBuffer();
    await bucket.put(key, arrayBuffer, {
      httpMetadata: { contentType: file.type || 'application/octet-stream' },
      customMetadata: { originalName: safeName },
    });
  } catch (err) {
    console.error('Background upload error:', err);
    return c.json({ error: 'Failed to upload background' }, 500);
  }

  const url = `${getPublicOrigin(c)}/api/background/${key}`;
  return c.json({ key, url });
});

app.delete('/api/admin/background/:key', requireAuth, async (c) => {
  const user = c.get('user');
  if (user?.email !== ADMIN_EMAIL) return c.json({ error: 'Forbidden' }, 403);

  const key = c.req.param('key');
  const bucket = c.env.MY_BUCKET;
  if (bucket && key) {
    try { await bucket.delete(key); } catch {}
  }
  return c.json({ success: true });
});

app.get('/api/background/:key', async (c) => {
  const key = c.req.param('key');
  const bucket = c.env.MY_BUCKET;
  if (!bucket) return c.json({ error: 'R2 not configured' }, 500);

  const object = await bucket.get(key);
  if (!object) return c.json({ error: 'Not found' }, 404);

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400',
    },
  });
});

app.post('/api/share/upload', async (c) => {
  const db = getDb(c.env);
  const user = c.get('user');

  let formData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: 'Invalid form data' }, 400);
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return c.json({ error: 'File is required' }, 400);
  }

  if (file.size > MAX_SHARE_FILE_SIZE) {
    return c.json({ error: 'File size exceeds the 250 MB limit' }, 413);
  }

  const rawFormConfig = formData.get('formConfig');
  let parsedFormConfig = null;
  if (rawFormConfig) {
    try {
      parsedFormConfig = JSON.parse(rawFormConfig);
    } catch {
      return c.json({ error: 'Invalid form config JSON' }, 400);
    }
  }

  const rawExpires = String(formData.get('expiresInSeconds') || '0');
  const expiresInSeconds = Number(rawExpires) || 0;
  const expiresAt = expiresInSeconds > 0
    ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
    : null;

  const gateBgKey = String(formData.get('gate_bg_key') || '').trim() || null;
  const slug = await generateUniqueSlug(db);
  const bucket = c.env.MY_BUCKET;
  if (!bucket) return c.json({ error: 'R2 bucket is not configured' }, 500);

  const r2Key = `shared/${slug}/${sanitizeFileName(file.name || 'file')}`;
  try {
    const arrayBuffer = await file.arrayBuffer();
    await bucket.put(r2Key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
      },
      customMetadata: {
        originalName: sanitizeFileName(file.name || 'file'),
      },
    });
  } catch (err) {
    console.error('Share upload failed:', err);
    return c.json({ error: 'Failed to upload file' }, 500);
  }

  const longUrl = getDownloadUrl(c, slug);
  await db.prepare(
    `INSERT INTO links (slug, original_name, r2_key, mime_type, size, long_url, user_id, requires_data_collection, form_config, gate_bg_key, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    slug,
    sanitizeFileName(file.name || 'file'),
    r2Key,
    file.type || 'application/octet-stream',
    file.size,
    longUrl,
    user?.id || null,
    parsedFormConfig ? 1 : 0,
    parsedFormConfig ? JSON.stringify(parsedFormConfig) : null,
    gateBgKey,
    expiresAt,
  ).run();

  const shortUrl = parsedFormConfig
    ? getGatePageUrl(c, slug)
    : `${getFrontendOrigin(c)}/s/${slug}/download`;
  return c.json({ data: { shortUrl, expiresAt, slug } });
});

app.post('/api/shorten', async (c) => {
  const db = getDb(c.env);
  const user = c.get('user');

  let body = {};
  try { body = await c.req.json(); } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const { longUrl, customSlug, formConfig, gate_bg_key } = body;
  if (!longUrl) return c.json({ error: 'longUrl is required' }, 400);

  try {
    new URL(longUrl);
  } catch {
    return c.json({ error: 'Invalid URL' }, 400);
  }

  let slug;
  if (customSlug) {
    slug = sanitizeSlug(customSlug);
    if (!slug) return c.json({ error: 'Invalid custom slug' }, 400);
    if (await slugExists(db, slug)) return c.json({ error: 'Custom slug already exists' }, 400);
  } else {
    slug = await generateUniqueSlug(db);
  }

  let parsedFormConfig = null;
  if (formConfig) {
    if (typeof formConfig === 'string') {
      try {
        parsedFormConfig = JSON.parse(formConfig);
      } catch {
        return c.json({ error: 'Invalid form config JSON' }, 400);
      }
    } else if (typeof formConfig === 'object') {
      parsedFormConfig = formConfig;
    } else {
      return c.json({ error: 'Invalid form config format' }, 400);
    }
  }

  const expiresAt = null;
  await db.prepare(
    `INSERT INTO links (slug, long_url, user_id, requires_data_collection, form_config, gate_bg_key, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    slug,
    longUrl,
    user?.id || null,
    parsedFormConfig ? 1 : 0,
    parsedFormConfig ? JSON.stringify(parsedFormConfig) : null,
    gate_bg_key || null,
    expiresAt,
  ).run();

  const shortUrl = parsedFormConfig
    ? getGatePageUrl(c, slug)
    : `${getPublicOrigin(c)}/api/s/${slug}`;

  return c.json({ data: { shortUrl, slug } });
});

// Direct redirect — used by plain URL shortener (no lead gate)
app.get('/api/s/:slug', async (c) => {
  const slug = c.req.param('slug');
  const db = getDb(c.env);
  const link = await db.prepare('SELECT long_url, expires_at, requires_data_collection FROM links WHERE slug = ?').bind(slug).first();
  if (!link) return c.json({ error: 'Link not found' }, 404);
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
    return c.json({ error: 'Link expired' }, 410);
  }
  // If this link has a lead gate, redirect to the gate page instead
  if (link.requires_data_collection) {
    return Response.redirect(getGatePageUrl(c, slug), 302);
  }
  return Response.redirect(link.long_url, 302);
});

// Short routes — proxied by Vite dev server from /s/* to this worker
app.get('/s/:slug/download', async (c) => {
  const slug = c.req.param('slug');
  const db = getDb(c.env);
  const link = await db.prepare('SELECT r2_key, expires_at FROM links WHERE slug = ?').bind(slug).first();
  if (!link) return c.json({ error: 'Link not found' }, 404);
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
    return c.json({ error: 'Link expired' }, 410);
  }
  if (!link.r2_key) return c.json({ error: 'File not found' }, 404);
  return Response.redirect(`${getPublicOrigin(c)}/api/s/${slug}/file`, 302);
});

app.get('/s/:slug', async (c) => {
  const slug = c.req.param('slug');
  const db = getDb(c.env);
  const link = await db.prepare('SELECT long_url, expires_at, requires_data_collection FROM links WHERE slug = ?').bind(slug).first();
  if (!link) return c.json({ error: 'Link not found' }, 404);
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
    return c.json({ error: 'Link expired' }, 410);
  }
  if (link.requires_data_collection) {
    return Response.redirect(getGatePageUrl(c, slug), 302);
  }
  return Response.redirect(link.long_url, 302);
});

app.get('/api/s/:slug/config', async (c) => {
  const slug = c.req.param('slug');
  const db = getDb(c.env);
  const link = await db.prepare('SELECT * FROM links WHERE slug = ?').bind(slug).first();
  if (!link) return c.json({ error: 'Link not found' }, 404);
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
    return c.json({ error: 'Link expired' }, 410);
  }

  let formConfig = null;
  if (link.form_config) {
    try { formConfig = JSON.parse(link.form_config); } catch { formConfig = null; }
  }

  // Detect if this is a file download or URL redirect
  const isFileDownload = !!link.r2_key;
  const type = isFileDownload ? 'file' : 'url';

  return c.json({
    data: {
      formConfig,
      requiresDataCollection: !!link.requires_data_collection,
      fileName: link.original_name || null,
      isFileDownload,
      type,
    }
  });
});

app.get('/api/s/:slug/background', async (c) => {
  const slug = c.req.param('slug');
  const db = getDb(c.env);
  const link = await db.prepare('SELECT gate_bg_key, expires_at FROM links WHERE slug = ?').bind(slug).first();
  if (!link) return c.json({ error: 'Link not found' }, 404);
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
    return c.json({ error: 'Link expired' }, 410);
  }
  if (!link.gate_bg_key) return c.json({ data: {} });
  return c.json({ data: { backgroundUrl: getBackgroundFileUrl(c, slug) } });
});

app.get('/api/s/:slug/background-file', async (c) => {
  const slug = c.req.param('slug');
  const db = getDb(c.env);
  const link = await db.prepare('SELECT gate_bg_key, expires_at FROM links WHERE slug = ?').bind(slug).first();
  if (!link) return c.json({ error: 'Link not found' }, 404);
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
    return c.json({ error: 'Link expired' }, 410);
  }
  if (!link.gate_bg_key) return c.json({ error: 'Background not found' }, 404);

  const bucket = c.env.MY_BUCKET;
  if (!bucket) return c.json({ error: 'R2 bucket is not configured' }, 500);

  const object = await bucket.get(link.gate_bg_key);
  if (!object) return c.json({ error: 'Background not found' }, 404);

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'no-store',
    },
  });
});

app.get('/api/s/:slug/download', async (c) => {
  const slug = c.req.param('slug');
  const db = getDb(c.env);
  const link = await db.prepare('SELECT r2_key, original_name, expires_at FROM links WHERE slug = ?').bind(slug).first();
  if (!link) return c.json({ error: 'Link not found' }, 404);
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
    return c.json({ error: 'Link expired' }, 410);
  }
  if (!link.r2_key) return c.json({ error: 'File not found' }, 404);

  // Return JSON metadata with download URL instead of streaming the file
  const downloadUrl = `${getPublicOrigin(c)}/api/s/${slug}/file`;
  return c.json({
    success: true,
    data: {
      downloadUrl,
      fileName: link.original_name || 'download',
      expiresAt: link.expires_at || null,
    }
  });
});

// Actual file download endpoint
app.get('/api/s/:slug/file', async (c) => {
  const slug = c.req.param('slug');
  const db = getDb(c.env);
  const link = await db.prepare('SELECT r2_key, original_name, expires_at FROM links WHERE slug = ?').bind(slug).first();
  if (!link) return c.json({ error: 'Link not found' }, 404);
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
    return c.json({ error: 'Link expired' }, 410);
  }
  if (!link.r2_key) return c.json({ error: 'File not found' }, 404);

  const bucket = c.env.MY_BUCKET;
  if (!bucket) return c.json({ error: 'R2 bucket is not configured' }, 500);
  const object = await bucket.get(link.r2_key);
  if (!object) return c.json({ error: 'File not found' }, 404);

  const contentType = object.httpMetadata?.contentType || 'application/octet-stream';
  const filename = encodeURIComponent(link.original_name || 'file');
  const isMedia = /^(video|audio|image)\//.test(contentType);
  const disposition = isMedia
    ? `inline; filename="${filename}"`
    : `attachment; filename="${filename}"`;
  return new Response(object.body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': disposition,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
});

app.post('/api/s/:slug/submit', async (c) => {
  const slug = c.req.param('slug');
  const db = getDb(c.env);
  const link = await db.prepare('SELECT long_url, r2_key, requires_data_collection, expires_at FROM links WHERE slug = ?').bind(slug).first();
  if (!link) return c.json({ error: 'Link not found' }, 404);
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
    return c.json({ error: 'Link expired' }, 410);
  }

  let body = {};
  try { body = await c.req.json(); } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  if (link.requires_data_collection) {
    await db.prepare(
      `INSERT INTO analytics (slug, ip, user_agent, referer, visitor_data)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      slug,
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null,
      c.req.header('User-Agent') || null,
      c.req.header('Referer') || null,
      JSON.stringify(body),
    ).run();
  }

  const isFileDownload = !!link.r2_key;
  return c.json({
    data: {
      longUrl: link.long_url,
      isFileDownload,
      type: isFileDownload ? 'file' : 'url'
    }
  });
});

// ==========================================
// IDE PROJECTS ROUTES
// ==========================================

app.post('/api/ide/projects', requireAuth, async (c) => {
  const db = getDb(c.env);
  const user = c.get('user');
  
  let body = {};
  try { body = await c.req.json(); } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }
  
  const { name, files } = body;
  if (!name || !files) return c.json({ error: 'name and files required' }, 400);
  
  const id = nanoid();
  const filesJson = JSON.stringify(files);
  
  await db.prepare(
    'INSERT INTO ide_projects (id, user_id, name, files) VALUES (?, ?, ?, ?)'
  ).bind(id, user.id, name, filesJson).run();
  
  return c.json({ data: { id, name, files } });
});

app.get('/api/ide/projects', requireAuth, async (c) => {
  const db = getDb(c.env);
  const user = c.get('user');
  
  const rows = await db.prepare(
    'SELECT id, name, files, is_public, share_slug, created_at, updated_at FROM ide_projects WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50'
  ).bind(user.id).all();
  
  const projects = (rows.results || []).map(row => ({
    ...row,
    files: JSON.parse(row.files || '[]'),
  }));
  
  return c.json({ data: projects });
});

app.get('/api/ide/projects/:id', requireAuth, async (c) => {
  const db = getDb(c.env);
  const user = c.get('user');
  const id = c.req.param('id');
  
  const row = await db.prepare(
    'SELECT * FROM ide_projects WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).first();
  
  if (!row) return c.json({ error: 'Project not found' }, 404);
  
  return c.json({
    data: {
      ...row,
      files: JSON.parse(row.files || '[]'),
    }
  });
});

app.put('/api/ide/projects/:id', requireAuth, async (c) => {
  const db = getDb(c.env);
  const user = c.get('user');
  const id = c.req.param('id');
  
  let body = {};
  try { body = await c.req.json(); } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }
  
  const { name, files } = body;
  
  const existing = await db.prepare(
    'SELECT id FROM ide_projects WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).first();
  
  if (!existing) return c.json({ error: 'Project not found' }, 404);
  
  const filesJson = JSON.stringify(files);
  const now = new Date().toISOString();
  
  await db.prepare(
    'UPDATE ide_projects SET name = ?, files = ?, updated_at = ? WHERE id = ?'
  ).bind(name, filesJson, now, id).run();
  
  return c.json({ data: { id, name, files } });
});

app.delete('/api/ide/projects/:id', requireAuth, async (c) => {
  const db = getDb(c.env);
  const user = c.get('user');
  const id = c.req.param('id');
  
  const existing = await db.prepare(
    'SELECT id FROM ide_projects WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).first();
  
  if (!existing) return c.json({ error: 'Project not found' }, 404);
  
  await db.prepare('DELETE FROM ide_projects WHERE id = ?').bind(id).run();
  
  return c.json({ success: true });
});

app.post('/api/ide/projects/:id/share', requireAuth, async (c) => {
  const db = getDb(c.env);
  const user = c.get('user');
  const id = c.req.param('id');
  
  const existing = await db.prepare(
    'SELECT id FROM ide_projects WHERE id = ? AND user_id = ?'
  ).bind(id, user.id).first();
  
  if (!existing) return c.json({ error: 'Project not found' }, 404);
  
  const shareSlug = nanoid(8).toLowerCase();
  
  await db.prepare(
    'UPDATE ide_projects SET is_public = 1, share_slug = ? WHERE id = ?'
  ).bind(shareSlug, id).run();
  
  const shareUrl = `${getFrontendOrigin(c)}/ide/${shareSlug}`;
  
  return c.json({ data: { shareUrl, shareSlug } });
});

// Public share route - view shared project without auth
app.get('/api/ide/shared/:slug', async (c) => {
  const db = getDb(c.env);
  const slug = c.req.param('slug');
  
  const row = await db.prepare(
    'SELECT * FROM ide_projects WHERE share_slug = ? AND is_public = 1'
  ).bind(slug).first();
  
  if (!row) return c.json({ error: 'Project not found' }, 404);
  
  return c.json({
    data: {
      ...row,
      files: JSON.parse(row.files || '[]'),
    }
  });
});

// ==========================================
// TEXT-TO-SQL ROUTES
// ==========================================

const TEXT_TO_SQL_TOOL_ID  = 'text-to-sql';
const TEXT_TO_SQL_DAILY_MAX = 20;

app.get('/api/text-to-sql/credits', requireAuth, async (c) => {
  const db   = getDb(c.env);
  const user = c.get('user');
  if (hasUnlimitedCredits(user, TEXT_TO_SQL_TOOL_ID)) {
    return c.json({ data: { creditsUsed: 0, creditsRemaining: 9999, creditsTotal: 9999, unlimited: true } }, 200);
  }
  const used = await checkUserQuota(db, user.id, TEXT_TO_SQL_TOOL_ID);
  const remaining = Math.max(0, TEXT_TO_SQL_DAILY_MAX - used);
  return c.json({
    data: {
      creditsUsed:      used,
      creditsRemaining: remaining,
      creditsTotal:     TEXT_TO_SQL_DAILY_MAX,
    }
  });
});

app.post('/api/text-to-sql', requireAuth, async (c) => {
  try {
    const db   = getDb(c.env);
    const user = c.get('user');

    let body = {};
    try { body = await c.req.json(); } catch {
      return c.json({ error: 'Invalid JSON' }, 400);
    }

    const { question, schema } = body;
    if (!question) return c.json({ error: 'question is required' }, 400);
    if (!schema)   return c.json({ error: 'schema is required' }, 400);

    const unlimited = hasUnlimitedCredits(user, TEXT_TO_SQL_TOOL_ID);
    let used = 0;
    if (!unlimited) {
      used = await checkUserQuota(db, user.id, TEXT_TO_SQL_TOOL_ID);
      if (used >= TEXT_TO_SQL_DAILY_MAX) {
        return c.json({ error: 'Daily limit reached. Resets at midnight UTC.', creditsTotal: TEXT_TO_SQL_DAILY_MAX }, 429);
      }
    }

    // Text-to-SQL uses Groq exclusively (llama-3.3-70b-versatile)
    const groqKey = c.env.GROQ_API_KEY;
    if (!groqKey) return c.json({ error: 'Groq API key not configured' }, 500);

    const systemPrompt = `You are an expert SQL query generator. Given a database schema and a natural language question, generate a correct and efficient SQL query.\n\nRules:\n- Return ONLY the SQL query, no explanation, no markdown, no code blocks\n- Use standard SQL syntax compatible with most databases\n- If the question cannot be answered with the given schema, return: SELECT 'Unable to generate query for this question' as error`;

    let groqRes;
    try {
      groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: `Schema:\n${schema}\n\nQuestion: ${question}` },
          ],
          temperature: 0.1,
          max_tokens: 512,
        }),
      });
    } catch (err) {
      return c.json({ error: 'Failed to reach Groq API', detail: err.message }, 502);
    }

    if (!groqRes.ok) {
      const errData = await groqRes.json().catch(() => ({}));
      return c.json({ error: errData?.error?.message || 'Groq request failed' }, groqRes.status);
    }
    const groqData = await groqRes.json();
    const sql = groqData.choices?.[0]?.message?.content?.trim() || '';
    if (!sql) return c.json({ error: 'Groq returned empty response' }, 502);

    if (!unlimited) {
      await incrementUserQuota(db, user.id, TEXT_TO_SQL_TOOL_ID);
      used += 1;
    }

    return c.json({
      data: { sql },
      creditsUsed:  unlimited ? null : used,
      creditsTotal: unlimited ? null : TEXT_TO_SQL_DAILY_MAX,
    });
  } catch (err) {
    console.error('[text-to-sql] Unhandled error:', err);
    return c.json({ error: 'Internal server error', detail: err.message }, 500);
  }
});

// ==========================================
// SEO AUDIT
// ==========================================

const COUNTRY_TIPS = {
  US:     ['Focus on E-E-A-T signals — Google heavily weights expertise and trust for US audiences.', 'Target featured snippets and People Also Ask boxes; US SERPs are rich-result heavy.', 'Core Web Vitals are a confirmed ranking signal — LCP under 2.5 s is the target.'],
  IN:     ['Mobile-first is critical — 75%+ of Indian traffic is mobile; test on 3G/4G conditions.', 'Consider Hindi and regional-language pages for Tier-2/3 city growth.', 'Prioritize fast hosting close to Indian data centres for low TTFB.'],
  UK:     ['Ensure GDPR/UK-GDPR cookie consent is correct — affects crawl and ad revenue.', 'Use British English spelling variants in meta tags and copy.', 'Local Business schema and Google Business Profile are strong trust signals.'],
  CA:     ['Bilingual content (English + French) gives a visibility edge in federal and Quebec searches.', 'Ensure privacy policy meets PIPEDA requirements — trust signals matter for conversions.', 'Canadian TLD (.ca) builds local trust; use hreflang if also targeting US.'],
  AU:     ['Use Australian spelling and slang in long-tail copy for natural language search.', 'Google.com.au ranks local pages higher — ensure NAP (Name, Address, Phone) consistency.', 'Page speed matters on mobile networks — optimise images and use a CDN.'],
  Global: ['Use hreflang tags to target multiple regions and avoid duplicate-content penalties.', 'Write in clear, jargon-free English — international audiences value readability.', 'Structured data helps Google surface your pages in multilingual rich results.'],
};

function letterGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 65) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

app.post('/api/seo-audit', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { websiteUrl, websiteType = 'Blog', primaryKeywords = '', targetCountry = 'US', analyticsGoals = ['Traffic'] } = body;

    if (!websiteUrl) return c.json({ error: 'websiteUrl is required' }, 400);
    let parsedUrl;
    try { parsedUrl = new URL(websiteUrl); } catch { return c.json({ error: 'Invalid URL format' }, 400); }

    // ── Fetch target page ──────────────────────────────────────────
    const fetchStart = Date.now();
    let html = '';
    let responseTime = 0;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(parsedUrl.toString(), {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MultiToolHub-SEOAuditor/1.0; +https://multitoolhub.space)', Accept: 'text/html' },
        redirect: 'follow',
      });
      clearTimeout(t);
      responseTime = Date.now() - fetchStart;
      html = await res.text();
    } catch (e) {
      return c.json({ error: `Could not fetch the URL: ${e.message}` }, 422);
    }

    // ── Probe robots.txt + sitemap.xml (best-effort) ───────────────
    let hasRobots = false, hasSitemap = false;
    try { const r = await fetch(`${parsedUrl.origin}/robots.txt`, { signal: AbortSignal.timeout(4000) }); hasRobots = r.ok; } catch {}
    try { const r = await fetch(`${parsedUrl.origin}/sitemap.xml`, { signal: AbortSignal.timeout(4000) }); hasSitemap = r.ok; } catch {}

    // ── Parse HTML ─────────────────────────────────────────────────
    const $ = cheerio.load(html);

    const title          = $('title').first().text().trim();
    const metaDesc       = $('meta[name="description"]').attr('content')?.trim() || '';
    const h1List         = $('h1').map((_, el) => $(el).text().trim()).get();
    const h2Count        = $('h2').length;
    const canonicalUrl   = $('link[rel="canonical"]').attr('href')?.trim() || '';
    const htmlLang       = $('html').attr('lang')?.trim() || '';
    const ogTitle        = $('meta[property="og:title"]').attr('content')?.trim() || '';
    const ogDesc         = $('meta[property="og:description"]').attr('content')?.trim() || '';
    const ogImage        = $('meta[property="og:image"]').attr('content')?.trim() || '';
    const twitterCard    = $('meta[name="twitter:card"]').attr('content')?.trim() || '';
    const robotsMeta     = $('meta[name="robots"]').attr('content')?.toLowerCase() || '';
    const viewport       = $('meta[name="viewport"]').attr('content') || '';
    const hasSchema      = $('script[type="application/ld+json"]').length > 0;
    const isHttps        = parsedUrl.protocol === 'https:';
    const isIndexable    = !robotsMeta.includes('noindex');

    // Images
    const totalImages     = $('img').length;
    const imagesWithAlt   = $('img[alt][alt!=""]').length;
    const altCoverage     = totalImages > 0 ? Math.round((imagesWithAlt / totalImages) * 100) : 100;

    // Links
    let internalLinks = 0, externalLinks = 0;
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (/^https?:\/\//i.test(href) && !href.includes(parsedUrl.hostname)) externalLinks++;
      else if (href && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('#') && !href.startsWith('javascript:')) internalLinks++;
    });

    // Word count
    $('script, style, noscript, head').remove();
    const bodyText  = $('body').text().replace(/\s+/g, ' ').trim();
    const wordCount = bodyText.split(/\s+/).filter(w => w.length > 2).length;

    // Keyword density
    let keywordDensity = 0;
    if (primaryKeywords && wordCount > 0) {
      const kws = primaryKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
      const textLower = bodyText.toLowerCase();
      let hits = 0;
      kws.forEach(kw => { const m = textLower.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')); if (m) hits += m.length; });
      keywordDensity = parseFloat(((hits / wordCount) * 100).toFixed(2));
    }

    const htmlSizeKB = Math.round(new TextEncoder().encode(html).length / 1024);
    const kws        = primaryKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    const kwInTitle  = kws.length > 0 && kws.some(k => title.toLowerCase().includes(k));
    const kwInDesc   = kws.length > 0 && kws.some(k => metaDesc.toLowerCase().includes(k));
    const kwInH1     = kws.length > 0 && h1List.some(h => kws.some(k => h.toLowerCase().includes(k)));

    // ── Build signals ──────────────────────────────────────────────
    const raw = [
      // ── On-Page
      { id: 'title_exists',   category: 'On-Page', name: 'Page Title',           maxScore: 10,
        ...( !title                       ? { status: 'fail', score: 0,  message: 'No <title> tag found.',                          fixTip: 'Add a descriptive <title> tag between 30–60 characters.' }
           : title.length < 20            ? { status: 'warn', score: 5,  message: `Title is too short (${title.length} chars).`,     fixTip: 'Expand the title to 30–60 characters with your primary keyword.' }
           : title.length > 65            ? { status: 'warn', score: 6,  message: `Title is too long (${title.length} chars).`,      fixTip: 'Trim the title to under 60 characters to avoid truncation in SERPs.' }
           :                               { status: 'pass', score: 10, message: `Title looks good (${title.length} chars).`,       fixTip: '' }) },

      { id: 'meta_desc',      category: 'On-Page', name: 'Meta Description',     maxScore: 10,
        ...( !metaDesc                    ? { status: 'fail', score: 0,  message: 'Meta description is missing.',                   fixTip: 'Write a compelling meta description between 120–160 characters.' }
           : metaDesc.length < 70         ? { status: 'warn', score: 5,  message: `Description is short (${metaDesc.length} chars).`, fixTip: 'Expand to 120–160 characters to maximise SERP click-through rate.' }
           : metaDesc.length > 165        ? { status: 'warn', score: 6,  message: `Description is too long (${metaDesc.length} chars).`, fixTip: 'Shorten to under 160 characters to prevent SERP truncation.' }
           :                               { status: 'pass', score: 10, message: `Meta description is ${metaDesc.length} chars.`,   fixTip: '' }) },

      { id: 'h1',             category: 'On-Page', name: 'H1 Heading',           maxScore: 8,
        ...( h1List.length === 0          ? { status: 'fail', score: 0,  message: 'No H1 tag found on the page.',                   fixTip: 'Add exactly one H1 tag containing your primary keyword.' }
           : h1List.length > 1            ? { status: 'warn', score: 4,  message: `${h1List.length} H1 tags found — use only one.`, fixTip: 'Remove duplicate H1 tags; Google prefers a single, clear H1.' }
           :                               { status: 'pass', score: 8,  message: `One H1 found: "${h1List[0]?.slice(0, 60)}".`,    fixTip: '' }) },

      { id: 'h2',             category: 'On-Page', name: 'H2 Subheadings',       maxScore: 5,
        ...( h2Count === 0                ? { status: 'warn', score: 2,  message: 'No H2 tags found.',                              fixTip: 'Use H2 tags to structure content and include secondary keywords.' }
           :                               { status: 'pass', score: 5,  message: `${h2Count} H2 headings found.`,                  fixTip: '' }) },

      { id: 'kw_title',       category: 'On-Page', name: 'Keyword in Title',     maxScore: 8,
        ...( kws.length === 0             ? { status: 'warn', score: 4,  message: 'No keywords provided to check.',                 fixTip: 'Enter primary keywords in the audit form for keyword signal checks.' }
           : kwInTitle                    ? { status: 'pass', score: 8,  message: 'Primary keyword found in title.',                fixTip: '' }
           :                               { status: 'fail', score: 0,  message: 'Primary keyword not in page title.',             fixTip: `Include "${kws[0]}" near the beginning of the <title> tag.` }) },

      { id: 'kw_desc',        category: 'On-Page', name: 'Keyword in Meta Desc', maxScore: 5,
        ...( kws.length === 0             ? { status: 'warn', score: 3,  message: 'No keywords provided to check.',                 fixTip: 'Enter primary keywords in the audit form.' }
           : kwInDesc                     ? { status: 'pass', score: 5,  message: 'Primary keyword present in meta description.',   fixTip: '' }
           :                               { status: 'warn', score: 2,  message: 'Keyword not found in meta description.',         fixTip: `Work "${kws[0]}" naturally into the meta description.` }) },

      { id: 'kw_h1',          category: 'On-Page', name: 'Keyword in H1',        maxScore: 6,
        ...( kws.length === 0             ? { status: 'warn', score: 3,  message: 'No keywords provided to check.',                 fixTip: 'Enter primary keywords in the audit form.' }
           : kwInH1                       ? { status: 'pass', score: 6,  message: 'Primary keyword found in H1.',                  fixTip: '' }
           :                               { status: 'warn', score: 2,  message: 'Keyword not found in H1 tag.',                  fixTip: `Place "${kws[0]}" in or near the H1 heading.` }) },

      // ── Content
      { id: 'word_count',     category: 'Content', name: 'Word Count',           maxScore: 8,
        ...( wordCount < 200              ? { status: 'fail', score: 0,  message: `Only ${wordCount} words found — very thin.`,     fixTip: 'Aim for at least 600 words; in-depth content ranks better.' }
           : wordCount < 500              ? { status: 'warn', score: 4,  message: `${wordCount} words — could be deeper.`,          fixTip: 'Expand to 800+ words covering subtopics thoroughly.' }
           :                               { status: 'pass', score: 8,  message: `${wordCount} words — solid content depth.`,     fixTip: '' }) },

      { id: 'kw_density',     category: 'Content', name: 'Keyword Density',      maxScore: 5,
        ...( kws.length === 0             ? { status: 'warn', score: 3,  message: 'No keywords supplied.',                          fixTip: 'Provide primary keywords for density analysis.' }
           : keywordDensity === 0         ? { status: 'warn', score: 1,  message: 'Keyword not found in body text.',                fixTip: 'Use the keyword naturally in headings, intro, and body copy.' }
           : keywordDensity > 4           ? { status: 'warn', score: 2,  message: `Keyword density is ${keywordDensity}% — may look like stuffing.`, fixTip: 'Reduce to 1–3%; use synonyms and related terms instead.' }
           :                               { status: 'pass', score: 5,  message: `Keyword density: ${keywordDensity}%.`,           fixTip: '' }) },

      { id: 'images_alt',     category: 'Content', name: 'Image Alt Text',       maxScore: 6,
        ...( totalImages === 0            ? { status: 'warn', score: 3,  message: 'No images found on the page.',                   fixTip: 'Add relevant images with descriptive alt text to improve accessibility and image SEO.' }
           : altCoverage < 60             ? { status: 'fail', score: 1,  message: `Only ${altCoverage}% of images have alt text.`,  fixTip: 'Add descriptive alt text to all images; include keywords where natural.' }
           : altCoverage < 90             ? { status: 'warn', score: 4,  message: `${altCoverage}% of images have alt text.`,       fixTip: 'Complete alt text for remaining images.' }
           :                               { status: 'pass', score: 6,  message: `${altCoverage}% alt coverage — great.`,          fixTip: '' }) },

      { id: 'internal_links', category: 'Content', name: 'Internal Links',       maxScore: 5,
        ...( internalLinks < 2            ? { status: 'fail', score: 0,  message: `Only ${internalLinks} internal link(s) found.`,  fixTip: 'Add 5+ internal links to related pages; this distributes PageRank.' }
           : internalLinks < 5            ? { status: 'warn', score: 3,  message: `${internalLinks} internal links found.`,         fixTip: 'Add more internal links to signal content depth to Google.' }
           :                               { status: 'pass', score: 5,  message: `${internalLinks} internal links found.`,         fixTip: '' }) },

      // ── Technical
      { id: 'https',          category: 'Technical', name: 'HTTPS / SSL',        maxScore: 8,
        ...( isHttps                      ? { status: 'pass', score: 8,  message: 'Site is served over HTTPS.',                     fixTip: '' }
           :                               { status: 'fail', score: 0,  message: 'Site is not using HTTPS.',                       fixTip: 'Migrate to HTTPS immediately — it is a Google ranking signal and required for trust.' }) },

      { id: 'canonical',      category: 'Technical', name: 'Canonical URL',      maxScore: 6,
        ...( canonicalUrl                 ? { status: 'pass', score: 6,  message: `Canonical set to ${canonicalUrl.slice(0, 60)}.`, fixTip: '' }
           :                               { status: 'warn', score: 2,  message: 'No canonical tag found.',                        fixTip: 'Add <link rel="canonical" href="..."> to prevent duplicate content issues.' }) },

      { id: 'robots_meta',    category: 'Technical', name: 'Indexability',        maxScore: 6,
        ...( isIndexable                  ? { status: 'pass', score: 6,  message: 'Page is indexable (no noindex directive).',      fixTip: '' }
           :                               { status: 'fail', score: 0,  message: 'Page has noindex — it will not rank.',            fixTip: 'Remove noindex from the robots meta tag if you want this page in search results.' }) },

      { id: 'viewport',       category: 'Technical', name: 'Mobile Viewport',    maxScore: 5,
        ...( viewport                     ? { status: 'pass', score: 5,  message: 'Viewport meta tag is set.',                     fixTip: '' }
           :                               { status: 'fail', score: 0,  message: 'No viewport meta tag — not mobile-friendly.',    fixTip: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.' }) },

      { id: 'schema',         category: 'Technical', name: 'Structured Data',    maxScore: 6,
        ...( hasSchema                    ? { status: 'pass', score: 6,  message: 'JSON-LD structured data detected.',              fixTip: '' }
           :                               { status: 'warn', score: 1,  message: 'No structured data (JSON-LD) found.',            fixTip: 'Add schema markup (Article, Product, FAQ, etc.) to enable rich results.' }) },

      { id: 'html_lang',      category: 'Technical', name: 'HTML Language',      maxScore: 4,
        ...( htmlLang                     ? { status: 'pass', score: 4,  message: `lang="${htmlLang}" attribute set.`,              fixTip: '' }
           :                               { status: 'warn', score: 1,  message: 'HTML lang attribute is missing.',                fixTip: 'Add lang="en" (or appropriate locale) to the <html> tag.' }) },

      { id: 'page_size',      category: 'Technical', name: 'Page Size',          maxScore: 4,
        ...( htmlSizeKB < 200             ? { status: 'pass', score: 4,  message: `HTML is ${htmlSizeKB} KB — lean.`,              fixTip: '' }
           : htmlSizeKB < 500             ? { status: 'warn', score: 2,  message: `HTML is ${htmlSizeKB} KB.`,                     fixTip: 'Reduce HTML size by minimising inline scripts and redundant code.' }
           :                               { status: 'fail', score: 0,  message: `HTML is ${htmlSizeKB} KB — very heavy.`,        fixTip: 'Inline HTML over 500 KB hurts crawl efficiency and LCP.' }) },

      // ── Social
      { id: 'og_title',       category: 'Social', name: 'OG Title',              maxScore: 4,
        ...( ogTitle                      ? { status: 'pass', score: 4,  message: 'Open Graph title is set.',                      fixTip: '' }
           :                               { status: 'warn', score: 1,  message: 'og:title meta tag is missing.',                 fixTip: 'Add <meta property="og:title"> for better social media previews.' }) },

      { id: 'og_desc',        category: 'Social', name: 'OG Description',        maxScore: 3,
        ...( ogDesc                       ? { status: 'pass', score: 3,  message: 'Open Graph description is set.',                fixTip: '' }
           :                               { status: 'warn', score: 0,  message: 'og:description is missing.',                    fixTip: 'Add <meta property="og:description"> for social sharing cards.' }) },

      { id: 'og_image',       category: 'Social', name: 'OG Image',              maxScore: 3,
        ...( ogImage                      ? { status: 'pass', score: 3,  message: 'Open Graph image is set.',                      fixTip: '' }
           :                               { status: 'warn', score: 0,  message: 'og:image is missing.',                          fixTip: 'Add a 1200×630 px og:image to maximise social click-through.' }) },

      { id: 'twitter_card',   category: 'Social', name: 'Twitter Card',          maxScore: 2,
        ...( twitterCard                  ? { status: 'pass', score: 2,  message: `twitter:card = "${twitterCard}".`,              fixTip: '' }
           :                               { status: 'warn', score: 0,  message: 'twitter:card meta tag is missing.',             fixTip: 'Add <meta name="twitter:card" content="summary_large_image">.' }) },

      // ── Crawlability
      { id: 'robots_txt',     category: 'Crawlability', name: 'Robots.txt',      maxScore: 5,
        ...( hasRobots                    ? { status: 'pass', score: 5,  message: 'robots.txt found.',                             fixTip: '' }
           :                               { status: 'warn', score: 1,  message: 'robots.txt not found at /robots.txt.',          fixTip: 'Create a robots.txt to guide crawlers and protect sensitive paths.' }) },

      { id: 'sitemap',        category: 'Crawlability', name: 'XML Sitemap',     maxScore: 5,
        ...( hasSitemap                   ? { status: 'pass', score: 5,  message: 'sitemap.xml found.',                            fixTip: '' }
           :                               { status: 'warn', score: 1,  message: 'sitemap.xml not found at /sitemap.xml.',        fixTip: 'Create and submit an XML sitemap in Google Search Console.' }) },
    ];

    // ── Score tallies ──────────────────────────────────────────────
    const totalMax   = raw.reduce((s, r) => s + r.maxScore, 0);
    const totalScore = raw.reduce((s, r) => s + r.score, 0);
    const overallScore = Math.round((totalScore / totalMax) * 100);

    const summary = {
      passed:   raw.filter(r => r.status === 'pass').length,
      warnings: raw.filter(r => r.status === 'warn').length,
      failed:   raw.filter(r => r.status === 'fail').length,
    };

    // ── Categories ─────────────────────────────────────────────────
    const catNames = ['On-Page', 'Content', 'Technical', 'Social', 'Crawlability'];
    const categories = catNames.map(name => {
      const items    = raw.filter(r => r.category === name);
      const score    = items.reduce((s, r) => s + r.score, 0);
      const maxScore = items.reduce((s, r) => s + r.maxScore, 0);
      return { name, score, maxScore, percentage: Math.round((score / maxScore) * 100) };
    });

    // ── Quick wins (fail first, then warn) ─────────────────────────
    const quickWins = raw
      .filter(r => r.status !== 'pass' && r.fixTip)
      .sort((a, b) => (a.status === 'fail' ? -1 : 1) - (b.status === 'fail' ? -1 : 1))
      .slice(0, 6)
      .map(r => ({ id: r.id, name: r.name, fixTip: r.fixTip, priority: r.status === 'fail' ? 'high' : 'medium' }));

    // ── Strengths ──────────────────────────────────────────────────
    const strengths = raw
      .filter(r => r.status === 'pass')
      .slice(0, 5)
      .map(r => ({ id: r.id, name: r.name, message: r.message }));

    return c.json({
      data: {
        overallScore,
        letterGrade: letterGrade(overallScore),
        summary,
        inputContext: { targetCountry, analyticsGoals },
        signals: raw,
        quickWins,
        strengths,
        countryPlaybook: COUNTRY_TIPS[targetCountry] || COUNTRY_TIPS.Global,
        metrics: {
          titleLength: title.length,
          metaDescriptionLength: metaDesc.length,
          wordCount,
          keywordDensity,
          altCoverage,
          internalLinks,
          externalLinks,
          responseTime,
          htmlSizeKB,
        },
        categories,
        crawl: { hasRobots, hasSitemap, isIndexable, htmlLang, canonicalUrl },
      },
    });
  } catch (err) {
    console.error('[seo-audit]', err);
    return c.json({ error: 'Internal server error', detail: err.message }, 500);
  }
});

// ==========================================
// TRANSCRIPTION ROUTES
// ==========================================

const TRANSCRIBE_TOOL_ID  = 'transcription';
const TRANSCRIBE_DAILY_MAX = 10;

app.get('/api/transcribe/credits', requireAuth, async (c) => {
  const db   = getDb(c.env);
  const user = c.get('user');
  if (hasUnlimitedCredits(user, TRANSCRIBE_TOOL_ID)) {
    return c.json({ data: { creditsUsed: 0, creditsRemaining: 9999, creditsTotal: 9999, unlimited: true } }, 200);
  }
  const used      = await checkUserQuota(db, user.id, TRANSCRIBE_TOOL_ID);
  const remaining = Math.max(0, TRANSCRIBE_DAILY_MAX - used);
  return c.json(
    { data: { creditsUsed: used, creditsRemaining: remaining, creditsTotal: TRANSCRIBE_DAILY_MAX } },
    200,
    { 'Cache-Control': 'private, max-age=30' },
  );
});

const LANGUAGE_CODES = {
  english: 'en', spanish: 'es', french: 'fr', german: 'de', italian: 'it',
  portuguese: 'pt', dutch: 'nl', russian: 'ru', japanese: 'ja', korean: 'ko',
  chinese: 'zh', arabic: 'ar', hindi: 'hi', turkish: 'tr', polish: 'pl',
  swedish: 'sv', norwegian: 'no', danish: 'da', finnish: 'fi', ukrainian: 'uk',
};

app.post('/api/transcribe', requireAuth, async (c) => {
  const db   = getDb(c.env);
  const user = c.get('user');

  let formData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: 'Invalid form data' }, 400);
  }

  const userGroqKey = (formData.get('groqApiKey') || '').trim();
  const groqKey     = (userGroqKey || (c.env.GROQ_API_KEY ?? '')).trim();
  const usingOwnKey = !!userGroqKey;
  // firstChunk=false means this is a subsequent chunk of a chunked upload.
  // Only the first chunk counts against the daily quota so a 1-hour file
  // split into 15 chunks still uses exactly 1 credit.
  const isFirstChunk = formData.get('firstChunk') !== 'false';

  if (!groqKey) return c.json({ error: 'Groq API key not configured' }, 500);

  // Unlimited/free-tier accounts skip quota logic
  const unlimited = hasUnlimitedCredits(user, TRANSCRIBE_TOOL_ID);

  // Quota check only on first chunk (or non-chunked requests)
  let used = 0;
  if (!unlimited && !usingOwnKey && isFirstChunk) {
    used = await checkUserQuota(db, user.id, TRANSCRIBE_TOOL_ID);
    if (used >= TRANSCRIBE_DAILY_MAX) {
      return c.json({ error: 'Daily transcription limit reached. Resets at midnight.' }, 429);
    }
  } else if (!unlimited && !usingOwnKey) {
    // Non-first chunks: fetch current count so the response carries accurate data
    used = await checkUserQuota(db, user.id, TRANSCRIBE_TOOL_ID);
  }

  const file           = formData.get('file');
  const outputLanguage = formData.get('outputLanguage') || 'english';
  const model          = formData.get('model') || 'whisper-large-v3-turbo';
  const wantTimestamps = formData.get('timestamps') === 'true';

  if (!file || typeof file === 'string') {
    return c.json({ error: 'Audio file required' }, 400);
  }
  if (file.size > 25 * 1024 * 1024) {
    return c.json({ error: 'File too large — Groq limit is 25 MB' }, 413);
  }

  try {
    // Buffer the file fully — Cloudflare Workers can drop File streams when
    // the body is forwarded to an outbound fetch without materialising first.
    const fileBytes = await file.arrayBuffer();
    const fileBlob  = new Blob([fileBytes], { type: file.type || 'audio/mpeg' });

    const groqForm = new FormData();
    groqForm.append('file', fileBlob, file.name || 'audio.mp3');
    groqForm.append('model', model);
    groqForm.append('response_format', wantTimestamps ? 'verbose_json' : 'json');
    const langCode = LANGUAGE_CODES[outputLanguage];
    if (langCode) groqForm.append('language', langCode);

    let groqRes;
    try {
      groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method:  'POST',
        headers: { Authorization: `Bearer ${groqKey}` },
        body:    groqForm,
      });
    } catch (err) {
      return c.json({ error: 'Failed to reach Groq API', detail: err.message }, 502);
    }

    const groqData = await groqRes.json();
    if (!groqRes.ok) {
      const msg = groqData?.error?.message || 'Groq transcription failed';
      return c.json({ error: msg }, groqRes.status);
    }

    if (!unlimited && !usingOwnKey && isFirstChunk) {
      await incrementUserQuota(db, user.id, TRANSCRIBE_TOOL_ID);
      used += 1;
    }

    return c.json({
      data: {
        transcript: groqData.text || '',
        ...(wantTimestamps && groqData.segments ? { segments: groqData.segments } : {}),
      },
      creditsUsed:  (unlimited || usingOwnKey) ? null : used,
      creditsTotal: (unlimited || usingOwnKey) ? null : TRANSCRIBE_DAILY_MAX,
      usingOwnKey,
    });
  } catch (err) {
    console.error('[transcribe]', err);
    return c.json({ error: 'Internal server error', detail: err.message }, 500);
  }
});

// ==========================================
// GROQ CHAT PROXY (used by speaker diarization)
// ==========================================

app.post('/api/groq/chat', requireAuth, async (c) => {
  let body = {};
  try { body = await c.req.json(); } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const userGroqKey = (body.groqApiKey || '').trim();
  const groqKey     = userGroqKey || c.env.GROQ_API_KEY;
  if (!groqKey) return c.json({ error: 'Groq API key not configured' }, 500);

  // Remove our custom field before forwarding to Groq
  const { groqApiKey: _removed, ...groqBody } = body;

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(groqBody),
  });

  const data = await groqRes.json();
  if (!groqRes.ok) return c.json({ error: data?.error?.message || 'Groq chat failed' }, groqRes.status);
  return c.json(data);
});

// Debug endpoint — shows exactly what the worker sees on every request
app.get('/api/debug', (c) => {
  const origin = c.req.header('Origin') || '(none)';
  const headers = {};
  c.req.raw.headers.forEach((v, k) => { headers[k] = v; });
  return c.json({
    ok: true,
    receivedOrigin: origin,
    originAllowed: ALLOWED_ORIGINS.includes(origin),
    allowedOrigins: ALLOWED_ORIGINS,
    method: c.req.method,
    url: c.req.url,
    headers,
    hasDb: !!c.env.multitool_db,
    hasJwt: !!c.env.JWT_SECRET,
    hasYoutubeServiceUrl: !!getYtServiceUrl(c),
  });
});

// Admin endpoints
const ADMIN_EMAILS = new Set(['afrosem36@gmail.com']);

function isAdmin(user) {
  const email = (user?.email ?? '').toLowerCase().trim();
  return ADMIN_EMAILS.has(email);
}

// GET /api/admin/users - List all users
app.get('/api/admin/users', requireAuth, async (c) => {
  const db = getDb(c.env);
  const user = c.get('user');

  if (!isAdmin(user)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    // Try to fetch with oauth_provider, fallback if column doesn't exist
    let users;
    try {
      users = await db.prepare(`
        SELECT u.id, u.name, u.email, u.password_hash, u.created_at, u.oauth_provider
        FROM users u
        ORDER BY u.created_at DESC
      `).all();
    } catch (err) {
      console.warn('oauth_provider column might not exist, fetching without it:', err.message);
      // Fallback query without oauth_provider column
      users = await db.prepare(`
        SELECT u.id, u.name, u.email, u.password_hash, u.created_at, NULL as oauth_provider
        FROM users u
        ORDER BY u.created_at DESC
      `).all();
    }

    const usersWithQuota = await Promise.all((users.results || []).map(async (u) => {
      const today = getTodayUtcDate();
      const quotaData = await db.prepare(`
        SELECT COUNT(*) as total_quota FROM tool_quotas WHERE user_id = ? AND date = ?
      `).bind(u.id, today).first();

      return {
        id: u.id,
        name: u.name || 'N/A',
        email: u.email,
        loginType: u.oauth_provider || 'email',
        todayQuota: quotaData?.total_quota || 0,
        createdAt: u.created_at,
      };
    }));

    return c.json({ data: usersWithQuota });
  } catch (err) {
    console.error('Admin: Failed to fetch users:', err);
    return c.json({ error: 'Failed to fetch users: ' + err.message }, 500);
  }
});

// DELETE /api/admin/users/:id - Delete user and all their data
app.delete('/api/admin/users/:id', requireAuth, async (c) => {
  const db = getDb(c.env);
  const user = c.get('user');
  const userId = c.req.param('id');

  if (!isAdmin(user)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  if (!userId) {
    return c.json({ error: 'User ID required' }, 400);
  }

  try {
    // 1. Delete IDE projects
    await db.prepare('DELETE FROM ide_projects WHERE user_id = ?').bind(userId).run();

    // 2. Delete deployments (HTML IDE projects)
    await db.prepare('DELETE FROM deployments WHERE user_id = ?').bind(userId).run();

    // 3. Delete tool quotas (credits usage)
    await db.prepare('DELETE FROM tool_quotas WHERE user_id = ?').bind(userId).run();

    // 4. Delete form submissions
    await db.prepare('DELETE FROM form_submissions WHERE user_id = ?').bind(userId).run();

    // 5. Delete user record
    await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();

    return c.json({
      ok: true,
      message: `User ${userId} and all associated data (projects, deployments, submissions, credits history) permanently deleted`
    });
  } catch (err) {
    console.error('Admin: Failed to delete user:', err);
    return c.json({ error: 'Failed to delete user: ' + err.message }, 500);
  }
});

// POST /api/admin/users/:id/reset-credits - Reset user credits (delete today's quota)
app.post('/api/admin/users/:id/reset-credits', requireAuth, async (c) => {
  const db = getDb(c.env);
  const user = c.get('user');
  const userId = c.req.param('id');

  if (!isAdmin(user)) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  if (!userId) {
    return c.json({ error: 'User ID required' }, 400);
  }

  try {
    const today = getTodayUtcDate();

    // Delete today's quota for this user (resets their credits)
    await db.prepare(`
      DELETE FROM tool_quotas WHERE user_id = ? AND date = ?
    `).bind(userId, today).run();

    return c.json({ ok: true, message: `Credits reset for user ${userId}` });
  } catch (err) {
    console.error('Admin: Failed to reset credits:', err);
    return c.json({ error: 'Failed to reset credits' }, 500);
  }
});

// ==========================================
// ADMIN — AI STATUS & CREDIT MONITOR
// ==========================================

app.get('/api/admin/ai-status', requireAuth, async (c) => {
  const user = c.get('user');
  if (!isAdmin(user)) return c.json({ error: 'Admin access required' }, 403);

  const geminiKey = c.env.GEMINI_API_KEY;
  const groqKey   = c.env.GROQ_API_KEY   || null;
  const openaiKey = c.env.OPENAI_API_KEY || null;

  const checkedAt = new Date().toISOString();

  // Parallel health pings (7 s timeout each)
  const pingOne = async (url, headers, body) => {
    const detail = { checkedAt, latencyMs: null, errorMsg: null };
    const t0 = Date.now();
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 7000);
      const resp  = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
      clearTimeout(timer);
      detail.latencyMs = Date.now() - t0;
      if (resp.status === 429) { detail.status = 'rate_limited'; detail.errorMsg = 'Rate limit reached (429)'; }
      else if (resp.ok)         { detail.status = 'ok'; }
      else                      { detail.status = 'error'; detail.errorMsg = `HTTP ${resp.status}`; }
    } catch (err) {
      detail.latencyMs = Date.now() - t0;
      detail.status    = 'error';
      detail.errorMsg  = err.name === 'AbortError' ? 'Timeout (7 s)' : err.message;
    }
    return detail;
  };

  const [groqResult, geminiResult, openaiResult] = await Promise.all([
    groqKey
      ? pingOne('https://api.groq.com/openai/v1/chat/completions',
          { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
          { model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: 'hi' }], max_tokens: 3 })
      : { status: 'no_key', checkedAt, latencyMs: null, errorMsg: 'GROQ_API_KEY not set' },

    geminiKey
      ? pingOne(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${geminiKey}`,
          { 'Content-Type': 'application/json' },
          { contents: [{ parts: [{ text: 'hi' }] }], generationConfig: { maxOutputTokens: 3 } })
      : { status: 'no_key', checkedAt, latencyMs: null, errorMsg: 'GEMINI_API_KEY not set' },

    openaiKey
      ? pingOne('https://api.openai.com/v1/chat/completions',
          { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
          { model: 'gpt-4.1-mini', messages: [{ role: 'user', content: 'hi' }], max_tokens: 3 })
      : { status: 'no_key', checkedAt, latencyMs: null, errorMsg: 'OPENAI_API_KEY not set' },
  ]);

  // Credit usage from D1
  const db    = getDb(c.env);
  const today = getTodayUtcDate();
  const thisMonth = today.slice(0, 7); // "YYYY-MM"

  // Week start = 6 days ago (last 7 days rolling)
  const weekStart = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 6);
    return d.toISOString().slice(0, 10);
  })();

  let todayUsage = [], weekUsage = [], monthUsage = [];
  let providerToday = {}, providerWeek = {}, providerMonth = {};
  try {
    // Per-tool usage (all users)
    const todayRows = await db.prepare(
      `SELECT tool_id, SUM(count) AS total FROM tool_quotas WHERE date = ? AND user_id != '__system__' GROUP BY tool_id`
    ).bind(today).all();
    todayUsage = todayRows.results || [];

    const weekRows = await db.prepare(
      `SELECT tool_id, SUM(count) AS total FROM tool_quotas WHERE date >= ? AND user_id != '__system__' GROUP BY tool_id`
    ).bind(weekStart).all();
    weekUsage = weekRows.results || [];

    const monthRows = await db.prepare(
      `SELECT tool_id, SUM(count) AS total FROM tool_quotas WHERE date LIKE ? AND user_id != '__system__' GROUP BY tool_id`
    ).bind(`${thisMonth}%`).all();
    monthUsage = monthRows.results || [];

    // Per-provider usage (system-level tracking from AI calls)
    const pTodayRows = await db.prepare(
      `SELECT tool_id, SUM(count) AS total FROM tool_quotas WHERE user_id = '__system__' AND date = ? GROUP BY tool_id`
    ).bind(today).all();
    providerToday = Object.fromEntries((pTodayRows.results || []).map(r => [r.tool_id.replace('ai-', ''), Number(r.total)]));

    const pWeekRows = await db.prepare(
      `SELECT tool_id, SUM(count) AS total FROM tool_quotas WHERE user_id = '__system__' AND date >= ? GROUP BY tool_id`
    ).bind(weekStart).all();
    providerWeek = Object.fromEntries((pWeekRows.results || []).map(r => [r.tool_id.replace('ai-', ''), Number(r.total)]));

    const pMonthRows = await db.prepare(
      `SELECT tool_id, SUM(count) AS total FROM tool_quotas WHERE user_id = '__system__' AND date LIKE ? GROUP BY tool_id`
    ).bind(`${thisMonth}%`).all();
    providerMonth = Object.fromEntries((pMonthRows.results || []).map(r => [r.tool_id.replace('ai-', ''), Number(r.total)]));

  } catch (dbErr) {
    console.error('Admin AI status: DB query failed', dbErr.message);
  }

  const TOOL_LIMITS = {
    'text-to-sql':    { daily: 20,  label: 'Text-to-SQL',       provider: 'groq'   },
    'transcription':  { daily: 10,  label: 'Audio Transcription', provider: 'groq'  },
  };

  return c.json({
    success:   true,
    checkedAt,
    providers: [
      {
        key: 'groq', name: 'Groq', model: 'whisper-large-v3-turbo / llama-3.3-70b',
        role: 'Audio Transcription + Text-to-SQL',
        priority: 1,
        ...groqResult,
      },
      {
        key: 'gemini', name: 'Gemini 3.1 Flash Lite', model: 'gemini-3.1-flash-lite',
        role: 'General AI — 2nd fallback',
        priority: 2,
        ...geminiResult,
      },
      {
        key: 'openai', name: 'OpenAI', model: 'gpt-4.1-mini',
        role: 'General AI — 3rd fallback',
        priority: 3,
        ...openaiResult,
      },
    ],
    credits: {
      today:         todayUsage,
      week:          weekUsage,
      month:         monthUsage,
      providerToday: providerToday,
      providerWeek:  providerWeek,
      providerMonth: providerMonth,
      limits:        TOOL_LIMITS,
      resetDate:     `${today}T00:00:00Z`,
      weekStart,
    },
    flow: {
      general:       ['gemini', 'openai', 'groq'],
      textToSql:     ['groq'],
      transcription: ['groq'],
    },
  });
});

// ==========================================
// AI DASHBOARD PLAN
// ==========================================

function dashLog(level, tag, ...args) {
  const prefix = `[dashboard][${tag}]`;
  if (level === 'error') console.error(prefix, ...args);
  else console.log(prefix, ...args);
}

// Robust JSON extractor: handles markdown fences, leading text, truncated output
function extractDashboardJSON(raw) {
  if (!raw || typeof raw !== 'string') return null;

  // 1. Direct parse
  try { return JSON.parse(raw.trim()); } catch {}

  // 2. Strip markdown fences
  let s = raw
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim();
  try { return JSON.parse(s); } catch {}

  // 3. Extract outermost { } block
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(s.slice(start, end + 1)); } catch {}
  }

  return null;
}

// Gemini call with timeout + retry + thinking disabled
async function callGeminiDashboard(prompt, apiKey, opts = {}) {
  const { maxRetries = 2, timeoutMs = 20000 } = opts;
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

  const reqBody = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 }, // Disable thinking — prevents 30s+ timeout
    },
  });

  let lastErr = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s
      dashLog('info', 'retry', `attempt ${attempt + 1}, waiting ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      dashLog('info', 'gemini_call', `attempt=${attempt + 1}, promptLen=${prompt.length}`);
      const t0 = Date.now();

      const resp = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: reqBody,
        signal: controller.signal,
      });
      clearTimeout(timer);

      dashLog('info', 'gemini_status', `status=${resp.status}, elapsed=${Date.now() - t0}ms`);

      if (resp.status === 429) {
        const raw = await resp.text();
        const retryAfter = parseInt(resp.headers.get('Retry-After') || '10', 10);
        dashLog('error', 'rate_limit', `429 rate limited, retryAfter=${retryAfter}s`, raw.slice(0, 200));
        lastErr = { code: 'RATE_LIMITED', status: 429, retryAfter };
        if (attempt < maxRetries) await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (!resp.ok) {
        const errText = await resp.text();
        dashLog('error', 'gemini_error', `status=${resp.status}`, errText.slice(0, 300));
        lastErr = { code: 'API_ERROR', status: resp.status, detail: errText.slice(0, 300) };
        continue;
      }

      const json = await resp.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      dashLog('info', 'gemini_ok', `responseLen=${rawText.length}, preview=${rawText.slice(0, 120)}`);

      if (!rawText) {
        const reason = json?.candidates?.[0]?.finishReason || 'unknown';
        dashLog('error', 'empty_response', `finishReason=${reason}`);
        lastErr = { code: 'EMPTY_RESPONSE', detail: `finishReason=${reason}` };
        continue;
      }

      return { ok: true, text: rawText };
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        dashLog('error', 'timeout', `attempt ${attempt + 1} timed out after ${timeoutMs}ms`);
        lastErr = { code: 'TIMEOUT', message: `Gemini request timed out after ${timeoutMs}ms` };
      } else {
        dashLog('error', 'fetch_error', err.message);
        lastErr = { code: 'FETCH_ERROR', message: err.message };
      }
    }
  }

  return { ok: false, error: lastErr };
}

// Groq preprocessing: fast title + column label generation (5 s, best-effort)
async function callGroqPreprocess(colContext, apiKey, opts = {}) {
  const { timeoutMs = 5000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{
          role: 'user',
          content: `Given these dataset columns: ${colContext}\n\nReturn ONLY valid JSON (no markdown) with this schema:\n{"dashboardTitle":"string","subtitle":"string","columnLabels":{"colName":"friendly label"}}`,
        }],
        temperature: 0.2,
        max_tokens: 250,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content || '';
    return extractDashboardJSON(raw);
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// Groq full-plan fallback: called only when Gemini fails entirely
async function callGroqFullPlan(prompt, apiKey, opts = {}) {
  const { timeoutMs = 15000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ─── Centralized AI Provider (Gemini → OpenAI gpt-4.1-mini fallback) ─────────

async function callGeminiChat(messages, apiKey, opts = {}) {
  const { maxTokens = 2048, temperature = 0.3, timeoutMs = 18000 } = opts;
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

  const systemMsg = messages.find(m => m.role === 'system');
  const chatMsgs  = messages.filter(m => m.role !== 'system');

  const contents = chatMsgs.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content || '') }],
  }));

  const reqBody = {
    contents,
    generationConfig: { temperature, maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } },
  };
  if (systemMsg) reqBody.systemInstruction = { parts: [{ text: systemMsg.content }] };

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(GEMINI_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody), signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (resp.status === 429) return { ok: false, code: 'RATE_LIMITED' };
    if (!resp.ok)            return { ok: false, code: 'API_ERROR' };
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) return { ok: false, code: 'EMPTY_RESPONSE' };
    return { ok: true, text };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, code: err.name === 'AbortError' ? 'TIMEOUT' : 'FETCH_ERROR' };
  }
}

async function callOpenAIChat(messages, apiKey, opts = {}) {
  const { maxTokens = 2048, temperature = 0.3, timeoutMs = 18000 } = opts;
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4.1-mini', messages, temperature, max_tokens: maxTokens }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (resp.status === 429) return { ok: false, code: 'RATE_LIMITED' };
    if (!resp.ok)            return { ok: false, code: 'API_ERROR' };
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || '';
    if (!text) return { ok: false, code: 'EMPTY_RESPONSE' };
    return { ok: true, text };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, code: err.name === 'AbortError' ? 'TIMEOUT' : 'FETCH_ERROR' };
  }
}

// Groq llama-3.3-70b chat — generic chat (third-tier fallback)
async function callGroqChat(messages, apiKey, opts = {}) {
  const { maxTokens = 2048, temperature = 0.3, timeoutMs = 15000 } = opts;
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, temperature, max_tokens: maxTokens }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (resp.status === 429) return { ok: false, code: 'RATE_LIMITED' };
    if (!resp.ok)            return { ok: false, code: 'API_ERROR' };
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || '';
    if (!text) return { ok: false, code: 'EMPTY_RESPONSE' };
    return { ok: true, text };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, code: err.name === 'AbortError' ? 'TIMEOUT' : 'FETCH_ERROR' };
  }
}

// Gemini → OpenAI → Groq fallback chain (server-side)
// disabledProviders: string[] — keys to skip (e.g. ['gemini', 'openai', 'groq'])
async function callAIProvider(messages, env, opts = {}) {
  const geminiKey = env.GEMINI_API_KEY;
  const openaiKey = env.OPENAI_API_KEY;
  const groqKey   = env.GROQ_API_KEY;
  const disabled  = Array.isArray(opts.disabledProviders) ? opts.disabledProviders : [];

  if (geminiKey && !disabled.includes('gemini')) {
    const r = await callGeminiChat(messages, geminiKey, opts);
    if (r.ok) return { text: r.text, source: 'gemini' };
    dashLog('warn', 'gemini_chat_failed', r.code);
  } else if (disabled.includes('gemini')) {
    dashLog('info', 'gemini_skipped', 'disabled by admin');
  }

  if (openaiKey && !disabled.includes('openai')) {
    const r = await callOpenAIChat(messages, openaiKey, opts);
    if (r.ok) return { text: r.text, source: 'openai' };
    dashLog('warn', 'openai_chat_failed', r.code);
  } else if (disabled.includes('openai')) {
    dashLog('info', 'openai_skipped', 'disabled by admin');
  }

  if (groqKey && !disabled.includes('groq')) {
    const r = await callGroqChat(messages, groqKey, opts);
    if (r.ok) return { text: r.text, source: 'groq' };
    dashLog('warn', 'groq_chat_failed', r.code);
  } else if (disabled.includes('groq')) {
    dashLog('info', 'groq_skipped', 'disabled by admin');
  }

  return { text: null, source: null, error: 'All AI providers exhausted or disabled' };
}

// ─── AI Health Check ──────────────────────────────────────────────────────────
app.get('/api/ai/health', async (c) => {
  const geminiKey = c.env.GEMINI_API_KEY;
  const groqKey   = c.env.GROQ_API_KEY   || null;
  const openaiKey = c.env.OPENAI_API_KEY || null;

  const results = { groq: 'no_key', gemini: 'no_key', openai: 'no_key' };

  const ping = async (url, headers, body, timeoutMs = 7000) => {
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const resp  = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
      clearTimeout(timer);
      return resp.ok ? 'ok' : (resp.status === 429 ? 'rate_limited' : 'error');
    } catch { return 'error'; }
  };

  if (groqKey) results.groq = await ping(
    'https://api.groq.com/openai/v1/chat/completions',
    { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
    { model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: 'hi' }], max_tokens: 3 }
  );

  if (geminiKey) results.gemini = await ping(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${geminiKey}`,
    { 'Content-Type': 'application/json' },
    { contents: [{ parts: [{ text: 'hi' }] }], generationConfig: { maxOutputTokens: 3 } }
  );

  if (openaiKey) results.openai = await ping(
    'https://api.openai.com/v1/chat/completions',
    { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    { model: 'gpt-4.1-mini', messages: [{ role: 'user', content: 'hi' }], max_tokens: 3 }
  );

  return c.json({ success: true, ...results });
});

// ─── Medical / General Report Analyzer (Gemini vision → OpenAI vision) ───────
app.post('/api/analyze-report', async (c) => {
  let body;
  try { body = await c.req.json(); } catch {
    return c.json({ success: false, error: 'Invalid JSON' }, 400);
  }

  const { base64, mimeType, reportType = 'medical', disabledProviders = [] } = body || {};
  if (!base64 || !mimeType) {
    return c.json({ success: false, error: 'base64 and mimeType are required' }, 400);
  }

  const prompt = `You are a medical report analysis expert. Analyze this ${reportType === 'blood' ? 'blood test' : 'medical'} report image and provide a structured analysis.

Return ONLY valid JSON in this exact format:
{
  "summary": "2-3 sentence overall health summary",
  "keyFindings": ["Finding 1 with value", "Finding 2 with value", "...up to 8 findings"],
  "tips": ["Actionable tip 1", "Actionable tip 2", "...up to 7 tips"]
}

Focus on:
- Identifying abnormal values and what they mean
- Providing clear, patient-friendly explanations
- Giving practical, actionable health tips
- Being encouraging but medically accurate`;

  const geminiKey = c.env.GEMINI_API_KEY;
  const openaiKey = c.env.OPENAI_API_KEY;
  let analysisText = null;
  let source = null;

  // ── 1. Try Gemini (supports images + PDFs natively) ───────────────────────
  if (geminiKey && !disabledProviders.includes('gemini')) {
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000);
      const res   = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${geminiKey}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          signal:  ctrl.signal,
          body: JSON.stringify({
            contents: [{ parts: [
              { inline_data: { mime_type: mimeType, data: base64 } },
              { text: prompt }
            ]}],
            generationConfig: { maxOutputTokens: 1024, temperature: 0.2 },
          }),
        }
      );
      clearTimeout(timer);
      if (res.ok) {
        const d = await res.json();
        analysisText = d?.candidates?.[0]?.content?.parts?.[0]?.text || null;
        if (analysisText) source = 'gemini';
      }
    } catch { /* fall through */ }
  }

  // ── 2. Fallback: OpenAI vision (images only — PDFs not supported) ──────────
  if (!analysisText && openaiKey && !disabledProviders.includes('openai') && !mimeType.includes('pdf')) {
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000);
      const res   = await fetch('https://api.openai.com/v1/chat/completions', {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        signal:  ctrl.signal,
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
              { type: 'text', text: prompt },
            ],
          }],
          max_tokens: 1024,
        }),
      });
      clearTimeout(timer);
      if (res.ok) {
        const d = await res.json();
        analysisText = d?.choices?.[0]?.message?.content || null;
        if (analysisText) source = 'openai';
      }
    } catch { /* fall through */ }
  }

  if (!analysisText) {
    return c.json({ success: false, error: 'All AI providers failed or are disabled' }, 502);
  }

  // Parse the JSON response
  try {
    const match = analysisText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON found');
    const parsed = JSON.parse(match[0]);
    return c.json({ success: true, data: parsed, source });
  } catch {
    // If JSON parse fails, return raw text shaped into the expected structure
    return c.json({
      success: true,
      source,
      data: {
        summary: analysisText.slice(0, 500),
        keyFindings: [],
        tips: [],
      },
    });
  }
});

// ─── General AI Generate (Gemini → OpenAI fallback) ───────────────────────────
app.post('/api/ai/generate', async (c) => {
  let body;
  try { body = await c.req.json(); } catch {
    return c.json({ success: false, error: 'Invalid JSON' }, 400);
  }

  const { messages, systemPrompt, disabledProviders } = body || {};
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return c.json({ success: false, error: 'messages[] is required' }, 400);
  }

  const fullMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;

  const result = await callAIProvider(fullMessages, c.env, {
    maxTokens: 4096, temperature: 0.3,
    disabledProviders: Array.isArray(disabledProviders) ? disabledProviders : [],
  });

  if (!result.text) {
    return c.json({ success: false, error: result.error || 'All AI providers failed' }, 502);
  }

  // Track which provider served this request (non-blocking, system-level)
  if (result.source) {
    try { await incrementUserQuota(getDb(c.env), '__system__', `ai-${result.source}`); } catch {}
  }

  return c.json({ success: true, text: result.text, source: result.source });
});

app.post('/api/ai/dashboard-plan', async (c) => {
  const t0 = Date.now();
  dashLog('info', 'request', 'POST /api/ai/dashboard-plan');

  // ── 1. Parse body ─────────────────────────────────────────────────────────
  let body;
  try {
    body = await c.req.json();
  } catch {
    dashLog('error', 'parse_body', 'Invalid JSON body');
    return c.json({ success: false, error: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400);
  }

  const { headers, sampleRows, columnTypes, columnSemantics, userPrompt, helperText, rowCount, disabledProviders } = body || {};
  const dashDisabled = Array.isArray(disabledProviders) ? disabledProviders : [];

  // ── 2. Validate ───────────────────────────────────────────────────────────
  if (!headers || !Array.isArray(headers) || headers.length === 0) {
    return c.json({ success: false, error: 'headers[] is required', code: 'MISSING_HEADERS' }, 400);
  }
  if (!sampleRows || !Array.isArray(sampleRows)) {
    return c.json({ success: false, error: 'sampleRows[] is required', code: 'MISSING_ROWS' }, 400);
  }
  if (headers.length > 100) {
    return c.json({ success: false, error: 'Too many columns (max 100)', code: 'TOO_MANY_COLUMNS' }, 400);
  }

  const safe = {
    headers,
    sampleRows: sampleRows.slice(0, 10),       // hard cap — never send full data
    columnTypes: columnTypes || {},
    columnSemantics: columnSemantics || {},
    userPrompt: (userPrompt || '').slice(0, 500),
    helperText: (helperText || '').slice(0, 500),
    rowCount: rowCount || sampleRows.length,
  };

  const payloadSize = JSON.stringify(safe).length;
  if (payloadSize > 60000) {
    dashLog('error', 'payload_size', `${payloadSize} bytes — too large`);
    return c.json({ success: false, error: 'Payload too large. Send only column metadata.', code: 'PAYLOAD_TOO_LARGE' }, 413);
  }

  dashLog('info', 'validate', `cols=${safe.headers.length}, rows=${safe.sampleRows.length}, totalRows=${safe.rowCount}, bytes=${payloadSize}`);

  // ── 3. API keys ───────────────────────────────────────────────────────────
  const geminiKey = c.env.GEMINI_API_KEY;
  const groqKey   = c.env.GROQ_API_KEY || null;

  const openaiKeyAvail = !!c.env.OPENAI_API_KEY;
  if (!geminiKey && !openaiKeyAvail) {
    dashLog('error', 'config', 'No AI keys configured');
    return c.json({ success: false, error: 'AI service not configured', code: 'NO_API_KEY' }, 500);
  }

  // ── 3.5 Groq preprocessing (non-blocking, 5 s, best-effort) ──────────────
  let groqMeta = null;
  if (groqKey) {
    const colContext = safe.headers
      .map(h => `${h}(${safe.columnSemantics[h] || safe.columnTypes[h] || 'unknown'})`)
      .join(', ');
    groqMeta = await callGroqPreprocess(colContext, groqKey, { timeoutMs: 5000 });
    dashLog('info', 'groq_preprocess', groqMeta ? 'ok' : 'skipped/failed');
  }

  // ── 4. Build compact prompt ───────────────────────────────────────────────
  const colLines = safe.headers.map(h => {
    const semantic = safe.columnSemantics[h];
    const type     = safe.columnTypes[h] || 'unknown';
    const label    = groqMeta?.columnLabels?.[h] ? ` [${groqMeta.columnLabels[h]}]` : '';
    return `  - "${h}"${label} (${semantic || type})`;
  }).join('\n');

  const groqCtx = groqMeta
    ? `\nSUGGESTED_TITLE: "${groqMeta.dashboardTitle || ''}"\nSUGGESTED_SUBTITLE: "${groqMeta.subtitle || ''}"`
    : '';

  const prompt = `You are a senior BI dashboard designer (Power BI / Tableau style). Design a MULTI-TAB professional dashboard for this dataset.

DATASET:
- Total rows: ${safe.rowCount}
- Columns:\n${colLines}
- Sample data (first ${safe.sampleRows.length} rows): ${JSON.stringify(safe.sampleRows)}
USER_REQUEST: ${safe.userPrompt || 'Auto-generate the best dashboard'}
COLUMN_NOTES: ${safe.helperText || 'None'}${groqCtx}

Return valid JSON only — no markdown, no explanation — using this exact schema:
{
  "title": "Dashboard title",
  "subtitle": "One-line description",
  "domain": "sales_crm|finance|hr_payroll|ecommerce|logistics|healthcare|education|real_estate|telecom|support|calls|generic",
  "insights": ["overall observation 1", "observation 2", "observation 3"],
  "summary": "1-2 sentence executive summary",
  "tabs": [
    {
      "id": "overview",
      "title": "Overview",
      "description": "What this tab shows",
      "summary": "1-sentence purpose of this tab",
      "insights": ["tab-specific finding 1", "finding 2"],
      "charts": [
        {
          "type": "bar|line|area|pie|hbar",
          "title": "Chart title",
          "description": "What this chart shows",
          "xCol": "exact column name",
          "yCol": "exact numeric column name or null for count charts",
          "aggregation": "sum|count|avg",
          "timeSeries": false,
          "timeGroupBy": "month|week|day",
          "limit": 15,
          "width": "full|half"
        }
      ]
    }
  ]
}

DESIGN RULES:
- Produce 4–7 tabs that tell a complete business story. Pick from common BI patterns based on the actual columns:
  Sales/CRM   → Overview, Agent Performance, Category, Trend, Forecast, Status, Insights
  Support     → Overview, Ticket Status, Agent Performance, TAT/SLA, Issue Category, Risk, Insights
  Calls       → Overview, Agent Calling, Answered vs Unanswered, Duration, Trend, Low Performance, Insights
  Finance     → Overview, Financial View, Category, Trend, Forecast, Risk, Insights
  HR/Payroll  → Overview, Employee, Department, Compensation, Tenure, Insights
  Logistics   → Overview, Status, Duration/TAT, Agent, Trend, Risk, Insights
  Generic     → Overview, Category, Agent, Status, Trend, Forecast, Insights
- Each tab should have 2–4 meaningful charts (not just 1).
- Add a "forecast" tab ONLY if a date column AND a numeric measure both exist.
- Add an "insights" tab as the last tab with charts:[] (UI renders it as a text/insights summary).
- hbar for agent/person rankings; pie for ≤8-value status distributions; area/line for time series; bar for category comparisons.
- Set timeSeries:true + timeGroupBy:"month" for date columns.
- Column names must EXACTLY match the listed column names (case-sensitive).
- yCol can be null for count-based charts.
- NEVER invent column names that aren't in the list.
- Use "width":"full" for hero/time-series charts, "half" for grid charts.
- Keep tab titles short (1–3 words). Each tab.id must be a unique kebab-case slug.

If you cannot produce tabs[], you may fall back to a flat "charts": [...] array — but tabs[] is strongly preferred.`.trim();

  dashLog('info', 'prompt_built', `len=${prompt.length}`);

  // ── 5. Call Gemini (skip if disabled) ────────────────────────────────────
  let planRawText  = null;
  let planSource   = 'gemini';
  let geminiResult = null;

  if (!dashDisabled.includes('gemini')) {
    geminiResult = await callGeminiDashboard(prompt, geminiKey, { maxRetries: 2, timeoutMs: 20000 });
    if (geminiResult.ok) { planRawText = geminiResult.text; }
    else dashLog('warn', 'gemini_failed', geminiResult.error?.code);
  } else {
    dashLog('info', 'gemini_skipped', 'disabled by admin');
  }

  // ── 5.5 Gemini failed → try OpenAI gpt-4.1-mini ──────────────────────────
  if (!planRawText) {
    const openaiKey = c.env.OPENAI_API_KEY;
    if (openaiKey && !dashDisabled.includes('openai')) {
      dashLog('info', 'openai_fallback', 'trying gpt-4.1-mini for dashboard plan');
      const openaiResult = await callOpenAIChat(
        [{ role: 'user', content: prompt }],
        openaiKey,
        { maxTokens: 2048, temperature: 0.3, timeoutMs: 20000 }
      );
      if (openaiResult.ok) { planRawText = openaiResult.text; planSource = 'openai'; }
      else dashLog('warn', 'openai_failed', openaiResult.code);
    } else if (dashDisabled.includes('openai')) {
      dashLog('info', 'openai_skipped', 'disabled by admin');
    }
  }

  // ── 5.7 OpenAI failed → try Groq llama as final AI fallback ──────────────
  if (!planRawText) {
    if (groqKey && !dashDisabled.includes('groq')) {
      dashLog('info', 'groq_fallback', 'trying llama-3.3-70b for dashboard plan');
      const groqResult = await callGroqChat(
        [{ role: 'user', content: prompt }],
        groqKey,
        { maxTokens: 2048, temperature: 0.3, timeoutMs: 18000 }
      );
      if (groqResult.ok) { planRawText = groqResult.text; planSource = 'groq'; }
      else dashLog('warn', 'groq_failed', groqResult.code);
    } else if (dashDisabled.includes('groq')) {
      dashLog('info', 'groq_skipped', 'disabled by admin');
    }
    if (!planRawText) {
      const { code, message, detail } = geminiResult?.error || {};
      return c.json({
        success: false, code,
        error: code === 'TIMEOUT'        ? 'AI request timed out'
             : code === 'RATE_LIMITED'   ? 'AI rate limit reached — please retry in a moment'
             : code === 'EMPTY_RESPONSE' ? 'AI returned an empty response'
             :                             'All AI providers failed or are disabled',
        detail: detail || message,
      }, code === 'RATE_LIMITED' ? 429 : 502);
    }
  }

  // ── 6. Parse response ─────────────────────────────────────────────────────
  const plan = extractDashboardJSON(planRawText);
  if (!plan) {
    dashLog('error', 'parse_plan', 'Could not extract JSON', planRawText?.slice(0, 300));
    return c.json({
      success: false,
      error: 'AI returned unstructured output',
      code: 'PARSE_ERROR',
      raw: planRawText?.slice(0, 500),
    }, 502);
  }

  // ── 7. Sanitize & enrich plan (supports both new tabs[] and legacy charts[])
  plan.title    = (plan.title    || groqMeta?.dashboardTitle || 'Data Dashboard').slice(0, 80);
  plan.subtitle = (plan.subtitle || groqMeta?.subtitle || `${safe.rowCount} rows · ${safe.headers.length} columns`).slice(0, 120);
  plan.insights = Array.isArray(plan.insights) ? plan.insights.slice(0, 8) : [];
  plan.summary  = typeof plan.summary === 'string' ? plan.summary.slice(0, 400) : '';
  plan.domain   = typeof plan.domain === 'string' ? plan.domain.slice(0, 30) : undefined;
  plan.columnLabels = groqMeta?.columnLabels || {};

  const validHeaders = new Set(safe.headers);
  const validChart = (ch) => {
    const xOk = validHeaders.has(ch.xCol);
    const yOk = ch.yCol === null || ch.yCol === undefined || ch.yCol === '' || validHeaders.has(ch.yCol);
    return xOk && yOk;
  };
  const normChart = (ch) => ({ ...ch, yCol: ch.yCol || null });

  // NEW tabs[] path — preferred
  if (Array.isArray(plan.tabs) && plan.tabs.length > 0) {
    plan.tabs = plan.tabs.map((t, i) => {
      const charts = Array.isArray(t.charts) ? t.charts.filter(validChart).map(normChart) : [];
      return {
        id: (t.id || `tab${i}`).toString().slice(0, 40),
        title: (t.title || `Tab ${i + 1}`).toString().slice(0, 60),
        description: (t.description || '').toString().slice(0, 200),
        summary: (t.summary || '').toString().slice(0, 280),
        insights: Array.isArray(t.insights) ? t.insights.slice(0, 5).map(s => String(s).slice(0, 200)) : [],
        charts,
      };
    }).filter(t => t.charts.length > 0 || t.id === 'insights' || /insight|summary/i.test(t.title));
    plan.charts = []; // tabs[] takes precedence; legacy charts[] cleared
    dashLog('info', 'plan_tabs', `tabs=${plan.tabs.length}, totalCharts=${plan.tabs.reduce((s, t) => s + t.charts.length, 0)}`);
  } else {
    // LEGACY flat charts[] path — keep working
    plan.charts = (Array.isArray(plan.charts) ? plan.charts : []).filter(validChart).map(normChart);
    plan.tabs = []; // explicit empty so client knows to wrap
    dashLog('info', 'plan_flat', `charts=${plan.charts.length}`);
  }

  const elapsed = Date.now() - t0;
  dashLog('info', 'complete', `tabs=${plan.tabs.length}, flatCharts=${plan.charts.length}, elapsed=${elapsed}ms, source=${planSource}`);

  // Track which provider served this dashboard plan (non-blocking, system-level)
  try { await incrementUserQuota(getDb(c.env), '__system__', `ai-${planSource}`); } catch {}

  return c.json({ success: true, plan, source: planSource });
});

// ═══════════════════════════════════════════════════════════════════════════
// SHARED DASHBOARD REPORTS — public read-only snapshots
// Routes:
//   POST   /api/share/dashboard            (auth) create snapshot, return token
//   GET    /api/share/dashboard/:token     (public) fetch snapshot if not expired
//   DELETE /api/share/dashboard/:token     (auth) revoke (owner only)
//   GET    /api/share/dashboard/mine       (auth) list this user's shares
// Snapshot JSON lives in R2 under shared-reports/{token}.json
// ═══════════════════════════════════════════════════════════════════════════

const SHARE_R2_PREFIX = 'shared-reports/';
const SHARE_MAX_BYTES = 800 * 1024; // 800KB max snapshot size

// URL-safe random token (~22 chars)
function makeShareToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Base64-URL without padding
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Map an EXPIRY string to a millisecond offset
const SHARE_EXPIRY_MS = {
  '1h':   60 * 60 * 1000,
  '24h':  24 * 60 * 60 * 1000,
  '7d':    7 * 24 * 60 * 60 * 1000,
  '30d':  30 * 24 * 60 * 60 * 1000,
};

// Lazy cleanup — drop oldest expired rows + their R2 blobs (best-effort, non-blocking)
async function lazyCleanupExpiredShares(env, limit = 25) {
  try {
    const db = getDb(env);
    const now = Date.now();
    const rows = await db.prepare(
      `SELECT token, r2_key FROM shared_reports WHERE expires_at < ? OR revoked = 1 LIMIT ?`
    ).bind(now, limit).all();
    const list = rows.results || [];
    if (!list.length) return;
    for (const r of list) {
      try { await env.MY_BUCKET?.delete(r.r2_key); } catch {}
    }
    const placeholders = list.map(() => '?').join(',');
    await db.prepare(`DELETE FROM shared_reports WHERE token IN (${placeholders})`)
      .bind(...list.map(r => r.token)).run();
  } catch (err) {
    console.warn('[share] lazy cleanup failed:', err.message);
  }
}

// CREATE — auth required
app.post('/api/share/dashboard', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);

  let body;
  try { body = await c.req.json(); } catch {
    return c.json({ success: false, error: 'Invalid JSON' }, 400);
  }

  const { snapshot, expiry } = body || {};
  if (!snapshot || typeof snapshot !== 'object') {
    return c.json({ success: false, error: 'snapshot object required' }, 400);
  }
  if (!SHARE_EXPIRY_MS[expiry]) {
    return c.json({ success: false, error: 'Invalid expiry. Use 1h | 24h | 7d | 30d' }, 400);
  }

  // Size guard
  const snapStr = JSON.stringify(snapshot);
  if (snapStr.length > SHARE_MAX_BYTES) {
    return c.json({
      success: false,
      error: `Snapshot too large (${Math.round(snapStr.length / 1024)} KB, max ${Math.round(SHARE_MAX_BYTES/1024)} KB)`,
      code: 'TOO_LARGE',
    }, 413);
  }

  // Validate the snapshot shape minimally — must look like a dashboard
  if (!snapshot.title || (!Array.isArray(snapshot.tabs) && !Array.isArray(snapshot.charts))) {
    return c.json({ success: false, error: 'Invalid dashboard snapshot' }, 400);
  }

  // Generate token, write R2, insert D1 row
  const token   = makeShareToken();
  const r2Key   = `${SHARE_R2_PREFIX}${token}.json`;
  const now     = Date.now();
  const expires = now + SHARE_EXPIRY_MS[expiry];

  // Strip sensitive / unnecessary fields from snapshot before storing
  const cleanSnapshot = {
    title: String(snapshot.title || 'Shared Report').slice(0, 120),
    subtitle: String(snapshot.subtitle || '').slice(0, 200),
    domain: snapshot.domain || null,
    confidence: snapshot.confidence || null,
    fileName: String(snapshot.fileName || '').slice(0, 80),
    rowCount: Number(snapshot.rowCount) || 0,
    createdAt: now,
    expiresAt: expires,
    insights: Array.isArray(snapshot.insights) ? snapshot.insights.slice(0, 10) : [],
    summary: typeof snapshot.summary === 'string' ? snapshot.summary.slice(0, 600) : '',
    tabs: Array.isArray(snapshot.tabs) ? snapshot.tabs : [],
    charts: Array.isArray(snapshot.charts) ? snapshot.charts : [],
    kpis: Array.isArray(snapshot.kpis) ? snapshot.kpis : [],
    builtChartsData: snapshot.builtChartsData || null,
    agentData: Array.isArray(snapshot.agentData) ? snapshot.agentData.slice(0, 20) : null,
    showTable: false,
    headers: Array.isArray(snapshot.headers) ? snapshot.headers : [],
  };

  try {
    if (!c.env.MY_BUCKET) {
      return c.json({ success: false, error: 'R2 storage not configured' }, 500);
    }
    await c.env.MY_BUCKET.put(r2Key, JSON.stringify(cleanSnapshot), {
      httpMetadata: { contentType: 'application/json' },
    });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to store snapshot: ' + err.message }, 500);
  }

  try {
    const db = getDb(c.env);
    await db.prepare(`
      INSERT INTO shared_reports (token, owner_user_id, title, file_name, row_count, domain, r2_key, created_at, expires_at, view_count, revoked)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `).bind(
      token, user.id,
      cleanSnapshot.title, cleanSnapshot.fileName, cleanSnapshot.rowCount,
      cleanSnapshot.domain, r2Key, now, expires
    ).run();
  } catch (err) {
    // Roll back R2 write
    try { await c.env.MY_BUCKET?.delete(r2Key); } catch {}
    return c.json({ success: false, error: 'Failed to save share: ' + err.message }, 500);
  }

  // Fire-and-forget cleanup
  lazyCleanupExpiredShares(c.env);

  return c.json({
    success: true,
    token,
    expiresAt: expires,
    expiresIn: expiry,
  });
});

// READ — public, no auth required (token-gated)
app.get('/api/share/dashboard/:token', async (c) => {
  const token = c.req.param('token');
  if (!token || !/^[A-Za-z0-9_-]{8,64}$/.test(token)) {
    return c.json({ success: false, error: 'Invalid token format', code: 'BAD_TOKEN' }, 400);
  }

  const db = getDb(c.env);
  const row = await db.prepare(
    `SELECT token, r2_key, expires_at, revoked, view_count FROM shared_reports WHERE token = ?`
  ).bind(token).first();

  if (!row) {
    return c.json({ success: false, error: 'Report not found', code: 'NOT_FOUND' }, 404);
  }

  const now = Date.now();
  if (row.revoked === 1) {
    return c.json({ success: false, error: 'This report link has been revoked', code: 'REVOKED' }, 410);
  }
  if (now > Number(row.expires_at)) {
    // Lazy delete expired
    try { await c.env.MY_BUCKET?.delete(row.r2_key); } catch {}
    try { await db.prepare(`DELETE FROM shared_reports WHERE token = ?`).bind(token).run(); } catch {}
    return c.json({ success: false, error: 'This report link has expired', code: 'EXPIRED' }, 410);
  }

  if (!c.env.MY_BUCKET) {
    return c.json({ success: false, error: 'Storage unavailable' }, 500);
  }
  const obj = await c.env.MY_BUCKET.get(row.r2_key);
  if (!obj) {
    try { await db.prepare(`DELETE FROM shared_reports WHERE token = ?`).bind(token).run(); } catch {}
    return c.json({ success: false, error: 'Report snapshot missing', code: 'MISSING_BLOB' }, 410);
  }
  let snapshot;
  try {
    snapshot = JSON.parse(await obj.text());
  } catch {
    return c.json({ success: false, error: 'Snapshot corrupted' }, 500);
  }

  // Best-effort view counter (non-blocking)
  try {
    await db.prepare(`UPDATE shared_reports SET view_count = view_count + 1 WHERE token = ?`).bind(token).run();
  } catch {}

  return c.json({
    success: true,
    snapshot,
    expiresAt: Number(row.expires_at),
  });
});

// REVOKE — owner only
app.delete('/api/share/dashboard/:token', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);
  const token = c.req.param('token');
  if (!token) return c.json({ success: false, error: 'Token required' }, 400);

  const db = getDb(c.env);
  const row = await db.prepare(
    `SELECT owner_user_id, r2_key FROM shared_reports WHERE token = ?`
  ).bind(token).first();

  if (!row) return c.json({ success: false, error: 'Not found' }, 404);
  if (Number(row.owner_user_id) !== Number(user.id)) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }

  try { await c.env.MY_BUCKET?.delete(row.r2_key); } catch {}
  await db.prepare(`DELETE FROM shared_reports WHERE token = ?`).bind(token).run();
  return c.json({ success: true });
});

// LIST — owner's active shares (for management UI)
app.get('/api/share/dashboard/mine/list', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);
  const db = getDb(c.env);
  const now = Date.now();
  const rows = await db.prepare(
    `SELECT token, title, file_name, row_count, domain, created_at, expires_at, view_count
       FROM shared_reports
      WHERE owner_user_id = ? AND revoked = 0 AND expires_at > ?
      ORDER BY created_at DESC LIMIT 50`
  ).bind(user.id, now).all();
  return c.json({ success: true, shares: rows.results || [] });
});

// ═══════════════════════════════════════════════════════════════════════════
// WHATSAPP DATA API
// Routes under /api/wa/* serve the local whatsapp-service Node.js process.
// All requests must carry x-wa-secret matching env.WA_SHARED_SECRET.
// ═══════════════════════════════════════════════════════════════════════════

app.use('/api/wa/*', async (c, next) => {
  const secret = c.req.header('x-wa-secret');
  if (!c.env.WA_SHARED_SECRET || secret !== c.env.WA_SHARED_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return next();
});

// ── Internal write routes (called from whatsapp.js on every message) ────────

function waSafeKeyPart(value = '') {
  return encodeURIComponent(String(value || 'unknown')).replace(/%/g, '~');
}

function waSessionId(value = '') {
  return String(value || 'legacy').replace(/[^a-zA-Z0-9_-]/g, '_') || 'legacy';
}

function scopedWaId(sessionId, value = '') {
  return `${waSessionId(sessionId)}:${String(value || '')}`;
}

function normalizeWaMessageForStorage(d, ts) {
  return {
    messageId: d.messageId,
    chatId: d.chatId,
    chatName: d.chatName || '',
    from: d.from || '',
    to: d.to || '',
    author: d.author || '',
    senderName: d.senderName || '',
    body: d.body || '',
    type: d.type || 'chat',
    timestamp: new Date(ts * 1000).toISOString(),
    isFromMe: !!d.isFromMe,
    hasMedia: !!d.hasMedia,
    mediaUrl: d.mediaUrl || '',
    quotedMessage: d.quotedMessage || null,
    responseTime: d.responseTime ?? null,
  };
}

async function persistWaMessageToR2(c, d, ts) {
  const bucket = c.env.MY_BUCKET;
  if (!bucket || !d.chatId || !d.messageId) return;
  const date = new Date(ts * 1000).toISOString().slice(0, 10);
  const sessionId = waSessionId(d.sessionId);
  const key = `sessions/${waSafeKeyPart(sessionId)}/messages/${waSafeKeyPart(d.chatId)}/${date}.json`;
  const nextMessage = normalizeWaMessageForStorage(d, ts);
  let payload = { sessionId, chatId: d.chatId, date, messages: [] };
  try {
    const existing = await bucket.get(key);
    if (existing) payload = await existing.json();
  } catch (_) {
    payload = { sessionId, chatId: d.chatId, date, messages: [] };
  }
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const idx = messages.findIndex((m) => m.messageId === nextMessage.messageId);
  if (idx >= 0) messages[idx] = { ...messages[idx], ...nextMessage };
  else messages.push(nextMessage);
  messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  await bucket.put(key, JSON.stringify({ ...payload, messages }, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
}

function bindWaMessage(stmt, d) {
  const ts = Math.floor(new Date(d.timestamp).getTime() / 1000);
  const sessionId = waSessionId(d.sessionId);
  return stmt.bind(
    scopedWaId(sessionId, d.messageId), scopedWaId(sessionId, d.chatId), sessionId, d.chatId, d.messageId,
    d.chatName||'', d.from||'', d.to||'',
    d.author||'', d.senderName||'', d.body||'', d.type||'chat', ts,
    d.isFromMe?1:0, d.hasMedia?1:0, d.mediaUrl||'',
    d.quotedMessage?.messageId || d.quotedMsgId || '',
    d.quotedMessage?.body || d.quotedBody || '',
    d.agentId||null, d.responseTime??null,
  );
}

app.post('/api/wa/internal/messages/upsert', async (c) => {
  const db = getDb(c.env);
  const d = await c.req.json();
  const ts = Math.floor(new Date(d.timestamp).getTime() / 1000);
  const stmt = db.prepare(`
    INSERT INTO wa_messages
      (message_id,chat_id,session_id,real_chat_id,real_message_id,chat_name,from_jid,to_jid,author_jid,sender_name,body,type,timestamp,is_from_me,has_media,media_url,quoted_msg_id,quoted_body,agent_id,response_time)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(message_id) DO UPDATE SET
      body=excluded.body,
      author_jid=excluded.author_jid,
      sender_name=excluded.sender_name,
      media_url=excluded.media_url,
      quoted_msg_id=excluded.quoted_msg_id,
      quoted_body=excluded.quoted_body,
      response_time=COALESCE(excluded.response_time,wa_messages.response_time)
  `);
  await bindWaMessage(stmt, d).run();
  await persistWaMessageToR2(c, d, ts);
  return c.json({ ok: true });
});

app.post('/api/wa/internal/messages/bulk', async (c) => {
  const db = getDb(c.env);
  const { rows = [] } = await c.req.json();
  if (!rows.length) return c.json({ ok: true, count: 0 });
  const stmt = db.prepare(`
    INSERT INTO wa_messages
      (message_id,chat_id,session_id,real_chat_id,real_message_id,chat_name,from_jid,to_jid,author_jid,sender_name,body,type,timestamp,is_from_me,has_media,media_url,quoted_msg_id,quoted_body,agent_id,response_time)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(message_id) DO UPDATE SET
      body=excluded.body,
      author_jid=excluded.author_jid,
      sender_name=excluded.sender_name,
      media_url=excluded.media_url,
      quoted_msg_id=excluded.quoted_msg_id,
      quoted_body=excluded.quoted_body,
      response_time=COALESCE(excluded.response_time,wa_messages.response_time)
  `);
  await db.batch(rows.map((d) => bindWaMessage(stmt, d)));
  for (const d of rows) {
    const ts = Math.floor(new Date(d.timestamp).getTime() / 1000);
    await persistWaMessageToR2(c, d, ts);
  }
  return c.json({ ok: true, count: rows.length });
});

app.get('/api/wa/internal/messages/last-customer', async (c) => {
  const db = getDb(c.env);
  const chatId = c.req.query('chatId');
  const sessionId = waSessionId(c.req.query('sessionId'));
  if (!chatId) return c.json(null);
  const row = await db.prepare(
    'SELECT timestamp FROM wa_messages WHERE session_id=? AND real_chat_id=? AND is_from_me=0 ORDER BY timestamp DESC LIMIT 1'
  ).bind(sessionId, chatId).first();
  return c.json(row ? { timestamp: new Date(row.timestamp * 1000).toISOString() } : null);
});

app.post('/api/wa/internal/chats/upsert', async (c) => {
  const db = getDb(c.env);
  const d = await c.req.json();
  const sessionId = waSessionId(d.sessionId);
  const lastTs    = d.lastMessageTime ? Math.floor(new Date(d.lastMessageTime).getTime()/1000) : null;
  const waitingTs = d.waitingSince    ? Math.floor(new Date(d.waitingSince).getTime()/1000)    : null;
  await db.prepare(`
    INSERT INTO wa_chats
      (chat_id,session_id,real_chat_id,name,phone,is_group,last_message,last_message_time,last_msg_from_me,waiting_since,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,unixepoch())
    ON CONFLICT(chat_id) DO UPDATE SET
      name=excluded.name, phone=excluded.phone,
      last_message=excluded.last_message,
      last_message_time=excluded.last_message_time,
      last_msg_from_me=excluded.last_msg_from_me,
      waiting_since=excluded.waiting_since,
      updated_at=unixepoch()
  `).bind(
    scopedWaId(sessionId, d.chatId), sessionId, d.chatId, d.name||'', d.phone||null, d.isGroup?1:0,
    d.lastMessage||'', lastTs, d.lastMessageIsFromMe?1:0, waitingTs,
  ).run();
  return c.json({ ok: true });
});

app.post('/api/wa/internal/contacts/upsert', async (c) => {
  const db = getDb(c.env);
  const d = await c.req.json();
  const sessionId = waSessionId(d.sessionId);
  if (!d.phone) return c.json({ ok: true });
  await db.prepare(`
    INSERT INTO wa_contacts (phone,session_id,real_phone,name,pushname,is_group,last_contact)
    VALUES (?,?,?,?,?,?,unixepoch())
    ON CONFLICT(phone) DO UPDATE SET
      name=COALESCE(NULLIF(excluded.name,''),wa_contacts.name),
      pushname=excluded.pushname,
      last_contact=unixepoch()
  `).bind(scopedWaId(sessionId, d.phone), sessionId, d.phone, d.name||d.phone, d.pushname||'', d.isGroup?1:0).run();
  return c.json({ ok: true });
});

app.post('/api/wa/internal/chats/bulk', async (c) => {
  const db = getDb(c.env);
  const { rows = [] } = await c.req.json();
  if (!rows.length) return c.json({ ok: true, count: 0 });
  const stmt = db.prepare(`
    INSERT INTO wa_chats
      (chat_id,session_id,real_chat_id,name,phone,is_group,last_message,last_message_time,last_msg_from_me,waiting_since,unread_count,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,unixepoch())
    ON CONFLICT(chat_id) DO UPDATE SET
      name=excluded.name, phone=excluded.phone,
      last_message=excluded.last_message,
      last_message_time=excluded.last_message_time,
      last_msg_from_me=excluded.last_msg_from_me,
      waiting_since=excluded.waiting_since,
      unread_count=excluded.unread_count,
      updated_at=unixepoch()
  `);
  await db.batch(rows.map(r => stmt.bind(
    scopedWaId(waSessionId(r.sessionId), r.chatId), waSessionId(r.sessionId), r.chatId,
    r.name||'', r.phone||null, r.isGroup?1:0,
    r.lastMessage||'',
    r.lastMessageTime ? Math.floor(new Date(r.lastMessageTime).getTime()/1000) : null,
    r.lastMessageIsFromMe?1:0,
    r.waitingSince    ? Math.floor(new Date(r.waitingSince).getTime()/1000)    : null,
    r.unreadCount||0,
  )));
  return c.json({ ok: true, count: rows.length });
});

app.post('/api/wa/internal/contacts/bulk', async (c) => {
  const db = getDb(c.env);
  const { rows = [] } = await c.req.json();
  if (!rows.length) return c.json({ ok: true, count: 0 });
  const stmt = db.prepare(`
    INSERT INTO wa_contacts (phone,session_id,real_phone,name,pushname,is_group)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(phone) DO UPDATE SET
      name=COALESCE(NULLIF(excluded.name,''),wa_contacts.name),
      pushname=excluded.pushname
  `);
  await db.batch(rows.map(r => stmt.bind(
    scopedWaId(waSessionId(r.sessionId), r.phone), waSessionId(r.sessionId), r.phone,
    r.name||r.phone, r.pushname||'', r.isGroup?1:0
  )));
  return c.json({ ok: true, count: rows.length });
});

// ── Data read/write routes (proxied through whatsapp-service/routes/api.js) ─

app.get('/api/wa/chats', async (c) => {
  const db = getDb(c.env);
  const SLA = parseInt(c.env.SLA_THRESHOLD_SECONDS||'900', 10);
  const sessionId = waSessionId(c.req.query('sessionId'));
  const { search='', status='all', page='1', limit='50' } = c.req.query();
  const skip = (parseInt(page)-1) * parseInt(limit);
  const now = Math.floor(Date.now()/1000);

  const conds = ['session_id=?'];
  const params = [sessionId];
  if (search) { conds.push('name LIKE ?'); params.push(`%${search}%`); }
  if (status === 'pending')  { conds.push('waiting_since IS NOT NULL'); }
  if (status === 'breached') { conds.push('waiting_since IS NOT NULL AND waiting_since < ?'); params.push(now - SLA); }
  params.push(parseInt(limit), skip);

  const rows = await db.prepare(
    `SELECT * FROM wa_chats WHERE ${conds.join(' AND ')} ORDER BY last_message_time DESC LIMIT ? OFFSET ?`
  ).bind(...params).all();

  return c.json(rows.results.map(r => {
    const waitSecs = r.waiting_since ? (now - r.waiting_since) : 0;
    return {
      chatId: r.real_chat_id || r.chat_id, name: r.name, phone: r.phone,
      isGroup: !!r.is_group, lastMessage: r.last_message,
      lastMessageTime: r.last_message_time ? new Date(r.last_message_time*1000) : null,
      lastMessageIsFromMe: !!r.last_msg_from_me,
      waitingMinutes: Math.round(waitSecs/60),
      slaStatus: waitSecs > SLA ? 'breached' : waitSecs > SLA*0.7 ? 'warning' : 'ok',
      agentAssigned: r.agent_assigned||'Unassigned',
    };
  }));
});

app.get('/api/wa/chats/:chatId/messages', async (c) => {
  const db = getDb(c.env);
  const { before='', limit='200' } = c.req.query();
  const sessionId = waSessionId(c.req.query('sessionId'));
  const safeLimit = Math.min(parseInt(limit, 10) || 200, 500);
  const conds = ['session_id=?', 'real_chat_id=?'];
  const params = [sessionId, c.req.param('chatId')];
  if (before) {
    conds.push('timestamp<?');
    params.push(Math.floor(new Date(before).getTime() / 1000));
  }
  params.push(safeLimit);
  const rows = await db.prepare(
    `SELECT * FROM wa_messages WHERE ${conds.join(' AND ')} ORDER BY timestamp DESC LIMIT ?`
  ).bind(...params).all();
  return c.json(rows.results.reverse().map(m => ({
    messageId: m.real_message_id || m.message_id, chatId: m.real_chat_id || m.chat_id, body: m.body,
    timestamp: new Date(m.timestamp*1000), isFromMe: !!m.is_from_me,
    type: m.type, hasMedia: !!m.has_media, mediaUrl: m.media_url || '',
    author: m.author_jid || '', senderName: m.sender_name || '',
    quotedMessage: m.quoted_msg_id || m.quoted_body ? { messageId:m.quoted_msg_id, body:m.quoted_body } : null,
    responseTime: m.response_time,
  })));
});

app.get('/api/wa/media/:id', async (c) => {
  const bucket = c.env.MY_BUCKET;
  if (!bucket) return c.json({ error: 'R2 bucket is not configured' }, 500);
  const sessionId = waSessionId(c.req.query('sessionId'));
  const object = await bucket.get(`sessions/${waSafeKeyPart(sessionId)}/media/${waSafeKeyPart(c.req.param('id'))}`);
  if (!object) return c.json({ error: 'Media not found' }, 404);
  return new Response(object.body, { headers: object.httpMetadata || {} });
});

app.get('/api/wa/contacts', async (c) => {
  const db = getDb(c.env);
  const { search='', status='all', page='1', limit='100' } = c.req.query();
  const sessionId = waSessionId(c.req.query('sessionId'));
  const skip = (parseInt(page)-1) * parseInt(limit);
  const conds = ['session_id=?', 'is_group=0'];
  const params = [sessionId];
  if (search) { conds.push('(name LIKE ? OR phone LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (status !== 'all') { conds.push('lead_status=?'); params.push(status); }
  params.push(parseInt(limit), skip);
  const rows = await db.prepare(
    `SELECT * FROM wa_contacts WHERE ${conds.join(' AND ')} ORDER BY last_contact DESC LIMIT ? OFFSET ?`
  ).bind(...params).all();
  return c.json(rows.results.map(r => ({
    phone: r.real_phone || r.phone, name: r.name, pushname: r.pushname,
    leadStatus: r.lead_status, tags: JSON.parse(r.tags||'[]'), notes: r.notes,
    lastContact: r.last_contact ? new Date(r.last_contact*1000) : null,
  })));
});

app.patch('/api/wa/contacts/:phone', async (c) => {
  const db = getDb(c.env);
  const phone = decodeURIComponent(c.req.param('phone'));
  const sessionId = waSessionId(c.req.query('sessionId'));
  const body = await c.req.json();
  const sets = []; const params = [];
  if (body.leadStatus !== undefined) { sets.push('lead_status=?'); params.push(body.leadStatus); }
  if (body.notes      !== undefined) { sets.push('notes=?');       params.push(body.notes); }
  if (body.tags       !== undefined) { sets.push('tags=?');        params.push(JSON.stringify(body.tags)); }
  if (sets.length) {
    params.push(scopedWaId(sessionId, phone));
    await db.prepare(`UPDATE wa_contacts SET ${sets.join(',')} WHERE phone=?`).bind(...params).run();
  }
  const row = await db.prepare('SELECT * FROM wa_contacts WHERE phone=?').bind(scopedWaId(sessionId, phone)).first();
  return c.json(row ? { ...row, phone: row.real_phone || row.phone, tags: JSON.parse(row.tags||'[]') } : {});
});

app.get('/api/wa/leads', async (c) => {
  const db = getDb(c.env);
  const { status='all', search='' } = c.req.query();
  const sessionId = waSessionId(c.req.query('sessionId'));
  const conds = ['session_id=?']; const params = [sessionId];
  if (status !== 'all') { conds.push('status=?'); params.push(status); }
  if (search) { conds.push('(name LIKE ? OR phone LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  params.push(200);
  const rows = await db.prepare(
    `SELECT * FROM wa_leads WHERE ${conds.join(' AND ')} ORDER BY updated_at DESC LIMIT ?`
  ).bind(...params).all();
  return c.json(rows.results.map(r => ({ ...r, _id: r.id, tags: JSON.parse(r.tags||'[]') })));
});

app.post('/api/wa/leads', async (c) => {
  const db = getDb(c.env);
  const body = await c.req.json();
  const sessionId = waSessionId(body.sessionId);
  const id = body.id || nanoid();
  await db.prepare(`
    INSERT INTO wa_leads (id,session_id,phone,name,status,priority,notes,tags,updated_at)
    VALUES (?,?,?,?,?,?,?,?,unixepoch())
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, status=excluded.status, priority=excluded.priority,
      notes=excluded.notes, tags=excluded.tags, updated_at=unixepoch()
  `).bind(
    id, sessionId, body.phone||'', body.name||body.phone||'',
    body.status||'new', body.priority||'medium',
    body.notes||'', JSON.stringify(body.tags||[]),
  ).run();
  const row = await db.prepare('SELECT * FROM wa_leads WHERE id=?').bind(id).first();
  return c.json({ ...row, _id: row.id, tags: JSON.parse(row.tags||'[]') });
});

app.patch('/api/wa/leads/:id', async (c) => {
  const db = getDb(c.env);
  const id = c.req.param('id');
  const body = await c.req.json();
  const sessionId = waSessionId(body.sessionId);
  const sets = ['updated_at=unixepoch()']; const params = [];
  if (body.name          !== undefined) { sets.push('name=?');          params.push(body.name); }
  if (body.status        !== undefined) { sets.push('status=?');        params.push(body.status); }
  if (body.priority      !== undefined) { sets.push('priority=?');      params.push(body.priority); }
  if (body.notes         !== undefined) { sets.push('notes=?');         params.push(body.notes); }
  if (body.tags          !== undefined) { sets.push('tags=?');          params.push(JSON.stringify(body.tags)); }
  if (body.ticket_status !== undefined) { sets.push('ticket_status=?'); params.push(body.ticket_status); }
  if (body.follow_up_date!== undefined) { sets.push('follow_up_date=?');params.push(body.follow_up_date); }
  if (body.follow_up_time!== undefined) { sets.push('follow_up_time=?');params.push(body.follow_up_time); }
  if (body.assigned_to   !== undefined) { sets.push('assigned_to=?');   params.push(body.assigned_to); }
  params.push(id, sessionId);
  await db.prepare(`UPDATE wa_leads SET ${sets.join(',')} WHERE id=? AND session_id=?`).bind(...params).run();
  const row = await db.prepare('SELECT * FROM wa_leads WHERE id=? AND session_id=?').bind(id, sessionId).first();
  return c.json(row ? { ...row, _id: row.id, tags: JSON.parse(row.tags||'[]') } : {});
});

app.delete('/api/wa/leads/:id', async (c) => {
  const db = getDb(c.env);
  const sessionId = waSessionId(c.req.query('sessionId'));
  await db.prepare('DELETE FROM wa_leads WHERE id=? AND session_id=?').bind(c.req.param('id'), sessionId).run();
  return c.json({ ok: true });
});

// ── Chat ticket-status PATCH ───────────────────────────────────────────────
app.patch('/api/wa/chats/:chatId/ticket', async (c) => {
  const db = getDb(c.env);
  const chatId    = c.req.param('chatId');
  const body      = await c.req.json();
  const sessionId = waSessionId(body.sessionId);
  const sets = ['updated_at=unixepoch()']; const params = [];
  if (body.ticket_status !== undefined) { sets.push('ticket_status=?'); params.push(body.ticket_status); }
  if (body.assigned_to   !== undefined) { sets.push('assigned_to=?');   params.push(body.assigned_to); }
  params.push(chatId, sessionId);
  await db.prepare(`UPDATE wa_chats SET ${sets.join(',')} WHERE chat_id=? AND session_id=?`).bind(...params).run();
  const row = await db.prepare('SELECT * FROM wa_chats WHERE chat_id=? AND session_id=?').bind(chatId, sessionId).first();
  return c.json(row || {});
});

// ── Internal notes ─────────────────────────────────────────────────────────
app.get('/api/wa/notes/:chatId', async (c) => {
  const db = getDb(c.env);
  const sessionId = waSessionId(c.req.query('sessionId'));
  const rows = await db.prepare(
    'SELECT * FROM wa_notes WHERE session_id=? AND chat_id=? ORDER BY created_at ASC LIMIT 100'
  ).bind(sessionId, c.req.param('chatId')).all();
  return c.json(rows.results || []);
});

app.post('/api/wa/notes/:chatId', async (c) => {
  const db = getDb(c.env);
  const body      = await c.req.json();
  const sessionId = waSessionId(body.sessionId);
  const id        = nanoid();
  await db.prepare(
    'INSERT INTO wa_notes (id,chat_id,session_id,body,agent,created_at) VALUES (?,?,?,?,?,unixepoch())'
  ).bind(id, c.req.param('chatId'), sessionId, String(body.body||'').trim(), body.agent||'Agent').run();
  const row = await db.prepare('SELECT * FROM wa_notes WHERE id=?').bind(id).first();
  return c.json(row || {});
});

app.get('/api/wa/analytics', async (c) => {
  const db = getDb(c.env);
  const SLA = parseInt(c.env.SLA_THRESHOLD_SECONDS||'900', 10);
  const sessionId = waSessionId(c.req.query('sessionId'));
  const range = c.req.query('range')||'7d';
  const days = range==='30d'?30:range==='1d'?1:7;
  const now = Math.floor(Date.now()/1000);
  const sinceTs = now - days*86400;
  const todayTs = Math.floor(new Date().setUTCHours(0,0,0,0)/1000);

  const [chatStats, rtRows, hourlyRaw, weeklyRaw, leadRows] = await Promise.all([
    db.prepare(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN waiting_since IS NOT NULL THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN waiting_since IS NOT NULL AND waiting_since < ? THEN 1 ELSE 0 END) as breached
      FROM wa_chats WHERE session_id=?
    `).bind(now - SLA, sessionId).first(),

    db.prepare(
      'SELECT response_time FROM wa_messages WHERE session_id=? AND is_from_me=1 AND response_time IS NOT NULL AND timestamp>=?'
    ).bind(sessionId, sinceTs).all(),

    db.prepare(`
      SELECT CAST(strftime('%H',datetime(timestamp,'unixepoch')) AS INTEGER) as h,
        SUM(CASE WHEN is_from_me=0 THEN 1 ELSE 0 END) as chats,
        SUM(CASE WHEN is_from_me=1 THEN 1 ELSE 0 END) as replied
      FROM wa_messages WHERE session_id=? AND timestamp>=? GROUP BY h
    `).bind(sessionId, todayTs).all(),

    db.prepare(`
      SELECT date(datetime(timestamp,'unixepoch')) as day,
        SUM(CASE WHEN is_from_me=0 THEN 1 ELSE 0 END) as chats,
        SUM(CASE WHEN is_from_me=1 AND response_time IS NOT NULL AND response_time<=? THEN 1 ELSE 0 END) as sla_ok,
        SUM(CASE WHEN is_from_me=1 AND response_time IS NOT NULL THEN 1 ELSE 0 END) as replies
      FROM wa_messages WHERE session_id=? AND timestamp>=?
      GROUP BY day ORDER BY day ASC
    `).bind(SLA, sessionId, now - 7*86400).all(),

    db.prepare('SELECT status, COUNT(*) as cnt FROM wa_leads WHERE session_id=? GROUP BY status').bind(sessionId).all(),
  ]);

  const rts = rtRows.results.map(r => r.response_time);
  const avgResponse  = rts.length ? Math.round(rts.reduce((a,b)=>a+b,0)/rts.length) : 0;
  const slaCompliant = rts.filter(t => t <= SLA).length;
  const slaCompliance = rts.length ? Math.round(slaCompliant/rts.length*100) : 100;
  const total = chatStats.total || 1;
  const missedRatio = (chatStats.breached||0) / total;
  const speedScore  = Math.max(0, 100 - Math.round(avgResponse/(SLA*0.6)*100));
  const qaScore     = Math.min(Math.round(slaCompliance*0.5 + speedScore*0.3 + (1-missedRatio)*100*0.2), 100);

  const hourMap = {};
  hourlyRaw.results.forEach(r => { hourMap[r.h] = r; });
  const hourlyData = Array.from({length:12}, (_,i) => {
    const h = 8+i;
    return { h:`${h>12?h-12:h}${h>=12?'pm':'am'}`, chats:hourMap[h]?.chats||0, replied:hourMap[h]?.replied||0 };
  });

  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dayMap = {};
  weeklyRaw.results.forEach(r => { dayMap[r.day] = r; });
  const weeklyData = Array.from({length:7}, (_,i) => {
    const d2 = new Date((now-(6-i)*86400)*1000);
    const dayStr = d2.toISOString().split('T')[0];
    const row = dayMap[dayStr];
    const score = row?.replies > 0 ? Math.round(row.sla_ok/row.replies*100) : 100;
    return { d: DAYS[d2.getUTCDay()], score, chats: row?.chats||0 };
  });

  const lm = {};
  leadRows.results.forEach(r => { lm[r.status] = r.cnt; });

  return c.json({
    totalChats: chatStats.total||0, pendingReplies: chatStats.pending||0,
    avgResponseTime: avgResponse, slaCompliance, qaScore,
    missedLeads: chatStats.breached||0, breachedCount: chatStats.breached||0,
    hourlyData, weeklyData,
    leadFunnel: [
      { name:'New',       value:lm['new']||0,        color:'#6366f1' },
      { name:'Hot Lead',  value:lm['hot']||0,        color:'#f59e0b' },
      { name:'Follow-up', value:lm['follow-up']||0,  color:'#3b82f6' },
      { name:'VIP',       value:lm['vip']||0,        color:'#8b5cf6' },
      { name:'Closed',    value:lm['closed']||0,     color:'#10b981' },
      { name:'Spam',      value:lm['spam']||0,       color:'#ef4444' },
    ],
  });
});

app.get('/api/wa/qa/queue', async (c) => {
  const db = getDb(c.env);
  const SLA = parseInt(c.env.SLA_THRESHOLD_SECONDS||'900', 10);
  const filter = c.req.query('filter')||'all';
  const sessionId = waSessionId(c.req.query('sessionId'));
  const now = Math.floor(Date.now()/1000);
  const conds = ['session_id=?', 'waiting_since IS NOT NULL']; const params = [sessionId];
  if (filter === 'breached') { conds.push('waiting_since<?'); params.push(now-SLA); }
  if (filter === 'warning')  { conds.push('waiting_since<? AND waiting_since>=?'); params.push(now-Math.floor(SLA*0.7), now-SLA); }
  const rows = await db.prepare(
    `SELECT * FROM wa_chats WHERE ${conds.join(' AND ')} ORDER BY waiting_since ASC LIMIT 100`
  ).bind(...params).all();
  return c.json(rows.results.map(r => {
    const waitSecs = now - r.waiting_since;
    return {
      chatId: r.real_chat_id || r.chat_id, customer: r.name, phone: r.phone,
      lastMessage: r.last_message,
      waitingSeconds: waitSecs,
      waitingMinutes: Math.round(waitSecs / 60),
      slaStatus:    waitSecs > SLA ? 'breached' : waitSecs > SLA * 0.7 ? 'warning' : 'ok',
      agentAssigned: r.agent_assigned || r.assigned_to || 'Unassigned',
      ticketStatus:  r.ticket_status  || 'open',
      assignedTo:    r.assigned_to    || '',
    };
  }));
});

app.get('/api/wa/search', async (c) => {
  const db = getDb(c.env);
  const { q='', agent='', dateFrom='', dateTo='' } = c.req.query();
  const sessionId = waSessionId(c.req.query('sessionId'));
  if (!q) return c.json([]);
  const conds = ['session_id=?', 'body LIKE ?']; const params = [sessionId, `%${q}%`];
  if (agent)    { conds.push('agent_id=?');    params.push(agent); }
  if (dateFrom) { conds.push('timestamp>=?');  params.push(Math.floor(new Date(dateFrom).getTime()/1000)); }
  if (dateTo)   { conds.push('timestamp<=?');  params.push(Math.floor(new Date(dateTo+'T23:59:59').getTime()/1000)); }
  params.push(100);
  const rows = await db.prepare(
    `SELECT * FROM wa_messages WHERE ${conds.join(' AND ')} ORDER BY timestamp DESC LIMIT ?`
  ).bind(...params).all();
  return c.json(rows.results.map(m => ({
    messageId: m.real_message_id || m.message_id, chatId: m.real_chat_id || m.chat_id, chatName: m.chat_name, body: m.body,
    timestamp: new Date(m.timestamp*1000), isFromMe: !!m.is_from_me,
  })));
});

app.get('/api/wa/reports/summary', async (c) => {
  const db = getDb(c.env);
  const SLA = parseInt(c.env.SLA_THRESHOLD_SECONDS||'900', 10);
  const sessionId = waSessionId(c.req.query('sessionId'));
  const range = c.req.query('range')||'7d';
  const days = range==='30d'?30:range==='1d'?1:7;
  const sinceTs = Math.floor(Date.now()/1000) - days*86400;

  const [totals, rtRows, leadStats] = await Promise.all([
    db.prepare(`
      SELECT (SELECT COUNT(*) FROM wa_chats WHERE session_id=?) as totalChats,
             (SELECT COUNT(*) FROM wa_messages WHERE session_id=? AND timestamp>=?) as totalMessages
    `).bind(sessionId, sessionId, sinceTs).first(),
    db.prepare(
      'SELECT response_time FROM wa_messages WHERE session_id=? AND is_from_me=1 AND response_time IS NOT NULL AND timestamp>=?'
    ).bind(sessionId, sinceTs).all(),
    db.prepare(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) as closed
      FROM wa_leads WHERE session_id=?
    `).bind(sessionId).first(),
  ]);

  const rts = rtRows.results.map(r => r.response_time);
  const avgResponse = rts.length ? Math.round(rts.reduce((a,b)=>a+b,0)/rts.length) : 0;
  const slaOk = rts.filter(t => t<=SLA).length;
  return c.json({
    totalChats: totals.totalChats||0, totalMessages: totals.totalMessages||0,
    totalLeads: leadStats.total||0, closedLeads: leadStats.closed||0,
    avgResponseTime: avgResponse,
    slaCompliance: rts.length ? Math.round(slaOk/rts.length*100) : 100,
    conversionRate: leadStats.total ? Math.round((leadStats.closed/leadStats.total)*100) : 0,
  });
});

app.get('/api/wa/notifications', async (c) => {
  const db = getDb(c.env);
  const SLA = parseInt(c.env.SLA_THRESHOLD_SECONDS||'900', 10);
  const sessionId = waSessionId(c.req.query('sessionId'));
  const now = Math.floor(Date.now()/1000);

  const [breached, warned, hotLeads] = await Promise.all([
    db.prepare(
      'SELECT * FROM wa_chats WHERE session_id=? AND waiting_since IS NOT NULL AND waiting_since<? ORDER BY waiting_since ASC LIMIT 10'
    ).bind(sessionId, now-SLA).all(),
    db.prepare(
      'SELECT * FROM wa_chats WHERE session_id=? AND waiting_since IS NOT NULL AND waiting_since<? AND waiting_since>=? LIMIT 5'
    ).bind(sessionId, now-Math.floor(SLA*0.7), now-SLA).all(),
    db.prepare(
      "SELECT * FROM wa_leads WHERE session_id=? AND status='hot' ORDER BY updated_at DESC LIMIT 3"
    ).bind(sessionId).all(),
  ]);

  const notifs = [];
  breached.results.forEach(r => {
    const mins = Math.round((now-r.waiting_since)/60);
    notifs.push({ type:'critical', title:'SLA Breached', desc:`${r.name||r.phone} waiting ${mins}m — no agent reply`, time:new Date(r.waiting_since*1000).toISOString() });
  });
  warned.results.forEach(r => {
    const mins = Math.round((now-r.waiting_since)/60);
    notifs.push({ type:'warning', title:'Response Overdue', desc:`${r.name||r.phone} waiting ${mins}m`, time:new Date(r.waiting_since*1000).toISOString() });
  });
  hotLeads.results.forEach(r => {
    notifs.push({ type:'info', title:'Hot Lead', desc:`${r.name||r.phone} classified as Hot Lead`, time:new Date(r.updated_at*1000).toISOString() });
  });
  return c.json(notifs.sort((a,b) => new Date(b.time)-new Date(a.time)));
});

app.all('/api/*', (c) => {
  return c.json({ error: 'API route not found' }, 404);
});

// Export a raw Cloudflare Worker fetch handler instead of `export default app`.
// This handles CORS at the lowest level — before Hono routing — so OPTIONS
// preflights are ALWAYS answered with the correct headers regardless of route.
export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = getCorsHeaders(origin);

    // Answer preflight immediately — never reaches Hono
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Let Hono handle the actual request
    const response = await app.fetch(request, env, ctx);

    // Stamp CORS headers onto every response that Hono returns
    const out = new Response(response.body, response);
    Object.entries(corsHeaders).forEach(([k, v]) => out.headers.set(k, v));
    return out;
  },
};

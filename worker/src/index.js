import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import * as cheerio from 'cheerio';

const app = new Hono();

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://www.multitoolhub.space",
  "https://multitoolhub.space",
];

function getCorsHeaders(origin) {
  if (!ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}
// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function getPublicOrigin(c) {
  return c.env.SHORT_DOMAIN || 'http://localhost:5000';
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
  const today = getTodayUtcDate();
  const quota = await db.prepare(
    'SELECT count FROM tool_quotas WHERE user_id = ? AND tool_id = ? AND date = ?'
  ).bind(userId, toolId, today).first();

  return quota?.count || 0;
}

async function incrementUserQuota(db, userId, toolId) {
  const today = getTodayUtcDate();
  await db.prepare(`
    INSERT INTO tool_quotas (user_id, tool_id, date, count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT (user_id, tool_id, date)
    DO UPDATE SET count = count + 1
  `).bind(userId, toolId, today).run();
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
      await c.env.multitool_db.prepare('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)')
        .bind(id, name, sanitizedEmail, dummyHash).run();
      user = { id, name, email: sanitizedEmail };
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

// ==========================================
// TRANSCRIPTION ROUTES
// ==========================================

const TRANSCRIBE_TOOL_ID  = 'transcription';
const TRANSCRIBE_DAILY_MAX = 10;

app.get('/api/transcribe/credits', requireAuth, async (c) => {
  const db     = getDb(c.env);
  const user   = c.get('user');
  const used   = await checkUserQuota(db, user.id, TRANSCRIBE_TOOL_ID);
  const remaining = Math.max(0, TRANSCRIBE_DAILY_MAX - used);
  return c.json({
    data: {
      creditsUsed:      used,
      creditsRemaining: remaining,
      creditsTotal:     TRANSCRIBE_DAILY_MAX,
    }
  });
});

app.post('/api/transcribe', requireAuth, async (c) => {
  const db   = getDb(c.env);
  const user = c.get('user');

  // Check quota
  const used = await checkUserQuota(db, user.id, TRANSCRIBE_TOOL_ID);
  if (used >= TRANSCRIBE_DAILY_MAX) {
    return c.json({ error: 'Daily transcription limit reached. Resets at midnight.' }, 429);
  }

  const groqKey = c.env.GROQ_API_KEY;
  if (!groqKey) return c.json({ error: 'Groq API key not configured' }, 500);

  let formData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: 'Invalid form data' }, 400);
  }

  const file           = formData.get('file');
  const outputLanguage = formData.get('outputLanguage') || 'english';
  const model          = formData.get('model') || 'whisper-large-v3-turbo';

  if (!file || typeof file === 'string') {
    return c.json({ error: 'Audio file required' }, 400);
  }

  // Build Groq Whisper request
  const groqForm = new FormData();
  groqForm.append('file', file);
  groqForm.append('model', model);
  groqForm.append('response_format', 'json');
  if (outputLanguage === 'english') groqForm.append('language', 'en');

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
    return c.json({ error: groqData?.error?.message || 'Groq transcription failed' }, groqRes.status);
  }

  await incrementUserQuota(db, user.id, TRANSCRIBE_TOOL_ID);
  const newUsed = used + 1;

  return c.json({
    data:          { transcript: groqData.text || '' },
    creditsUsed:   newUsed,
    creditsTotal:  TRANSCRIBE_DAILY_MAX,
  });
});

// ==========================================
// GROQ CHAT PROXY (used by speaker diarization)
// ==========================================

app.post('/api/groq/chat', requireAuth, async (c) => {
  const groqKey = c.env.GROQ_API_KEY;
  if (!groqKey) return c.json({ error: 'Groq API key not configured' }, 500);

  let body = {};
  try { body = await c.req.json(); } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
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
  });
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

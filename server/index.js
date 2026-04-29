import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';
import { cors } from 'hono/cors';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import * as cheerio from 'cheerio';

const app = new Hono();

// ✅ FIX 1: Single cors() middleware — handles OPTIONS preflight automatically.
// Do NOT add a separate app.options('*', cors()) — it causes a race condition
// where an unconfigured cors() responds before your allowed-origins list is checked.
app.use('*', cors({
  origin: (origin) => {
    const allowed = [
      'https://www.multitoolhub.space',
      'https://multitoolhub.space',
      'http://localhost:5173',
      'http://localhost:3000',
    ];
    return (origin && allowed.includes(origin)) ? origin : null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposeHeaders: ['Content-Length', 'Content-Type'],
  credentials: true,
  maxAge: 86400, // Cache preflight for 24h — reduces OPTIONS round trips
}));

// ✅ FIX 4: COOP header applied BEFORE routes so it covers all responses
app.use('*', async (c, next) => {
  await next();
  c.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  c.header('Vary', 'Origin'); // ✅ FIX 2: Prevent CDN serving wrong-origin cached responses
});

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

// ==========================================
// AUTH MIDDLEWARE
// ==========================================

const cloudflareAccessMiddleware = async (c, next) => {
  // ✅ FIX 3: Skip auth entirely for OPTIONS preflight — never block CORS handshake
  if (c.req.method === 'OPTIONS') {
    return await next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    c.set('user', null);
    return await next();
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256');
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

app.use('/api/*', authMiddleware);

// ==========================================
// HEALTH & DEBUG
// ==========================================

app.get('/api/health', (c) => {
  const envKeys = Object.keys(c.env || {});
  return c.json({ ok: true, envKeys, hasDb: !!c.env.multitool_db });
});

// ==========================================
// GOOGLE AUTH
// ==========================================

app.post('/api/auth/google', async (c) => {
  console.log('🔥 HIT GOOGLE AUTH ROUTE');
  try {
    const body = await c.req.json();
    const token = body.token;

    if (!token) return c.json({ error: 'Token missing' }, 400);

    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    const googleData = await googleRes.json();

    if (googleData.error) {
      return c.json({ error: 'Invalid Google token', details: googleData }, 401);
    }

    const email = googleData.email;
    const name = googleData.name || 'User';
    const sanitizedEmail = email.trim().toLowerCase();

    let user = await c.env.multitool_db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(sanitizedEmail)
      .first();

    if (!user) {
      const id = nanoid();
      const dummyHash = bcrypt.hashSync(nanoid(), 10);
      await c.env.multitool_db
        .prepare('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)')
        .bind(id, name, sanitizedEmail, dummyHash)
        .run();
      user = { id, name, email: sanitizedEmail };
    }

    if (!c.env.JWT_SECRET) {
      console.error('JWT_SECRET missing');
      return c.json({ error: 'Server misconfigured' }, 500);
    }

    const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    const payload = { id: user.id, email: user.email, exp };
    const jwtToken = await sign(payload, c.env.JWT_SECRET, 'HS256');

    return c.json({
      success: true,
      data: {
        token: jwtToken,
        user: { id: user.id, email: user.email, name: user.name },
      },
    });
  } catch (err) {
    console.error('💥 Google auth error:', err);
    return c.json({ error: 'Server error', message: err.message }, 500);
  }
});

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

app.post('/api/auth/register', async (c) => {
  const { email: rawEmail, password } = await c.req.json();
  if (!rawEmail || !password) return c.json({ error: 'Email and password required' }, 400);

  const email = rawEmail.trim().toLowerCase();
  const existing = await c.env.multitool_db
    .prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first();
  if (existing) return c.json({ error: 'Email already exists' }, 400);

  const id = nanoid();
  const hash = bcrypt.hashSync(password, 10);
  await c.env.multitool_db
    .prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)')
    .bind(id, email, hash)
    .run();

  if (!c.env.JWT_SECRET) return c.json({ error: 'Server misconfigured' }, 500);

  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const token = await sign({ id, email, exp }, c.env.JWT_SECRET, 'HS256');
  return c.json({ data: { user: { id, email }, token } });
});

app.post('/api/auth/login', async (c) => {
  const { email: rawEmail, password } = await c.req.json();
  if (!rawEmail || !password) return c.json({ error: 'Email and password required' }, 400);
  const email = rawEmail.trim().toLowerCase();

  const user = await c.env.multitool_db
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(email)
    .first();

  if (!user) return c.json({ error: 'Invalid email or password' }, 401);

  try {
    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) return c.json({ error: 'Invalid email or password' }, 401);
  } catch (err) {
    console.error('bcrypt error:', err);
    return c.json({ error: 'Server error during login' }, 500);
  }

  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const token = await sign({ id: user.id, email: user.email, exp }, c.env.JWT_SECRET, 'HS256');
  return c.json({ data: { user: { id: user.id, email: user.email }, token } });
});

app.get('/api/auth/me', requireAuth, async (c) => {
  const user = c.get('user');
  return c.json({ data: { user } });
});

app.post('/api/auth/test-token', async (c) => {
  const { token } = await c.req.json();
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256');
    return c.json({ success: true, payload });
  } catch (err) {
    return c.json({ success: false, error: err.message });
  }
});

app.post('/api/auth/forgot-password', async (c) => {
  const { email: rawEmail } = await c.req.json();
  const email = rawEmail?.trim().toLowerCase();
  if (!email) return c.json({ message: 'If that email exists a reset link has been sent' });

  const user = await c.env.multitool_db
    .prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first();

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
        Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: c.env.FROM_EMAIL,
        to: email,
        subject: 'Reset Your Password - MultiTool',
        html: `
          <div style="font-family:sans-serif;padding:20px;max-width:600px;margin:0 auto;background:#f9fafb;border-radius:8px;">
            <h2 style="color:#4f46e5;">Reset Your Password</h2>
            <p>Click below to reset your password. This link expires in 15 minutes.</p>
            <a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:white;text-decoration:none;border-radius:6px;font-weight:bold;margin:20px 0;">Reset Password</a>
            <p style="font-size:14px;color:#6b7280;">If you didn't request this, ignore this email.</p>
          </div>
        `,
      }),
    });
  }

  return c.json({ message: 'If that email exists a reset link has been sent' });
});

app.get('/api/auth/verify-reset-token/:token', async (c) => {
  const token = c.req.param('token');
  const reset = await c.env.multitool_db
    .prepare('SELECT * FROM password_resets WHERE token = ? AND used = 0')
    .bind(token)
    .first();

  if (!reset || new Date(reset.expires_at).getTime() <= Date.now()) {
    return c.json({ valid: false, error: 'Token expired or invalid' });
  }

  return c.json({ valid: true });
});

app.post('/api/auth/reset-password', async (c) => {
  const { token, newPassword } = await c.req.json();

  const reset = await c.env.multitool_db
    .prepare('SELECT * FROM password_resets WHERE token = ? AND used = 0')
    .bind(token)
    .first();

  if (!reset || new Date(reset.expires_at).getTime() <= Date.now()) {
    return c.json({ error: 'Token expired or invalid' }, 400);
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  await c.env.multitool_db
    .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(hash, reset.user_id)
    .run();
  await c.env.multitool_db
    .prepare('UPDATE password_resets SET used = 1 WHERE token = ?')
    .bind(token)
    .run();

  return c.json({ message: 'Password reset successfully' });
});

// ==========================================
// LINK & FILE SHARE ROUTES
// ==========================================

app.post('/api/share/upload', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'];
  const expiresInSeconds = Number(body['expiresInSeconds']) || 0;
  const formConfig = body['formConfig'];
  const gate_bg_key = body['gate_bg_key'];
  const user = c.get('user');

  if (!file) return c.json({ error: 'No file uploaded' }, 400);

  const slug = nanoid(8);
  const key = `${slug}-${sanitizeFileName(file.name)}`;
  const arrayBuffer = await file.arrayBuffer();

  await c.env.MY_BUCKET.put(key, arrayBuffer, {
    httpMetadata: { contentType: file.type },
  });

  const expiresAt = expiresInSeconds > 0
    ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
    : null;

  await c.env.multitool_db.prepare(`
    INSERT INTO links (slug, original_name, r2_key, mime_type, size, user_id, expires_at, form_config, requires_data_collection, gate_bg_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    slug, file.name, key, file.type, file.size,
    user ? user.id : null, expiresAt,
    formConfig || null, formConfig ? 1 : 0, gate_bg_key || null
  ).run();

  const shortDomain = getPublicOrigin(c);
  return c.json({ data: { slug, shortUrl: `${shortDomain}/s/${slug}`, expiresAt } });
});

app.post('/api/upload-asset', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'];
  if (!file) return c.json({ error: 'No file' }, 400);

  const key = `assets/${nanoid(12)}-${sanitizeFileName(file.name)}`;
  const arrayBuffer = await file.arrayBuffer();

  await c.env.MY_BUCKET.put(key, arrayBuffer, {
    httpMetadata: { contentType: file.type },
  });

  return c.json({ data: { key } });
});

app.post('/api/shorten', async (c) => {
  const { longUrl, customSlug, formConfig, gate_bg_key } = await c.req.json();
  const user = c.get('user');

  if (!longUrl) return c.json({ error: 'longUrl required' }, 400);

  const slug = customSlug || nanoid(8);
  const existing = await c.env.multitool_db
    .prepare('SELECT slug FROM links WHERE slug = ?')
    .bind(slug)
    .first();
  if (existing) return c.json({ error: 'Slug already exists' }, 400);

  await c.env.multitool_db.prepare(`
    INSERT INTO links (slug, long_url, user_id, form_config, requires_data_collection, gate_bg_key)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    slug, longUrl,
    user ? user.id : null,
    formConfig ? JSON.stringify(formConfig) : null,
    formConfig ? 1 : 0,
    gate_bg_key || null
  ).run();

  const shortDomain = getPublicOrigin(c);
  return c.json({ data: { slug, shortUrl: `${shortDomain}/s/${slug}` } });
});

// ==========================================
// PUBLIC RESOLVER & LEAD GATE
// ==========================================

app.get('/s/:slug', async (c) => {
  const slug = c.req.param('slug');
  const link = await c.env.multitool_db
    .prepare('SELECT * FROM links WHERE slug = ?')
    .bind(slug)
    .first();

  if (!link) return c.text('Link not found', 404);

  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
    return c.redirect(`${getFrontendOrigin(c)}/link-expired/${slug}`);
  }

  await c.env.multitool_db
    .prepare('UPDATE links SET download_count = download_count + 1 WHERE slug = ?')
    .bind(slug)
    .run();

  const ip = c.req.header('cf-connecting-ip') || 'Unknown';
  const country = c.req.header('cf-ipcountry') || 'Unknown';
  const userAgent = c.req.header('user-agent') || '';
  const referer = c.req.header('referer') || '';

  await c.env.multitool_db.prepare(`
    INSERT INTO analytics (slug, ip, user_agent, referer, country)
    VALUES (?, ?, ?, ?, ?)
  `).bind(slug, ip, userAgent, referer, country).run();

  if (link.requires_data_collection) {
    return c.redirect(`${getFrontendOrigin(c)}/gate/${slug}`);
  }

  if (link.r2_key) {
    const object = await c.env.MY_BUCKET.get(link.r2_key);
    if (!object) return c.text('File not found in storage', 404);

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Content-Disposition', `inline; filename="${sanitizeFileName(link.original_name)}"`);
    headers.set('Content-Type', link.mime_type || 'application/octet-stream');

    return new Response(object.body, { headers });
  }

  return c.redirect(link.long_url);
});

app.get('/api/s/:slug/config', async (c) => {
  const slug = c.req.param('slug');
  const link = await c.env.multitool_db
    .prepare('SELECT form_config FROM links WHERE slug = ?')
    .bind(slug)
    .first();
  if (!link) return c.json({ error: 'Not found' }, 404);
  return c.json({ data: { formConfig: link.form_config ? JSON.parse(link.form_config) : null } });
});

app.post('/api/s/:slug/submit', async (c) => {
  const slug = c.req.param('slug');
  const visitorData = await c.req.json();
  const link = await c.env.multitool_db
    .prepare('SELECT * FROM links WHERE slug = ?')
    .bind(slug)
    .first();

  if (!link) return c.json({ error: 'Not found' }, 404);

  const ip = c.req.header('cf-connecting-ip') || 'Unknown';

  const latestAnalytics = await c.env.multitool_db.prepare(`
    SELECT id FROM analytics WHERE slug = ? AND ip = ? ORDER BY timestamp DESC LIMIT 1
  `).bind(slug, ip).first();

  if (latestAnalytics) {
    await c.env.multitool_db
      .prepare('UPDATE analytics SET visitor_data = ? WHERE id = ?')
      .bind(JSON.stringify(visitorData), latestAnalytics.id)
      .run();
  } else {
    await c.env.multitool_db.prepare(`
      INSERT INTO analytics (slug, ip, visitor_data) VALUES (?, ?, ?)
    `).bind(slug, ip, JSON.stringify(visitorData)).run();
  }

  return c.json({ data: { longUrl: link.long_url } });
});

app.get('/api/s/:slug/background', async (c) => {
  const slug = c.req.param('slug');
  const link = await c.env.multitool_db
    .prepare('SELECT gate_bg_key FROM links WHERE slug = ?')
    .bind(slug)
    .first();

  if (!link || !link.gate_bg_key) return c.json({ data: null });

  return c.json({ data: { backgroundUrl: `${getPublicOrigin(c)}/api/assets/${link.gate_bg_key}` } });
});

app.get('/api/assets/:key{.+}', async (c) => {
  const key = c.req.param('key');
  const object = await c.env.MY_BUCKET.get(key);
  if (!object) return c.text('Not found', 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  return new Response(object.body, { headers });
});

// ==========================================
// DASHBOARD & ANALYTICS
// ==========================================

app.get('/api/share/analytics', requireAuth, async (c) => {
  const user = c.get('user');

  const { results: links } = await c.env.multitool_db
    .prepare('SELECT * FROM links WHERE user_id = ? ORDER BY created_at DESC')
    .bind(user.id)
    .all();

  if (links.length === 0) {
    return c.json({ data: { totalClicks: 0, uniqueVisitors: 0, topCountries: [], topReferers: [], sparkline: [], links: [], leads: [] } });
  }

  const { results: analytics } = await c.env.multitool_db.prepare(`
    SELECT a.* FROM analytics a
    JOIN links l ON a.slug = l.slug
    WHERE l.user_id = ?
  `).bind(user.id).all();

  let visitors = new Set();
  let countries = {};
  let referers = {};
  let clicksOverTime = {};
  let leads = [];

  analytics.forEach(row => {
    if (row.ip) visitors.add(row.ip);
    if (row.country) countries[row.country] = (countries[row.country] || 0) + 1;
    if (row.referer) {
      try {
        const r = new URL(row.referer).hostname;
        referers[r] = (referers[r] || 0) + 1;
      } catch {
        referers['Direct'] = (referers['Direct'] || 0) + 1;
      }
    }
    const date = row.timestamp.split(' ')[0];
    clicksOverTime[date] = (clicksOverTime[date] || 0) + 1;

    if (row.visitor_data) {
      try {
        leads.push({ slug: row.slug, data: JSON.parse(row.visitor_data), timestamp: row.timestamp, ip: row.ip });
      } catch (e) {
        console.error('Failed to parse visitor_data', e);
      }
    }
  });

  const linksWithStats = links.map(link => {
    const linkAnalytics = analytics.filter(a => a.slug === link.slug);
    return {
      ...link,
      lastClicked: linkAnalytics.length > 0 ? linkAnalytics[linkAnalytics.length - 1].timestamp : null,
      leadsCount: linkAnalytics.filter(a => a.visitor_data).length,
      isExpired: link.expires_at && new Date(link.expires_at).getTime() <= Date.now(),
    };
  });

  return c.json({
    data: {
      totalClicks: analytics.length,
      uniqueVisitors: visitors.size,
      topCountries: Object.entries(countries).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5),
      topReferers: Object.entries(referers).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5),
      sparkline: Object.entries(clicksOverTime).map(([date, clicks]) => ({ date, clicks })),
      links: linksWithStats,
      leads,
    },
  });
});

app.delete('/api/links', requireAuth, async (c) => {
  const { slugs } = await c.req.json();
  const user = c.get('user');
  if (!slugs || slugs.length === 0) return c.json({ error: 'Slugs required' }, 400);

  const placeholders = slugs.map(() => '?').join(',');
  const { results: targetLinks } = await c.env.multitool_db
    .prepare(`SELECT r2_key FROM links WHERE user_id = ? AND slug IN (${placeholders})`)
    .bind(user.id, ...slugs)
    .all();

  for (const link of targetLinks) {
    if (link.r2_key) {
      await c.env.MY_BUCKET.delete(link.r2_key).catch(e => console.error('R2 deletion failed', e));
    }
  }

  await c.env.multitool_db
    .prepare(`DELETE FROM links WHERE user_id = ? AND slug IN (${placeholders})`)
    .bind(user.id, ...slugs)
    .run();

  return c.json({ message: 'Deleted successfully' });
});

// ==========================================
// FEEDBACK
// ==========================================

app.post('/api/feedback', async (c) => {
  const { email, message, context } = await c.req.json();
  if (!message) return c.json({ error: 'Message required' }, 400);
  const fullMessage = context ? `[Context: ${context}] ${message}` : message;
  await c.env.multitool_db
    .prepare('INSERT INTO feedback (email, message) VALUES (?, ?)')
    .bind(email || '', fullMessage)
    .run();
  return c.json({ message: 'Feedback received' });
});

app.get('/api/feedback', requireAuth, async (c) => {
  const { results: feedback } = await c.env.multitool_db
    .prepare('SELECT * FROM feedback ORDER BY created_at DESC LIMIT 100')
    .all();
  return c.json({ data: feedback });
});

// ==========================================
// TOOL USAGE & TRENDING
// ==========================================

app.post('/api/tools/usage', async (c) => {
  const { toolId } = await c.req.json();
  if (!toolId) return c.json({ error: 'toolId required' }, 400);

  const ip = c.req.header('cf-connecting-ip') || 'Unknown';
  const country = c.req.header('cf-ipcountry') || 'Unknown';

  await c.env.multitool_db
    .prepare('INSERT INTO tool_usage (tool_id, ip, country) VALUES (?, ?, ?)')
    .bind(toolId, ip, country)
    .run();

  return c.json({ message: 'Usage recorded' });
});

app.get('/api/tools/trending', async (c) => {
  const { results } = await c.env.multitool_db.prepare(`
    SELECT tool_id, COUNT(*) as usageCount
    FROM tool_usage
    WHERE timestamp >= date('now', '-7 days')
    GROUP BY tool_id
    ORDER BY usageCount DESC
  `).all();
  return c.json({ data: results });
});

// ==========================================
// TRANSCRIBE
// ==========================================

app.get('/api/transcribe/credits', requireAuth, async (c) => {
  const user = c.get('user');
  const DAILY_LIMIT = 10;
  const db = getDb(c.env);
  const used = await checkUserQuota(db, user.id, 'transcribe');
  return c.json({
    data: {
      creditsUsed: used,
      creditsRemaining: Math.max(0, DAILY_LIMIT - used),
      creditsTotal: DAILY_LIMIT,
      resetsAt: 'midnight UTC',
    },
  });
});

app.post('/api/transcribe', async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const db = getDb(c.env);
    const formData = await c.req.formData();
    const file = formData.get('file');
    const rawOutputLanguage = String(formData.get('outputLanguage') || 'english').toLowerCase();
    const allowedOutputLanguages = new Set(['english', 'hinglish', 'original']);
    const outputLanguage = allowedOutputLanguages.has(rawOutputLanguage) ? rawOutputLanguage : 'english';

    if (!file) return c.json({ error: 'Audio file required' }, 400);

    const DAILY_LIMIT = 10;
    const usage = await checkUserQuota(db, user.id, 'transcribe');
    const groqApiKey = getRequiredEnvValue(c.env, 'GROQ_API_KEY');

    if (usage >= DAILY_LIMIT) {
      return c.json({ error: 'Daily limit reached', creditsUsed: usage, creditsTotal: DAILY_LIMIT, resetsAt: 'midnight UTC' }, 429);
    }

    if (!groqApiKey || groqApiKey === 'your-groq-key-here') {
      return c.json({ error: 'Groq API key is not configured correctly' }, 500);
    }

    const groqForm = new FormData();
    groqForm.append('file', file);
    groqForm.append('model', 'whisper-large-v3');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqApiKey}` },
      body: groqForm,
    });

    const rawText = await response.text();
    let data;
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      console.error('Groq transcription returned invalid JSON:', rawText);
      return c.json({ error: 'Transcription failed' }, 500);
    }

    if (!response.ok) {
      const message = data?.error?.message || 'Transcription failed';
      if (response.status === 401) return c.json({ error: 'Groq API key is invalid or expired' }, 500);
      return c.json({ error: message }, 500);
    }

    const originalTranscript = data.text || '';
    let finalTranscript = originalTranscript;

    const runGroqChat = async (systemPrompt, userPrompt) => {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqApiKey}` },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          temperature: 0.3,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || 'Post-processing failed');
      const d = text ? JSON.parse(text) : {};
      return d?.choices?.[0]?.message?.content?.trim() || '';
    };

    if (outputLanguage === 'english' && originalTranscript) {
      try {
        const translated = await runGroqChat(
          'Translate the given Hindi or Hinglish text to clear natural English. Preserve meaning and intent. Output only translated English text.',
          originalTranscript
        );
        if (translated) finalTranscript = translated;
      } catch (e) {
        console.error('English translation error:', e);
      }
    }

    if (outputLanguage === 'hinglish' && originalTranscript) {
      try {
        const convert = (strict = false) => runGroqChat(
          strict
            ? 'Transliterate Hindi text to Hinglish using only Roman letters (a-z), numbers, spaces, and punctuation. Do not output Devanagari. Output only the converted text.'
            : 'Convert this Hindi text into Hinglish (Roman script). Do NOT translate meaning. Keep same words, just convert script naturally.',
          originalTranscript
        );
        let converted = await convert(false);
        if (converted && containsDevanagari(converted)) converted = await convert(true);
        if (converted && !containsDevanagari(converted)) finalTranscript = converted;
      } catch (e) {
        console.error('Hinglish conversion error:', e);
      }
    }

    await incrementUserQuota(db, user.id, 'transcribe');

    return c.json({
      data: { transcript: finalTranscript },
      creditsUsed: usage + 1,
      creditsTotal: DAILY_LIMIT,
      resetsAt: 'midnight UTC',
    });
  } catch (err) {
    console.error('Transcription error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ==========================================
// TEXT TO SQL
// ==========================================

app.post('/api/text-to-sql', requireAuth, async (c) => {
  const user = c.get('user');
  const DAILY_LIMIT = 20;
  const db = getDb(c.env);
  const groqApiKey = getRequiredEnvValue(c.env, 'GROQ_API_KEY');

  const currentCount = await checkUserQuota(db, user.id, 'text-to-sql');
  if (currentCount >= DAILY_LIMIT) {
    return c.json({ error: `Daily limit of ${DAILY_LIMIT} credits reached. Resets at midnight UTC.`, creditsUsed: currentCount, creditsTotal: DAILY_LIMIT }, 429);
  }

  const { question, schema } = await c.req.json();
  if (!question || !schema) return c.json({ error: 'Question and schema required' }, 400);
  if (!groqApiKey || groqApiKey === 'your-groq-key-here') {
    return c.json({ error: 'Groq API key is not configured correctly' }, 500);
  }

  try {
    const fetchWithRetry = async (retry = 0) => {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqApiKey}` },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          max_tokens: 200,
          temperature: 0.1,
          messages: [
            { role: 'system', content: 'You are a SQL expert. Reply with ONLY the SQL query. No explanation, no markdown, no backticks.' },
            { role: 'user', content: `Database schema:\n${schema}\n\nConvert this to SQL:\n"${question}"` },
          ],
        }),
      });
      if (res.status === 429 && retry < 1) {
        await new Promise(r => setTimeout(r, 3000));
        return fetchWithRetry(retry + 1);
      }
      return res;
    };

    const response = await fetchWithRetry();
    const responseText = await response.text();

    if (!response.ok) {
      try {
        const err = JSON.parse(responseText);
        return c.json({ error: `Groq error: ${err?.error?.message || response.status}` }, 500);
      } catch {
        return c.json({ error: `Groq error (${response.status}): ${responseText.substring(0, 100)}` }, 500);
      }
    }

    const sql = JSON.parse(responseText).choices?.[0]?.message?.content?.trim();
    if (!sql) return c.json({ error: 'Groq returned empty response' }, 500);

    await incrementUserQuota(db, user.id, 'text-to-sql');
    return c.json({ data: { sql }, creditsUsed: currentCount + 1, creditsTotal: DAILY_LIMIT });
  } catch (err) {
    console.error('text-to-sql error:', err.message);
    return c.json({ error: `Exception: ${err.message}` }, 500);
  }
});

app.get('/api/text-to-sql/credits', requireAuth, async (c) => {
  const user = c.get('user');
  const DAILY_LIMIT = 20;
  const db = getDb(c.env);
  const used = await checkUserQuota(db, user.id, 'text-to-sql');
  return c.json({ data: { creditsUsed: used, creditsRemaining: DAILY_LIMIT - used, creditsTotal: DAILY_LIMIT, resetsAt: 'midnight UTC' } });
});

// ==========================================
// REMOVE BACKGROUND
// ==========================================

app.post('/api/remove-bg', requireAuth, async (c) => {
  const user = c.get('user');
  const DAILY_LIMIT = 5;
  const db = getDb(c.env);

  const currentCount = await checkUserQuota(db, user.id, 'remove-bg');
  if (currentCount >= DAILY_LIMIT) {
    return c.json({ error: `Daily limit of ${DAILY_LIMIT} removals reached. Resets at midnight UTC.`, creditsUsed: currentCount, creditsTotal: DAILY_LIMIT }, 429);
  }

  try {
    const formData = await c.req.formData();
    const imageFile = formData.get('image_file');
    if (!imageFile) return c.json({ error: 'Image file required' }, 400);

    const removeBgFormData = new FormData();
    removeBgFormData.append('image_file', imageFile);

    const res = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': c.env.REMOVE_BG_API_KEY },
      body: removeBgFormData,
    });

    if (!res.ok) {
      const errText = await res.text();
      return c.json({ error: `Remove.bg error: ${errText}` }, 500);
    }

    const arrayBuffer = await res.arrayBuffer();
    await incrementUserQuota(db, user.id, 'remove-bg');

    return new Response(arrayBuffer, { headers: { 'Content-Type': 'image/png' } });
  } catch (err) {
    console.error('remove-bg error:', err.message);
    return c.json({ error: `Exception: ${err.message}` }, 500);
  }
});

app.get('/api/remove-bg/credits', requireAuth, async (c) => {
  const user = c.get('user');
  const DAILY_LIMIT = 5;
  const db = getDb(c.env);
  const used = await checkUserQuota(db, user.id, 'remove-bg');
  return c.json({ data: { creditsUsed: used, creditsRemaining: DAILY_LIMIT - used, creditsTotal: DAILY_LIMIT, resetsAt: 'midnight UTC' } });
});

export default app;
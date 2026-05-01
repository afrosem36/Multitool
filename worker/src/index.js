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
  // Verify user exists before incrementing quota to avoid foreign key constraint errors
  const exists = await userExists(db, userId);
  if (!exists) {
    console.warn(`User ${userId} not found in database, skipping quota increment`);
    return;
  }
  
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

  return c.json({ data: { shortUrl: getGatePageUrl(c, slug), expiresAt, slug } });
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

  return c.json({
    data: {
      formConfig,
      requiresDataCollection: !!link.requires_data_collection,
      fileName: link.original_name || null,
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
    },
  });
});

app.post('/api/s/:slug/submit', async (c) => {
  const slug = c.req.param('slug');
  const db = getDb(c.env);
  const link = await db.prepare('SELECT long_url, requires_data_collection, expires_at FROM links WHERE slug = ?').bind(slug).first();
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

  return c.json({ data: { longUrl: link.long_url } });
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

    const used = await checkUserQuota(db, user.id, TEXT_TO_SQL_TOOL_ID);
    if (used >= TEXT_TO_SQL_DAILY_MAX) {
      return c.json({ error: 'Daily limit reached. Resets at midnight UTC.', creditsTotal: TEXT_TO_SQL_DAILY_MAX }, 429);
    }

    const groqKey = getRequiredEnvValue(c.env, 'GROQ_API_KEY');
    if (!groqKey) return c.json({ error: 'Groq API key not configured' }, 500);

    const systemPrompt = `You are an expert SQL query generator. Given a database schema and a natural language question, generate a correct and efficient SQL query.\n\nRules:\n- Return ONLY the SQL query, no explanation, no markdown, no code blocks\n- Use standard SQL syntax compatible with most databases\n- If the question cannot be answered with the given schema, return: SELECT 'Unable to generate query for this question' as error`;

    let groqRes;
    try {
      groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Schema:\n${schema}\n\nQuestion: ${question}` },
          ],
          temperature: 0.1,
          max_tokens: 512,
        }),
      });
    } catch (err) {
      return c.json({ error: 'Failed to reach Groq API', detail: err.message }, 502);
    }

    let groqData;
    try {
      groqData = await groqRes.json();
    } catch {
      return c.json({ error: `Groq returned non-JSON response (status ${groqRes.status})` }, 502);
    }

    if (!groqRes.ok) {
      return c.json({ error: groqData?.error?.message || 'Groq request failed' }, groqRes.status);
    }

    const sql = groqData.choices?.[0]?.message?.content?.trim() || '';
    if (!sql) return c.json({ error: 'Groq returned empty response' }, 502);

    await incrementUserQuota(db, user.id, TEXT_TO_SQL_TOOL_ID);
    const newUsed = used + 1;

    return c.json({
      data: { sql },
      creditsUsed:  newUsed,
      creditsTotal: TEXT_TO_SQL_DAILY_MAX,
    });
  } catch (err) {
    console.error('[text-to-sql] Unhandled error:', err);
    return c.json({ error: 'Internal server error', detail: err.message }, 500);
  }
});

app.all('/api/*', (c) => {
  return c.json({ error: 'API route not found' }, 404);
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

  const userGroqKey    = (formData.get('groqApiKey') || '').trim();
  const groqKey        = userGroqKey || c.env.GROQ_API_KEY;
  const usingOwnKey    = !!userGroqKey;

  if (!groqKey) return c.json({ error: 'Groq API key not configured' }, 500);

  // Quota only applies when using shared server key
  let used = 0;
  if (!usingOwnKey) {
    used = await checkUserQuota(db, user.id, TRANSCRIBE_TOOL_ID);
    if (used >= TRANSCRIBE_DAILY_MAX) {
      return c.json({ error: 'Daily transcription limit reached. Resets at midnight.' }, 429);
    }
  }

  const file           = formData.get('file');
  const outputLanguage = formData.get('outputLanguage') || 'english';
  const model          = formData.get('model') || 'whisper-large-v3-turbo';
  const wantTimestamps = formData.get('timestamps') === 'true';

  if (!file || typeof file === 'string') {
    return c.json({ error: 'Audio file required' }, 400);
  }

  const groqForm = new FormData();
  groqForm.append('file', file);
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
    return c.json({ error: groqData?.error?.message || 'Groq transcription failed' }, groqRes.status);
  }

  if (!usingOwnKey) {
    await incrementUserQuota(db, user.id, TRANSCRIBE_TOOL_ID);
    used += 1;
  }

  return c.json({
    data: {
      transcript: groqData.text || '',
      ...(wantTimestamps && groqData.segments ? { segments: groqData.segments } : {}),
    },
    creditsUsed:  usingOwnKey ? null : used,
    creditsTotal: usingOwnKey ? null : TRANSCRIBE_DAILY_MAX,
    usingOwnKey,
  });
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

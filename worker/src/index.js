import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import * as cheerio from 'cheerio';

const app = new Hono();

// Custom CORS middleware - FIRST
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');

  // Handle preflight
  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin || 'https://www.multitoolhub.space',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true'
      }
    });
  }

  await next();

  // Add headers to ALL responses
  c.header('Access-Control-Allow-Origin', origin || 'https://www.multitoolhub.space');
  c.header('Access-Control-Allow-Credentials', 'true');
});

// Error handler - LAST
app.use('*', async (c, next) => {
  try {
    await next();
  } catch (err) {
    console.error('🔥 Worker crash:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': c.req.header('Origin') || '*',
        'Access-Control-Allow-Credentials': 'true'
      }
    });
  }
  c.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
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
  const envKeys = Object.keys(c.env || {});
  console.log('Environment Keys:', envKeys);
  return c.json({
    ok: true,
    envKeys,
    hasDb: !!c.env.multitool_db
  });
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

    await c.env.multitool_db.prepare('INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)'),
    .bind(token, user.id, expiresAt).run();

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

// Rest of routes... (file truncated for brevity - the full Hono app continues identically)
export default app;

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as cheerio from 'cheerio';

const app = new Hono();

app.use('*', cors());

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

const getS3Client = (env) => {
  return new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
};

function getPublicOrigin(c) {
  return c.env.SHORT_DOMAIN || 'http://localhost:5000';
}

function getFrontendOrigin(c) {
  return c.env.FRONTEND_URL || 'http://localhost:5173';
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

// Authentication Middleware
const authMiddleware = async (c, next) => {
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

const requireAuth = async (c, next) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  await next();
};

app.use('*', authMiddleware);

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

app.post('/api/auth/register', async (c) => {
  const { email: rawEmail, password } = await c.req.json();
  if (!rawEmail || !password) return c.json({ error: 'Email and password required' }, 400);

  const email = rawEmail.trim().toLowerCase();

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return c.json({ error: 'Email already exists' }, 400);

  const id = nanoid();
  const hash = bcrypt.hashSync(password, 10);
  await c.env.DB.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)')
    .bind(id, email, hash).run();

  const exp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days
  const token = await sign({ id, email, exp }, c.env.JWT_SECRET, "HS256");
  return c.json({ data: { user: { id, email }, token } });
});

app.post('/api/auth/login', async (c) => {
  const { email: rawEmail, password } = await c.req.json();
  const email = rawEmail.trim().toLowerCase();
  
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  
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

  const exp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days
  const token = await sign({ id: user.id, email: user.email, exp }, c.env.JWT_SECRET, "HS256");
  return c.json({ data: { user: { id: user.id, email: user.email }, token } });
});

app.get('/api/auth/me', requireAuth, async (c) => {
  const user = c.get('user');
  return c.json({ data: { user } });
});

// Debug endpoint to test token verification
app.post('/api/auth/test-token', async (c) => {
  const { token } = await c.req.json();
  try {
    const payload = await verify(token, c.env.JWT_SECRET, "HS256");
    return c.json({ success: true, payload });
  } catch (err) {
    return c.json({ success: false, error: err.message });
  }
});

// ==========================================
// LINK & FILE SHARE ROUTES
// ==========================================

app.post('/api/share/upload-url', async (c) => {
  const { originalName, mimeType = 'application/octet-stream', size, expiresInSeconds } = await c.req.json();
  
  const validationError = getShareValidationError({ originalName, size });
  if (validationError) return c.json({ error: validationError }, 400);

  const slug = nanoid(8);
  const key = `${slug}-${sanitizeFileName(originalName)}`;
  
  const s3Client = getS3Client(c.env);
  const uploadUrl = await getSignedUrl(
    s3Client,
    new PutObjectCommand({ Bucket: c.env.R2_BUCKET_NAME, Key: key, ContentType: mimeType }),
    { expiresIn: 600 }
  );

  return c.json({ data: { slug, key, uploadUrl, expiresInSeconds } });
});

app.post('/api/share/complete-upload', async (c) => {
  const { slug, key, originalName, mimeType = 'application/octet-stream', size, expiresInSeconds, formConfig } = await c.req.json();
  const user = c.get('user');

  if (!slug || !key) return c.json({ error: 'Invalid reference' }, 400);

  // Note: We skip HeadObject check here to save time, assuming client successfully uploaded to R2 directly.
  const expiresAt = expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000).toISOString() : null;

  await c.env.DB.prepare(`
    INSERT INTO links (slug, original_name, r2_key, mime_type, size, user_id, form_config, requires_data_collection, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    slug, originalName, key, mimeType, size, 
    user ? user.id : null, 
    formConfig ? JSON.stringify(formConfig) : null,
    formConfig ? 1 : 0,
    expiresAt
  ).run();

  const shortDomain = getPublicOrigin(c);
  return c.json({ data: { slug, shortUrl: `${shortDomain}/s/${slug}` } });
});

app.post('/api/share/upload', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'];
  const user = c.get('user');
  
  if (!file) return c.json({ error: 'No file uploaded' }, 400);

  const slug = nanoid(8);
  const key = `${slug}-${sanitizeFileName(file.name)}`;
  const arrayBuffer = await file.arrayBuffer();

  const s3Client = getS3Client(c.env);
  await s3Client.send(new PutObjectCommand({
    Bucket: c.env.R2_BUCKET_NAME,
    Key: key,
    Body: new Uint8Array(arrayBuffer),
    ContentType: file.type,
  }));

  await c.env.DB.prepare(`
    INSERT INTO links (slug, original_name, r2_key, mime_type, size, user_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(slug, file.name, key, file.type, file.size, user ? user.id : null).run();

  const shortDomain = getPublicOrigin(c);
  return c.json({ data: { slug, shortUrl: `${shortDomain}/s/${slug}` } });
});

app.post('/api/shorten', async (c) => {
  const { longUrl, customSlug, formConfig } = await c.req.json();
  const user = c.get('user');
  
  if (!longUrl) return c.json({ error: 'longUrl required' }, 400);

  const slug = customSlug || nanoid(8);
  const existing = await c.env.DB.prepare('SELECT slug FROM links WHERE slug = ?').bind(slug).first();
  if (existing) return c.json({ error: 'Slug already exists' }, 400);

  await c.env.DB.prepare(`
    INSERT INTO links (slug, long_url, user_id, form_config, requires_data_collection)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    slug, longUrl, 
    user ? user.id : null,
    formConfig ? JSON.stringify(formConfig) : null,
    formConfig ? 1 : 0
  ).run();

  const shortDomain = getPublicOrigin(c);
  return c.json({ data: { slug, shortUrl: `${shortDomain}/s/${slug}` } });
});

// ==========================================
// PUBLIC RESOLVER & LEAD GATE
// ==========================================

app.get('/s/:slug', async (c) => {
  const slug = c.req.param('slug');
  const link = await c.env.DB.prepare('SELECT * FROM links WHERE slug = ?').bind(slug).first();

  if (!link) return c.text('Link not found', 404);

  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
    const frontendUrl = getFrontendOrigin(c);
    return c.redirect(`${frontendUrl}/link-expired/${slug}`);
  }

  // Analytics
  await c.env.DB.prepare('UPDATE links SET download_count = download_count + 1 WHERE slug = ?').bind(slug).run();
  
  const ip = c.req.header('cf-connecting-ip') || 'Unknown';
  const country = c.req.header('cf-ipcountry') || 'Unknown';
  const userAgent = c.req.header('user-agent') || '';
  const referer = c.req.header('referer') || '';

  await c.env.DB.prepare(`
    INSERT INTO analytics (slug, ip, user_agent, referer, country)
    VALUES (?, ?, ?, ?, ?)
  `).bind(slug, ip, userAgent, referer, country).run();

  if (link.requires_data_collection) {
    const frontendUrl = getFrontendOrigin(c);
    return c.redirect(`${frontendUrl}/gate/${slug}`);
  }

  if (link.r2_key) {
    const s3Client = getS3Client(c.env);
    const downloadUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: c.env.R2_BUCKET_NAME,
        Key: link.r2_key,
        ResponseContentDisposition: `inline; filename="${sanitizeFileName(link.original_name)}"`,
        ResponseContentType: link.mime_type,
      }),
      { expiresIn: 60 }
    );
    return c.redirect(downloadUrl);
  }

  return c.redirect(link.long_url);
});

// Gate config fetcher (Public)
app.get('/api/s/:slug/config', async (c) => {
  const slug = c.req.param('slug');
  const link = await c.env.DB.prepare('SELECT form_config FROM links WHERE slug = ?').bind(slug).first();
  if (!link) return c.json({ error: 'Not found' }, 404);
  return c.json({ data: { formConfig: link.form_config ? JSON.parse(link.form_config) : null } });
});

// Gate submission (Public)
app.post('/api/s/:slug/submit', async (c) => {
  const slug = c.req.param('slug');
  const visitorData = await c.req.json();
  const link = await c.env.DB.prepare('SELECT * FROM links WHERE slug = ?').bind(slug).first();

  if (!link) return c.json({ error: 'Not found' }, 404);

  const ip = c.req.header('cf-connecting-ip') || 'Unknown';
  
  // Find latest analytics row for this IP and slug, update it with visitor data
  const latestAnalytics = await c.env.DB.prepare(`
    SELECT id FROM analytics WHERE slug = ? AND ip = ? ORDER BY timestamp DESC LIMIT 1
  `).bind(slug, ip).first();

  if (latestAnalytics) {
    await c.env.DB.prepare('UPDATE analytics SET visitor_data = ? WHERE id = ?')
      .bind(JSON.stringify(visitorData), latestAnalytics.id).run();
  } else {
    await c.env.DB.prepare(`
      INSERT INTO analytics (slug, ip, visitor_data) VALUES (?, ?, ?)
    `).bind(slug, ip, JSON.stringify(visitorData)).run();
  }

  return c.json({ data: { longUrl: link.long_url } });
});

// ==========================================
// DASHBOARD & ANALYTICS
// ==========================================

app.get('/api/share/analytics', requireAuth, async (c) => {
  const user = c.get('user');
  
  // Get all links for this user
  const { results: links } = await c.env.DB.prepare('SELECT * FROM links WHERE user_id = ? ORDER BY created_at DESC').bind(user.id).all();
  
  if (links.length === 0) {
    return c.json({ data: { totalClicks: 0, uniqueVisitors: 0, topCountries: [], topReferers: [], sparkline: [], links: [], leads: [] } });
  }

  const slugs = links.map(l => l.slug);
  // Get all analytics for these links
  const { results: analytics } = await c.env.DB.prepare(`
    SELECT a.* 
    FROM analytics a 
    JOIN links l ON a.slug = l.slug 
    WHERE l.user_id = ?
  `).bind(user.id).all();

  let totalClicks = analytics.length;
  let visitors = new Set();
  let countries = {};
  let referers = {};
  let clicksOverTime = {};
  let leads = [];

  analytics.forEach(row => {
    if (row.ip) visitors.add(row.ip);
    if (row.country) countries[row.country] = (countries[row.country] || 0) + 1;
    if (row.referer) {
      try { const r = new URL(row.referer).hostname; referers[r] = (referers[r] || 0) + 1; } catch { referers['Direct'] = (referers['Direct'] || 0) + 1; }
    }
    const date = row.timestamp.split(' ')[0];
    clicksOverTime[date] = (clicksOverTime[date] || 0) + 1;

    if (row.visitor_data) {
      let vData = {};
      try {
        vData = JSON.parse(row.visitor_data);
      } catch (e) {
        console.error("Failed to parse visitor_data", e);
      }
      leads.push({
        slug: row.slug,
        data: vData,
        timestamp: row.timestamp,
        ip: row.ip
      });
    }
  });

  const linksWithStats = links.map(link => {
    const linkAnalytics = analytics.filter(a => a.slug === link.slug);
    return {
      ...link,
      lastClicked: linkAnalytics.length > 0 ? linkAnalytics[linkAnalytics.length - 1].timestamp : null,
      leadsCount: linkAnalytics.filter(a => a.visitor_data).length,
      isExpired: link.expires_at && new Date(link.expires_at).getTime() <= Date.now()
    };
  });

  return c.json({
    data: {
      totalClicks,
      uniqueVisitors: visitors.size,
      topCountries: Object.entries(countries).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value).slice(0,5),
      topReferers: Object.entries(referers).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value).slice(0,5),
      sparkline: Object.entries(clicksOverTime).map(([date, clicks]) => ({ date, clicks })),
      links: linksWithStats,
      leads
    }
  });
});

app.delete('/api/links', requireAuth, async (c) => {
  const { slugs } = await c.req.json();
  const user = c.get('user');
  if (!slugs || slugs.length === 0) return c.json({ error: 'Slugs required' }, 400);

  const placeholders = slugs.map(() => '?').join(',');
  const { results: targetLinks } = await c.env.DB.prepare(`SELECT r2_key FROM links WHERE user_id = ? AND slug IN (${placeholders})`).bind(user.id, ...slugs).all();

  const keysToDelete = targetLinks.filter(l => l.r2_key).map(l => ({ Key: l.r2_key }));
  
  if (keysToDelete.length > 0) {
    const s3Client = getS3Client(c.env);
    await s3Client.send(new DeleteObjectsCommand({
      Bucket: c.env.R2_BUCKET_NAME,
      Delete: { Objects: keysToDelete }
    })).catch(e => console.error("R2 deletion failed", e));
  }

  await c.env.DB.prepare(`DELETE FROM links WHERE user_id = ? AND slug IN (${placeholders})`).bind(user.id, ...slugs).run();
  
  return c.json({ message: 'Deleted successfully' });
});

// ==========================================
// FEEDBACK & SUGGESTIONS
// ==========================================

app.post('/api/feedback', async (c) => {
  const { email, message, context } = await c.req.json();
  if (!message) return c.json({ error: 'Message required' }, 400);

  const fullMessage = context ? `[Context: ${context}] ${message}` : message;

  await c.env.DB.prepare('INSERT INTO feedback (email, message) VALUES (?, ?)').bind(email || '', fullMessage).run();
  return c.json({ message: 'Feedback received' });
});

app.get('/api/feedback', requireAuth, async (c) => {
  const { results: feedback } = await c.env.DB.prepare('SELECT * FROM feedback ORDER BY created_at DESC LIMIT 100').all();
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

  await c.env.DB.prepare('INSERT INTO tool_usage (tool_id, ip, country) VALUES (?, ?, ?)')
    .bind(toolId, ip, country).run();

  return c.json({ message: 'Usage recorded' });
});

app.get('/api/tools/trending', async (c) => {
  // Get counts for the last 7 days
  const { results } = await c.env.DB.prepare(`
    SELECT tool_id, COUNT(*) as usageCount 
    FROM tool_usage 
    WHERE timestamp >= date('now', '-7 days')
    GROUP BY tool_id 
    ORDER BY usageCount DESC
  `).all();

  return c.json({ data: results });
});

export default app;

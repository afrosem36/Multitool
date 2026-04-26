import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { nanoid } from 'nanoid';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

const EMPTY_DB = { links: {}, analytics: {} };
const MAX_SHARE_FILE_SIZE = 250 * 1024 * 1024;
const AUDIO_VIDEO_EXTENSIONS = new Set([
  '.mp3', '.wav', '.aac', '.m4a', '.flac', '.ogg', '.oga', '.weba',
  '.mp4', '.m4v', '.mov', '.avi', '.mkv', '.wmv', '.webm', '.mpeg', '.mpg', '.3gp'
]);

// Set up local JSON fallback
const isVercel = process.env.VERCEL || process.env.NODE_ENV === 'production';
const dbPath = path.join(__dirname, 'data', 'db.json');
const r2DbKey = process.env.R2_DB_KEY || '__multitool/db.json';

function ensureDbShape(data) {
  return {
    links: data?.links && typeof data.links === 'object' ? data.links : {},
    analytics: data?.analytics && typeof data.analytics === 'object' ? data.analytics : {},
  };
}

function readLocalDB() {
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(EMPTY_DB, null, 2));
  }
  return ensureDbShape(JSON.parse(fs.readFileSync(dbPath, 'utf8')));
}

function writeLocalDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// ------------------------------------------------------------------
// MODULE 1: Cloudflare R2 + URL Shortener + Analytics
// ------------------------------------------------------------------

// R2 Setup
let s3Client = null;
const requiredR2Vars = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
const missingVars = requiredR2Vars.filter(v => !process.env[v]);

if (missingVars.length === 0) {
  s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
} else if (isVercel) {
  console.warn('R2 is not fully configured. Missing:', missingVars.join(', '));
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function shouldUseR2Db() {
  return Boolean(s3Client && process.env.R2_BUCKET_NAME);
}

async function readDB() {
  if (!shouldUseR2Db()) {
    return readLocalDB();
  }

  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: r2DbKey,
    }));
    const raw = await streamToString(response.Body);
    return ensureDbShape(JSON.parse(raw));
  } catch (error) {
    const statusCode = error?.$metadata?.httpStatusCode;
    const missingKey = error?.name === 'NoSuchKey' || error?.Code === 'NoSuchKey' || statusCode === 404;
    if (missingKey) {
      return { ...EMPTY_DB };
    }

    console.error('Failed to read DB from R2, falling back to local DB:', error);
    return readLocalDB();
  }
}

async function writeDB(data) {
  const normalized = ensureDbShape(data);

  if (shouldUseR2Db()) {
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: r2DbKey,
      Body: JSON.stringify(normalized, null, 2),
      ContentType: 'application/json',
    }));
    return;
  }

  writeLocalDB(normalized);
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function getRefererHost(referer) {
  if (!referer) {
    return 'Direct';
  }

  try {
    return new URL(referer).hostname;
  } catch {
    return 'Direct';
  }
}

function getPublicOrigin(req) {
  const configuredShortDomain = process.env.SHORT_DOMAIN;
  const configuredFrontendUrl = process.env.FRONTEND_URL;
  const requestHost = req.headers.host;

  if (requestHost?.includes('localhost') && configuredFrontendUrl) {
    return configuredFrontendUrl;
  }

  if (configuredShortDomain) {
    return configuredShortDomain;
  }

  if (requestHost) {
    return `${req.protocol}://${requestHost}`;
  }

  return 'http://localhost:5173';
}

function getFrontendOrigin(req) {
  const configuredFrontendUrl = process.env.FRONTEND_URL;
  const requestHost = req.headers.host;

  if (configuredFrontendUrl) {
    return configuredFrontendUrl;
  }

  if (requestHost?.includes('localhost')) {
    return 'http://localhost:5173';
  }

  if (requestHost) {
    return `${req.protocol}://${requestHost}`;
  }

  return '';
}

function sanitizeFileName(name = 'file') {
  const extension = path.extname(name).toLowerCase().replace(/[^a-z0-9.]/gi, '');
  const baseName = path.basename(name, extension)
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '');

  return `${baseName || 'file'}${extension}`;
}

function isSupportedShareFile(originalName = '', mimeType = '') {
  const extension = path.extname(originalName).toLowerCase();
  return mimeType.startsWith('audio/')
    || mimeType.startsWith('video/')
    || mimeType === 'application/pdf'
    || mimeType === 'application/x-pdf'
    || extension === '.pdf'
    || AUDIO_VIDEO_EXTENSIONS.has(extension);
}

function getShareValidationError({ originalName, mimeType, size }) {
  if (!originalName) {
    return 'File name is required';
  }

  if (!Number.isFinite(Number(size)) || Number(size) <= 0) {
    return 'Invalid file size';
  }

  if (Number(size) > MAX_SHARE_FILE_SIZE) {
    return 'File size exceeds the 250 MB limit';
  }

  if (!isSupportedShareFile(originalName, mimeType || '')) {
    return 'Only audio, video, and PDF files are supported';
  }

  return null;
}

function parseExpirySeconds(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function getExpiryMetadata(expiresInSeconds) {
  if (!expiresInSeconds) {
    return {
      expiresInSeconds: null,
      expiresAt: null,
    };
  }

  return {
    expiresInSeconds,
    expiresAt: new Date(Date.now() + (expiresInSeconds * 1000)).toISOString(),
  };
}

function isLinkExpired(linkInfo) {
  return Boolean(linkInfo?.expiresAt && Date.now() >= new Date(linkInfo.expiresAt).getTime());
}

function buildSharedFileRecord({ slug, key, originalName, size, mimeType, expiryMetadata }) {
  return {
    slug,
    originalName,
    size: Number(size),
    mimeType,
    r2Key: key,
    longUrl: null,
    uploadedAt: new Date().toISOString(),
    downloadCount: 0,
    ...expiryMetadata,
  };
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_SHARE_FILE_SIZE } });

app.post('/api/share/upload-url', asyncHandler(async (req, res) => {
  if (!s3Client) {
    return res.status(500).json({
      error: 'R2 not configured on server',
      details: isVercel ? `Missing environment variables: ${missingVars.join(', ')}` : 'Check your .env file'
    });
  }

  const { originalName, mimeType = 'application/octet-stream', size, expiresInSeconds } = req.body || {};
  const validationError = getShareValidationError({ originalName, mimeType, size });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const slug = nanoid(8);
  const key = `${slug}-${sanitizeFileName(originalName)}`;
  const expiryMetadata = getExpiryMetadata(parseExpirySeconds(expiresInSeconds));
  const uploadUrl = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: mimeType,
    }),
    { expiresIn: 60 * 10 }
  );

  res.json({
    data: {
      slug,
      key,
      uploadUrl,
      ...expiryMetadata,
    }
  });
}));

app.post('/api/share/complete-upload', asyncHandler(async (req, res) => {
  if (!s3Client) {
    return res.status(500).json({
      error: 'R2 not configured on server',
      details: isVercel ? `Missing environment variables: ${missingVars.join(', ')}` : 'Check your .env file'
    });
  }

  const {
    slug,
    key,
    originalName,
    mimeType = 'application/octet-stream',
    size,
    expiresInSeconds,
  } = req.body || {};

  const validationError = getShareValidationError({ originalName, mimeType, size });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  if (!slug || !key || !key.startsWith(`${slug}-`)) {
    return res.status(400).json({ error: 'Invalid upload reference' });
  }

  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    }));
  } catch (error) {
    console.error('R2 head object error:', error);
    return res.status(400).json({ error: 'Uploaded file could not be verified' });
  }

  const expiryMetadata = getExpiryMetadata(parseExpirySeconds(expiresInSeconds));
  const db = await readDB();

  db.links[slug] = buildSharedFileRecord({
    slug,
    key,
    originalName,
    size,
    mimeType,
    expiryMetadata,
  });
  db.analytics[slug] = [];
  await writeDB(db);

  const shortDomain = getPublicOrigin(req);
  res.json({ data: { slug, shortUrl: `${shortDomain}/s/${slug}`, ...expiryMetadata } });
}));

app.post('/api/share/upload', upload.single('file'), asyncHandler(async (req, res) => {
  if (!s3Client) {
    return res.status(500).json({ 
      error: 'R2 not configured on server', 
      details: isVercel ? `Missing environment variables: ${missingVars.join(', ')}` : 'Check your .env file'
    });
  }
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const validationError = getShareValidationError({
    originalName: req.file.originalname,
    mimeType: req.file.mimetype || '',
    size: req.file.size,
  });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const slug = nanoid(8);
  const key = `${slug}-${sanitizeFileName(req.file.originalname)}`;
  const expiryMetadata = getExpiryMetadata(parseExpirySeconds(req.body?.expiresInSeconds));
  
  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    const db = await readDB();
    
    // Store metadata & long url mapping
    db.links[slug] = buildSharedFileRecord({
      slug,
      key,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      expiryMetadata,
    });
    
    db.analytics[slug] = [];
    await writeDB(db);

    const shortDomain = getPublicOrigin(req);
    res.json({ data: { slug, shortUrl: `${shortDomain}/s/${slug}`, ...expiryMetadata } });
  } catch (error) {
    console.error('R2 upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
}));

app.post('/api/shorten', asyncHandler(async (req, res) => {
  const { longUrl, customSlug, requiresDataCollection } = req.body;
  if (!longUrl) return res.status(400).json({ error: 'longUrl required' });

  const slug = customSlug || nanoid(8);
  const db = await readDB();

  if (db.links[slug]) {
    return res.status(400).json({ error: 'Slug already exists' });
  }

  db.links[slug] = {
    slug,
    longUrl,
    requiresDataCollection: !!requiresDataCollection,
    createdAt: new Date().toISOString(),
    downloadCount: 0
  };
  db.analytics[slug] = [];
  await writeDB(db);

  const shortDomain = getPublicOrigin(req);
  res.json({ data: { slug, shortUrl: `${shortDomain}/s/${slug}` } });
}));

app.get('/s/:slug', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const db = await readDB();
  const linkInfo = db.links[slug];

  if (!linkInfo) {
    return res.status(404).send('Link not found');
  }

  if (isLinkExpired(linkInfo)) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    const frontendUrl = getFrontendOrigin(req);
    if (frontendUrl) {
      return res.redirect(`${frontendUrl}/link-expired/${slug}`);
    }

    return res.status(410).send('Link expired. Contact creator for access.');
  }

  // Analytics Capture
  linkInfo.downloadCount++;
  db.analytics[slug] = db.analytics[slug] || [];
  
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const clickData = {
    timestamp: new Date().toISOString(),
    ip: ip,
    userAgent: req.headers['user-agent'],
    referer: req.headers['referer'] || '',
    country: req.headers['cf-ipcountry'] || 'Unknown',
  };

  db.analytics[slug].push(clickData);
  await writeDB(db);

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (linkInfo.requiresDataCollection) {
    // Redirect to frontend lead gate page
    // Using absolute URL ensures it works even if the user clicks the backend port directly in dev
    const frontendUrl = getFrontendOrigin(req);
    return res.redirect(`${frontendUrl}/gate/${slug}`);
  }

  if (linkInfo.r2Key && linkInfo.originalName) {
    if (!s3Client) {
      return res.status(500).send('File delivery is unavailable right now.');
    }

    const downloadUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: linkInfo.r2Key,
        ResponseContentDisposition: `inline; filename="${sanitizeFileName(linkInfo.originalName)}"`,
        ResponseContentType: linkInfo.mimeType,
      }),
      { expiresIn: 60 }
    );

    return res.redirect(302, downloadUrl);
  }

  res.redirect(302, linkInfo.longUrl);
}));

app.post('/api/s/:slug/submit', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { name, contact } = req.body;
  const db = await readDB();
  const linkInfo = db.links[slug];

  if (!linkInfo) {
    return res.status(404).json({ error: 'Link not found' });
  }

  if (isLinkExpired(linkInfo)) {
    return res.status(410).json({ error: 'Link expired. Contact creator for access.' });
  }

  if (!name || !contact) {
    return res.status(400).json({ error: 'Name and Contact are required' });
  }

  // Find the latest click for this IP to append the lead data
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const analyticsArray = db.analytics[slug] || [];
  
  // Find most recent click from this IP
  let recentClick = null;
  for (let i = analyticsArray.length - 1; i >= 0; i--) {
    if (analyticsArray[i].ip === ip) {
      recentClick = analyticsArray[i];
      break;
    }
  }

  if (recentClick) {
    recentClick.visitorData = { name, contact };
  } else {
    // Fallback if no recent click was found
    analyticsArray.push({
      timestamp: new Date().toISOString(),
      ip: ip,
      userAgent: req.headers['user-agent'],
      visitorData: { name, contact }
    });
  }

  await writeDB(db);

  res.json({ data: { longUrl: linkInfo.longUrl } });
}));

app.get('/api/share/analytics', asyncHandler(async (req, res) => {
  const db = await readDB();
  
  let totalClicks = 0;
  let visitors = new Set();
  let countries = {};
  let referers = {};
  let clicksOverTime = {};
  let leads = []; // New array for collected customer data

  Object.entries(db.analytics).forEach(([slug, clicks]) => {
    clicks.forEach(c => {
      totalClicks++;
      visitors.add(c.ip);
      
      if (c.country) countries[c.country] = (countries[c.country] || 0) + 1;
      
      const ref = getRefererHost(c.referer);
      referers[ref] = (referers[ref] || 0) + 1;
      
      const date = c.timestamp.split('T')[0];
      clicksOverTime[date] = (clicksOverTime[date] || 0) + 1;

      // Extract visitor data if collected
      if (c.visitorData) {
        leads.push({
          slug,
          longUrl: db.links[slug]?.longUrl || 'Unknown',
          name: c.visitorData.name,
          contact: c.visitorData.contact,
          timestamp: c.timestamp,
          ip: c.ip
        });
      }
    });
  });

  const topCountries = Object.entries(countries)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, value]) => ({ name, value }));
    
  const topReferers = Object.entries(referers)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  const sparkline = Object.entries(clicksOverTime)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, clicks]) => ({ date, clicks }));

  const allLinks = Object.values(db.links).map(link => {
    const clicksForLink = db.analytics[link.slug] || [];
    const lastClicked = clicksForLink.length > 0 
      ? clicksForLink[clicksForLink.length - 1].timestamp 
      : null;
      
    // Count how many leads were generated for this link
    const leadsCount = clicksForLink.filter(c => c.visitorData).length;

    return {
      ...link,
      lastClicked,
      leadsCount,
      isExpired: isLinkExpired(link)
    };
  });

  res.json({
    data: {
      totalClicks,
      uniqueVisitors: visitors.size,
      topCountries,
      topReferers,
      sparkline,
      links: allLinks,
      leads, // Sent to the frontend
      isVercel // Inform frontend about environment
    }
  });
}));

// ------------------------------------------------------------------
// MODULE 3: SEO Score Analyzer (Proxy)
// ------------------------------------------------------------------

function normalizeSeoUrl(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSeoStatus(ratio) {
  if (ratio >= 0.85) return 'pass';
  if (ratio >= 0.5) return 'warn';
  return 'fail';
}

function buildSeoSignal({ id, name, category, score, maxScore, message, fixTip }) {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  const status = getSeoStatus(ratio);

  return {
    id,
    name,
    category,
    score,
    maxScore,
    status,
    message,
    fixTip,
    priority: status === 'fail' ? 'high' : status === 'warn' ? 'medium' : 'low',
  };
}

async function fetchOptionalSeoAsset(url) {
  try {
    return await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MultiToolHub SEO Audit/1.0)',
      },
      timeout: 5000,
      validateStatus: () => true,
    });
  } catch {
    return null;
  }
}

app.post('/api/seo-audit', asyncHandler(async (req, res) => {
  const {
    websiteUrl,
    primaryKeywords,
    websiteType = 'Other',
    targetCountry = 'Global',
    analyticsGoals = [],
    competitorUrls = '',
  } = req.body;

  const normalizedUrl = normalizeSeoUrl(websiteUrl);
  if (!normalizedUrl) {
    return res.status(400).json({ error: 'A valid website URL is required.' });
  }

  const keywordList = String(primaryKeywords || '')
    .split(',')
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean);

  const selectedGoals = Array.isArray(analyticsGoals) && analyticsGoals.length > 0
    ? analyticsGoals
    : ['Traffic'];

  const startedAt = Date.now();
  const robotsUrl = new URL('/robots.txt', normalizedUrl.origin).toString();
  const sitemapUrl = new URL('/sitemap.xml', normalizedUrl.origin).toString();

  const [pageResponse, robotsResponse, sitemapResponse] = await Promise.all([
    axios.get(normalizedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MultiToolHub SEO Audit/1.0)',
      },
      timeout: 12000,
      maxRedirects: 5,
    }),
    fetchOptionalSeoAsset(robotsUrl),
    fetchOptionalSeoAsset(sitemapUrl),
  ]);

  const responseTime = Date.now() - startedAt;
  const html = typeof pageResponse.data === 'string' ? pageResponse.data : '';
  const $ = cheerio.load(html);
  const pageHost = normalizedUrl.hostname;

  const title = $('title').text().trim();
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';
  const canonicalUrl = $('link[rel="canonical"]').attr('href')?.trim() || '';
  const robotsMeta = ($('meta[name="robots"]').attr('content') || pageResponse.headers['x-robots-tag'] || '').toLowerCase();
  const htmlLang = $('html').attr('lang')?.trim() || '';
  const viewport = $('meta[name="viewport"]').attr('content')?.trim() || '';
  const jsonLdBlocks = $('script[type="application/ld+json"]').length;
  const h1Count = $('h1').length;
  const h2Count = $('h2').length;
  const ogTagsPresent = ['og:title', 'og:description', 'og:image', 'og:url'].filter((property) => (
    $(`meta[property="${property}"]`).length > 0
  ));
  const twitterTagsPresent = ['twitter:card', 'twitter:title', 'twitter:description'].filter((name) => (
    $(`meta[name="${name}"]`).length > 0
  ));
  const formsCount = $('form').length;
  const ctaCount = $('button, input[type="submit"], a[role="button"]').length;
  const cacheControl = pageResponse.headers['cache-control'] || '';
  const htmlSizeKB = Math.round(Buffer.byteLength(html, 'utf8') / 1024);

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim().toLowerCase();
  const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;

  const keywordStats = keywordList.map((keyword) => {
    const regex = new RegExp(escapeRegExp(keyword), 'gi');
    const matches = bodyText.match(regex) || [];

    return {
      keyword,
      hits: matches.length,
      inTitle: title.toLowerCase().includes(keyword),
      inDescription: metaDescription.toLowerCase().includes(keyword),
      inH1: $('h1').toArray().some((node) => $(node).text().toLowerCase().includes(keyword)),
    };
  });

  const totalKeywordHits = keywordStats.reduce((sum, item) => sum + item.hits, 0);
  const keywordDensity = wordCount > 0 ? Number(((totalKeywordHits / wordCount) * 100).toFixed(2)) : 0;
  const keywordsCovered = keywordStats.filter((item) => item.hits > 0).length;
  const keywordCoverageRatio = keywordStats.length > 0 ? keywordsCovered / keywordStats.length : 1;

  const images = $('img').toArray();
  const imagesWithAlt = images.filter((image) => $(image).attr('alt')?.trim()).length;
  const lazyImages = images.filter((image) => ($(image).attr('loading') || '').toLowerCase() === 'lazy').length;
  const altCoverage = images.length > 0 ? imagesWithAlt / images.length : 1;
  const lazyCoverage = images.length > 0 ? lazyImages / images.length : 1;

  const linkData = $('a[href]').toArray().reduce((acc, link) => {
    const href = $(link).attr('href')?.trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return acc;
    }

    try {
      const url = new URL(href, normalizedUrl.origin);
      if (url.hostname === pageHost) {
        acc.internal += 1;
      } else {
        acc.external += 1;
      }
    } catch {
      acc.external += 1;
    }

    return acc;
  }, { internal: 0, external: 0 });

  const totalLinks = linkData.internal + linkData.external;
  const internalLinkRatio = totalLinks > 0 ? linkData.internal / totalLinks : 0;
  const hasRobots = Boolean(robotsResponse && robotsResponse.status >= 200 && robotsResponse.status < 400);
  const hasSitemap = Boolean(sitemapResponse && sitemapResponse.status >= 200 && sitemapResponse.status < 400);
  const isIndexable = !robotsMeta.includes('noindex');
  const hasCacheHints = Boolean(cacheControl);

  const wantsTraffic = selectedGoals.includes('Traffic');
  const wantsConversions = selectedGoals.includes('Conversions') || selectedGoals.includes('Lead Generation');
  const wantsBrand = selectedGoals.includes('Brand Awareness');

  const signals = [];
  const pushSignal = (config) => signals.push(buildSeoSignal(config));

  pushSignal({
    id: 'https',
    name: 'HTTPS',
    category: 'Technical',
    score: normalizedUrl.protocol === 'https:' ? 4 : 0,
    maxScore: 4,
    message: normalizedUrl.protocol === 'https:' ? 'The page is served over HTTPS.' : 'The page is not using HTTPS.',
    fixTip: 'Serve the canonical page over HTTPS and redirect all HTTP requests.',
  });

  const titleGood = title.length >= 40 && title.length <= 60;
  pushSignal({
    id: 'title',
    name: 'Title Tag',
    category: 'Metadata',
    score: titleGood ? 8 : title ? 5 : 0,
    maxScore: 8,
    message: title ? `Title length is ${title.length} characters.` : 'No title tag detected.',
    fixTip: 'Write a distinct title between 40 and 60 characters with the main topic near the front.',
  });

  const descriptionGood = metaDescription.length >= 140 && metaDescription.length <= 160;
  pushSignal({
    id: 'meta-description',
    name: 'Meta Description',
    category: 'Metadata',
    score: descriptionGood ? 8 : metaDescription ? 5 : 0,
    maxScore: 8,
    message: metaDescription ? `Meta description length is ${metaDescription.length} characters.` : 'No meta description detected.',
    fixTip: 'Add a compelling 140-160 character meta description with a clear click reason.',
  });

  pushSignal({
    id: 'headings',
    name: 'Heading Structure',
    category: 'Content',
    score: h1Count === 1 && h2Count >= 2 ? 10 : h1Count > 0 ? 6 : 2,
    maxScore: 10,
    message: `${h1Count} H1 tag and ${h2Count} H2 tags found.`,
    fixTip: 'Keep one H1, then use H2 sections to organize the page for readers and crawlers.',
  });

  pushSignal({
    id: 'content-depth',
    name: 'Content Depth',
    category: 'Content',
    score: wordCount >= 900 ? 6 : wordCount >= 450 ? 4 : wordCount >= 250 ? 2 : 0,
    maxScore: 6,
    message: `${wordCount} words of visible body copy detected.`,
    fixTip: 'Add more useful, original copy that answers search intent and supports the primary topic.',
  });

  pushSignal({
    id: 'keyword-targeting',
    name: 'Keyword Targeting',
    category: 'Content',
    score: keywordList.length === 0
      ? 4
      : (
        (keywordCoverageRatio >= 0.8 ? 4 : keywordCoverageRatio >= 0.4 ? 2 : 0) +
        (keywordStats.some((item) => item.inTitle) ? 2 : 0) +
        (keywordStats.some((item) => item.inDescription || item.inH1) ? 2 : 0)
      ),
    maxScore: 8,
    message: keywordList.length === 0
      ? 'No keywords were provided, so keyword targeting was scored conservatively.'
      : `${keywordsCovered} of ${keywordList.length} target keywords appear in the page copy. Density is ${keywordDensity}%.`,
    fixTip: 'Place the primary keyword naturally in the title, H1, intro, and supporting sections without stuffing.',
  });

  pushSignal({
    id: 'canonical',
    name: 'Canonical URL',
    category: 'Technical',
    score: canonicalUrl ? 5 : 0,
    maxScore: 5,
    message: canonicalUrl ? `Canonical URL present: ${canonicalUrl}` : 'No canonical tag found.',
    fixTip: 'Add a canonical tag pointing to the preferred version of this page.',
  });

  pushSignal({
    id: 'indexability',
    name: 'Indexability',
    category: 'Technical',
    score: isIndexable ? 6 : 0,
    maxScore: 6,
    message: isIndexable ? 'No noindex directive detected.' : 'The page appears to include a noindex directive.',
    fixTip: 'Remove noindex directives from pages meant to rank in search.',
  });

  pushSignal({
    id: 'viewport',
    name: 'Mobile Viewport',
    category: 'Technical',
    score: viewport ? 4 : 0,
    maxScore: 4,
    message: viewport ? 'Viewport meta tag is present.' : 'No viewport meta tag found.',
    fixTip: 'Add a responsive viewport meta tag so the page renders correctly on mobile devices.',
  });

  pushSignal({
    id: 'language',
    name: 'Language Declaration',
    category: 'Technical',
    score: htmlLang ? 4 : 1,
    maxScore: 4,
    message: htmlLang ? `HTML lang is set to "${htmlLang}".` : 'No html lang attribute detected.',
    fixTip: 'Set the html lang attribute to help search engines and assistive tech interpret the page correctly.',
  });

  pushSignal({
    id: 'open-graph',
    name: 'Open Graph Coverage',
    category: 'Social',
    score: ogTagsPresent.length >= 4 ? 5 : ogTagsPresent.length >= 2 ? 3 : ogTagsPresent.length > 0 ? 2 : 0,
    maxScore: 5,
    message: `${ogTagsPresent.length} essential Open Graph tags found.`,
    fixTip: 'Add og:title, og:description, og:image, and og:url for better sharing previews.',
  });

  pushSignal({
    id: 'twitter-cards',
    name: 'Twitter Card Coverage',
    category: 'Social',
    score: twitterTagsPresent.length >= 3 ? 3 : twitterTagsPresent.length >= 1 ? 1 : 0,
    maxScore: 3,
    message: `${twitterTagsPresent.length} Twitter card tags found.`,
    fixTip: 'Add Twitter card tags so social shares render rich previews consistently.',
  });

  pushSignal({
    id: 'structured-data',
    name: 'Structured Data',
    category: 'Discoverability',
    score: jsonLdBlocks >= 2 ? 6 : jsonLdBlocks === 1 ? 4 : 0,
    maxScore: 6,
    message: `${jsonLdBlocks} JSON-LD blocks found.`,
    fixTip: websiteType === 'Local Business'
      ? 'Add LocalBusiness schema with address, opening hours, and contact details.'
      : 'Add relevant JSON-LD schema such as WebPage, Article, FAQPage, or Product.',
  });

  pushSignal({
    id: 'image-alt',
    name: 'Image Accessibility',
    category: 'Accessibility',
    score: Math.round(6 * altCoverage),
    maxScore: 6,
    message: images.length > 0
      ? `${imagesWithAlt} of ${images.length} images include alt text.`
      : 'No images detected, so this check is neutral.',
    fixTip: 'Write descriptive alt text for informative images and leave decorative images empty-alt intentionally.',
  });

  pushSignal({
    id: 'internal-links',
    name: 'Internal Linking',
    category: 'Discoverability',
    score: linkData.internal >= 8 && internalLinkRatio >= 0.5 ? 5 : linkData.internal >= 3 ? 3 : linkData.internal > 0 ? 2 : 0,
    maxScore: 5,
    message: `${linkData.internal} internal and ${linkData.external} external links detected.`,
    fixTip: 'Add contextual internal links to related pages, category hubs, and conversion pages.',
  });

  pushSignal({
    id: 'crawl-files',
    name: 'Crawl Files',
    category: 'Discoverability',
    score: (hasRobots ? 3 : 0) + (hasSitemap ? 3 : 0),
    maxScore: 6,
    message: `${hasRobots ? 'robots.txt found' : 'robots.txt missing'}; ${hasSitemap ? 'sitemap.xml found' : 'sitemap.xml missing'}.`,
    fixTip: 'Publish both robots.txt and sitemap.xml so crawlers can discover and prioritize pages more reliably.',
  });

  pushSignal({
    id: 'performance-hints',
    name: 'Performance Hints',
    category: 'Performance',
    score: (hasCacheHints ? 2 : 0) + (lazyCoverage >= 0.5 ? 2 : images.length === 0 ? 2 : 0),
    maxScore: 4,
    message: hasCacheHints
      ? `Cache-Control is present. Lazy loading is used on ${lazyImages} of ${images.length} images.`
      : `No Cache-Control header detected. Lazy loading is used on ${lazyImages} of ${images.length} images.`,
    fixTip: 'Set browser caching headers and lazy-load below-the-fold images to reduce repeat-load cost.',
  });

  pushSignal({
    id: 'conversion-readiness',
    name: 'Conversion Readiness',
    category: 'UX',
    score: wantsConversions
      ? (formsCount > 0 ? 4 : 1) + (ctaCount >= 2 ? 2 : 0)
      : wantsBrand
        ? (ogTagsPresent.length >= 4 ? 4 : 2) + (twitterTagsPresent.length >= 2 ? 2 : 0)
        : wantsTraffic
          ? (linkData.internal >= 5 ? 4 : 2) + (wordCount >= 500 ? 2 : 0)
          : 4,
    maxScore: 6,
    message: `${formsCount} forms and ${ctaCount} button-style calls to action detected for the selected goals.`,
    fixTip: wantsConversions
      ? 'Make the primary CTA obvious above the fold and reduce friction in forms or lead capture.'
      : wantsBrand
        ? 'Strengthen social preview metadata and messaging consistency for branded sharing.'
        : 'Improve navigation depth, topic clusters, and content coverage to support traffic growth.',
  });

  const totalScore = signals.reduce((sum, signal) => sum + signal.score, 0);
  const maxScore = signals.reduce((sum, signal) => sum + signal.maxScore, 0);
  const overallScore = Math.round((totalScore / maxScore) * 100);
  const letterGrade = overallScore >= 90 ? 'A' : overallScore >= 80 ? 'B' : overallScore >= 70 ? 'C' : overallScore >= 60 ? 'D' : 'F';

  const categories = Object.values(signals.reduce((acc, signal) => {
    if (!acc[signal.category]) {
      acc[signal.category] = {
        name: signal.category,
        score: 0,
        maxScore: 0,
      };
    }

    acc[signal.category].score += signal.score;
    acc[signal.category].maxScore += signal.maxScore;
    return acc;
  }, {})).map((category) => ({
    ...category,
    percentage: Math.round((category.score / category.maxScore) * 100),
  })).sort((a, b) => b.percentage - a.percentage);

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const quickWins = signals
    .filter((signal) => signal.status !== 'pass')
    .sort((a, b) => (
      priorityOrder[a.priority] - priorityOrder[b.priority] ||
      b.maxScore - a.maxScore
    ))
    .slice(0, 5);

  const strengths = signals
    .filter((signal) => signal.status === 'pass')
    .sort((a, b) => b.maxScore - a.maxScore)
    .slice(0, 4);

  const countryPlaybook = targetCountry === 'IN'
    ? [
        'Use India-focused examples, pricing, and terminology where relevant.',
        'If you serve multiple regions, consider dedicated location pages and localized metadata.',
        'For local businesses, reinforce NAP consistency and LocalBusiness schema.',
      ]
    : targetCountry === 'Global'
      ? [
          'Keep titles and descriptions neutral enough for international intent.',
          'If you serve multiple regions, plan hreflang and localized landing pages.',
          'Make social previews and currency or units adaptable for wider audiences.',
        ]
      : [
          `Align page copy and metadata with ${targetCountry}-specific intent where appropriate.`,
          'Consider localized landing pages, reviews, and trust signals for the target region.',
          'Check whether hreflang, local schema, or local testimonials would improve relevance.',
        ];

  res.json({
    data: {
      overallScore,
      letterGrade,
      summary: {
        passed: signals.filter((signal) => signal.status === 'pass').length,
        warnings: signals.filter((signal) => signal.status === 'warn').length,
        failed: signals.filter((signal) => signal.status === 'fail').length,
      },
      metrics: {
        titleLength: title.length,
        metaDescriptionLength: metaDescription.length,
        wordCount,
        keywordDensity,
        imageCount: images.length,
        altCoverage: Math.round(altCoverage * 100),
        internalLinks: linkData.internal,
        externalLinks: linkData.external,
        responseTime,
        htmlSizeKB,
      },
      crawl: {
        hasRobots,
        hasSitemap,
        isIndexable,
        canonicalUrl,
        htmlLang,
      },
      inputContext: {
        websiteType,
        targetCountry,
        analyticsGoals: selectedGoals,
        competitorUrls,
      },
      quickWins,
      strengths,
      categories,
      countryPlaybook,
      signals,
    }
  });
}));

app.post('/api/seo-audit-legacy', async (req, res) => {
  const { websiteUrl, primaryKeywords } = req.body;
  if (!websiteUrl) return res.status(400).json({ error: 'websiteUrl required' });

  try {
    const response = await axios.get(websiteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const html = response.data;
    const $ = cheerio.load(html);
    
    const keywords = (primaryKeywords || '').toLowerCase().split(',').map(k => k.trim()).filter(k => k);
    
    // Analyze On-Page Signals
    const title = $('title').text().trim();
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    const h1Count = $('h1').length;
    
    let textContent = $('body').text().toLowerCase();
    // basic word count approximation
    const wordCount = textContent.split(/\s+/).length; 
    let keywordDensity = 0;
    
    if (keywords.length > 0) {
      let kwHits = 0;
      keywords.forEach(kw => {
        const regex = new RegExp(kw, 'g');
        const matches = textContent.match(regex);
        if (matches) kwHits += matches.length;
      });
      keywordDensity = (kwHits / wordCount) * 100;
    }

    const images = $('img');
    const imagesWithAlt = images.filter((i, el) => $(el).attr('alt') && $(el).attr('alt').trim() !== '').length;
    const altPercentage = images.length > 0 ? (imagesWithAlt / images.length) * 100 : 100;

    const canonical = $('link[rel="canonical"]').length > 0;
    const ogTitle = $('meta[property="og:title"]').length > 0;
    const hasJsonLd = $('script[type="application/ld+json"]').length > 0;
    const hasViewport = $('meta[name="viewport"]').length > 0;
    
    const internalLinks = $('a[href^="/"], a[href^="' + websiteUrl + '"]').length;
    const totalLinks = $('a').length;
    const linkRatio = totalLinks > 0 ? (internalLinks / totalLinks) * 100 : 0;

    // Score calculation (basic heuristic)
    let totalScore = 0;
    let maxScore = 1000; // 10 signals * 100
    
    const signals = [];
    
    const addSignal = (name, score, passingCondition, fixTip) => {
      totalScore += score;
      signals.push({
        name,
        score,
        status: score > 80 ? '✅' : score > 50 ? '⚠️' : '❌',
        fixTip: passingCondition ? '' : fixTip
      });
    };

    const titleGood = title.length >= 40 && title.length <= 60;
    addSignal('Title Tag', titleGood ? 100 : 50, titleGood, 'Ensure title is between 40-60 characters.');
    
    const descGood = metaDesc.length >= 140 && metaDesc.length <= 160;
    addSignal('Meta Description', descGood ? 100 : (metaDesc ? 60 : 0), descGood, 'Add a meta description between 140-160 characters.');
    
    const h1Good = h1Count === 1;
    addSignal('H1 Tag Count', h1Good ? 100 : (h1Count > 1 ? 50 : 0), h1Good, 'Use exactly one H1 tag per page.');
    
    const densityGood = keywordDensity >= 1 && keywordDensity <= 3;
    addSignal('Keyword Density', densityGood ? 100 : 40, densityGood, 'Aim for 1-2% primary keyword density in body text.');
    
    addSignal('Image Alt Text', altPercentage, altPercentage === 100, 'Ensure all images have descriptive alt text.');
    addSignal('Canonical Tag', canonical ? 100 : 0, canonical, 'Add a canonical link tag.');
    addSignal('Open Graph Tags', ogTitle ? 100 : 0, ogTitle, 'Add Open Graph meta tags for social sharing.');
    addSignal('Structured Data', hasJsonLd ? 100 : 0, hasJsonLd, 'Add JSON-LD structured data (e.g. WebSite or LocalBusiness schema).');
    addSignal('Mobile Viewport', hasViewport ? 100 : 0, hasViewport, 'Add a viewport meta tag for mobile responsiveness.');
    
    const linkRatioGood = linkRatio > 30;
    addSignal('Internal/External Link Ratio', linkRatioGood ? 100 : 60, linkRatioGood, 'Increase internal linking to distribute link equity.');

    const overallScore = Math.round((totalScore / maxScore) * 100);
    const letterGrade = overallScore > 90 ? 'A' : overallScore > 80 ? 'B' : overallScore > 70 ? 'C' : overallScore > 60 ? 'D' : 'F';

    res.json({
      data: {
        overallScore,
        letterGrade,
        signals
      }
    });
  } catch (error) {
    console.error('SEO Audit error:', error);
    res.status(500).json({ error: 'Failed to analyze URL. Ensure it is accessible.' });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({ error: 'Internal server error' });
});

// Export for Vercel Serverless
export default app;

const PORT = process.env.PORT || 5000;
// Only start the server locally if not running in a Serverless environment
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

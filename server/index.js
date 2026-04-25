import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { nanoid } from 'nanoid';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import axios from 'axios';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Set up local JSON "database"
// Vercel serverless functions have a read-only filesystem except for /tmp
const isVercel = process.env.VERCEL || process.env.NODE_ENV === 'production';
const dbPath = isVercel ? path.join('/tmp', 'db.json') : path.join(__dirname, 'data', 'db.json');

function readDB() {
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify({ links: {}, analytics: {} }));
  }
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// ------------------------------------------------------------------
// MODULE 1: Cloudflare R2 + URL Shortener + Analytics
// ------------------------------------------------------------------

// R2 Setup
let s3Client = null;
if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
  s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

app.post('/api/share/upload', upload.single('file'), async (req, res) => {
  if (!s3Client) return res.status(500).json({ error: 'R2 not configured on server' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const slug = nanoid(8);
  const key = `${slug}-${req.file.originalname}`;
  
  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    const fileUrl = `${process.env.R2_PUBLIC_BASE_URL}/${key}`;
    const db = readDB();
    
    // Store metadata & long url mapping
    db.links[slug] = {
      slug,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      r2Key: key,
      longUrl: fileUrl,
      uploadedAt: new Date().toISOString(),
      downloadCount: 0
    };
    
    db.analytics[slug] = [];
    writeDB(db);

    const shortDomain = process.env.SHORT_DOMAIN || (req.headers.host ? `${req.protocol}://${req.headers.host}` : 'http://localhost:5000');
    res.json({ data: { slug, shortUrl: `${shortDomain}/s/${slug}` } });
  } catch (error) {
    console.error('R2 upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.post('/api/shorten', (req, res) => {
  const { longUrl, customSlug, requiresDataCollection } = req.body;
  if (!longUrl) return res.status(400).json({ error: 'longUrl required' });

  const slug = customSlug || nanoid(8);
  const db = readDB();

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
  writeDB(db);

  const shortDomain = process.env.SHORT_DOMAIN || (req.headers.host ? `${req.protocol}://${req.headers.host}` : 'http://localhost:5000');
  res.json({ data: { slug, shortUrl: `${shortDomain}/s/${slug}` } });
});

app.get('/s/:slug', (req, res) => {
  const { slug } = req.params;
  const db = readDB();
  const linkInfo = db.links[slug];

  if (!linkInfo) {
    return res.status(404).send('Link not found');
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
  writeDB(db);

  if (linkInfo.requiresDataCollection) {
    // Redirect to frontend lead gate page
    // Using absolute URL ensures it works even if the user clicks the backend port directly in dev
    const frontendUrl = process.env.FRONTEND_URL || (req.headers.host && req.headers.host.includes('localhost') ? 'http://localhost:5173' : '');
    return res.redirect(`${frontendUrl}/gate/${slug}`);
  }

  res.redirect(301, linkInfo.longUrl);
});

app.post('/api/s/:slug/submit', (req, res) => {
  const { slug } = req.params;
  const { name, contact } = req.body;
  const db = readDB();
  const linkInfo = db.links[slug];

  if (!linkInfo) {
    return res.status(404).json({ error: 'Link not found' });
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

  writeDB(db);

  res.json({ data: { longUrl: linkInfo.longUrl } });
});

app.get('/api/share/analytics', (req, res) => {
  const db = readDB();
  
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
      
      let ref = c.referer ? new URL(c.referer).hostname : 'Direct';
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
      leadsCount
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
      leads // Sent to the frontend
    }
  });
});

// ------------------------------------------------------------------
// MODULE 3: SEO Score Analyzer (Proxy)
// ------------------------------------------------------------------

app.post('/api/seo-audit', async (req, res) => {
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

// Export for Vercel Serverless
export default app;

const PORT = process.env.PORT || 5000;
// Only start the server locally if not running in a Serverless environment
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

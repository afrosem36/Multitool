import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Website base URL - change this to your actual domain
const SITE_URL = 'https://multitool.space';
const CURRENT_DATE = new Date().toISOString().split('T')[0];

// Define all routes and their priorities/changefreq
const routes = [
  // Main pages
  { path: '/', priority: 1.0, changefreq: 'daily' },
  { path: '/explore', priority: 0.9, changefreq: 'weekly' },
  { path: '/guides', priority: 0.8, changefreq: 'weekly' },
  { path: '/trending', priority: 0.8, changefreq: 'daily' },
  { path: '/favorites', priority: 0.7, changefreq: 'weekly' },

  // Main Tool Categories
  { path: '/pdf-tools', priority: 0.9, changefreq: 'weekly' },
  { path: '/image-tools', priority: 0.9, changefreq: 'weekly' },
  { path: '/text-tools', priority: 0.9, changefreq: 'weekly' },
  { path: '/calculators', priority: 0.8, changefreq: 'weekly' },
  { path: '/ai-tools', priority: 0.9, changefreq: 'weekly' },
  { path: '/utilities', priority: 0.8, changefreq: 'weekly' },
  { path: '/excel', priority: 0.8, changefreq: 'weekly' },

  // Popular PDF Tools
  { path: '/merge', priority: 0.8, changefreq: 'monthly' },
  { path: '/split', priority: 0.8, changefreq: 'monthly' },
  { path: '/protect', priority: 0.8, changefreq: 'monthly' },
  { path: '/organize', priority: 0.8, changefreq: 'monthly' },
  { path: '/edit', priority: 0.8, changefreq: 'monthly' },
  { path: '/watermark', priority: 0.7, changefreq: 'monthly' },
  { path: '/to-jpg', priority: 0.7, changefreq: 'monthly' },
  { path: '/to-word', priority: 0.7, changefreq: 'monthly' },
  { path: '/image-to-pdf', priority: 0.7, changefreq: 'monthly' },
  { path: '/word-to-pdf', priority: 0.7, changefreq: 'monthly' },
  { path: '/pdf/excel-to-pdf', priority: 0.7, changefreq: 'monthly' },
  { path: '/pdf-lightener', priority: 0.6, changefreq: 'monthly' },

  // Image Tools
  { path: '/image/compress', priority: 0.8, changefreq: 'monthly' },
  { path: '/image/collage', priority: 0.7, changefreq: 'monthly' },
  { path: '/image/enhance', priority: 0.7, changefreq: 'monthly' },
  { path: '/image/jpg-to-png', priority: 0.7, changefreq: 'monthly' },
  { path: '/image/png-to-jpg', priority: 0.7, changefreq: 'monthly' },
  { path: '/image/html-to-image', priority: 0.6, changefreq: 'monthly' },
  { path: '/image/heic-to-jpg', priority: 0.6, changefreq: 'monthly' },

  // Utility Tools
  { path: '/whatsapp-link-creator', priority: 0.8, changefreq: 'monthly' },
  { path: '/utilities/qr-generator', priority: 0.7, changefreq: 'monthly' },
  { path: '/utilities/qr-decoder', priority: 0.7, changefreq: 'monthly' },
  { path: '/utilities/url-shortener', priority: 0.7, changefreq: 'monthly' },
  { path: '/tools/json-formatter', priority: 0.6, changefreq: 'monthly' },
  { path: '/tools/sql-formatter', priority: 0.6, changefreq: 'monthly' },
  { path: '/tools/font-preview', priority: 0.6, changefreq: 'monthly' },
  { path: '/tools/passport-photo', priority: 0.6, changefreq: 'monthly' },
  { path: '/tools/html-ide', priority: 0.6, changefreq: 'monthly' },
  { path: '/tools/sql-practice', priority: 0.6, changefreq: 'monthly' },
  { path: '/tools/email-verifier', priority: 0.7, changefreq: 'monthly' },

  // Other Tools
  { path: '/tools/youtube-downloader', priority: 0.7, changefreq: 'monthly' },
  { path: '/tools/background-remover', priority: 0.7, changefreq: 'monthly' },
  { path: '/tools/audio-transcription', priority: 0.7, changefreq: 'monthly' },
  { path: '/tools/typing-test', priority: 0.6, changefreq: 'monthly' },
  { path: '/tools/data-converter', priority: 0.6, changefreq: 'monthly' },
  { path: '/tools/text-to-sql', priority: 0.6, changefreq: 'monthly' },
  { path: '/tools/mojibake-decoder', priority: 0.5, changefreq: 'monthly' },
  { path: '/seo-analyzer', priority: 0.6, changefreq: 'monthly' },

  // Calculators
  { path: '/calculator/personal-finance', priority: 0.6, changefreq: 'monthly' },
  { path: '/calculator/finance', priority: 0.6, changefreq: 'monthly' },
  { path: '/calculator/bmi', priority: 0.6, changefreq: 'monthly' },
  { path: '/calculator/age', priority: 0.6, changefreq: 'monthly' },
  { path: '/calculator/days', priority: 0.6, changefreq: 'monthly' },
  { path: '/calculator/duration', priority: 0.6, changefreq: 'monthly' },
  { path: '/calculator/currency', priority: 0.6, changefreq: 'monthly' },
  { path: '/calculator/unit-converter', priority: 0.6, changefreq: 'monthly' },

  // Excel Tools
  { path: '/excel/merge', priority: 0.7, changefreq: 'monthly' },
  { path: '/excel/convert', priority: 0.7, changefreq: 'monthly' },

  // AI Tools
  { path: '/ai-chat', priority: 0.8, changefreq: 'weekly' },

  // Trust Pages
  { path: '/about-us', priority: 0.8, changefreq: 'monthly' },
  { path: '/contact-us', priority: 0.7, changefreq: 'monthly' },
  { path: '/privacy-policy', priority: 0.7, changefreq: 'monthly' },
  { path: '/terms', priority: 0.7, changefreq: 'monthly' },
];

// Generate sitemap XML
const generateSitemap = () => {
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n';
  const xmlNamespace =
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

  const urls = routes
    .map(
      (route) => `
  <url>
    <loc>${SITE_URL}${route.path}</loc>
    <lastmod>${CURRENT_DATE}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>
    `
    )
    .join('');

  const xmlFooter = '</urlset>';

  return xmlHeader + xmlNamespace + urls + xmlFooter;
};

// Write sitemap to file
const writeSitemap = () => {
  const sitemapPath = path.join(__dirname, '../public/sitemap.xml');
  const sitemapContent = generateSitemap();

  try {
    fs.writeFileSync(sitemapPath, sitemapContent, 'utf-8');
    console.log(`✓ Sitemap generated successfully at ${sitemapPath}`);
    console.log(`✓ Total URLs in sitemap: ${routes.length}`);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    process.exit(1);
  }
};

// Generate sitemap index (for large sitemaps)
const generateSitemapIndex = () => {
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n';
  const xmlNamespace = '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  const sitemapEntry = `
  <sitemap>
    <loc>${SITE_URL}/sitemap.xml</loc>
    <lastmod>${CURRENT_DATE}</lastmod>
  </sitemap>
  `;

  const xmlFooter = '</sitemapindex>';

  return xmlHeader + xmlNamespace + sitemapEntry + xmlFooter;
};

// Run the generator
writeSitemap();
console.log('✓ Sitemap generation complete!');

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pdfTools = [
  '/merge',
  '/split',
  '/organize',
  '/word-to-pdf',
  '/image-to-pdf',
  '/watermark',
  '/edit',
  '/protect',
  '/to-jpg',
  '/to-word'
];

const textTools = [
  '/text/remove-punctuation',
  '/text/remove-accents',
  '/text/remove-duplicate-lines',
  '/text/remove-empty-lines',
  '/text/remove-line-breaks',
  '/text/remove-extra-spaces',
  '/text/remove-whitespace',
  '/text/remove-lines-containing',
  '/text/random-password-generator',
  '/text/random-words',
  '/text/random-emoji',
  '/text/word-repeater'
];

const extraRoutes = ['/', '/pdf-tools', '/text-tools', '/whatsapp-link-creator'];

const siteUrl =
  process.env.SITE_URL ||
  process.env.VITE_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://multitool.vercel.app');

const normalizedSiteUrl = siteUrl.replace(/\/+$/, '');
const allRoutes = [...extraRoutes, ...pdfTools, ...textTools];
const now = new Date().toISOString();

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allRoutes
  .map(
    (route) => `  <url>
    <loc>${normalizedSiteUrl}${route === '/' ? '/' : route}</loc>
    <lastmod>${now}</lastmod>
  </url>`
  )
  .join('\n')}
</urlset>
`;

const robots = `User-agent: *
Allow: /

Sitemap: ${normalizedSiteUrl}/sitemap.xml
`;

const publicDir = resolve(process.cwd(), 'public');
mkdirSync(publicDir, { recursive: true });
writeFileSync(resolve(publicDir, 'sitemap.xml'), xml, 'utf8');
writeFileSync(resolve(publicDir, 'robots.txt'), robots, 'utf8');

const distDir = resolve(process.cwd(), 'dist');
mkdirSync(distDir, { recursive: true });
writeFileSync(resolve(distDir, 'sitemap.xml'), xml, 'utf8');
writeFileSync(resolve(distDir, 'robots.txt'), robots, 'utf8');

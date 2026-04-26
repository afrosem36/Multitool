/**
 * SeoEngine.jsx — God-Level SEO System (Single File)
 *
 * Drop this file into your project and render <SeoManager /> once inside your Router.
 *
 * Usage:
 *   import SeoManager from './SeoEngine';
 *   // In your App.jsx (inside <BrowserRouter>):
 *   <SeoManager />
 *
 * Sitemap generation (Node.js only — run at build time):
 *   import { generateSitemap } from './SeoEngine';
 *   generateSitemap();
 *   // Or add to package.json scripts:
 *   // "build": "react-scripts build && node -e \"require('./src/seo/SeoEngine').generateSitemap()\""
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/* ═══════════════════════════════════════════════════════════════
   ① SITE META  —  edit these to match your brand
   ═══════════════════════════════════════════════════════════════ */

export const siteMeta = {
  siteName:      'ToolsHub',               // ← your site name
  siteOrigin:    'https://www.toolshub.space', // ← production domain (no trailing slash)
  themeColor:    '#2563EB',                // ← brand color
  twitterHandle: '@toolshub',             // ← Twitter/X handle
  locale:        'en_US',
  defaultImage:  '/og-default.png',        // ← default OG image (1200x630)
  datePublished: '2024-01-01',
  description:   'Free online tools for everyone. Merge PDFs, convert images, shorten URLs, generate QR codes — all in your browser, no signup required.',
  social: [
    'https://twitter.com/toolshub',
    'https://www.linkedin.com/company/toolshub',
  ],
};

/* ═══════════════════════════════════════════════════════════════
   ② TOOL CATALOGUE  —  add/remove tools here
   ═══════════════════════════════════════════════════════════════ */

const TOOL_LIST = [
  // PDF
  { path: '/pdf/merge',        name: 'Merge PDF',            description: 'Combine multiple PDF files into a single document online for free.' },
  { path: '/pdf/split',        name: 'Split PDF',            description: 'Extract specific pages or divide a large PDF into smaller files.' },
  { path: '/pdf/edit',         name: 'Edit PDF',             description: 'Modify existing PDF documents directly in the browser.' },
  { path: '/pdf/organize',     name: 'Organize PDF',         description: 'Rearrange, rotate, or delete pages within a PDF file.' },
  { path: '/pdf/protect',      name: 'Protect PDF',          description: 'Add password encryption to secure your sensitive PDF documents.' },
  { path: '/pdf/watermark',    name: 'Watermark PDF',        description: 'Add custom text or image watermarks to your PDF pages.' },
  { path: '/pdf/to-word',      name: 'PDF to Word',          description: 'Convert PDF documents into fully editable Word files.' },
  { path: '/pdf/from-word',    name: 'Word to PDF',          description: 'Convert Word documents into standard PDF format instantly.' },
  { path: '/pdf/to-jpg',       name: 'PDF to JPG',           description: 'Extract PDF pages and save them as high-quality JPG images.' },
  { path: '/pdf/from-image',   name: 'Image to PDF',         description: 'Convert JPG, PNG, and other images into a single PDF document.' },
  // Image
  { path: '/image/converter',  name: 'Image Converter',      description: 'Convert images between JPG, PNG, WebP, GIF, BMP, and TIFF.' },
  { path: '/image/heic',       name: 'HEIC Converter',       description: 'Convert Apple HEIC photos to standard JPG or PNG format.' },
  { path: '/image/compress',   name: 'Image Compressor',     description: 'Reduce image file sizes without losing significant quality.' },
  { path: '/image/enhance',    name: 'Image Enhancer',       description: 'Enhance and improve the visual quality of your photos online.' },
  { path: '/image/collage',    name: 'Collage Maker',        description: 'Combine multiple photos into custom collage layouts.' },
  { path: '/image/html-to-image', name: 'HTML to Image',    description: 'Convert HTML code or web snippets into image files.' },
  // Excel
  { path: '/excel/merge',      name: 'Excel Merger',         description: 'Combine multiple Excel spreadsheets into a single workbook.' },
  { path: '/excel/convert',    name: 'Excel Converter',      description: 'Convert Excel files to CSV, PDF, and other formats.' },
  // Calculators
  { path: '/calc/age',         name: 'Age Calculator',       description: 'Calculate your exact age in years, months, and days.' },
  { path: '/calc/bmi',         name: 'BMI Calculator',       description: 'Calculate Body Mass Index based on your height and weight.' },
  { path: '/calc/date',        name: 'Date Calculator',      description: 'Calculate the exact difference between two dates.' },
  { path: '/calc/workday',     name: 'Working Day Calculator', description: 'Calculate business days between dates, excluding weekends and holidays.' },
  { path: '/calc/duration',    name: 'Duration Calculator',  description: 'Add or subtract specific time durations easily.' },
  { path: '/calc/loan',        name: 'Loan Calculator',      description: 'Estimate mortgage payments, interest rates, and loan terms.' },
  { path: '/calc/tax',         name: 'Sales Tax Calculator', description: 'Calculate total purchase cost with customizable tax rates.' },
  { path: '/calc/unit',        name: 'Unit Converter',       description: 'Convert between different units of measurement and time zones.' },
  { path: '/calc/currency',    name: 'Currency Converter',   description: 'Convert between global currencies using live exchange rates.' },
  // Links
  { path: '/links/share',      name: 'Secure File Sharing',  description: 'Share files up to 250MB with auto-generated, expiring short links.' },
  { path: '/links/shorten',    name: 'URL Shortener',        description: 'Convert long URLs into short, trackable links with analytics.' },
  { path: '/links/whatsapp',   name: 'WhatsApp Link Creator', description: 'Generate pre-filled WhatsApp message links instantly.' },
  // QR
  { path: '/qr/generate',      name: 'QR Code Generator',   description: 'Create custom QR codes for URLs, text, emails, and contact cards.' },
  { path: '/qr/decode',        name: 'QR Code Decoder',     description: 'Upload a QR code image to decode and read its contents.' },
  // Text / Web
  { path: '/text/tools',       name: 'Text Tools',           description: 'Suite of text manipulation tools: case conversion, formatting, character counting.' },
  { path: '/text/seo',         name: 'SEO Analyzer',         description: 'Analyze web pages for on-page SEO metrics and improvement opportunities.' },
  { path: '/text/zodiac',      name: 'Zodiac Calculator',    description: 'Calculate your zodiac sign and get detailed astrological information.' },
];

/* ═══════════════════════════════════════════════════════════════
   ③ CATEGORY MAP  —  maps path prefix → display label + schema type
   ═══════════════════════════════════════════════════════════════ */

const CATEGORY_META = {
  '/pdf':   { label: 'PDF Tools',            appCategory: 'UtilitiesApplication' },
  '/image': { label: 'Image Tools',           appCategory: 'MultimediaApplication' },
  '/excel': { label: 'Excel & Data Tools',    appCategory: 'BusinessApplication' },
  '/calc':  { label: 'Calculators',           appCategory: 'FinanceApplication' },
  '/links': { label: 'Link & File Tools',     appCategory: 'UtilitiesApplication' },
  '/qr':    { label: 'QR Code Tools',         appCategory: 'UtilitiesApplication' },
  '/text':  { label: 'Text & Web Utilities',  appCategory: 'UtilitiesApplication' },
};

/* ═══════════════════════════════════════════════════════════════
   ④ PER-TOOL RICH DATA  —  FAQs + HowTo steps per page
      Add any path from TOOL_LIST for full rich result eligibility
   ═══════════════════════════════════════════════════════════════ */

const TOOL_RICH_DATA = {
  '/pdf/merge': {
    keywords: 'merge pdf, combine pdf files online, pdf merger, join pdf free, pdf combiner',
    featureList: ['No file size limit per file', 'Drag-and-drop reordering', 'No account required', 'Files deleted after download'],
    faqs: [
      { question: 'How do I merge PDF files online for free?', answer: 'Upload your PDF files, drag to reorder them, then click "Merge PDF". Your combined document downloads instantly with no account needed.' },
      { question: 'Is there a file size limit for merging PDFs?',  answer: 'You can merge PDFs up to 250 MB total. For larger batches, split them into groups.' },
      { question: 'Are my uploaded PDFs stored on your servers?',  answer: 'No. Files are processed in temporary memory and permanently deleted immediately after your download.' },
      { question: 'Can I merge password-protected PDFs?',          answer: 'Yes. You will be prompted to enter the password for each protected file before merging.' },
    ],
    howTo: {
      totalTime: 'PT1M',
      steps: [
        { name: 'Upload PDFs',   text: 'Click "Select Files" or drag and drop your PDF files onto the upload area.' },
        { name: 'Arrange Order', text: 'Drag the thumbnails to set the order they should appear in the final merged PDF.' },
        { name: 'Merge',         text: 'Click the "Merge PDF" button to combine all uploaded files into one.' },
        { name: 'Download',      text: 'Click "Download" to save your merged PDF file to your device.' },
      ],
    },
  },
  '/pdf/split': {
    keywords: 'split pdf, extract pdf pages, divide pdf online, pdf page extractor, free pdf splitter',
    featureList: ['Extract specific page ranges', 'Split into equal parts', 'No quality loss', 'Instant download'],
    faqs: [
      { question: 'Can I extract specific pages from a PDF?', answer: 'Yes. Enter page numbers or ranges (e.g. 1,3,5-8) and click Split to extract exactly those pages as a new PDF.' },
      { question: 'Does splitting reduce PDF quality?',        answer: 'No. Pages are extracted without re-encoding, so the original quality and formatting are perfectly preserved.' },
    ],
    howTo: {
      totalTime: 'PT1M',
      steps: [
        { name: 'Upload PDF',    text: 'Select or drag your PDF file to upload it.' },
        { name: 'Choose Pages',  text: 'Enter the specific page numbers or ranges you want to extract.' },
        { name: 'Split',         text: 'Click "Split PDF" to process and extract your selected pages.' },
        { name: 'Download',      text: 'Download the extracted pages as a new, separate PDF file.' },
      ],
    },
  },
  '/pdf/to-word': {
    keywords: 'pdf to word, convert pdf to docx, pdf to word converter online free, editable word from pdf',
    featureList: ['Preserves formatting', 'Tables and images supported', 'No quality loss', 'Instant conversion'],
    faqs: [
      { question: 'Does the PDF to Word converter preserve formatting?', answer: 'Yes. Text, tables, images, and layout are preserved as accurately as possible in the converted Word document.' },
      { question: 'Can I convert scanned PDFs to Word?',               answer: 'Yes. OCR (optical character recognition) is applied to scanned documents to extract and convert the text.' },
    ],
    howTo: {
      totalTime: 'PT1M',
      steps: [
        { name: 'Upload PDF',    text: 'Select or drag your PDF file.' },
        { name: 'Convert',       text: 'Click "Convert to Word" to start the conversion.' },
        { name: 'Download',      text: 'Download your editable .docx Word file.' },
      ],
    },
  },
  '/image/converter': {
    keywords: 'image converter, jpg to png, png to jpg online, webp converter, convert image format free',
    featureList: ['Supports 10+ formats', 'Batch conversion', 'Quality control slider', 'No watermarks added'],
    faqs: [
      { question: 'Which image formats can I convert between?', answer: 'You can convert between JPG, PNG, WebP, GIF, BMP, TIFF, ICO, and more — all for free.' },
      { question: 'Does converting images reduce quality?',      answer: 'Converting to lossy formats like JPG may reduce quality slightly depending on the quality slider. Converting to PNG or WebP preserves maximum quality.' },
    ],
    howTo: {
      totalTime: 'PT30S',
      steps: [
        { name: 'Upload Image',   text: 'Select or drag your image file.' },
        { name: 'Choose Format',  text: 'Pick the target format from the dropdown menu.' },
        { name: 'Convert',        text: 'Click "Convert" to process your image.' },
        { name: 'Download',       text: 'Download the converted image file.' },
      ],
    },
  },
  '/image/compress': {
    keywords: 'image compressor, compress jpg online, reduce image size, compress png free, image file size reducer',
    featureList: ['Up to 90% size reduction', 'No visible quality loss', 'Batch compression', 'All formats supported'],
    faqs: [
      { question: 'How much can I reduce an image file size?', answer: 'Most JPG and PNG images can be compressed by 60-90% with little to no visible quality difference.' },
      { question: 'Does compression affect image dimensions?',  answer: 'No. Compression only reduces file size. The pixel dimensions remain exactly the same.' },
    ],
    howTo: {
      totalTime: 'PT30S',
      steps: [
        { name: 'Upload Image',    text: 'Select or drag the image you want to compress.' },
        { name: 'Set Quality',     text: 'Adjust the quality slider to balance file size and visual quality.' },
        { name: 'Compress',        text: 'Click "Compress Image" to reduce the file size.' },
        { name: 'Download',        text: 'Download your compressed image.' },
      ],
    },
  },
  '/calc/bmi': {
    keywords: 'bmi calculator, body mass index calculator, check bmi online, healthy weight calculator free',
    featureList: ['Metric and imperial units', 'Instant calculation', 'BMI category explanation', 'Healthy range guide'],
    faqs: [
      { question: 'What is a healthy BMI range?',       answer: 'A BMI between 18.5 and 24.9 is considered healthy for most adults. Below 18.5 is underweight; 25-29.9 is overweight; 30 or above is obese.' },
      { question: 'Does BMI account for muscle mass?',  answer: 'No. BMI is a simple height-to-weight ratio and cannot distinguish between muscle and fat. Athletes may show a high BMI despite having low body fat.' },
      { question: 'Is this BMI calculator accurate?',   answer: 'It uses the standard WHO BMI formula (weight in kg divided by height in metres squared) and is accurate for most adults aged 18-65.' },
    ],
    howTo: {
      totalTime: 'PT15S',
      steps: [
        { name: 'Enter Height', text: 'Input your height in centimetres or feet and inches.' },
        { name: 'Enter Weight', text: 'Input your weight in kilograms or pounds.' },
        { name: 'Calculate',    text: 'Click "Calculate BMI" to see your result instantly.' },
        { name: 'Read Result',  text: 'View your BMI score and the corresponding health category with guidance.' },
      ],
    },
  },
  '/calc/loan': {
    keywords: 'home loan calculator, mortgage calculator, emi calculator, loan repayment calculator free, interest calculator',
    featureList: ['Monthly EMI calculation', 'Total interest breakdown', 'Amortisation schedule', 'Adjustable loan terms'],
    faqs: [
      { question: 'How is the monthly EMI calculated?', answer: 'EMI is calculated using the standard formula: EMI = P × r × (1+r)^n / ((1+r)^n - 1), where P is principal, r is monthly interest rate, and n is number of months.' },
      { question: 'Can I calculate a fixed vs floating rate loan?', answer: 'Yes. Enter your interest rate for a fixed-rate calculation. For floating rates, recalculate whenever your rate changes.' },
    ],
    howTo: {
      totalTime: 'PT20S',
      steps: [
        { name: 'Enter Loan Amount',  text: 'Input the total loan amount (principal).' },
        { name: 'Enter Interest Rate',text: 'Enter the annual interest rate as a percentage.' },
        { name: 'Enter Loan Term',    text: 'Set the loan duration in years or months.' },
        { name: 'Calculate',          text: 'Click "Calculate" to see your monthly EMI, total interest, and amortisation schedule.' },
      ],
    },
  },
  '/links/shorten': {
    keywords: 'url shortener, shorten url free, short link generator, custom short url, link shortener with analytics',
    featureList: ['Custom expiry times', 'Click analytics dashboard', 'No account required', 'Lead generation gate'],
    faqs: [
      { question: 'Are shortened links permanent?',          answer: 'By default yes. You can also set expiry times of 1 hour, 24 hours, 7 days, 30 days, or a custom timeframe.' },
      { question: 'Can I track clicks on my short links?',   answer: 'Yes. The analytics dashboard shows total clicks, top referrers, geographic data, and click-over-time charts.' },
      { question: 'Is there a limit on how many links I can create?', answer: 'No limit for free users. Enterprise accounts unlock advanced analytics and bulk link management.' },
    ],
    howTo: {
      totalTime: 'PT20S',
      steps: [
        { name: 'Paste URL',     text: 'Paste your long URL into the input field.' },
        { name: 'Set Expiry',    text: 'Optionally choose an expiry duration for the link.' },
        { name: 'Shorten',       text: 'Click "Shorten" to generate your short link instantly.' },
        { name: 'Copy & Share',  text: 'Copy the short link and share it anywhere.' },
      ],
    },
  },
  '/qr/generate': {
    keywords: 'qr code generator, create qr code free, qr code maker, custom qr code, qr code for website link',
    featureList: ['URL, text, vCard, email support', 'Custom colors and logo', 'PNG and SVG download', 'High error correction'],
    faqs: [
      { question: 'What types of content can I encode in a QR code?', answer: 'You can create QR codes for URLs, plain text, phone numbers, email addresses, and contact cards (vCard format).' },
      { question: 'Can I add my logo to the QR code?',               answer: 'Yes. Upload your logo and it will be placed in the center of the QR code with appropriate error correction to keep it scannable.' },
      { question: 'Are generated QR codes free to use commercially?', answer: 'Yes. All QR codes generated on this site are free to use for personal and commercial purposes with no attribution required.' },
    ],
    howTo: {
      totalTime: 'PT20S',
      steps: [
        { name: 'Choose Type',   text: 'Select the content type: URL, text, email, phone, or vCard.' },
        { name: 'Enter Content', text: 'Enter the data you want to encode in the QR code.' },
        { name: 'Customize',     text: 'Optionally adjust colors, add a logo, and set the size.' },
        { name: 'Download',      text: 'Download your QR code as a PNG or SVG file.' },
      ],
    },
  },
  '/links/share': {
    keywords: 'secure file sharing, share files online, upload and share file link, temporary file sharing free',
    featureList: ['Files up to 250MB', 'Auto-generated short link', 'In-browser preview', 'Custom expiry times'],
    faqs: [
      { question: 'What file types can I share?',          answer: 'You can share images, PDFs, audio, and video files up to 250MB. The recipient can preview them directly in the browser.' },
      { question: 'How long are shared files available?',  answer: 'You can set files to expire after 1 hour, 24 hours, 7 days, 30 days, or keep them permanently.' },
      { question: 'Is file sharing secure?',               answer: 'Yes. All file transfers are encrypted via HTTPS and stored on Cloudflare R2 infrastructure. Only people with the link can access the file.' },
    ],
    howTo: {
      totalTime: 'PT30S',
      steps: [
        { name: 'Upload File',     text: 'Click "Upload" or drag your file (image, PDF, audio, or video up to 250MB).' },
        { name: 'Set Expiry',      text: 'Choose how long the file link should remain active.' },
        { name: 'Get Link',        text: 'Copy the auto-generated short link.' },
        { name: 'Share',           text: 'Share the link via any messaging app, email, or social media.' },
      ],
    },
  },
};

/* ═══════════════════════════════════════════════════════════════
   ⑤ SCHEMA BUILDERS  (JSON-LD @graph)
   ═══════════════════════════════════════════════════════════════ */

const buildOrganizationSchema = (origin) => ({
  '@type': 'Organization',
  '@id': `${origin}/#organization`,
  name: siteMeta.siteName,
  url: origin,
  logo: {
    '@type': 'ImageObject',
    '@id': `${origin}/#logo`,
    url: `${origin}/logo.png`,
    width: 512, height: 512,
    caption: siteMeta.siteName,
  },
  image: { '@id': `${origin}/#logo` },
  description: siteMeta.description,
  sameAs: siteMeta.social,
});

const buildWebSiteSchema = (origin) => ({
  '@type': 'WebSite',
  '@id': `${origin}/#website`,
  url: origin,
  name: siteMeta.siteName,
  description: siteMeta.description,
  publisher: { '@id': `${origin}/#organization` },
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${origin}/search?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
  inLanguage: 'en-US',
});

const buildWebPageSchema = ({ origin, url, title, description, image, breadcrumbs }) => ({
  '@type': 'WebPage',
  '@id': `${url}#webpage`,
  url,
  name: title,
  description,
  isPartOf: { '@id': `${origin}/#website` },
  about: { '@id': `${origin}/#organization` },
  datePublished: siteMeta.datePublished,
  dateModified: new Date().toISOString().split('T')[0],
  image: { '@type': 'ImageObject', url: image },
  ...(breadcrumbs ? { breadcrumb: { '@id': `${url}#breadcrumb` } } : {}),
  inLanguage: 'en-US',
  potentialAction: { '@type': 'ReadAction', target: [url] },
});

const buildBreadcrumbSchema = ({ url, items }) => ({
  '@type': 'BreadcrumbList',
  '@id': `${url}#breadcrumb`,
  itemListElement: items.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: item.name,
    item: item.url,
  })),
});

const buildSoftwareAppSchema = ({ origin, url, name, description, applicationCategory, featureList = [], image }) => ({
  '@type': 'SoftwareApplication',
  '@id': `${url}#tool`,
  name, url, description, applicationCategory,
  operatingSystem: 'Web Browser',
  browserRequirements: 'Requires JavaScript. Requires HTML5.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
  featureList: featureList.join(', '),
  image: { '@type': 'ImageObject', url: image },
  isPartOf: { '@id': `${origin}/#website` },
  publisher: { '@id': `${origin}/#organization` },
  inLanguage: 'en-US',
});

const buildHowToSchema = ({ url, name, description, image, totalTime, steps }) => ({
  '@type': 'HowTo',
  '@id': `${url}#howto`,
  name, description, totalTime,
  image: { '@type': 'ImageObject', url: image },
  step: steps.map((step, i) => ({
    '@type': 'HowToStep',
    position: i + 1,
    name: step.name,
    text: step.text,
    url: `${url}#step-${i + 1}`,
  })),
});

const buildFAQSchema = (faqs) => ({
  '@type': 'FAQPage',
  mainEntity: faqs.map(({ question, answer }) => ({
    '@type': 'Question',
    name: question,
    acceptedAnswer: { '@type': 'Answer', text: answer },
  })),
});

const buildItemListSchema = ({ origin, items }) => ({
  '@type': 'ItemList',
  '@id': `${origin}/#toollist`,
  name: 'Free Online Tools',
  description: 'Complete collection of free PDF, image, calculator, and utility tools.',
  numberOfItems: items.length,
  itemListElement: items.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: item.name,
    url: item.url,
    description: item.description,
  })),
});

const graph = (schemas) => ({
  '@context': 'https://schema.org',
  '@graph': schemas.filter(Boolean),
});

/* ═══════════════════════════════════════════════════════════════
   ⑥ SEO DATA RESOLVER  —  getSeoData(pathname, origin)
   ═══════════════════════════════════════════════════════════════ */

const getHomepageSeo = (origin) => {
  const url         = origin;
  const title       = `${siteMeta.siteName} — Free Online PDF, Image & Utility Tools`;
  const description = siteMeta.description;
  const image       = `${origin}${siteMeta.defaultImage}`;

  return {
    title, description, url, image,
    keywords: 'free online tools, pdf tools, image converter, url shortener, qr code generator, bmi calculator, excel tools, file sharing',
    robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    breadcrumbs: null,
    schemas: graph([
      buildOrganizationSchema(origin),
      buildWebSiteSchema(origin),
      buildWebPageSchema({ origin, url, title, description, image, breadcrumbs: false }),
      buildItemListSchema({ origin, items: TOOL_LIST.map((t) => ({ name: t.name, url: `${origin}${t.path}`, description: t.description })) }),
      buildFAQSchema([
        { question: 'Are all tools on this site free?',        answer: 'Yes. All core tools are 100% free with no account required. Enterprise analytics features are available for power users.' },
        { question: 'Do you store uploaded files?',            answer: 'No. Files are processed in temporary memory and permanently deleted immediately after your download or session ends.' },
        { question: 'Do the tools work on mobile?',            answer: 'Yes. All tools are fully responsive and tested on smartphones, tablets, and desktop browsers.' },
        { question: 'Do I need to install any software?',      answer: 'No installation needed. Everything runs directly in your web browser — nothing to download or configure.' },
      ]),
    ]),
  };
};

const getToolPageSeo = (pathname, origin, tool) => {
  const url      = `${origin}${pathname}`;
  const rich     = TOOL_RICH_DATA[pathname] || {};
  const catKey   = Object.keys(CATEGORY_META).find((k) => pathname.startsWith(k));
  const catMeta  = CATEGORY_META[catKey] || {};
  const title    = `${tool.name} — Free Online Tool | ${siteMeta.siteName}`;
  const image    = `${origin}/og${pathname}.png`;
  const crumbs   = [
    { name: 'Home', url: origin },
    { name: catMeta.label || 'Tools', url: `${origin}${catKey}` },
    { name: tool.name, url },
  ];

  return {
    title,
    description: tool.description,
    keywords: rich.keywords || `${tool.name.toLowerCase()}, ${tool.name.toLowerCase()} online free, free ${tool.name.toLowerCase()} tool`,
    url, image,
    robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    breadcrumbs: crumbs,
    schemas: graph([
      buildWebPageSchema({ origin, url, title, description: tool.description, image, breadcrumbs: true }),
      buildBreadcrumbSchema({ url, items: crumbs }),
      buildSoftwareAppSchema({ origin, url, name: tool.name, description: tool.description, applicationCategory: catMeta.appCategory || 'UtilitiesApplication', featureList: rich.featureList || [], image }),
      rich.howTo && buildHowToSchema({ url, name: `How to use ${tool.name}`, description: tool.description, image, ...rich.howTo }),
      rich.faqs  && buildFAQSchema(rich.faqs),
    ]),
  };
};

const getCategoryPageSeo = (pathname, origin) => {
  const catMeta  = CATEGORY_META[pathname];
  const tools    = TOOL_LIST.filter((t) => t.path.startsWith(pathname));
  const url      = `${origin}${pathname}`;
  const title    = `Free ${catMeta.label} Online | ${siteMeta.siteName}`;
  const desc     = `Use our free ${catMeta.label.toLowerCase()} — ${tools.slice(0, 5).map((t) => t.name).join(', ')}, and more. No signup required.`;
  const image    = `${origin}/og${pathname}.png`;
  const crumbs   = [{ name: 'Home', url: origin }, { name: catMeta.label, url }];

  return {
    title, description: desc, url, image,
    keywords: `${catMeta.label.toLowerCase()}, free ${catMeta.label.toLowerCase()} online, ${tools.slice(0, 6).map((t) => t.name.toLowerCase()).join(', ')}`,
    robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    breadcrumbs: crumbs,
    schemas: graph([
      buildWebPageSchema({ origin, url, title, description: desc, image, breadcrumbs: true }),
      buildBreadcrumbSchema({ url, items: crumbs }),
      buildItemListSchema({ origin, items: tools.map((t) => ({ name: t.name, url: `${origin}${t.path}`, description: t.description })) }),
    ]),
  };
};

const getFallbackSeo = (pathname, origin) => {
  const url   = `${origin}${pathname}`;
  const title = `${siteMeta.siteName} — Free Online Tools`;
  return {
    title,
    description: siteMeta.description,
    keywords: 'free online tools, pdf tools, image tools, calculators',
    url,
    image: `${origin}${siteMeta.defaultImage}`,
    robots: 'index, follow',
    breadcrumbs: null,
    schemas: graph([buildWebPageSchema({ origin, url, title, description: siteMeta.description, image: `${origin}${siteMeta.defaultImage}`, breadcrumbs: false })]),
  };
};

export const getSeoData = (pathname, origin) => {
  if (pathname === '/') return getHomepageSeo(origin);
  const tool = TOOL_LIST.find((t) => t.path === pathname);
  if (tool) return getToolPageSeo(pathname, origin, tool);
  if (CATEGORY_META[pathname]) return getCategoryPageSeo(pathname, origin);
  return getFallbackSeo(pathname, origin);
};

/* ═══════════════════════════════════════════════════════════════
   ⑦ DOM HELPERS
   ═══════════════════════════════════════════════════════════════ */

const upsertMeta = (selector, attrs, content) => {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const upsertLink = (selector, attrs, href) => {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('link');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    document.head.appendChild(el);
  }
  if (href !== undefined) el.setAttribute('href', href);
};

const upsertJsonLd = (id, data) => {
  let el = document.head.querySelector(`#${id}`);
  if (!el) {
    el = document.createElement('script');
    el.setAttribute('id', id);
    el.setAttribute('type', 'application/ld+json');
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
};

const PRECONNECT_ORIGINS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'];

const injectStaticHints = () => {
  PRECONNECT_ORIGINS.forEach((href) => {
    if (!document.head.querySelector(`link[rel="preconnect"][href="${href}"]`)) {
      upsertLink(`link[rel="preconnect"][href="${href}"]`, { rel: 'preconnect', href, crossorigin: '' }, undefined);
      upsertLink(`link[rel="dns-prefetch"][href="${href}"]`, { rel: 'dns-prefetch', href }, undefined);
    }
  });
  upsertMeta('meta[http-equiv="X-UA-Compatible"]', { 'http-equiv': 'X-UA-Compatible' }, 'IE=edge');
  upsertMeta('meta[name="format-detection"]', { name: 'format-detection' }, 'telephone=no');
  let vp = document.head.querySelector('meta[name="viewport"]');
  if (!vp) { vp = document.createElement('meta'); vp.setAttribute('name', 'viewport'); document.head.insertBefore(vp, document.head.firstChild); }
  vp.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
};

/* ═══════════════════════════════════════════════════════════════
   ⑧ SEO MANAGER COMPONENT  —  <SeoManager /> inside <Router>
   ═══════════════════════════════════════════════════════════════ */

const SeoManager = () => {
  const location   = useLocation();
  const staticDone = useRef(false);
  const prevPath   = useRef(null);

  useEffect(() => {
    if (!staticDone.current) { injectStaticHints(); staticDone.current = true; }
  }, []);

  useEffect(() => {
    if (prevPath.current === location.pathname) return;
    prevPath.current = location.pathname;

    const origin = window.location.origin;
    const seo    = getSeoData(location.pathname, origin);

    // ── Document
    document.title = seo.title;
    document.documentElement.setAttribute('lang', 'en');

    // ── Core meta
    upsertMeta('meta[name="description"]',   { name: 'description' },   seo.description);
    upsertMeta('meta[name="keywords"]',      { name: 'keywords' },      seo.keywords);
    upsertMeta('meta[name="robots"]',        { name: 'robots' },        seo.robots);
    upsertMeta('meta[name="googlebot"]',     { name: 'googlebot' },     seo.robots);
    upsertMeta('meta[name="author"]',        { name: 'author' },        siteMeta.siteName);
    upsertMeta('meta[name="theme-color"]',   { name: 'theme-color' },   siteMeta.themeColor);
    upsertMeta('meta[name="rating"]',        { name: 'rating' },        'general');
    upsertMeta('meta[name="revisit-after"]', { name: 'revisit-after' }, '7 days');

    // ── Apple / PWA
    upsertMeta('meta[name="apple-mobile-web-app-capable"]',          { name: 'apple-mobile-web-app-capable' },          'yes');
    upsertMeta('meta[name="apple-mobile-web-app-status-bar-style"]', { name: 'apple-mobile-web-app-status-bar-style' }, 'default');
    upsertMeta('meta[name="apple-mobile-web-app-title"]',            { name: 'apple-mobile-web-app-title' },            siteMeta.siteName);
    upsertMeta('meta[name="mobile-web-app-capable"]',                { name: 'mobile-web-app-capable' },                'yes');
    upsertMeta('meta[name="application-name"]',                      { name: 'application-name' },                      siteMeta.siteName);

    // ── Open Graph
    upsertMeta('meta[property="og:type"]',         { property: 'og:type' },         'website');
    upsertMeta('meta[property="og:site_name"]',    { property: 'og:site_name' },    siteMeta.siteName);
    upsertMeta('meta[property="og:locale"]',       { property: 'og:locale' },       siteMeta.locale);
    upsertMeta('meta[property="og:title"]',        { property: 'og:title' },        seo.title);
    upsertMeta('meta[property="og:description"]',  { property: 'og:description' },  seo.description);
    upsertMeta('meta[property="og:url"]',          { property: 'og:url' },          seo.url);
    upsertMeta('meta[property="og:image"]',        { property: 'og:image' },        seo.image);
    upsertMeta('meta[property="og:image:alt"]',    { property: 'og:image:alt' },    seo.title);
    upsertMeta('meta[property="og:image:width"]',  { property: 'og:image:width' },  '1200');
    upsertMeta('meta[property="og:image:height"]', { property: 'og:image:height' }, '630');

    // ── Twitter / X
    upsertMeta('meta[name="twitter:card"]',        { name: 'twitter:card' },        'summary_large_image');
    upsertMeta('meta[name="twitter:site"]',        { name: 'twitter:site' },        siteMeta.twitterHandle);
    upsertMeta('meta[name="twitter:creator"]',     { name: 'twitter:creator' },     siteMeta.twitterHandle);
    upsertMeta('meta[name="twitter:title"]',       { name: 'twitter:title' },       seo.title);
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, seo.description);
    upsertMeta('meta[name="twitter:image"]',       { name: 'twitter:image' },       seo.image);
    upsertMeta('meta[name="twitter:image:alt"]',   { name: 'twitter:image:alt' },   seo.title);

    // ── Canonical + hreflang
    upsertLink('link[rel="canonical"]',                        { rel: 'canonical' },                           seo.url);
    upsertLink('link[rel="alternate"][hreflang="en"]',         { rel: 'alternate', hreflang: 'en' },           seo.url);
    upsertLink('link[rel="alternate"][hreflang="x-default"]',  { rel: 'alternate', hreflang: 'x-default' },   seo.url);

    // ── JSON-LD @graph
    upsertJsonLd('seo-schema-graph', seo.schemas);
    // Clean up old single-script pattern if migrating from legacy code
    document.head.querySelector('#seo-json-ld')?.remove();

  }, [location.pathname]);

  return null;
};

export default SeoManager;

/* ═══════════════════════════════════════════════════════════════
   ⑨ SITEMAP + ROBOTS GENERATOR  (Node.js — run at build time)
      Add to package.json:
      "build": "react-scripts build && node -e \"require('./src/seo/SeoEngine').generateSitemap()\""
   ═══════════════════════════════════════════════════════════════ */

export const generateSitemap = () => {
  /* Only runs in Node.js — safe to import in browser, just don't call it */
  if (typeof window !== 'undefined') return;

  const fs   = require('fs');
  const path = require('path');

  const origin    = siteMeta.siteOrigin;
  const outputDir = path.join(process.cwd(), 'public');
  const today     = new Date().toISOString().split('T')[0];

  const ROUTES = [
    { path: '/',              changefreq: 'daily',   priority: '1.0' },
    ...Object.keys(CATEGORY_META).map((p) => ({ path: p, changefreq: 'weekly', priority: '0.9' })),
    ...TOOL_LIST.map((t) => ({ path: t.path, changefreq: 'monthly', priority: '0.8' })),
  ];

  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...ROUTES.map(({ path: p, changefreq, priority }) =>
      `  <url>\n    <loc>${origin}${p}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
    ),
    '</urlset>',
  ].join('\n');

  const robots = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin/',
    'Disallow: /dashboard/',
    'Disallow: /auth/',
    '',
    'User-agent: Googlebot',
    'Allow: /',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
  ].join('\n');

  fs.writeFileSync(path.join(outputDir, 'sitemap.xml'), sitemap, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'robots.txt'),  robots,  'utf8');
  console.log(`✅ sitemap.xml — ${ROUTES.length} URLs`);
  console.log(`✅ robots.txt  — ${origin}`);
};

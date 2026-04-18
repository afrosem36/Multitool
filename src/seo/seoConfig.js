import { pdfTools, textTools } from '../data/toolCatalog';

export const siteMeta = {
  siteName: 'MultiTool',
  defaultTitle: 'PDF Tools, Text Tools and WhatsApp Link Creator | MultiTool',
  defaultDescription:
    'Use MultiTool to merge PDF files, split PDF pages, convert PDF documents, clean text, generate random text utilities, and create WhatsApp links online.',
  defaultKeywords:
    'pdf tools, merge pdf online, split pdf online, pdf to word, pdf to jpg, word to pdf, text tools, remove punctuation, remove line breaks, random password generator, whatsapp link creator, online tools',
  themeColor: '#0a0a0f'
};

export const homeFaqs = [
  {
    question: 'What can I do with MultiTool?',
    answer:
      'MultiTool gives you browser-based PDF tools, text cleanup utilities, random text generators, and a WhatsApp link creator in one place.'
  },
  {
    question: 'Do I need to install software to use these tools?',
    answer:
      'No. The tools are designed to run in the browser so you can work with PDFs, text, and links without installing desktop software.'
  },
  {
    question: 'Which PDF tasks are available on this website?',
    answer:
      'You can merge PDF files, split PDF pages, organize PDFs, protect PDFs, watermark PDFs, convert PDF to JPG, convert PDF to Word, and convert images or Word documents into PDF.'
  },
  {
    question: 'Can I create a WhatsApp link with a prefilled message?',
    answer:
      'Yes. The WhatsApp Link Creator builds a shareable link that opens WhatsApp with the selected phone number and message already filled in.'
  }
];

const breadcrumbLabelFromPath = (pathname) => {
  if (pathname === '/') {
    return 'Home';
  }

  if (pathname === '/pdf-tools') {
    return 'PDF Tools';
  }

  if (pathname === '/text-tools') {
    return 'Text Tools';
  }

  if (pathname === '/whatsapp-link-creator') {
    return 'WhatsApp Link Creator';
  }

  const pdfTool = pdfTools.find((tool) => tool.path === pathname);
  if (pdfTool) {
    return pdfTool.name;
  }

  const textTool = textTools.find((tool) => tool.path === pathname);
  if (textTool) {
    return textTool.name;
  }

  return 'MultiTool';
};

const buildBreadcrumbs = (pathname, origin) => {
  const breadcrumbs = [
    {
      name: 'Home',
      item: `${origin}/`
    }
  ];

  if (pathname === '/' || !origin) {
    return breadcrumbs;
  }

  if (pathname.startsWith('/text/')) {
    breadcrumbs.push({
      name: 'Text Tools',
      item: `${origin}/text-tools`
    });
  } else if (
    pathname !== '/pdf-tools' &&
    pathname !== '/text-tools' &&
    pathname !== '/whatsapp-link-creator'
  ) {
    breadcrumbs.push({
      name: 'PDF Tools',
      item: `${origin}/pdf-tools`
    });
  }

  breadcrumbs.push({
    name: breadcrumbLabelFromPath(pathname),
    item: `${origin}${pathname}`
  });

  return breadcrumbs;
};

const buildBreadcrumbSchema = (pathname, origin) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: buildBreadcrumbs(pathname, origin).map((crumb, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: crumb.name,
    item: crumb.item
  }))
});

const buildWebAppSchema = (title, description, url) => ({
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: title,
  url,
  description,
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Any',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD'
  }
});

const buildHomeSchemas = (origin, url, title, description) => [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteMeta.siteName,
    url: origin,
    description
  },
  buildWebAppSchema(title, description, url),
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: homeFaqs.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer
      }
    }))
  },
  {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Popular MultiTool Features',
    itemListElement: [...pdfTools.slice(0, 6), ...textTools.slice(0, 6)].map((tool, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${origin}${tool.path}`,
      name: tool.name
    }))
  },
  buildBreadcrumbSchema('/', origin)
];

const buildPdfToolMeta = (tool) => ({
  title: `${tool.name} Online Free | ${siteMeta.siteName}`,
  description: `${tool.description} Use ${tool.name.toLowerCase()} online with ${siteMeta.siteName} in your browser without installing extra software.`,
  keywords: `${tool.name.toLowerCase()}, pdf tool, online pdf utility, ${siteMeta.defaultKeywords}`
});

const buildTextToolMeta = (tool) => ({
  title: `${tool.name} Online | ${siteMeta.siteName}`,
  description: `${tool.description} Use ${tool.name.toLowerCase()} with ${siteMeta.siteName} in your browser for fast text processing and cleanup.`,
  keywords: `${tool.name.toLowerCase()}, text tools, online text utility, ${siteMeta.defaultKeywords}`
});

const routeMeta = {
  '/': {
    title: siteMeta.defaultTitle,
    description: siteMeta.defaultDescription,
    keywords: siteMeta.defaultKeywords
  },
  '/pdf-tools': {
    title: `Online PDF Tools Hub | ${siteMeta.siteName}`,
    description:
      'Browse PDF tools for merging, splitting, protecting, converting, organizing, and editing PDF files online in one workspace.',
    keywords: `pdf tools hub, pdf utilities, online pdf editor, ${siteMeta.defaultKeywords}`
  },
  '/text-tools': {
    title: `Online Text Tools Hub | ${siteMeta.siteName}`,
    description:
      'Browse text cleanup tools, random generators, and word utilities for removing punctuation, spaces, line breaks, and more.',
    keywords: `text tools hub, online text cleaner, random text generator, ${siteMeta.defaultKeywords}`
  },
  '/whatsapp-link-creator': {
    title: `WhatsApp Link Creator Online | ${siteMeta.siteName}`,
    description:
      'Create a WhatsApp link with phone number and prefilled message online. Generate, copy, and share chat links instantly.',
    keywords: `whatsapp link creator, whatsapp message link, wa.me link generator, ${siteMeta.defaultKeywords}`
  }
};

pdfTools.forEach((tool) => {
  routeMeta[tool.path] = buildPdfToolMeta(tool);
});

textTools.forEach((tool) => {
  routeMeta[tool.path] = buildTextToolMeta(tool);
});

export const getSeoData = (pathname, origin) => {
  const currentRouteMeta = routeMeta[pathname] || routeMeta['/'];
  const normalizedOrigin = origin || '';
  const url = normalizedOrigin ? `${normalizedOrigin}${pathname}` : pathname;

  const schemas =
    pathname === '/'
      ? buildHomeSchemas(normalizedOrigin, url, currentRouteMeta.title, currentRouteMeta.description)
      : [
          buildWebAppSchema(currentRouteMeta.title, currentRouteMeta.description, url),
          buildBreadcrumbSchema(pathname, normalizedOrigin)
        ];

  return {
    ...currentRouteMeta,
    url,
    image: normalizedOrigin ? `${normalizedOrigin}/og-cover.svg` : '/og-cover.svg',
    schemas
  };
};

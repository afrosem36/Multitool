import { imageTools, linkTools, pdfTools, textTools, calculatorTools } from '../data/toolCatalog';
import { guideArticles, sitePages } from '../data/contentPages';

export const siteMeta = {
  siteName: 'MultiTool',
  defaultTitle: 'PDF, Image, Text Tools and WhatsApp Link Creator | MultiTool',
  defaultDescription:
    'Use MultiTool to merge PDF files, compress and convert images, clean text, generate random text utilities, and create WhatsApp links online.',
  defaultKeywords:
    'pdf tools, image tools, compress image online, jpg to png, png to jpg, merge pdf online, split pdf online, pdf to word, text tools, remove punctuation, remove line breaks, random password generator, whatsapp link creator, online tools',
  themeColor: '#0a0a0f'
};

export const homeFaqs = [
  {
    question: 'What can I do with MultiTool?',
    answer:
      'MultiTool gives you browser-based PDF tools, image converters and enhancers, text cleanup utilities, random text generators, and a WhatsApp link creator in one place.'
  },
  {
    question: 'Do I need to install software to use these tools?',
    answer:
      'No. The tools are designed to run in the browser so you can work with PDFs, images, text, and links without installing desktop software.'
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

  if (pathname === '/image-tools') {
    return 'Image Tools';
  }

  if (pathname === '/whatsapp-link-creator') {
    return 'WhatsApp Link Creator';
  }

  if (pathname === '/calculators') {
    return 'Calculators';
  }

  if (pathname === '/guides') {
    return 'Guides';
  }

  const sitePage = sitePages.find((page) => page.path === pathname);
  if (sitePage) {
    return sitePage.title;
  }

  const guideArticle = guideArticles.find((article) => article.path === pathname);
  if (guideArticle) {
    return guideArticle.title;
  }

  const pdfTool = pdfTools.find((tool) => tool.path === pathname);
  if (pdfTool) {
    return pdfTool.name;
  }

  const textTool = textTools.find((tool) => tool.path === pathname);
  if (textTool) {
    return textTool.name;
  }

  const imageTool = imageTools.find((tool) => tool.path === pathname);
  if (imageTool) {
    return imageTool.name;
  }

  const calcTool = calculatorTools.find((tool) => tool.path === pathname);
  if (calcTool) {
    return calcTool.name;
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
  } else if (pathname === '/image-to-pdf' || pathname.startsWith('/image/')) {
    breadcrumbs.push({
      name: 'Image Tools',
      item: `${origin}/image-tools`
    });
  } else if (pathname.startsWith('/guides/')) {
    breadcrumbs.push({
      name: 'Guides',
      item: `${origin}/guides`
    });
  } else if (pathname.startsWith('/calculator/')) {
    breadcrumbs.push({
      name: 'Calculators & More',
      item: `${origin}/calculators`
    });
  } else if (
    pathname !== '/pdf-tools' &&
    pathname !== '/image-tools' &&
    pathname !== '/text-tools' &&
    pathname !== '/whatsapp-link-creator' &&
    pathname !== '/calculators' &&
    pathname !== '/guides' &&
    !sitePages.some((page) => page.path === pathname)
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
    priceCurrency: 'INR'
  }
});

const buildWebPageSchema = (title, description, url) => ({
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: title,
  url,
  description
});

const buildArticleSchema = (article, url) => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: article.title,
  description: article.description,
  articleSection: article.category,
  mainEntityOfPage: url,
  author: {
    '@type': 'Organization',
    name: siteMeta.siteName
  },
  publisher: {
    '@type': 'Organization',
    name: siteMeta.siteName
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
    '@type': 'Organization',
    name: siteMeta.siteName,
    url: origin,
    logo: normalizedUrl(origin, '/favicon.svg')
  },
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
    itemListElement: [...pdfTools.slice(0, 4), ...imageTools.slice(0, 4), ...textTools.slice(0, 4), ...linkTools].map((tool, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${origin}${tool.path}`,
      name: tool.name
    }))
  },
  {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Featured Guides',
    itemListElement: guideArticles.map((article, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${origin}${article.path}`,
      name: article.title
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

const buildImageToolMeta = (tool) => ({
  title: `${tool.name} Online | ${siteMeta.siteName}`,
  description: `${tool.description} Use ${tool.name.toLowerCase()} online with ${siteMeta.siteName} right in your browser.`,
  keywords: `${tool.name.toLowerCase()}, image tools, online image utility, ${siteMeta.defaultKeywords}`
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
  '/image-tools': {
    title: `Online Image Tools Hub | ${siteMeta.siteName}`,
    description:
      'Browse image tools for compression, enhancement, collage making, format conversion, HTML export, and image to PDF workflows online.',
    keywords: `image tools hub, image compression, jpg to png, png to jpg, html to image, ${siteMeta.defaultKeywords}`
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
  },
  '/calculators': {
    title: `Calculators & Utilities | ${siteMeta.siteName}`,
    description: 'A collection of useful calculators including Finance, BMI, Age, Duration, and Zodiac tools.',
    keywords: `online calculators, finance calculator, bmi calculator, age calculator, ${siteMeta.defaultKeywords}`
  },
  '/guides': {
    title: `Guides and Tutorials | ${siteMeta.siteName}`,
    description:
      'Read practical tutorials about PDF tools, image conversion, text cleanup, and business communication workflows.',
    keywords: `online guides, pdf guides, image conversion guides, text cleanup tutorials, ${siteMeta.defaultKeywords}`
  },
  '/terms': {
    title: `Terms of Service | ${siteMeta.siteName}`,
    description: 'Read the terms of service for using MultiTool, including acceptable use and liability limitations.',
    keywords: `terms of service, terms of use, legal terms, multitool terms, ${siteMeta.defaultKeywords}`
  }
};

pdfTools.forEach((tool) => {
  routeMeta[tool.path] = buildPdfToolMeta(tool);
});

textTools.forEach((tool) => {
  routeMeta[tool.path] = buildTextToolMeta(tool);
});

imageTools.forEach((tool) => {
  routeMeta[tool.path] = buildImageToolMeta(tool);
});

linkTools.forEach((tool) => {
  routeMeta[tool.path] = {
    title: `${tool.name} Online | ${siteMeta.siteName}`,
    description: `${tool.description} Generate a direct WhatsApp URL with phone number and automatic message text.`,
    keywords: `whatsapp link creator, wa.me generator, prefilled whatsapp message, ${siteMeta.defaultKeywords}`
  };
});

calculatorTools.forEach((tool) => {
  routeMeta[tool.path] = {
    title: `${tool.name} Online | ${siteMeta.siteName}`,
    description: `${tool.description} Use ${tool.name.toLowerCase()} with ${siteMeta.siteName} quickly and easily online.`,
    keywords: `${tool.name.toLowerCase()}, online calculator, ${siteMeta.defaultKeywords}`
  };
});

sitePages.forEach((page) => {
  routeMeta[page.path] = {
    title: `${page.title} | ${siteMeta.siteName}`,
    description: page.description,
    keywords: `${page.keywords}, ${siteMeta.defaultKeywords}`
  };
});

guideArticles.forEach((article) => {
  routeMeta[article.path] = {
    title: `${article.title} | ${siteMeta.siteName}`,
    description: article.description,
    keywords: `${article.keywords}, ${siteMeta.defaultKeywords}`
  };
});

function normalizedUrl(origin, path) {
  if (!origin) {
    return path;
  }

  return `${origin}${path}`;
}

export const getSeoData = (pathname, origin) => {
  const currentRouteMeta = routeMeta[pathname] || routeMeta['/'];
  const normalizedOrigin = origin || '';
  const url = normalizedOrigin ? `${normalizedOrigin}${pathname}` : pathname;

  const schemas =
    pathname === '/'
      ? buildHomeSchemas(normalizedOrigin, url, currentRouteMeta.title, currentRouteMeta.description)
      : (() => {
          const guideArticle = guideArticles.find((article) => article.path === pathname);
          const sitePage = sitePages.find((page) => page.path === pathname);

          if (guideArticle) {
            return [
              buildArticleSchema(guideArticle, url),
              buildWebPageSchema(currentRouteMeta.title, currentRouteMeta.description, url),
              buildBreadcrumbSchema(pathname, normalizedOrigin)
            ];
          }

          if (sitePage) {
            return [
              buildWebPageSchema(currentRouteMeta.title, currentRouteMeta.description, url),
              buildBreadcrumbSchema(pathname, normalizedOrigin)
            ];
          }

          if (pathname === '/guides') {
            return [
              buildWebPageSchema(currentRouteMeta.title, currentRouteMeta.description, url),
              {
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                name: 'MultiTool Guides',
                url,
                hasPart: guideArticles.map((article) => ({
                  '@type': 'Article',
                  headline: article.title,
                  url: `${normalizedOrigin}${article.path}`
                }))
              },
              buildBreadcrumbSchema(pathname, normalizedOrigin)
            ];
          }

          return [
            buildWebAppSchema(currentRouteMeta.title, currentRouteMeta.description, url),
            buildBreadcrumbSchema(pathname, normalizedOrigin)
          ];
        })();

  return {
    ...currentRouteMeta,
    url,
    image: normalizedOrigin ? `${normalizedOrigin}/og-cover.svg` : '/og-cover.svg',
    schemas
  };
};

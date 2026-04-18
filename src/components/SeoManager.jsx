import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getSeoData, siteMeta } from '../seo/seoConfig';

const upsertMetaTag = (selector, attributes, content) => {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement('meta');
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
};

const upsertLinkTag = (selector, attributes, href) => {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement('link');
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    document.head.appendChild(element);
  }

  element.setAttribute('href', href);
};

const SeoManager = () => {
  const location = useLocation();

  useEffect(() => {
    const origin = window.location.origin;
    const seo = getSeoData(location.pathname, origin);

    document.title = seo.title;
    document.documentElement.setAttribute('lang', 'en');

    upsertMetaTag('meta[name="description"]', { name: 'description' }, seo.description);
    upsertMetaTag('meta[name="keywords"]', { name: 'keywords' }, seo.keywords);
    upsertMetaTag('meta[name="robots"]', { name: 'robots' }, 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    upsertMetaTag('meta[name="googlebot"]', { name: 'googlebot' }, 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    upsertMetaTag('meta[name="author"]', { name: 'author' }, siteMeta.siteName);
    upsertMetaTag('meta[name="theme-color"]', { name: 'theme-color' }, siteMeta.themeColor);
    upsertMetaTag('meta[property="og:type"]', { property: 'og:type' }, 'website');
    upsertMetaTag('meta[property="og:site_name"]', { property: 'og:site_name' }, siteMeta.siteName);
    upsertMetaTag('meta[property="og:locale"]', { property: 'og:locale' }, 'en_US');
    upsertMetaTag('meta[property="og:title"]', { property: 'og:title' }, seo.title);
    upsertMetaTag('meta[property="og:description"]', { property: 'og:description' }, seo.description);
    upsertMetaTag('meta[property="og:url"]', { property: 'og:url' }, seo.url);
    upsertMetaTag('meta[property="og:image"]', { property: 'og:image' }, seo.image);
    upsertMetaTag('meta[property="og:image:alt"]', { property: 'og:image:alt' }, seo.title);
    upsertMetaTag('meta[name="twitter:card"]', { name: 'twitter:card' }, 'summary');
    upsertMetaTag('meta[name="twitter:title"]', { name: 'twitter:title' }, seo.title);
    upsertMetaTag('meta[name="twitter:description"]', { name: 'twitter:description' }, seo.description);
    upsertMetaTag('meta[name="twitter:image"]', { name: 'twitter:image' }, seo.image);

    upsertLinkTag('link[rel="canonical"]', { rel: 'canonical' }, seo.url);

    let schemaScript = document.head.querySelector('#seo-json-ld');
    if (!schemaScript) {
      schemaScript = document.createElement('script');
      schemaScript.setAttribute('id', 'seo-json-ld');
      schemaScript.setAttribute('type', 'application/ld+json');
      document.head.appendChild(schemaScript);
    }

    schemaScript.textContent = JSON.stringify(seo.schemas);
  }, [location.pathname]);

  return null;
};

export default SeoManager;

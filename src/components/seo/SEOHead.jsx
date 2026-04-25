import React from 'react';
import { Helmet } from 'react-helmet-async';
import { FEATURE_FLAGS } from '../../config';

export default function SEOHead({ 
  title, 
  description, 
  canonicalUrl, 
  ogType = 'website',
  ogImage = '/og-cover.svg',
  structuredData = null
}) {
  if (!FEATURE_FLAGS.ENABLE_SEO_HARDENING) return null;

  const siteName = 'MultiTool';
  const fullTitle = title ? `${title} · ${siteName}` : `PDF Tools, Text Tools and Utilities | ${siteName}`;
  
  // Default description if none provided
  const metaDesc = description || "Browser-based PDF tools, text cleanup utilities, converters, and random generators in one workspace.";

  return (
    <Helmet>
      {/* Basic HTML/Head */}
      <title>{fullTitle}</title>
      <meta name="description" content={metaDesc} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      
      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDesc} />
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:image" content={ogImage} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDesc} />
      <meta name="twitter:image" content={ogImage} />

      {/* Structured Data (JSON-LD) */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
}

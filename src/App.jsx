import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import CookieConsent from './components/CookieConsent';
import { guideArticles, sitePages } from './data/contentPages';
import { Loader2 } from 'lucide-react';

// Lazy loaded components
const Home = React.lazy(() => import('./pages/Home'));
const PdfMerger = React.lazy(() => import('./pages/PdfMerger'));
const PdfSplitter = React.lazy(() => import('./pages/PdfSplitter'));
const PdfToJpg = React.lazy(() => import('./pages/PdfToJpg'));
const PdfToWord = React.lazy(() => import('./pages/PdfToWord'));
const PdfProtect = React.lazy(() => import('./pages/PdfProtect'));
const PdfOrganize = React.lazy(() => import('./pages/PdfOrganize'));
const PdfEdit = React.lazy(() => import('./pages/PdfEdit'));
const PdfFromImage = React.lazy(() => import('./pages/PdfFromImage'));
const PdfWatermark = React.lazy(() => import('./pages/PdfWatermark'));
const WordToPdf = React.lazy(() => import('./pages/WordToPdf'));
const ImageCompress = React.lazy(() => import('./pages/ImageCompress'));
const ImageCollage = React.lazy(() => import('./pages/ImageCollage'));
const ImageEnhance = React.lazy(() => import('./pages/ImageEnhance'));
const JpgToPng = React.lazy(() => import('./pages/JpgToPng'));
const PngToJpg = React.lazy(() => import('./pages/PngToJpg'));
const HtmlToImage = React.lazy(() => import('./pages/HtmlToImage'));
const TextToolPage = React.lazy(() => import('./pages/TextToolPage'));
const ToolHubPage = React.lazy(() => import('./pages/ToolHubPage'));
const WhatsAppLinkCreator = React.lazy(() => import('./pages/WhatsAppLinkCreator'));
const GuidesHubPage = React.lazy(() => import('./pages/GuidesHubPage'));
const ArticlePage = React.lazy(() => import('./pages/ArticlePage'));
const InfoPage = React.lazy(() => import('./pages/InfoPage'));
const FavoritesPage = React.lazy(() => import('./pages/FavoritesPage'));
const ExcelMerger = React.lazy(() => import('./pages/ExcelMerger'));
const ExcelConverter = React.lazy(() => import('./pages/ExcelConverter'));

// New dedicated SEO pages
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'));
const Terms = React.lazy(() => import('./pages/Terms'));
const Contact = React.lazy(() => import('./pages/Contact'));

// Utility pages
const QrGenerator = React.lazy(() => import('./pages/QrGenerator'));
const QrDecoder = React.lazy(() => import('./pages/QrDecoder'));
const UnitConverter = React.lazy(() => import('./pages/UnitConverter'));

// Calculator pages
const PersonalFinanceCalculator = React.lazy(() => import('./pages/PersonalFinanceCalculator'));
const FinanceCalculator = React.lazy(() => import('./pages/FinanceCalculator'));
const BmiCalculator = React.lazy(() => import('./pages/BmiCalculator'));
const AgeCalculator = React.lazy(() => import('./pages/AgeCalculator'));
const DaysCalculator = React.lazy(() => import('./pages/DaysCalculator'));
const DurationCalculator = React.lazy(() => import('./pages/DurationCalculator'));
const ZodiacCalculator = React.lazy(() => import('./pages/ZodiacCalculator'));
const WorkingDayCalculator = React.lazy(() => import('./pages/WorkingDayCalculator'));
const SalesTaxCalculator = React.lazy(() => import('./pages/SalesTaxCalculator'));
const HomeLoanCalculator = React.lazy(() => import('./pages/HomeLoanCalculator'));
const CurrencyConverter = React.lazy(() => import('./pages/CurrencyConverter'));
const SkyToggleDemo = React.lazy(() => import('./pages/SkyToggleDemo'));

import { FEATURE_FLAGS } from './config';

const PageLoader = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
    <div className="skeleton" style={{ height: '200px', width: '100%', borderRadius: '16px' }}></div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
      <div className="skeleton" style={{ height: '200px', borderRadius: '16px' }}></div>
      <div className="skeleton" style={{ height: '200px', borderRadius: '16px' }}></div>
      <div className="skeleton" style={{ height: '200px', borderRadius: '16px' }}></div>
    </div>
  </div>
);

// New Feature Modules
const FileShare = React.lazy(() => import('./pages/FileShare'));
const AnalyticsDashboard = React.lazy(() => import('./pages/AnalyticsDashboard'));
const HeicConverter = React.lazy(() => import('./pages/HeicConverter'));
const SeoAnalyzer = React.lazy(() => import('./pages/SeoAnalyzer'));
const TimeUnitConverter = React.lazy(() => import('./pages/TimeUnitConverter'));
const UrlShortener = React.lazy(() => import('./pages/UrlShortener'));
const LeadGate = React.lazy(() => import('./pages/LeadGate'));
const ExpiredLink = React.lazy(() => import('./pages/ExpiredLink'));

// Auth Pages
import { Login, Signup } from './pages/AuthPages';

const Trending = React.lazy(() => import('./pages/Trending'));

import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Standalone route without Layout */}
          <Route path="/gate/:slug" element={<LeadGate />} />
          <Route path="/link-expired/:slug" element={<ExpiredLink />} />

          {/* Main Application with Layout */}
          <Route path="/*" element={
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/favorites" element={<FavoritesPage />} />
                <Route path="/trending" element={<Trending />} />
            <Route path="/guides" element={<GuidesHubPage />} />
            <Route path="/pdf-tools" element={<ToolHubPage sectionId="pdf" />} />
            <Route path="/image-tools" element={<ToolHubPage sectionId="image" />} />
            <Route path="/text-tools" element={<ToolHubPage sectionId="text" />} />
            <Route path="/calculators" element={<ToolHubPage sectionId="calculators" />} />
            <Route path="/utilities" element={<ToolHubPage sectionId="utilities" />} />
            <Route path="/excel" element={<ToolHubPage sectionId="excel" />} />
            <Route path="/whatsapp-link-creator" element={<WhatsAppLinkCreator />} />
            <Route path="/merge" element={<PdfMerger />} />
            <Route path="/split" element={<PdfSplitter />} />
            <Route path="/protect" element={<PdfProtect />} />
            <Route path="/organize" element={<PdfOrganize />} />
            <Route path="/edit" element={<PdfEdit />} />
            <Route path="/image-to-pdf" element={<PdfFromImage />} />
            <Route path="/image/compress" element={<ImageCompress />} />
            <Route path="/image/collage" element={<ImageCollage />} />
            <Route path="/image/enhance" element={<ImageEnhance />} />
            <Route path="/image/jpg-to-png" element={<JpgToPng />} />
            <Route path="/image/png-to-jpg" element={<PngToJpg />} />
            <Route path="/image/html-to-image" element={<HtmlToImage />} />
            <Route path="/watermark" element={<PdfWatermark />} />
            <Route path="/word-to-pdf" element={<WordToPdf />} />
            <Route path="/to-jpg" element={<PdfToJpg />} />
            <Route path="/to-word" element={<PdfToWord />} />
            <Route path="/text/:toolId" element={<TextToolPage />} />
            
            {/* Excel Tools */}
            <Route path="/excel/merge" element={<ExcelMerger />} />
            <Route path="/excel/convert" element={<ExcelConverter />} />

            {/* Calculators */}
            <Route path="/calculator/personal-finance" element={<PersonalFinanceCalculator />} />
            <Route path="/calculator/finance" element={<FinanceCalculator />} />
            <Route path="/calculator/bmi" element={<BmiCalculator />} />
            <Route path="/calculator/age" element={<AgeCalculator />} />
            <Route path="/calculator/days" element={<DaysCalculator />} />
            <Route path="/calculator/duration" element={<DurationCalculator />} />
            <Route path="/calculator/zodiac" element={<ZodiacCalculator />} />
            <Route path="/calculator/working-days" element={<WorkingDayCalculator />} />
            <Route path="/calculator/sales-tax" element={<SalesTaxCalculator />} />
            <Route path="/calculator/home-loan" element={<HomeLoanCalculator />} />
            <Route path="/calculator/currency" element={<CurrencyConverter />} />
            <Route path="/calculator/unit-converter" element={<UnitConverter />} />
            {FEATURE_FLAGS.ENABLE_TIME_CONVERTER && (
              <Route path="/calculator/precision-time-converter" element={<TimeUnitConverter />} />
            )}
            
            {/* Utilities */}
            <Route path="/utilities/qr-generator" element={<QrGenerator />} />
            <Route path="/utilities/qr-decoder" element={<QrDecoder />} />
            <Route path="/utilities/unit-converter" element={<UnitConverter />} />
            <Route path="/utilities/url-shortener" element={<UrlShortener />} />
            <Route path="/demo/sky-toggle" element={<SkyToggleDemo />} />

            {/* Feature Flags */}
            {FEATURE_FLAGS.ENABLE_FILE_SHARING && (
              <>
                <Route path="/share" element={<FileShare />} />
                <Route path="/analytics" element={<AnalyticsDashboard />} />
                <Route path="/dashboard" element={<AnalyticsDashboard />} />
              </>
            )}
            {FEATURE_FLAGS.ENABLE_HEIC_CONVERTER && (
              <Route path="/image/heic-to-jpg" element={<HeicConverter />} />
            )}
            {FEATURE_FLAGS.ENABLE_SEO_ANALYZER && (
              <Route path="/seo-analyzer" element={<SeoAnalyzer />} />
            )}
            {FEATURE_FLAGS.ENABLE_TIME_CONVERTER && (
              <Route path="/time-converter" element={<TimeUnitConverter />} />
            )}
            
            {/* Dedicated compliance pages */}
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/contact-us" element={<Contact />} />
            
            {guideArticles.map((article) => (
              <Route key={article.path} path={article.path} element={<ArticlePage />} />
            ))}
            {sitePages.filter(p => !['/privacy-policy', '/contact-us'].includes(p.path)).map((page) => (
              <Route key={page.path} path={page.path} element={<InfoPage />} />
            ))}
              </Routes>
            </Layout>
          } />
        </Routes>
      </Suspense>
      <CookieConsent />
      <Toaster position="bottom-right" toastOptions={{
        style: {
          background: 'var(--surface-color)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)'
        }
      }} />
    </Router>
  );
}

export default App;

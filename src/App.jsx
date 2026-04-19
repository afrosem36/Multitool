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

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
    <Loader2 size={48} className="spin text-gradient" />
  </div>
);

function App() {
  return (
    <Router>
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/guides" element={<GuidesHubPage />} />
            <Route path="/pdf-tools" element={<ToolHubPage sectionId="pdf" />} />
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
            <Route path="/watermark" element={<PdfWatermark />} />
            <Route path="/word-to-pdf" element={<WordToPdf />} />
            <Route path="/to-jpg" element={<PdfToJpg />} />
            <Route path="/to-word" element={<PdfToWord />} />
            <Route path="/text/:toolId" element={<TextToolPage />} />
            
            {/* Excel Tools */}
            <Route path="/excel/merge" element={<ExcelMerger />} />
            <Route path="/excel/convert" element={<ExcelConverter />} />

            {/* Calculators */}
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
            
            {/* Utilities */}
            <Route path="/utilities/qr-generator" element={<QrGenerator />} />
            <Route path="/utilities/qr-decoder" element={<QrDecoder />} />
            <Route path="/utilities/unit-converter" element={<UnitConverter />} />
            
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
        </Suspense>
        <CookieConsent />
      </Layout>
    </Router>
  );
}

export default App;

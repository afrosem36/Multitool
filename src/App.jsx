import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import CookieConsent from './components/CookieConsent';
import { guideArticles, sitePages } from './data/contentPages';
import { FEATURE_FLAGS } from './config';

const Home = React.lazy(() => import('./pages/misc/Home'));
const PdfMerger = React.lazy(() => import('./pages/pdf-tools/PdfMerger'));
const PdfSplitter = React.lazy(() => import('./pages/pdf-tools/PdfSplitter'));
const PdfToJpg = React.lazy(() => import('./pages/pdf-tools/PdfToJpg'));
const PdfToWord = React.lazy(() => import('./pages/pdf-tools/PdfToWord'));
const PdfProtect = React.lazy(() => import('./pages/pdf-tools/PdfProtect'));
const PdfOrganize = React.lazy(() => import('./pages/pdf-tools/PdfOrganize'));
const PdfEdit = React.lazy(() => import('./pages/pdf-tools/PdfEdit'));
const PdfFromImage = React.lazy(() => import('./pages/pdf-tools/PdfFromImage'));
const PdfWatermark = React.lazy(() => import('./pages/pdf-tools/PdfWatermark'));
const WordToPdf = React.lazy(() => import('./pages/other-tools/WordToPdf'));
const ImageCompress = React.lazy(() => import('./pages/image-tools/ImageCompress'));
const ImageCollage = React.lazy(() => import('./pages/image-tools/ImageCollage'));
const ImageEnhance = React.lazy(() => import('./pages/image-tools/ImageEnhance'));
const JpgToPng = React.lazy(() => import('./pages/image-tools/JpgToPng'));
const PngToJpg = React.lazy(() => import('./pages/image-tools/PngToJpg'));
const HtmlToImage = React.lazy(() => import('./pages/image-tools/HtmlToImage'));
const TextToolPage = React.lazy(() => import('./pages/misc/TextToolPage'));
const ToolHubPage = React.lazy(() => import('./pages/misc/ToolHubPage'));
const WhatsAppLinkCreator = React.lazy(() => import('./pages/other-tools/WhatsAppLinkCreator'));
const GuidesHubPage = React.lazy(() => import('./pages/misc/GuidesHubPage'));
const ArticlePage = React.lazy(() => import('./pages/content/ArticlePage'));
const InfoPage = React.lazy(() => import('./pages/content/InfoPage'));
const FavoritesPage = React.lazy(() => import('./pages/misc/FavoritesPage'));
const ExcelMerger = React.lazy(() => import('./pages/excel-tools/ExcelMerger'));
const ExcelConverter = React.lazy(() => import('./pages/excel-tools/ExcelConverter'));
const PrivacyPolicy = React.lazy(() => import('./pages/content/PrivacyPolicy'));
const Terms = React.lazy(() => import('./pages/content/Terms'));
const Contact = React.lazy(() => import('./pages/content/Contact'));
const AboutUs = React.lazy(() => import('./pages/content/AboutUs'));
const QrGenerator = React.lazy(() => import('./pages/other-tools/QrGenerator'));
const QrDecoder = React.lazy(() => import('./pages/other-tools/QrDecoder'));
const UnitConverter = React.lazy(() => import('./pages/calculators/UnitConverter'));
const PersonalFinanceCalculator = React.lazy(() => import('./pages/calculators/PersonalFinanceCalculator'));
const FinanceCalculator = React.lazy(() => import('./pages/calculators/FinanceCalculator'));
const BmiCalculator = React.lazy(() => import('./pages/calculators/BmiCalculator'));
const AgeCalculator = React.lazy(() => import('./pages/calculators/AgeCalculator'));
const DaysCalculator = React.lazy(() => import('./pages/calculators/DaysCalculator'));
const DurationCalculator = React.lazy(() => import('./pages/calculators/DurationCalculator'));
const ZodiacCalculator = React.lazy(() => import('./pages/calculators/ZodiacCalculator'));
const WorkingDayCalculator = React.lazy(() => import('./pages/calculators/WorkingDayCalculator'));
const SalesTaxCalculator = React.lazy(() => import('./pages/calculators/SalesTaxCalculator'));
const HomeLoanCalculator = React.lazy(() => import('./pages/calculators/HomeLoanCalculator'));
const VehicleMileageCalculator = React.lazy(() => import('./pages/calculators/VehicleMileageCalculator'));
const CurrencyConverter = React.lazy(() => import('./pages/calculators/CurrencyConverter'));
const SkyToggleDemo = React.lazy(() => import('./pages/misc/SkyToggleDemo'));
const FileShare = React.lazy(() => import('./pages/misc/FileShare'));
const AnalyticsDashboard = React.lazy(() => import('./pages/admin/AnalyticsDashboard'));
const DeployDashboard = React.lazy(() => import('./pages/admin/DeployDashboard'));
const HeicConverter = React.lazy(() => import('./pages/image-tools/HeicConverter'));
const SeoAnalyzer = React.lazy(() => import('./pages/other-tools/SeoAnalyzer'));
const TimeUnitConverter = React.lazy(() => import('./pages/calculators/TimeUnitConverter'));
const UrlShortener = React.lazy(() => import('./pages/other-tools/UrlShortener'));
const LeadGate = React.lazy(() => import('./pages/misc/LeadGate'));
const ExpiredLink = React.lazy(() => import('./pages/misc/ExpiredLink'));
const ForgotPassword = React.lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = React.lazy(() => import('./pages/auth/ResetPassword'));
const ExcelToPdf = React.lazy(() => import('./pages/excel-tools/ExcelToPdf'));
const FontPreview = React.lazy(() => import('./pages/other-tools/FontPreview'));
const PassportPhotoCropper = React.lazy(() => import('./pages/other-tools/PassportPhotoCropper'));
const JsonFormatter = React.lazy(() => import('./pages/other-tools/JsonFormatter'));
const DataConverter = React.lazy(() => import('./pages/other-tools/DataConverter'));
const SqlFormatter = React.lazy(() => import('./pages/other-tools/SqlFormatter'));
const TextToSql = React.lazy(() => import('./pages/other-tools/TextToSql'));
const AudioTranscription = React.lazy(() => import('./pages/other-tools/AudioTranscription'));
const TypingSpeedTest = React.lazy(() => import('./pages/other-tools/TypingSpeedTest'));
const PdfLightener = React.lazy(() => import('./pages/pdf-tools/PdfLightener'));
const BackgroundRemover = React.lazy(() => import('./pages/other-tools/BackgroundRemover'));
const HtmlIde = React.lazy(() => import('./pages/other-tools/HtmlIde'));
const SqlPractice = React.lazy(() => import('./pages/other-tools/SqlPractice'));
const MojibakeDecoder = React.lazy(() => import('./pages/other-tools/MojibakeDecoder'));
const GamesHub = React.lazy(() => import('./pages/games/GamesHub'));
const AllToolsPage = React.lazy(() => import('./pages/misc/AllToolsPage'));
const YouTubeDownloader = React.lazy(() => import('./pages/other-tools/YouTubeDownloader'));
const Trending = React.lazy(() => import('./pages/misc/Trending'));
const AdminPage = React.lazy(() => import('./pages/admin/AdminPage'));
const AiChat    = React.lazy(() => import('./pages/ai/AiChat'));
const AnimatedAIChatDemo = React.lazy(() => import('./pages/ai/AnimatedAIChatDemo'));
const ReportAnalyzer = React.lazy(() => import('./pages/ai/ReportAnalyzer'));
const ShortLinkRedirect = React.lazy(() => import('./pages/misc/ShortLinkRedirect'));
import { Login, Signup } from './pages/auth/AuthPages';
import GlobalBackground from './components/GlobalBackground';

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

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Short link redirects — must come before Layout to avoid layout wrapper */}
      <Route path="/s/:slug" element={<ShortLinkRedirect />} />

      <Route path="/gate/:slug" element={<LeadGate />} />
      <Route path="/link-expired/:slug" element={<ExpiredLink />} />
      <Route path="/ai-chat" element={<AiChat />} />
      <Route path="/ai-chat-demo" element={<AnimatedAIChatDemo />} />
      <Route path="/ai/report-analyzer" element={<ReportAnalyzer />} />

      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/trending" element={<Trending />} />
        <Route path="/guides" element={<GuidesHubPage />} />
        <Route path="/pdf-tools" element={<ToolHubPage sectionId="pdf" />} />
        <Route path="/image-tools" element={<ToolHubPage sectionId="image" />} />
        <Route path="/text-tools" element={<ToolHubPage sectionId="text" />} />
        <Route path="/calculators" element={<ToolHubPage sectionId="calculators" />} />
        <Route path="/ai-tools" element={<ToolHubPage sectionId="ai" />} />
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
        <Route path="/pdf/excel-to-pdf" element={<ExcelToPdf />} />
        <Route path="/text/:toolId" element={<TextToolPage />} />
        <Route path="/excel/merge" element={<ExcelMerger />} />
<Route path="/excel/convert" element={<ExcelConverter />} />
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
        <Route path="/calculator/vehicle-mileage" element={<VehicleMileageCalculator />} />
        <Route path="/calculator/currency" element={<CurrencyConverter />} />
        <Route path="/calculator/unit-converter" element={<UnitConverter />} />
        {FEATURE_FLAGS.ENABLE_TIME_CONVERTER && (
          <Route path="/calculator/precision-time-converter" element={<TimeUnitConverter />} />
        )}
        <Route path="/utilities/qr-generator" element={<QrGenerator />} />
        <Route path="/utilities/qr-decoder" element={<QrDecoder />} />
<Route path="/utilities/unit-converter" element={<UnitConverter />} />
        <Route path="/utilities/url-shortener" element={<UrlShortener />} />
        <Route path="/demo/sky-toggle" element={<SkyToggleDemo />} />
        <Route path="/tools/font-preview" element={<FontPreview />} />
        <Route path="/tools/passport-photo" element={<PassportPhotoCropper />} />
        <Route path="/tools/json-formatter" element={<JsonFormatter />} />
        <Route path="/tools/data-converter" element={<DataConverter />} />
        <Route path="/tools/sql-formatter" element={<SqlFormatter />} />
        <Route path="/tools/text-to-sql" element={<TextToSql />} />
        {FEATURE_FLAGS.enableTranscription && (
          <Route path="/tools/audio-transcription" element={<AudioTranscription />} />
        )}
        <Route path="/tools/typing-test" element={<TypingSpeedTest />} />
        <Route path="/tools/pdf-lightener" element={<PdfLightener />} />
        <Route path="/tools/background-remover" element={<BackgroundRemover />} />
        <Route path="/tools/html-ide" element={<HtmlIde />} />
        <Route path="/tools/sql-practice" element={<SqlPractice />} />
        <Route path="/tools/mojibake-decoder" element={<MojibakeDecoder />} />
        <Route path="/games" element={<GamesHub />} />
        <Route path="/explore" element={<AllToolsPage />} />
        <Route path="/downloader-tools" element={<ToolHubPage sectionId="downloader" />} />
        <Route path="/tools/youtube-downloader" element={<YouTubeDownloader />} />
        {FEATURE_FLAGS.ENABLE_FILE_SHARING && (
          <>
            <Route path="/share" element={<FileShare />} />
            <Route path="/analytics" element={<AnalyticsDashboard />} />
            <Route path="/dashboard" element={<AnalyticsDashboard />} />
            <Route path="/dashboard/deployments" element={<DeployDashboard />} />
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
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/contact-us" element={<Contact />} />
        <Route path="/about-us" element={<AboutUs />} />
        <Route path="/admin" element={<AdminPage />} />
        {guideArticles.map((article) => (
          <Route key={article.path} path={article.path} element={<ArticlePage />} />
        ))}
        {sitePages
          .filter((page) => !['/privacy-policy', '/contact-us'].includes(page.path))
          .map((page) => (
            <Route key={page.path} path={page.path} element={<InfoPage />} />
          ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  useEffect(() => {
    console.log("API URL:", import.meta.env.VITE_API_URL);
  }, []);

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <GlobalBackground />
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <AppRoutes />
      </Suspense>
      <CookieConsent />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--surface-color)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
          },
        }}
      />
    </Router>
  );
}

export default App;

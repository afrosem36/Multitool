import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import PdfMerger from './pages/PdfMerger';
import PdfSplitter from './pages/PdfSplitter';
import PdfToJpg from './pages/PdfToJpg';
import PdfToWord from './pages/PdfToWord';
import PdfProtect from './pages/PdfProtect';
import PdfOrganize from './pages/PdfOrganize';
import PdfEdit from './pages/PdfEdit';
import PdfFromImage from './pages/PdfFromImage';
import PdfWatermark from './pages/PdfWatermark';
import WordToPdf from './pages/WordToPdf';
import TextToolPage from './pages/TextToolPage';
import ToolHubPage from './pages/ToolHubPage';
import WhatsAppLinkCreator from './pages/WhatsAppLinkCreator';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pdf-tools" element={<ToolHubPage sectionId="pdf" />} />
          <Route path="/text-tools" element={<ToolHubPage sectionId="text" />} />
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
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;

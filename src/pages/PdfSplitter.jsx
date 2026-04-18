import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Upload, File, ArrowDown, Scissors } from 'lucide-react';
import './ToolStyles.css';

const PdfSplitter = () => {
  const [file, setFile] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [startPage, setStartPage] = useState('');
  const [endPage, setEndPage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
      
      // Read the PDF to get the total number of pages
      try {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        setNumPages(pdf.getPageCount());
        setStartPage('1');
        setEndPage(pdf.getPageCount().toString());
      } catch (err) {
        console.error(err);
        setError("Could not read PDF. It might be corrupted or encrypted.");
      }
    } else {
      setError("Please select a valid PDF file.");
      setFile(null);
    }
  };

  const splitPdf = async () => {
    if (!file) return;

    const start = parseInt(startPage, 10);
    const end = parseInt(endPage, 10);

    if (isNaN(start) || isNaN(end) || start < 1 || end > numPages || start > end) {
      setError(`Please enter a valid page range between 1 and ${numPages}.`);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const fileBuffer = await file.arrayBuffer();
      const originalPdf = await PDFDocument.load(fileBuffer);
      const newPdf = await PDFDocument.create();

      // pdf-lib page indices are 0-based
      const pageIndices = [];
      for (let i = start - 1; i < end; i++) {
        pageIndices.push(i);
      }

      const copiedPages = await newPdf.copyPages(originalPdf, pageIndices);
      copiedPages.forEach((page) => {
        newPdf.addPage(page);
      });

      const newPdfBytes = await newPdf.save();
      
      // Trigger download
      const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${file.name.replace('.pdf', '')}_split_${start}-${end}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error(err);
      setError("Failed to split PDF.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="tool-container container">
      <div className="tool-header text-center animate-fade-in">
        <h1>Split PDF</h1>
        <p>Extract a specific range of pages into a new PDF document.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        {!file ? (
          <div className="upload-area">
            <input 
              type="file" 
              accept="application/pdf" 
              onChange={handleFileUpload}
              id="file-upload"
              className="hidden-input"
            />
            <label htmlFor="file-upload" className="upload-label">
              <Upload size={48} className="upload-icon" />
              <span>Click to upload a PDF</span>
            </label>
          </div>
        ) : (
          <div className="file-loaded-area">
             <div className="file-item glass-panel" style={{ marginBottom: '2rem' }}>
                <div className="file-info">
                  <File size={20} className="text-gradient" />
                  <span>{file.name} ({numPages} pages)</span>
                </div>
                <button onClick={() => setFile(null)} className="btn-secondary" style={{ padding: '0.25rem 0.75rem' }}>
                  Change File
                </button>
              </div>

              <div className="page-range-selector" style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label htmlFor="start-page">From page:</label>
                  <input 
                    type="number" 
                    id="start-page" 
                    value={startPage} 
                    onChange={(e) => setStartPage(e.target.value)} 
                    min="1" 
                    max={numPages}
                    style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white', width: '100px' }}
                  />
                </div>
                <span style={{ marginTop: '1.5rem' }}>to</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label htmlFor="end-page">To page:</label>
                  <input 
                    type="number" 
                    id="end-page" 
                    value={endPage} 
                    onChange={(e) => setEndPage(e.target.value)} 
                    min="1" 
                    max={numPages}
                    style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white', width: '100px' }}
                  />
                </div>
              </div>

              <div className="action-area text-center">
                <button 
                  onClick={splitPdf} 
                  className="btn-primary" 
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Splitting...' : (
                    <>
                      <Scissors size={18} />
                      Split & Download
                    </>
                  )}
                </button>
              </div>
          </div>
        )}

        {error && <div className="error-message" style={{ marginTop: '1rem' }}>{error}</div>}

      </div>
    </div>
  );
};

export default PdfSplitter;

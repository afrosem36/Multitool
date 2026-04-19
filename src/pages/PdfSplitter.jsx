import React, { useState, useEffect } from 'react';
import { Scissors } from 'lucide-react';
import FileUpload from '../components/shared/FileUpload';
import FilePreviewList from '../components/shared/FilePreviewList';
import ProcessingState from '../components/shared/ProcessingState';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import { useFileValidation } from '../hooks/useFileValidation';
import { useToolHistory } from '../hooks/useToolHistory';
import './ToolStyles.css';

const PdfSplitter = () => {
  const [file, setFile] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [startPage, setStartPage] = useState('');
  const [endPage, setEndPage] = useState('');
  
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const { validateFiles } = useFileValidation();
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/split', 'Split PDF', 'split');
  }, [addHistory]);

  const handleFilesSelected = async (selectedFiles) => {
    setStatus('idle');
    setErrorMessage('');
    
    const { validFiles, error } = validateFiles(selectedFiles, { 
      allowedTypes: ['application/pdf'],
      maxFiles: 1 
    });

    if (error) {
      setStatus('error');
      setErrorMessage(error);
      return;
    }

    if (validFiles.length > 0) {
      const selectedFile = validFiles[0];
      setFile(selectedFile);
      
      try {
        const { PDFDocument } = await import('pdf-lib');
        const arrayBuffer = await selectedFile.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const count = pdf.getPageCount();
        setNumPages(count);
        setStartPage('1');
        setEndPage(count.toString());
      } catch (err) {
        console.error(err);
        setStatus('error');
        setErrorMessage("Could not read PDF. It might be corrupted or encrypted.");
        setFile(null);
      }
    }
  };

  const removeFile = () => {
    setFile(null);
    setNumPages(0);
    setStartPage('');
    setEndPage('');
    setStatus('idle');
  };

  const splitPdf = async () => {
    if (!file) return;

    const start = parseInt(startPage, 10);
    const end = parseInt(endPage, 10);

    if (isNaN(start) || isNaN(end) || start < 1 || end > numPages || start > end) {
      setStatus('error');
      setErrorMessage(`Please enter a valid page range between 1 and ${numPages}.`);
      return;
    }

    setStatus('processing');

    try {
      const { PDFDocument } = await import('pdf-lib');
      const fileBuffer = await file.arrayBuffer();
      const originalPdf = await PDFDocument.load(fileBuffer);
      const newPdf = await PDFDocument.create();

      const pageIndices = [];
      for (let i = start - 1; i < end; i++) {
        pageIndices.push(i);
      }

      const copiedPages = await newPdf.copyPages(originalPdf, pageIndices);
      copiedPages.forEach((page) => {
        newPdf.addPage(page);
      });

      const newPdfBytes = await newPdf.save();
      
      const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${file.name.replace('.pdf', '')}_split_${start}-${end}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setStatus('success');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMessage("Failed to split PDF.");
    }
  };

  return (
    <div className="tool-container container">
      <div className="tool-header text-center animate-fade-in">
        <h1>Split PDF</h1>
        <p>Extract a specific range of pages into a new PDF document.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        {!file && status !== 'processing' && status !== 'success' ? (
          <FileUpload 
            onFilesSelected={handleFilesSelected}
            accept="application/pdf"
            multiple={false}
            title="Click or drag to upload a PDF"
          />
        ) : (
          <div className="file-loaded-area">
             {file && (
               <FilePreviewList 
                 files={[{ ...file, name: `${file.name} (${numPages} pages)` }]} 
                 onRemove={status === 'processing' ? null : removeFile} 
                 title="Selected File"
               />
             )}

             {status !== 'success' && status !== 'processing' && file && (
                <div className="page-range-selector" style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'center', margin: '2rem 0' }}>
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
             )}

             <ProcessingState status={status} error={errorMessage} message={status === 'success' ? 'PDF split successfully!' : 'Splitting PDF...'} />

             {status !== 'success' && status !== 'processing' && file && (
               <div className="action-area text-center">
                 <button 
                   onClick={splitPdf} 
                   className="btn-primary" 
                 >
                   <Scissors size={18} />
                   Split & Download
                 </button>
               </div>
             )}
             
             {status === 'success' && (
               <div className="action-area text-center mt-4">
                 <button 
                   onClick={removeFile} 
                   className="btn-secondary"
                 >
                   Split Another PDF
                 </button>
               </div>
             )}
          </div>
        )}
      </div>
      
      {(status === 'success' || file) && <AdPlaceholder className="mt-5" />}
    </div>
  );
};

export default PdfSplitter;

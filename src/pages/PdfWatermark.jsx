import React, { useState, useEffect } from 'react';
import { ArrowDown, Droplet } from 'lucide-react';
import FileUpload from '../components/shared/FileUpload';
import FilePreviewList from '../components/shared/FilePreviewList';
import ProcessingState from '../components/shared/ProcessingState';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import { useFileValidation } from '../hooks/useFileValidation';
import { useToolHistory } from '../hooks/useToolHistory';
import './ToolStyles.css';

const PdfWatermark = () => {
  const [file, setFile] = useState(null);
  
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [opacity, setOpacity] = useState(0.3);
  
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const { validateFiles } = useFileValidation();
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/watermark', 'Watermark PDF', 'droplet');
  }, [addHistory]);

  const handleFilesSelected = (selectedFiles) => {
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
      setFile(validFiles[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
    setStatus('idle');
  };

  const applyWatermark = async () => {
    if (!file || !watermarkText) return;

    setStatus('processing');

    try {
      const { PDFDocument, rgb, StandardFonts, degrees } = await import('pdf-lib');
      const fileBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(fileBuffer);
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      const pages = pdfDoc.getPages();
      
      pages.forEach((page) => {
        const { width, height } = page.getSize();
        
        const fontSize = width / 10;
        const textWidth = helveticaFont.widthOfTextAtSize(watermarkText, fontSize);
        const textHeight = helveticaFont.heightAtSize(fontSize);
        
        page.drawText(watermarkText, {
          x: width / 2 - textWidth / 2,
          y: height / 2 - textHeight / 2,
          size: fontSize,
          font: helveticaFont,
          color: rgb(0.5, 0.5, 0.5), 
          opacity: opacity,
          rotate: degrees(45),
        });
      });

      const pdfBytes = await pdfDoc.save();
      
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${file.name.replace('.pdf', '')}_watermarked.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setStatus('success');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMessage("Failed to apply watermark. The PDF might be encrypted.");
    }
  };

  return (
    <div className="tool-container container" style={{ maxWidth: '700px' }}>
      <div className="tool-header text-center animate-fade-in">
        <h1>Watermark PDF</h1>
        <p>Stamp custom text diagonally across every page of your PDF.</p>
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
                 files={[file]} 
                 onRemove={status === 'processing' ? null : removeFile} 
                 title="Selected File"
               />
             )}

             {status !== 'success' && status !== 'processing' && file && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', margin: '2rem 0' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Watermark Text</label>
                    <input 
                      type="text" 
                      value={watermarkText} 
                      onChange={(e) => setWatermarkText(e.target.value)} 
                      placeholder="e.g. DRAFT"
                      style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Opacity ({Math.round(opacity * 100)}%)</label>
                    <input 
                      type="range" 
                      min="0.1" 
                      max="1" 
                      step="0.1"
                      value={opacity} 
                      onChange={(e) => setOpacity(parseFloat(e.target.value))} 
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
             )}

             <ProcessingState 
               status={status} 
               error={errorMessage} 
               message={status === 'success' ? 'Watermark applied successfully!' : 'Applying watermark...'} 
             />

             {status !== 'success' && status !== 'processing' && file && (
               <div className="action-area text-center">
                 <button 
                   onClick={applyWatermark} 
                   className="btn-primary" 
                   disabled={!watermarkText}
                 >
                   <ArrowDown size={18} /> Apply & Download
                 </button>
               </div>
             )}
             
             {status === 'success' && (
               <div className="action-area text-center mt-4">
                 <button 
                   onClick={removeFile} 
                   className="btn-secondary"
                 >
                   Watermark Another PDF
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

export default PdfWatermark;

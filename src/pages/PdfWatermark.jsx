import React, { useState } from 'react';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { Upload, Type, ArrowDown, Droplet } from 'lucide-react';
import './ToolStyles.css';

const PdfWatermark = () => {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [opacity, setOpacity] = useState(0.3);

  const handleFileUpload = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
    } else {
      setError("Please select a valid PDF file.");
      setFile(null);
    }
  };

  const applyWatermark = async () => {
    if (!file || !watermarkText) return;

    setIsProcessing(true);
    setError(null);

    try {
      const fileBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(fileBuffer);
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      const pages = pdfDoc.getPages();
      
      pages.forEach((page) => {
        const { width, height } = page.getSize();
        
        // Calculate font size relative to page width
        const fontSize = width / 10;
        const textWidth = helveticaFont.widthOfTextAtSize(watermarkText, fontSize);
        const textHeight = helveticaFont.heightAtSize(fontSize);
        
        // Draw across the center, rotated 45 degrees
        page.drawText(watermarkText, {
          x: width / 2 - textWidth / 2,
          y: height / 2 - textHeight / 2,
          size: fontSize,
          font: helveticaFont,
          color: rgb(0.5, 0.5, 0.5), // Gray
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
      
    } catch (err) {
      console.error(err);
      setError("Failed to apply watermark. The PDF might be encrypted.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="tool-container container" style={{ maxWidth: '700px' }}>
      <div className="tool-header text-center animate-fade-in">
        <h1>Watermark PDF</h1>
        <p>Stamp custom text diagonally across every page of your PDF.</p>
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
                  <Droplet size={20} className="text-gradient" />
                  <span>{file.name}</span>
                </div>
                <button onClick={() => setFile(null)} className="btn-secondary" style={{ padding: '0.25rem 0.75rem' }}>
                  Change File
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
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

              <div className="action-area text-center">
                <button 
                  onClick={applyWatermark} 
                  className="btn-primary" 
                  disabled={isProcessing || !watermarkText}
                >
                  {isProcessing ? 'Processing...' : (
                    <>
                      <ArrowDown size={18} /> Apply & Download
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

export default PdfWatermark;

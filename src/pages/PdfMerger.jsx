import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Upload, File, Trash2, ArrowDown } from 'lucide-react';
import './ToolStyles.css';

const PdfMerger = () => {
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleFileUpload = (e) => {
    const selectedFiles = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
    if (selectedFiles.length > 0) {
      setFiles(prev => [...prev, ...selectedFiles]);
    } else {
      setError("Please select valid PDF files.");
    }
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const mergePdfs = async () => {
    if (files.length < 2) {
      setError("Please add at least 2 PDF files to merge.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const mergedPdf = await PDFDocument.create();

      for (const file of files) {
        const fileBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(fileBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => {
          mergedPdf.addPage(page);
        });
      }

      const mergedPdfFile = await mergedPdf.save();
      
      // Trigger download
      const blob = new Blob([mergedPdfFile], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'merged_document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error(err);
      setError("Failed to merge PDFs. They might be corrupted or encrypted.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="tool-container container">
      <div className="tool-header text-center animate-fade-in">
        <h1>Merge PDFs</h1>
        <p>Combine multiple PDF files into one easily.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        <div className="upload-area">
          <input 
            type="file" 
            multiple 
            accept="application/pdf" 
            onChange={handleFileUpload}
            id="file-upload"
            className="hidden-input"
          />
          <label htmlFor="file-upload" className="upload-label">
            <Upload size={48} className="upload-icon" />
            <span>Click or drag to upload PDFs</span>
          </label>
        </div>

        {error && <div className="error-message">{error}</div>}

        {files.length > 0 && (
          <div className="file-list">
            <h3>Selected Files ({files.length})</h3>
            <ul>
              {files.map((file, index) => (
                <li key={index} className="file-item glass-panel">
                  <div className="file-info">
                    <File size={20} className="text-gradient" />
                    <span>{file.name}</span>
                  </div>
                  <button onClick={() => removeFile(index)} className="btn-icon danger">
                    <Trash2 size={18} />
                  </button>
                </li>
              ))}
            </ul>

            <div className="action-area text-center">
              <button 
                onClick={mergePdfs} 
                className="btn-primary" 
                disabled={isProcessing || files.length < 2}
              >
                {isProcessing ? 'Merging...' : (
                  <>
                    <ArrowDown size={18} />
                    Merge & Download
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfMerger;

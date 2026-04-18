import React, { useState } from 'react';
import { Upload, FileText, ArrowDown, FileQuestion } from 'lucide-react';
import * as mammoth from 'mammoth';
import html2pdf from 'html2pdf.js';
import './ToolStyles.css';

const WordToPdf = () => {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleFileUpload = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && (selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || selectedFile.name.endsWith('.docx') || selectedFile.name.endsWith('.doc'))) {
      setFile(selectedFile);
      setError(null);
    } else {
      setError("Please select a valid Word Document (.docx or .doc).");
      setFile(null);
    }
  };

  const processWordToPdf = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          
          // Extract HTML using mammoth
          const result = await mammoth.convertToHtml({ arrayBuffer });
          const htmlContent = result.value;

          if (!htmlContent) {
            throw new Error("Could not extract content from the Word document.");
          }

          // Create a temporary hidden container for the HTML
          const container = document.createElement('div');
          container.innerHTML = htmlContent;
          
          // Apply some basic styling for better PDF output
          container.style.padding = '20mm';
          container.style.fontFamily = 'Arial, sans-serif';
          container.style.fontSize = '12pt';
          container.style.lineHeight = '1.6';
          container.style.color = '#000';
          container.style.background = '#fff';
          container.style.width = '210mm'; // A4 width
          
          // We must append to document so html2canvas can render it properly,
          // but we can hide it visually off-screen.
          container.style.position = 'absolute';
          container.style.left = '-9999px';
          container.style.top = '-9999px';
          document.body.appendChild(container);

          const opt = {
            margin:       10,
            filename:     `${file.name.replace(/\.[^/.]+$/, "")}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
          };

          await html2pdf().set(opt).from(container).save();

          // Cleanup
          document.body.removeChild(container);
          setIsProcessing(false);
          
        } catch (err) {
          console.error("Conversion error:", err);
          setError("Failed to convert the document. Ensure it's a valid .docx file.");
          setIsProcessing(false);
        }
      };

      reader.onerror = () => {
        setError("Failed to read the file.");
        setIsProcessing(false);
      };

      reader.readAsArrayBuffer(file);
      
    } catch (err) {
      console.error(err);
      setError("An error occurred during conversion.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="tool-container container">
      <div className="tool-header text-center animate-fade-in">
        <h1>Word to PDF</h1>
        <p>Convert your Word documents (.docx) into PDFs 100% securely on your device. No server required.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        {!file ? (
          <div className="upload-area">
            <input 
              type="file" 
              accept=".docx, application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
              onChange={handleFileUpload}
              id="file-upload"
              className="hidden-input"
            />
            <label htmlFor="file-upload" className="upload-label">
              <Upload size={48} className="upload-icon" />
              <span>Click to upload a Word Document</span>
            </label>
          </div>
        ) : (
          <div className="file-loaded-area">
             <div className="file-item glass-panel" style={{ marginBottom: '2rem' }}>
                <div className="file-info">
                  <FileText size={20} className="text-gradient" />
                  <span>{file.name}</span>
                </div>
                <button onClick={() => setFile(null)} className="btn-secondary" style={{ padding: '0.25rem 0.75rem' }}>
                  Change File
                </button>
              </div>

              <div className="action-area text-center">
                <button 
                  onClick={processWordToPdf} 
                  className="btn-primary" 
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Converting on Device...' : (
                    <>
                      <ArrowDown size={18} />
                      Convert & Download PDF
                    </>
                  )}
                </button>
              </div>
          </div>
        )}

        {error && (
          <div className="error-message" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileQuestion size={20} />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WordToPdf;

import React, { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { Upload, FileText, ArrowDown } from 'lucide-react';
import './ToolStyles.css';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const PdfToWord = () => {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleFileUpload = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
      setSuccess(false);
    } else {
      setError("Please select a valid PDF file.");
    }
  };

  const extractTextAndDownloadWord = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setSuccess(false);

    try {
      const fileReader = new FileReader();
      
      fileReader.onload = async function() {
        try {
          const typedarray = new Uint8Array(this.result);
          const pdf = await pdfjsLib.getDocument(typedarray).promise;
          
          let extractedText = [];
          
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            if (pageText.trim()) {
              extractedText.push(pageText);
            }
          }

          if (extractedText.length === 0) {
            setError("No extractable text found in this PDF (might be scanned images).");
            setIsProcessing(false);
            return;
          }

          // Create Word Document
          const paragraphs = extractedText.map(text => 
            new Paragraph({
              children: [
                new TextRun(text)
              ],
            })
          );

          const doc = new Document({
            sections: [{
              properties: {},
              children: paragraphs,
            }],
          });

          const blob = await Packer.toBlob(doc);
          
          // Download
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${file.name.replace('.pdf', '')}_converted.docx`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          setSuccess(true);
        } catch (err) {
          console.error(err);
          setError("Error parsing PDF document or creating Word file.");
        } finally {
          setIsProcessing(false);
        }
      };
      
      fileReader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      setError("Failed to process the PDF.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="tool-container container">
      <div className="tool-header text-center animate-fade-in">
        <h1>PDF to Word</h1>
        <p>Extract text from PDFs and save as an editable DOCX file.</p>
        <small style={{ color: 'var(--text-secondary)' }}>Note: This extracts raw text. Formatting/images will not be preserved.</small>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
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
            <span>Click to upload a PDF for text extraction</span>
          </label>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="error-message" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>Successfully extracted text and downloaded Word document!</div>}

        {file && (
          <div className="action-area text-center">
            <p className="mb-4">Selected: <strong>{file.name}</strong></p>
            <button 
              onClick={extractTextAndDownloadWord} 
              className="btn-primary" 
              disabled={isProcessing}
            >
              {isProcessing ? 'Extracting Text...' : (
                <>
                  <FileText size={18} />
                  Extract & Download DOCX
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfToWord;

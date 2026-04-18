import React, { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Upload, Image as ImageIcon, ArrowDown } from 'lucide-react';
import './ToolStyles.css';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const PdfToJpg = () => {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [imageUrls, setImageUrls] = useState([]);

  const handleFileUpload = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setImageUrls([]);
      setError(null);
    } else {
      setError("Please select a valid PDF file.");
    }
  };

  const convertToJpg = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setImageUrls([]);

    try {
      const fileReader = new FileReader();
      
      fileReader.onload = async function() {
        try {
          const typedarray = new Uint8Array(this.result);
          const pdf = await pdfjsLib.getDocument(typedarray).promise;
          
          const newUrls = [];
          
          // Limit to first 5 pages to prevent browser crashing for large PDFs
          const pagesToProcess = Math.min(pdf.numPages, 5);
          
          for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 }); // higher scale = better quality
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
              canvasContext: context,
              viewport: viewport
            }).promise;
            
            const imgUrl = canvas.toDataURL('image/jpeg', 0.9);
            newUrls.push(imgUrl);
          }
          
          setImageUrls(newUrls);
          if (pdf.numPages > 5) {
             setError(`Only showing the first 5 pages to prevent performance issues.`);
          }
        } catch (err) {
          console.error(err);
          setError("Error parsing PDF document.");
        }
      };
      
      fileReader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      setError("Failed to process the PDF.");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadImage = (url, index) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `page_${index + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="tool-container container">
      <div className="tool-header text-center animate-fade-in">
        <h1>PDF to JPG</h1>
        <p>Convert your PDF pages into high-quality JPG images.</p>
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
            <span>Click to upload a PDF</span>
          </label>
        </div>

        {error && <div className="error-message">{error}</div>}

        {file && !imageUrls.length && (
          <div className="action-area text-center">
            <p className="mb-4">Selected: <strong>{file.name}</strong></p>
            <button 
              onClick={convertToJpg} 
              className="btn-primary" 
              disabled={isProcessing}
            >
              {isProcessing ? 'Converting...' : 'Convert to JPG'}
            </button>
          </div>
        )}

        {imageUrls.length > 0 && (
          <div className="results-area mt-8">
            <h3 className="mb-4 text-center">Converted Pages</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {imageUrls.map((url, index) => (
                <div key={index} className="glass-panel" style={{ padding: '0.5rem', textAlign: 'center' }}>
                  <img src={url} alt={`Page ${index + 1}`} style={{ width: '100%', height: 'auto', borderRadius: '8px', marginBottom: '0.5rem' }} />
                  <button onClick={() => downloadImage(url, index)} className="btn-secondary" style={{ width: '100%' }}>
                    <ArrowDown size={16} /> Download
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfToJpg;

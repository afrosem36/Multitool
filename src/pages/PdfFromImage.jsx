import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Upload, Image as ImageIcon, ArrowDown, Trash2 } from 'lucide-react';
import './ToolStyles.css';

const PdfFromImage = () => {
  const [images, setImages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleFileUpload = (e) => {
    const selectedFiles = Array.from(e.target.files);
    
    const validImages = selectedFiles.filter(file => 
      file.type === 'image/jpeg' || file.type === 'image/png'
    );

    if (validImages.length === 0) {
      setError("Please select valid JPG or PNG images.");
      return;
    }

    setError(null);
    const newImages = validImages.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      url: URL.createObjectURL(file) // For preview
    }));

    setImages([...images, ...newImages]);
  };

  const removeImage = (idToRemove) => {
    setImages(images.filter(img => img.id !== idToRemove));
  };

  const processImagesToPdf = async () => {
    if (images.length === 0) return;

    setIsProcessing(true);
    setError(null);

    try {
      const pdfDoc = await PDFDocument.create();

      for (const imgObj of images) {
        const imageBytes = await imgObj.file.arrayBuffer();
        let pdfImage;
        
        if (imgObj.file.type === 'image/png') {
          pdfImage = await pdfDoc.embedPng(imageBytes);
        } else {
          pdfImage = await pdfDoc.embedJpg(imageBytes);
        }

        const imgDimensions = pdfImage.scale(1); // Get original dimensions
        
        // Add a page with the exact dimensions of the image
        const page = pdfDoc.addPage([imgDimensions.width, imgDimensions.height]);
        
        page.drawImage(pdfImage, {
          x: 0,
          y: 0,
          width: imgDimensions.width,
          height: imgDimensions.height,
        });
      }

      const pdfBytes = await pdfDoc.save();
      
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `images_converted.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error(err);
      setError("Failed to convert images to PDF. Some images might have an unsupported format.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="tool-container container" style={{ maxWidth: '900px' }}>
      <div className="tool-header text-center animate-fade-in">
        <h1>Image to PDF</h1>
        <p>Convert your JPG or PNG images into a single, perfectly sized PDF document.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        
        {images.length > 0 && (
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {images.map((img, index) => (
              <div key={img.id} className="glass-panel" style={{ position: 'relative', padding: '0.5rem', width: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <img src={img.url} alt={`Upload ${index}`} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '4px' }} />
                <span style={{ fontSize: '0.75rem', marginTop: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                  {img.file.name}
                </span>
                <button 
                  onClick={() => removeImage(img.id)}
                  style={{
                    position: 'absolute', top: '-10px', right: '-10px', background: 'var(--danger)', color: 'white',
                    border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="upload-area" style={{ marginBottom: '2rem' }}>
          <input 
            type="file" 
            accept="image/jpeg, image/png" 
            multiple
            onChange={handleFileUpload}
            id="file-upload"
            className="hidden-input"
          />
          <label htmlFor="file-upload" className="upload-label" style={{ padding: '2rem' }}>
            <ImageIcon size={48} className="upload-icon" />
            <span>Click to upload {images.length > 0 ? 'more images' : 'JPG or PNG images'}</span>
          </label>
        </div>

        {images.length > 0 && (
           <div className="action-area text-center">
            <button 
              onClick={processImagesToPdf} 
              className="btn-primary" 
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : (
                <>
                  <ArrowDown size={18} /> Convert to PDF
                </>
              )}
            </button>
            <button 
              onClick={() => setImages([])} 
              className="btn-secondary" 
              style={{ marginLeft: '1rem' }}
            >
              Clear All
            </button>
          </div>
        )}

        {error && <div className="error-message" style={{ marginTop: '1rem' }}>{error}</div>}
      </div>
    </div>
  );
};

export default PdfFromImage;

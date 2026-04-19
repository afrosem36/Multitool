import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, ArrowDown, Trash2 } from 'lucide-react';
import FileUpload from '../components/shared/FileUpload';
import ProcessingState from '../components/shared/ProcessingState';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import { useFileValidation } from '../hooks/useFileValidation';
import { useToolHistory } from '../hooks/useToolHistory';
import './ToolStyles.css';

const PdfFromImage = () => {
  const [images, setImages] = useState([]);
  
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const { validateFiles } = useFileValidation();
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/image-to-pdf', 'Image to PDF', 'image');
  }, [addHistory]);

  const handleFilesSelected = (selectedFiles) => {
    setStatus('idle');
    setErrorMessage('');
    
    const { validFiles, error } = validateFiles(selectedFiles, { 
      allowedTypes: ['image/jpeg', 'image/png'],
      currentCount: images.length
    });

    if (error) {
      setStatus('error');
      setErrorMessage(error);
    }

    if (validFiles.length > 0) {
      const newImages = validFiles.map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        url: URL.createObjectURL(file) 
      }));
      setImages(prev => [...prev, ...newImages]);
    }
  };

  const removeImage = (idToRemove) => {
    setImages(images.filter(img => img.id !== idToRemove));
  };

  const processImagesToPdf = async () => {
    if (images.length === 0) return;

    setStatus('processing');

    try {
      const { PDFDocument } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.create();

      for (const imgObj of images) {
        const imageBytes = await imgObj.file.arrayBuffer();
        let pdfImage;
        
        if (imgObj.file.type === 'image/png') {
          pdfImage = await pdfDoc.embedPng(imageBytes);
        } else {
          pdfImage = await pdfDoc.embedJpg(imageBytes);
        }

        const imgDimensions = pdfImage.scale(1); 
        
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
      
      setStatus('success');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMessage("Failed to convert images to PDF. Some images might have an unsupported format.");
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
                {status !== 'processing' && status !== 'success' && (
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
                )}
              </div>
            ))}
          </div>
        )}

        {status !== 'processing' && status !== 'success' && (
          <div style={{ marginBottom: '2rem' }}>
            <FileUpload 
              onFilesSelected={handleFilesSelected}
              accept="image/jpeg, image/png"
              title={images.length > 0 ? "Add more images" : "Click or drag JPG/PNG images"}
            />
          </div>
        )}

        <ProcessingState 
          status={status} 
          error={errorMessage} 
          message={status === 'success' ? 'Images successfully converted to PDF!' : 'Converting images...'} 
        />

        {images.length > 0 && status !== 'processing' && status !== 'success' && (
           <div className="action-area text-center">
            <button 
              onClick={processImagesToPdf} 
              className="btn-primary" 
            >
              <ArrowDown size={18} /> Convert to PDF
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

        {status === 'success' && (
           <div className="action-area text-center mt-4">
             <button 
               onClick={() => { setImages([]); setStatus('idle'); }} 
               className="btn-secondary"
             >
               Convert More Images
             </button>
           </div>
         )}

      </div>
      
      {(status === 'success' || images.length > 0) && <AdPlaceholder className="mt-5" />}
    </div>
  );
};

export default PdfFromImage;

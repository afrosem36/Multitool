import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Upload, Type, ArrowDown, XCircle } from 'lucide-react';
import './ToolStyles.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const PdfEdit = () => {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  
  const [pageData, setPageData] = useState(null); // { url, width, height, originalWidth, originalHeight }
  const [annotations, setAnnotations] = useState([]); // [{ id, text, x, y, size, color, pageHeight }]
  const [currentAnnotation, setCurrentAnnotation] = useState(null);
  const [activeColor, setActiveColor] = useState('#ff0000');
  const [activeSize, setActiveSize] = useState(24);
  
  const canvasRef = useRef(null);

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
      setAnnotations([]);
      setCurrentAnnotation(null);
      setIsProcessing(true);
      
      try {
        const fileReader = new FileReader();
        fileReader.onload = async function() {
          try {
            const typedarray = new Uint8Array(this.result);
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            
            // For simplicity in this demo, we only annotate the first page
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 1.0 });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;
            const imgUrl = canvas.toDataURL('image/jpeg', 0.9);
            
            setPageData({
              url: imgUrl,
              width: viewport.width,
              height: viewport.height,
              originalWidth: viewport.width,
              originalHeight: viewport.height
            });
            
          } catch (err) {
            console.error(err);
            setError("Error parsing PDF document.");
          } finally {
            setIsProcessing(false);
          }
        };
        fileReader.readAsArrayBuffer(selectedFile);
      } catch (err) {
        console.error(err);
        setError("Could not read PDF.");
        setIsProcessing(false);
      }
    } else {
      setError("Please select a valid PDF file.");
      setFile(null);
    }
  };

  const handleCanvasClick = (e) => {
    if (!pageData || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    
    // Calculate scale ratio between displayed image and actual PDF size
    const scaleX = pageData.width / rect.width;
    const scaleY = pageData.height / rect.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // In pdf-lib, (0,0) is bottom-left. We need to convert from top-left.
    const pdfLibY = pageData.height - clickY;

    setCurrentAnnotation({
      x: clickX,
      y: pdfLibY,
      displayX: e.clientX - rect.left,
      displayY: e.clientY - rect.top,
      text: ''
    });
  };

  const addAnnotation = () => {
    if (currentAnnotation && currentAnnotation.text.trim()) {
      setAnnotations([...annotations, {
        id: Date.now(),
        ...currentAnnotation,
        color: activeColor,
        size: activeSize,
        pageHeight: pageData.height
      }]);
      setCurrentAnnotation(null);
    }
  };

  const hexToRgbObj = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    } : { r: 0, g: 0, b: 0 };
  };

  const savePdf = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const fileBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(fileBuffer);
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      const pages = pdfDoc.getPages();
      const firstPage = pages[0]; // We are only editing page 1 in this demo

      annotations.forEach(ann => {
        const colorObj = hexToRgbObj(ann.color);
        firstPage.drawText(ann.text, {
          x: ann.x,
          y: ann.y,
          size: ann.size,
          font: helveticaFont,
          color: rgb(colorObj.r, colorObj.g, colorObj.b),
        });
      });

      const newPdfBytes = await pdfDoc.save();
      
      const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${file.name.replace('.pdf', '')}_annotated.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error(err);
      setError("Failed to generate the annotated PDF.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="tool-container container" style={{ maxWidth: '1200px' }}>
      <div className="tool-header text-center animate-fade-in">
        <h1>Annotate PDF</h1>
        <p>Click anywhere on the first page to add custom text.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        
        {/* Left Sidebar: Controls */}
        <div style={{ flex: '1', minWidth: '300px' }}>
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
                <span>Upload a PDF to annotate</span>
              </label>
            </div>
          ) : (
            <div className="controls-panel glass-panel" style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Text Settings</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Color</label>
                    <input 
                      type="color" 
                      value={activeColor} 
                      onChange={(e) => setActiveColor(e.target.value)}
                      style={{ width: '100%', height: '40px', cursor: 'pointer', background: 'none', border: 'none' }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Size ({activeSize}px)</label>
                    <input 
                      type="range" 
                      min="10" 
                      max="72" 
                      value={activeSize} 
                      onChange={(e) => setActiveSize(parseInt(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>

              {currentAnnotation && (
                <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--accent-primary)', fontWeight: 'bold' }}>Type text here:</label>
                  <input 
                    type="text" 
                    autoFocus
                    value={currentAnnotation.text}
                    onChange={(e) => setCurrentAnnotation({ ...currentAnnotation, text: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') addAnnotation(); }}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: 'none', marginBottom: '0.5rem' }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={addAnnotation} className="btn-primary" style={{ padding: '0.5rem', flex: 1 }}>Add</button>
                    <button onClick={() => setCurrentAnnotation(null)} className="btn-secondary" style={{ padding: '0.5rem' }}>Cancel</button>
                  </div>
                </div>
              )}

              <div style={{ marginTop: '2rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Annotations ({annotations.length})</h3>
                {annotations.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Click on the document to add text.</p>
                ) : (
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    {annotations.map(ann => (
                      <li key={ann.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px' }}>
                        <span style={{ color: ann.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ann.text}</span>
                        <button onClick={() => setAnnotations(annotations.filter(a => a.id !== ann.id))} style={{ color: 'var(--danger)', cursor: 'pointer', background: 'none', border: 'none' }}>
                          <XCircle size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <button 
                  onClick={savePdf} 
                  className="btn-primary" 
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={isProcessing || annotations.length === 0}
                >
                  {isProcessing ? 'Saving...' : <><ArrowDown size={18} /> Save & Download PDF</>}
                </button>
              </div>
            </div>
          )}
          {error && <div className="error-message" style={{ marginTop: '1rem' }}>{error}</div>}
        </div>

        {/* Right Area: Document Preview */}
        {pageData && (
          <div style={{ flex: '2', minWidth: '300px', display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', overflow: 'auto' }}>
            <div style={{ position: 'relative', cursor: 'crosshair', display: 'inline-block' }}>
              <img 
                ref={canvasRef}
                src={pageData.url} 
                alt="PDF Page 1" 
                onClick={handleCanvasClick}
                style={{ display: 'block', maxWidth: '100%', height: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }} 
              />
              
              {/* Display existing annotations over the image */}
              {annotations.map(ann => {
                // Approximate display coordinates
                // We need the current rect to scale properly if the image is resized by CSS
                const rect = canvasRef.current?.getBoundingClientRect();
                const scale = rect ? (rect.width / pageData.width) : 1;
                
                return (
                  <div 
                    key={ann.id}
                    style={{
                      position: 'absolute',
                      left: `${(ann.x / pageData.width) * 100}%`,
                      // Y in pdf-lib is bottom-up, so top is (pageHeight - Y)
                      top: `${((pageData.height - ann.y) / pageData.height) * 100}%`,
                      color: ann.color,
                      fontSize: `${ann.size * scale}px`,
                      fontFamily: 'Helvetica, Arial, sans-serif',
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap',
                      // pdf-lib draws text starting from the baseline. 
                      // CSS top positions the top of the element.
                      // Adjusting via transform to better match visual output.
                      transform: 'translateY(-100%)' 
                    }}
                  >
                    {ann.text}
                  </div>
                );
              })}

              {/* Display input marker if adding */}
              {currentAnnotation && (
                <div style={{
                  position: 'absolute',
                  left: `${currentAnnotation.displayX}px`,
                  top: `${currentAnnotation.displayY}px`,
                  width: '10px',
                  height: '10px',
                  background: 'var(--accent-primary)',
                  borderRadius: '50%',
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 0 4px rgba(99, 102, 241, 0.3)'
                }} />
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default PdfEdit;

import React, { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Upload, Layers, Trash2, ArrowDown } from 'lucide-react';
import './ToolStyles.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const PdfOrganize = () => {
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState([]); // Array of { id, originalIndex, url }
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
      setIsProcessing(true);
      
      try {
        const fileReader = new FileReader();
        fileReader.onload = async function() {
          try {
            const typedarray = new Uint8Array(this.result);
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            
            const loadedPages = [];
            // Limit to 50 pages to avoid performance issues in browser memory
            const maxPages = Math.min(pdf.numPages, 50); 
            
            for (let i = 1; i <= maxPages; i++) {
              const page = await pdf.getPage(i);
              const viewport = page.getViewport({ scale: 0.5 }); // Low scale for thumbnail
              
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;

              await page.render({ canvasContext: context, viewport: viewport }).promise;
              const imgUrl = canvas.toDataURL('image/jpeg', 0.8);
              
              loadedPages.push({
                id: `page-${i}`,
                originalIndex: i - 1, // 0-based for pdf-lib
                url: imgUrl,
                displayNumber: i
              });
            }
            
            setPages(loadedPages);
            if (pdf.numPages > 50) {
              setError("Only loaded the first 50 pages for performance reasons.");
            }
          } catch (err) {
            console.error(err);
            setError("Error parsing PDF document to generate thumbnails.");
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

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(pages);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setPages(items);
  };

  const removePage = (idToRemove) => {
    setPages(pages.filter(page => page.id !== idToRemove));
  };

  const saveOrganizedPdf = async () => {
    if (!file || pages.length === 0) return;

    setIsProcessing(true);
    setError(null);

    try {
      const fileBuffer = await file.arrayBuffer();
      const originalPdf = await PDFDocument.load(fileBuffer);
      const newPdf = await PDFDocument.create();

      const pageIndicesToCopy = pages.map(p => p.originalIndex);
      const copiedPages = await newPdf.copyPages(originalPdf, pageIndicesToCopy);
      
      copiedPages.forEach((page) => {
        newPdf.addPage(page);
      });

      const newPdfBytes = await newPdf.save();
      
      const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${file.name.replace('.pdf', '')}_organized.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error(err);
      setError("Failed to generate the organized PDF.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="tool-container container" style={{ maxWidth: '1000px' }}>
      <div className="tool-header text-center animate-fade-in">
        <h1>Organize PDF</h1>
        <p>Drag to reorder pages, or click the trash icon to delete them.</p>
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
                  <Layers size={20} className="text-gradient" />
                  <span>{file.name}</span>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={saveOrganizedPdf} className="btn-primary" disabled={isProcessing || pages.length === 0}>
                    {isProcessing ? 'Processing...' : (
                      <><ArrowDown size={18} /> Save PDF</>
                    )}
                  </button>
                  <button onClick={() => { setFile(null); setPages([]); }} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>

              {error && <div className="error-message">{error}</div>}

              {isProcessing && pages.length === 0 ? (
                <div className="text-center" style={{ padding: '2rem' }}>Loading thumbnails...</div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="pages" direction="horizontal">
                    {(provided) => (
                      <div 
                        {...provided.droppableProps} 
                        ref={provided.innerRef}
                        style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'center' }}
                      >
                        {pages.map((page, index) => (
                          <Draggable key={page.id} draggableId={page.id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="glass-panel"
                                style={{
                                  userSelect: 'none',
                                  padding: '0.5rem',
                                  width: '150px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  position: 'relative',
                                  ...provided.draggableProps.style,
                                }}
                              >
                                <img src={page.url} alt={`Page ${page.displayNumber}`} style={{ width: '100%', height: 'auto', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }} />
                                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                  Page {page.displayNumber}
                                </div>
                                <button 
                                  onClick={() => removePage(page.id)}
                                  style={{
                                    position: 'absolute',
                                    top: '-10px',
                                    right: '-10px',
                                    background: 'var(--danger)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '28px',
                                    height: '28px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfOrganize;

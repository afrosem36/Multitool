import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Layers, Trash2, ArrowDown } from 'lucide-react';
import FileUpload from '../../components/shared/FileUpload';
import ProcessingState from '../../components/shared/ProcessingState';
import AdPlaceholder from '../../components/shared/AdPlaceholder';
import { useFileValidation } from '../../hooks/useFileValidation';
import { useToolHistory } from '../../hooks/useToolHistory';
import '../styles/ToolStyles.css';

const PdfOrganize = () => {
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState([]); // Array of { id, originalIndex, url }
  
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const { validateFiles } = useFileValidation();
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/organize', 'Organize PDF', 'layers');
  }, [addHistory]);

  const handleFilesSelected = async (selectedFiles) => {
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
      const selectedFile = validFiles[0];
      setFile(selectedFile);
      setStatus('processing');
      
      try {
        const pdfjsLib = await import('pdfjs-dist');
        const workerUrl = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.default;
        
        const fileReader = new FileReader();
        fileReader.onload = async function() {
          try {
            const typedarray = new Uint8Array(this.result);
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            
            const loadedPages = [];
            const maxPages = Math.min(pdf.numPages, 50); 
            
            for (let i = 1; i <= maxPages; i++) {
              const page = await pdf.getPage(i);
              const viewport = page.getViewport({ scale: 0.5 }); 
              
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;

              await page.render({ canvasContext: context, viewport: viewport }).promise;
              const imgUrl = canvas.toDataURL('image/jpeg', 0.8);
              
              loadedPages.push({
                id: `page-${i}`,
                originalIndex: i - 1, 
                url: imgUrl,
                displayNumber: i
              });
            }
            
            setPages(loadedPages);
            setStatus('idle');
            if (pdf.numPages > 50) {
              setErrorMessage("Only loaded the first 50 pages for performance reasons.");
            }
          } catch (err) {
            console.error(err);
            setStatus('error');
            setErrorMessage("Error parsing PDF document to generate thumbnails.");
          }
        };
        fileReader.readAsArrayBuffer(selectedFile);
      } catch (err) {
        console.error(err);
        setStatus('error');
        setErrorMessage("Could not load PDF worker.");
      }
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

  const resetState = () => {
    setFile(null);
    setPages([]);
    setStatus('idle');
  };

  const saveOrganizedPdf = async () => {
    if (!file || pages.length === 0) return;

    setStatus('processing');

    try {
      const { PDFDocument } = await import('pdf-lib');
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
      
      setStatus('success');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMessage("Failed to generate the organized PDF.");
    }
  };

  return (
    <div className="tool-container container" style={{ maxWidth: '1000px' }}>
      <div className="tool-header text-center animate-fade-in">
        <h1>Organize PDF</h1>
        <p>Drag to reorder pages, or click the trash icon to delete them.</p>
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
               <div className="file-item glass-panel" style={{ marginBottom: '2rem' }}>
                  <div className="file-info">
                    <Layers size={20} className="text-gradient" />
                    <span>{file.name}</span>
                  </div>
                  {status !== 'success' && status !== 'processing' && (
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button onClick={saveOrganizedPdf} className="btn-primary" disabled={pages.length === 0}>
                        <ArrowDown size={18} /> Save PDF
                      </button>
                      <button onClick={resetState} className="btn-secondary">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
             )}

             <ProcessingState 
               status={status} 
               error={errorMessage} 
               message={status === 'success' ? 'PDF organized successfully!' : 'Processing...'} 
             />

             {status === 'idle' && pages.length > 0 && (
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

             {status === 'success' && (
               <div className="action-area text-center mt-4">
                 <button 
                   onClick={resetState} 
                   className="btn-secondary"
                 >
                   Organize Another PDF
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

export default PdfOrganize;

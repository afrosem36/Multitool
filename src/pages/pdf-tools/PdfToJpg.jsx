import React, { useState, useEffect } from 'react';
import { ArrowDown } from 'lucide-react';
import FileUpload from '../../components/shared/FileUpload';
import FilePreviewList from '../../components/shared/FilePreviewList';
import ProcessingState from '../../components/shared/ProcessingState';
import AdPlaceholder from '../../components/shared/AdPlaceholder';
import { useFileValidation } from '../../hooks/useFileValidation';
import { useToolHistory } from '../../hooks/useToolHistory';
import '../styles/ToolStyles.css';

const PdfToJpg = () => {
  const [file, setFile] = useState(null);
  const [imageUrls, setImageUrls] = useState([]);
  
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const { validateFiles } = useFileValidation();
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/pdf-to-jpg', 'PDF to JPG', 'image');
  }, [addHistory]);

  const handleFilesSelected = (selectedFiles) => {
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
      setFile(validFiles[0]);
      setImageUrls([]);
    }
  };

  const removeFile = () => {
    setFile(null);
    setImageUrls([]);
    setStatus('idle');
  };

  const convertToJpg = async () => {
    if (!file) return;

    setStatus('processing');
    setImageUrls([]);

    try {
      const pdfjsLib = await import('pdfjs-dist');
      const workerUrl = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.default;

      const fileReader = new FileReader();
      
      fileReader.onload = async function() {
        try {
          const typedarray = new Uint8Array(this.result);
          const pdf = await pdfjsLib.getDocument(typedarray).promise;
          
          const newUrls = [];
          
          const pagesToProcess = Math.min(pdf.numPages, 5);
          
          for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 }); 
            
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
          setStatus('success');
          if (pdf.numPages > 5) {
             setErrorMessage(`Only showing the first 5 pages to prevent performance issues.`);
          }
        } catch (err) {
          console.error(err);
          setStatus('error');
          setErrorMessage("Error parsing PDF document.");
        }
      };
      
      fileReader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMessage("Failed to process the PDF.");
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
               <FilePreviewList 
                 files={[file]} 
                 onRemove={status === 'processing' ? null : removeFile} 
                 title="Selected File"
               />
             )}

             <ProcessingState 
               status={status} 
               error={errorMessage} 
               message={status === 'success' ? 'Converted to JPG successfully!' : 'Converting...'} 
             />

             {status !== 'success' && status !== 'processing' && file && !imageUrls.length && (
               <div className="action-area text-center">
                 <button 
                   onClick={convertToJpg} 
                   className="btn-primary" 
                 >
                   Convert to JPG
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
                       <button onClick={() => downloadImage(url, index)} className="btn-secondary" style={{ width: '100%', padding: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                         <ArrowDown size={16} /> Download
                       </button>
                     </div>
                   ))}
                 </div>
               </div>
             )}
             
             {status === 'success' && (
               <div className="action-area text-center mt-4">
                 <button 
                   onClick={removeFile} 
                   className="btn-secondary"
                 >
                   Convert Another PDF
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

export default PdfToJpg;

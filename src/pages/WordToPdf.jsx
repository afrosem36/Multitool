import React, { useState, useEffect } from 'react';
import { ArrowDown } from 'lucide-react';
import FileUpload from '../components/shared/FileUpload';
import FilePreviewList from '../components/shared/FilePreviewList';
import ProcessingState from '../components/shared/ProcessingState';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import { useFileValidation } from '../hooks/useFileValidation';
import { useToolHistory } from '../hooks/useToolHistory';
import './ToolStyles.css';

const WordToPdf = () => {
  const [file, setFile] = useState(null);
  
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const { validateFiles } = useFileValidation();
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/word-to-pdf', 'Word to PDF', 'fileText');
  }, [addHistory]);

  const handleFilesSelected = (selectedFiles) => {
    setStatus('idle');
    setErrorMessage('');
    
    const { validFiles, error } = validateFiles(selectedFiles, { 
      allowedTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'],
      maxFiles: 1 
    });

    if (error) {
      setStatus('error');
      setErrorMessage(error);
      return;
    }

    if (validFiles.length > 0) {
      setFile(validFiles[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
    setStatus('idle');
  };

  const processWordToPdf = async () => {
    if (!file) return;

    setStatus('processing');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const mammoth = await import('mammoth');
          const arrayBuffer = e.target.result;
          
          const result = await mammoth.convertToHtml({ arrayBuffer });
          const htmlContent = result.value;

          if (!htmlContent) {
            throw new Error("Could not extract content from the Word document.");
          }

          const container = document.createElement('div');
          container.innerHTML = htmlContent;
          
          container.style.padding = '20mm';
          container.style.fontFamily = 'Arial, sans-serif';
          container.style.fontSize = '12pt';
          container.style.lineHeight = '1.6';
          container.style.color = '#000';
          container.style.background = '#fff';
          container.style.width = '210mm'; 
          
          container.style.position = 'absolute';
          container.style.left = '-9999px';
          container.style.top = '-9999px';
          document.body.appendChild(container);

          const html2pdf = (await import('html2pdf.js')).default;

          const opt = {
            margin:       10,
            filename:     `${file.name.replace(/\.[^/.]+$/, "")}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
          };

          await html2pdf().set(opt).from(container).save();

          document.body.removeChild(container);
          setStatus('success');
          
        } catch (err) {
          console.error("Conversion error:", err);
          setStatus('error');
          setErrorMessage("Failed to convert the document. Ensure it's a valid .docx file.");
        }
      };

      reader.onerror = () => {
        setStatus('error');
        setErrorMessage("Failed to read the file.");
      };

      reader.readAsArrayBuffer(file);
      
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMessage("An error occurred during conversion.");
    }
  };

  return (
    <div className="tool-container container">
      <div className="tool-header text-center animate-fade-in">
        <h1>Word to PDF</h1>
        <p>Convert your Word documents (.docx) into PDFs 100% securely on your device. No server required.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        {!file && status !== 'processing' && status !== 'success' ? (
          <FileUpload 
            onFilesSelected={handleFilesSelected}
            accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
            multiple={false}
            title="Click or drag to upload a Word Document"
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
               message={status === 'success' ? 'Document converted successfully!' : 'Converting on Device...'} 
             />

             {status !== 'success' && status !== 'processing' && file && (
               <div className="action-area text-center">
                 <button 
                   onClick={processWordToPdf} 
                   className="btn-primary" 
                 >
                   <ArrowDown size={18} /> Convert & Download PDF
                 </button>
               </div>
             )}
             
             {status === 'success' && (
               <div className="action-area text-center mt-4">
                 <button 
                   onClick={removeFile} 
                   className="btn-secondary"
                 >
                   Convert Another Document
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

export default WordToPdf;

import React, { useState, useEffect } from 'react';
import { ArrowDown } from 'lucide-react';
import FileUpload from '../../components/shared/FileUpload';
import FilePreviewList from '../../components/shared/FilePreviewList';
import ProcessingState from '../../components/shared/ProcessingState';
import AdPlaceholder from '../../components/shared/AdPlaceholder';
import { useFileValidation } from '../../hooks/useFileValidation';
import { useToolHistory } from '../../hooks/useToolHistory';
import RelatedTools from '../../components/shared/RelatedTools';
import AffiliatePlaceholder from '../../components/shared/AffiliatePlaceholder';
import '../styles/ToolStyles.css';

const PdfMerger = () => {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('idle'); // idle, processing, success, error
  const [errorMessage, setErrorMessage] = useState('');
  
  const { validateFiles } = useFileValidation();
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/merge', 'Merge PDF', 'merge');
  }, [addHistory]);

  const handleFilesSelected = (selectedFiles) => {
    setStatus('idle');
    setErrorMessage('');
    
    const { validFiles, error } = validateFiles(selectedFiles, { 
      allowedTypes: ['application/pdf'],
      currentCount: files.length
    });

    if (error) {
      setStatus('error');
      setErrorMessage(error);
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
    setStatus('idle');
  };

  const mergePdfs = async () => {
    if (files.length < 2) {
      setStatus('error');
      setErrorMessage("Please add at least 2 PDF files to merge.");
      return;
    }

    setStatus('processing');

    try {
      const { PDFDocument } = await import('pdf-lib');
      const mergedPdf = await PDFDocument.create();

      for (const file of files) {
        const fileBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(fileBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => {
          mergedPdf.addPage(page);
        });
      }

      const mergedPdfFile = await mergedPdf.save();
      
      const blob = new Blob([mergedPdfFile], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'merged_document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setStatus('success');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMessage("Failed to merge PDFs. They might be corrupted or encrypted.");
    }
  };

  return (
    <div className="tool-container container">
      <div className="tool-header text-center animate-fade-in">
        <h1>Merge PDFs</h1>
        <p>Combine multiple PDF files into one easily.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        {files.length === 0 && status !== 'processing' && status !== 'success' ? (
          <FileUpload 
            onFilesSelected={handleFilesSelected}
            accept="application/pdf"
            title="Click or drag to upload PDFs"
          />
        ) : (
          <div className="file-workspace">
            <FilePreviewList files={files} onRemove={status === 'processing' ? null : removeFile} />
            
            {status !== 'success' && status !== 'processing' && (
               <div className="mt-4">
                 <FileUpload 
                   onFilesSelected={handleFilesSelected}
                   accept="application/pdf"
                   title="Add more files"
                   subtitle="Optional"
                 />
               </div>
            )}

            <ProcessingState status={status} error={errorMessage} message={status === 'success' ? 'PDFs merged successfully!' : 'Merging PDFs...'} />

            {status !== 'processing' && status !== 'success' && (
              <div className="action-area text-center mt-4">
                <button 
                  onClick={mergePdfs} 
                  className="btn-primary" 
                  disabled={files.length < 2}
                >
                  <ArrowDown size={18} />
                  Merge & Download
                </button>
              </div>
            )}
            
            {status === 'success' && (
              <div className="action-area text-center mt-4">
                <button 
                  onClick={() => { setFiles([]); setStatus('idle'); }} 
                  className="btn-secondary"
                >
                  Merge More PDFs
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {(status === 'success' || files.length > 0) && (
        <>
          <AffiliatePlaceholder 
            title="Professional PDF Software" 
            description="Looking for an offline PDF editor with advanced features? Try Adobe Acrobat Pro for full desktop control."
            link="https://adobe.com"
            cta="Explore Acrobat"
            className="mt-5"
          />
          <AdPlaceholder className="mt-5" />
          <RelatedTools currentToolId="merge" category="pdf" />
        </>
      )}
    </div>
  );
};

export default PdfMerger;

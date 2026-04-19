import React, { useState, useEffect } from 'react';
import { FileText, ArrowDown } from 'lucide-react';
import FileUpload from '../components/shared/FileUpload';
import FilePreviewList from '../components/shared/FilePreviewList';
import ProcessingState from '../components/shared/ProcessingState';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import { useFileValidation } from '../hooks/useFileValidation';
import { useToolHistory } from '../hooks/useToolHistory';
import './ToolStyles.css';

const PdfToWord = () => {
  const [file, setFile] = useState(null);
  
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const { validateFiles } = useFileValidation();
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/pdf-to-word', 'PDF to Word', 'fileText');
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
    }
  };

  const removeFile = () => {
    setFile(null);
    setStatus('idle');
  };

  const extractTextAndDownloadWord = async () => {
    if (!file) return;

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
            setStatus('error');
            setErrorMessage("No extractable text found in this PDF (might be scanned images).");
            return;
          }

          const { Document, Packer, Paragraph, TextRun } = await import('docx');
          
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
          
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${file.name.replace('.pdf', '')}_converted.docx`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          setStatus('success');
        } catch (err) {
          console.error(err);
          setStatus('error');
          setErrorMessage("Error parsing PDF document or creating Word file.");
        }
      };
      
      fileReader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMessage("Failed to process the PDF.");
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
        {!file && status !== 'processing' && status !== 'success' ? (
          <FileUpload 
            onFilesSelected={handleFilesSelected}
            accept="application/pdf"
            multiple={false}
            title="Click or drag to upload a PDF for text extraction"
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
               message={status === 'success' ? 'Extracted text and downloaded Word document!' : 'Extracting Text...'} 
             />

             {status !== 'success' && status !== 'processing' && file && (
               <div className="action-area text-center">
                 <button 
                   onClick={extractTextAndDownloadWord} 
                   className="btn-primary" 
                 >
                   <FileText size={18} /> Extract & Download DOCX
                 </button>
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

export default PdfToWord;

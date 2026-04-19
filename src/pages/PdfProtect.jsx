import React, { useState, useEffect } from 'react';
import { Lock, Unlock, ShieldAlert } from 'lucide-react';
import FileUpload from '../components/shared/FileUpload';
import FilePreviewList from '../components/shared/FilePreviewList';
import ProcessingState from '../components/shared/ProcessingState';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import { useFileValidation } from '../hooks/useFileValidation';
import { useToolHistory } from '../hooks/useToolHistory';
import './ToolStyles.css';

const PdfProtect = () => {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('lock'); // 'lock' or 'unlock'
  const [password, setPassword] = useState('');
  
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const { validateFiles } = useFileValidation();
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/protect', 'Protect/Unlock PDF', 'lock');
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
    setPassword('');
    setStatus('idle');
  };

  const processPdf = async () => {
    if (!file || !password) {
      setStatus('error');
      setErrorMessage("Please provide a PDF and a password.");
      return;
    }

    setStatus('processing');

    try {
      const fileBytes = await file.arrayBuffer();
      let finalBytes;
      let filenameSuffix;

      if (mode === 'lock') {
        const { encryptPDF } = await import('@pdfsmaller/pdf-encrypt-lite');
        const uint8Array = new Uint8Array(fileBytes);
        finalBytes = await encryptPDF(uint8Array, password, password);
        filenameSuffix = 'locked';
      } else {
        const { PDFDocument } = await import('pdf-lib');
        const pdf = await PDFDocument.load(fileBytes, { password });
        finalBytes = await pdf.save();
        filenameSuffix = 'unlocked';
      }

      const blob = new Blob([finalBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${file.name.replace('.pdf', '')}_${filenameSuffix}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setStatus('success');
    } catch (err) {
      console.error(err);
      setStatus('error');
      if (mode === 'unlock') {
        setErrorMessage("Failed to unlock. Ensure the password is correct and the PDF is not heavily encrypted with unsupported ciphers.");
      } else {
        setErrorMessage("Failed to encrypt the PDF.");
      }
    }
  };

  return (
    <div className="tool-container container">
      <div className="tool-header text-center animate-fade-in">
        <h1>Protect PDF</h1>
        <p>Lock your PDF with a password, or unlock an encrypted PDF.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <button 
            className={`btn-secondary ${mode === 'lock' ? 'active-tab' : ''}`}
            onClick={() => { setMode('lock'); setStatus('idle'); setErrorMessage(''); }}
            style={mode === 'lock' ? { background: 'var(--gradient-primary)', borderColor: 'transparent' } : {}}
            disabled={status === 'processing' || status === 'success'}
          >
            <Lock size={18} /> Lock PDF
          </button>
          <button 
            className={`btn-secondary ${mode === 'unlock' ? 'active-tab' : ''}`}
            onClick={() => { setMode('unlock'); setStatus('idle'); setErrorMessage(''); }}
            style={mode === 'unlock' ? { background: 'var(--gradient-primary)', borderColor: 'transparent' } : {}}
            disabled={status === 'processing' || status === 'success'}
          >
            <Unlock size={18} /> Unlock PDF
          </button>
        </div>

        {!file && status !== 'processing' && status !== 'success' ? (
          <FileUpload 
            onFilesSelected={handleFilesSelected}
            accept="application/pdf"
            multiple={false}
            title={`Click or drag to upload a PDF to ${mode === 'lock' ? 'protect' : 'unlock'}`}
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

             {status !== 'success' && status !== 'processing' && file && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', margin: '2rem 0' }}>
                  <label htmlFor="password-input">
                    {mode === 'lock' ? 'Set a password:' : 'Enter the current password:'}
                  </label>
                  <input 
                    type="password" 
                    id="password-input" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="Password..."
                    style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.1)', color: 'white', width: '100%', maxWidth: '300px', outline: 'none' }}
                  />
                </div>
             )}

             <ProcessingState 
               status={status} 
               error={errorMessage} 
               message={status === 'success' ? `PDF successfully ${mode === 'lock' ? 'locked' : 'unlocked'}!` : `Processing PDF...`} 
             />

             {status !== 'success' && status !== 'processing' && file && (
               <div className="action-area text-center">
                 <button 
                   onClick={processPdf} 
                   className="btn-primary" 
                   disabled={!password}
                 >
                   {mode === 'lock' ? <Lock size={18} /> : <Unlock size={18} />}
                   {mode === 'lock' ? 'Encrypt & Download' : 'Decrypt & Download'}
                 </button>
               </div>
             )}
             
             {status === 'success' && (
               <div className="action-area text-center mt-4">
                 <button 
                   onClick={removeFile} 
                   className="btn-secondary"
                 >
                   Process Another PDF
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

export default PdfProtect;

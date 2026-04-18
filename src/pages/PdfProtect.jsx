import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite';
import { Upload, Lock, Unlock, ShieldAlert, ArrowDown } from 'lucide-react';
import './ToolStyles.css';

const PdfProtect = () => {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('lock'); // 'lock' or 'unlock'
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleFileUpload = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
    } else {
      setError("Please select a valid PDF file.");
      setFile(null);
    }
  };

  const processPdf = async () => {
    if (!file || !password) {
      setError("Please provide a PDF and a password.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const fileBytes = await file.arrayBuffer();
      let finalBytes;
      let filenameSuffix;

      if (mode === 'lock') {
        // We use pdf-encrypt-lite to add password protection
        const uint8Array = new Uint8Array(fileBytes);
        finalBytes = await encryptPDF(uint8Array, password, password);
        filenameSuffix = 'locked';
      } else {
        // We use pdf-lib to load with password and save without it (decrypting)
        const pdf = await PDFDocument.load(fileBytes, { password });
        finalBytes = await pdf.save();
        filenameSuffix = 'unlocked';
      }

      // Download
      const blob = new Blob([finalBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${file.name.replace('.pdf', '')}_${filenameSuffix}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error(err);
      if (mode === 'unlock') {
        setError("Failed to unlock. Ensure the password is correct and the PDF is not heavily encrypted with unsupported ciphers.");
      } else {
        setError("Failed to encrypt the PDF.");
      }
    } finally {
      setIsProcessing(false);
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
            onClick={() => { setMode('lock'); setError(null); }}
            style={mode === 'lock' ? { background: 'var(--gradient-primary)', borderColor: 'transparent' } : {}}
          >
            <Lock size={18} /> Lock PDF
          </button>
          <button 
            className={`btn-secondary ${mode === 'unlock' ? 'active-tab' : ''}`}
            onClick={() => { setMode('unlock'); setError(null); }}
            style={mode === 'unlock' ? { background: 'var(--gradient-primary)', borderColor: 'transparent' } : {}}
          >
            <Unlock size={18} /> Unlock PDF
          </button>
        </div>

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
              <span>Click to upload a PDF to {mode === 'lock' ? 'protect' : 'unlock'}</span>
            </label>
          </div>
        ) : (
          <div className="file-loaded-area">
             <div className="file-item glass-panel" style={{ marginBottom: '2rem' }}>
                <div className="file-info">
                  <ShieldAlert size={20} className="text-gradient" />
                  <span>{file.name}</span>
                </div>
                <button onClick={() => setFile(null)} className="btn-secondary" style={{ padding: '0.25rem 0.75rem' }}>
                  Change File
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', marginBottom: '2rem' }}>
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

              <div className="action-area text-center">
                <button 
                  onClick={processPdf} 
                  className="btn-primary" 
                  disabled={isProcessing || !password}
                >
                  {isProcessing ? 'Processing...' : (
                    <>
                      {mode === 'lock' ? <Lock size={18} /> : <Unlock size={18} />}
                      {mode === 'lock' ? 'Encrypt & Download' : 'Decrypt & Download'}
                    </>
                  )}
                </button>
              </div>
          </div>
        )}

        {error && <div className="error-message" style={{ marginTop: '1rem' }}>{error}</div>}
      </div>
    </div>
  );
};

export default PdfProtect;

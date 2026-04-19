import React, { useState, useEffect, useRef } from 'react';
import { ScanLine, ArrowLeft, Upload, Copy, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToolHistory } from '../hooks/useToolHistory';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import './ToolStyles.css';

const QrDecoder = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [decodedText, setDecodedText] = useState('');
  const [isDecoding, setIsDecoding] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  
  const fileInputRef = useRef(null);
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/utilities/qr-decoder', 'QR Code Decoder', 'scanLine');
  }, [addHistory]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setDecodedText('');
      setError('');
      setCopied(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      setFile(droppedFile);
      setPreview(URL.createObjectURL(droppedFile));
      setDecodedText('');
      setError('');
      setCopied(false);
    } else {
      setError('Please upload a valid image file.');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const decodeQR = async () => {
    if (!file) return;
    
    setIsDecoding(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('https://api.qrserver.com/v1/read-qr-code/', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Failed to process image');
      
      const data = await response.json();
      
      if (data && data[0] && data[0].symbol && data[0].symbol[0]) {
        const symbolData = data[0].symbol[0];
        if (symbolData.data) {
          setDecodedText(symbolData.data);
        } else {
          setError(symbolData.error || 'No QR code found in this image.');
        }
      } else {
        setError('Unexpected API response.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while trying to decode the image. Please try another image.');
    } finally {
      setIsDecoding(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(decodedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="tool-container container" style={{ maxWidth: '600px' }}>
      <Link to="/utilities" className="btn-secondary" style={{ display: 'inline-flex', marginBottom: '2rem' }}>
        <ArrowLeft size={16} /> Back to Utilities
      </Link>
      
      <div className="tool-header text-center animate-fade-in">
        <ScanLine size={48} className="text-gradient mx-auto mb-4" />
        <h1>QR Code Decoder</h1>
        <p>Upload a QR code image to quickly extract and read its hidden data.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        <div 
          className="upload-area" 
          onDrop={handleDrop} 
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current.click()}
          style={{ cursor: 'pointer', border: '2px dashed rgba(255,255,255,0.2)', padding: '3rem 2rem', borderRadius: '12px', textAlign: 'center', marginBottom: '2rem', transition: 'all 0.3s ease' }}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            style={{ display: 'none' }} 
          />
          <Upload size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem', margin: '0 auto' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>Drag & Drop Image Here</h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>or click to browse your files</p>
        </div>

        {preview && (
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <img src={preview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} />
          </div>
        )}

        {error && (
          <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', borderRadius: '4px', marginBottom: '1.5rem' }}>
            <p style={{ color: '#ef4444', margin: 0 }}>{error}</p>
          </div>
        )}

        {file && !decodedText && !error && (
          <button 
            onClick={decodeQR}
            className="btn-primary"
            style={{ width: '100%', marginBottom: '2rem' }}
            disabled={isDecoding}
          >
            {isDecoding ? 'Decoding...' : 'Decode QR Image'}
          </button>
        )}

        {decodedText && (
          <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#10b981' }}>Decoded Result:</h3>
              <button onClick={copyToClipboard} className="btn-secondary" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {copied ? <CheckCircle size={16} color="#10b981" /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', wordBreak: 'break-all' }}>
              <p style={{ margin: 0, fontSize: '1.1rem', lineHeight: '1.5' }}>{decodedText}</p>
            </div>
          </div>
        )}
      </div>

      <AdPlaceholder className="mt-5" />
    </div>
  );
};

export default QrDecoder;

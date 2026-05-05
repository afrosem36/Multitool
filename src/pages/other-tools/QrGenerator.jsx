import React, { useState, useEffect } from 'react';
import { QrCode, ArrowLeft, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToolHistory } from '../../hooks/useToolHistory';
import AdPlaceholder from '../../components/shared/AdPlaceholder';
import '../styles/ToolStyles.css';

const QrGenerator = () => {
  const [text, setText] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/utilities/qr-generator', 'QR Code Generator', 'qrCode');
  }, [addHistory]);

  const generateQR = () => {
    if (!text.trim()) {
      setQrUrl('');
      return;
    }
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
    setQrUrl(url);
  };

  const handleDownload = async () => {
    if (!qrUrl) return;
    try {
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qrcode.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download image', err);
    }
  };

  return (
    <div className="tool-container container" style={{ maxWidth: '600px' }}>
      <Link to="/utilities" className="btn-secondary" style={{ display: 'inline-flex', marginBottom: '2rem' }}>
        <ArrowLeft size={16} /> Back to Utilities
      </Link>
      
      <div className="tool-header text-center animate-fade-in">
        <QrCode size={48} className="text-gradient mx-auto mb-4" />
        <h1>QR Code Generator</h1>
        <p>Instantly generate high-quality QR codes for links, text, or contact information.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
            Enter Text or URL
          </label>
          <textarea 
            value={text} 
            onChange={(e) => setText(e.target.value)}
            placeholder="https://example.com"
            rows={4}
            style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none', resize: 'vertical' }}
          />
        </div>
        
        <button 
          onClick={generateQR}
          className="btn-primary"
          style={{ width: '100%', marginBottom: '2rem' }}
          disabled={!text.trim()}
        >
          Generate QR Code
        </button>

        {qrUrl && (
          <div className="glass-panel text-center animate-fade-in" style={{ padding: '2rem', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <div style={{ background: 'white', padding: '1rem', display: 'inline-block', borderRadius: '12px', marginBottom: '1.5rem' }}>
              <img src={qrUrl} alt="Generated QR Code" style={{ display: 'block', width: '200px', height: '200px' }} />
            </div>
            
            <div>
              <button onClick={handleDownload} className="btn-secondary" style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                <Download size={18} /> Download PNG
              </button>
            </div>
          </div>
        )}
      </div>

      <AdPlaceholder className="mt-5" />
    </div>
  );
};

export default QrGenerator;

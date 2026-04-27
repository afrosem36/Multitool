import React, { useState, useEffect } from 'react';
import { Upload, Download, Trash2, Key, ChevronLeft, RefreshCw, AlertCircle, ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import ToolHeader from '../../components/shared/ToolHeader';
import RelatedTools from '../../components/shared/RelatedTools';

export default function BackgroundRemover() {
  const [file, setFile] = useState(null);
  const [originalUrl, setOriginalUrl] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('remove-bg-api-key') || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setOriginalUrl(URL.createObjectURL(uploadedFile));
      setResultUrl('');
      toast.success('Image uploaded');
    }
  };

  const saveApiKey = (e) => {
    const key = e.target.value.trim();
    setApiKey(key);
    localStorage.setItem('remove-bg-api-key', key);
  };

  const removeBackground = async () => {
    if (!apiKey) return toast.error('Please enter your remove.bg API key');
    if (!file) return toast.error('Please upload an image first');

    setIsProcessing(true);
    const formData = new FormData();
    formData.append('image_file', file);
    formData.append('size', 'auto');

    try {
      const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.errors?.[0]?.title || 'Failed to remove background');
      }

      const blob = await response.blob();
      setResultUrl(URL.createObjectURL(blob));
      toast.success('Background removed successfully!');
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `removed-bg-${file.name.split('.')[0]}.png`;
    a.click();
  };

  return (
    <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <Link to="/image-tools" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', textDecoration: 'none' }}>
        <ChevronLeft size={16} /> Back to Image Tools
      </Link>

      <ToolHeader 
        title="AI Background Remover" 
        description="Instantly remove backgrounds from your photos using AI. High quality transparent PNG results in seconds. Powered by remove.bg API."
      />

      {!apiKey && (
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem', border: '1px solid rgba(59, 130, 246, 0.4)', background: 'rgba(59, 130, 246, 0.05)' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Key size={24} color="var(--accent-primary)" /> API Key Required
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            To use this tool, you need a free API key from <a href="https://www.remove.bg/api" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>remove.bg</a>. You get 50 free previews every month!
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <input 
              type="password" 
              placeholder="Enter your remove.bg API key" 
              value={apiKey}
              onChange={saveApiKey}
              style={{ flex: 1, padding: '0.85rem 1.25rem', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white', outline: 'none' }}
            />
            <button onClick={() => toast.success('API Key saved locally')} className="btn-primary">Save Key</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {!originalUrl ? (
            <div 
              className="glass-panel" 
              style={{ 
                padding: '5rem 2rem', border: '2px dashed var(--border-color)', 
                textAlign: 'center', cursor: 'pointer'
              }}
              onClick={() => document.getElementById('image-upload').click()}
            >
              <input type="file" id="image-upload" hidden accept="image/*" onChange={handleFileUpload} />
              <Upload size={48} color="var(--accent-primary)" style={{ marginBottom: '1.5rem' }} />
              <h3>Choose Image to Process</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>JPG, PNG or WebP</p>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000', marginBottom: '1.5rem' }}>
                <img src={originalUrl} alt="Original" style={{ width: '100%', display: 'block' }} />
                <button onClick={() => { setFile(null); setOriginalUrl(''); setResultUrl(''); }} style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(239, 68, 68, 0.8)', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer' }}>
                  <Trash2 size={18} />
                </button>
              </div>
              <button 
                onClick={removeBackground} 
                disabled={isProcessing || !apiKey}
                className="btn-primary" 
                style={{ width: '100%', padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', fontSize: '1.1rem' }}
              >
                {isProcessing ? <RefreshCw size={20} className="spin" /> : <><RefreshCw size={20} /> Remove Background</>}
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {resultUrl ? (
            <div className="glass-panel animate-fade-in" style={{ padding: '2rem' }}>
              <h4 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ImageIcon size={18} color="var(--accent-primary)" /> Comparison View
              </h4>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden', borderRadius: '12px', background: '#eee', backgroundImage: 'conic-gradient(#fff 0.25turn, #ddd 0.25turn 0.5turn, #fff 0.5turn 0.75turn, #ddd 0.75turn)' }}>
                {/* Checkboard background */}
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                  <img src={resultUrl} alt="Result" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  <div 
                    style={{ 
                      position: 'absolute', 
                      inset: 0, 
                      width: `${sliderPos}%`, 
                      overflow: 'hidden', 
                      borderRight: '2px solid white' 
                    }}
                  >
                    <img src={originalUrl} alt="Original" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={sliderPos} 
                    onChange={(e) => setSliderPos(e.target.value)} 
                    style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', width: '90%', zIndex: 10 }}
                  />
                </div>
              </div>
              <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '1rem 0' }}>Drag the slider to compare before & after</p>
              <button onClick={handleDownload} className="btn-primary" style={{ width: '100%', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                <Download size={20} /> Download Transparent PNG
              </button>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '3rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {isProcessing ? (
                <>
                  <RefreshCw size={48} className="spin" color="var(--accent-primary)" style={{ marginBottom: '1.5rem' }} />
                  <h3>AI is working...</h3>
                  <p>Removing background using remove.bg API. This usually takes 5-10 seconds.</p>
                </>
              ) : (
                <>
                  <AlertCircle size={48} style={{ marginBottom: '1.5rem', opacity: 0.3 }} />
                  <p>Process an image to see the result here.</p>
                </>
              )}
            </div>
          )}

          {apiKey && (
             <div className="glass-panel" style={{ padding: '1rem 1.5rem' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>API Key: ••••••••••••</span>
                 <button onClick={() => { setApiKey(''); localStorage.removeItem('remove-bg-api-key'); }} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem' }}>Change Key</button>
               </div>
             </div>
          )}
        </div>
      </div>

      <RelatedTools currentToolId="background-remover" category="image" />
    </div>
  );
}

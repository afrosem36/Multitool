import React, { useState, useEffect } from 'react';
import { Upload, Download, Trash2, ChevronLeft, RefreshCw, AlertCircle, ImageIcon, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import ToolHeader from '../../components/shared/ToolHeader';
import RelatedTools from '../../components/shared/RelatedTools';
import AdBanner from '../../components/shared/AdBanner';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config';

export default function BackgroundRemover() {
  const { user, token } = useAuth();
  const [file, setFile] = useState(null);
  const [originalUrl, setOriginalUrl] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  
  // Credit state
  const [credits, setCredits] = useState({ used: 0, total: 5, remaining: 5 });
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);

  useEffect(() => {
    if (user && token) {
      fetchCredits();
    }
  }, [user, token]);

  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [originalUrl, resultUrl]);

  const fetchCredits = async () => {
    setIsLoadingCredits(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/remove-bg/credits`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.data) {
        setCredits({
          used: data.data.creditsUsed,
          total: data.data.creditsTotal,
          remaining: data.data.creditsRemaining
        });
      }
    } catch (err) {
      console.error('Failed to fetch credits:', err);
    } finally {
      setIsLoadingCredits(false);
    }
  };

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setFile(uploadedFile);
      setOriginalUrl(URL.createObjectURL(uploadedFile));
      setResultUrl('');
      toast.success('Image uploaded');
    }
  };

  const removeBackground = async () => {
    if (!user) return toast.error('Please login to use this tool');
    if (!file) return toast.error('Please upload an image first');
    if (credits.remaining <= 0) return toast.error('You have reached your daily limit');

    setIsProcessing(true);
    const formData = new FormData();
    formData.append('image_file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/remove-bg`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove background');
      }

      const blob = await response.blob();
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setResultUrl(URL.createObjectURL(blob));
      toast.success('Background removed successfully!');
      fetchCredits(); // Update credits
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
        description="Instantly remove backgrounds from your photos using AI. High quality transparent PNG results in seconds. Free for every user (5/day)."
      />

      {/* Credit Status Bar */}
      {user ? (
        <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '2rem', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ padding: '0.4rem', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.2)' }}>
                <RefreshCw size={18} color="var(--accent-primary)" />
              </div>
              <span style={{ fontWeight: '600' }}>Daily AI Quota</span>
            </div>
            <span style={{ fontSize: '0.9rem', color: credits.remaining === 0 ? '#ef4444' : 'var(--text-secondary)' }}>
              {isLoadingCredits ? 'Refreshing credits...' : `${credits.remaining} / ${credits.total} credits remaining`}
            </span>
          </div>
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
            <div 
              style={{ 
                height: '100%', 
                width: `${(credits.remaining / credits.total) * 100}%`, 
                background: credits.remaining <= 1 ? 'linear-gradient(90deg, #ef4444, #f87171)' : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                transition: 'width 0.5s ease'
              }} 
            />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Info size={12} /> Credits reset every 24 hours at midnight UTC.
          </p>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <AlertCircle color="#f59e0b" />
            <div>
              <p style={{ fontWeight: '600' }}>Authentication Required</p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Please <Link to="/login" style={{ color: '#f59e0b', textDecoration: 'underline' }}>Login</Link> to use the AI Background Remover.
              </p>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {!originalUrl ? (
            <div 
              className="glass-panel" 
              style={{ 
                padding: '5rem 2rem', border: '2px dashed var(--border-color)', 
                textAlign: 'center', cursor: 'pointer',
                opacity: !user ? 0.6 : 1
              }}
              onClick={() => user && document.getElementById('image-upload').click()}
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
                <button onClick={() => {
                  if (originalUrl) URL.revokeObjectURL(originalUrl);
                  if (resultUrl) URL.revokeObjectURL(resultUrl);
                  setFile(null);
                  setOriginalUrl('');
                  setResultUrl('');
                }} style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(239, 68, 68, 0.8)', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer' }}>
                  <Trash2 size={18} />
                </button>
              </div>
              <button 
                onClick={removeBackground} 
                disabled={isProcessing || !user || credits.remaining === 0}
                className="btn-primary" 
                style={{ width: '100%', padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', fontSize: '1.1rem' }}
              >
                {isProcessing ? <RefreshCw size={20} className="spin" /> : (
                  credits.remaining === 0 ? 'Limit Reached' : <><RefreshCw size={20} /> Remove Background</>
                )}
              </button>
            </div>
          )}
        </div>

        <AdBanner position="belowTool" />

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
                  <p>Removing background using AI. This usually takes 5-10 seconds.</p>
                </>
              ) : (
                <>
                  <AlertCircle size={48} style={{ marginBottom: '1.5rem', opacity: 0.3 }} />
                  <p>Process an image to see the result here.</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <RelatedTools currentToolId="background-remover" category="image" />
    </div>
  );
}

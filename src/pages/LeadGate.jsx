import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { User, Mail, Phone, ArrowRight, Loader2, Lock, Type, Hash, ChevronDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import SeoHead from '../components/seo/SEOHead';
import { API_BASE_URL } from '../config';

export default function LeadGate() {
  const { slug } = useParams();
  const [formData, setFormData] = useState({});
  const [config, setConfig] = useState(null);
  const [backgroundUrl, setBackgroundUrl] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Config
        const configRes = await fetch(`${API_BASE_URL}/api/s/${slug}/config`);
        const configJson = await configRes.json();
        if (!configRes.ok) throw new Error(configJson.error || 'Failed to load form');
        
        const fetchedConfig = configJson.data.formConfig || {
          fields: [
            { id: 'name', label: 'Full Name', type: 'text', required: true }
          ],
          design: { background: '', buttonColor: 'var(--primary-color)' }
        };
        setConfig(fetchedConfig);

        // Fetch Background
        const bgRes = await fetch(`${API_BASE_URL}/api/s/${slug}/background`);
        const bgJson = await bgRes.json();
        if (bgRes.ok && bgJson.data?.backgroundUrl) {
          setBackgroundUrl(bgJson.data.backgroundUrl);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchData();
  }, [slug]);

  const handleInputChange = (id, value) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const validateFields = () => {
    for (const field of config.fields) {
      if (field.required && !formData[field.id]?.trim()) {
        toast.error(`Please fill out ${field.label}.`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateFields()) return;

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/s/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const json = await res.json();
      
      if (!res.ok) throw new Error(json.error || 'Failed to submit details');

      toast.success('Redirecting...');
      window.location.href = json.data.longUrl;
    } catch (err) {
      toast.error(err.message);
      setIsLoading(false);
    }
  };

  if (loadingConfig) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <Loader2 className="spin" size={40} color="var(--accent-primary)" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: '#fff', padding: '2rem', textAlign: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Oops!</h1>
          <p style={{ opacity: 0.7 }}>{error}</p>
        </div>
      </div>
    );
  }

  const isVideo = backgroundUrl && (backgroundUrl.includes('.mp4') || backgroundUrl.includes('.webm') || backgroundUrl.includes('video'));
  const hasCustomBg = !!backgroundUrl || !!config.design?.background;

  return (
    <div style={{ 
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
      position: 'relative', overflow: 'hidden', background: 'var(--bg-primary)'
    }}>
      <SeoHead title="Access Protected Link" description="Please provide the required information to access this content." />

      {/* Background Layer */}
      {backgroundUrl ? (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
          {isVideo ? (
            <video 
              src={backgroundUrl} 
              autoPlay 
              muted 
              loop 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          ) : (
            <div style={{ 
              width: '100%', height: '100%', 
              backgroundImage: `url(${backgroundUrl})`, 
              backgroundSize: 'cover', 
              backgroundPosition: 'center' 
            }} />
          )}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.3)' }} />
        </div>
      ) : config.design?.background ? (
        <div style={{ 
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0,
          background: config.design.background, backgroundSize: 'cover', backgroundPosition: 'center'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.4)' }} />
        </div>
      ) : null}
      
      <div className="glass-panel" style={{ 
        maxWidth: '500px', width: '100%', padding: '3rem 2.5rem', textAlign: 'center',
        position: 'relative', zIndex: 1,
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        borderRadius: '24px'
      }}>
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ 
            width: '70px', height: '70px', borderRadius: '20px', 
            background: 'linear-gradient(135deg, var(--accent-primary), var(--primary-color))', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem',
            boxShadow: '0 10px 20px rgba(99, 102, 241, 0.3)'
          }}>
            <Lock size={32} color="#fff" />
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '0.75rem', color: '#fff', letterSpacing: '-0.025em' }}>Protected Content</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.05rem', lineHeight: '1.5' }}>
            To view this content, please complete the form below.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
          {config.fields.map((field) => (
            <div key={field.id}>
              <label style={{ display: 'block', marginBottom: '0.6rem', fontSize: '0.9rem', fontWeight: '600', color: 'rgba(255,255,255,0.9)' }}>
                {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
              </label>
              
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: '14px', left: '16px', color: 'rgba(255,255,255,0.5)' }}>
                  {field.type === 'number' ? <Hash size={18} /> : field.type === 'dropdown' ? <ChevronDown size={18} /> : <Type size={18} />}
                </div>

                {field.type === 'dropdown' ? (
                  <select
                    required={field.required}
                    value={formData[field.id] || ''}
                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                    style={{
                      width: '100%', padding: '14px 16px 14px 46px', borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.1)', 
                      background: 'rgba(0,0,0,0.3)',
                      color: '#fff', outline: 'none', fontSize: '1rem',
                      appearance: 'none', cursor: 'pointer'
                    }}
                  >
                    <option value="" disabled>Select an option</option>
                    {field.options?.map(opt => (
                      <option key={opt} value={opt} style={{ background: '#1e1e1e' }}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type={field.type === 'number' ? 'number' : 'text'} 
                    required={field.required}
                    value={formData[field.id] || ''}
                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    style={{
                      width: '100%', padding: '14px 16px 14px 46px', borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.1)', 
                      background: 'rgba(0,0,0,0.3)',
                      color: '#fff', outline: 'none', fontSize: '1rem',
                      transition: 'all 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = config.design?.buttonColor || 'var(--accent-primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                )}
              </div>
            </div>
          ))}

          <button 
            type="submit" 
            disabled={isLoading}
            style={{ 
              marginTop: '1.5rem', padding: '16px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
              background: config.design?.buttonColor || 'var(--primary-color)',
              color: '#fff', border: 'none', borderRadius: '14px', cursor: 'pointer', fontWeight: '700',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            {isLoading ? <Loader2 size={24} className="spin" /> : (
              <>Access Link <ArrowRight size={22} /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

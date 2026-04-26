import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { User, Mail, Phone, ArrowRight, Loader2, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import SeoHead from '../components/seo/SEOHead';

export default function LeadGate() {
  const { slug } = useParams();
  const [formData, setFormData] = useState({});
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(`/api/s/${slug}/config`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load form');
        
        const fetchedConfig = json.data.formConfig || {
          fields: [
            { id: 'name', label: 'Full Name', type: 'text', required: true, icon: 'User' },
            { id: 'email_or_phone', label: 'Email or Phone Number', type: 'text', required: true, icon: 'Mail' }
          ],
          design: { background: '', buttonColor: 'var(--primary-color)' }
        };
        setConfig(fetchedConfig);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchConfig();
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
      if (field.type === 'email' && formData[field.id]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData[field.id])) {
          toast.error(`Please enter a valid Email for ${field.label}.`);
          return false;
        }
      }
      if (field.type === 'tel' && formData[field.id]) {
        const phoneRegex = /^\+?[1-9]\d{1,14}$/; // E.164 format
        if (!phoneRegex.test(formData[field.id].replace(/[\s-]/g, ''))) {
          toast.error(`Please enter a valid Phone Number for ${field.label}.`);
          return false;
        }
      }
      if (field.id === 'email_or_phone' && formData[field.id]) {
        const val = formData[field.id].trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        if (!emailRegex.test(val) && !phoneRegex.test(val.replace(/[\s-]/g, ''))) {
          toast.error(`Please enter a valid Email or Phone Number.`);
          return false;
        }
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateFields()) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/s/${slug}/submit`, {
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
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="spin" size={40} /></div>;
  }

  if (error) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><h1>{error}</h1></div>;
  }

  const renderIcon = (iconName) => {
    if (iconName === 'Mail') return <Mail size={18} />;
    if (iconName === 'Phone') return <Phone size={18} />;
    return <User size={18} />;
  };

  return (
    <div style={{ 
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
      background: config.design?.background || 'var(--bg-primary)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}>
      <SeoHead title="Access Link" description="Please enter your details to access this link." />
      
      <div className="glass-panel" style={{ 
        maxWidth: '450px', width: '100%', padding: '3rem 2rem', textAlign: 'center',
        background: config.design?.background ? 'rgba(255, 255, 255, 0.1)' : 'var(--bg-panel)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ 
            width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.2)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem',
            color: config.design?.background ? '#fff' : 'var(--primary-color)'
          }}>
            <Lock size={30} />
          </div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', color: config.design?.background ? '#fff' : 'var(--text-primary)' }}>Protected Link</h1>
          <p style={{ color: config.design?.background ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)' }}>
            The creator of this link requires you to provide your details to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
          {config.fields.map((field) => (
            <div key={field.id}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500', color: config.design?.background ? '#fff' : 'var(--text-primary)' }}>
                {field.label} {field.required && '*'}
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: '12px', left: '14px', color: config.design?.background ? 'rgba(255,255,255,0.6)' : 'var(--text-secondary)' }}>
                  {renderIcon(field.icon)}
                </div>
                <input 
                  type={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'} 
                  required={field.required}
                  value={formData[field.id] || ''}
                  onChange={(e) => handleInputChange(field.id, e.target.value)}
                  placeholder={`Enter your ${field.label.toLowerCase()}`}
                  style={{
                    width: '100%', padding: '12px 14px 12px 42px', borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.3)', 
                    background: config.design?.background ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.2)',
                    color: '#fff', outline: 'none', fontSize: '1rem',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = config.design?.buttonColor || 'var(--accent-primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.3)'}
                />
              </div>
            </div>
          ))}

          <button 
            type="submit" 
            disabled={isLoading}
            style={{ 
              marginTop: '1rem', padding: '14px', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem',
              background: config.design?.buttonColor || 'var(--primary-color)',
              color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            {isLoading ? <Loader2 size={20} className="spin" /> : (
              <>Continue to Destination <ArrowRight size={20} /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

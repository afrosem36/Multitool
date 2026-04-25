import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { User, Mail, ArrowRight, Loader2, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import SeoHead from '../components/seo/SEOHead';

export default function LeadGate() {
  const { slug } = useParams();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !contact) {
      toast.error('Please fill out all fields.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/s/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, contact })
      });

      const json = await res.json();
      
      if (!res.ok) throw new Error(json.error || 'Failed to submit details');

      toast.success('Redirecting...');
      // Redirect to the actual long URL
      window.location.href = json.data.longUrl;
    } catch (err) {
      toast.error(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <SeoHead title="Access Link" description="Please enter your details to access this link." />
      
      <div className="glass-panel" style={{ maxWidth: '450px', width: '100%', padding: '3rem 2rem', textAlign: 'center' }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ 
            width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem',
            color: 'var(--primary-color)'
          }}>
            <Lock size={30} />
          </div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Protected Link</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            The creator of this link requires you to provide your details to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>Full Name</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '12px', left: '14px', color: 'var(--text-secondary)' }}>
                <User size={18} />
              </div>
              <input 
                type="text" 
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                style={{
                  width: '100%', padding: '12px 14px 12px 42px', borderRadius: '8px',
                  border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)',
                  color: 'var(--text-primary)', outline: 'none', fontSize: '1rem',
                  transition: 'border-color 0.2s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
              />
            </div>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>Email or Mobile Number</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '12px', left: '14px', color: 'var(--text-secondary)' }}>
                <Mail size={18} />
              </div>
              <input 
                type="text" 
                required
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="john@example.com"
                style={{
                  width: '100%', padding: '12px 14px 12px 42px', borderRadius: '8px',
                  border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)',
                  color: 'var(--text-primary)', outline: 'none', fontSize: '1rem',
                  transition: 'border-color 0.2s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            disabled={isLoading}
            style={{ marginTop: '1rem', padding: '14px', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
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

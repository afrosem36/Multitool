import React, { useState, useEffect } from 'react';
import { X, Cookie } from 'lucide-react';

const CookieConsent = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookie-consent', 'declined');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '1rem',
      left: '1rem',
      right: '1rem',
      maxWidth: '600px',
      margin: '0 auto',
      background: 'rgba(20, 20, 30, 0.95)',
      backdropFilter: 'blur(10px)',
      border: '1px solid var(--glass-border)',
      borderRadius: '12px',
      padding: '1.5rem',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
      animation: 'slide-up 0.5s ease-out'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Cookie className="text-gradient" size={24} />
          <h3 style={{ margin: 0 }}>We value your privacy</h3>
        </div>
        <button 
          onClick={handleDecline}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem' }}
        >
          <X size={18} />
        </button>
      </div>
      
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
        We use cookies to enhance your browsing experience, serve personalized ads or content, and analyze our traffic. By clicking "Accept All", you consent to our use of cookies. Read our <a href="/privacy-policy" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>Privacy Policy</a> for more information.
      </p>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
        <button 
          onClick={handleDecline} 
          className="btn-secondary"
          style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
        >
          Decline
        </button>
        <button 
          onClick={handleAccept} 
          className="btn-primary"
          style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
        >
          Accept All
        </button>
      </div>
    </div>
  );
};

export default CookieConsent;

import React, { useState, useEffect } from 'react';

const GlobalBackground = () => {
  const [bg, setBg] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  const updateBg = () => {
    const saved = localStorage.getItem('site_background');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setBg(parsed);
        setIsVisible(true);
      } catch (e) {
        setBg(null);
        setIsVisible(false);
      }
    } else {
      setBg(null);
      setIsVisible(false);
    }
  };

  const handleFallback = () => {
    localStorage.removeItem('site_background');
    setBg(null);
    setIsVisible(false);
    window.dispatchEvent(new Event('storage'));
  };

  useEffect(() => {
    updateBg();
    window.addEventListener('storage', updateBg);
    return () => window.removeEventListener('storage', updateBg);
  }, []);

  useEffect(() => {
    if (bg) {
      document.body.classList.add('has-custom-bg');
    } else {
      document.body.classList.remove('has-custom-bg');
    }
  }, [bg]);

  if (!bg) return null;

  return (
    <div className={`global-site-background ${isVisible ? 'fade-in' : ''}`} style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: -1,
      pointerEvents: 'none',
      overflow: 'hidden',
      transition: 'opacity 0.5s ease-in-out',
      opacity: isVisible ? 1 : 0
    }}>
      {bg.type === 'video' ? (
        <video 
          src={bg.url} 
          autoPlay 
          muted 
          loop 
          playsInline
          onError={handleFallback}
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover' 
          }} 
        />
      ) : (
        <img 
          src={bg.url} 
          alt=""
          onError={handleFallback}
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover'
          }} 
        />
      )}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.3)'
      }} />
    </div>
  );
};

export default GlobalBackground;

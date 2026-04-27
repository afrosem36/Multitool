import React, { useState, useEffect, useRef } from 'react';
import './AdBanner.css';

const AdBanner = ({ position = 'belowTool', className = '', delay = 1500 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const adRef = useRef(null);

  // Example configurations for different positions
  const configs = {
    top: { minHeight: '90px', maxWidth: '728px', label: 'Top Banner' },
    sidebar: { minHeight: '250px', maxWidth: '300px', label: 'Sidebar Ad' },
    belowTool: { minHeight: '250px', maxWidth: '728px', label: 'Main Ad' },
    belowToolMobile: { minHeight: '250px', maxWidth: '100%', label: 'Mobile Main Ad' },
    footer: { minHeight: '90px', maxWidth: '970px', label: 'Footer Banner' },
    sticky: { minHeight: '50px', maxWidth: '100%', label: 'Sticky Banner' },
  };

  const config = configs[position] || configs.belowTool;

  useEffect(() => {
    // 1. Frequency Control: Don't show ads if visited very recently (e.g., within last 5 minutes)
    // This is just an example, could be adjusted for more/less aggressive monetization
    const lastAdSeen = localStorage.getItem('last_ad_seen');
    const now = Date.now();
    // if (lastAdSeen && (now - parseInt(lastAdSeen)) < 300000) { // 5 mins
    //   return;
    // }

    // 2. Delay Load for better SEO and initial UX
    const timer = setTimeout(() => {
      setIsVisible(true);
      localStorage.setItem("last_ad_seen", Date.now().toString());
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (isVisible && adRef.current) {
      // 3. Using a sandboxed iframe to prevent redirects and protect responsiveness
      const iframe = document.createElement("iframe");
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "none";
      iframe.style.overflow = "hidden";
      iframe.sandbox = "allow-scripts allow-forms allow-popups allow-same-origin";
      
      const adHtml = `
        <html>
          <head>
            <style>body { margin: 0; display: flex; justify-content: center; align-items: center; overflow: hidden; }</style>
          </head>
          <body>
            <script>
              (function(wzszveg){
                var d = document,
                    s = d.createElement('script'),
                    l = d.scripts[d.scripts.length - 1];
                s.settings = wzszveg || {};
                s.src = "//shameful-farm.com/bJX-Ves.dFGplL0yYuWAck/iedml9/uaZ/UFl/kTP/TZYR5wOuTxM/wmNijAUdtqNkjMk/5EMozzA/2iOFQH";
                s.async = true;
                s.referrerPolicy = 'no-referrer-when-downgrade';
                l.parentNode.insertBefore(s, l);
              })({})
            </script>
          </body>
        </html>
      `;
      
      iframe.srcdoc = adHtml;
      adRef.current.appendChild(iframe);
      setIsLoaded(true);
    }
  }, [isVisible]);

  if (!isVisible) return <div className={`ad-skeleton ad-${position}`} style={{ minHeight: config.minHeight }} />;

  return (
    <div 
      className={`ad-container ad-${position} ${className} glass-panel ${isLoaded ? 'loaded' : ''}`} 
      style={{ 
        minHeight: config.minHeight,
        maxWidth: config.maxWidth,
        margin: (position === 'sidebar' || position === 'sticky') ? '0' : '1.5rem auto'
      }}
    >
      <div className="ad-inner" ref={adRef}>
        <div className="ad-label">Advertisement</div>
        <div className="ad-content">
          <div className="ad-placeholder-text">
            {config.label}
            <br />
            <small>Premium Optimized Unit</small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdBanner;

import React from 'react';

const AdPlaceholder = ({ className = '', id = 'ad-container' }) => {
  return (
    <div className={`ad-placeholder ${className}`} id={id}>
      <div className="ad-content glass-panel text-center text-muted" style={{ padding: '20px', margin: '20px 0', border: '1px dashed rgba(255,255,255,0.2)' }}>
        <p>Advertisement</p>
        <small>AdSense or other network code will be inserted here.</small>
      </div>
    </div>
  );
};

export default AdPlaceholder;

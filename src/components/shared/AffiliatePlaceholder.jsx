import React from 'react';
import { ExternalLink, Star } from 'lucide-react';

const AffiliatePlaceholder = ({ title, description, link, cta, className = '' }) => {
  return (
    <div 
      className={`glass-panel animate-fade-in ${className}`}
      style={{
        padding: '1.5rem',
        marginTop: '2rem',
        border: '1px solid rgba(234, 179, 8, 0.3)',
        background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.05) 0%, rgba(234, 179, 8, 0.02) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.5rem'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: 1, minWidth: '280px' }}>
        <div style={{ 
          background: 'rgba(234, 179, 8, 0.2)', 
          padding: '0.75rem', 
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#eab308'
        }}>
          <Star size={24} />
        </div>
        <div>
          <h4 style={{ margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {title || 'Recommended Resource'}
            <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', color: 'var(--text-secondary)' }}>Sponsored</span>
          </h4>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {description || 'Discover premium tools and resources to boost your productivity. Check out our partner deals.'}
          </p>
        </div>
      </div>
      
      <a 
        href={link || '#'} 
        target="_blank" 
        rel="noopener noreferrer"
        className="btn-primary"
        style={{ 
          background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
          display: 'inline-flex',
          textDecoration: 'none',
          whiteSpace: 'nowrap'
        }}
      >
        {cta || 'Learn More'}
        <ExternalLink size={16} />
      </a>
    </div>
  );
};

export default AffiliatePlaceholder;

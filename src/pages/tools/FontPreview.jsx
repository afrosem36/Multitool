import React, { useState, useEffect } from 'react';
import { Type, Download, Copy, Search, Sliders, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import ToolHeader from '../../components/shared/ToolHeader';
import RelatedTools from '../../components/shared/RelatedTools';

const GOOGLE_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Playfair Display', 'Merriweather', 'Raleway', 'Poppins', 'Oswald',
  'Source Sans 3', 'Roboto Mono', 'Ubuntu', 'Lora', 'PT Sans', 'Nunito', 'Playfair', 'Muli', 'Work Sans', 'Fira Sans',
  'Quicksand', 'Josefin Sans', 'Libre Baskerville', 'Arvo', 'Dosis', 'Abel', 'Questrial', 'Shadows Into Light', 'Pacifico', 'Dancing Script',
  'Satisfy', 'Courgette', 'Great Vibes', 'Lobster', 'Righteous', 'Fredoka One', 'Bebas Neue', 'Permanent Marker', 'Kaushan Script', 'Special Elite'
];

export default function FontPreview() {
  const [text, setText] = useState('The quick brown fox jumps over the lazy dog');
  const [fontSize, setFontSize] = useState(32);
  const [search, setSearch] = useState('');

  useEffect(() => {
    // Inject Google Fonts link
    const fontFamilies = GOOGLE_FONTS.map(f => f.replace(/ /g, '+')).join('|');
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css?family=${fontFamilies}&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  const filteredFonts = GOOGLE_FONTS.filter(font => 
    font.toLowerCase().includes(search.toLowerCase())
  );

  const copyToClipboard = (text, message) => {
    navigator.clipboard.writeText(text);
    toast.success(message);
  };

  return (
    <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <Link to="/text-tools" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', textDecoration: 'none' }}>
        <ChevronLeft size={16} /> Back to Text Tools
      </Link>

      <ToolHeader 
        title="Google Font Previewer" 
        description="Type your text and see it instantly rendered across 40+ popular Google Fonts. Compare styles and copy CSS imports in one click."
      />

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '600' }}>Preview Text</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type something to preview..."
              style={{
                width: '100%',
                padding: '1.25rem',
                borderRadius: '12px',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border-color)',
                color: 'white',
                fontSize: '1.1rem',
                minHeight: '120px',
                outline: 'none',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontWeight: '600' }}>
                <Sliders size={16} /> Font Size: {fontSize}px
              </label>
              <input
                type="range"
                min="16"
                max="72"
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontWeight: '600' }}>
                <Search size={16} /> Filter Fonts
              </label>
              <input
                type="text"
                placeholder="Search font name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-color)',
                  color: 'white',
                  outline: 'none'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {filteredFonts.map(font => (
          <div key={font} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', transition: 'transform 0.2s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '700', color: 'var(--accent-primary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{font}</span>
            </div>
            
            <div style={{ 
              fontFamily: `'${font}', sans-serif`, 
              fontSize: `${fontSize}px`, 
              lineHeight: '1.2',
              minHeight: '80px',
              wordBreak: 'break-word',
              color: 'white',
              padding: '1rem 0'
            }}>
              {text || 'Font Preview'}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
              <button 
                onClick={() => copyToClipboard(font, `Font name "${font}" copied!`)}
                className="btn-secondary" 
                style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem' }}
              >
                <Copy size={14} /> Name
              </button>
              <button 
                onClick={() => copyToClipboard(`@import url('https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}&display=swap');`, 'CSS Import line copied!')}
                className="btn-primary" 
                style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem' }}
              >
                <Download size={14} /> Import
              </button>
            </div>
          </div>
        ))}
      </div>

      <RelatedTools currentToolId="font-preview" category="text" />
    </div>
  );
}

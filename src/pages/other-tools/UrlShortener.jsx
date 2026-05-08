import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config';
import { Link, useLocation } from 'react-router-dom';
import { Clipboard, Check, Link as LinkIcon, RefreshCw, Trash2, ArrowRight, Database } from 'lucide-react';
import SeoHead from '../../components/seo/SEOHead';
import { toast } from 'react-hot-toast';
import FormBuilder from '../../components/FormBuilder';
import { useAuth } from '../../context/AuthContext';

const UrlShortener = () => {
  const { token, user } = useAuth();
  const location = useLocation();
  const [longUrl, setLongUrl] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [formConfig, setFormConfig] = useState(null);
  const [bgFile, setBgFile] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('urlShortenerHistory');
    if (saved) {
      setHistory(JSON.parse(saved));
    }

    // If the user is authenticated, attempt to fetch their links from the backend
    if (user && token) {
      fetch(`${API_BASE_URL}/api/links`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(async (res) => {
          if (!res.ok) {
            // Gracefully handle 404 or other errors without crashing the UI
            throw new Error(`Server returned ${res.status}`);
          }
          const data = await res.json();
          if (data && data.data) {
            setHistory(data.data);
          }
        })
        .catch((err) => console.warn('Could not fetch links from server (falling back to local storage):', err.message));
    }
  }, [user, token]);

  const getFullShortUrl = (shortUrl) => {
    if (!shortUrl) return '';
    // If it's already a full URL, return as-is
    if (shortUrl.startsWith('http://') || shortUrl.startsWith('https://')) {
      return shortUrl;
    }
    // If it's a path, construct full URL
    if (shortUrl.startsWith('/')) {
      return `${window.location.origin}${shortUrl}`;
    }
    // If it's just a slug, construct full URL
    return `${window.location.origin}/s/${shortUrl}`;
  };

  const saveToHistory = (newLink) => {
    // Ensure shortUrl is always the full URL
    const fullLink = {
      ...newLink,
      shortUrl: getFullShortUrl(newLink.shortUrl)
    };
    const updated = [fullLink, ...history];
    setHistory(updated);
    localStorage.setItem('urlShortenerHistory', JSON.stringify(updated));
  };

  const removeFromHistory = (slugToRemove) => {
    const updated = history.filter(item => item.slug !== slugToRemove);
    setHistory(updated);
    localStorage.setItem('urlShortenerHistory', JSON.stringify(updated));
    toast.success('Link removed from history');
  };

  const isValidUrl = (url) => {
    try {
      new URL(url);
      return url.startsWith('http://') || url.startsWith('https://');
    } catch {
      return false;
    }
  };

  const generateRandomSlug = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';
    let slug = '';
    for (let i = 0; i < 8; i++) {
      slug += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return slug;
  };

  const isSlugAvailable = (slug) => {
    return !history.some(item => item.slug === slug);
  };

  const handleShorten = async (e) => {
    e.preventDefault();

    if (!isValidUrl(longUrl)) {
      toast.error('Please enter a valid URL starting with http:// or https://');
      return;
    }

    // Validate custom slug if provided
    if (customSlug) {
      if (customSlug.length < 3) {
        toast.error('Custom slug must be at least 3 characters long.');
        return;
      }
      if (!customSlug.match(/^[a-zA-Z0-9-_]+$/)) {
        toast.error('Custom slug can only contain letters, numbers, hyphens, and underscores.');
        return;
      }
      if (!isSlugAvailable(customSlug)) {
        toast.error('This custom slug is already in use. Please choose a different one.');
        return;
      }
    }

    setIsLoading(true);

    try {
      let gate_bg_key = null;
      if (bgFile) {
        const bgData = new FormData();
        bgData.append('file', bgFile);
        const bgRes = await fetch(`${API_BASE_URL}/api/upload-asset`, {
          method: 'POST',
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: bgData,
        });
        const bgResult = await bgRes.json();
        if (!bgRes.ok) throw new Error(bgResult.error || 'Background upload failed');
        gate_bg_key = bgResult.data.key;
      }

      const finalSlug = customSlug || generateRandomSlug();

      const response = await fetch(`${API_BASE_URL}/api/shorten`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          longUrl,
          customSlug: finalSlug,
          formConfig,
          gate_bg_key
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to shorten URL');
      }

      saveToHistory({
        slug: data.data.slug,
        shortUrl: data.data.shortUrl,
        longUrl,
        createdAt: new Date().toISOString(),
        hasDataCollection: !!formConfig
      });

      toast.success('URL Shortened successfully!');
      setLongUrl('');
      setCustomSlug('');
      setFormConfig(null);
      setBgFile(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text, slug) => {
    navigator.clipboard.writeText(text);
    setCopiedSlug(slug);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  return (
    <div className="container">
      <SeoHead 
        title="URL Shortener" 
        description="Create fast, trackable short links instantly with optional data collection."
      />

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 0' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 className="text-gradient" style={{ fontSize: '3rem', marginBottom: '1rem' }}>
            URL Shortener
          </h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
            Paste a long URL to instantly generate a trackable short link.
          </p>
        </div>

        {/* Create Link Card */}
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '3rem' }}>
          <form onSubmit={handleShorten}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Destination URL
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '12px', left: '16px', color: 'var(--text-secondary)' }}>
                    <LinkIcon size={20} />
                  </div>
                  <input
                    type="text"
                    value={longUrl}
                    onChange={(e) => setLongUrl(e.target.value)}
                    placeholder="https://example.com/very/long/path"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 16px 12px 48px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'rgba(0,0,0,0.2)',
                      color: 'var(--text-primary)',
                      fontSize: '1rem',
                      outline: 'none',
                      transition: 'border-color 0.2s ease'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Custom Alias (Optional)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>/s/</span>
                  <input
                    type="text"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
                    placeholder="my-custom-link"
                    maxLength={20}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'rgba(0,0,0,0.2)',
                      color: 'var(--text-primary)',
                      fontSize: '1rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {user ? (
                <FormBuilder onChange={setFormConfig} onBackgroundUpload={setBgFile} />
              ) : (
                <div style={{ background: 'rgba(99,102,241,0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-primary)', margin: 0 }}>
                    Want to require visitor details (lead generation)? <Link to="/login" state={{ from: location.pathname }} style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>Log in</Link> to unlock this feature.
                  </p>
                </div>
              )}

              <button 
                type="submit" 
                className="btn-primary" 
                disabled={isLoading || !longUrl}
                style={{ marginTop: '0.5rem', padding: '14px', fontSize: '1.1rem' }}
              >
                {isLoading ? <RefreshCw size={20} className="spin" /> : 'Shorten URL'}
              </button>
            </div>
          </form>
        </div>

        {/* History List */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem' }}>Your Short Links</h2>
            <Link to="/analytics" className="btn-secondary" style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}>
              View Analytics <ArrowRight size={16} />
            </Link>
          </div>

          {history.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <LinkIcon size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <h3>No links yet</h3>
              <p>Shorten your first link above!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {history.map((item) => (
                <div key={item.slug} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ overflow: 'hidden' }}>
                    <a 
                      href={item.shortUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent-primary)', display: 'block', marginBottom: '0.25rem' }}
                    >
                      {item.shortUrl}
                    </a>
                    <a 
                      href={item.longUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}
                      title={item.longUrl}
                    >
                      {item.longUrl}
                    </a>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                      <small style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                        Created {new Date(item.createdAt).toLocaleDateString()}
                      </small>
                      {item.hasDataCollection && (
                        <small style={{ color: 'var(--primary-color)', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Database size={12} /> Lead Gate Active
                        </small>
                      )}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link
                      to={`/analytics?search=${item.slug}`}
                      className="btn-secondary"
                      style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="View Analytics & Data"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10"></line>
                        <line x1="12" y1="20" x2="12" y2="4"></line>
                        <line x1="6" y1="20" x2="6" y2="14"></line>
                      </svg>
                    </Link>
                    <button
                      onClick={() => copyToClipboard(item.shortUrl, item.slug)}
                      className="btn-secondary"
                      style={{ padding: '0.5rem' }}
                      title="Copy short link"
                    >
                      {copiedSlug === item.slug ? <Check size={18} color="var(--success)" /> : <Clipboard size={18} />}
                    </button>
                    <button
                      onClick={() => removeFromHistory(item.slug)}
                      className="btn-secondary"
                      style={{ padding: '0.5rem', color: 'var(--danger)' }}
                      title="Remove from history"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UrlShortener;

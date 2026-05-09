import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader, AlertCircle, Download, CheckCircle, Clock } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import SeoHead from '../../components/seo/SEOHead';

export default function DownloadPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState('loading'); // loading, success, error, expired
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);

  useEffect(() => {
    const fetchDownload = async () => {
      try {
        if (!slug) {
          setState('error');
          setError('Invalid download link');
          return;
        }

        console.log(`[Download] Fetching download URL for slug: ${slug}`);

        // Fetch the download metadata
        const metaRes = await fetch(`${API_BASE_URL}/api/s/${slug}/download`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });

        console.log(`[Download] Download response status: ${metaRes.status}`);

        // Handle specific error cases
        if (metaRes.status === 404) {
          setState('error');
          setError('File not found. The share link may have been deleted.');
          return;
        }

        if (metaRes.status === 410) {
          setState('expired');
          setError('This file link has expired. Please ask the creator for a new share link.');
          return;
        }

        if (!metaRes.ok) {
          const contentType = metaRes.headers.get('content-type');
          let errorMsg = `Server error: ${metaRes.status}`;

          try {
            if (contentType?.includes('application/json')) {
              const data = await metaRes.json();
              errorMsg = data.error || errorMsg;
            }
          } catch (e) {
            // ignore parse error
          }

          setState('error');
          setError(errorMsg);
          return;
        }

        const data = await metaRes.json();
        console.log('[Download] Meta data:', data);

        // Extract download URL and file info
        let url = data.data?.downloadUrl || data.downloadUrl;
        const fname = data.data?.fileName || data.fileName || 'download';

        // Ensure URL is absolute
        if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
          if (!url.startsWith('/')) {
            url = `/${url}`;
          }
          url = `${API_BASE_URL}${url}`;
        }

        if (!url) {
          setState('error');
          setError('Unable to generate download link');
          return;
        }

        setFileName(fname);
        setDownloadUrl(url);
        setState('success');
      } catch (err) {
        console.error('[Download] Error:', err);
        setState('error');
        setError(err.message || 'Failed to prepare download. Please try again.');
      }
    };

    fetchDownload();
  }, [slug]);

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
      // Keep user on the download page, show success message
    }
  };

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: '1.5rem',
    background: 'var(--bg-dark)',
    padding: '2rem'
  };

  const cardStyle = {
    background: 'var(--surface-color)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '3rem 2rem',
    maxWidth: '500px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
  };

  const iconStyle = {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1.5rem'
  };

  // Loading state
  if (state === 'loading') {
    return (
      <div style={containerStyle}>
        <SeoHead title="Preparing Download" description="Preparing your file download..." />
        <div style={cardStyle}>
          <div style={{ ...iconStyle, background: 'rgba(99, 102, 241, 0.1)' }}>
            <Loader size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
          </div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Preparing Download</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Please wait while we fetch your file...
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (state === 'success') {
    return (
      <div style={containerStyle}>
        <SeoHead title="Download Ready" description="Your file is ready for download" />
        <div style={cardStyle}>
          <div style={{ ...iconStyle, background: 'rgba(16, 185, 129, 0.1)' }}>
            <CheckCircle size={32} style={{ color: '#10b981' }} />
          </div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            {fileName || 'Download Ready'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 1.5rem 0' }}>
            Your file is ready. Click the button below to start the download.
          </p>

          <button
            onClick={handleDownload}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              width: '100%',
              padding: '0.875rem 1.5rem',
              background: 'var(--accent-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '1rem',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.opacity = '0.9'}
            onMouseLeave={(e) => e.target.style.opacity = '1'}
          >
            <Download size={20} />
            Download Now
          </button>

          <button
            onClick={() => navigate('/')}
            style={{
              width: '100%',
              padding: '0.75rem 1.5rem',
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              marginTop: '1rem',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = 'var(--text-secondary)';
              e.target.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = 'var(--border-color)';
              e.target.style.color = 'var(--text-secondary)';
            }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Expired state
  if (state === 'expired') {
    return (
      <div style={containerStyle}>
        <SeoHead title="Link Expired" description="This share link has expired" />
        <div style={cardStyle}>
          <div style={{ ...iconStyle, background: 'rgba(239, 68, 68, 0.1)' }}>
            <Clock size={32} style={{ color: '#ef4444' }} />
          </div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Link Expired
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 1.5rem 0' }}>
            This file link is no longer available. It may have expired or been deleted.
          </p>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            margin: '0 0 1.5rem 0',
            padding: '1rem',
            background: 'rgba(239, 68, 68, 0.05)',
            borderRadius: '8px',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            Ask the creator to generate a fresh share link.
          </p>

          <button
            onClick={() => navigate('/')}
            style={{
              width: '100%',
              padding: '0.875rem 1.5rem',
              background: 'var(--accent-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '1rem'
            }}
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div style={containerStyle}>
      <SeoHead title="Download Error" description="There was an error with your download" />
      <div style={cardStyle}>
        <div style={{ ...iconStyle, background: 'rgba(239, 68, 68, 0.1)' }}>
          <AlertCircle size={32} style={{ color: '#ef4444' }} />
        </div>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Download Error
        </h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 1.5rem 0' }}>
          {error || 'Something went wrong. Please try again.'}
        </p>

        <button
          onClick={() => window.location.reload()}
          style={{
            width: '100%',
            padding: '0.875rem 1.5rem',
            background: 'var(--accent-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '1rem',
            marginBottom: '0.75rem'
          }}
        >
          Try Again
        </button>

        <button
          onClick={() => navigate('/')}
          style={{
            width: '100%',
            padding: '0.75rem 1.5rem',
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          Return Home
        </button>
      </div>
    </div>
  );
}

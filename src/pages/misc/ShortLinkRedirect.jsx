import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config';
import { Loader, AlertCircle } from 'lucide-react';
import SeoHead from '../../components/seo/SEOHead';

const ShortLinkRedirect = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleRedirect = async () => {
      if (!slug) {
        setError('Invalid short link');
        setIsLoading(false);
        return;
      }

      try {
        // Log for debugging
        console.log(`[ShortLink] Processing redirect for slug: ${slug}`);
        console.log(`[ShortLink] API Base URL: ${API_BASE_URL}`);

        // First, try to get the config for this short link
        const configUrl = `${API_BASE_URL}/api/s/${slug}/config`;
        console.log(`[ShortLink] Fetching config from: ${configUrl}`);

        const configRes = await fetch(configUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });

        console.log(`[ShortLink] Config response status: ${configRes.status}`);

        if (!configRes.ok) {
          if (configRes.status === 404) {
            setError('Short link not found or expired');
          } else {
            throw new Error(`Server error: ${configRes.status} ${configRes.statusText}`);
          }
          setIsLoading(false);
          return;
        }

        const configData = await configRes.json();
        console.log(`[ShortLink] Config data:`, configData);

        // If it requires data collection or has a form, show the lead gate
        if (configData.data?.requiresDataCollection || configData.data?.formConfig) {
          console.log(`[ShortLink] Form required, redirecting to lead gate`);
          navigate(`/gate/${slug}`, { replace: true });
          return;
        }

        // Otherwise, directly submit and redirect
        const submitUrl = `${API_BASE_URL}/api/s/${slug}/submit`;
        console.log(`[ShortLink] Submitting to: ${submitUrl}`);

        const submitRes = await fetch(submitUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });

        const submitData = await submitRes.json();
        console.log(`[ShortLink] Submit response:`, submitData);

        if (!submitRes.ok) {
          throw new Error(submitData.error || 'Failed to process short link');
        }

        // Redirect to the actual URL
        if (submitData.data?.longUrl) {
          console.log(`[ShortLink] Redirecting to: ${submitData.data.longUrl}`);
          window.location.replace(submitData.data.longUrl);
          return;
        } else {
          setError('Invalid redirect target');
        }
      } catch (err) {
        console.error('[ShortLink] Error:', err);
        setError(err.message || 'Failed to process short link. Please try again.');
        setIsLoading(false);
      }
    };

    handleRedirect();
  }, [slug, navigate]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '1rem',
        background: 'var(--bg-dark)'
      }}>
        <SeoHead title="Redirecting..." description="Redirecting to destination..." />
        <Loader size={48} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Redirecting you...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '1rem',
        background: 'var(--bg-dark)',
        padding: '2rem'
      }}>
        <SeoHead title="Link Error" description="There was an error with this link" />
        <AlertCircle size={48} style={{ color: '#ef4444' }} />
        <h2 style={{ color: 'var(--text-primary)', textAlign: 'center' }}>Link Error</h2>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '500px' }}>
          {error}
        </p>
        <button
          onClick={() => window.location.href = '/'}
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1.5rem',
            background: 'var(--accent-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Go to Home
        </button>
      </div>
    );
  }

  return null;
};

export default ShortLinkRedirect;

import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Clock3, ArrowLeft } from 'lucide-react';
import SeoHead from '../components/seo/SEOHead';

export default function ExpiredLink() {
  const { slug } = useParams();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <SeoHead title="Link Expired" description="This shared link has expired." />

      <div className="glass-panel" style={{ maxWidth: '520px', width: '100%', padding: '3rem 2rem', textAlign: 'center' }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            color: '#ef4444'
          }}>
            <Clock3 size={30} />
          </div>
          <h1 style={{ fontSize: '1.9rem', marginBottom: '0.5rem' }}>Link Expired</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            This file link is no longer active.
          </p>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Contact the creator for access or ask them to generate a fresh share link.
          </p>
        </div>

        <div style={{
          padding: '1rem',
          borderRadius: '0.75rem',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-secondary)',
          marginBottom: '1.5rem'
        }}>
          Reference: <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>/s/{slug}</span>
        </div>

        <Link to="/share" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowLeft size={18} />
          Back to File Sharing
        </Link>
      </div>
    </div>
  );
}

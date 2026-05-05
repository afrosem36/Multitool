import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Trash2, Code, Eye, RefreshCw, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';

const SITE_BASE = import.meta.env.VITE_SITE_URL || 'https://multitoolhub.space';

function deployUrl(d) {
  return d.username ? `${SITE_BASE}/p/${d.username}/${d.slug}` : `${SITE_BASE}/d/${d.slug}`;
}

export default function DeployDashboard() {
  const { user, apiFetch } = useAuth();
  const navigate = useNavigate();
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetchDeployments();
  }, [user]);

  const fetchDeployments = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/deployments');
      const data = await res.json();
      setDeployments(data.data || []);
    } catch {
      toast.error('Failed to load deployments');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/deployments/${id}`, { method: 'DELETE' });
      toast.success('Deleted');
      setDeployments(prev => prev.filter(d => d.id !== id));
    } catch {
      toast.error('Failed to delete');
    }
  };

  const totalViews = deployments.reduce((sum, d) => sum + (d.views || 0), 0);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.25rem' }}>My Deployments</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {deployments.length} site{deployments.length !== 1 ? 's' : ''} · {totalViews} total views
          </p>
        </div>
        <button
          onClick={() => navigate('/tools/html-ide')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, padding: '0.6rem 1.1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}
        >
          <Plus size={16} /> New Project
        </button>
      </div>

      {/* Stats row */}
      {deployments.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'Total Sites', value: deployments.length },
            { label: 'Total Views', value: totalViews },
            { label: 'Most Viewed', value: deployments.reduce((a, b) => (b.views || 0) > (a.views || 0) ? b : a, deployments[0])?.project_name || '—' },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>{stat.label}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#a5b4fc' }}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Loading...</div>
      ) : deployments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)' }}>
          <Code size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>No deployments yet</p>
          <p style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>Open the HTML IDE and click Deploy to publish your first site.</p>
          <button
            onClick={() => navigate('/tools/html-ide')}
            style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.25rem', cursor: 'pointer', fontWeight: 600 }}
          >
            Open HTML IDE
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {deployments.map(d => (
            <div key={d.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '1.25rem 1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.3rem' }}>{d.project_name}</div>
                  <a
                    href={deployUrl(d)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#6366f1', fontSize: '0.82rem', wordBreak: 'break-all' }}
                  >
                    {deployUrl(d)}
                  </a>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.6rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Eye size={12} /> {d.views || 0} views
                    </span>
                    <span>Created {new Date(d.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button
                    title="Open site"
                    onClick={() => window.open(deployUrl(d), '_blank')}
                    style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '0.45rem 0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 500 }}
                  >
                    <ExternalLink size={13} /> Open
                  </button>
                  <button
                    title="Edit in IDE"
                    onClick={() => navigate('/tools/html-ide', { state: { deployment: d } })}
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '0.45rem 0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 500 }}
                  >
                    <Code size={13} /> Edit
                  </button>
                  <button
                    title="Delete"
                    onClick={() => handleDelete(d.id, d.project_name)}
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, padding: '0.45rem 0.55rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={fetchDeployments}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
    </div>
  );
}

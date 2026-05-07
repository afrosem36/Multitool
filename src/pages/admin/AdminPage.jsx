import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Upload, Check, Shield, Trash2, Grid, Users, Loader, AlertTriangle, Mail, Calendar, RotateCcw } from 'lucide-react';
import { GOOGLE_CLIENT_ID, API_BASE_URL } from '../../config';
import toast from 'react-hot-toast';

const ADMIN_EMAIL = 'afrosem36@gmail.com';
const TEMPLATES_KEY = 'site_bg_templates';
const BG_KEY = 'site_background';

// [template2, template3] — each slot is {url, type, key, name} or null
function loadTemplates() {
  try {
    const saved = localStorage.getItem(TEMPLATES_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return [parsed[0] ?? null, parsed[1] ?? null];
  } catch {
    return [null, null];
  }
}

function persistTemplates(templates) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

function activeBgUrl() {
  try {
    const saved = localStorage.getItem(BG_KEY);
    return saved ? JSON.parse(saved).url : null;
  } catch {
    return null;
  }
}

function applyBg(bg) {
  if (!bg || bg.type === 'boxes') {
    localStorage.removeItem(BG_KEY);
  } else {
    localStorage.setItem(BG_KEY, JSON.stringify({ url: bg.url, type: bg.type }));
  }
  window.dispatchEvent(new Event('storage'));
}

// ── Google login button ──────────────────────────────────────────
const GoogleLoginButton = ({ onSuccess }) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (window.google && ref.current) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (r) => onSuccess(r.credential),
      });
      window.google.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', width: 300 });
    }
  }, [onSuccess]);
  return <div ref={ref} style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }} />;
};

// ── Template card ────────────────────────────────────────────────
const card = (active) => ({
  border: `2px solid ${active ? '#22c55e' : 'var(--border-color)'}`,
  borderRadius: '12px',
  padding: '1.5rem',
  background: 'rgba(255,255,255,0.03)',
  position: 'relative',
  transition: 'border-color 0.2s',
});

const btn = (primary) => ({
  background: primary ? '#3b82f6' : 'rgba(255,255,255,0.08)',
  color: primary ? '#fff' : 'var(--text-primary)',
  border: primary ? 'none' : '1px solid var(--border-color)',
  padding: '0.4rem 0.9rem',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '0.85rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
});

function Preview({ template, pending }) {
  const src = pending?.previewUrl ?? template?.url;
  const type = pending?.type ?? template?.type;

  if (!src) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
        No background set
      </div>
    );
  }
  if (type === 'video') {
    return <video src={src} autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  return <img src={src} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
}

// ── Main page ────────────────────────────────────────────────────
const AdminPage = () => {
  const { user, token, loginWithGoogle, loading, apiFetch } = useAuth();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState(loadTemplates);
  const [activeUrl, setActiveUrl] = useState(activeBgUrl);
  const [pending, setPending] = useState(null);   // {file, previewUrl, type, slot}
  const [uploading, setUploading] = useState(null); // slot number while uploading

  // User management state
  const [activeTab, setActiveTab] = useState('background'); // 'background' or 'users'
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [resetting, setResetting] = useState(null);

  useEffect(() => {
    const handler = () => setActiveUrl(activeBgUrl());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  useEffect(() => {
    if (!loading && user && user.email !== ADMIN_EMAIL) {
      toast.error('Unauthorized access');
      navigate('/');
    }
  }, [user, loading, navigate]);

  const selectFile = (e, slot) => {
    const file = e.target.files[0];
    if (!file) return;
    if (pending) URL.revokeObjectURL(pending.previewUrl);
    const type = file.type.startsWith('video') ? 'video' : 'image';
    setPending({ file, previewUrl: URL.createObjectURL(file), type, slot });
    e.target.value = '';
  };

  const cancelPending = () => {
    if (pending) URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
  };

  const saveTemplate = useCallback(async (slot) => {
    if (!pending || pending.slot !== slot) return;
    setUploading(slot);
    try {
      const form = new FormData();
      form.append('file', pending.file);
      const res = await fetch(`${API_BASE_URL}/api/admin/upload-background`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Upload failed'); return; }

      const newTemplate = { url: data.url, type: pending.type, key: data.key, name: `Template ${slot}` };
      const updated = [...templates];
      updated[slot - 2] = newTemplate;
      setTemplates(updated);
      persistTemplates(updated);
      URL.revokeObjectURL(pending.previewUrl);
      setPending(null);
      toast.success(`Template ${slot} saved`);
    } catch (err) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setUploading(null);
    }
  }, [pending, templates, token]);

  const applyTemplate = (template) => {
    applyBg(template);
    setActiveUrl(template?.type === 'boxes' ? null : template?.url);
    toast.success(`${template?.name ?? 'Template 1'} applied`);
  };

  const deleteTemplate = async (slot) => {
    const tpl = templates[slot - 2];
    if (!tpl) return;
    try {
      await fetch(`${API_BASE_URL}/api/admin/background/${tpl.key}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    if (activeUrl === tpl.url) {
      localStorage.removeItem(BG_KEY);
      window.dispatchEvent(new Event('storage'));
      setActiveUrl(null);
    }
    const updated = [...templates];
    updated[slot - 2] = null;
    setTemplates(updated);
    persistTemplates(updated);
    toast.success(`Template ${slot} deleted`);
  };

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await apiFetch('/api/admin/users');
      const data = await res.json();
      if (data.data) {
        setUsers(data.data);
      }
    } catch (err) {
      toast.error('Failed to fetch users');
    } finally {
      setUsersLoading(false);
    }
  }, [apiFetch]);

  // Delete user
  const handleDeleteUser = async (userId, userEmail) => {
    if (!window.confirm(`Are you sure you want to delete all data for ${userEmail}? This cannot be undone.`)) {
      return;
    }

    setDeleting(userId);
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok) {
        setUsers(users.filter(u => u.id !== userId));
        toast.success(`User ${userEmail} deleted`);
      } else {
        toast.error(data.error || 'Failed to delete user');
      }
    } catch (err) {
      toast.error('Failed to delete user');
    } finally {
      setDeleting(null);
    }
  };

  // Reset credits
  const handleResetCredits = async (userId, userEmail) => {
    if (!window.confirm(`Reset daily credits for ${userEmail}?`)) {
      return;
    }

    setResetting(userId);
    try {
      const res = await apiFetch(`/api/admin/users/${userId}/reset-credits`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(`Credits reset for ${userEmail}`);
        fetchUsers();
      } else {
        toast.error(data.error || 'Failed to reset credits');
      }
    } catch (err) {
      toast.error('Failed to reset credits');
    } finally {
      setResetting(null);
    }
  };

  // Load users when tab changes
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab, fetchUsers]);

  // ── Auth gate ────────────────────────────────────────────────
  if (loading) return <div style={{ textAlign: 'center', padding: '4rem' }}>Loading…</div>;

  if (!user) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', maxWidth: '450px' }}>
        <Shield size={48} style={{ margin: '0 auto 1.5rem', color: 'var(--text-primary)' }} />
        <h2>Admin Authentication</h2>
        <p style={{ margin: '1rem 0', color: 'var(--text-secondary)' }}>Access restricted to authorised administrators.</p>
        <GoogleLoginButton onSuccess={async (t) => {
          const result = await loginWithGoogle(t);
          if (!result.success) toast.error(result.error || 'Login failed');
        }} />
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────
  const boxesActive = activeUrl === null;

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1>Admin Control Panel</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Manage site settings and user accounts.</p>
      </header>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <button
          onClick={() => setActiveTab('background')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'background' ? 600 : 400,
            color: activeTab === 'background' ? '#fff' : 'var(--text-secondary)',
            borderBottom: activeTab === 'background' ? '2px solid #3b82f6' : 'none',
            transition: 'all 0.2s',
          }}
        >
          Background Templates
        </button>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'users' ? 600 : 400,
            color: activeTab === 'users' ? '#fff' : 'var(--text-secondary)',
            borderBottom: activeTab === 'users' ? '2px solid #3b82f6' : 'none',
            transition: 'all 0.2s',
          }}
        >
          <Users size={16} style={{ display: 'inline-block', marginRight: '0.4rem', marginBottom: '-2px' }} />
          User Management
        </button>
      </div>

      {/* Background Tab */}
      {activeTab === 'background' && (
      <section className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>Background Templates</h2>

        <div style={{ display: 'grid', gap: '1.5rem' }}>

          {/* ── Template 1: Animated Grid ── */}
          <div style={card(boxesActive)}>
            {boxesActive && <ActiveBadge />}
            <h3 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Grid size={16} /> Template 1 — Animated Grid
            </h3>
            <div style={{ height: '100px', borderRadius: '8px', overflow: 'hidden', background: '#0a0a0f', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>⬛ Animated grid of boxes (default)</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button style={btn(false)} onClick={() => applyTemplate({ type: 'boxes', name: 'Animated Grid' })}>
                <Check size={14} /> {boxesActive ? 'Applied' : 'Apply'}
              </button>
            </div>
          </div>

          {/* ── Template 2 & 3 ── */}
          {[2, 3].map((slot) => {
            const tpl = templates[slot - 2];
            const isPending = pending?.slot === slot;
            const isActive = tpl && activeUrl === tpl.url;
            const isUploading = uploading === slot;

            return (
              <div key={slot} style={card(isActive)}>
                {isActive && <ActiveBadge />}
                <h3 style={{ marginBottom: '0.75rem' }}>
                  Template {slot}{tpl ? ` — ${tpl.type === 'video' ? '🎬' : '🖼'} Custom Background` : ''}
                </h3>

                <div style={{ height: '120px', borderRadius: '8px', overflow: 'hidden', background: '#0a0a0f', marginBottom: '1rem' }}>
                  <Preview template={tpl} pending={isPending ? pending : null} />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Upload / Replace */}
                  {!isPending && (
                    <label style={{ ...btn(false), cursor: 'pointer' }}>
                      <input type="file" accept="image/*,video/*" onChange={(e) => selectFile(e, slot)} style={{ display: 'none' }} />
                      <Upload size={14} /> {tpl ? 'Replace' : 'Upload'}
                    </label>
                  )}

                  {/* Save pending upload */}
                  {isPending && (
                    <>
                      <button style={btn(true)} onClick={() => saveTemplate(slot)} disabled={isUploading}>
                        <Check size={14} /> {isUploading ? 'Saving…' : `Save as Template ${slot}`}
                      </button>
                      <button onClick={cancelPending} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '0.85rem' }}>
                        Cancel
                      </button>
                    </>
                  )}

                  {/* Apply saved template */}
                  {tpl && !isPending && (
                    <button style={btn(false)} onClick={() => applyTemplate(tpl)}>
                      <Check size={14} /> {isActive ? 'Applied' : 'Apply'}
                    </button>
                  )}

                  {/* Delete saved template */}
                  {tpl && !isPending && (
                    <button onClick={() => deleteTemplate(slot)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Trash2 size={14} /> Delete
                    </button>
                  )}
                </div>

                {isPending && !isUploading && (
                  <p style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Preview shown — click "Save as Template {slot}" to upload to Cloudflare R2.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Images and videos are stored on Cloudflare R2. Max file size is limited by the worker (≈100 MB). For larger videos, compress before uploading.
        </p>
      </section>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
      <section className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h2 style={{ margin: 0, marginBottom: '0.5rem' }}>User Management</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Total Users: <strong>{users.length}</strong></p>
          </div>
          <button
            onClick={fetchUsers}
            disabled={usersLoading}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: 10,
              cursor: 'pointer',
              color: '#3b82f6',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {usersLoading ? <Loader size={16} /> : <RotateCcw size={16} />}
            Refresh
          </button>
        </div>

        {usersLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
            <Loader size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem', display: 'block' }} />
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px dashed rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>
            No users found
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Name</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Email</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Type</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Created</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, idx) => (
                  <tr key={u.id} style={{ borderBottom: idx !== users.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <td style={{ padding: '1rem', fontWeight: 500 }}>{u.name || 'N/A'}</td>
                    <td style={{ padding: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Mail size={13} /> {u.email}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ padding: '0.25rem 0.6rem', background: u.loginType === 'email' ? 'rgba(99,102,241,0.15)' : 'rgba(52,211,153,0.15)', color: u.loginType === 'email' ? '#818cf8' : '#34d399', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize' }}>
                        {u.loginType === 'email' ? 'Email' : 'Google'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Calendar size={13} /> {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleResetCredits(u.id, u.email)}
                          disabled={resetting === u.id}
                          title="Reset daily credits"
                          style={{ padding: '0.4rem 0.8rem', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 6, cursor: 'pointer', color: '#818cf8', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', opacity: resetting === u.id ? 0.6 : 1 }}
                        >
                          {resetting === u.id ? <Loader size={12} /> : <RotateCcw size={12} />}
                          Reset
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id, u.email)}
                          disabled={deleting === u.id}
                          title="Delete user and all data"
                          style={{ padding: '0.4rem 0.8rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, cursor: 'pointer', color: '#f87171', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', opacity: deleting === u.id ? 0.6 : 1 }}
                        >
                          {deleting === u.id ? <Loader size={12} /> : <Trash2 size={12} />}
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <AlertTriangle size={16} color="#818cf8" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: '#818cf8' }}>Admin Functions:</strong> Use "Reset" to give a user new daily credits. Use "Delete" to permanently remove a user and all their data.
          </div>
        </div>
      </section>
      )}
    </div>
  );
};

function ActiveBadge() {
  return (
    <span style={{
      position: 'absolute', top: '0.75rem', right: '0.75rem',
      background: '#22c55e', color: '#fff',
      fontSize: '0.7rem', padding: '0.15rem 0.5rem',
      borderRadius: '999px', fontWeight: 600,
    }}>
      Active
    </span>
  );
}

export default AdminPage;

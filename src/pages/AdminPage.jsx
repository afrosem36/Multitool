import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Upload, Image as ImageIcon, Video, Check, Shield } from 'lucide-react';
import { GOOGLE_CLIENT_ID } from '../config';
import toast from 'react-hot-toast';

const ADMIN_EMAIL = 'afrosem36@gmail.com';

const GoogleLoginButton = ({ onSuccess }) => {
  const googleButtonRef = React.useRef(null);

  React.useEffect(() => {
    if (window.google && googleButtonRef.current) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => onSuccess(response.credential),
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 300,
      });
    }
  }, [onSuccess]);

  return <div ref={googleButtonRef} style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}></div>;
};

const AdminPage = () => {
  const { user, loginWithGoogle, loading } = useAuth();
  const navigate = useNavigate();
  const [background, setBackground] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('site_background');
    if (saved) {
      const parsed = JSON.parse(saved);
      setBackground(parsed);
      setPreview(parsed);
    }
  }, []);

  useEffect(() => {
    if (!loading && user && user.email !== ADMIN_EMAIL) {
      toast.error('Unauthorized access');
      navigate('/');
}
  }, [user, loading, navigate]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 3000000 * 1024) {
      toast.error('File too large (max 3GB)');
      return;
    }

    const type = file.type.startsWith('video') ? 'video' : 'image';
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview({ url: reader.result, type });
    };
    reader.readAsDataURL(file);
  };

  const handleApply = () => {
    if (!preview) return;
    
    localStorage.setItem('site_background', JSON.stringify(preview));
    setBackground(preview);
    window.dispatchEvent(new Event('storage'));
    toast.success('Background applied successfully');
  };

  if (loading) return <div className="admin-loading">Loading...</div>;

  if (!user) {
    return (
      <div className="admin-auth-gate" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', maxWidth: '450px' }}>
          <Shield size={48} style={{ margin: '0 auto 1.5rem', color: 'var(--text-primary)' }} />
          <h2>Admin Authentication</h2>
          <p style={{ margin: '1rem 0', color: 'var(--text-secondary)' }}>Access restricted to authorized administrators. Please sign in with your Google account.</p>
          <GoogleLoginButton 
            onSuccess={async (token) => {
              const result = await loginWithGoogle(token);
              if (!result.success) {
                toast.error(result.error || 'Login failed');
              }
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1>Admin Control Panel</h1>
        <p>Manage global site appearance</p>
      </header>

      <section className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <ImageIcon size={24} /> Background Control
        </h2>

        <div className="uploader-area" style={{ 
          border: '2px dashed var(--border-color)', 
          borderRadius: '12px', 
          padding: '2rem', 
          textAlign: 'center',
          background: 'rgba(255,255,255,0.03)',
          marginBottom: '1.5rem'
        }}>
          <input 
            type="file" 
            id="bg-upload" 
            accept="image/*,video/*" 
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <label htmlFor="bg-upload" style={{ cursor: 'pointer', display: 'block' }}>
            <Upload size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>Click to upload Image or Video</p>
            <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Supports JPG, PNG, GIF, MP4, WEBM</span>
          </label>
        </div>

        {preview && (
          <div className="preview-container" style={{ marginBottom: '1.5rem' }}>
            <h3>Preview</h3>
            <div style={{ 
              width: '100%', 
              height: '200px', 
              borderRadius: '8px', 
              overflow: 'hidden', 
              marginTop: '1rem',
              position: 'relative',
              background: '#000'
            }}>
              {preview.type === 'video' ? (
                <video src={preview.url} autoPlay muted loop style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <img src={preview.url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
            <button 
              className="btn-primary" 
              onClick={handleApply}
              style={{ marginTop: '1rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              <Check size={18} /> Apply Background
            </button>
          </div>
        )}

        {background && (
          <div className="current-config" style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
            <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>Current: <strong>{background.type}</strong></p>
            <button 
              onClick={() => {
                localStorage.removeItem('site_background');
                setBackground(null);
                setPreview(null);
                window.dispatchEvent(new Event('storage'));
                toast.success('Background reset to default');
              }}
              style={{ 
                background: 'none', 
                border: 'none', 
                color: '#ff4444', 
                cursor: 'pointer', 
                fontSize: '0.8rem',
                padding: '0.5rem 0'
              }}
            >
              Reset to default
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminPage;

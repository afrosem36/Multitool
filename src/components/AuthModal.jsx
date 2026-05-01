import React, { useState } from 'react';
import { X, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GOOGLE_CLIENT_ID } from '../config';
import '../pages/AuthStyles.css';

const GoogleLoginButton = ({ onSuccess, isLoading }) => {
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
        text: 'continue_with',
        shape: 'rectangular',
      });
    }
  }, [onSuccess]);

  return (
    <div style={{ width: '100%', marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0' }}>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
        <span style={{ padding: '0 10px', fontSize: '0.85rem', color: '#94a3b8' }}>OR</span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
      </div>
      <div ref={googleButtonRef} style={{ display: 'flex', justifyContent: 'center' }}></div>
    </div>
  );
};

export default function AuthModal({ isOpen, onClose, onSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, register, loginWithGoogle } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!isLogin && password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    setIsLoading(true);
    const result = isLogin 
      ? await login(email, password)
      : await register(email, password);
    setIsLoading(false);
    
    if (result.success) {
      onSuccess?.();
      onClose();
    } else {
      setError(result.error);
    }
  };

  const handleGoogleSuccess = async (token) => {
    setError('');
    setIsLoading(true);
    const result = await loginWithGoogle(token);
    setIsLoading(false);
    if (result.success) {
      onSuccess?.();
      onClose();
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="ide-modal-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
      <div className="ide-modal" onClick={e => e.stopPropagation()} style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{isLogin ? 'Login to Deploy' : 'Create Account'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.4rem' }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
              <input 
                className="ide-input"
                type="email" 
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ paddingLeft: '2.5rem', marginBottom: 0 }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.4rem' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
              <input 
                className="ide-input"
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingLeft: '2.5rem', marginBottom: 0 }}
              />
            </div>
          </div>

          {!isLogin && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.4rem' }}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <ShieldCheck size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                <input 
                  className="ide-input"
                  type="password" 
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={{ paddingLeft: '2.5rem', marginBottom: 0 }}
                />
              </div>
            </div>
          )}

          <button type="submit" className="ide-btn ide-btn-primary" disabled={isLoading} style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}>
            {isLoading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')} <ArrowRight size={16} style={{ marginLeft: '0.5rem' }} />
          </button>
        </form>

        <GoogleLoginButton onSuccess={handleGoogleSuccess} isLoading={isLoading} />

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
          {isLogin ? (
            <p>Don't have an account? <span onClick={() => setIsLogin(false)} style={{ color: '#6366f1', cursor: 'pointer', fontWeight: 600 }}>Sign up</span></p>
          ) : (
            <p>Already have an account? <span onClick={() => setIsLogin(true)} style={{ color: '#6366f1', cursor: 'pointer', fontWeight: 600 }}>Log in</span></p>
          )}
        </div>
      </div>
    </div>
  );
}

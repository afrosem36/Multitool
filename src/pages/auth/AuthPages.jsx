import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { GOOGLE_CLIENT_ID } from '../../config';
import '../styles/AuthStyles.css';

const GoogleLoginButton = ({ onSuccess, onError, isLoading }) => {
  const googleButtonRef = React.useRef(null);

  React.useEffect(() => {
    if (window.google && googleButtonRef.current && !window.googleInitialized) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => onSuccess(response.credential),
      });
      window.googleInitialized = true;
    }

    if (window.google && googleButtonRef.current) {
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 250,
        text: 'continue_with',
        shape: 'rectangular',
      });
    }
  }, [onSuccess]);

  return (
    <div style={{ width: '100%', marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
        <span style={{ padding: '0 10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>OR</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
      </div>
      <div ref={googleButtonRef} style={{ display: 'flex', justifyContent: 'center' }}></div>
    </div>
  );
};

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const result = await login(email, password);
    setIsLoading(false);
    
    if (result.success) {
      const from = location.state?.from || '/';
      navigate(from);
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="auth-container animate-fade-in">
      <div className="auth-card glass-panel">
        <div className="auth-header text-center">
          <div className="auth-icon-wrapper mx-auto">
            <Lock size={32} className="text-gradient" />
          </div>
          <h2>Welcome Back</h2>
          <p>Login to access your personalized dashboard and secure links.</p>
        </div>

        {error && (
          <div className="auth-error">
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Email Address</label>
            <div className="input-with-icon">
              <Mail size={18} className="input-icon" />
              <input 
                type="email" 
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Password</label>
            <div className="input-with-icon">
              <ShieldCheck size={18} className="input-icon" />
              <input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
              <Link to="/forgot-password" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Forgot your password?
              </Link>
            </div>
          </div>

          <button type="submit" className="btn-primary auth-submit" disabled={isLoading}>
            {isLoading ? 'Signing In...' : 'Sign In'} <ArrowRight size={18} />
          </button>
        </form>

        <GoogleLoginButton 
          onSuccess={async (token) => {
            setError('');
            setIsLoading(true);
            const result = await loginWithGoogle(token);
            setIsLoading(false);
            if (result.success) {
              const from = location.state?.from || '/';
              navigate(from);
            } else {
              setError(result.error);
            }
          }}
          isLoading={isLoading}
        />

        <div className="auth-footer text-center">
          <p>Don't have an account? <Link to="/signup" state={location.state} className="text-gradient font-bold">Sign up here</Link></p>
        </div>
      </div>
    </div>
  );
};

export const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }
    
    if (password.length < 6) {
      return setError('Password must be at least 6 characters');
    }

    setIsLoading(true);
    const result = await register(email, password);
    setIsLoading(false);
    
    if (result.success) {
      const from = location.state?.from || '/';
      navigate(from);
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="auth-container animate-fade-in">
      <div className="auth-card glass-panel">
        <div className="auth-header text-center">
          <div className="auth-icon-wrapper mx-auto">
            <ShieldCheck size={32} className="text-gradient" />
          </div>
          <h2>Create Account</h2>
          <p>Sign up to start sharing securely and tracking analytics.</p>
        </div>

        {error && (
          <div className="auth-error">
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Email Address</label>
            <div className="input-with-icon">
              <Mail size={18} className="input-icon" />
              <input 
                type="email" 
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Password</label>
            <div className="input-with-icon">
              <Lock size={18} className="input-icon" />
              <input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <div className="input-with-icon">
              <ShieldCheck size={18} className="input-icon" />
              <input 
                type="password" 
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn-primary auth-submit" disabled={isLoading}>
            {isLoading ? 'Creating Account...' : 'Sign Up'} <ArrowRight size={18} />
          </button>
        </form>

        <GoogleLoginButton 
          onSuccess={async (token) => {
            setError('');
            setIsLoading(true);
            const result = await loginWithGoogle(token);
            setIsLoading(false);
            if (result.success) {
              const from = location.state?.from || '/';
              navigate(from);
            } else {
              setError(result.error);
            }
          }}
          isLoading={isLoading}
        />

        <div className="auth-footer text-center">
          <p>Already have an account? <Link to="/login" state={location.state} className="text-gradient font-bold">Log in here</Link></p>
        </div>
      </div>
    </div>
  );
};

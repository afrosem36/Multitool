import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../config';
import './AuthStyles.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      if (!res.ok) throw new Error('Failed to send reset link');
      
      setIsSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container animate-fade-in">
      <div className="auth-card glass-panel">
        <div className="auth-header text-center">
          <div className="auth-icon-wrapper mx-auto">
            <Mail size={32} className="text-gradient" />
          </div>
          <h2>Reset Password</h2>
          <p>Enter your email and we'll send you a link to reset your password.</p>
        </div>

        {error && (
          <div className="auth-error">
            <p>{error}</p>
          </div>
        )}

        {isSent ? (
          <div className="text-center" style={{ padding: '2rem 0' }}>
            <div style={{ color: 'var(--success-color)', marginBottom: '1rem' }}>
              <CheckCircle2 size={48} style={{ margin: '0 auto' }} />
            </div>
            <p style={{ color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '0.5rem' }}>Link Sent!</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              If that email exists a reset link has been sent. Please check your inbox and spam folder.
            </p>
            <Link to="/login" className="btn-primary" style={{ marginTop: '2rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              Back to Login
            </Link>
          </div>
        ) : (
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

            <button type="submit" className="btn-primary auth-submit" disabled={isLoading}>
              {isLoading ? <><Loader2 size={18} className="spin" /> Sending...</> : <>{'Send Reset Link'} <ArrowRight size={18} /></>}
            </button>
            
            <div className="auth-footer text-center" style={{ marginTop: '1.5rem' }}>
              <Link to="/login" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

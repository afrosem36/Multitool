import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, ShieldCheck, ArrowRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { API_BASE_URL } from '../../config';
import '../styles/AuthStyles.css';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setIsValidating(false);
      setError('Missing reset token');
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/verify-reset-token/${token}`);
        const data = await res.json();
        if (data.valid) {
          setIsValid(true);
        } else {
          setError(data.error || 'Invalid or expired token');
        }
      } catch (err) {
        setError('Failed to verify token');
      } finally {
        setIsValidating(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      return setError('Password must be at least 8 characters long');
    }

    if (newPassword !== confirmPassword) {
      return setError('Passwords do not match');
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Reset failed');

      setIsSuccess(true);
      toast.success('Password reset successfully!');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="auth-container">
        <div className="auth-card glass-panel text-center">
          <Loader2 size={40} className="spin mx-auto text-gradient" />
          <p style={{ marginTop: '1rem' }}>Verifying reset token...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container animate-fade-in">
      <div className="auth-card glass-panel">
        <div className="auth-header text-center">
          <div className="auth-icon-wrapper mx-auto">
            <Lock size={32} className="text-gradient" />
          </div>
          <h2>Set New Password</h2>
          <p>Choose a strong password for your account.</p>
        </div>

        {error && (
          <div className="auth-error">
            <AlertCircle size={18} />
            <p>{error}</p>
          </div>
        )}

        {isSuccess ? (
          <div className="text-center" style={{ padding: '2rem 0' }}>
            <div style={{ color: 'var(--success-color)', marginBottom: '1rem' }}>
              <CheckCircle2 size={48} style={{ margin: '0 auto' }} />
            </div>
            <p style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>Password Reset!</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Redirecting you to login...</p>
          </div>
        ) : !isValid ? (
          <div className="text-center">
            <Link to="/forgot-password" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>
              Request a new reset link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label>New Password</label>
              <div className="input-with-icon">
                <ShieldCheck size={18} className="input-icon" />
                <input 
                  type="password" 
                  placeholder="Min. 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Confirm New Password</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input 
                  type="password" 
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary auth-submit" disabled={isLoading}>
              {isLoading ? <><Loader2 size={18} className="spin" /> Saving...</> : <>{'Reset Password'} <ArrowRight size={18} /></>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

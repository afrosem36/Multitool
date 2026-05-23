/**
 * AI Gate Components
 * ─────────────────
 * AiLoginGate      — Full-screen overlay when user is not logged in
 * AiRateLimitBanner — Inline banner when user's hourly/total limit is hit
 * AiRateLimitBadge  — Small pill showing remaining credits
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Clock, Lock, Sparkles, Zap, LogIn, UserPlus } from 'lucide-react';

// ── Login Gate (full overlay) ──────────────────────────────────────────────────
export function AiLoginGate({ toolName = 'this AI tool' }) {
  const location = useLocation();

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(7, 7, 15, 0.92)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: 'var(--surface-color, #0f0f1a)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        borderRadius: 20,
        padding: '2.5rem 2rem',
        maxWidth: 420, width: '100%',
        textAlign: 'center',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.1)',
      }}>
        {/* Icon */}
        <div style={{
          width: 64, height: 64,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          borderRadius: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.5rem',
          boxShadow: '0 12px 32px rgba(99,102,241,0.35)',
        }}>
          <Lock size={28} color="white" />
        </div>

        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.4rem', fontWeight: 800 }}>
          Login Required
        </h2>
        <p style={{
          color: 'var(--text-secondary)', fontSize: '0.9rem',
          margin: '0 0 0.75rem', lineHeight: 1.6,
        }}>
          You need an account to use <strong style={{ color: 'var(--text-primary)' }}>{toolName}</strong>.
          Sign in to get access with your personal usage credits.
        </p>

        {/* Credits info */}
        <div style={{
          background: 'rgba(99,102,241,0.06)',
          border: '1px solid rgba(99,102,241,0.15)',
          borderRadius: 10, padding: '0.75rem 1rem',
          margin: '0 0 1.5rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          justifyContent: 'center',
        }}>
          <Sparkles size={14} color="#a78bfa" />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Free account · Personal usage credits included
          </span>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <Link
            to="/login"
            state={{ from: location.pathname }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              padding: '0.85rem 1.5rem',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white', borderRadius: 10,
              fontWeight: 700, fontSize: '0.95rem',
              textDecoration: 'none',
              boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
              transition: 'opacity 0.2s',
            }}
          >
            <LogIn size={18} /> Sign In
          </Link>
          <Link
            to="/signup"
            state={{ from: location.pathname }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              padding: '0.85rem 1.5rem',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-primary)', borderRadius: 10,
              fontWeight: 600, fontSize: '0.95rem',
              textDecoration: 'none',
              transition: 'background 0.2s',
            }}
          >
            <UserPlus size={18} /> Create Free Account
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Rate Limit Banner (inline, when limit hit) ─────────────────────────────────
export function AiRateLimitBanner({ hook }) {
  const { allowed, isLoggedIn, resetIn, config, used, maxCalls } = hook;

  // Not logged in — gate handles this, don't show banner
  if (!isLoggedIn) return null;
  // Still has credits — nothing to show
  if (allowed) return null;

  const isPersistent = config?.windowMs === null;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
      background: 'rgba(239,68,68,0.07)',
      border: '1px solid rgba(239,68,68,0.2)',
      borderRadius: 12, padding: '0.85rem 1.1rem',
      marginBottom: '1rem',
    }}>
      <Clock size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#ef4444', marginBottom: 2 }}>
          {isPersistent ? 'Limit reached' : 'Hourly limit reached'}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          You've used {used}/{maxCalls} {config?.label || 'credits'}.
          {isPersistent
            ? ' You have reached your total limit for this tool.'
            : resetIn
              ? <> Resets in <strong style={{ color: 'var(--text-primary)' }}>{resetIn}</strong>.</>
              : ' Your limit resets soon.'}
        </div>
      </div>
    </div>
  );
}

// ── Credits Badge (small pill showing remaining) ───────────────────────────────
export function AiRateLimitBadge({ hook }) {
  const { isUnlimited, isLoggedIn, remaining, used, maxCalls, config } = hook;

  if (!isLoggedIn) return null;

  if (isUnlimited) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
        fontSize: '0.72rem', fontWeight: 600, color: '#34d399',
        background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
        borderRadius: 20, padding: '0.22rem 0.6rem',
      }}>
        <Zap size={10} /> Unlimited
      </span>
    );
  }

  const color = remaining === 0 ? '#ef4444' : remaining <= Math.ceil(maxCalls * 0.3) ? '#f59e0b' : '#22c55e';
  const windowLabel = config?.windowMs === null ? 'total' : 'this hour';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
      fontSize: '0.72rem', fontWeight: 600, color,
      background: `${color}14`, border: `1px solid ${color}33`,
      borderRadius: 20, padding: '0.22rem 0.6rem',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {remaining === 0
        ? `0/${maxCalls} left ${windowLabel}`
        : `${remaining}/${maxCalls} left ${windowLabel}`}
    </span>
  );
}

export default AiLoginGate;

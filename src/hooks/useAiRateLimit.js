/**
 * useAiRateLimit — Per-user AI tool rate limiter (client-side, localStorage-backed)
 *
 * Tool limits (logged-in users only — guests are blocked entirely):
 *   audio-transcription  → 10 calls  / day  (rolling 24h window)
 *   text-to-sql          → 10 prompts / day  (rolling 24h window)
 *   report-analyzer      → 5  reports / day  (rolling 24h window)
 *   dashboard-maker      → 3  dashboards total (no reset — persistent)
 *
 * afrosem36@gmail.com   → unlimited on every tool
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const DAY_MS = 24 * 60 * 60 * 1000; // 24 hours in ms

// ── Tool configurations ────────────────────────────────────────────────────────
export const AI_TOOL_CONFIGS = {
  'audio-transcription': { max: 10, windowMs: DAY_MS, label: 'Audio Transcriptions', resetLabel: '24 hours' },
  'text-to-sql':         { max: 10, windowMs: DAY_MS, label: 'SQL Generations',      resetLabel: '24 hours' },
  'report-analyzer':     { max: 5,  windowMs: DAY_MS, label: 'Report Analyses',      resetLabel: '24 hours' },
  'dashboard-maker':     { max: 3,  windowMs: null,            label: 'Dashboards',           resetLabel: 'never (total limit)' },
};

const STORAGE_KEY  = 'ai_user_limits_v2';
const ADMIN_EMAIL  = 'afrosem36@gmail.com';

// ── Storage helpers ────────────────────────────────────────────────────────────
function getStore() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
function saveStore(store) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch {}
}

function storeKey(email, toolId) {
  return `${email.toLowerCase()}:${toolId}`;
}

/**
 * Get call timestamps that are still within the rolling window.
 * If windowMs is null (dashboard-maker), return ALL timestamps (no expiry).
 */
function getValidCalls(email, toolId) {
  const config = AI_TOOL_CONFIGS[toolId];
  if (!config) return [];

  const store = getStore();
  const key   = storeKey(email, toolId);
  const calls = store[key] || [];

  if (config.windowMs === null) {
    // Total cap — never expires
    return calls;
  }

  const now  = Date.now();
  return calls.filter(ts => now - ts < config.windowMs);
}

/** ms until the oldest call falls out of the rolling window */
function msUntilReset(calls, windowMs) {
  if (!calls.length || windowMs === null) return 0;
  const oldest = Math.min(...calls);
  return Math.max(0, windowMs - (Date.now() - oldest));
}

function formatCountdown(ms) {
  if (ms <= 0) return '';
  const totalSec = Math.ceil(ms / 1000);
  const min      = Math.floor(totalSec / 60);
  const sec      = totalSec % 60;
  if (min === 0) return `${sec}s`;
  if (sec === 0) return `${min} min`;
  return `${min}m ${sec}s`;
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useAiRateLimit(toolId) {
  const { user } = useAuth();
  const config   = AI_TOOL_CONFIGS[toolId] || { max: 3, windowMs: 60 * 60 * 1000 };

  const isLoggedIn  = !!user;
  const isAdmin     = isLoggedIn && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const isUnlimited = isAdmin;

  const [calls,     setCalls]     = useState([]);
  const [countdown, setCountdown] = useState('');

  // Refresh every second for the countdown timer
  useEffect(() => {
    if (!isLoggedIn || isUnlimited) return;

    const tick = () => {
      const fresh = getValidCalls(user.email, toolId);
      setCalls(fresh);
      const ms = msUntilReset(fresh, config.windowMs);
      setCountdown(ms > 0 ? formatCountdown(ms) : '');
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [toolId, isLoggedIn, isUnlimited, user?.email]);

  const remaining = isUnlimited
    ? Infinity
    : isLoggedIn
      ? Math.max(0, config.max - calls.length)
      : 0;

  // allowed = logged in AND (unlimited OR has remaining quota)
  const allowed = isLoggedIn && (isUnlimited || remaining > 0);

  const resetIn = isUnlimited || config.windowMs === null
    ? ''
    : countdown;

  /**
   * Call this when the user triggers an AI action.
   * Returns true if the action is allowed; false if blocked.
   */
  const consume = useCallback(() => {
    if (!isLoggedIn) return false;
    if (isUnlimited) return true;

    const fresh = getValidCalls(user.email, toolId);
    if (fresh.length >= config.max) return false;

    const updated = [...fresh, Date.now()];
    const store   = getStore();
    store[storeKey(user.email, toolId)] = updated;
    saveStore(store);
    setCalls(updated);
    return true;
  }, [toolId, isLoggedIn, isUnlimited, user?.email, config.max]);

  /** How many calls the user has made (for display) */
  const used = isUnlimited ? 0 : calls.length;

  return {
    // State
    isLoggedIn,
    isUnlimited,
    allowed,
    remaining,
    used,
    resetIn,
    maxCalls: config.max,
    config,
    // Action
    consume,
  };
}

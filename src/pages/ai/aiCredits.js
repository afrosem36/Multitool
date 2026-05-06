// ─── AI Chat Credits System ──────────────────────────────────────────────────
// Replaces simple daily limit with a flexible credit-based system
// Credits reset daily at midnight, with different costs for different operations

export const CREDIT_COSTS = {
  TEXT_MESSAGE: 1,
  IMAGE_GENERATION: 3,
  AUDIO_TRANSCRIPTION: 2,
};

export const DAILY_CREDITS = 50;
export const STORAGE_CREDITS_KEY = 'ai_chat_credits';

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

export function getCredits() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_CREDITS_KEY) || '{}');
    const today = getTodayKey();
    if (!raw.date || raw.date !== today) {
      return { date: today, credits: DAILY_CREDITS, lastReset: Date.now() };
    }
    return raw;
  } catch {
    return { date: getTodayKey(), credits: DAILY_CREDITS, lastReset: Date.now() };
  }
}

export function saveCredits(state) {
  localStorage.setItem(STORAGE_CREDITS_KEY, JSON.stringify(state));
}

export function spendCredits(cost) {
  const state = getCredits();
  state.credits = Math.max(0, state.credits - cost);
  saveCredits(state);
  return state.credits;
}

export function canAfford(cost) {
  return getCredits().credits >= cost;
}

export function getResetCountdown() {
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0);

  const ms = tomorrow - now;
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);

  return {
    totalMs: ms,
    hours,
    mins,
    display: `${hours}h ${mins}m`,
  };
}

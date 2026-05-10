/**
 * DASHBOARD STORE — Zustand
 * ─────────────────────────────────────────────────────────────────────────────
 * Central state for the AI Dashboard Maker.
 * Per-user dashboard history is keyed by userId in localStorage.
 *
 * Free tier limit: 5 saved dashboards per user.
 */

import { create } from 'zustand';

const FREE_LIMIT = 5;

// Per-user storage key
const storageKey = (userId) => userId ? `adm_v3_${userId}` : 'adm_v3_guest';

function loadDashboards(userId) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) || '[]');
  } catch { return []; }
}

function saveDashboards(userId, list) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(list.slice(0, 20)));
  } catch {}
}

export const useDashboardStore = create((set, get) => ({
  // ── File / dataset state ──────────────────────────────────────────────────
  file:              null,
  rows:              [],
  headers:           [],
  analysis:          null,
  semanticOverrides: {},

  // ── Generation state ──────────────────────────────────────────────────────
  step:       'upload',     // 'upload' | 'schema' | 'generating' | 'dashboard'
  genStage:   0,
  loading:    false,

  // ── Dashboard output ──────────────────────────────────────────────────────
  dashboard:     null,
  expandedChart: null,
  showTable:     false,

  // ── User config ───────────────────────────────────────────────────────────
  userPrompt:  '',
  columnHelp:  '',
  theme:       'dark',

  // ── History (per user) ────────────────────────────────────────────────────
  recent:    [],
  userId:    null,

  // ─── Actions ──────────────────────────────────────────────────────────────

  initUser(userId) {
    const recent = loadDashboards(userId);
    set({ userId, recent });
  },

  setTheme: (theme) => set({ theme }),
  setStep:  (step)  => set({ step }),
  setGenStage: (s)  => set({ genStage: s }),
  setLoading: (b)   => set({ loading: b }),
  setExpandedChart: (c) => set({ expandedChart: c }),
  setShowTable: (b) => set({ showTable: b }),
  setUserPrompt: (v) => set({ userPrompt: v }),
  setColumnHelp: (v) => set({ columnHelp: v }),

  setFile(file, rows, headers, analysis) {
    set({ file, rows, headers, analysis, semanticOverrides: {}, step: 'schema' });
  },

  setSemanticOverride(col, type) {
    set(s => ({ semanticOverrides: { ...s.semanticOverrides, [col]: type } }));
  },

  setDashboard(dashboard) {
    set({ dashboard, step: 'dashboard' });
  },

  // Save a completed dashboard to per-user history
  saveDashboardEntry(entry) {
    const { userId, recent } = get();
    const updated = [entry, ...recent.filter(d => d.id !== entry.id)].slice(0, 20);
    saveDashboards(userId, updated);
    set({ recent: updated });
  },

  deleteDashboard(id) {
    const { userId, recent } = get();
    const updated = recent.filter(d => d.id !== id);
    saveDashboards(userId, updated);
    set({ recent: updated });
  },

  // Check if free user has hit the dashboard limit
  isAtLimit() {
    const { recent, userId } = get();
    // In a real system, check from backend. For now use localStorage count.
    return !userId && recent.length >= FREE_LIMIT;
  },

  dashboardsUsed() {
    return get().recent.length;
  },

  resetAll() {
    set({
      file: null, rows: [], headers: [], analysis: null,
      semanticOverrides: {}, step: 'upload', dashboard: null,
      userPrompt: '', columnHelp: '', genStage: 0,
      showTable: false, expandedChart: null,
    });
  },
}));

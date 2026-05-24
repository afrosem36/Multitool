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

// AI plan cache (keyed by file signature) — survives page reloads
const PLAN_CACHE_KEY = 'adm_plan_cache_v1';
const PLAN_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
const PLAN_CACHE_MAX = 12;

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

function loadPlanCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(PLAN_CACHE_KEY) || '{}');
    const now = Date.now();
    const cleaned = {};
    Object.entries(raw).forEach(([k, v]) => {
      if (v && (now - (v.t || 0)) < PLAN_CACHE_TTL) cleaned[k] = v;
    });
    return cleaned;
  } catch { return {}; }
}

function savePlanCache(cache) {
  try {
    // Trim to MAX entries (drop oldest)
    const entries = Object.entries(cache).sort(([, a], [, b]) => (b.t || 0) - (a.t || 0));
    const trimmed = Object.fromEntries(entries.slice(0, PLAN_CACHE_MAX));
    localStorage.setItem(PLAN_CACHE_KEY, JSON.stringify(trimmed));
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
  activeTabId:   null,      // currently selected tab in multi-tab dashboard

  // ── Share state (UI flag only — link/loading/error live in the modal) ─────
  shareModalOpen: false,

  // ── User config ───────────────────────────────────────────────────────────
  userPrompt:  '',
  columnHelp:  '',
  theme:       'dark',

  // ── History (per user) ────────────────────────────────────────────────────
  recent:    [],
  userId:    null,

  // ── AI plan cache (signature → { plan, source, t }) ──────────────────────
  planCache: loadPlanCache(),

  // ─── Actions ──────────────────────────────────────────────────────────────

  initUser(userId) {
    if (get().userId === userId) return; // no-op if already initialized for this user
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
  setActiveTabId: (id) => set({ activeTabId: id }),

  setFile(file, rows, headers, analysis) {
    set({ file, rows, headers, analysis, semanticOverrides: {}, step: 'schema' });
  },

  setSemanticOverride(col, type) {
    set(s => ({ semanticOverrides: { ...s.semanticOverrides, [col]: type } }));
  },

  setDashboard(dashboard) {
    // Auto-select first tab when dashboard is set
    const firstTabId = dashboard?.plan?.tabs?.[0]?.id || null;
    set({ dashboard, step: 'dashboard', activeTabId: firstTabId });
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

  // ── AI Plan caching ──────────────────────────────────────────────────────
  getCachedPlan(signature) {
    const cache = get().planCache || {};
    const entry = cache[signature];
    if (!entry) return null;
    if (Date.now() - (entry.t || 0) > PLAN_CACHE_TTL) return null;
    return entry;
  },

  setCachedPlan(signature, plan, source) {
    const cache = { ...(get().planCache || {}), [signature]: { plan, source, t: Date.now() } };
    savePlanCache(cache);
    set({ planCache: cache });
  },

  clearPlanCache() {
    try { localStorage.removeItem(PLAN_CACHE_KEY); } catch {}
    set({ planCache: {} });
  },

  // ── Share modal ──────────────────────────────────────────────────────────
  openShareModal:  () => set({ shareModalOpen: true  }),
  closeShareModal: () => set({ shareModalOpen: false }),

  // Check if free user has hit the dashboard limit
  isAtLimit() {
    const { recent, userId } = get();
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
      showTable: false, expandedChart: null, activeTabId: null,
      shareModalOpen: false,
    });
  },
}));

export const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
export const WORKER_SECRET = import.meta.env.VITE_WORKER_SECRET || "";
export const TURNSTILE_SITE_KEY =
  import.meta.env.VITE_TURNSTILE_SITE_KEY || "";

export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export const FEATURE_FLAGS = {
  enableTranscription: true,
  enableTools: true,
  enableSharing: true,
  enableAnalytics: true,
  ENABLE_FILE_SHARING: true,
  ENABLE_SEO_ANALYZER: true,
  ENABLE_HEIC_CONVERTER: true,
  ENABLE_TIME_CONVERTER: true,
  ENABLE_SEO_HARDENING: true
};

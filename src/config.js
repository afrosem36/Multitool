export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export const FEATURE_FLAGS = {
  enableTools: true,
  enableSharing: true,
  enableAnalytics: true
};

export const FEATURE_FLAGS = {
  ENABLE_FILE_SHARING: true,
  ENABLE_HEIC_CONVERTER: true,
  ENABLE_SEO_ANALYZER: true,
  ENABLE_TIME_CONVERTER: true,
  ENABLE_SEO_HARDENING: true
};

export const ADS_CONFIG = {
  enabled: import.meta.env.VITE_ENABLE_ADS !== 'false',
  client: import.meta.env.VITE_ADSENSE_CLIENT || 'ca-pub-7503234817085638',
  slots: {
    top: import.meta.env.VITE_ADSENSE_SLOT_TOP || '',
    sidebar: import.meta.env.VITE_ADSENSE_SLOT_SIDEBAR || '',
    belowTool: import.meta.env.VITE_ADSENSE_SLOT_BELOW_TOOL || '',
    belowToolMobile: import.meta.env.VITE_ADSENSE_SLOT_MOBILE || '',
    footer: import.meta.env.VITE_ADSENSE_SLOT_FOOTER || '',
  },
};

export const GOOGLE_CLIENT_ID = "710387274824-2dhqh5ghh02kh68i08na79vn9k3d90bv.apps.googleusercontent.com";

export const API_BASE_URL = "https://multi-tool-backend.multitoolhub-api.workers.dev";

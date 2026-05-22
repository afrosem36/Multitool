// ─── Speed Units ──────────────────────────────────────────────────────────────

export const SPEED_UNITS = ['Mbps', 'MB/s', 'Kbps', 'KB/s', 'Gbps', 'GB/s'];

// ─── Test Phase Definitions ───────────────────────────────────────────────────

export const TEST_PHASES = [
  { key: 'ping',     label: 'Latency',  step: 1 },
  { key: 'download', label: 'Download', step: 2 },
  { key: 'upload',   label: 'Upload',   step: 3 },
  { key: 'done',     label: 'Complete', step: 4 },
];

// ─── Download Test Endpoints ──────────────────────────────────────────────────

export const DOWNLOAD_URLS = [
  'https://speed.cloudflare.com/__down?bytes=25000000',
  'https://speed.cloudflare.com/__down?bytes=10000000',
];

// ─── Upload Test Endpoints ────────────────────────────────────────────────────

export const UPLOAD_URLS = [
  'https://speed.cloudflare.com/__up',
  'https://httpbin.org/post',
];

// ─── Ping Test Endpoints ──────────────────────────────────────────────────────

export const PING_URLS = [
  'https://www.google.com/favicon.ico',
  'https://www.cloudflare.com/favicon.ico',
  'https://api.github.com',
];

// ─── IP Info Endpoint ─────────────────────────────────────────────────────────

export const IP_INFO_URL = 'https://ipapi.co/json/';

// ─── Speed History ────────────────────────────────────────────────────────────

export const MAX_HISTORY_POINTS = 60;
export const HISTORY_INTERVAL_MS = 150;

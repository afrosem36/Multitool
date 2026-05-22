// ─── Speed Unit Conversion ────────────────────────────────────────────────────

/**
 * Convert raw bits-per-second to the given display unit.
 * @param {number} bps - Raw speed in bits per second
 * @param {string} unit - Target unit ('Mbps', 'MB/s', 'Kbps', etc.)
 * @returns {string} Formatted speed value
 */
export function convertSpeed(bps, unit) {
  const map = {
    Mbps:   bps / 1e6,
    'MB/s': bps / 8e6,
    Kbps:   bps / 1e3,
    'KB/s': bps / 8e3,
    Gbps:   bps / 1e9,
    'GB/s': bps / 8e9,
  };
  const v = map[unit] ?? map.Mbps;
  return v >= 100 ? v.toFixed(1) : v.toFixed(2);
}

// ─── Speed Quality Classification ────────────────────────────────────────────

/**
 * Get a quality label and colors for a given speed in Mbps.
 * @param {number} mbps - Speed in megabits per second
 * @returns {{ label: string, color: string, bg: string }}
 */
export function qualityOf(mbps) {
  if (mbps >= 100) return { label: 'Excellent', color: '#22d3ee', bg: 'rgba(34,211,238,0.12)' };
  if (mbps >= 25)  return { label: 'Very Good', color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
  if (mbps >= 5)   return { label: 'Good',      color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' };
  if (mbps >= 1)   return { label: 'Fair',      color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
  return             { label: 'Poor',      color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
}

// ─── Ping/Jitter/Packet-loss Quality ─────────────────────────────────────────

/**
 * Classify ping latency.
 * @param {number} ms
 * @returns {{ c: string, t: string }}
 */
export function pingQuality(ms) {
  if (ms < 20) return { c: '#10b981', t: 'Excellent' };
  if (ms < 60) return { c: '#f59e0b', t: 'Good' };
  return         { c: '#ef4444', t: 'High' };
}

/**
 * Classify jitter.
 * @param {number} ms
 * @returns {{ c: string, t: string }}
 */
export function jitterQuality(ms) {
  if (ms < 10) return { c: '#10b981', t: 'Stable' };
  if (ms < 30) return { c: '#f59e0b', t: 'Fair' };
  return         { c: '#ef4444', t: 'Unstable' };
}

/**
 * Classify packet loss percentage.
 * @param {number} pct
 * @returns {{ c: string, t: string }}
 */
export function packetLossQuality(pct) {
  if (pct === 0) return { c: '#10b981', t: 'None' };
  if (pct < 2)   return { c: '#f59e0b', t: 'Low' };
  return           { c: '#ef4444', t: 'High' };
}

// ─── Gauge geometry helpers ───────────────────────────────────────────────────

/**
 * Convert a polar angle in degrees to SVG {x, y} coordinates.
 * @param {number} deg - Angle in degrees
 * @param {number} radius
 * @param {number} cx - Centre X
 * @param {number} cy - Centre Y
 */
export function polarToXY(deg, radius, cx, cy) {
  const rad = (deg * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

/**
 * Build an SVG arc path string.
 */
export function buildArcPath(deg1, deg2, radius, cx, cy) {
  const s = polarToXY(deg1, radius, cx, cy);
  const e = polarToXY(deg2, radius, cx, cy);
  const large = deg2 - deg1 > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
}

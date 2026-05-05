// Redirect / popup ad trigger — strict UX controls.
// At most one trigger per COOLDOWN_MS window, tracked in sessionStorage.
// No auto-load. No background triggers. No repeated fires on rapid clicks.

const COOLDOWN_MS = 120_000; // 2 minutes between allowed redirects
const STORAGE_KEY = 'mt_ad_last_ts';
const SCRIPT_ID   = 'quge5-ad-tag';

export function triggerAd() {
  const now  = Date.now();
  const last = parseInt(sessionStorage.getItem(STORAGE_KEY) || '0', 10);

  // Cooldown not elapsed — abort silently
  if (now - last < COOLDOWN_MS) return;

  // Record timestamp before injecting so rapid double-clicks are safe
  sessionStorage.setItem(STORAGE_KEY, String(now));

  // Remove any previous instance — prevents script accumulation in <head>
  document.getElementById(SCRIPT_ID)?.remove();

  const s = document.createElement('script');
  s.id  = SCRIPT_ID;
  s.src = 'https://quge5.com/88/tag.min.js';
  s.setAttribute('data-zone', '236446');
  s.setAttribute('data-cfasync', 'false');
  s.async = true;
  document.head.appendChild(s);
}

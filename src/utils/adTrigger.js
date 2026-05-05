// Ad trigger utility — fires at most once per COOLDOWN_MS window.
// Controlled by sessionStorage so it resets when the tab closes.

const COOLDOWN_MS = 60_000; // 60 s between allowed triggers
const STORAGE_KEY = 'mt_ad_last_ts';
const SCRIPT_ID   = 'quge5-ad-tag';

export function triggerAd() {
  const now  = Date.now();
  const last = parseInt(sessionStorage.getItem(STORAGE_KEY) || '0', 10);

  // Still within cooldown — skip silently
  if (now - last < COOLDOWN_MS) return;

  // Record this trigger timestamp before doing anything else
  sessionStorage.setItem(STORAGE_KEY, String(now));

  // Remove any previous script instance so the network script re-executes
  document.getElementById(SCRIPT_ID)?.remove();

  const s = document.createElement('script');
  s.id  = SCRIPT_ID;
  s.src = 'https://quge5.com/88/tag.min.js';
  s.setAttribute('data-zone', '236446');
  s.setAttribute('data-cfasync', 'false');
  s.async = true;
  document.head.appendChild(s);
}

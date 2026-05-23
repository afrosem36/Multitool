import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppRoutes } from './routes';
import CookieConsent from '../components/CookieConsent';
import GlobalBackground from '../components/GlobalBackground';
import SplashScreen from '../components/SplashScreen';

const SPLASH_KEY = 'mt_splash_v1';

// ─── ScrollToTop: resets scroll position on every route change ────────────────
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

// ─── Root App ─────────────────────────────────────────────────────────────────
function App() {
  // Show splash only on very first visit ever
  const [showSplash, setShowSplash] = useState(() => {
    try { return !localStorage.getItem(SPLASH_KEY); }
    catch { return false; }
  });

  const handleSplashDone = useCallback(() => {
    try { localStorage.setItem(SPLASH_KEY, '1'); } catch {}
    setShowSplash(false);
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('API URL:', import.meta.env.VITE_API_URL);
    }
  }, []);

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {/* First-visit animated splash screen */}
      {showSplash && <SplashScreen onDone={handleSplashDone} />}

      <GlobalBackground />
      <ScrollToTop />
      <AppRoutes />
      <CookieConsent />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--surface-color)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
          },
        }}
      />
    </Router>
  );
}

export default App;

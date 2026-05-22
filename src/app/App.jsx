import React, { useEffect } from 'react';
import { BrowserRouter as Router, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppRoutes } from './routes';
import CookieConsent from '../components/CookieConsent';
import GlobalBackground from '../components/GlobalBackground';

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
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('API URL:', import.meta.env.VITE_API_URL);
    }
  }, []);

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import './MobileTopBar.css';

const TITLES = {
  '/':               'Home',
  '/utilities':      'All Tools',
  '/pdf-tools':      'PDF Tools',
  '/image-tools':    'Image Tools',
  '/text-tools':     'Text Tools',
  '/calculators':    'Calculators',
  '/excel':          'Excel Tools',
  '/games':          'Games Hub',
  '/guides':         'Guides',
  '/favorites':      'Favorites',
  '/trending':       'Trending',
  '/dashboard':      'Dashboard',
  '/analytics':      'Analytics',
  '/contact-us':     'Contact',
  '/privacy-policy': 'Privacy Policy',
  '/terms':          'Terms of Service',
};

function deriveTitle(pathname) {
  const last = pathname.split('/').filter(Boolean).pop() || '';
  return last.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function MobileTopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const title = TITLES[location.pathname] || deriveTitle(location.pathname);

  return (
    <header className="mobile-topbar">
      <div className="mobile-topbar-back-wrap">
        {!isHome && (
          <button className="mobile-topbar-back" onClick={() => navigate(-1)} aria-label="Go back">
            <ChevronLeft size={20} strokeWidth={2.5} />
            Back
          </button>
        )}
      </div>

      <span className="mobile-topbar-title">
        {isHome
          ? <span className="mobile-topbar-logo">🧰 <strong>MultiTool</strong></span>
          : title}
      </span>

      <div className="mobile-topbar-spacer" />
    </header>
  );
}

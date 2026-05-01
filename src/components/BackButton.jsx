import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import './BackButton.css';

const HOME_PATHS = new Set(['/', '/utilities', '/pdf-tools', '/image-tools', '/text-tools', '/calculators', '/excel', '/games', '/guides', '/trending', '/favorites']);

export default function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  // Only show on non-root pages (individual tools, articles, etc.)
  if (HOME_PATHS.has(location.pathname) || location.pathname === '/') return null;

  return (
    <button className="back-btn" onClick={() => navigate(-1)} aria-label="Go back">
      <ChevronLeft size={17} strokeWidth={2.5} />
      Back
    </button>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import SeoManager from './SeoManager';
import { footerPages } from '../data/contentPages';
import './Layout.css';

function getTimeAgo(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diffInSeconds = Math.floor((now - past) / 1000);
  
  if (diffInSeconds < 60) return `Last updated: ${diffInSeconds} seconds ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `Last updated: ${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Last updated: ${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `Last updated: ${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
}

const Layout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const timeoutRef = useRef(null);

  useEffect(() => {
    const buildTime = typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : null;
    if (buildTime) {
      setLastUpdated(getTimeAgo(buildTime));
      const interval = setInterval(() => {
        setLastUpdated(getTimeAgo(buildTime));
      }, 10000); // Update every 10 seconds
      return () => clearInterval(interval);
    }
  }, []);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // Only auto-hide if it's currently open
    if (isSidebarOpen) {
      timeoutRef.current = setTimeout(() => {
        setIsSidebarOpen(false);
      }, 5000);
    }
  }, [isSidebarOpen]);

  useEffect(() => {
    // Attach listeners
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('scroll', resetTimer);
    window.addEventListener('click', resetTimer);

    // Initial timer
    resetTimer();

    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('scroll', resetTimer);
      window.removeEventListener('click', resetTimer);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [resetTimer]);

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  return (
    <div className="layout">
      <SeoManager />
      <Navbar onToggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      <div className="layout-shell">
        <div className={`sidebar-wrapper ${isSidebarOpen ? '' : 'hidden'}`}>
          <Sidebar />
        </div>
        <main className="main-content">
          {children}
        </main>
      </div>

      <footer className="footer glass-panel">
        <div className="footer-inner">
          <div className="footer-links">
            {footerPages.map((page) => (
              <Link key={page.path} to={page.path} className="footer-link">
                {page.label}
              </Link>
            ))}
          </div>
          <p>&copy; {new Date().getFullYear()} MultiTool. Browser-based PDF tools, text utilities, guides, and support pages in one workspace.</p>
          {lastUpdated && (
            <p className="last-updated-text" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              {lastUpdated}
            </p>
          )}
        </div>
      </footer>
    </div>
  );
};

export default Layout;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import SeoManager from './SeoManager';
import { footerPages } from '../data/contentPages';
import './Layout.css';

const Layout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const timeoutRef = useRef(null);

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
        </div>
      </footer>
    </div>
  );
};

export default Layout;

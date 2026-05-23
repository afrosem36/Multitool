import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import MobileTopBar from './MobileTopBar';
import BackButton from './BackButton';
import MobileSearch from './MobileSearch';
import SeoManager from './SeoManager';
import ToolContentSection from './shared/ToolContentSection';
import { Boxes } from './ui/background-boxes';
import { footerPages } from '../data/contentPages';
import { getToolContent } from '../data/toolContent';
import {
  calculatorTools,
  excelTools,
  imageTools,
  linkTools,
  pdfTools,
  textTools,
  utilityTools,
} from '../data/toolCatalog';
import './Layout.css';

const TOOL_PAGE_PATHS = new Set([
  ...pdfTools.map((tool) => tool.path),
  ...imageTools.map((tool) => tool.path),
  ...textTools.map((tool) => tool.path),
  ...calculatorTools.map((tool) => tool.path),
  ...utilityTools.map((tool) => tool.path),
  ...excelTools.map((tool) => tool.path),
  ...linkTools.map((tool) => tool.path),
  '/utilities/unit-converter',
  '/time-converter',
]);

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

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const location = useLocation();

  useEffect(() => {
    const buildTime = typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : null;
    if (buildTime) {
      setLastUpdated(getTimeAgo(buildTime));
      const handleVisibility = () => {
        if (!document.hidden) setLastUpdated(getTimeAgo(buildTime));
      };
      document.addEventListener('visibilitychange', handleVisibility);
      return () => document.removeEventListener('visibilitychange', handleVisibility);
    }
  }, []);

  // Close sidebar on small screens when navigating
  useEffect(() => {
    if (window.innerWidth <= 1024) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname]);

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  // Pages that should NOT have the layout
  const noLayoutPages = ['/login', '/signup', '/forgot-password', '/reset-password'];
  const isNoLayout = noLayoutPages.includes(location.pathname) || location.pathname.startsWith('/s/');
  const isToolPage = TOOL_PAGE_PATHS.has(location.pathname);
  const toolContent = getToolContent(location.pathname);
  const isIde = location.pathname === '/tools/html-ide';
  const isFullscreen = isIde || location.pathname === '/whatsapp-tools';

  if (isNoLayout) return <Outlet />;

  // IDE and WhatsApp tool get fullscreen mode — no navbar, sidebar, or footer
  if (isFullscreen) return (
    <div className="ide-fullscreen">
      <SeoManager />
      <Outlet />
    </div>
  );

  return (
    <div className="layout">
      {/* ── Global animated grid background ── */}
      <div className="bg-boxes-root">
        <Boxes />
        {/* radial vignette — fades boxes to site background at edges */}
        <div className="bg-boxes-mask" />
      </div>

      <SeoManager />
      <Navbar
        onToggleSidebar={toggleSidebar}
        isSidebarOpen={isSidebarOpen}
        visible={true}
      />
      
      <div className="layout-shell">
        <div className={`sidebar-wrapper ${isSidebarOpen ? '' : 'hidden'}`}>
          <Sidebar onClose={toggleSidebar} />
        </div>
        <main className="main-content">
          <BackButton />
          <Outlet />

          {toolContent && (
            <ToolContentSection content={toolContent.richContent} />
          )}

          <footer className="footer glass-panel">
            <div className="footer-inner">
              <div className="footer-links">
                {footerPages.map((page) => (
                  <Link key={page.path} to={page.path} className="footer-link">
                    {page.label}
                  </Link>
                ))}
              </div>
              <p>&copy; {new Date().getFullYear()} MultiTool</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                Created and developed by Mohammad Afroz
              </p>
              {lastUpdated && (
                <p className="last-updated-text" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  {lastUpdated}
                </p>
              )}
            </div>
          </footer>
        </main>
      </div>

      {/* Mobile top bar (back button + page title) */}
      <MobileTopBar />

      {/* Mobile-only Navigation */}
      <BottomNav onSearchOpen={() => setIsMobileSearchOpen(true)} />
      
      {/* Mobile-only Search Overlay */}
      {isMobileSearchOpen && (
        <MobileSearch onClose={() => setIsMobileSearchOpen(false)} />
      )}

    </div>
  );
};

export default Layout;

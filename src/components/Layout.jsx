import React, { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import MobileSearch from './MobileSearch';
import SeoManager from './SeoManager';
import AdSenseUnit from './shared/AdSenseUnit';
import { footerPages } from '../data/contentPages';
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
  const [navbarVisible, setNavbarVisible] = useState(false);
  const navHoveredRef = useRef(false);
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

  // Navbar auto-hide: show on hover at top edge; hide only when mouse is outside
  // the navbar element AND below 90px. navHoveredRef prevents hiding while a dropdown is open.
  useEffect(() => {
    let rafId = null;
    const handleMouseMove = (e) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (e.clientY <= 20) {
          setNavbarVisible(true);
        } else if (e.clientY > 90 && !navHoveredRef.current) {
          setNavbarVisible(false);
        }
      });
    };
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  // Pages that should NOT have the layout
  const noLayoutPages = ['/login', '/signup', '/forgot-password', '/reset-password'];
  const isNoLayout = noLayoutPages.includes(location.pathname) || location.pathname.startsWith('/s/');
  const isToolPage = TOOL_PAGE_PATHS.has(location.pathname);
  const isIde = location.pathname === '/tools/html-ide';

  if (isNoLayout) return <Outlet />;

  // IDE gets fullscreen mode — no navbar, sidebar, or footer
  if (isIde) return (
    <div className="ide-fullscreen">
      <SeoManager />
      <Outlet />
    </div>
  );

  return (
    <div className={`layout${navbarVisible ? '' : ' layout--nav-hidden'}`}>
      <SeoManager />
      <Navbar
        onToggleSidebar={toggleSidebar}
        isSidebarOpen={isSidebarOpen}
        visible={navbarVisible}
        onNavHover={(hovered) => {
          navHoveredRef.current = hovered;
          if (hovered) setNavbarVisible(true);
        }}
      />
      
      <div className="layout-shell">
        <div className={`sidebar-wrapper ${isSidebarOpen ? '' : 'hidden'}`}>
          <Sidebar onClose={toggleSidebar} />
          <AdSenseUnit slot="1234567890" format="rectangle" responsive="false" />
        </div>
        <main className="main-content">
          <Outlet />

          {isToolPage && (
            <div className="layout-tool-ad-strip">
              <AdSenseUnit
                slot="9876543210"
                format="auto"
                responsive="true"
                style={{ display: "block", minHeight: 140 }}
              />
            </div>
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
              {lastUpdated && (
                <p className="last-updated-text" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  {lastUpdated}
                </p>
              )}
            </div>
          </footer>
        </main>
      </div>

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

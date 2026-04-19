import React from 'react';
import AdsterraAds from './AdsterraAds';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import SeoManager from './SeoManager';
import './Layout.css';

const Layout = ({ children }) => {
  return (
    <div className="layout">
      <SeoManager />
      <Navbar />
      <div className="layout-shell">
        <Sidebar />
        <main className="main-content">
          {children}
        </main>
      </div>

      <AdsterraAds />

      <footer className="footer glass-panel">
        <div className="footer-inner">
          <p>&copy; {new Date().getFullYear()} PDF Tools. Browser-based PDF and text utilities in one workspace.</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;

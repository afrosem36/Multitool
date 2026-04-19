import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import SeoManager from './SeoManager';
import { footerPages } from '../data/contentPages';
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

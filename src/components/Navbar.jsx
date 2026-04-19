import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Settings } from 'lucide-react';
import { toolSections } from '../data/toolCatalog';
import { headerPages } from '../data/contentPages';
import './Navbar.css';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const toggleMenu = () => setIsOpen(!isOpen);
  const isLinkActive = (path) =>
    location.pathname === path || (path === '/guides' && location.pathname.startsWith('/guides/'));

  return (
    <nav className="navbar glass-panel">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <div className="logo-icon">
            <Settings size={24} color="var(--accent-primary)" />
          </div>
          <span className="text-gradient">MultiTool</span>
        </Link>

        {/* Desktop Menu */}
        <div className="navbar-menu hidden-mobile">
          {headerPages.map((link) => (
            <Link 
              key={link.path} 
              to={link.path} 
              className={`nav-link ${isLinkActive(link.path) ? 'active' : ''}`}
            >
              <span>{link.label}</span>
            </Link>
          ))}
          <div className="nav-status">
            <span className="nav-status-count">
              {toolSections.reduce((count, section) => count + section.tools.length, 0)} tools
            </span>
            <span className="nav-status-label">PDF + Text + Link Workspace</span>
          </div>
        </div>

        {/* Mobile Menu Button */}
        <div className="mobile-menu-btn">
          <button onClick={toggleMenu} className="btn-icon">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div className="mobile-menu glass-panel animate-fade-in">
          {headerPages.map((link) => (
            <Link 
              key={link.path} 
              to={link.path} 
              className="mobile-link"
              onClick={toggleMenu}
            >
              {link.label}
            </Link>
          ))}
          
          {toolSections.map((section) => (
            <Link
              key={section.id}
              to={section.path}
              className="mobile-link"
              onClick={toggleMenu}
            >
              {section.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
};

export default Navbar;

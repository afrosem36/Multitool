import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Settings, Home } from 'lucide-react';
import { toolSections } from '../data/toolCatalog';
import './Navbar.css';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const toggleMenu = () => setIsOpen(!isOpen);

  const navLinks = [
    { name: 'Home', path: '/', icon: <Home size={18} /> },
  ];

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
          {navLinks.map((link) => (
            <Link 
              key={link.path} 
              to={link.path} 
              className={`nav-link ${location.pathname === link.path ? 'active' : ''}`}
            >
              {link.icon}
              <span>{link.name}</span>
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
          {navLinks.map((link) => (
            <Link 
              key={link.path} 
              to={link.path} 
              className="mobile-link"
              onClick={toggleMenu}
            >
              {link.icon}
              {link.name}
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

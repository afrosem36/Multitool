import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Settings, Star, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Switch from './ui/sky-toggle';
import NavHeader from './ui/nav-header';
import { toolSections } from '../data/toolCatalog';
import { headerPages } from '../data/contentPages';
import { useTheme } from '../hooks/useTheme';
import './Navbar.css';

const Navbar = ({ onToggleSidebar, isSidebarOpen }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const toggleMenu = () => setIsOpen(!isOpen);

  const isLinkActive = (path) =>
    location.pathname === path || (path === '/guides' && location.pathname.startsWith('/guides/'));

  return (
    <nav className="navbar glass-panel expanded">
      <div className="navbar-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {onToggleSidebar && (
            <button 
              className="btn-icon hidden-mobile" 
              onClick={onToggleSidebar}
              title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
              style={{ color: 'var(--text-secondary)' }}
            >
              {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            </button>
          )}
          <Link to="/" className="navbar-logo" title="MultiTool">
            <div className="logo-icon">
              <Settings size={24} color="var(--accent-primary)" />
            </div>
            <span className="text-gradient logo-text">MultiTool</span>
          </Link>
        </div>

        {/* Desktop Menu */}
        <div className="navbar-menu-center hidden-mobile">
          <div className="nav-items-wrapper">
            <NavHeader />
          </div>
        </div>
        
        <div className="navbar-actions-right hidden-mobile">
          <Link 
            to="/favorites" 
            className={`nav-link fav-link ${isLinkActive('/favorites') ? 'active' : ''}`}
            title="Favorites"
          >
            <span className="nav-text">Favorites</span> <Star size={16} />
          </Link>
          
          <div className="theme-toggle-wrapper" title="Toggle Theme">
            <Switch 
              checked={theme === 'dark'} 
              onChange={toggleTheme} 
            />
          </div>
        </div>

        {/* Mobile Menu Button */}
        <div className="mobile-menu-btn">
          <div className="theme-toggle-wrapper-mobile">
            <Switch 
              checked={theme === 'dark'} 
              onChange={toggleTheme} 
            />
          </div>
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
          
          <Link
            to="/favorites"
            className="mobile-link"
            onClick={toggleMenu}
          >
            Favorites
          </Link>
          
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

import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, NavLink } from 'react-router-dom';
import { Menu, X, Settings, Star, PanelLeftClose, PanelLeftOpen, User, LogOut, ChevronDown, ChevronUp, Home, TrendingUp, Grid, BookOpen, LayoutDashboard, Gamepad2 } from 'lucide-react';
import Switch from './ui/sky-toggle';
import NavHeader from './ui/nav-header';
import SearchBar from './SearchBar';
import { toolSections } from '../data/toolCatalog';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = ({ onToggleSidebar, isSidebarOpen, visible, onNavHover }) => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const drawerRef = useRef(null);

  const toggleDrawer = () => setIsDrawerOpen(!isDrawerOpen);
  const closeDrawer = () => setIsDrawerOpen(false);

  const toggleSection = (id) => {
    setExpandedSections(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target) && isDrawerOpen) {
        closeDrawer();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDrawerOpen]);

  // Close drawer on route change
  useEffect(() => {
    closeDrawer();
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
    closeDrawer();
  };

  return (
    <>
      <nav
        className={`navbar glass-panel expanded${!visible && !isMobile ? ' navbar--hidden' : ''}`}
        onMouseEnter={() => onNavHover?.(true)}
        onMouseLeave={() => onNavHover?.(false)}
      >
        <div className="navbar-container">
          <div className="navbar-left">
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
            
            {/* Mobile Hamburger - Only visible on mobile */}
            <button className="mobile-only hamburger-btn" onClick={toggleDrawer}>
              <Menu size={24} />
            </button>

            <Link to="/" className="navbar-logo" title="MultiTool">
              <div className="logo-icon">
                <Settings size={24} color="var(--accent-primary)" />
              </div>
              <span className="text-gradient logo-text hidden-mobile">MultiTool</span>
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="navbar-menu-center hidden-mobile">
            <div className="nav-items-wrapper">
              <NavHeader />
            </div>
          </div>
          
          {/* Search Bar - Desktop Only */}
          <div className="navbar-search-wrapper hidden-mobile">
            <SearchBar />
          </div>
          
          <div className="navbar-actions-right">
            <div className="hidden-mobile" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Link 
                to="/favorites" 
                className={`nav-link fav-link ${location.pathname === '/favorites' ? 'active' : ''}`}
                title="Favorites"
              >
                <span className="nav-text">Favorites</span> <Star size={16} />
              </Link>

              {user ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Link to="/analytics" className="btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.9rem' }}>
                    Dashboard
                  </Link>
                  <button onClick={handleLogout} className="btn-icon" title="Logout">
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                <Link to="/login" className="btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <User size={16} /> Login
                </Link>
              )}
            </div>
            
            <div className="theme-toggle-wrapper" title="Toggle Theme">
              <Switch 
                checked={theme === 'dark'} 
                onChange={toggleTheme} 
              />
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      <div className={`drawer-overlay ${isDrawerOpen ? 'open' : ''}`}>
        <div className={`mobile-drawer ${isDrawerOpen ? 'open' : ''}`} ref={drawerRef}>
          <div className="drawer-header">
            {user ? (
              <div className="user-profile">
                <div className="user-avatar">
                  <User size={24} />
                </div>
                <div className="user-info">
                  <span className="user-email">{user.email}</span>
                  <span className="user-status">Logged In</span>
                </div>
              </div>
            ) : (
              <div className="auth-buttons">
                <Link to="/login" className="btn-primary">Login</Link>
                <Link to="/signup" className="btn-secondary">Register</Link>
              </div>
            )}
            <button className="close-drawer-btn" onClick={closeDrawer}>
              <X size={24} />
            </button>
          </div>

          <div className="drawer-content">
            <div className="drawer-section">
              <div className="section-title">Navigation</div>
              <NavLink to="/" className="drawer-link"><Home size={18} /> Home</NavLink>
              <NavLink to="/trending" className="drawer-link"><TrendingUp size={18} /> Trending</NavLink>
              <NavLink to="/utilities" className="drawer-link"><Grid size={18} /> Tools</NavLink>
              <NavLink to="/guides" className="drawer-link"><BookOpen size={18} /> Guides</NavLink>
              <NavLink to="/games" className="drawer-link"><Gamepad2 size={18} /> Games</NavLink>
            </div>

            <div className="drawer-section">
              <div className="section-title">Tool Categories</div>
              {toolSections.map((section) => (
                <div key={section.id} className="expandable-category">
                  <button className="category-trigger" onClick={() => toggleSection(section.id)}>
                    <div className="trigger-left">
                      <section.icon size={18} />
                      <span>{section.label}</span>
                    </div>
                    {expandedSections[section.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {expandedSections[section.id] && (
                    <div className="category-links">
                      {section.tools.map(tool => (
                        <Link key={tool.id} to={tool.path} className="category-link">
                          {tool.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="drawer-section mt-auto">
              <NavLink to="/favorites" className="drawer-link"><Star size={18} /> Favorites</NavLink>
              {user && <NavLink to="/analytics" className="drawer-link"><LayoutDashboard size={18} /> Dashboard</NavLink>}
            </div>
          </div>

          <div className="drawer-footer">
            <div className="theme-toggle-row">
              <span>Dark Mode</span>
              <Switch checked={theme === 'dark'} onChange={toggleTheme} />
            </div>
            {user && (
              <button onClick={handleLogout} className="drawer-logout-btn">
                <LogOut size={18} /> Logout
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;



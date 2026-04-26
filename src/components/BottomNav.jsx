import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Grid, Search, LayoutDashboard, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './BottomNav.css';

const BottomNav = ({ onSearchOpen }) => {
  const { user } = useAuth();

  return (
    <nav className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <Home size={24} />
        <span>Home</span>
      </NavLink>
      
      <NavLink to="/utilities" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <Grid size={24} />
        <span>Tools</span>
      </NavLink>
      
      <button className="bottom-nav-item" onClick={onSearchOpen}>
        <Search size={24} />
        <span>Search</span>
      </button>
      
      <NavLink 
        to={user ? "/dashboard" : "/login"} 
        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        {user ? <LayoutDashboard size={24} /> : <User size={24} />}
        <span>Account</span>
      </NavLink>
    </nav>
  );
};

export default BottomNav;

import React, { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Grid, Search, User, Gamepad2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './BottomNav.css';

const NAV_ITEMS = [
  { to: '/',          label: 'Home',   Icon: Home,     exact: true },
  { to: '/utilities', label: 'Tools',  Icon: Grid,     exact: false },
  { to: '/games',     label: 'Games',  Icon: Gamepad2, exact: false },
];

export default function BottomNav({ onSearchOpen }) {
  const { user } = useAuth();
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastScrollY.current;
        if (delta > 6 && y > 80) setVisible(false);   // scrolled down
        else if (delta < -6) setVisible(true);          // scrolled up
        lastScrollY.current = y;
        ticking.current = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`bottom-nav${visible ? '' : ' bottom-nav--hidden'}`}>
      {NAV_ITEMS.map(({ to, label, Icon, exact }) => (
        <NavLink
          key={to}
          to={to}
          end={exact}
          className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
        >
          <Icon size={23} />
          <span>{label}</span>
        </NavLink>
      ))}

      <button className="bottom-nav-item" onClick={onSearchOpen}>
        <Search size={23} />
        <span>Search</span>
      </button>

      <NavLink
        to={user ? '/dashboard' : '/login'}
        className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
      >
        <User size={23} />
        <span>Account</span>
      </NavLink>
    </nav>
  );
}

"use client"; 

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { toolSections } from "../../data/toolCatalog";
import "./nav-header.css";

const primaryLinks = [
  { label: 'Home', path: '/' },
  { label: 'Tools', path: '#', hasDropdown: true },
  { label: 'Guides', path: '/guides' },
];

function NavHeader() {
  const [position, setPosition] = useState({
    left: 0,
    width: 0,
    opacity: 0,
  });

  return (
    <ul
      className="nav-header-container"
      onMouseLeave={() => setPosition((pv) => ({ ...pv, opacity: 0 }))}
    >
      {primaryLinks.map((page) => (
        <Tab key={page.label} setPosition={setPosition} page={page}>
          {page.label}
        </Tab>
      ))}

      <Cursor position={position} />
    </ul>
  );
}

const Tab = ({
  children,
  setPosition,
  page,
}: {
  children: React.ReactNode;
  setPosition: any;
  page: any;
}) => {
  const ref = useRef<HTMLLIElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const location = useLocation();
  const isActive = location.pathname === page.path || (page.path === '/guides' && location.pathname.startsWith('/guides/'));

  const handleMouseEnter = () => {
    if (!ref.current) return;
    const { width } = ref.current.getBoundingClientRect();
    setPosition({
      width,
      opacity: 1,
      left: ref.current.offsetLeft,
    });
    if (page.hasDropdown) setIsDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    if (page.hasDropdown) setIsDropdownOpen(false);
  };

  return (
    <li
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="nav-header-tab"
    >
      {page.hasDropdown ? (
        <div className="nav-header-link">
          {children}
        </div>
      ) : (
        <Link to={page.path} className="nav-header-link">
          {children}
        </Link>
      )}

      {page.hasDropdown && (
        <div className={`nav-dropdown ${isDropdownOpen ? 'active' : ''}`}>
          {toolSections.map(tool => (
            <Link key={tool.path} to={tool.path} className="nav-dropdown-item">
              {tool.label}
            </Link>
          ))}
          <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.5rem 0' }} />
          <Link to="/analytics" className="nav-dropdown-item" style={{ color: 'var(--accent-primary)', fontWeight: '600' }}>
            Admin Dashboard
          </Link>
        </div>
      )}
    </li>
  );
};

const Cursor = ({ position }: { position: any }) => {
  return (
    <motion.li
      animate={position}
      className="nav-header-cursor"
    />
  );
};

export default NavHeader;

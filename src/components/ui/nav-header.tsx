"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { toolSections } from "../../data/toolCatalog";
import "./nav-header.css";

const primaryLinks = [
  { label: 'Home', path: '/' },
  { label: 'Trending', path: '/trending' },
  { label: 'Tools', path: '#', hasDropdown: true },
  { label: 'Guides', path: '/guides' },
];

function NavHeader() {
  const [position, setPosition] = useState({ left: 0, width: 0, opacity: 0 });

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

  const handleMouseEnter = () => {
    if (!ref.current) return;
    const { width } = ref.current.getBoundingClientRect();
    setPosition({ width, opacity: 1, left: ref.current.offsetLeft });
  };

  return (
    <li
      ref={ref}
      onMouseEnter={handleMouseEnter}
      className={`nav-header-tab${page.hasDropdown ? ' has-dropdown' : ''}`}
    >
      {page.hasDropdown ? (
        <div className="nav-header-link">{children}</div>
      ) : (
        <Link to={page.path} className="nav-header-link">{children}</Link>
      )}

      {page.hasDropdown && (
        <div className="nav-dropdown">
          {toolSections.map(tool => (
            <Link key={tool.path} to={tool.path} className="nav-dropdown-item">
              {tool.label}
            </Link>
          ))}
          <div className="nav-dropdown-divider" />
          <Link to="/analytics" className="nav-dropdown-item nav-dropdown-item--accent">
            Admin Dashboard
          </Link>
        </div>
      )}
    </li>
  );
};

const Cursor = ({ position }: { position: any }) => (
  <motion.li animate={position} className="nav-header-cursor" />
);

export default NavHeader;

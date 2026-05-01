import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, PanelLeftClose } from 'lucide-react';
import { toolSections } from '../data/toolCatalog';
import './Sidebar.css';

const Sidebar = ({ onClose }) => {
  const location = useLocation();

  const isSectionActive = (section) =>
    location.pathname === section.path ||
    section.tools.some((tool) => tool.path === location.pathname);

  return (
    <aside className="tool-sidebar glass-panel">
      <div className="sidebar-header">
        <div className="sidebar-badge">
          <FileText size={16} />
          <span>Workspace</span>
        </div>
        <h2>Tools</h2>
        <p>Open a tools page or jump straight into the WhatsApp link creator.</p>
        {onClose && (
          <button className="sidebar-close-btn" onClick={onClose} title="Hide sidebar">
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      <div className="sidebar-links">
        {toolSections.map((section) => {
          const Icon = section.icon;

          return (
            <Link
              key={section.id}
              to={section.path}
              className={`sidebar-link ${isSectionActive(section) ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon">
                <Icon size={18} />
              </span>
              <span className="sidebar-link-copy">
                <strong>{section.label}</strong>
                <small>{section.description}</small>
              </span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
};

export default Sidebar;

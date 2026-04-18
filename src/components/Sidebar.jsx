import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { toolSections } from '../data/toolCatalog';
import './Sidebar.css';

const Sidebar = () => {
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

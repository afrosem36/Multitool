import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { findToolSectionById } from '../data/toolCatalog';
import './ToolHubPage.css';

const ToolHubPage = ({ sectionId }) => {
  const section = findToolSectionById(sectionId);

  if (!section) {
    return <Navigate to="/" replace />;
  }

  const SectionIcon = section.icon;

  return (
    <div className="tool-hub-page">
      <div className="tool-hub-hero glass-panel animate-fade-in">
        <div>
          <p className="tool-hub-kicker">Tool Directory</p>
          <h1>{section.label}</h1>
          <p>{section.description}</p>
        </div>

        <div className="tool-hub-summary">
          <div className="tool-hub-summary-icon">
            <SectionIcon size={20} />
          </div>
          <div>
            <strong>{section.tools.length} tools</strong>
            <span>Choose one to open its workspace.</span>
          </div>
        </div>
      </div>

      <div className="tool-hub-grid">
        {section.tools.map((tool, index) => {
          const Icon = tool.icon;

          return (
            <div
              key={tool.path}
              className="tool-hub-card glass-panel animate-fade-in"
              style={{ animationDelay: `${0.12 + index * 0.05}s` }}
            >
              <div className="tool-hub-card-icon" style={{ background: tool.color }}>
                <Icon size={24} />
              </div>
              <h3>{tool.name}</h3>
              <p>{tool.description}</p>
              <Link to={tool.path} className="tool-hub-link">
                Open Tool <ArrowRight size={16} />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ToolHubPage;

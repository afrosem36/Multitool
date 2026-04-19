import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Star } from 'lucide-react';
import { findToolSectionById } from '../data/toolCatalog';
import { useFavorites } from '../hooks/useFavorites';
import './ToolHubPage.css';

const ToolHubPage = ({ sectionId }) => {
  const section = findToolSectionById(sectionId);
  const { isFavorite, toggleFavorite } = useFavorites();

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
              style={{ animationDelay: `${0.12 + index * 0.05}s`, position: 'relative' }}
            >
              <button
                onClick={(e) => {
                  e.preventDefault();
                  toggleFavorite(tool.id);
                }}
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: isFavorite(tool.id) ? '#eab308' : 'var(--text-secondary)',
                  zIndex: 10
                }}
                title={isFavorite(tool.id) ? "Remove from Favorites" : "Add to Favorites"}
              >
                <Star size={20} fill={isFavorite(tool.id) ? '#eab308' : 'none'} />
              </button>
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

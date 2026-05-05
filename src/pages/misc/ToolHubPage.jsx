import React from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Star, ChevronRight } from 'lucide-react';
import { findToolSectionById, toolSections } from '../../data/toolCatalog';
import { useFavorites } from '../../hooks/useFavorites';
import { TiltCard } from '../../components/ui/TiltCard';
import '../styles/ToolHubPage.css';

const ToolHubPage = ({ sectionId }) => {
  const section = findToolSectionById(sectionId);
  const { isFavorite, toggleFavorite } = useFavorites();
  const gridRef = React.useRef(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (window.innerWidth < 768 && gridRef.current) {
      gridRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [sectionId]);

  if (!section) {
    return <Navigate to="/" replace />;
  }

  const SectionIcon = section.icon;

  return (
    <div className="tool-hub-page">
      {/* Mobile Category Bar */}
      <div className="mobile-category-bar animate-fade-in">
        <div className="category-scroll">
          {toolSections.map((s) => (
            <button
              key={s.id}
              className={`category-pill ${s.id === sectionId ? 'active' : ''}`}
              onClick={() => navigate(s.path)}
            >
              <s.icon size={16} />
              <span>{s.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="tool-hub-hero glass-panel animate-fade-in">
        <div className="hero-content">
          <p className="tool-hub-kicker">Tool Directory</p>
          <h1>{section.label}</h1>
          <p>{section.description}</p>
        </div>

        <div className="tool-hub-summary">
          <div className="tool-hub-summary-icon">
            <SectionIcon size={24} />
          </div>
          <div>
            <strong>{section.tools.length} tools available</strong>
            <span>Browser-based & Secure</span>
          </div>
        </div>
      </div>

      <div className="tool-hub-grid" ref={gridRef}>
        {section.tools.map((tool, index) => {
          const Icon = tool.icon;

          return (
            <TiltCard
              key={tool.path}
              className="tool-hub-card glass-panel animate-fade-in"
              style={{ animationDelay: `${0.12 + index * 0.05}s`, position: 'relative' }}
              tiltLimit={5}
              scale={1.02}
            >
              <button
                onClick={(e) => {
                  e.preventDefault();
                  toggleFavorite(tool.id);
                }}
                className="card-favorite-btn"
                style={{
                  color: isFavorite(tool.id) ? '#eab308' : 'var(--text-secondary)'
                }}
                title={isFavorite(tool.id) ? "Remove from Favorites" : "Add to Favorites"}
              >
                <Star size={20} fill={isFavorite(tool.id) ? '#eab308' : 'none'} />
              </button>
              
              <div className="tool-hub-card-header">
                <div className="tool-hub-card-icon" style={{ background: tool.color }}>
                  <Icon size={24} />
                </div>
                <div className="tool-hub-card-title">
                  <h3>{tool.name}</h3>
                  <p>{tool.description}</p>
                </div>
              </div>

              <Link to={tool.path} className="tool-hub-link">
                <span>Use Tool</span>
                <ChevronRight size={18} />
              </Link>
            </TiltCard>
          );
        })}
      </div>
    </div>
  );
};

export default ToolHubPage;

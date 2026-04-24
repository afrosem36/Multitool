import React from 'react';
import { Star, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFavorites } from '../hooks/useFavorites';
import { toolSections } from '../data/toolCatalog';
import ToolHeader from '../components/shared/ToolHeader';
import { TiltCard } from '../components/ui/TiltCard';
import '../pages/ToolStyles.css';

const FavoritesPage = () => {
  const { favorites } = useFavorites();

  // Find all favorite tool objects
  const favoriteTools = favorites.map(favId => {
    for (const section of toolSections) {
      const tool = section.tools.find(t => t.id === favId);
      if (tool) return { ...tool, sectionId: section.id };
    }
    return null;
  }).filter(Boolean);

  return (
    <div className="container" style={{ paddingTop: '2rem', minHeight: '80vh' }}>
      <ToolHeader 
        title="Your Favorites" 
        description="Quick access to your most used tools"
        icon={Star}
      />
      
      {favoriteTools.length === 0 ? (
        <div className="text-center glass-panel" style={{ padding: '4rem 2rem', marginTop: '2rem' }}>
          <Star size={48} style={{ color: 'var(--text-secondary)', margin: '0 auto 1rem', opacity: 0.5 }} />
          <h2 style={{ marginBottom: '1rem' }}>No favorites yet</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Click the star icon on any tool to add it to your favorites for quick access.
          </p>
        </div>
      ) : (
        <div className="tools-grid animate-fade-in" style={{ marginTop: '2rem' }}>
          {favoriteTools.map(tool => (
            <TiltCard
              key={tool.id}
              className="tool-card glass-panel"
              style={{ textDecoration: 'none', padding: 0 }}
              tiltLimit={5}
              scale={1.02}
            >
              <Link to={tool.path} style={{ textDecoration: 'none', display: 'block', height: '100%', padding: '1.5rem' }}>
                <div className="tool-card-content">
                  <div 
                    className="tool-icon-wrapper"
                    style={{ backgroundColor: tool.color }}
                  >
                    <tool.icon size={28} className="tool-icon" />
                  </div>
                  <h3>{tool.name}</h3>
                  <p>{tool.description}</p>
                  <div className="tool-card-footer">
                    <span className="tool-link">
                      Open Tool <ExternalLink size={16} />
                    </span>
                  </div>
                </div>
              </Link>
            </TiltCard>
          ))}
        </div>
      )}
    </div>
  );
};

export default FavoritesPage;

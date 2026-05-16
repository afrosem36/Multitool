import React from 'react';
import { Star } from 'lucide-react';
import { useFavorites } from '../../hooks/useFavorites';

const ToolHeader = ({ title, description, icon: Icon, toolId }) => {
  const { isFavorite, toggleFavorite } = useFavorites();

  return (
    <div className="tool-header-wrapper" style={{ marginBottom: '2rem' }}>
      {toolId && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1rem' }}>
          <button
            onClick={() => toggleFavorite(toolId)}
            className="btn-icon"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isFavorite(toolId) ? '#eab308' : 'var(--text-secondary)'
            }}
            title={isFavorite(toolId) ? "Remove from Favorites" : "Add to Favorites"}
          >
            <Star size={24} fill={isFavorite(toolId) ? '#eab308' : 'none'} />
          </button>
        </div>
      )}

      <div className="tool-header text-center animate-fade-in" style={{ padding: '0 1rem' }}>
        {Icon && <Icon size={48} className="text-gradient mx-auto mb-4" />}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
};

export default ToolHeader;

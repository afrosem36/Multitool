import React from 'react';
import { ArrowLeft, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFavorites } from '../../hooks/useFavorites';

const ToolHeader = ({ title, description, icon: Icon, toolId }) => {
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite } = useFavorites();
  
  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="tool-header-wrapper" style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button 
          onClick={handleBack} 
          className="btn-secondary" 
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem' }}
        >
          <ArrowLeft size={20} /> Back
        </button>
        
        {toolId && (
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
        )}
      </div>
      
      <div className="tool-header text-center animate-fade-in" style={{ padding: '0 1rem' }}>
        {Icon && <Icon size={48} className="text-gradient mx-auto mb-4" />}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
};

export default ToolHeader;

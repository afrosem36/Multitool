import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Wrench } from 'lucide-react';
import {
  pdfTools, imageTools, textTools, calculatorTools, utilityTools, excelTools, linkTools
} from '../data/toolCatalog';
import './MobileSearch.css';

const allTools = [
  ...pdfTools.map(t => ({ ...t, category: 'PDF' })),
  ...imageTools.map(t => ({ ...t, category: 'Image' })),
  ...textTools.map(t => ({ ...t, category: 'Text' })),
  ...calculatorTools.map(t => ({ ...t, category: 'Calculator' })),
  ...utilityTools.map(t => ({ ...t, category: 'Utility' })),
  ...excelTools.map(t => ({ ...t, category: 'Excel' })),
  ...linkTools.map(t => ({ ...t, category: 'Link' }))
];

const MobileSearch = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }

    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const matched = allTools.filter(tool => 
      tool.name.toLowerCase().includes(lowerQuery) || 
      tool.description.toLowerCase().includes(lowerQuery)
    );

    // Group by category
    const grouped = matched.reduce((acc, tool) => {
      if (!acc[tool.category]) acc[tool.category] = [];
      acc[tool.category].push(tool);
      return acc;
    }, {});

    setResults(Object.entries(grouped));
  }, [query]);

  const handleSelect = (path) => {
    onClose();
    navigate(path);
  };

  return (
    <div className="mobile-search-overlay animate-fade-in">
      <div className="mobile-search-header">
        <div className="mobile-search-input-wrapper">
          <Search className="search-icon" size={20} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search tools..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button className="close-btn" onClick={onClose}>
          <X size={24} />
        </button>
      </div>

      <div className="mobile-search-content">
        {query.trim() ? (
          results.length > 0 ? (
            results.map(([category, tools]) => (
              <div key={category} className="search-group">
                <div className="search-group-title">{category} Tools</div>
                {tools.map(tool => {
                  const Icon = tool.icon || Wrench;
                  return (
                    <div key={tool.id} className="search-result-item" onClick={() => handleSelect(tool.path)}>
                      <div className="result-icon" style={{ background: tool.color }}>
                        <Icon size={18} />
                      </div>
                      <div className="result-info">
                        <div className="result-name">{tool.name}</div>
                        <div className="result-desc">{tool.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          ) : (
            <div className="no-results">No results for "{query}"</div>
          )
        ) : (
          <div className="search-placeholder">Type to search for any tool...</div>
        )}
      </div>
    </div>
  );
};

export default MobileSearch;

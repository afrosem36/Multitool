import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, File, Link as LinkIcon, Wrench } from 'lucide-react';
import {
  pdfTools, imageTools, textTools, calculatorTools, utilityTools, excelTools, linkTools
} from '../data/toolCatalog';
import './SearchBar.css';

const allTools = [
  ...pdfTools.map(t => ({ ...t, category: 'PDF' })),
  ...imageTools.map(t => ({ ...t, category: 'Image' })),
  ...textTools.map(t => ({ ...t, category: 'Text' })),
  ...calculatorTools.map(t => ({ ...t, category: 'Calculator' })),
  ...utilityTools.map(t => ({ ...t, category: 'Utility' })),
  ...excelTools.map(t => ({ ...t, category: 'Excel' })),
  ...linkTools.map(t => ({ ...t, category: 'Link' }))
];

const SearchBar = () => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState({ tools: [], files: [], links: [] });
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ tools: [], files: [], links: [] });
      setIsOpen(false);
      return;
    }

    const lowerQuery = query.toLowerCase();

    // 1. Search Static Tools
    const matchedTools = allTools.filter(tool => 
      tool.name.toLowerCase().includes(lowerQuery) || 
      tool.description.toLowerCase().includes(lowerQuery)
    ).slice(0, 5); // Limit to top 5 tools

    // Future: Fetch User's Files and Links from Backend (Requires Auth Phase)

    setResults({
      tools: matchedTools,
      files: [], // Placeholder for future D1 data
      links: []  // Placeholder for future D1 data
    });
    setIsOpen(true);
  }, [query]);

  const handleSelect = (path) => {
    setQuery('');
    setIsOpen(false);
    navigate(path);
  };

  const hasResults = results.tools.length > 0 || results.files.length > 0 || results.links.length > 0;

  return (
    <div className="searchbar-wrapper" ref={wrapperRef}>
      <div className={`searchbar-input-container ${isOpen && hasResults ? 'open' : ''}`}>
        <Search className="search-icon" size={18} />
        <input
          type="text"
          className="search-input"
          placeholder="Search tools, files, links..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (query.trim()) setIsOpen(true); }}
        />
        {query && (
          <button className="clear-btn" onClick={() => setQuery('')}>
            <X size={16} />
          </button>
        )}
      </div>

      {isOpen && query.trim() && (
        <div className="searchbar-dropdown glass-panel">
          {hasResults ? (
            <div className="search-results-list">
              
              {/* Tools Section */}
              {results.tools.length > 0 && (
                <div className="search-section">
                  <div className="search-section-title">Tools</div>
                  {results.tools.map(tool => {
                    const Icon = tool.icon || Wrench;
                    return (
                      <div 
                        key={tool.id} 
                        className="search-item"
                        onClick={() => handleSelect(tool.path)}
                      >
                        <div className="search-item-icon" style={{ background: tool.color }}>
                          <Icon size={16} color="var(--text-primary)" />
                        </div>
                        <div className="search-item-info">
                          <span className="search-item-name">{tool.name}</span>
                          <span className="search-item-desc">{tool.category}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Future: Add Files and Links search sections here */}

            </div>
          ) : (
            <div className="search-no-results">
              <p>No results found for "{query}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;

import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { toolSections } from '../data/toolCatalog';
import { useToolHistory } from '../hooks/useToolHistory';
import { useEffect } from 'react';
import './ToolStyles.css';

const AllToolsPage = () => {
  const [query, setQuery] = useState('');
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/explore', 'Explore Tools', 'utility');
  }, [addHistory]);

  // Flatten all tools that have at least one tool, then filter by query
  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return toolSections
      .filter((s) => s.tools && s.tools.length > 0)
      .map((s) => ({
        ...s,
        tools: q
          ? s.tools.filter(
              (t) =>
                t.name.toLowerCase().includes(q) ||
                (t.description && t.description.toLowerCase().includes(q))
            )
          : s.tools,
      }))
      .filter((s) => s.tools.length > 0);
  }, [query]);

  return (
    <div className="tool-container container" style={{ maxWidth: '1100px' }}>
      <div className="tool-header text-center animate-fade-in">
        <h1>All Tools</h1>
        <p>Browse every tool across all categories — PDF, image, text, calculator, utilities, and more.</p>
      </div>

      {/* Search */}
      <div className="glass-panel animate-fade-in" style={{ padding: '0.75rem 1rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <Search size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Search tools…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            width: '100%',
            fontSize: '0.95rem',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {sections.length === 0 ? (
        <div className="glass-panel text-center" style={{ padding: '3rem' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No tools match "{query}"</p>
        </div>
      ) : (
        sections.map((section) => {
          const SectionIcon = section.icon;
          return (
            <div key={section.id} className="animate-fade-in" style={{ marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                {SectionIcon && <SectionIcon size={20} style={{ color: 'var(--accent-primary)' }} />}
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{section.label}</h2>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: '0.25rem' }}>
                  {section.tools.length} tool{section.tools.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '1rem',
              }}>
                {section.tools.map((tool) => {
                  const ToolIcon = tool.icon;
                  return (
                    <Link
                      key={tool.id}
                      to={tool.path}
                      className="glass-panel"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        padding: '1rem',
                        textDecoration: 'none',
                        color: 'inherit',
                        borderRadius: '12px',
                        transition: 'transform 0.2s, border-color 0.2s',
                        border: '1px solid var(--border-color)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = ''; }}
                    >
                      {ToolIcon && (
                        <div style={{
                          width: 36, height: 36, borderRadius: 8,
                          background: tool.color || 'rgba(99,102,241,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <ToolIcon size={18} style={{ color: 'var(--accent-primary)' }} />
                        </div>
                      )}
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{tool.name}</p>
                        {tool.description && (
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            {tool.description}
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default AllToolsPage;

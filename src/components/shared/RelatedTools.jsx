import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { pdfTools, textTools, calculatorTools } from '../../data/toolCatalog';
import { TiltCard } from '../ui/TiltCard';

const RelatedTools = ({ currentToolId, category }) => {
  let toolList = [];
  
  if (category === 'pdf') toolList = pdfTools;
  else if (category === 'text') toolList = textTools;
  else if (category === 'calculator') toolList = calculatorTools;

  // Filter out the current tool and pick up to 3 random/sequential related tools
  const related = toolList.filter(t => t.id !== currentToolId).slice(0, 3);

  if (related.length === 0) return null;

  return (
    <div className="related-tools mt-5">
      <h3 className="text-center mb-4 text-gradient">You Might Also Like</h3>
      <div className="tool-hub-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
        {related.map((tool, index) => {
          const Icon = tool.icon;
          return (
            <TiltCard
              key={tool.path}
              className="tool-hub-card glass-panel animate-fade-in"
              style={{ animationDelay: `${0.12 + index * 0.05}s`, padding: '1.5rem' }}
              tiltLimit={5}
              scale={1.02}
            >
              <div className="tool-hub-card-icon" style={{ background: tool.color, marginBottom: '1rem' }}>
                <Icon size={24} />
              </div>
              <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{tool.name}</h4>
              <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>{tool.description}</p>
              <Link to={tool.path} className="tool-hub-link" style={{ fontSize: '0.9rem' }}>
                Open Tool <ArrowRight size={14} />
              </Link>
            </TiltCard>
          );
        })}
      </div>
    </div>
  );
};

export default RelatedTools;

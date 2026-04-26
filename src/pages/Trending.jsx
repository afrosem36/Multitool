import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, Activity, Star, Loader2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import SeoHead from '../components/seo/SEOHead';
import { API_BASE_URL } from '../config';
import { utilityTools, pdfTools, imageTools, textTools, calculatorTools, excelTools, linkTools } from '../data/toolCatalog';
import styled from 'styled-components';

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 4rem;

  h1 {
    font-size: 3rem;
    font-weight: 800;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }

  p {
    color: var(--text-secondary);
    font-size: 1.2rem;
    max-width: 600px;
    margin: 0 auto;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
`;

const ToolCard = styled(Link)`
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  text-decoration: none;
  color: var(--text-primary);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(800px circle at var(--mouse-x) var(--mouse-y), rgba(255,255,255,0.06), transparent 40%);
    opacity: 0;
    transition: opacity 0.3s;
    pointer-events: none;
  }

  &:hover {
    transform: translateY(-4px);
    border-color: var(--primary-color);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);

    &::before {
      opacity: 1;
    }

    .tool-arrow {
      transform: translateX(4px);
      color: var(--primary-color);
    }
  }
`;

const ToolIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
  background: ${props => props.color || 'var(--primary-color)'};
  color: ${props => props.iconColor || 'var(--primary-color)'};
`;

const ToolHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

const Badge = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  background: \${props => props.$isHot ? 'rgba(239, 68, 68, 0.1)' : 'rgba(96, 165, 250, 0.1)'};
  color: \${props => props.$isHot ? '#ef4444' : '#60a5fa'};
`;

const allTools = [
  ...utilityTools, ...pdfTools, ...imageTools, 
  ...textTools, ...calculatorTools, ...excelTools, ...linkTools
];

// Curated list for fallback
const curatedToolsList = ['url-shortener', 'merge', 'image-compress', 'whatsapp-link-creator', 'pdf-to-jpg', 'qr-generator'];

export default function Trending() {
  const [trendingData, setTrendingData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/tools/trending`);
        const json = await res.json();
        if (json.data) {
          setTrendingData(json.data);
        }
      } catch (err) {
        console.error('Failed to load trending data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTrending();
  }, []);

  const handleMouseMove = (e) => {
    const cards = document.getElementsByClassName('tool-card-hover');
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    }
  };

  const displayTools = useMemo(() => {
    const mapIdToTool = (id) => allTools.find(t => t.id === id);

    let toolsToDisplay = [];
    
    // 1. Get dynamic tools from analytics
    const dynamicTools = trendingData
      .map(t => mapIdToTool(t.tool_id))
      .filter(Boolean); // filter out undefined

    // 2. Build hybrid list (70% dynamic / 30% curated)
    const MAX_TOOLS = 12; // Let's show 12 tools on the trending page
    
    const targetDynamicCount = Math.floor(MAX_TOOLS * 0.7);
    const usedDynamic = dynamicTools.slice(0, targetDynamicCount);
    
    toolsToDisplay = [...usedDynamic];

    // 3. Fill the rest with curated tools (ensuring no duplicates)
    for (const curId of curatedToolsList) {
      if (toolsToDisplay.length >= MAX_TOOLS) break;
      if (!toolsToDisplay.some(t => t.id === curId)) {
        const curTool = mapIdToTool(curId);
        if (curTool) toolsToDisplay.push(curTool);
      }
    }

    // 4. If we STILL don't have enough tools, just grab some random ones
    if (toolsToDisplay.length < MAX_TOOLS) {
      for (const t of allTools) {
        if (toolsToDisplay.length >= MAX_TOOLS) break;
        if (!toolsToDisplay.some(existing => existing.id === t.id)) {
          toolsToDisplay.push(t);
        }
      }
    }

    return toolsToDisplay.map((tool, index) => {
      // Is it a genuinely hot tool from analytics?
      const isDynamic = dynamicTools.some(t => t.id === tool.id);
      // Give the top 3 a special "Hot" badge
      const isHot = isDynamic && index < 3;
      return { ...tool, isHot, isDynamic };
    });
  }, [trendingData]);

  if (loading) {
    return (
      <Container style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Loader2 size={48} className="spin text-gradient" />
      </Container>
    );
  }

  return (
    <Container onMouseMove={handleMouseMove}>
      <SeoHead 
        title="Trending Tools" 
        description="Discover the most popular and highly used utilities on the platform right now."
      />
      
      <Header>
        <h1 className="text-gradient">
          <TrendingUp size={48} color="var(--primary-color)" /> Trending Tools
        </h1>
        <p>
          Discover what others are using right now. This list automatically updates based on real-time platform usage and popular features.
        </p>
      </Header>

      <Grid>
        {displayTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <ToolCard key={tool.id} to={tool.path} className="tool-card-hover" onClick={() => {
              // Fire and forget usage tracking
              fetch(`${API_BASE_URL}/api/tools/usage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toolId: tool.id })
              }).catch(() => {});
            }}>
              <ToolHeader>
                <ToolIcon color={tool.color}>
                  <Icon size={24} />
                </ToolIcon>
                {tool.isHot ? (
                  <Badge $isHot={true}><Activity size={12} /> Hot Now</Badge>
                ) : tool.isDynamic ? (
                  <Badge $isHot={false}><TrendingUp size={12} /> Trending</Badge>
                ) : (
                  <Badge style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)' }}>
                    <Star size={12} /> Featured
                  </Badge>
                )}
              </ToolHeader>
              
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>{tool.name}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', flex: 1, marginBottom: '1.5rem' }}>
                {tool.description}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '500', marginTop: 'auto' }}>
                Try it now <ArrowRight size={16} style={{ marginLeft: '0.5rem', transition: 'transform 0.2s' }} className="tool-arrow" />
              </div>
            </ToolCard>
          );
        })}
      </Grid>
    </Container>
  );
}

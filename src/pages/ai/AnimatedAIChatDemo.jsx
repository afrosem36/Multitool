import React from 'react';
import { AnimatedAIChat } from '../../components/ui/animated-ai-chat';
import SEOHead from '../../components/seo/SEOHead';

const AnimatedAIChatDemo = () => {
  return (
    <>
      <SEOHead
        title="Animated AI Chat - Interactive Assistant"
        description="Experience our advanced animated AI chat interface with command palette, file attachments, and real-time typing indicators."
        canonicalUrl="/ai-chat-demo"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'Animated AI Chat',
          description: 'Interactive AI chat with advanced UI features',
          url: 'https://multitoolhub.space/ai-chat-demo',
          applicationCategory: 'Communication',
        }}
      />

      <div style={{ width: '100%', minHeight: '100vh', background: 'var(--bg-dark)' }}>
        <AnimatedAIChat />
      </div>
    </>
  );
};

export default AnimatedAIChatDemo;

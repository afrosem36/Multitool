import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, ShieldCheck, Sparkles, Star, TrendingUp } from 'lucide-react';
import { aiTools, imageTools, linkTools, pdfTools, textTools, excelTools } from '../../data/toolCatalog';
import { homeFaqs } from '../../seo/seoConfig';
import { guideArticles, sitePages } from '../../data/contentPages';
import { useFavorites } from '../../hooks/useFavorites';
import { TiltCard } from '../../components/ui/TiltCard';
import SEOHead from '../../components/seo/SEOHead';
import '../styles/Home.css';

const Home = () => {
  const { isFavorite, toggleFavorite } = useFavorites();
  
  const advantages = [
    {
      title: 'All-In-One Workspace',
      description: 'Access PDF tools, image utilities, text utilities, and quick link generators from one searchable browser workspace.'
    },
    {
      title: 'Fast Browser-Based Tools',
      description: 'Most tasks run instantly in your browser so you can edit, convert, and clean content without heavy software.'
    },
    {
      title: 'Useful For Daily Work',
      description: 'Handle PDFs, cleanup copied text, generate passwords, and prepare WhatsApp links for business or personal use.'
    },
    {
      title: 'Simple, Direct Workflow',
      description: 'Pick a tool, upload or paste your content, and export the result in a few clicks.'
    }
  ];

  const steps = [
    'Choose a tool from the PDF, image, text, or link creator sections.',
    'Upload files or paste the content you want to process.',
    'Preview the result, then download, copy, or share it instantly.'
  ];

  const trustPages = sitePages.filter((page) =>
    ['/privacy-policy', '/about-us', '/contact-us'].includes(page.path)
  );

  return (
    <div className="home-container">
      <SEOHead 
        title="MultiTool"
        description="Smart online tools for PDF, text, image, and link tasks. Browser-based utilities for documents, text cleanup, images, and business communication."
        canonicalUrl="/"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "MultiTool",
          "url": "https://multitool.vercel.app",
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://multitool.vercel.app/search?q={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        }}
      />
      <section className="hero-section text-center">
        <p className="hero-kicker">Tools + Guides + Trust Pages</p>
        <h1 className="hero-title animate-fade-in">
          Smart online tools for <span className="text-gradient">PDF, text, image, and link tasks</span>
        </h1>
        <p className="hero-subtitle animate-fade-in" style={{ animationDelay: '0.1s' }}>
          MultiTool helps you merge PDFs, clean text, convert files, and create share-ready links. It also includes
          helpful guides, policy pages, and clear navigation so visitors can both use the tools and understand the
          workflows behind them.
        </p>
        <div className="hero-actions animate-fade-in" style={{ animationDelay: '0.16s' }}>
          <Link to="/explore" className="btn-primary">
            Explore Tools
          </Link>
          <Link to="/guides" className="btn-secondary">
            Read Guides
          </Link>
        </div>
      </section>

      {/* Trending Banner */}
      <section className="feature-section" style={{ padding: '0 1rem' }}>
        <Link to="/trending" className="glass-panel" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '1.5rem 2rem',
          textDecoration: 'none',
          color: 'inherit',
          borderRadius: '1.5rem',
          background: 'linear-gradient(90deg, rgba(var(--primary-rgb), 0.1), rgba(var(--accent-rgb), 0.1))',
          border: '1px solid var(--border-color)',
          transition: 'transform 0.3s ease',
          marginBottom: '2rem'
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.01)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ 
              background: 'var(--primary-color)', 
              color: 'white', 
              padding: '0.75rem', 
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>See What's Trending Now</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Discover the most used tools by our community today.</p>
            </div>
          </div>
          <ArrowRight size={24} color="var(--text-secondary)" />
        </Link>
      </section>

      <section className="feature-section">
        <div className="home-intro-grid">
          <article className="home-intro-card glass-panel">
            <div className="home-intro-icon">
              <Sparkles size={22} />
            </div>
            <h2>What this site does</h2>
            <p>
              The website brings together browser-based utilities for documents, text cleanup, images, and business
              communication. Instead of hunting for a separate converter, formatter, and link generator, you can
              handle common tasks from one organized workspace.
            </p>
          </article>
          <article className="home-intro-card glass-panel">
            <div className="home-intro-icon">
              <BookOpen size={22} />
            </div>
            <h2>Why the guides matter</h2>
            <p>
              Helpful content pages explain which tool to choose, when a file format makes sense, and how to avoid
              quality or workflow mistakes. That gives visitors more value than a tool page alone.
            </p>
          </article>
          <article className="home-intro-card glass-panel">
            <div className="home-intro-icon">
              <ShieldCheck size={22} />
            </div>
            <h2>Built for trust</h2>
            <p>
              The site now includes About Us, Privacy Policy, and Contact Us pages so people and advertisers can see
              that there is a real information structure behind the tools.
            </p>
          </article>
        </div>
      </section>

      <section className="feature-section">
        <div className="section-heading">
          <h2>PDF Tools</h2>
          <p>
            Convert, organize, secure, merge, split, and export PDF files online from one place. These pages are
            useful for school documents, office paperwork, proposals, reports, invoices, and scanned files.
          </p>
        </div>

        <div className="features-grid">
          {pdfTools.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <TiltCard
                key={feature.path}
                className="feature-card glass-panel animate-fade-in"
                style={{ animationDelay: `${0.2 + index * 0.06}s`, position: 'relative' }}
                tiltLimit={5}
                scale={1.02}
              >
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    toggleFavorite(feature.id);
                  }}
                  style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: isFavorite(feature.id) ? '#eab308' : 'var(--text-secondary)',
                    zIndex: 10
                  }}
                  title={isFavorite(feature.id) ? "Remove from Favorites" : "Add to Favorites"}
                >
                  <Star size={20} fill={isFavorite(feature.id) ? '#eab308' : 'none'} />
                </button>
                <div className="feature-icon-wrapper" style={{ background: feature.color }}>
                  <Icon size={32} className="feature-icon text-gradient" />
                </div>
                <h3>{feature.name}</h3>
                <p>{feature.description}</p>
                <Link to={feature.path} className="feature-link">
                  Open Tool <ArrowRight size={16} />
                </Link>
              </TiltCard>
            );
          })}
        </div>
      </section>

      <section className="feature-section">
        <div className="section-heading">
          <h2>Image Tools</h2>
          <p>
            Compress, enhance, convert, and combine images online. These tools help with social media assets, product
            images, document preparation, quick design exports, and format cleanup without leaving the browser.
          </p>
        </div>

        <div className="features-grid">
          {imageTools.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <TiltCard
                key={feature.path}
                className="feature-card glass-panel animate-fade-in"
                style={{ animationDelay: `${0.22 + index * 0.06}s`, position: 'relative' }}
                tiltLimit={5}
                scale={1.02}
              >
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    toggleFavorite(feature.id);
                  }}
                  style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: isFavorite(feature.id) ? '#eab308' : 'var(--text-secondary)',
                    zIndex: 10
                  }}
                  title={isFavorite(feature.id) ? "Remove from Favorites" : "Add to Favorites"}
                >
                  <Star size={20} fill={isFavorite(feature.id) ? '#eab308' : 'none'} />
                </button>
                <div className="feature-icon-wrapper" style={{ background: feature.color }}>
                  <Icon size={32} className="feature-icon text-gradient" />
                </div>
                <h3>{feature.name}</h3>
                <p>{feature.description}</p>
                <Link to={feature.path} className="feature-link">
                  Open Tool <ArrowRight size={16} />
                </Link>
              </TiltCard>
            );
          })}
        </div>
      </section>

      <section className="feature-section">
        <div className="section-heading">
          <h2>Text Tools</h2>
          <p>
            Clean pasted text, remove unwanted formatting, generate useful random content, and export the result
            instantly. These tools are especially helpful when text comes from PDFs, spreadsheets, websites, or AI
            outputs.
          </p>
        </div>

        <div className="features-grid">
          {textTools.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <TiltCard
                key={feature.path}
                className="feature-card glass-panel animate-fade-in"
                style={{ animationDelay: `${0.25 + index * 0.06}s`, position: 'relative' }}
                tiltLimit={5}
                scale={1.02}
              >
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    toggleFavorite(feature.id);
                  }}
                  style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: isFavorite(feature.id) ? '#eab308' : 'var(--text-secondary)',
                    zIndex: 10
                  }}
                  title={isFavorite(feature.id) ? "Remove from Favorites" : "Add to Favorites"}
                >
                  <Star size={20} fill={isFavorite(feature.id) ? '#eab308' : 'none'} />
                </button>
                <div className="feature-icon-wrapper" style={{ background: feature.color }}>
                  <Icon size={32} className="feature-icon text-gradient" />
                </div>
                <h3>{feature.name}</h3>
                <p>{feature.description}</p>
                <Link to={feature.path} className="feature-link">
                  Open Tool <ArrowRight size={16} />
                </Link>
              </TiltCard>
            );
          })}
        </div>
      </section>

      <section className="feature-section">
        <div className="section-heading">
          <h2>Link Tools</h2>
          <p>
            Create share-ready communication links for WhatsApp campaigns, customer support, and contact pages. This
            keeps outreach flows faster and more consistent for businesses and solo operators.
          </p>
        </div>

        <div className="features-grid features-grid-compact">
          {linkTools.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <TiltCard
                key={feature.path}
                className="feature-card glass-panel animate-fade-in"
                style={{ animationDelay: `${0.3 + index * 0.06}s`, position: 'relative' }}
                tiltLimit={5}
                scale={1.02}
              >
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    toggleFavorite(feature.id);
                  }}
                  style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: isFavorite(feature.id) ? '#eab308' : 'var(--text-secondary)',
                    zIndex: 10
                  }}
                  title={isFavorite(feature.id) ? "Remove from Favorites" : "Add to Favorites"}
                >
                  <Star size={20} fill={isFavorite(feature.id) ? '#eab308' : 'none'} />
                </button>
                <div className="feature-icon-wrapper" style={{ background: feature.color }}>
                  <Icon size={32} className="feature-icon text-gradient" />
                </div>
                <h3>{feature.name}</h3>
                <p>{feature.description}</p>
                <Link to={feature.path} className="feature-link">
                  Open Tool <ArrowRight size={16} />
                </Link>
              </TiltCard>
            );
          })}
        </div>
      </section>

      <section className="feature-section">
        <div className="section-heading">
          <h2>Featured Guides</h2>
          <p>
            Useful reading for visitors who want more than a button. These long-form pages help explain formats,
            workflows, and best practices around the most common tasks on the site.
          </p>
        </div>

        <div className="features-grid">
          {guideArticles.map((article, index) => (
            <TiltCard
              key={article.path}
              className="feature-card glass-panel animate-fade-in"
              style={{ animationDelay: `${0.18 + index * 0.04}s` }}
              tiltLimit={5}
              scale={1.02}
            >
              <div className="guide-meta-row">
                <span>{article.category}</span>
                <span>{article.readTime}</span>
              </div>
              <h3>{article.title}</h3>
              <p>{article.description}</p>
              <Link to={article.path} className="feature-link">
                Read Guide <ArrowRight size={16} />
              </Link>
            </TiltCard>
          ))}
        </div>
      </section>

      <section className="feature-section">
        <div className="section-heading">
          <h2>Why Use MultiTool</h2>
          <p>Designed as an online toolkit for creators, students, offices, and anyone who needs quick utility tools.</p>
        </div>

        <div className="content-grid">
          {advantages.map((item) => (
            <article key={item.title} className="content-card glass-panel">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="feature-section">
        <div className="section-heading">
          <h2>Site Information</h2>
          <p>
            These pages help visitors understand who runs the website, how the site handles privacy, and how to get
            in touch if they need support or want to report an issue.
          </p>
        </div>

        <div className="content-grid">
          {trustPages.map((page) => (
            <article key={page.path} className="content-card glass-panel">
              <h3>{page.title}</h3>
              <p>{page.description}</p>
              <Link to={page.path} className="feature-link">
                Open Page <ArrowRight size={16} />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="feature-section">
        <div className="section-heading">
          <h2>AI Tools</h2>
          <p>
            Intelligent AI-powered tools for conversations, analysis, and smart text enhancement. Powered by advanced language models with secure processing.
          </p>
        </div>

        <div className="features-grid">
          {aiTools.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <TiltCard
                key={feature.path}
                className="feature-card glass-panel animate-fade-in"
                style={{ animationDelay: `${0.2 + index * 0.06}s`, position: 'relative' }}
                tiltLimit={5}
                scale={1.02}
              >
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    toggleFavorite(feature.id);
                  }}
                  style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: isFavorite(feature.id) ? '#eab308' : 'var(--text-secondary)',
                    zIndex: 10
                  }}
                  title={isFavorite(feature.id) ? "Remove from Favorites" : "Add to Favorites"}
                >
                  <Star size={20} fill={isFavorite(feature.id) ? '#eab308' : 'none'} />
                </button>
                <div className="feature-icon-wrapper" style={{ background: feature.color }}>
                  <Icon size={32} className="feature-icon text-gradient" />
                </div>
                <h3>{feature.name}</h3>
                <p>{feature.description}</p>
                <Link to={feature.path} className="feature-link">
                  Open Tool <ArrowRight size={16} />
                </Link>
              </TiltCard>
            );
          })}
        </div>
      </section>

      <section className="feature-section">
        <div className="section-heading">
          <h2>How It Works</h2>
          <p>Use the toolkit in three simple steps.</p>
        </div>

        <div className="steps-grid">
          {steps.map((step, index) => (
            <article key={step} className="step-card glass-panel">
              <span className="step-number">0{index + 1}</span>
              <p>{step}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Trust & Security Section */}
      <section className="feature-section trust-section">
        <div className="section-heading">
          <h2>Why Users Trust MultiTool</h2>
          <p>Built with privacy, security, and user experience as core principles.</p>
        </div>

        <div className="trust-grid">
          <article className="trust-card glass-panel">
            <div className="trust-icon">🔒</div>
            <h3>100% Private</h3>
            <p>All files are processed locally in your browser. Nothing is uploaded to our servers.</p>
          </article>
          <article className="trust-card glass-panel">
            <div className="trust-icon">⚡</div>
            <h3>Lightning Fast</h3>
            <p>Instant processing without waiting for uploads or server responses. Get results immediately.</p>
          </article>
          <article className="trust-card glass-panel">
            <div className="trust-icon">💰</div>
            <h3>100% Free</h3>
            <p>No subscriptions, no hidden fees, no premium tiers. Everything is completely free forever.</p>
          </article>
          <article className="trust-card glass-panel">
            <div className="trust-icon">🌐</div>
            <h3>Works Everywhere</h3>
            <p>Runs on any modern browser, any device. Windows, Mac, Linux, iOS, Android - no installation needed.</p>
          </article>
          <article className="trust-card glass-panel">
            <div className="trust-icon">👥</div>
            <h3>Built for Real Workflows</h3>
            <p>Designed for students, professionals, and businesses who need quick, reliable tools for everyday document tasks.</p>
          </article>
          <article className="trust-card glass-panel">
            <div className="trust-icon">🛠️</div>
            <h3>Constantly Improving</h3>
            <p>Regular updates with new tools and features based on user feedback and needs.</p>
          </article>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="feature-section stats-section">
        <div className="section-heading">
          <h2>By The Numbers</h2>
          <p>MultiTool impact and reach across our user base.</p>
        </div>

        <div className="stats-grid">
          <article className="stat-card glass-panel">
            <h3 className="stat-number">50+</h3>
            <p>Professional Tools</p>
          </article>
          <article className="stat-card glass-panel">
            <h3 className="stat-number">0</h3>
            <p>Files Stored on Servers</p>
          </article>
          <article className="stat-card glass-panel">
            <h3 className="stat-number">100%</h3>
            <p>Browser-Based Processing</p>
          </article>
          <article className="stat-card glass-panel">
            <h3 className="stat-number">24/7</h3>
            <p>Service Availability</p>
          </article>
        </div>
      </section>

      {/* About Us CTA */}
      <section className="feature-section about-cta-section">
        <article className="about-cta glass-panel gradient-border">
          <h2>About MultiTool</h2>
          <p>
            Learn more about our mission to provide free, fast, and reliable tools for everyone.
            Discover our values, team, and commitment to quality.
          </p>
          <Link to="/about-us" className="btn-primary">
            Learn More About Us
          </Link>
        </article>
      </section>

      <section className="feature-section">
        <div className="section-heading">
          <h2>FAQ</h2>
          <p>Quick answers about the PDF tools, text tools, and link generator available on this website.</p>
        </div>

        <div className="faq-list">
          {homeFaqs.map((item) => (
            <article key={item.question} className="faq-card glass-panel">
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;

import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { ArrowRight, BookOpen, ShieldCheck, Sparkles, Star, TrendingUp, Zap, FileText, Image, Cpu } from 'lucide-react';
import { aiTools, imageTools, linkTools, pdfTools, textTools } from '../../data/toolCatalog';
import { homeFaqs } from '../../seo/seoConfig';
import { guideArticles, sitePages } from '../../data/contentPages';
import { useFavorites } from '../../hooks/useFavorites';
import { TiltCard } from '../../components/ui/TiltCard';
import SEOHead from '../../components/seo/SEOHead';
import '../styles/Home.css';

const MotionLink = motion.create(Link);

// ── Scroll-triggered section wrapper ─────────────────────────────────────────
function FadeUp({ children, delay = 0, className, style }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const classes = ['home-section-wrap', className].filter(Boolean).join(' ');
  return (
    <motion.div
      ref={ref}
      className={classes}
      style={style}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
const STATS = [
  { value: '50+',  label: 'Free Tools',     icon: Zap },
  { value: 'AI',   label: 'Powered Tools',  icon: Cpu },
  { value: '100%', label: 'Browser-Based',  icon: ShieldCheck },
  { value: '∞',    label: 'Always Free',    icon: Sparkles },
];

const HERO_TITLE_LINES = [
  [
    { text: 'Your' },
    { text: 'complete' },
    { text: 'toolkit', accent: true },
  ],
  [
    { text: 'for' },
    { text: 'everyday' },
    { text: 'work' },
  ],
];

const Home = () => {
  const { isFavorite, toggleFavorite } = useFavorites();
  const shouldReduceMotion = useReducedMotion();

  const heroContainer = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.1,
        delayChildren: shouldReduceMotion ? 0 : 0.08,
      },
    },
  };

  const heroReveal = {
    hidden: {
      opacity: shouldReduceMotion ? 1 : 0,
      y: shouldReduceMotion ? 0 : 22,
      filter: shouldReduceMotion ? 'blur(0px)' : 'blur(16px)',
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.82,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const heroWord = {
    hidden: {
      opacity: shouldReduceMotion ? 1 : 0,
      y: shouldReduceMotion ? 0 : 34,
      filter: shouldReduceMotion ? 'blur(0px)' : 'blur(10px)',
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.72,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const statReveal = {
    hidden: {
      opacity: shouldReduceMotion ? 1 : 0,
      y: shouldReduceMotion ? 0 : 18,
      scale: shouldReduceMotion ? 1 : 0.96,
      filter: shouldReduceMotion ? 'blur(0px)' : 'blur(8px)',
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.52,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

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

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="hero-section text-center" aria-labelledby="home-hero-title">
        <div className="hero-background" aria-hidden="true">
          <motion.div
            className="hero-aurora hero-aurora-one"
            animate={shouldReduceMotion ? undefined : { x: [0, 18, -10, 0], y: [0, -16, 8, 0], scale: [1, 1.06, 0.98, 1] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="hero-aurora hero-aurora-two"
            animate={shouldReduceMotion ? undefined : { x: [0, -16, 12, 0], y: [0, 14, -10, 0], scale: [1, 0.97, 1.05, 1] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="hero-grid" />
          <div className="hero-vignette" />
        </div>

        <motion.div
          className="hero-content"
          variants={heroContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="hero-badge" variants={heroReveal}>
            <span className="hero-badge-dot" />
            <Sparkles size={14} aria-hidden="true" />
            <span>AI-powered workflow suite</span>
            <span className="hero-badge-divider" />
            <span>50+ browser tools</span>
          </motion.div>

          <motion.h1 id="home-hero-title" className="hero-title" variants={heroContainer}>
            {HERO_TITLE_LINES.map((line, lineIndex) => (
              <span className="hero-title-line" key={`hero-line-${lineIndex}`}>
                {line.map((word) => (
                  <motion.span
                    className={word.accent ? 'hero-word hero-gradient-word' : 'hero-word'}
                    variants={heroWord}
                    key={`${lineIndex}-${word.text}`}
                  >
                    {word.text}
                  </motion.span>
                ))}
              </span>
            ))}
          </motion.h1>

          <motion.p className="hero-subtitle" variants={heroReveal}>
            Merge PDFs, convert images, generate SQL with AI, transcribe audio, and 50+ more tools.
            All free, all in your browser, nothing to install.
          </motion.p>

          <motion.div className="hero-actions" variants={heroReveal}>
            <MotionLink
              to="/explore"
              className="btn-hero-primary"
              whileHover={shouldReduceMotion ? undefined : { y: -3, scale: 1.015 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            >
              <span>Explore All Tools</span>
              <ArrowRight size={18} />
            </MotionLink>
            <MotionLink
              to="/ai-tools"
              className="btn-hero-secondary"
              whileHover={shouldReduceMotion ? undefined : { y: -3, scale: 1.015 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            >
              <Sparkles size={16} />
              <span>Try AI Tools</span>
            </MotionLink>
          </motion.div>

          <motion.div className="hero-stats" variants={heroContainer}>
            {STATS.map(({ value, label, icon: Icon }, i) => (
              <motion.div
                key={label}
                className="hero-stat"
                variants={statReveal}
                custom={i}
              >
                <div className="hero-stat-icon"><Icon size={15} /></div>
                <span className="hero-stat-value">{value}</span>
                <span className="hero-stat-label">{label}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── Trending Banner ───────────────────────────────────────────────── */}
      <FadeUp>
        <section className="feature-section trending-banner-section">
          <Link to="/trending" className="trending-banner glass-panel">
            <div className="trending-banner-left">
              <div className="trending-banner-icon">
                <TrendingUp size={22} />
              </div>
              <div>
                <h3 className="trending-banner-title">See What's Trending Now</h3>
                <p className="trending-banner-sub">Discover the most used tools by our community today.</p>
              </div>
            </div>
            <ArrowRight size={20} className="trending-banner-arrow" />
          </Link>
        </section>
      </FadeUp>

      {/* ── Intro Cards ───────────────────────────────────────────────────── */}
      <FadeUp>
        <section className="feature-section">
          <div className="home-intro-grid">
            <article className="home-intro-card glass-panel">
              <div className="home-intro-icon">
                <Sparkles size={22} />
              </div>
              <h2>What this site does</h2>
              <p>
                Browser-based utilities for documents, text cleanup, images, and business communication —
                handle common tasks from one organized workspace without installing anything.
              </p>
            </article>
            <article className="home-intro-card glass-panel">
              <div className="home-intro-icon">
                <BookOpen size={22} />
              </div>
              <h2>Why the guides matter</h2>
              <p>
                Helpful content pages explain which tool to choose, when a file format makes sense, and how to avoid
                quality or workflow mistakes. More value than a tool page alone.
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
      </FadeUp>

      {/* ── PDF Tools ─────────────────────────────────────────────────────── */}
      <FadeUp delay={0.05}>
        <section className="feature-section">
          <div className="section-heading">
            <div className="section-label"><FileText size={14} /> PDF Tools</div>
            <h2>PDF Tools</h2>
            <p>
              Merge, split, convert, protect, watermark, and export PDF files — all online, no software needed.
            </p>
          </div>

          <div className="features-grid">
            {pdfTools.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <TiltCard
                  key={feature.path}
                  className="feature-card glass-panel stagger-card"
                  style={{ position: 'relative', '--card-delay': `${index * 0.04}s` }}
                  tiltLimit={5}
                  scale={1.02}
                >
                  <button
                    onClick={(e) => { e.preventDefault(); toggleFavorite(feature.id); }}
                    style={{
                      position: 'absolute', top: '1rem', right: '1rem',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: isFavorite(feature.id) ? '#eab308' : 'var(--text-secondary)', zIndex: 10
                    }}
                    title={isFavorite(feature.id) ? 'Remove from Favorites' : 'Add to Favorites'}
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
      </FadeUp>

      {/* ── Image Tools ───────────────────────────────────────────────────── */}
      <FadeUp>
        <section className="feature-section">
          <div className="section-heading">
            <div className="section-label"><Image size={14} /> Image Tools</div>
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
                  className="feature-card glass-panel stagger-card"
                  style={{ '--card-delay': `${index * 0.06}s`, position: 'relative' }}
                  tiltLimit={5}
                  scale={1.02}
                >
                  <button
                    onClick={(e) => { e.preventDefault(); toggleFavorite(feature.id); }}
                    style={{
                      position: 'absolute', top: '1rem', right: '1rem',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: isFavorite(feature.id) ? '#eab308' : 'var(--text-secondary)', zIndex: 10
                    }}
                    title={isFavorite(feature.id) ? 'Remove from Favorites' : 'Add to Favorites'}
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
      </FadeUp>

      {/* ── Text Tools ────────────────────────────────────────────────────── */}
      <FadeUp>
        <section className="feature-section">
          <div className="section-heading">
            <div className="section-label">Text Tools</div>
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
                  className="feature-card glass-panel stagger-card"
                  style={{ '--card-delay': `${index * 0.06}s`, position: 'relative' }}
                  tiltLimit={5}
                  scale={1.02}
                >
                  <button
                    onClick={(e) => { e.preventDefault(); toggleFavorite(feature.id); }}
                    style={{
                      position: 'absolute', top: '1rem', right: '1rem',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: isFavorite(feature.id) ? '#eab308' : 'var(--text-secondary)', zIndex: 10
                    }}
                    title={isFavorite(feature.id) ? 'Remove from Favorites' : 'Add to Favorites'}
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
      </FadeUp>

      {/* ── Link Tools ────────────────────────────────────────────────────── */}
      <FadeUp>
        <section className="feature-section">
          <div className="section-heading">
            <div className="section-label">Link Tools</div>
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
                  className="feature-card glass-panel stagger-card"
                  style={{ '--card-delay': `${index * 0.06}s`, position: 'relative' }}
                  tiltLimit={5}
                  scale={1.02}
                >
                  <button
                    onClick={(e) => { e.preventDefault(); toggleFavorite(feature.id); }}
                    style={{
                      position: 'absolute', top: '1rem', right: '1rem',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: isFavorite(feature.id) ? '#eab308' : 'var(--text-secondary)', zIndex: 10
                    }}
                    title={isFavorite(feature.id) ? 'Remove from Favorites' : 'Add to Favorites'}
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
      </FadeUp>

      {/* ── AI Tools ──────────────────────────────────────────────────────── */}
      <FadeUp>
        <section className="feature-section">
          <div className="section-heading">
            <div className="section-label"><Cpu size={14} /> AI Tools</div>
            <h2>AI Tools</h2>
            <p>
              Intelligent AI-powered tools for conversations, analysis, and smart text enhancement. Powered by advanced
              language models with secure processing.
            </p>
          </div>

          <div className="features-grid">
            {aiTools.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <TiltCard
                  key={feature.path}
                  className="feature-card glass-panel stagger-card"
                  style={{ '--card-delay': `${index * 0.06}s`, position: 'relative' }}
                  tiltLimit={5}
                  scale={1.02}
                >
                  <button
                    onClick={(e) => { e.preventDefault(); toggleFavorite(feature.id); }}
                    style={{
                      position: 'absolute', top: '1rem', right: '1rem',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: isFavorite(feature.id) ? '#eab308' : 'var(--text-secondary)', zIndex: 10
                    }}
                    title={isFavorite(feature.id) ? 'Remove from Favorites' : 'Add to Favorites'}
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
      </FadeUp>

      {/* ── Featured Guides ───────────────────────────────────────────────── */}
      <FadeUp>
        <section className="feature-section">
          <div className="section-heading">
            <div className="section-label"><BookOpen size={14} /> Guides</div>
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
                className="feature-card glass-panel stagger-card"
                style={{ '--card-delay': `${index * 0.05}s` }}
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
      </FadeUp>

      {/* ── Why Use MultiTool ─────────────────────────────────────────────── */}
      <FadeUp>
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
      </FadeUp>

      {/* ── Site Information ──────────────────────────────────────────────── */}
      <FadeUp>
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
      </FadeUp>

      {/* ── How It Works ──────────────────────────────────────────────────── */}
      <FadeUp>
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
      </FadeUp>

      {/* ── Trust & Security ──────────────────────────────────────────────── */}
      <FadeUp>
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
      </FadeUp>

      {/* ── Statistics ────────────────────────────────────────────────────── */}
      <FadeUp>
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
      </FadeUp>

      {/* ── About CTA ─────────────────────────────────────────────────────── */}
      <FadeUp>
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
      </FadeUp>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <FadeUp>
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
      </FadeUp>
    </div>
  );
};

export default Home;

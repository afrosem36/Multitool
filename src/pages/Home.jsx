import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, ShieldCheck, Sparkles } from 'lucide-react';
import { linkTools, pdfTools, textTools } from '../data/toolCatalog';
import { homeFaqs } from '../seo/seoConfig';
import { guideArticles, sitePages } from '../data/contentPages';
import './Home.css';

const Home = () => {
  const advantages = [
    {
      title: 'All-In-One Workspace',
      description: 'Access PDF tools, text utilities, and quick link generators from one searchable browser workspace.'
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
    'Choose a tool from the PDF, text, or link creator sections.',
    'Upload files or paste the content you want to process.',
    'Preview the result, then download, copy, or share it instantly.'
  ];

  const trustPages = sitePages.filter((page) =>
    ['/privacy-policy', '/about-us', '/contact-us'].includes(page.path)
  );

  return (
    <div className="home-container">
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
          <Link to="/pdf-tools" className="btn-primary">
            Explore Tools
          </Link>
          <Link to="/guides" className="btn-secondary">
            Read Guides
          </Link>
        </div>
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
              <div
                key={feature.path}
                className="feature-card glass-panel animate-fade-in"
                style={{ animationDelay: `${0.2 + index * 0.06}s` }}
              >
                <div className="feature-icon-wrapper" style={{ background: feature.color }}>
                  <Icon size={32} className="feature-icon text-gradient" />
                </div>
                <h3>{feature.name}</h3>
                <p>{feature.description}</p>
                <Link to={feature.path} className="feature-link">
                  Open Tool <ArrowRight size={16} />
                </Link>
              </div>
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
              <div
                key={feature.path}
                className="feature-card glass-panel animate-fade-in"
                style={{ animationDelay: `${0.25 + index * 0.06}s` }}
              >
                <div className="feature-icon-wrapper" style={{ background: feature.color }}>
                  <Icon size={32} className="feature-icon text-gradient" />
                </div>
                <h3>{feature.name}</h3>
                <p>{feature.description}</p>
                <Link to={feature.path} className="feature-link">
                  Open Tool <ArrowRight size={16} />
                </Link>
              </div>
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
              <div
                key={feature.path}
                className="feature-card glass-panel animate-fade-in"
                style={{ animationDelay: `${0.3 + index * 0.06}s` }}
              >
                <div className="feature-icon-wrapper" style={{ background: feature.color }}>
                  <Icon size={32} className="feature-icon text-gradient" />
                </div>
                <h3>{feature.name}</h3>
                <p>{feature.description}</p>
                <Link to={feature.path} className="feature-link">
                  Open Tool <ArrowRight size={16} />
                </Link>
              </div>
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
            <article
              key={article.path}
              className="feature-card glass-panel animate-fade-in"
              style={{ animationDelay: `${0.18 + index * 0.04}s` }}
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
            </article>
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

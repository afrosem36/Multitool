import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { linkTools, pdfTools, textTools } from '../data/toolCatalog';
import { homeFaqs } from '../seo/seoConfig';
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

  return (
    <div className="home-container">
      <section className="hero-section text-center">
        <h1 className="hero-title animate-fade-in">
          Premium <span className="text-gradient">PDF Tools</span>
        </h1>
        <p className="hero-subtitle animate-fade-in" style={{ animationDelay: '0.1s' }}>
          MultiTool gives you online PDF tools, text tools, random generators, and a WhatsApp link creator in one browser-based workspace.
        </p>
      </section>

      <section className="feature-section">
        <div className="section-heading">
          <h2>PDF Tools</h2>
          <p>Convert, organize, secure, merge, split, and export PDF files online from one place.</p>
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
          <p>Clean pasted text, remove unwanted formatting, generate useful random content, and export the result instantly.</p>
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
          <p>Create share-ready communication links for WhatsApp campaigns, customer support, and contact pages.</p>
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

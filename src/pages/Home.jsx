import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { pdfTools, textTools } from '../data/toolCatalog';
import './Home.css';

const Home = () => {
  return (
    <div className="home-container">
      <div className="hero-section text-center">
        <h1 className="hero-title animate-fade-in">
          Premium <span className="text-gradient">PDF Tools</span>
        </h1>
        <p className="hero-subtitle animate-fade-in" style={{ animationDelay: '0.1s' }}>
          A single browser workspace for PDF jobs, text cleanup, and quick link utilities, with a dedicated sidebar so every tool stays easy to reach.
        </p>
      </div>

      <section className="feature-section">
        <div className="section-heading">
          <h2>PDF Tools</h2>
          <p>Convert, organize, secure, and export your files from one place.</p>
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
          <p>Clean pasted text, remove unwanted formatting, and export the result instantly.</p>
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
    </div>
  );
};

export default Home;

import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { findGuideByPath } from '../data/contentPages';
import './ContentPage.css';

const ArticlePage = () => {
  const location = useLocation();
  const article = findGuideByPath(location.pathname);

  if (!article) {
    return <Navigate to="/" replace />;
  }

  return (
    <article className="content-page">
      <section className="content-hero glass-panel">
        <p className="content-kicker">{article.category}</p>
        <h1>{article.title}</h1>
        <p>{article.intro}</p>
        <div className="content-meta">
          <span className="content-chip">{article.readTime}</span>
          <span className="content-chip">{article.category}</span>
        </div>
      </section>

      {article.sections.map((section) => (
        <section key={section.heading} className="content-block glass-panel">
          <h2>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}

      <section className="content-cta glass-panel">
        <div className="content-cta-copy">
          <h2>Need the related tool?</h2>
          <p>Use the utility pages for hands-on work, then come back to the guides when you want workflow tips.</p>
        </div>
        <Link to="/" className="btn-primary">
          Open Tools
        </Link>
      </section>
    </article>
  );
};

export default ArticlePage;

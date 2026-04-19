import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { guideArticles } from '../data/contentPages';
import './ContentPage.css';

const GuidesHubPage = () => {
  return (
    <div className="guides-hub-page">
      <section className="content-hero glass-panel">
        <p className="content-kicker">Learning Center</p>
        <h1>Guides and Tutorials</h1>
        <p>
          Browse practical articles about PDF workflows, image conversion, text cleanup, and business communication.
          These pages add context around the tools so visitors can learn when to use each workflow and how to get
          cleaner results.
        </p>
      </section>

      <div className="guides-grid">
        {guideArticles.map((article) => (
          <article key={article.path} className="guide-card glass-panel">
            <div className="guide-card-meta">
              <span>{article.category}</span>
              <span>{article.readTime}</span>
            </div>
            <h2>{article.title}</h2>
            <p>{article.description}</p>
            <Link to={article.path} className="guide-link">
              Read Guide <ArrowRight size={16} />
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
};

export default GuidesHubPage;

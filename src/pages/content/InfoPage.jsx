import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { findSitePageByPath } from '../../data/contentPages';
import '../styles/ContentPage.css';

const InfoPage = () => {
  const location = useLocation();
  const page = findSitePageByPath(location.pathname);

  if (!page) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="content-page">
      <section className="content-hero glass-panel">
        <p className="content-kicker">Site Information</p>
        <h1>{page.title}</h1>
        <p>{page.intro}</p>
      </section>

      {page.path === '/contact-us' && (
        <section className="content-block glass-panel">
          <h2>Quick Contact Options</h2>
          <div className="contact-list">
            <div className="contact-item">
              <strong>Support Email</strong>
              <p>support@multitool-help.com</p>
            </div>
            <div className="contact-item">
              <strong>Typical Topics</strong>
              <p>Tool issues, broken pages, content corrections, partnership requests, and general feedback.</p>
            </div>
            <div className="contact-item">
              <strong>Useful Details to Include</strong>
              <p>Page URL, device, browser, file type, and the exact steps needed to reproduce the problem.</p>
            </div>
          </div>
        </section>
      )}

      {page.sections.map((section) => (
        <section key={section.heading} className="content-block glass-panel">
          <h2>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}

      <section className="content-cta glass-panel">
        <div className="content-cta-copy">
          <h2>Explore the tools and guides</h2>
          <p>Move between practical utilities and step-by-step articles from one place.</p>
        </div>
        <Link to="/guides" className="btn-primary">
          Browse Guides
        </Link>
      </section>
    </div>
  );
};

export default InfoPage;

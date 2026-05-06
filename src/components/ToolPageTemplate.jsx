import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Shield, Zap, Lock, Award } from 'lucide-react';
import SEOHead from './seo/SEOHead';
import RelatedTools from './shared/RelatedTools';
import '../pages/styles/ToolPageTemplate.css';

/**
 * Professional Tool Page Template - Used by all tool pages
 * Fixes "thin content" issues and ensures AdSense compliance
 */
const ToolPageTemplate = ({
  title,
  description,
  canonical,
  toolInterface,
  content,
  relatedTools,
  jsonSchema,
  children // Allow tool-specific content
}) => {
  if (!content) {
    return <div>{children}</div>;
  }

  const { overview, benefits, useCases, howToUse, tips, faqItems } = content.richContent || {};

  return (
    <>
      <SEOHead
        title={title}
        description={description}
        canonicalUrl={canonical}
        structuredData={jsonSchema}
        ogImage="/og-image.jpg"
      />

      <div className="tool-page-template">
        {/* HEADER SECTION */}
        <section className="tool-header-section">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="tool-header-content"
            >
              <h1 className="tool-main-title">{title}</h1>
              <p className="tool-main-description">{description}</p>

              {/* Trust Signals */}
              <div className="trust-signals">
                <div className="trust-badge">
                  <Lock size={16} />
                  <span>Private & Secure</span>
                </div>
                <div className="trust-badge">
                  <Zap size={16} />
                  <span>Instant Processing</span>
                </div>
                <div className="trust-badge">
                  <Award size={16} />
                  <span>Free Forever</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* TOOL INTERFACE */}
        <section className="tool-interface-section">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="tool-interface-wrapper glass-panel"
            >
              {toolInterface}
            </motion.div>
          </div>
        </section>

        {/* OVERVIEW & INTRODUCTION */}
        {overview && (
          <section className="tool-section overview-section">
            <div className="container">
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                viewport={{ once: true }}
              >
                <h2>What is {title}?</h2>
                <p className="section-intro">{overview}</p>
              </motion.div>
            </div>
          </section>
        )}

        {/* HOW TO USE */}
        {howToUse && (
          <section className="tool-section how-to-use-section">
            <div className="container">
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                viewport={{ once: true }}
              >
                <h2>How to Use {title}</h2>
                <div className="step-by-step">
                  {howToUse.split('\n').filter(s => s.trim()).map((step, idx) => (
                    <div key={idx} className="step">
                      <div className="step-number">{idx + 1}</div>
                      <p>{step.replace(/^\d+\.\s*/, '')}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </section>
        )}

        {/* BENEFITS */}
        {benefits && benefits.length > 0 && (
          <section className="tool-section benefits-section">
            <div className="container">
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                viewport={{ once: true }}
              >
                <h2>Benefits of Using {title}</h2>
                <div className="benefits-grid">
                  {benefits.map((benefit, idx) => (
                    <motion.div
                      key={idx}
                      className="benefit-card glass-panel"
                      whileHover={{ y: -4 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Zap size={24} className="benefit-icon" />
                      <p>{benefit}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </section>
        )}

        {/* USE CASES */}
        {useCases && useCases.length > 0 && (
          <section className="tool-section use-cases-section">
            <div className="container">
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                viewport={{ once: true }}
              >
                <h2>Common Use Cases</h2>
                <ul className="use-cases-list">
                  {useCases.map((useCase, idx) => (
                    <li key={idx} className="use-case-item">
                      <ChevronRight size={20} />
                      <span>{useCase}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </section>
        )}

        {/* TIPS & TRICKS */}
        {tips && tips.length > 0 && (
          <section className="tool-section tips-section">
            <div className="container">
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                viewport={{ once: true }}
              >
                <h2>Pro Tips for Better Results</h2>
                <div className="tips-grid">
                  {tips.map((tip, idx) => (
                    <div key={idx} className="tip-card glass-panel">
                      <div className="tip-number">💡</div>
                      <p>{tip}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </section>
        )}

        {/* FAQs */}
        {faqItems && faqItems.length > 0 && (
          <section className="tool-section faq-section">
            <div className="container">
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                viewport={{ once: true }}
              >
                <h2>Frequently Asked Questions</h2>
                <div className="faq-list">
                  {faqItems.map((item, idx) => (
                    <details key={idx} className="faq-item glass-panel">
                      <summary className="faq-question">
                        <span>{item.q}</span>
                        <ChevronRight size={20} />
                      </summary>
                      <p className="faq-answer">{item.a}</p>
                    </details>
                  ))}
                </div>
              </motion.div>
            </div>
          </section>
        )}

        {/* RELATED TOOLS */}
        {relatedTools && relatedTools.length > 0 && (
          <section className="tool-section related-tools-section">
            <div className="container">
              <h2>Related Tools</h2>
              <RelatedTools tools={relatedTools} />
            </div>
          </section>
        )}

        {/* CALL TO ACTION */}
        <section className="tool-section cta-section">
          <div className="container">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="cta-card glass-panel gradient-border"
            >
              <h3>Ready to {title.toLowerCase()}?</h3>
              <p>Start using {title} now - it's free and requires no setup.</p>
              <button className="btn-primary" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                Try Now
              </button>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  );
};

export default ToolPageTemplate;

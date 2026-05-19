import React, { useState } from 'react';
import { CheckCircle, ChevronDown, ChevronUp, Lightbulb, Layers, HelpCircle } from 'lucide-react';
import './ToolContentSection.css';

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="tcs-faq-item" onClick={() => setOpen(!open)} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && setOpen(!open)}>
      <div className="tcs-faq-q">
        <span>{q}</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>
      {open && <p className="tcs-faq-a">{a}</p>}
    </div>
  );
}

function parseSteps(text) {
  return text.trim().split('\n').map(l => l.trim()).filter(Boolean);
}

export default function ToolContentSection({ content }) {
  if (!content) return null;
  const { overview, benefits, useCases, howToUse, tips, faqItems } = content;
  const steps = howToUse ? parseSteps(howToUse) : [];

  return (
    <section className="tcs-root" aria-label="Tool information">
      {overview && (
        <div className="tcs-block glass-panel">
          <h2 className="tcs-heading">About This Tool</h2>
          <p className="tcs-overview">{overview.trim()}</p>
        </div>
      )}

      {(benefits?.length > 0 || useCases?.length > 0) && (
        <div className="tcs-two-col">
          {benefits?.length > 0 && (
            <div className="tcs-block glass-panel">
              <h2 className="tcs-heading">
                <CheckCircle size={18} className="tcs-icon" />
                Key Benefits
              </h2>
              <ul className="tcs-list">
                {benefits.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
          )}
          {useCases?.length > 0 && (
            <div className="tcs-block glass-panel">
              <h2 className="tcs-heading">
                <Layers size={18} className="tcs-icon" />
                Common Use Cases
              </h2>
              <ul className="tcs-list">
                {useCases.map((u, i) => <li key={i}>{u}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {steps.length > 0 && (
        <div className="tcs-block glass-panel">
          <h2 className="tcs-heading">How to Use</h2>
          <ol className="tcs-steps">
            {steps.map((step, i) => (
              <li key={i} className="tcs-step">
                <span className="tcs-step-num">{i + 1}</span>
                <span>{step.replace(/^\d+\.\s*/, '')}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {tips?.length > 0 && (
        <div className="tcs-block glass-panel">
          <h2 className="tcs-heading">
            <Lightbulb size={18} className="tcs-icon" />
            Tips & Best Practices
          </h2>
          <ul className="tcs-list tcs-tips">
            {tips.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}

      {faqItems?.length > 0 && (
        <div className="tcs-block glass-panel">
          <h2 className="tcs-heading">
            <HelpCircle size={18} className="tcs-icon" />
            Frequently Asked Questions
          </h2>
          <div className="tcs-faq-list">
            {faqItems.map((item, i) => <FAQItem key={i} q={item.q} a={item.a} />)}
          </div>
        </div>
      )}
    </section>
  );
}

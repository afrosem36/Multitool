import React from 'react';
import { Shield, Lock, Eye, Server } from 'lucide-react';
import '../styles/ContentPage.css';

const PrivacyPolicy = () => {
  return (
    <div className="content-page container animate-fade-in" style={{ maxWidth: '800px', padding: '2rem 1rem' }}>
      <div className="text-center" style={{ marginBottom: '3rem' }}>
        <Shield size={48} className="text-gradient mx-auto mb-4" />
        <h1 className="text-gradient">Privacy Policy</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
          We are committed to protecting your personal information and your right to privacy.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
          <Eye className="text-gradient" size={24} />
          Information We Collect
        </h2>
        <p style={{ lineHeight: '1.7', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          MultiTool is designed to keep most tool activity inside the browser. When you upload files into supported utilities such as PDF merge, image conversion, or text cleanup tools, those files are typically processed in your browser session rather than being stored as long-term user accounts or personal profiles. 
        </p>
        <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)' }}>
          We may still collect limited technical information such as device type, browser type, operating system, language preferences, approximate location based on IP, referral source, and pages visited to understand how the site is used and how it can be improved.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
          <Server className="text-gradient" size={24} />
          Cookies, Advertising, and Analytics
        </h2>
        <p style={{ lineHeight: '1.7', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          The site may use cookies and similar technologies to remember preferences, understand traffic patterns, measure performance, and support advertising. Third-party advertising partners, including Google AdSense if active, may use cookies to serve personalized or non-personalized ads based on prior visits to this site or other sites.
        </p>
        <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)' }}>
          You can control cookies through your browser settings. Blocking some cookies may affect site features, analytics accuracy, or ad relevance, but the core website should remain accessible.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
          <Lock className="text-gradient" size={24} />
          Files, Security, and Retention
        </h2>
        <p style={{ lineHeight: '1.7', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          Because MultiTool focuses on practical utility workflows, many tools are intentionally built to process content locally in the browser whenever possible. That reduces the amount of personal data that needs to be transmitted or retained.
        </p>
        <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)' }}>
          However, no website, browser environment, or internet transmission method can be guaranteed to be completely secure. We use reasonable measures to protect the website and limit unnecessary data exposure, but users should avoid uploading highly sensitive documents unless they are comfortable with the risks of online processing.
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

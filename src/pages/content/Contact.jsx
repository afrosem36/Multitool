import React from 'react';
import { Mail, MessageSquare, Info, LifeBuoy } from 'lucide-react';
import '../styles/ContentPage.css';

const Contact = () => {
  return (
    <div className="content-page container animate-fade-in" style={{ maxWidth: '800px', padding: '2rem 1rem' }}>
      <div className="text-center" style={{ marginBottom: '3rem' }}>
        <Mail size={48} className="text-gradient mx-auto mb-4" />
        <h1 className="text-gradient">Contact Us</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
          We're here to help. Reach out with any questions, feedback, or issues.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
          <MessageSquare className="text-gradient" size={24} />
          Reasons to Reach Out
        </h2>
        <p style={{ lineHeight: '1.7', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          You can contact us for technical support, broken page reports, incorrect output examples, advertising questions, business partnerships, or general feedback about the site. If you notice a feature that could be improved, a guide that needs clarification, or a bug affecting a specific browser or file type, detailed reports are especially helpful. Include the page you visited, the steps you took, and what happened so the issue can be reviewed more quickly.
        </p>
        <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)' }}>
          Content feedback is also welcome. If a guide needs an update, contains outdated advice, or could benefit from an example that makes it easier to follow, those suggestions help the website become more useful over time.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
          <Info className="text-gradient" size={24} />
          Contact Details
        </h2>
        <p style={{ lineHeight: '1.7', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          General support email: <strong>support@multitool-help.com</strong>. Use this address for technical questions, page corrections, or requests related to the website experience. For partnership or advertising discussions, please include a clear subject line so your message can be routed efficiently.
        </p>
        <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)' }}>
          We do not guarantee an instant response, but we aim to review legitimate inquiries as quickly as possible. Please avoid sending sensitive personal documents through email unless absolutely necessary.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
          <LifeBuoy className="text-gradient" size={24} />
          Before Sending a Request
        </h2>
        <p style={{ lineHeight: '1.7', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          A quick browser refresh, switching to the latest version of Chrome, Edge, or Firefox, and reducing file size can solve many common website issues. For conversion tools, it also helps to verify that the file is not corrupted or locked by another application before uploading.
        </p>
        <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)' }}>
          If the issue still happens after basic checks, contact us with as much detail as possible. Screenshots, error messages, and reproducible steps make support much more effective. We appreciate thoughtful feedback!
        </p>
      </div>
    </div>
  );
};

export default Contact;

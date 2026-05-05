import React from 'react';
import { FileText, CheckCircle, AlertTriangle, Scale } from 'lucide-react';
import '../styles/ContentPage.css';

const Terms = () => {
  return (
    <div className="content-page container animate-fade-in" style={{ maxWidth: '800px', padding: '2rem 1rem' }}>
      <div className="text-center" style={{ marginBottom: '3rem' }}>
        <FileText size={48} className="text-gradient mx-auto mb-4" />
        <h1 className="text-gradient">Terms of Service</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
          Please read these terms carefully before using our tools.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
          <CheckCircle className="text-gradient" size={24} />
          Acceptance of Terms
        </h2>
        <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)' }}>
          By accessing and using MultiTool, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you must not use our website or services. These terms apply to all visitors, users, and others who access or use the Service.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
          <AlertTriangle className="text-gradient" size={24} />
          Use of Services
        </h2>
        <p style={{ lineHeight: '1.7', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          MultiTool provides various online utilities for file processing. You agree to use these tools only for lawful purposes and in accordance with these Terms. You are prohibited from using the site to process illegal, copyrighted (without permission), or harmful content.
        </p>
        <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)' }}>
          While many of our tools operate completely locally within your browser, ensuring high privacy, you acknowledge that you use these services at your own risk. We do not guarantee the accuracy, completeness, or usefulness of the generated files.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
          <Scale className="text-gradient" size={24} />
          Limitation of Liability
        </h2>
        <p style={{ lineHeight: '1.7', color: 'var(--text-secondary)' }}>
          In no event shall MultiTool, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
        </p>
      </div>
    </div>
  );
};

export default Terms;

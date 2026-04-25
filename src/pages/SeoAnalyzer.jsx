import React, { useState } from 'react';
import styled from 'styled-components';
import { Search, Loader2, Target, Globe, AlertTriangle, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

const Container = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

const Header = styled.div`
  text-align: center;
  h1 {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    background: linear-gradient(to right, #10b981, #3b82f6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  p { color: var(--text-secondary); font-size: 1.1rem; }
`;

const Form = styled.form`
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    @media (max-width: 768px) { grid-template-columns: 1fr; }
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    label { font-weight: 500; font-size: 0.95rem; color: var(--text-secondary); }
    input, select {
      padding: 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid var(--border-color);
      background: rgba(0,0,0,0.1);
      color: var(--text-primary);
      outline: none;
      &:focus { border-color: var(--primary-color); }
    }
  }

  .radio-group {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      color: var(--text-primary);
      background: rgba(0,0,0,0.1);
      padding: 0.5rem 1rem;
      border-radius: 2rem;
      border: 1px solid var(--border-color);
      transition: all 0.2s;

      &:hover { border-color: var(--primary-color); }
      &.active { background: rgba(59, 130, 246, 0.1); border-color: var(--primary-color); }
      
      input { display: none; }
    }
  }
`;

const Button = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 1.1rem;
  cursor: pointer;
  transition: opacity 0.2s;
  margin-top: 1rem;

  &:hover:not(:disabled) { opacity: 0.9; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const ReportContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
  animation: slideUp 0.4s ease;

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const ScoreSection = styled.div`
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  padding: 2rem;
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 2rem;
  align-items: center;

  @media (max-width: 768px) { grid-template-columns: 1fr; text-align: center; }

  .chart {
    position: relative;
    height: 250px;
    width: 100%;
    
    .score-text {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      font-size: 3rem;
      font-weight: 800;
    }
    .grade {
      position: absolute;
      top: 65%; left: 50%;
      transform: translate(-50%, 0);
      font-size: 1.5rem;
      color: var(--text-secondary);
      font-weight: 600;
    }
  }

  .quick-wins {
    h3 { margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; color: #f59e0b; }
    ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.75rem; }
    li {
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.2);
      padding: 1rem;
      border-radius: 0.5rem;
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      color: #fcd34d;
    }
  }
`;

const SignalsTable = styled.div`
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  overflow: hidden;

  .row {
    display: grid;
    grid-template-columns: 50px 200px 1fr;
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    align-items: center;

    &:last-child { border-bottom: none; }
    &.header { background: rgba(0,0,0,0.2); font-weight: 600; color: var(--text-secondary); }
    
    .icon {
      display: flex; align-items: center; justify-content: center;
      &.good { color: #10b981; }
      &.warn { color: #f59e0b; }
      &.fail { color: #ef4444; }
    }
  }
`;

const CtaButton = styled.button`
  background: linear-gradient(to right, #10b981, #3b82f6);
  color: white;
  border: none;
  padding: 1.25rem 2rem;
  border-radius: 1rem;
  font-size: 1.2rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  width: 100%;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.5);
  }
`;

export default function SeoAnalyzer() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  const [form, setForm] = useState({
    websiteUrl: '',
    websiteType: 'Blog',
    primaryKeywords: '',
    targetCountry: 'US',
    competitorUrls: '',
    analyticsGoal: 'Traffic'
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setReport(null);

    let url = form.websiteUrl.trim();
    if (!url.startsWith('http')) url = 'https://' + url;

    try {
      const response = await fetch('/api/seo-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl: url, primaryKeywords: form.primaryKeywords })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to analyze');

      setReport(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getChartColor = (score) => {
    if (score > 80) return '#10b981';
    if (score > 60) return '#f59e0b';
    return '#ef4444';
  };

  const generatePrompt = () => {
    if (!report) return '';
    const fails = report.signals.filter(s => s.status === '❌' || s.status === '⚠️').map(s => s.name).join(', ');
    
    return `I need advanced SEO recommendations for my ${form.websiteType} website at ${form.websiteUrl} targeting ${form.targetCountry}. My primary keywords are ${form.primaryKeywords || 'not specified'}. The automated audit gave me a score of ${report.overallScore}/100 with these failing signals: ${fails}. My analytics goal is ${form.analyticsGoal}.${form.competitorUrls ? ` My competitors are ${form.competitorUrls}.` : ''} Please give me a prioritised action plan with specific implementation instructions.`;
  };

  const openChatGPT = () => {
    const prompt = generatePrompt();
    const encoded = encodeURIComponent(prompt);
    window.open(`https://chat.openai.com/?q=${encoded}`, '_blank');
  };

  const renderStatusIcon = (status) => {
    if (status === '✅') return <CheckCircle size={20} className="good" />;
    if (status === '⚠️') return <AlertTriangle size={20} className="warn" />;
    return <XCircle size={20} className="fail" />;
  };

  return (
    <Container>
      <Header>
        <h1>SEO Score Analyzer</h1>
        <p>Audit your website's on-page SEO and get AI-powered recommendations.</p>
      </Header>

      {!report && (
        <Form onSubmit={handleSubmit}>
          <div className="grid">
            <div className="field">
              <label>Website URL *</label>
              <input type="url" name="websiteUrl" value={form.websiteUrl} onChange={handleChange} placeholder="https://example.com" required />
            </div>
            <div className="field">
              <label>Website Type</label>
              <select name="websiteType" value={form.websiteType} onChange={handleChange}>
                <option>Blog</option>
                <option>E-Commerce</option>
                <option>SaaS</option>
                <option>Portfolio</option>
                <option>News & Media</option>
                <option>Local Business</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>Primary Keywords (comma separated)</label>
            <input type="text" name="primaryKeywords" value={form.primaryKeywords} onChange={handleChange} placeholder="e.g. best coffee, seattle coffee shop" />
          </div>

          <div className="grid">
            <div className="field">
              <label>Target Country</label>
              <select name="targetCountry" value={form.targetCountry} onChange={handleChange}>
                <option value="US">United States (US)</option>
                <option value="UK">United Kingdom (UK)</option>
                <option value="CA">Canada (CA)</option>
                <option value="AU">Australia (AU)</option>
                <option value="Global">Global / Worldwide</option>
              </select>
            </div>
            <div className="field">
              <label>Competitor URLs (optional)</label>
              <input type="text" name="competitorUrls" value={form.competitorUrls} onChange={handleChange} placeholder="https://competitor.com" />
            </div>
          </div>

          <div className="field">
            <label>Analytics Goal</label>
            <div className="radio-group">
              {['Traffic', 'Conversions', 'Brand Awareness', 'Lead Generation'].map(goal => (
                <label key={goal} className={form.analyticsGoal === goal ? 'active' : ''}>
                  <input type="radio" name="analyticsGoal" value={goal} checked={form.analyticsGoal === goal} onChange={handleChange} />
                  {goal}
                </label>
              ))}
            </div>
          </div>

          {error && <div style={{ color: '#ef4444', textAlign: 'center' }}>{error}</div>}

          <Button type="submit" disabled={loading}>
            {loading ? <><Loader2 className="spin" size={20} /> Analyzing...</> : <><Search size={20} /> Analyze Website</>}
          </Button>
        </Form>
      )}

      {report && (
        <ReportContainer>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Audit Results for {form.websiteUrl}</h2>
            <button onClick={() => setReport(null)} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer' }}>Analyze Another</button>
          </div>

          <ScoreSection>
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[{ value: report.overallScore }, { value: 100 - report.overallScore }]}
                    cx="50%" cy="50%"
                    innerRadius={70}
                    outerRadius={90}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    stroke="none"
                  >
                    <Cell fill={getChartColor(report.overallScore)} />
                    <Cell fill="rgba(255,255,255,0.05)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="score-text" style={{ color: getChartColor(report.overallScore) }}>{report.overallScore}</div>
              <div className="grade">Grade {report.letterGrade}</div>
            </div>

            <div className="quick-wins">
              <h3><Target size={20} /> Quick Wins (Top Priorities)</h3>
              <ul>
                {report.signals.filter(s => s.status === '❌').slice(0, 3).map((s, i) => (
                  <li key={i}>
                    <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong>{s.name}:</strong> {s.fixTip}
                    </div>
                  </li>
                ))}
                {report.signals.filter(s => s.status === '❌').length === 0 && (
                  <li style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                    <CheckCircle size={20} /> Excellent! No critical issues found.
                  </li>
                )}
              </ul>
            </div>
          </ScoreSection>

          <SignalsTable>
            <div className="row header">
              <div>Status</div>
              <div>Signal</div>
              <div>Fix Tip</div>
            </div>
            {report.signals.map((s, i) => (
              <div className="row" key={i}>
                <div className="icon">{renderStatusIcon(s.status)}</div>
                <div style={{ fontWeight: 500 }}>{s.name}</div>
                <div style={{ color: 'var(--text-secondary)' }}>{s.fixTip || 'Looking good!'}</div>
              </div>
            ))}
          </SignalsTable>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <CtaButton onClick={openChatGPT}>
              <Search size={24} />
              Get AI-Powered SEO Recommendations in ChatGPT
              <ExternalLink size={20} />
            </CtaButton>
            
            <div style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '0.5rem' }}>
              <button 
                onClick={() => setShowPrompt(!showPrompt)}
                style={{ width: '100%', padding: '1rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left', fontWeight: 500 }}
              >
                {showPrompt ? 'Hide raw prompt' : 'View raw prompt to be sent'}
              </button>
              {showPrompt && (
                <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                  {generatePrompt()}
                </div>
              )}
            </div>
          </div>
        </ReportContainer>
      )}
    </Container>
  );
}

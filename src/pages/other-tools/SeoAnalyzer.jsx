import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  Search,
  Loader2,
  Target,
  Globe,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Info,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { API_BASE_URL } from '../../config';

const GOAL_OPTIONS = ['Traffic', 'Conversions', 'Brand Awareness', 'Lead Generation'];

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const Header = styled.div`
  text-align: center;
  padding: 2rem;
  border: 1px solid var(--border-color);
  border-radius: 1.25rem;
  background:
    radial-gradient(circle at top, rgba(59, 130, 246, 0.12), transparent 42%),
    radial-gradient(circle at bottom right, rgba(16, 185, 129, 0.08), transparent 35%),
    var(--surface-color);

  h1 {
    margin: 0 0 0.75rem;
    font-size: clamp(2rem, 4vw, 3rem);
  }

  p {
    margin: 0 auto;
    max-width: 780px;
    color: var(--text-secondary);
    font-size: 1.02rem;
    line-height: 1.7;
  }
`;

const Panel = styled.div`
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 1.25rem;
  padding: 1.5rem;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;

  @media (max-width: 780px) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.95rem;

  input,
  select,
  textarea {
    width: 100%;
    padding: 0.85rem 1rem;
    border-radius: 0.85rem;
    border: 1px solid var(--border-color);
    background: rgba(0, 0, 0, 0.16);
    color: var(--text-primary);
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
    resize: vertical;

    &:focus {
      border-color: rgba(96, 165, 250, 0.7);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    }
  }
`;

const GoalRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
`;

const GoalButton = styled.button`
  padding: 0.7rem 1rem;
  border-radius: 999px;
  border: 1px solid ${(props) => (props.$active ? 'rgba(59, 130, 246, 0.55)' : 'var(--border-color)')};
  background: ${(props) => (props.$active ? 'rgba(59, 130, 246, 0.14)' : 'rgba(255, 255, 255, 0.03)')};
  color: ${(props) => (props.$active ? '#93c5fd' : 'var(--text-primary)')};
  cursor: pointer;
  font-weight: 600;
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(59, 130, 246, 0.45);
  }
`;

const SubmitButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  width: 100%;
  padding: 1rem 1.2rem;
  border: none;
  border-radius: 0.95rem;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  color: white;
  background: linear-gradient(90deg, #10b981 0%, #3b82f6 100%);
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 16px 34px -18px rgba(59, 130, 246, 0.75);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ErrorBanner = styled.div`
  padding: 1rem 1.1rem;
  border-radius: 0.95rem;
  border: 1px solid rgba(239, 68, 68, 0.25);
  background: rgba(239, 68, 68, 0.08);
  color: #fca5a5;
`;

const TopGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
  gap: 1.25rem;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const ScorePanel = styled(Panel)`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;

  .chart {
    position: relative;
    height: 260px;
  }

  .score-value {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -55%);
    text-align: center;
  }

  .score-value strong {
    display: block;
    font-size: 3rem;
    line-height: 1;
  }

  .score-value span {
    display: inline-flex;
    margin-top: 0.4rem;
    color: var(--text-secondary);
    font-weight: 600;
  }
`;

const SummaryChips = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;

  @media (max-width: 540px) {
    grid-template-columns: 1fr;
  }
`;

const SummaryChip = styled.div`
  border-radius: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid ${(props) => props.$border};
  background: ${(props) => props.$bg};

  strong {
    display: block;
    font-size: 1.3rem;
    margin-bottom: 0.2rem;
  }

  span {
    color: var(--text-secondary);
    font-size: 0.92rem;
  }
`;

const InsightGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const ListCard = styled(Panel)`
  h3 {
    margin: 0 0 1rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
`;

const ItemList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
`;

const Item = styled.div`
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid ${(props) => props.$border};
  background: ${(props) => props.$bg};

  strong {
    display: block;
    margin-bottom: 0.35rem;
  }

  p {
    margin: 0;
    color: var(--text-secondary);
    line-height: 1.6;
  }
`;

const MetricGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.85rem;
`;

const MetricCard = styled(Panel)`
  padding: 1rem;

  span {
    color: var(--text-secondary);
    font-size: 0.9rem;
    display: block;
    margin-bottom: 0.35rem;
  }

  strong {
    font-size: 1.35rem;
  }
`;

const CategoryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.85rem;
`;

const CategoryCard = styled(Panel)`
  padding: 1rem;

  .label {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    font-weight: 600;
  }

  .bar {
    height: 0.55rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .bar > div {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #10b981 0%, #3b82f6 100%);
  }
`;

const Table = styled(Panel)`
  overflow: hidden;
  padding: 0;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 130px 170px minmax(160px, 220px) 1fr;
  gap: 1rem;
  padding: 1rem 1.25rem;
  align-items: start;
  border-bottom: 1px solid var(--border-color);

  &:last-child {
    border-bottom: none;
  }

  &.header {
    background: rgba(255, 255, 255, 0.03);
    color: var(--text-secondary);
    font-size: 0.9rem;
    font-weight: 700;
  }

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const StatusPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  width: fit-content;
  padding: 0.42rem 0.75rem;
  border-radius: 999px;
  border: 1px solid ${(props) => props.$border};
  background: ${(props) => props.$bg};
  color: ${(props) => props.$color};
  font-weight: 700;
  text-transform: capitalize;
`;

const Toolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
`;

const SecondaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.8rem 1rem;
  border-radius: 0.85rem;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-primary);
  cursor: pointer;
  font-weight: 600;
`;

function getScoreColor(score) {
  if (score >= 85) return '#10b981';
  if (score >= 70) return '#f59e0b';
  return '#ef4444';
}

function getStatusMeta(status) {
  if (status === 'pass') {
    return {
      label: 'Pass',
      icon: <CheckCircle2 size={16} />,
      color: '#4ade80',
      border: 'rgba(34, 197, 94, 0.25)',
      bg: 'rgba(34, 197, 94, 0.12)',
    };
  }

  if (status === 'warn') {
    return {
      label: 'Warning',
      icon: <AlertTriangle size={16} />,
      color: '#fbbf24',
      border: 'rgba(245, 158, 11, 0.25)',
      bg: 'rgba(245, 158, 11, 0.12)',
    };
  }

  return {
    label: 'Fail',
    icon: <XCircle size={16} />,
    color: '#f87171',
    border: 'rgba(239, 68, 68, 0.25)',
    bg: 'rgba(239, 68, 68, 0.12)',
  };
}

function formatMetric(value, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '--';
  }

  return `${new Intl.NumberFormat('en-IN').format(Number(value))}${suffix}`;
}

export default function SeoAnalyzer() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    websiteUrl: '',
    websiteType: 'Blog',
    primaryKeywords: '',
    targetCountry: 'US',
    competitorUrls: '',
    analyticsGoals: ['Traffic'],
  });

  const allGoalsSelected = form.analyticsGoals.length === GOAL_OPTIONS.length;

  const chartData = useMemo(() => {
    if (!report) return [];
    return [
      { name: 'Score', value: report.overallScore },
      { name: 'Remaining', value: 100 - report.overallScore },
    ];
  }, [report]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const toggleGoal = (goal) => {
    setForm((current) => {
      if (goal === 'All Goals') {
        return {
          ...current,
          analyticsGoals: allGoalsSelected ? ['Traffic'] : [...GOAL_OPTIONS],
        };
      }

      const exists = current.analyticsGoals.includes(goal);
      const nextGoals = exists
        ? current.analyticsGoals.filter((item) => item !== goal)
        : [...current.analyticsGoals, goal];

      return {
        ...current,
        analyticsGoals: nextGoals.length > 0 ? nextGoals : ['Traffic'],
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setReport(null);

    const url = form.websiteUrl.trim();

    try {
      const response = await fetch(`${API_BASE_URL}/api/seo-audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteUrl: url,
          websiteType: form.websiteType,
          primaryKeywords: form.primaryKeywords,
          targetCountry: form.targetCountry,
          competitorUrls: form.competitorUrls,
          analyticsGoals: form.analyticsGoals,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to analyze this URL right now.');
      }

      setReport(data.data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const generatePrompt = () => {
    if (!report) return '';

    const failingSignals = report.signals
      .filter((signal) => signal.status !== 'pass')
      .map((signal) => `${signal.name}: ${signal.fixTip}`)
      .join('; ');

    return `Create a prioritized SEO growth plan for a ${form.websiteType} website at ${form.websiteUrl} targeting ${form.targetCountry}. Primary keywords: ${form.primaryKeywords || 'not provided'}. Selected goals: ${form.analyticsGoals.join(', ')}. The audit score is ${report.overallScore}/100 (${report.letterGrade}) with ${report.summary.failed} failed checks and ${report.summary.warnings} warnings. Important issues: ${failingSignals}. Competitors: ${form.competitorUrls || 'not provided'}. Give an execution plan with quick wins this week, technical fixes, content opportunities, and KPI targets.`;
  };

  const openChatGPT = () => {
    const encoded = encodeURIComponent(generatePrompt());
    window.open(`https://chatgpt.com/?q=${encoded}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <Container>
      <Header>
        <h1>SEO Score Analyzer</h1>
        <p>
          Audit the page like an operator would: metadata, crawlability, content depth, conversion readiness,
          social previews, and the practical fixes that move rankings and results.
        </p>
      </Header>

      {!report && (
        <Panel>
          <Form onSubmit={handleSubmit}>
            <Grid>
              <Field>
                Website URL
                <input
                  type="url"
                  name="websiteUrl"
                  value={form.websiteUrl}
                  onChange={updateField}
                  placeholder="https://example.com"
                  required
                />
              </Field>
              <Field>
                Website Type
                <select name="websiteType" value={form.websiteType} onChange={updateField}>
                  <option>Blog</option>
                  <option>E-Commerce</option>
                  <option>SaaS</option>
                  <option>Portfolio</option>
                  <option>News & Media</option>
                  <option>Local Business</option>
                  <option>Other</option>
                </select>
              </Field>
            </Grid>

            <Field>
              Primary Keywords
              <input
                type="text"
                name="primaryKeywords"
                value={form.primaryKeywords}
                onChange={updateField}
                placeholder="seo audit tool, on-page seo, technical seo"
              />
            </Field>

            <Grid>
              <Field>
                Target Country
                <select name="targetCountry" value={form.targetCountry} onChange={updateField}>
                  <option value="US">United States (US)</option>
                  <option value="IN">India (IN)</option>
                  <option value="UK">United Kingdom (UK)</option>
                  <option value="CA">Canada (CA)</option>
                  <option value="AU">Australia (AU)</option>
                  <option value="Global">Global / Worldwide</option>
                </select>
              </Field>
              <Field>
                Competitor URLs
                <textarea
                  rows="3"
                  name="competitorUrls"
                  value={form.competitorUrls}
                  onChange={updateField}
                  placeholder="https://competitor-one.com, https://competitor-two.com"
                />
              </Field>
            </Grid>

            <Field as="div">
              Analytics Goal
              <GoalRow>
                <GoalButton type="button" onClick={() => toggleGoal('All Goals')} $active={allGoalsSelected}>
                  All Goals
                </GoalButton>
                {GOAL_OPTIONS.map((goal) => (
                  <GoalButton
                    key={goal}
                    type="button"
                    onClick={() => toggleGoal(goal)}
                    $active={form.analyticsGoals.includes(goal)}
                  >
                    {goal}
                  </GoalButton>
                ))}
              </GoalRow>
            </Field>

            {error && <ErrorBanner>{error}</ErrorBanner>}

            <SubmitButton type="submit" disabled={loading}>
              {loading ? <><Loader2 size={18} className="spin" /> Running deep audit...</> : <><Search size={18} /> Analyze Website</>}
            </SubmitButton>
          </Form>
        </Panel>
      )}

      {report && (
        <>
          <Toolbar>
            <div>
              <h2 style={{ margin: 0 }}>Audit Results for {form.websiteUrl}</h2>
              <p style={{ margin: '0.4rem 0 0', color: 'var(--text-secondary)' }}>
                {form.websiteType} · {report.inputContext.targetCountry} · Goals: {report.inputContext.analyticsGoals.join(', ')}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <SecondaryButton type="button" onClick={() => setReport(null)}>
                Analyze Another
              </SecondaryButton>
              <SecondaryButton type="button" onClick={openChatGPT}>
                <Sparkles size={16} />
                Open AI SEO Plan
              </SecondaryButton>
            </div>
          </Toolbar>

          <TopGrid>
            <ScorePanel>
              <div className="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      innerRadius={72}
                      outerRadius={96}
                      startAngle={90}
                      endAngle={-270}
                      stroke="none"
                    >
                      <Cell fill={getScoreColor(report.overallScore)} />
                      <Cell fill="rgba(255,255,255,0.06)" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="score-value">
                  <strong style={{ color: getScoreColor(report.overallScore) }}>{report.overallScore}</strong>
                  <span>Grade {report.letterGrade}</span>
                </div>
              </div>

              <SummaryChips>
                <SummaryChip $bg="rgba(34, 197, 94, 0.1)" $border="rgba(34, 197, 94, 0.18)">
                  <strong>{report.summary.passed}</strong>
                  <span>Passed checks</span>
                </SummaryChip>
                <SummaryChip $bg="rgba(245, 158, 11, 0.1)" $border="rgba(245, 158, 11, 0.18)">
                  <strong>{report.summary.warnings}</strong>
                  <span>Warnings</span>
                </SummaryChip>
                <SummaryChip $bg="rgba(239, 68, 68, 0.1)" $border="rgba(239, 68, 68, 0.18)">
                  <strong>{report.summary.failed}</strong>
                  <span>Critical gaps</span>
                </SummaryChip>
              </SummaryChips>
            </ScorePanel>

            <ListCard>
              <h3>
                <Target size={20} color="#fbbf24" />
                Top Priorities
              </h3>
              <ItemList>
                {report.quickWins.map((item) => (
                  <Item
                    key={item.id}
                    $bg={item.priority === 'high' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)'}
                    $border={item.priority === 'high' ? 'rgba(239, 68, 68, 0.18)' : 'rgba(245, 158, 11, 0.18)'}
                  >
                    <strong>{item.name}</strong>
                    <p>{item.fixTip}</p>
                  </Item>
                ))}
              </ItemList>
            </ListCard>
          </TopGrid>

          <InsightGrid>
            <ListCard>
              <h3>
                <CheckCircle2 size={20} color="#4ade80" />
                What Is Already Working
              </h3>
              <ItemList>
                {report.strengths.map((item) => (
                  <Item key={item.id} $bg="rgba(34, 197, 94, 0.08)" $border="rgba(34, 197, 94, 0.18)">
                    <strong>{item.name}</strong>
                    <p>{item.message}</p>
                  </Item>
                ))}
              </ItemList>
            </ListCard>

            <ListCard>
              <h3>
                <Globe size={20} color="#60a5fa" />
                Market Playbook
              </h3>
              <ItemList>
                {report.countryPlaybook.map((tip) => (
                  <Item key={tip} $bg="rgba(59, 130, 246, 0.08)" $border="rgba(59, 130, 246, 0.18)">
                    <strong>Targeting note</strong>
                    <p>{tip}</p>
                  </Item>
                ))}
              </ItemList>
            </ListCard>
          </InsightGrid>

          <Panel>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <TrendingUp size={20} color="#60a5fa" />
              Core Metrics
            </h3>
            <MetricGrid>
              <MetricCard>
                <span>Title Length</span>
                <strong>{formatMetric(report.metrics.titleLength)} chars</strong>
              </MetricCard>
              <MetricCard>
                <span>Meta Description</span>
                <strong>{formatMetric(report.metrics.metaDescriptionLength)} chars</strong>
              </MetricCard>
              <MetricCard>
                <span>Visible Word Count</span>
                <strong>{formatMetric(report.metrics.wordCount)}</strong>
              </MetricCard>
              <MetricCard>
                <span>Keyword Density</span>
                <strong>{formatMetric(report.metrics.keywordDensity, '%')}</strong>
              </MetricCard>
              <MetricCard>
                <span>Images With Alt</span>
                <strong>{formatMetric(report.metrics.altCoverage, '%')}</strong>
              </MetricCard>
              <MetricCard>
                <span>Internal / External Links</span>
                <strong>{formatMetric(report.metrics.internalLinks)} / {formatMetric(report.metrics.externalLinks)}</strong>
              </MetricCard>
              <MetricCard>
                <span>Response Time</span>
                <strong>{formatMetric(report.metrics.responseTime)} ms</strong>
              </MetricCard>
              <MetricCard>
                <span>HTML Size</span>
                <strong>{formatMetric(report.metrics.htmlSizeKB)} KB</strong>
              </MetricCard>
            </MetricGrid>
          </Panel>

          <Panel>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Info size={20} color="#a78bfa" />
              Category Scores
            </h3>
            <CategoryGrid>
              {report.categories.map((category) => (
                <CategoryCard key={category.name}>
                  <div className="label">
                    <span>{category.name}</span>
                    <span>{category.percentage}%</span>
                  </div>
                  <div className="bar">
                    <div style={{ width: `${category.percentage}%` }} />
                  </div>
                  <p style={{ margin: '0.75rem 0 0', color: 'var(--text-secondary)' }}>
                    {category.score} / {category.maxScore} points
                  </p>
                </CategoryCard>
              ))}
            </CategoryGrid>
          </Panel>

          <Table>
            <Row className="header">
              <div>Status</div>
              <div>Category</div>
              <div>Signal</div>
              <div>Recommendation</div>
            </Row>
            {report.signals.map((signal) => {
              const status = getStatusMeta(signal.status);
              return (
                <Row key={signal.id}>
                  <div>
                    <StatusPill $color={status.color} $border={status.border} $bg={status.bg}>
                      {status.icon}
                      {status.label}
                    </StatusPill>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{signal.category}</div>
                  <div>
                    <strong>{signal.name}</strong>
                    <div style={{ marginTop: '0.35rem', color: 'var(--text-secondary)' }}>
                      {signal.score}/{signal.maxScore} points
                    </div>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                      {signal.message}
                    </strong>
                    {signal.fixTip}
                  </div>
                </Row>
              );
            })}
          </Table>

          <Panel>
            <h3 style={{ marginTop: 0, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <ExternalLink size={18} color="#60a5fa" />
              Crawl Snapshot
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Robots.txt: <strong style={{ color: 'var(--text-primary)' }}>{report.crawl.hasRobots ? 'Found' : 'Missing'}</strong>
              {' · '}
              Sitemap.xml: <strong style={{ color: 'var(--text-primary)' }}>{report.crawl.hasSitemap ? 'Found' : 'Missing'}</strong>
              {' · '}
              Indexable: <strong style={{ color: 'var(--text-primary)' }}>{report.crawl.isIndexable ? 'Yes' : 'No'}</strong>
              {' · '}
              HTML lang: <strong style={{ color: 'var(--text-primary)' }}>{report.crawl.htmlLang || 'Not set'}</strong>
              {' · '}
              Canonical: <strong style={{ color: 'var(--text-primary)' }}>{report.crawl.canonicalUrl || 'Not set'}</strong>
            </p>
          </Panel>
        </>
      )}
    </Container>
  );
}

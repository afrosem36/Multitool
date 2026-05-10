/**
 * CHART INTELLIGENCE ENGINE v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Rule-based chart selection, scoring, and layout. Zero AI dependency.
 *
 * Architecture:
 *  1. For every (dimension × measure) pair, score each chart type
 *  2. Select the top-N highest-scoring chart specs
 *  3. Apply layout algorithm (2-col grid, full-width for time-series)
 *  4. Generate human-readable titles and descriptions
 */

import { ROLE, ST } from './semanticEngine.js';

// ─── Chart type metadata ───────────────────────────────────────────────────────
export const CHART_TYPES = {
  bar:   { label: 'Bar',  icon: 'BarChart',   suitability: { dimension: 0.9, measure: 0.9, temporal: 0.4 } },
  hbar:  { label: 'H.Bar',icon: 'BarChart2',  suitability: { dimension: 0.95, measure: 0.9, person: 1.0 } },
  line:  { label: 'Line', icon: 'TrendingUp', suitability: { temporal: 1.0, measure: 0.9, dimension: 0.4 } },
  area:  { label: 'Area', icon: 'Activity',   suitability: { temporal: 1.0, measure: 0.95, dimension: 0.3 } },
  pie:   { label: 'Pie',  icon: 'PieChart',   suitability: { status: 1.0, dimension: 0.8, low_cardinality: 1.0 } },
  donut: { label: 'Donut',icon: 'PieChart',   suitability: { status: 0.95, dimension: 0.8, low_cardinality: 1.0 } },
};

// ─── Chart scoring rules ───────────────────────────────────────────────────────
/**
 * Each rule returns a candidate chart spec if conditions match.
 * Rules are ordered by priority — earlier rules produce better charts.
 */
const CHART_RULES = [
  // ── Rule 1: Date × Amount → Area trend (highest priority) ────────────────
  {
    id: 'date_amount_area',
    priority: 100,
    score: (a) => a.temporals.length > 0 && a.measures.length > 0 ? 96 : 0,
    build: (a) => ({
      type: 'area',
      title: `${a.primaryAmountCol} Trend Over Time`,
      description: `Monthly ${a.primaryAmountCol} — spot peaks, dips, and growth patterns`,
      xCol: a.primaryDateCol,
      yCol: a.primaryAmountCol,
      aggregation: 'sum',
      timeSeries: true,
      timeGroupBy: 'month',
      limit: 36,
      width: 'full',
      priority: 100,
    }),
    condition: (a) => a.primaryDateCol && a.primaryAmountCol,
  },

  // ── Rule 2: Agent × Amount → Horizontal bar leaderboard ──────────────────
  {
    id: 'agent_amount_hbar',
    priority: 95,
    score: (a) => a.primaryAgentCol && a.primaryAmountCol ? 95 : 0,
    build: (a) => ({
      type: 'hbar',
      title: `Top ${a.primaryAgentCol}s by ${a.primaryAmountCol}`,
      description: `Ranked leaderboard — who drives the most ${a.primaryAmountCol}`,
      xCol: a.primaryAgentCol,
      yCol: a.primaryAmountCol,
      aggregation: 'sum',
      timeSeries: false,
      limit: 15,
      width: 'half',
      priority: 95,
    }),
    condition: (a) => a.primaryAgentCol && a.primaryAmountCol,
  },

  // ── Rule 3: Status → Pie distribution ─────────────────────────────────────
  {
    id: 'status_pie',
    priority: 90,
    score: (a) => a.primaryStatusCol ? 90 : 0,
    build: (a, colMeta) => {
      const uniq = colMeta[a.primaryStatusCol]?.unique || 999;
      return {
        type: uniq <= 8 ? 'pie' : 'bar',
        title: `${a.primaryStatusCol} Breakdown`,
        description: `Distribution of records by ${a.primaryStatusCol}`,
        xCol: a.primaryStatusCol,
        yCol: null,
        aggregation: 'count',
        timeSeries: false,
        limit: 12,
        width: 'half',
        priority: 90,
      };
    },
    condition: (a) => a.primaryStatusCol,
  },

  // ── Rule 4: Category × Amount → Bar chart ─────────────────────────────────
  {
    id: 'category_amount_bar',
    priority: 85,
    score: (a) => a.primaryCategoryCol && a.primaryAmountCol ? 85 : 0,
    build: (a) => ({
      type: 'bar',
      title: `${a.primaryAmountCol} by ${a.primaryCategoryCol}`,
      description: `Compare ${a.primaryAmountCol} across different ${a.primaryCategoryCol}s`,
      xCol: a.primaryCategoryCol,
      yCol: a.primaryAmountCol,
      aggregation: 'sum',
      timeSeries: false,
      limit: 15,
      width: 'half',
      priority: 85,
    }),
    condition: (a) => a.primaryCategoryCol && a.primaryAmountCol,
  },

  // ── Rule 5: Date × Amount → Line growth ───────────────────────────────────
  {
    id: 'date_amount_line',
    priority: 82,
    score: (a) => a.primaryDateCol && a.primaryAmountCol ? 82 : 0,
    build: (a) => ({
      type: 'line',
      title: `${a.primaryAmountCol} Growth`,
      description: `Month-over-month ${a.primaryAmountCol} growth trend`,
      xCol: a.primaryDateCol,
      yCol: a.primaryAmountCol,
      aggregation: 'sum',
      timeSeries: true,
      timeGroupBy: 'month',
      limit: 36,
      width: 'half',
      priority: 82,
    }),
    condition: (a) => a.primaryDateCol && a.primaryAmountCol,
  },

  // ── Rule 6: Agent × Count bar ─────────────────────────────────────────────
  {
    id: 'agent_count_bar',
    priority: 78,
    score: (a) => a.primaryAgentCol ? 78 : 0,
    build: (a) => ({
      type: 'bar',
      title: `Activity by ${a.primaryAgentCol}`,
      description: `Number of records handled per ${a.primaryAgentCol}`,
      xCol: a.primaryAgentCol,
      yCol: null,
      aggregation: 'count',
      timeSeries: false,
      limit: 15,
      width: 'half',
      priority: 78,
    }),
    condition: (a) => a.primaryAgentCol,
  },

  // ── Rule 7: Category distribution (no amount) ─────────────────────────────
  {
    id: 'category_count_pie',
    priority: 72,
    score: (a, colMeta) => a.primaryCategoryCol && !a.primaryAmountCol
      ? (colMeta[a.primaryCategoryCol]?.unique <= 10 ? 75 : 65) : 0,
    build: (a, colMeta) => {
      const uniq = colMeta[a.primaryCategoryCol]?.unique || 999;
      return {
        type: uniq <= 8 ? 'pie' : 'bar',
        title: `Distribution by ${a.primaryCategoryCol}`,
        description: `Count of records per ${a.primaryCategoryCol}`,
        xCol: a.primaryCategoryCol,
        yCol: null,
        aggregation: 'count',
        timeSeries: false,
        limit: 12,
        width: 'half',
        priority: 72,
      };
    },
    condition: (a) => a.primaryCategoryCol && !a.primaryAmountCol,
  },

  // ── Rule 8: Date count (no amount) ────────────────────────────────────────
  {
    id: 'date_count_line',
    priority: 68,
    score: (a) => a.primaryDateCol && !a.primaryAmountCol ? 68 : 0,
    build: (a) => ({
      type: 'line',
      title: 'Records Over Time',
      description: 'Volume of records per month',
      xCol: a.primaryDateCol,
      yCol: null,
      aggregation: 'count',
      timeSeries: true,
      timeGroupBy: 'month',
      limit: 36,
      width: 'full',
      priority: 68,
    }),
    condition: (a) => a.primaryDateCol && !a.primaryAmountCol,
  },

  // ── Rule 9: Second dimension × amount ─────────────────────────────────────
  {
    id: 'dim2_amount_bar',
    priority: 65,
    score: (a) => {
      const dims = a.dimensions || [];
      return dims.length >= 2 && a.primaryAmountCol ? 65 : 0;
    },
    build: (a) => {
      const dims = (a.dimensions || []).filter(d => d !== a.primaryCategoryCol && d !== a.primaryAgentCol);
      const dim = dims[0];
      return dim ? {
        type: 'bar',
        title: `${a.primaryAmountCol} by ${dim}`,
        description: `Breakdown of ${a.primaryAmountCol} per ${dim}`,
        xCol: dim,
        yCol: a.primaryAmountCol,
        aggregation: 'sum',
        timeSeries: false,
        limit: 12,
        width: 'half',
        priority: 65,
      } : null;
    },
    condition: (a) => (a.dimensions || []).length >= 2 && a.primaryAmountCol,
  },

  // ── Rule 10: Second measure trend ─────────────────────────────────────────
  {
    id: 'second_measure_trend',
    priority: 60,
    score: (a) => a.primaryDateCol && (a.measures || []).length >= 2 ? 60 : 0,
    build: (a) => {
      const second = (a.measures || []).find(m => m !== a.primaryAmountCol);
      return second ? {
        type: 'bar',
        title: `${second} by Month`,
        description: `Monthly ${second} breakdown`,
        xCol: a.primaryDateCol,
        yCol: second,
        aggregation: 'sum',
        timeSeries: true,
        timeGroupBy: 'month',
        limit: 24,
        width: 'half',
        priority: 60,
      } : null;
    },
    condition: (a) => a.primaryDateCol && (a.measures || []).length >= 2,
  },
];

// ─── Main: generate chart specs ────────────────────────────────────────────────
/**
 * Produces an ordered array of chart specifications.
 * Each spec is immediately renderable — no AI needed.
 */
export function generateChartSpecs(analysis, maxCharts = 6) {
  const { colMeta } = analysis;
  const seen = new Set();
  const specs = [];

  for (const rule of CHART_RULES.sort((a, b) => b.priority - a.priority)) {
    if (specs.length >= maxCharts) break;
    if (!rule.condition(analysis)) continue;

    const built = rule.build(analysis, colMeta);
    if (!built) continue;

    const key = `${built.type}|${built.xCol}|${built.yCol}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Validate columns exist
    const validCols = new Set(analysis.headers);
    if (!validCols.has(built.xCol)) continue;
    if (built.yCol && !validCols.has(built.yCol)) continue;

    specs.push(built);
  }

  return specs;
}

// ─── Layout Engine ─────────────────────────────────────────────────────────────
/**
 * Assigns grid layout classes to chart specs.
 * Full-width for time-series, half-width for comparisons.
 */
export function computeLayout(specs) {
  return specs.map((spec, i) => ({
    ...spec,
    gridSpan: spec.width === 'full' ? 2 : 1,
    order: i,
  }));
}

// ─── Fallback plan builder ─────────────────────────────────────────────────────
export function buildFallbackPlan(analysis, userPrompt = '') {
  const charts = generateChartSpecs(analysis);
  const { primaryAmountCol, primaryAgentCol, primaryStatusCol, primaryCategoryCol, primaryDateCol, colMeta } = analysis;

  let title = userPrompt || 'Data Dashboard';
  if (!userPrompt) {
    if (primaryAmountCol && primaryAgentCol) title = 'Performance Dashboard';
    else if (primaryAmountCol && primaryDateCol) title = 'Revenue Analytics Dashboard';
    else if (primaryStatusCol) title = 'Status & Conversion Dashboard';
    else if (primaryCategoryCol) title = 'Category Performance Dashboard';
  }

  const insights = [];
  insights.push(`Dataset has ${analysis.rowCount.toLocaleString('en-IN')} records across ${analysis.headers.length} columns`);
  if (primaryAmountCol && colMeta[primaryAmountCol]?.sum) {
    const sum = colMeta[primaryAmountCol].sum;
    insights.push(`Total ${primaryAmountCol}: ₹${sum >= 1e7 ? (sum/1e7).toFixed(2)+' Cr' : sum >= 1e5 ? (sum/1e5).toFixed(2)+' L' : Math.round(sum).toLocaleString('en-IN')}`);
  }
  if (analysis.relationships?.length > 0) {
    insights.push(`Key patterns: ${analysis.relationships.slice(0, 2).join('; ')}`);
  }

  return {
    title,
    subtitle: `Analysed ${analysis.rowCount.toLocaleString()} rows × ${analysis.headers.length} columns`,
    insights: insights.slice(0, 4),
    charts,
    columnLabels: {},
  };
}

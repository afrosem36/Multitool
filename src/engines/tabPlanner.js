/**
 * TAB PLANNER ENGINE v1.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Builds professional multi-tab BI dashboards (Power BI / Tableau-style) from
 * a semantic analysis. Pure deterministic logic — zero AI dependency.
 *
 * Output shape:
 *  {
 *    title, subtitle, domain, confidence,
 *    tabs: [
 *      { id, title, description, kpis[], charts[], insights[], summary, layout }
 *    ],
 *    insights[],  // overall executive insights
 *    summary      // overall executive summary
 *  }
 *
 * Tab assembly is domain-aware. Each tab only renders if it has enough
 * meaningful charts / KPIs — empty tabs are dropped.
 */

import { ST } from './semanticEngine.js';
import { generateKPIs } from './kpiEngine.js';
import {
  buildDateTrends, computeGrowthMetrics,
  segmentAnalysis, extractNums, classifyTrend,
  detectAnomalies, generateAutoInsights,
} from './analyticsEngine.js';

// ─── Tab Catalog ──────────────────────────────────────────────────────────────
// Each tab has a "when" predicate against the analysis. Tabs are produced
// in the order listed when their predicate is true.

const TAB_BUILDERS = {
  overview:       buildOverviewTab,
  agent:          buildAgentPerformanceTab,
  status:         buildStatusTab,
  category:       buildCategoryTab,
  trend:          buildTrendTab,
  forecast:       buildForecastTab,
  risk:           buildRiskTab,
  geography:      buildGeographyTab,
  financial:      buildFinancialTab,
  duration:       buildDurationTab,
  insights:       buildInsightsTab,
};

// Domain → ordered list of tab IDs the planner will try to build
const DOMAIN_TABS = {
  sales_crm:   ['overview', 'agent',  'category', 'trend',  'forecast', 'status', 'risk',     'insights'],
  finance:     ['overview', 'financial', 'category', 'trend', 'forecast', 'risk',  'insights'],
  hr_payroll:  ['overview', 'agent',  'category', 'financial', 'status',   'insights'],
  ecommerce:   ['overview', 'category','agent',   'trend',  'forecast', 'status', 'insights'],
  logistics:   ['overview', 'status', 'duration', 'agent',  'trend',    'risk',   'insights'],
  healthcare:  ['overview', 'category','status',  'duration','agent',   'insights'],
  education:   ['overview', 'category','agent',   'status',  'insights'],
  real_estate: ['overview', 'agent',  'category', 'trend',   'geography','insights'],
  telecom:     ['overview', 'status', 'duration', 'agent',   'trend',    'insights'],
  generic:     ['overview', 'category','agent',   'status',  'trend',    'forecast','insights'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function chunkBig(n) {
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(2)} L`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} K`;
  return Math.round(n).toLocaleString('en-IN');
}

function statusColumn(analysis) {
  return analysis.primaryStatusCol
      || analysis.headers.find(h => analysis.colMeta[h]?.semanticType === ST.STATUS);
}

function findColsByType(analysis, ...types) {
  const set = new Set(types);
  return analysis.headers.filter(h => set.has(analysis.colMeta[h]?.semanticType));
}

function makeChartSpec({ type, title, description, xCol, yCol = null, aggregation = 'sum', timeSeries = false, timeGroupBy = 'month', limit = 15, width = 'half', tabId = '', priority = 50, groupBy = '', valueColumn = '', secondaryYAxis = '', reason = '', insightQuestion = '', analysisType = '' }) {
  return {
    id: `${tabId}_${xCol || 'x'}_${yCol || 'y'}_${type}`,
    type, title, description,
    xCol, yCol, aggregation, timeSeries, timeGroupBy, limit, width,
    groupBy, valueColumn, secondaryYAxis, reason, insightQuestion, analysisType,
    tabId, priority,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// TAB BUILDERS — each returns { id, title, description, charts[], summary }
// (KPIs are attached later from the global KPI pool, filtered per tab)
// ────────────────────────────────────────────────────────────────────────────

function buildOverviewTab(a) {
  const charts = [];
  // Headline trend
  if (a.primaryDateCol && a.primaryAmountCol) {
    charts.push(makeChartSpec({
      type: 'area', tabId: 'overview', priority: 100, width: 'full',
      title: `${a.primaryAmountCol} Over Time`,
      description: 'Headline trend across the entire dataset period',
      xCol: a.primaryDateCol, yCol: a.primaryAmountCol,
      aggregation: 'sum', timeSeries: true, timeGroupBy: 'month', limit: 36,
    }));
  } else if (a.primaryDateCol) {
    charts.push(makeChartSpec({
      type: 'line', tabId: 'overview', priority: 100, width: 'full',
      title: 'Records Over Time',
      description: 'Volume of records per month',
      xCol: a.primaryDateCol, aggregation: 'count',
      timeSeries: true, timeGroupBy: 'month', limit: 36,
    }));
  }

  // Status distribution
  const statCol = statusColumn(a);
  if (statCol) {
    const uniq = a.colMeta[statCol]?.unique || 999;
    charts.push(makeChartSpec({
      type: uniq <= 8 ? 'pie' : 'bar', tabId: 'overview', priority: 90,
      title: `${statCol} Distribution`,
      description: `Share of records by ${statCol}`,
      xCol: statCol, aggregation: 'count', limit: 12,
    }));
  }

  // Top dimension by amount (category or agent)
  const topDim = a.primaryCategoryCol || a.primaryAgentCol;
  if (topDim && a.primaryAmountCol) {
    charts.push(makeChartSpec({
      type: 'bar', tabId: 'overview', priority: 85,
      title: `${a.primaryAmountCol} by ${topDim}`,
      description: `Compare ${a.primaryAmountCol} across ${topDim}`,
      xCol: topDim, yCol: a.primaryAmountCol,
      aggregation: 'sum', limit: 10,
    }));
    charts.push(makeChartSpec({
      type: 'treemap', tabId: 'overview', priority: 82,
      title: `${topDim} Contribution Treemap`,
      description: `Contribution share by ${topDim}`,
      xCol: topDim, yCol: a.primaryAmountCol,
      valueColumn: a.primaryAmountCol,
      aggregation: 'sum', limit: 12,
      reason: 'Treemaps make contribution concentration easier to scan than another bar chart.',
      insightQuestion: `Which ${topDim} contributes the most value?`,
      analysisType: 'comparison',
    }));
  }

  const targetCol = a.headers.find(h => /target|goal|quota|planned/i.test(h));
  if (targetCol && a.primaryAmountCol) {
    charts.push(makeChartSpec({
      type: 'gauge', tabId: 'overview', priority: 88, width: 'half',
      title: `${a.primaryAmountCol} vs ${targetCol}`,
      description: 'Overall achievement against target',
      xCol: targetCol, yCol: null, valueColumn: '',
      aggregation: 'average', limit: 1,
      reason: 'A gauge gives managers a fast target-achievement signal.',
      insightQuestion: 'Are we on track against target?',
      analysisType: 'performance',
    }));
  }

  return {
    id: 'overview',
    title: 'Overview',
    description: 'High-level business performance at a glance',
    charts,
    layout: 'standard',
  };
}

function buildAgentPerformanceTab(a) {
  if (!a.primaryAgentCol) return null;
  const charts = [];
  const agentCol = a.primaryAgentCol;

  // Top performers (horizontal bar)
  if (a.primaryAmountCol) {
    charts.push(makeChartSpec({
      type: 'hbar', tabId: 'agent', priority: 100, width: 'full',
      title: `Top ${agentCol}s by ${a.primaryAmountCol}`,
      description: 'Performance leaderboard — highest contributors',
      xCol: agentCol, yCol: a.primaryAmountCol, aggregation: 'sum', limit: 15,
    }));
  }

  // Agent activity count
  charts.push(makeChartSpec({
    type: 'bar', tabId: 'agent', priority: 90,
    title: `Activity by ${agentCol}`,
    description: `Number of records handled per ${agentCol}`,
    xCol: agentCol, aggregation: 'count', limit: 15,
  }));

  // Agent × Status (stacked behaviour via grouped bar)
  const statCol = statusColumn(a);
  if (statCol) {
    charts.push(makeChartSpec({
      type: 'stackedBar', tabId: 'agent', priority: 85,
      title: `${agentCol} × ${statCol}`,
      description: `Outcome mix per ${agentCol}`,
      xCol: agentCol, yCol: null, groupBy: statCol, aggregation: 'count', limit: 12,
      reason: 'Stacked bars compare both workload and status mix per person.',
      insightQuestion: `Which ${agentCol}s have the weakest outcome mix?`,
      analysisType: 'performance',
    }));
    charts.push(makeChartSpec({
      type: 'heatmap', tabId: 'agent', priority: 83, width: 'full',
      title: `${agentCol} vs ${statCol} Heatmap`,
      description: `High-density view of outcomes per ${agentCol}`,
      xCol: agentCol, yCol: statCol, aggregation: 'count', limit: 12,
      reason: 'Heatmaps reveal operational hotspots faster than repeated tables.',
      insightQuestion: `Where are unresolved or negative statuses concentrated?`,
      analysisType: 'risk',
    }));
  }

  // Avg per agent
  if (a.primaryAmountCol) {
    charts.push(makeChartSpec({
      type: 'bar', tabId: 'agent', priority: 80,
      title: `Avg ${a.primaryAmountCol} per ${agentCol}`,
      description: `Average ${a.primaryAmountCol} produced per ${agentCol}`,
      xCol: agentCol, yCol: a.primaryAmountCol,
      aggregation: 'avg', limit: 12,
    }));
  }

  return {
    id: 'agent',
    title: `${agentCol} Performance`,
    description: `Compare ${agentCol}s across volume, value and outcomes`,
    charts, layout: 'standard',
  };
}

function buildStatusTab(a) {
  const statCol = statusColumn(a);
  if (!statCol) return null;

  const charts = [];
  const uniq = a.colMeta[statCol]?.unique || 999;

  // Pie / donut
  charts.push(makeChartSpec({
    type: uniq <= 8 ? 'donut' : 'bar', tabId: 'status', priority: 100, width: 'half',
    title: `${statCol} Breakdown`,
    description: `Distribution of records by ${statCol}`,
    xCol: statCol, aggregation: 'count', limit: 12,
  }));
  charts.push(makeChartSpec({
    type: 'funnel', tabId: 'status', priority: 98, width: 'half',
    title: `${statCol} Journey Funnel`,
    description: `Stage or status flow by ${statCol}`,
    xCol: statCol, aggregation: 'count', limit: 10,
    reason: 'A funnel shows conversion or lifecycle drop-off at a glance.',
    insightQuestion: `Where does the ${statCol} journey lose the most records?`,
    analysisType: 'funnel',
  }));

  // Status × Amount
  if (a.primaryAmountCol) {
    charts.push(makeChartSpec({
      type: 'bar', tabId: 'status', priority: 95,
      title: `${a.primaryAmountCol} by ${statCol}`,
      description: `Total ${a.primaryAmountCol} per ${statCol}`,
      xCol: statCol, yCol: a.primaryAmountCol, aggregation: 'sum', limit: 12,
    }));
  }

  // Status trend
  if (a.primaryDateCol) {
    charts.push(makeChartSpec({
      type: 'line', tabId: 'status', priority: 85, width: 'full',
      title: `${statCol} Trend Over Time`,
      description: `${statCol} volume per month`,
      xCol: a.primaryDateCol, aggregation: 'count',
      timeSeries: true, timeGroupBy: 'month', limit: 24,
    }));
  }

  return {
    id: 'status',
    title: `${statCol} Analysis`,
    description: `Outcomes, conversion and resolution patterns across ${statCol}`,
    charts, layout: 'standard',
  };
}

function buildCategoryTab(a) {
  const catCol = a.primaryCategoryCol;
  if (!catCol) return null;
  const charts = [];

  // Category distribution
  const uniq = a.colMeta[catCol]?.unique || 999;
  charts.push(makeChartSpec({
    type: uniq <= 10 ? 'pie' : 'bar', tabId: 'category', priority: 100,
    title: `${catCol} Distribution`,
    description: `Records per ${catCol}`,
    xCol: catCol, aggregation: 'count', limit: 15,
  }));

  // Category × Amount
  if (a.primaryAmountCol) {
    charts.push(makeChartSpec({
      type: 'bar', tabId: 'category', priority: 95,
      title: `${a.primaryAmountCol} by ${catCol}`,
      description: `Top ${catCol} by ${a.primaryAmountCol}`,
      xCol: catCol, yCol: a.primaryAmountCol, aggregation: 'sum', limit: 12,
    }));
    charts.push(makeChartSpec({
      type: 'treemap', tabId: 'category', priority: 92,
      title: `${catCol} Contribution Treemap`,
      description: `Relative value contribution by ${catCol}`,
      xCol: catCol, yCol: a.primaryAmountCol, valueColumn: a.primaryAmountCol,
      aggregation: 'sum', limit: 15,
      reason: 'Treemap highlights concentration and long-tail contribution.',
      insightQuestion: `Which ${catCol} dominates contribution?`,
      analysisType: 'comparison',
    }));
    charts.push(makeChartSpec({
      type: 'bar', tabId: 'category', priority: 80,
      title: `Avg ${a.primaryAmountCol} per ${catCol}`,
      description: `Mean ${a.primaryAmountCol} produced per ${catCol}`,
      xCol: catCol, yCol: a.primaryAmountCol, aggregation: 'avg', limit: 12,
    }));
  }

  // Category × time trend
  if (a.primaryDateCol && a.primaryAmountCol) {
    charts.push(makeChartSpec({
      type: 'area', tabId: 'category', priority: 75, width: 'full',
      title: `${catCol} Performance Trend`,
      description: `${a.primaryAmountCol} over time, aggregated`,
      xCol: a.primaryDateCol, yCol: a.primaryAmountCol,
      aggregation: 'sum', timeSeries: true, timeGroupBy: 'month', limit: 24,
    }));
  }

  return {
    id: 'category',
    title: `${catCol} Performance`,
    description: `Volume, value and trend by ${catCol}`,
    charts, layout: 'standard',
  };
}

function buildTrendTab(a) {
  if (!a.primaryDateCol) return null;
  const charts = [];

  // Monthly trend
  if (a.primaryAmountCol) {
    charts.push(makeChartSpec({
      type: 'area', tabId: 'trend', priority: 100, width: 'full',
      title: `Monthly ${a.primaryAmountCol}`,
      description: `Month-over-month ${a.primaryAmountCol} totals`,
      xCol: a.primaryDateCol, yCol: a.primaryAmountCol,
      aggregation: 'sum', timeSeries: true, timeGroupBy: 'month', limit: 36,
    }));

    // Quarterly bar
    charts.push(makeChartSpec({
      type: 'bar', tabId: 'trend', priority: 90,
      title: `Quarterly ${a.primaryAmountCol}`,
      description: 'Quarter-by-quarter comparison',
      xCol: a.primaryDateCol, yCol: a.primaryAmountCol,
      aggregation: 'sum', timeSeries: true, timeGroupBy: 'quarter', limit: 16,
    }));

    // Daily volume
    charts.push(makeChartSpec({
      type: 'line', tabId: 'trend', priority: 80,
      title: `Daily ${a.primaryAmountCol}`,
      description: 'Daily volume — spot peaks and dips',
      xCol: a.primaryDateCol, yCol: a.primaryAmountCol,
      aggregation: 'sum', timeSeries: true, timeGroupBy: 'day', limit: 60,
    }));
    charts.push(makeChartSpec({
      type: 'calendarHeatmap', tabId: 'trend', priority: 78, width: 'full',
      title: 'Daily Activity Calendar',
      description: `Daily ${a.primaryAmountCol} intensity`,
      xCol: a.primaryDateCol, yCol: a.primaryAmountCol, valueColumn: a.primaryAmountCol,
      aggregation: 'sum', limit: 180,
      reason: 'Calendar heatmaps expose seasonality patterns that line charts can hide.',
      insightQuestion: 'Which days show unusually high or low activity?',
      analysisType: 'trend',
    }));
  } else {
    charts.push(makeChartSpec({
      type: 'line', tabId: 'trend', priority: 100, width: 'full',
      title: 'Record Volume Over Time',
      description: 'Count of records per month',
      xCol: a.primaryDateCol, aggregation: 'count',
      timeSeries: true, timeGroupBy: 'month', limit: 36,
    }));
  }

  return {
    id: 'trend',
    title: 'Trend Analysis',
    description: 'Time-based patterns at multiple granularities',
    charts, layout: 'standard',
  };
}

function buildForecastTab(a) {
  // Only build if we have both a date column AND a numeric measure
  if (!a.primaryDateCol || !a.primaryAmountCol) return null;

  // Mark as a special forecast tab. Actual forecast data is computed
  // at render time from the historical trend (moving-average projection).
  const charts = [
    makeChartSpec({
      type: 'line', tabId: 'forecast', priority: 100, width: 'full',
      title: `${a.primaryAmountCol} — Historical + Estimated`,
      description: 'Past trend with simple moving-average projection (estimate only)',
      xCol: a.primaryDateCol, yCol: a.primaryAmountCol,
      aggregation: 'sum', timeSeries: true, timeGroupBy: 'month', limit: 48,
    }),
  ];
  return {
    id: 'forecast',
    title: 'Forecast (Estimate)',
    description: 'Simple projected trend based on the last 12 months of data',
    charts,
    layout: 'forecast',
    isForecast: true,
  };
}

function buildRiskTab(a) {
  // "Risk" = anomalies, outstanding balances, declining trends, low performers
  const charts = [];
  const outstandingCols = findColsByType(a, ST.OUTSTANDING, ST.BALANCE);
  const statCol = statusColumn(a);

  // Outstanding / overdue chart
  if (outstandingCols.length > 0) {
    charts.push(makeChartSpec({
      type: 'bar', tabId: 'risk', priority: 100,
      title: `${outstandingCols[0]} Exposure`,
      description: 'Where the largest pending amounts sit',
      xCol: a.primaryCategoryCol || a.primaryAgentCol || (a.dimensions || [])[0],
      yCol: outstandingCols[0], aggregation: 'sum', limit: 12,
    }));
  }

  // Low performers (worst 10 by amount)
  if (a.primaryAgentCol && a.primaryAmountCol) {
    charts.push(makeChartSpec({
      type: 'hbar', tabId: 'risk', priority: 90,
      title: `Lowest ${a.primaryAgentCol}s by ${a.primaryAmountCol}`,
      description: `Bottom performers — investigation candidates`,
      xCol: a.primaryAgentCol, yCol: a.primaryAmountCol,
      aggregation: 'sum', limit: 10,
    }));
  }

  // Negative status share (cancelled / pending / failed)
  if (statCol) {
    charts.push(makeChartSpec({
      type: 'bar', tabId: 'risk', priority: 80,
      title: `${statCol} Mix`,
      description: 'Including negative outcomes that need attention',
      xCol: statCol, aggregation: 'count', limit: 12,
    }));
  }

  if (charts.length === 0) return null;
  return {
    id: 'risk',
    title: 'Risk & Anomalies',
    description: 'Outstanding balances, low performers and unusual patterns',
    charts, layout: 'standard',
  };
}

function buildGeographyTab(a) {
  const geoCols = findColsByType(a, ST.REGION, ST.CITY, ST.BRANCH);
  if (geoCols.length === 0) return null;
  const geo = geoCols[0];
  const charts = [
    makeChartSpec({
      type: 'bar', tabId: 'geography', priority: 100,
      title: `Records by ${geo}`,
      description: `Volume distribution across ${geo}`,
      xCol: geo, aggregation: 'count', limit: 15,
    }),
  ];
  if (a.primaryAmountCol) {
    charts.push(makeChartSpec({
      type: 'bar', tabId: 'geography', priority: 95,
      title: `${a.primaryAmountCol} by ${geo}`,
      description: `Top ${geo} by ${a.primaryAmountCol}`,
      xCol: geo, yCol: a.primaryAmountCol, aggregation: 'sum', limit: 12,
    }));
  }
  return {
    id: 'geography',
    title: 'Geography',
    description: `Performance broken down by ${geo}`,
    charts, layout: 'standard',
  };
}

function buildFinancialTab(a) {
  const finCols = findColsByType(a, ST.REVENUE, ST.COST, ST.PROFIT, ST.PAYMENT, ST.COLLECTION, ST.SALARY, ST.EMI, ST.COMMISSION, ST.INVOICE_AMT);
  if (finCols.length === 0) return null;
  const charts = [];

  // For each financial measure, build a small breakdown
  finCols.slice(0, 4).forEach((col, idx) => {
    const dim = a.primaryCategoryCol || a.primaryAgentCol;
    if (dim) {
      charts.push(makeChartSpec({
        type: 'bar', tabId: 'financial', priority: 100 - idx,
        title: `${col} by ${dim}`,
        description: `${col} broken down by ${dim}`,
        xCol: dim, yCol: col, aggregation: 'sum', limit: 12,
      }));
    }
  });

  // Financial trend
  if (a.primaryDateCol && finCols[0]) {
    charts.push(makeChartSpec({
      type: finCols.length >= 2 ? 'composed' : 'area', tabId: 'financial', priority: 90, width: 'full',
      title: `${finCols[0]} Over Time`,
      description: `Monthly ${finCols[0]} trend`,
      xCol: a.primaryDateCol, yCol: finCols[0], secondaryYAxis: finCols[1] || '',
      aggregation: 'sum', timeSeries: true, timeGroupBy: 'month', limit: 24,
    }));
  }

  const profitCol = finCols.find(c => /profit/i.test(c));
  const revenueCol = finCols.find(c => /revenue|sales|collection|payment/i.test(c)) || finCols[0];
  if (revenueCol && (a.primaryCategoryCol || a.primaryAgentCol)) {
    charts.push(makeChartSpec({
      type: 'waterfall', tabId: 'financial', priority: 88, width: 'full',
      title: `${revenueCol} Waterfall`,
      description: `Running contribution by ${a.primaryCategoryCol || a.primaryAgentCol}`,
      xCol: a.primaryCategoryCol || a.primaryAgentCol, yCol: profitCol || revenueCol, valueColumn: profitCol || revenueCol,
      aggregation: 'sum', limit: 10,
      reason: 'Waterfall view helps explain how categories add up to the final result.',
      insightQuestion: 'Which segments add or reduce the final result most?',
      analysisType: 'comparison',
    }));
  }

  if ((a.measures || []).length >= 3) {
    charts.push(makeChartSpec({
      type: 'correlationMatrix', tabId: 'financial', priority: 86, width: 'full',
      title: 'Numeric Relationship Matrix',
      description: 'Correlation between numeric measures',
      xCol: (a.measures || [])[0], yCol: (a.measures || [])[1],
      aggregation: 'count', limit: 8,
      reason: 'Correlation highlights metrics that tend to move together or against each other.',
      insightQuestion: 'Which numeric fields have meaningful relationships?',
      analysisType: 'correlation',
    }));
  }

  if (charts.length === 0) return null;
  return {
    id: 'financial',
    title: 'Financial View',
    description: 'Revenue, cost, profit and collections analysis',
    charts, layout: 'standard',
  };
}

function buildDurationTab(a) {
  const durCols = findColsByType(a, ST.DURATION);
  if (durCols.length === 0) return null;
  const dur = durCols[0];
  const charts = [];
  const dim = a.primaryAgentCol || a.primaryCategoryCol || statusColumn(a);
  if (dim) {
    charts.push(makeChartSpec({
      type: 'bar', tabId: 'duration', priority: 100,
      title: `Avg ${dur} by ${dim}`,
      description: `Average ${dur} per ${dim}`,
      xCol: dim, yCol: dur, aggregation: 'avg', limit: 15,
    }));
    charts.push(makeChartSpec({
      type: 'histogram', tabId: 'duration', priority: 96,
      title: `${dur} Distribution`,
      description: `Distribution and spread of ${dur}`,
      xCol: dur, yCol: dur, valueColumn: dur,
      aggregation: 'count', limit: 12,
      reason: 'Histogram shows whether service time is tightly controlled or has a long tail.',
      insightQuestion: `Are there high-${dur} outliers?`,
      analysisType: 'distribution',
    }));
  }
  if (a.primaryDateCol) {
    charts.push(makeChartSpec({
      type: 'line', tabId: 'duration', priority: 90, width: 'full',
      title: `${dur} Trend`,
      description: `Mean ${dur} over time`,
      xCol: a.primaryDateCol, yCol: dur, aggregation: 'avg',
      timeSeries: true, timeGroupBy: 'month', limit: 24,
    }));
  }
  if (charts.length === 0) return null;
  return {
    id: 'duration',
    title: 'TAT / Duration Analysis',
    description: `Service-level / turnaround time analysis using ${dur}`,
    charts, layout: 'standard',
  };
}

function buildInsightsTab() {
  // Insights tab is mainly text — no charts, just summary panels rendered
  // by the UI directly. Including this id ensures the tab appears.
  return {
    id: 'insights',
    title: 'Insights & Summary',
    description: 'Auto-generated key findings, risks and recommended actions',
    charts: [],
    layout: 'insights',
    isInsights: true,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Per-tab insight + summary generation (deterministic, no AI)
// ────────────────────────────────────────────────────────────────────────────
function tabInsightsAndSummary(tab, analysis, rows) {
  const a = analysis;
  const ins = [];
  let summary = '';

  switch (tab.id) {
    case 'overview': {
      ins.push(`${a.rowCount.toLocaleString('en-IN')} records across ${a.headers.length} columns analysed.`);
      if (a.primaryAmountCol && a.colMeta[a.primaryAmountCol]?.sum) {
        const s = a.colMeta[a.primaryAmountCol].sum;
        ins.push(`Total ${a.primaryAmountCol}: ₹${chunkBig(s)}`);
      }
      if (a.primaryDateCol && a.primaryAmountCol) {
        const trends = buildDateTrends(rows, a.primaryDateCol, a.primaryAmountCol, 'month');
        const m = computeGrowthMetrics(trends);
        if (m) ins.push(`Overall ${m.totalGrowth >= 0 ? 'growth' : 'decline'} of ${Math.abs(m.totalGrowth).toFixed(1)}% across the dataset period.`);
      }
      summary = a.primaryAmountCol
        ? `This overview summarises total ${a.primaryAmountCol}, volume and the key trend driving the business.`
        : `This overview summarises record counts, distributions and key dimensions in the dataset.`;
      break;
    }
    case 'agent': {
      if (a.primaryAgentCol && a.primaryAmountCol) {
        const segs = segmentAnalysis(rows, a.primaryAgentCol, a.primaryAmountCol, 5);
        if (segs[0]) ins.push(`Top performer: ${segs[0].name} with ₹${chunkBig(segs[0].total)} (${segs[0].pct}% of total).`);
        if (segs.length > 3) {
          const bottom = segs[segs.length - 1];
          ins.push(`Lowest of top ${segs.length}: ${bottom.name} (₹${chunkBig(bottom.total)}).`);
        }
        const top3Pct = segs.slice(0, 3).reduce((s, x) => s + x.pct, 0);
        if (top3Pct > 60) ins.push(`Top 3 ${a.primaryAgentCol}s contribute ${top3Pct.toFixed(0)}% of total — high concentration risk.`);
      } else if (a.primaryAgentCol) {
        const uniq = new Set(rows.map(r => String(r[a.primaryAgentCol] || '')).filter(Boolean)).size;
        ins.push(`${uniq} unique ${a.primaryAgentCol}s active in the dataset.`);
      }
      summary = `Compare individual ${a.primaryAgentCol || 'agent'} output, volume and value contribution. Identify top performers and outliers.`;
      break;
    }
    case 'status': {
      const statCol = statusColumn(a);
      if (statCol) {
        const counts = {};
        rows.forEach(r => { const v = String(r[statCol] || '').trim(); if (v) counts[v] = (counts[v] || 0) + 1; });
        const sorted = Object.entries(counts).sort(([, x], [, y]) => y - x);
        if (sorted[0]) {
          const pct = Math.round((sorted[0][1] / a.rowCount) * 100);
          ins.push(`${sorted[0][0]} is the dominant ${statCol} (${pct}% of records).`);
        }
        if (sorted.length > 1) ins.push(`${sorted.length} distinct ${statCol} values detected.`);
      }
      summary = `Breakdown of records by status — useful for conversion, resolution and pipeline analysis.`;
      break;
    }
    case 'category': {
      const cat = a.primaryCategoryCol;
      if (cat && a.primaryAmountCol) {
        const segs = segmentAnalysis(rows, cat, a.primaryAmountCol, 5);
        if (segs[0]) ins.push(`Highest-value ${cat}: ${segs[0].name} (₹${chunkBig(segs[0].total)}).`);
        if (segs.length >= 2) ins.push(`${segs[0].name} contributes ${segs[0].pct}% of total ${a.primaryAmountCol}.`);
      }
      summary = `Compare ${a.primaryCategoryCol || 'category'} contribution to volume and value.`;
      break;
    }
    case 'trend': {
      if (a.primaryDateCol && a.primaryAmountCol) {
        const trends = buildDateTrends(rows, a.primaryDateCol, a.primaryAmountCol, 'month');
        const tc = classifyTrend(trends.map(t => t.value));
        ins.push(`Trend direction: ${tc.label}.`);
        if (trends.length) {
          const peak = trends.reduce((a, b) => a.value > b.value ? a : b);
          const dip  = trends.reduce((a, b) => a.value < b.value ? a : b);
          ins.push(`Peak month: ${peak.name} (₹${chunkBig(peak.value)}).`);
          ins.push(`Weakest month: ${dip.name} (₹${chunkBig(dip.value)}).`);
        }
      }
      summary = `Monthly, quarterly and daily patterns to spot seasonality and momentum.`;
      break;
    }
    case 'forecast': {
      ins.push(`Forecast is a simple moving-average projection — treat as estimate, not prediction.`);
      ins.push(`Uses last 12 months of historical data when available.`);
      summary = `A directional forecast for ${a.primaryAmountCol} over the next 3 months, generated from past trend.`;
      break;
    }
    case 'risk': {
      const outCols = findColsByType(a, ST.OUTSTANDING, ST.BALANCE);
      if (outCols[0]) {
        const total = extractNums(rows, outCols[0]).reduce((s, v) => s + v, 0);
        ins.push(`Total ${outCols[0]}: ₹${chunkBig(total)}.`);
      }
      if (a.primaryAmountCol) {
        const nums = extractNums(rows, a.primaryAmountCol);
        const anom = detectAnomalies(nums, 'iqr');
        if (anom.anomalies?.length) ins.push(`${anom.anomalies.length} anomalous ${a.primaryAmountCol} values detected (IQR method).`);
      }
      summary = `Outstanding exposure, underperformance and unusual values that may need investigation.`;
      break;
    }
    case 'financial': {
      const finCols = findColsByType(a, ST.REVENUE, ST.COST, ST.PROFIT, ST.PAYMENT, ST.COLLECTION);
      finCols.slice(0, 3).forEach(col => {
        const total = extractNums(rows, col).reduce((s, v) => s + v, 0);
        ins.push(`Total ${col}: ₹${chunkBig(total)}.`);
      });
      summary = `Revenue, cost and collection breakdown by dimension and time.`;
      break;
    }
    case 'duration': {
      const dur = findColsByType(a, ST.DURATION)[0];
      if (dur) {
        const nums = extractNums(rows, dur);
        if (nums.length) {
          const avg = nums.reduce((s, v) => s + v, 0) / nums.length;
          ins.push(`Average ${dur}: ${avg.toFixed(1)}.`);
        }
      }
      summary = `SLA / turnaround time analysis to spot delays and process bottlenecks.`;
      break;
    }
    case 'geography': {
      const geo = findColsByType(a, ST.REGION, ST.CITY, ST.BRANCH)[0];
      if (geo) {
        const counts = {};
        rows.forEach(r => { const v = String(r[geo] || '').trim(); if (v) counts[v] = (counts[v] || 0) + 1; });
        const sorted = Object.entries(counts).sort(([, x], [, y]) => y - x);
        if (sorted[0]) ins.push(`Largest ${geo}: ${sorted[0][0]} (${sorted[0][1].toLocaleString('en-IN')} records).`);
      }
      summary = `Geographic distribution of activity and value.`;
      break;
    }
    case 'insights': {
      // Aggregate executive insights — re-use the auto-insights generator
      const auto = generateAutoInsights(a, rows);
      return { insights: auto.slice(0, 8), summary: 'Executive summary of the most important findings across all tabs.' };
    }
    default: break;
  }

  return { insights: ins.filter(Boolean).slice(0, 5), summary };
}

// ────────────────────────────────────────────────────────────────────────────
// Forecast computation — simple moving-average projection.
// Pure function — called by the UI when rendering the forecast chart.
// ────────────────────────────────────────────────────────────────────────────
export function computeForecast(historical, periodsAhead = 3) {
  if (!Array.isArray(historical) || historical.length < 3) return historical || [];
  const values = historical.map(p => Number(p.value) || 0);
  // 3-period centred moving average for the past series
  const window = Math.min(6, Math.max(3, Math.floor(values.length / 4)));
  const recent = values.slice(-window);
  const avg = recent.reduce((s, v) => s + v, 0) / recent.length;
  // Linear slope from last `window` points
  const xs = recent.map((_, i) => i);
  const xMean = (recent.length - 1) / 2;
  const yMean = avg;
  const ssxy = xs.reduce((s, x, i) => s + (x - xMean) * (recent[i] - yMean), 0);
  const ssx  = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
  const slope = ssx ? ssxy / ssx : 0;

  // Build projected periods (label them with month markers)
  const lastLabel = historical[historical.length - 1].name;
  const projected = [];
  for (let i = 1; i <= periodsAhead; i++) {
    const projVal = Math.max(0, recent[recent.length - 1] + slope * i);
    projected.push({
      name: `${lastLabel}+${i}`,
      value: Math.round(projVal),
      forecast: true,
    });
  }

  // Return combined: historical first (forecast=false), then projected (forecast=true)
  return [
    ...historical.map(p => ({ ...p, forecast: false })),
    ...projected,
  ];
}

// ────────────────────────────────────────────────────────────────────────────
// Per-tab KPI selection
// ────────────────────────────────────────────────────────────────────────────
const TAB_KPI_IDS = {
  overview:  ['total_amount', 'total_records', 'mom_growth',     'success_rate'],
  agent:     ['top_performer','active_agents', 'avg_transaction','total_amount'],
  status:    ['success_rate', 'total_records', 'unique_entities','collection_rate'],
  category:  ['total_amount', 'avg_transaction','unique_entities','total_records'],
  trend:     ['total_amount', 'mom_growth',    'total_records',  'avg_transaction'],
  forecast:  ['total_amount', 'mom_growth'],
  risk:      ['collection_rate','total_cost', 'success_rate',    'avg_transaction'],
  geography: ['total_amount', 'total_records', 'unique_entities'],
  financial: ['total_amount', 'total_cost',    'profit_margin',  'collection_rate'],
  duration:  ['avg_duration', 'total_records'],
  insights:  [],
};

function selectKPIs(tab, allKPIs) {
  const ids = TAB_KPI_IDS[tab.id] || [];
  if (!ids.length) return [];
  const map = Object.fromEntries(allKPIs.map(k => [k.id, k]));
  // Keep the requested order, drop ones we don't have
  return ids.map(id => map[id]).filter(Boolean);
}

// ────────────────────────────────────────────────────────────────────────────
// Domain-aware report title
// ────────────────────────────────────────────────────────────────────────────
function buildReportTitle(analysis, userPrompt) {
  if (userPrompt && userPrompt.trim().length > 4) {
    // Use first 60 chars of the user's prompt as a title hint
    const t = userPrompt.trim().slice(0, 60);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  const d = analysis.domain;
  const titles = {
    sales_crm:   'Sales Performance Dashboard',
    finance:     'Financial Performance Dashboard',
    hr_payroll:  'HR & Payroll Dashboard',
    ecommerce:   'E-Commerce Dashboard',
    logistics:   'Logistics & Operations Dashboard',
    healthcare:  'Healthcare Operations Dashboard',
    education:   'Education Performance Dashboard',
    real_estate: 'Real Estate Dashboard',
    telecom:     'Telecom Operations Dashboard',
  };
  if (titles[d]) return titles[d];
  if (analysis.primaryAgentCol && analysis.primaryAmountCol) return 'Performance Dashboard';
  if (analysis.primaryDateCol && analysis.primaryAmountCol)  return 'Trend & Revenue Dashboard';
  if (analysis.primaryStatusCol)                              return 'Status & Conversion Dashboard';
  return 'Business Intelligence Dashboard';
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT — buildMultiTabPlan
// ────────────────────────────────────────────────────────────────────────────
/**
 * Build a complete multi-tab BI dashboard plan from a semantic analysis.
 * Pure deterministic — no AI. Used as the always-on baseline and as fallback
 * when AI is unavailable or returns invalid output.
 */
export function buildMultiTabPlan(analysis, rows = [], userPrompt = '') {
  if (!analysis || !analysis.headers?.length) {
    return { title: 'Dashboard', subtitle: '', tabs: [], insights: [], summary: '' };
  }
  const domain = analysis.domain || 'generic';
  const tabIds = DOMAIN_TABS[domain] || DOMAIN_TABS.generic;

  // Generate KPI pool once
  const allKPIs = generateKPIs(analysis, rows, 12);

  // Build each tab; drop nulls and tabs with no charts (except insights)
  const tabs = tabIds
    .map(id => {
      const builder = TAB_BUILDERS[id];
      if (!builder) return null;
      const built = builder(analysis);
      if (!built) return null;
      const { insights, summary } = tabInsightsAndSummary(built, analysis, rows);
      const kpis = selectKPIs(built, allKPIs);
      // Drop a tab only if it has neither charts nor KPIs nor insights
      if (!built.isInsights && (built.charts || []).length === 0 && kpis.length === 0) return null;
      return { ...built, kpis, insights, summary };
    })
    .filter(Boolean);

  // Overall executive insights — re-use autoInsights and dedup
  const execInsights = generateAutoInsights(analysis, rows);

  return {
    title: buildReportTitle(analysis, userPrompt),
    subtitle: `${analysis.rowCount.toLocaleString('en-IN')} rows · ${analysis.headers.length} columns · ${domain.replace('_', ' ')}`,
    domain,
    confidence: analysis.avgConfidence,
    tabs,
    insights: execInsights,
    summary: tabs[0]?.summary || 'Auto-generated dashboard analysis.',
    columnLabels: {},
    generator: 'tabPlanner',
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Normalise an AI-returned plan into the multi-tab schema.
// If the AI returns a flat charts[] (legacy), wrap it into a synthetic
// "Overview" tab + run the deterministic planner to add more tabs.
// ────────────────────────────────────────────────────────────────────────────
export function normalizeAiPlan(aiPlan, analysis, rows, userPrompt = '') {
  if (!aiPlan || typeof aiPlan !== 'object') {
    return buildMultiTabPlan(analysis, rows, userPrompt);
  }

  const local = buildMultiTabPlan(analysis, rows, userPrompt);

  // Case A — AI already returned tabs[]
  if (Array.isArray(aiPlan.tabs) && aiPlan.tabs.length > 0) {
    const validHeaders = new Set(analysis.headers);

    const cleanedTabs = aiPlan.tabs.map((t, i) => {
      const cleanCharts = (Array.isArray(t.charts) ? t.charts : [])
        .filter(c => c && validHeaders.has(c.xCol) && (c.yCol == null || c.yCol === '' || validHeaders.has(c.yCol)))
        .map(c => ({
          id: c.id || `${t.id || `tab${i}`}_${c.xCol}_${c.yCol || ''}_${c.type}`,
          type: c.type || 'bar',
          title: (c.title || '').slice(0, 120),
          description: (c.description || '').slice(0, 200),
          xCol: c.xCol,
          yCol: c.yCol || null,
          aggregation: c.aggregation || 'sum',
          timeSeries: !!c.timeSeries,
          timeGroupBy: c.timeGroupBy || 'month',
          limit: c.limit || 15,
          width: c.width || 'half',
          tabId: t.id || `tab${i}`,
          priority: c.priority || (100 - i),
        }));

      const tabId = t.id || `tab${i}`;
      // Backfill insights/summary if AI didn't provide them
      const det = local.tabs.find(x => x.id === tabId);
      return {
        id: tabId,
        title: (t.title || `Tab ${i + 1}`).slice(0, 60),
        description: (t.description || t.purpose || '').slice(0, 200),
        charts: cleanCharts,
        insights: Array.isArray(t.insights) && t.insights.length ? t.insights.slice(0, 5) : (det?.insights || []),
        summary: (t.summary || det?.summary || '').slice(0, 280),
        kpis: det?.kpis || [],
        layout: t.layout || 'standard',
        isForecast: tabId === 'forecast',
        isInsights: tabId === 'insights',
      };
    }).filter(t => (t.charts && t.charts.length > 0) || t.isInsights);

    return {
      title: aiPlan.title || local.title,
      subtitle: aiPlan.subtitle || local.subtitle,
      domain: aiPlan.domain || local.domain,
      confidence: aiPlan.confidence || analysis.avgConfidence,
      tabs: cleanedTabs.length ? cleanedTabs : local.tabs,
      insights: Array.isArray(aiPlan.insights) && aiPlan.insights.length ? aiPlan.insights.slice(0, 6) : local.insights,
      summary: aiPlan.summary || local.summary,
      columnLabels: aiPlan.columnLabels || {},
      generator: 'ai+planner',
    };
  }

  // Case B — AI returned legacy flat charts[].
  // Use AI title/insights but wrap charts into our deterministic tabs structure.
  if (Array.isArray(aiPlan.charts) && aiPlan.charts.length > 0) {
    const validHeaders = new Set(analysis.headers);
    const aiCharts = aiPlan.charts
      .filter(c => c && validHeaders.has(c.xCol) && (c.yCol == null || c.yCol === '' || validHeaders.has(c.yCol)))
      .map((c, i) => ({
        id: `overview_${c.xCol}_${c.yCol || ''}_${c.type}`,
        type: c.type || 'bar',
        title: (c.title || '').slice(0, 120),
        description: (c.description || '').slice(0, 200),
        xCol: c.xCol,
        yCol: c.yCol || null,
        aggregation: c.aggregation || 'sum',
        timeSeries: !!c.timeSeries,
        timeGroupBy: c.timeGroupBy || 'month',
        limit: c.limit || 15,
        width: c.width || 'half',
        tabId: 'overview',
        priority: 100 - i,
      }));

    // Merge AI charts into our Overview tab and keep the rest of the deterministic tabs
    const newTabs = local.tabs.map(t => t.id === 'overview' ? { ...t, charts: [...aiCharts, ...t.charts].slice(0, 6) } : t);
    return {
      ...local,
      tabs: newTabs,
      title: aiPlan.title || local.title,
      subtitle: aiPlan.subtitle || local.subtitle,
      insights: Array.isArray(aiPlan.insights) && aiPlan.insights.length ? aiPlan.insights.slice(0, 6) : local.insights,
      generator: 'ai-flat+planner',
    };
  }

  // Case C — AI returned nothing useful
  return local;
}

// ────────────────────────────────────────────────────────────────────────────
// File / plan signature for AI plan caching
// ────────────────────────────────────────────────────────────────────────────
export function planSignature({ headers, rowCount, userPrompt, columnHelp }) {
  // Lightweight non-crypto hash so we can cache per-file-shape in localStorage
  const raw = JSON.stringify({
    h: headers || [],
    n: rowCount || 0,
    p: (userPrompt || '').trim().toLowerCase(),
    c: (columnHelp || '').trim().toLowerCase(),
  });
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return `plan_${Math.abs(hash).toString(36)}`;
}

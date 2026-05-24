/**
 * BLUEPRINT v1.0 SCHEMA + TRANSLATOR + VALIDATOR + LOCAL EVALUATORS
 * ─────────────────────────────────────────────────────────────────────────────
 * BlueprintX strict JSON contract used between the app and any AI (manual or
 * automatic). AI is ONLY a dashboard architect — never sees full data and
 * never computes chart values. This module:
 *
 *  1. Generates the AI prompt        (generateAIBlueprintPrompt)
 *  2. Opens ChatGPT / Gemini with it (openChatGPTWithBlueprintPrompt / openGeminiWithBlueprintPrompt)
 *  3. Parses pasted AI text          (parseAIBlueprint)
 *  4. Validates the blueprint        (validateAIBlueprint)
 *  5. Translates v1.0 ↔ internal     (toInternalChart / toBlueprintChart)
 *  6. Evaluates KPIs & chart data    (calculateKpiFromSpec / calculateChartDataFromSpec)
 *  7. Builds local smart blueprint   (createLocalSmartBlueprint)
 *  8. Caches blueprints              (hashDatasetSignature / getCachedBlueprint / setCachedBlueprint)
 *
 * Schema reference is in BLUEPRINT_SCHEMA below.
 */

import { aggregateForChart, buildDateTrends, extractNums } from './analyticsEngine.js';
import { ST } from './semanticEngine.js';
import { buildMultiTabPlan } from './tabPlanner.js';

// ─── Constants ───────────────────────────────────────────────────────────────
export const BLUEPRINT_VERSION = '1.0';

export const SUPPORTED_CHART_TYPES = [
  'bar', 'horizontalBar', 'stackedBar', 'line', 'area', 'pie', 'donut', 'composed',
  'scatter', 'radar', 'table', 'heatmap', 'treemap', 'funnel', 'gauge', 'radialBar',
  'waterfall', 'histogram', 'correlationMatrix', 'calendarHeatmap', 'kpiTrendCard',
];
export const SUPPORTED_AGGREGATIONS = ['sum', 'count', 'average', 'min', 'max', 'unique_count'];
export const SUPPORTED_DOMAINS = ['sales', 'support', 'calls', 'logistics', 'finance', 'hr', 'education', 'crm', 'operations', 'generic'];
export const SUPPORTED_TAB_TYPES = ['overview', 'performance', 'trend', 'distribution', 'forecasting', 'risk', 'detail', 'summary', 'quality', 'correlation'];
export const SUPPORTED_FORMATS = ['currency', 'number', 'percent', 'duration'];

// ─── Schema reference (for AI prompt + human reference) ──────────────────────
export const BLUEPRINT_SCHEMA = {
  version: BLUEPRINT_VERSION,
  reportTitle: 'string',
  domain: SUPPORTED_DOMAINS.join(' | '),
  confidence: 0,
  executiveSummary: 'string',
  tabs: [
    {
      tabId: 'string-kebab-case',
      tabName: 'Display name',
      tabType: SUPPORTED_TAB_TYPES.join(' | '),
      summary: 'Short explanation of what this tab shows',
      businessQuestions: ['Question this tab answers'],
      recommendedActions: ['Action 1', 'Action 2'],
      watchouts: ['Risk or data caveat'],
      kpis: [
        {
          id: 'kpi_unique_id',
          name: 'Total Sales',
          column: 'exact column name from headers',
          aggregation: SUPPORTED_AGGREGATIONS.join(' | '),
          format: SUPPORTED_FORMATS.join(' | '),
          description: 'What this KPI means',
        },
      ],
      charts: [
        {
          id: 'chart_unique_id',
          title: 'Chart title',
          chartType: SUPPORTED_CHART_TYPES.join(' | '),
          xAxis: 'exact column name from headers',
          yAxis: 'exact numeric column name or null for count',
          valueColumn: 'exact numeric/id column name or empty',
          secondaryYAxis: '',
          groupBy: '',
          aggregation: SUPPORTED_AGGREGATIONS.join(' | '),
          sort: 'desc | asc | none',
          limit: 10,
          analysisType: 'performance | trend | distribution | comparison | correlation | funnel | risk | forecast | quality',
          description: 'What this chart shows',
          insightQuestion: 'Business question answered by the chart',
          reason: 'Why this chart is useful',
          size: 'small | medium | large | wide',
        },
      ],
      insights: ['Short insight 1', 'Short insight 2'],
    },
  ],
};

// ─── 1. AI PROMPT GENERATOR ──────────────────────────────────────────────────
/**
 * Build the strict prompt to send to ChatGPT/Gemini for blueprint generation.
 * Returns a single string ready for prompt:= chatgpt.com/?q=<encoded>
 */
export function generateAIBlueprintPrompt({
  headers = [],
  analysis = {},
  sampleRows = [],
  rowCount = 0,
  detectedDomain = 'generic',
  userPrompt = '',
  availableChartTypes = SUPPORTED_CHART_TYPES,
  availableAggregations = SUPPORTED_AGGREGATIONS,
}) {
  const colMeta = analysis.colMeta || {};

  const columnLines = headers.map(h => {
    const m = colMeta[h] || {};
    const semantic = m.semanticType || 'unknown';
    const dataType = m.dataType || 'text';
    const stats = [];
    if (m.unique != null) stats.push(`unique=${m.unique}`);
    if (m.density != null) stats.push(`density=${m.density}%`);
    if (dataType === 'number' && m.sum != null) stats.push(`sum=${Math.round(m.sum)}`);
    return `  - "${h}" :: ${semantic}/${dataType}${stats.length ? ' [' + stats.join(', ') + ']' : ''}`;
  }).join('\n');

  const sampleStr = JSON.stringify(sampleRows.slice(0, 5));
  const schemaStr = JSON.stringify(BLUEPRINT_SCHEMA, null, 2);

  return `You are a dashboard architect. Your job is to produce a strict JSON BLUEPRINT for a Power BI–style multi-tab dashboard.

RULES — read carefully:
- Do NOT calculate any values. The app will compute everything locally.
- Do NOT invent columns. Use ONLY the column names listed below, exactly as-written.
- Return ONLY valid JSON. No markdown, no code fences, no commentary before or after.
- Available chart types: ${availableChartTypes.join(', ')}
- Available aggregations: ${availableAggregations.join(', ')}
- Use useful business names for tabs (e.g. "Agent Performance", not "Tab 2").
- Keep summaries short and professional.
- Create a "forecasting" tab ONLY if a date column AND a numeric metric both exist.
- Create a "risk" tab ONLY if it adds genuine value.
- Do not create duplicate or near-duplicate charts.
- Pie charts: only for low-cardinality (<10) category/status distributions.
- Scatter charts: require numeric xAxis and numeric yAxis.
- Line/area: prefer a date-like xAxis when available.
- Role: act as a senior BI analyst and dashboard architect, not only a chart generator.
- Goal: design a complete Power BI-style analytical report with tabs, KPIs, insights, risks and recommended actions.
- Aim for minimum 5 tabs, 12 charts, and 6 KPIs when the dataset genuinely supports it.
- Put 2-4 insights and 2 recommended actions on each analytical tab when meaningful.
- Include at least one valid advanced chart where possible: heatmap, funnel, treemap, gauge, histogram, correlationMatrix, calendarHeatmap.
- Do not create charts just to fill numbers. Only create charts that are valid for the listed headers and column types.
- Heatmap: use category/date/status columns for xAxis and yAxis.
- Treemap: use category contribution.
- Funnel: use status/stage lifecycle columns.
- Gauge/radialBar: use percent/rate columns or target vs achieved style columns.
- Histogram: use numeric distributions.
- CorrelationMatrix: only if at least 3 numeric columns exist.
- CalendarHeatmap: only if a date column exists.

ANALYSIS COVERAGE:
A. Executive overview: high-level KPIs, total count, total amount, average, unique count, key status breakdown.
B. Performance analysis: agent/user/employee/guide/team-wise performance, top/bottom performers, contribution percentage, ranking.
C. Trend analysis: daily/weekly/monthly trends, growth/decline, peak and low periods when date columns exist.
D. Distribution analysis: status, category, region, product, source, amount/duration/TAT distributions.
E. Risk and anomaly analysis: overdue/pending/failed statuses, low performers, high TAT, inactive records, unusually high/low values, outliers.
F. Quality analysis: missing values, duplicate IDs, inconsistent statuses, blank important columns, invalid dates or amounts.
G. Correlation analysis: only when multiple numeric columns exist.
H. Funnel/Journey analysis: only when status/stage columns exist.
I. Forecasting: only when date + numeric metric exist; use moving-average language and do not fake forecasts if insufficient.
J. Recommended actions: business-friendly action points for managers and teams.

DATASET CONTEXT:
- Total rows: ${rowCount}
- Detected domain: ${detectedDomain}
- User goal: ${userPrompt || '(none provided — auto-generate the best dashboard)'}

COLUMNS (name :: semanticType/dataType [stats]):
${columnLines}

SAMPLE ROWS (first 5 — for context only, do NOT echo back):
${sampleStr}

RETURN EXACTLY THIS JSON SHAPE:
${schemaStr}

Now return ONLY the JSON object — no surrounding text.`;
}

// ─── 2. URL openers (BlueprintX manual AI mode) ──────────────────────────────
const MAX_URL_LEN = 6000; // ChatGPT/Gemini truncate ~8K; stay safe

function openWithFallback(url, fallbackPrompt) {
  try {
    if (url.length > MAX_URL_LEN) throw new Error('URL too long');
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    return !!w;
  } catch {
    // Fallback: copy prompt + open empty
    try {
      navigator.clipboard?.writeText?.(fallbackPrompt);
    } catch {
      // Clipboard fallback is best-effort.
    }
    return false;
  }
}

export function openChatGPTWithBlueprintPrompt(prompt) {
  const url = `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
  return openWithFallback(url, prompt);
}

export function openGeminiWithBlueprintPrompt(prompt) {
  const url = `https://gemini.google.com/app?q=${encodeURIComponent(prompt)}`;
  return openWithFallback(url, prompt);
}

// ─── 3. PARSER (handles markdown fences, leading prose, common JSON bugs) ────
export function parseAIBlueprint(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { ok: false, error: 'Empty input', blueprint: null };
  }
  let text = rawText.trim();

  // Strip markdown code fences
  text = text.replace(/^```(?:json|JSON)?\s*\n?/, '').replace(/\n?```\s*$/, '');

  // If there's prose before/after JSON, isolate the largest {...} block
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { ok: false, error: 'No JSON object found', blueprint: null };
  let jsonStr = match[0];

  // Common AI mistakes worth repairing:
  // 1. Trailing commas in arrays/objects
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
  // 2. Smart quotes → straight quotes
  jsonStr = jsonStr.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  // 3. Single-quoted strings → double (only when wrapping keys or simple values)
  //    Skip this — too risky to apply broadly without a real parser

  try {
    const blueprint = JSON.parse(jsonStr);
    return { ok: true, error: null, blueprint };
  } catch (err) {
    return { ok: false, error: `JSON parse failed: ${err.message}`, blueprint: null };
  }
}

// ─── 4. VALIDATOR (strict, with friendly errors + stats) ─────────────────────
/**
 * Returns:
 *  {
 *    valid: boolean,
 *    cleanedBlueprint: <blueprint with invalid items removed>,
 *    errors: [string],      // hard blockers
 *    warnings: [string],    // soft issues
 *    stats: { validTabs, validCharts, invalidCharts, validKpis, invalidKpis }
 *  }
 */
export function validateAIBlueprint(blueprint, headers = [], analysis = {}) {
  const result = {
    valid: false,
    cleanedBlueprint: null,
    errors: [],
    warnings: [],
    stats: { validTabs: 0, invalidTabs: 0, validCharts: 0, invalidCharts: 0, validKpis: 0, invalidKpis: 0 },
  };

  if (!blueprint || typeof blueprint !== 'object') {
    result.errors.push('Blueprint is not a JSON object.');
    return result;
  }

  const headerSet = new Set(headers);
  const colMeta = analysis.colMeta || {};

  if (!Array.isArray(blueprint.tabs) || blueprint.tabs.length === 0) {
    result.errors.push('Blueprint must include at least one tab in "tabs".');
    return result;
  }

  const cleanedTabs = [];
  blueprint.tabs.forEach((tab, ti) => {
    if (!tab || typeof tab !== 'object') {
      result.warnings.push(`Tab #${ti + 1} is not an object — skipped.`);
      result.stats.invalidTabs++;
      return;
    }
    const tabId = String(tab.tabId || tab.id || `tab_${ti + 1}`).trim();
    const tabName = String(tab.tabName || tab.title || `Tab ${ti + 1}`).trim();
    if (!tabId || !tabName) {
      result.warnings.push(`Tab #${ti + 1} missing tabId or tabName — skipped.`);
      result.stats.invalidTabs++;
      return;
    }

    // KPIs
    const cleanKpis = [];
    (Array.isArray(tab.kpis) ? tab.kpis : []).forEach((kpi, ki) => {
      const v = validateKpi(kpi, headerSet, colMeta);
      if (v.ok) { cleanKpis.push(v.kpi); result.stats.validKpis++; }
      else      { result.warnings.push(`Tab "${tabName}" → KPI #${ki + 1}: ${v.reason}`); result.stats.invalidKpis++; }
    });

    // Charts
    const cleanCharts = [];
    (Array.isArray(tab.charts) ? tab.charts : []).forEach((chart, ci) => {
      const v = validateChart(chart, headerSet, colMeta);
      if (v.ok) { cleanCharts.push(v.chart); result.stats.validCharts++; }
      else      { result.warnings.push(`Tab "${tabName}" → Chart #${ci + 1}: ${v.reason}`); result.stats.invalidCharts++; }
    });

    // Drop tab if it has nothing visualisable AND nothing textual
    const hasContent = cleanCharts.length > 0 || cleanKpis.length > 0
      || (tab.summary && String(tab.summary).trim())
      || (Array.isArray(tab.insights) && tab.insights.length > 0)
      || (Array.isArray(tab.recommendedActions) && tab.recommendedActions.length > 0);

    if (!hasContent) {
      result.warnings.push(`Tab "${tabName}" has no valid charts, KPIs, or text — skipped.`);
      result.stats.invalidTabs++;
      return;
    }

    cleanedTabs.push({
      tabId,
      tabName,
      tabType: SUPPORTED_TAB_TYPES.includes(tab.tabType) ? tab.tabType : 'detail',
      summary: typeof tab.summary === 'string' ? tab.summary.slice(0, 400) : '',
      businessQuestions: Array.isArray(tab.businessQuestions) ? tab.businessQuestions.slice(0, 6).map(s => String(s).slice(0, 180)) : [],
      recommendedActions: Array.isArray(tab.recommendedActions) ? tab.recommendedActions.slice(0, 6).map(s => String(s).slice(0, 200)) : [],
      watchouts: Array.isArray(tab.watchouts) ? tab.watchouts.slice(0, 6).map(s => String(s).slice(0, 180)) : [],
      kpis: cleanKpis,
      charts: cleanCharts,
      insights: Array.isArray(tab.insights) ? tab.insights.slice(0, 6).map(s => String(s).slice(0, 200)) : [],
    });
    result.stats.validTabs++;
  });

  if (cleanedTabs.length === 0) {
    result.errors.push('No valid tabs survived validation.');
    return result;
  }

  result.cleanedBlueprint = {
    version: BLUEPRINT_VERSION,
    reportTitle: String(blueprint.reportTitle || blueprint.title || 'Dashboard').slice(0, 120),
    domain: SUPPORTED_DOMAINS.includes(blueprint.domain) ? blueprint.domain : 'generic',
    confidence: Number.isFinite(blueprint.confidence) ? blueprint.confidence : analysis.avgConfidence || 0,
    executiveSummary: String(blueprint.executiveSummary || blueprint.summary || '').slice(0, 600),
    tabs: cleanedTabs,
  };
  result.valid = true;
  return result;
}

function validateKpi(kpi, headerSet, colMeta) {
  if (!kpi || typeof kpi !== 'object') return { ok: false, reason: 'not an object' };
  const id = String(kpi.id || '').trim();
  const name = String(kpi.name || '').trim();
  const column = String(kpi.column || '').trim();
  const aggregation = String(kpi.aggregation || '').trim().toLowerCase();
  const format = String(kpi.format || 'number').trim().toLowerCase();

  if (!name) return { ok: false, reason: 'missing name' };
  if (!column) return { ok: false, reason: 'missing column' };
  if (!headerSet.has(column)) return { ok: false, reason: `column "${column}" not in headers` };
  if (!SUPPORTED_AGGREGATIONS.includes(aggregation)) return { ok: false, reason: `invalid aggregation "${aggregation}"` };

  // For non-count aggregations, column should be numeric-ish
  const meta = colMeta[column] || {};
  const numericish = meta.dataType === 'number' || meta.semanticType === ST.NUMERIC;
  if (['sum', 'average', 'min', 'max'].includes(aggregation) && !numericish) {
    return { ok: false, reason: `aggregation "${aggregation}" needs a numeric column ("${column}" is ${meta.dataType || 'unknown'})` };
  }

  return {
    ok: true,
    kpi: {
      id: id || `kpi_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      name: name.slice(0, 60),
      column,
      aggregation,
      format: SUPPORTED_FORMATS.includes(format) ? format : 'number',
      description: String(kpi.description || '').slice(0, 200),
    },
  };
}

function normalizeChartTypeName(type) {
  const raw = String(type || '').trim();
  const aliases = {
    hbar: 'horizontalBar',
    horizontalbar: 'horizontalBar',
    stackedbar: 'stackedBar',
    radialbar: 'radialBar',
    correlationmatrix: 'correlationMatrix',
    calendarheatmap: 'calendarHeatmap',
    kpitrendcard: 'kpiTrendCard',
  };
  return aliases[raw.toLowerCase()] || raw;
}

function isNumericCol(col, colMeta) {
  const m = colMeta[col] || {};
  return m.dataType === 'number' || m.semanticType === ST.NUMERIC
    || ['revenue','payment','collection','cost','profit','balance','invoice_amt','salary','emi','commission','target','percentage','rate','score','duration','quantity'].includes(m.semanticType);
}

function isDateCol(col, colMeta) {
  const m = colMeta[col] || {};
  return m.dataType === 'date' || [ST.DATE, ST.DATETIME, ST.MONTH_COL, ST.YEAR_COL, ST.WEEK_COL, ST.QUARTER_COL].includes(m.semanticType);
}

function isCategoryCol(col, colMeta) {
  const m = colMeta[col] || {};
  return !!col && !isNumericCol(col, colMeta) && m.semanticType !== ST.ID;
}

function validateChart(chart, headerSet, colMeta) {
  if (!chart || typeof chart !== 'object') return { ok: false, reason: 'not an object' };
  const id = String(chart.id || '').trim();
  const title = String(chart.title || '').trim();
  const chartType = normalizeChartTypeName(chart.chartType || chart.type);
  const xAxis = String(chart.xAxis || chart.xCol || '').trim();
  let yAxis = chart.yAxis || chart.yCol;
  if (yAxis === null || yAxis === '' || yAxis === undefined) yAxis = null;
  else yAxis = String(yAxis).trim();
  let valueColumn = chart.valueColumn || chart.valueCol || '';
  valueColumn = valueColumn ? String(valueColumn).trim() : '';
  let groupBy = chart.groupBy || chart.secondaryYAxis || '';
  groupBy = groupBy ? String(groupBy).trim() : '';
  const aggregation = String(chart.aggregation || 'count').trim().toLowerCase();

  if (!title) return { ok: false, reason: 'missing title' };
  if (!SUPPORTED_CHART_TYPES.includes(chartType)) return { ok: false, reason: `invalid chartType "${chartType}"` };
  if (!['correlationMatrix'].includes(chartType) && !xAxis) return { ok: false, reason: 'missing xAxis' };
  if (xAxis && !headerSet.has(xAxis)) return { ok: false, reason: `xAxis "${xAxis}" not in headers` };
  if (yAxis && !headerSet.has(yAxis)) return { ok: false, reason: `yAxis "${yAxis}" not in headers` };
  if (valueColumn && !headerSet.has(valueColumn)) return { ok: false, reason: `valueColumn "${valueColumn}" not in headers` };
  if (groupBy && !headerSet.has(groupBy)) return { ok: false, reason: `groupBy "${groupBy}" not in headers` };
  if (!SUPPORTED_AGGREGATIONS.includes(aggregation)) return { ok: false, reason: `invalid aggregation "${aggregation}"` };

  // Scatter requires numeric x AND y
  if (chartType === 'scatter') {
    if (!isNumericCol(xAxis, colMeta) || !isNumericCol(yAxis, colMeta)) {
      return { ok: false, reason: 'scatter chart requires numeric xAxis AND yAxis' };
    }
  }
  if (chartType === 'heatmap') {
    if (!xAxis || !yAxis) return { ok: false, reason: 'heatmap requires xAxis and yAxis dimensions' };
    if (!isCategoryCol(xAxis, colMeta) && !isDateCol(xAxis, colMeta)) return { ok: false, reason: 'heatmap xAxis should be category/date/status' };
    if (!isCategoryCol(yAxis, colMeta) && !isDateCol(yAxis, colMeta)) return { ok: false, reason: 'heatmap yAxis should be category/date/status' };
  }
  if (chartType === 'treemap' && !isCategoryCol(xAxis, colMeta)) return { ok: false, reason: 'treemap requires a category xAxis' };
  if (chartType === 'funnel') {
    const st = colMeta[xAxis]?.semanticType || '';
    if (!(st === ST.STATUS || /status|stage|step|lifecycle|journey/i.test(xAxis))) return { ok: false, reason: 'funnel requires a status/stage column' };
  }
  if (['gauge', 'radialBar'].includes(chartType)) {
    const gaugeCol = yAxis || valueColumn;
    const hasTargetStyle = [...headerSet].some(h => /target|goal|quota|planned/i.test(h));
    if (gaugeCol && !isNumericCol(gaugeCol, colMeta)) return { ok: false, reason: 'gauge/radialBar needs a numeric percent/rate/value column' };
    if (!gaugeCol && !hasTargetStyle) return { ok: false, reason: 'gauge/radialBar needs a percent column or target-style column' };
  }
  if (chartType === 'histogram' && !isNumericCol(yAxis || valueColumn || xAxis, colMeta)) return { ok: false, reason: 'histogram requires a numeric column' };
  if (chartType === 'correlationMatrix' && Object.keys(colMeta).filter(c => isNumericCol(c, colMeta)).length < 3) return { ok: false, reason: 'correlationMatrix requires at least 3 numeric columns' };
  if (chartType === 'calendarHeatmap' && !isDateCol(xAxis, colMeta)) return { ok: false, reason: 'calendarHeatmap requires a date xAxis' };
  if (chartType === 'waterfall' && !isNumericCol(yAxis || valueColumn, colMeta)) return { ok: false, reason: 'waterfall requires a meaningful numeric yAxis/valueColumn' };

  // Sum/avg/min/max require numeric yAxis
  if (['sum', 'average', 'min', 'max'].includes(aggregation)) {
    const measureCol = valueColumn || yAxis;
    if (!measureCol) return { ok: false, reason: `aggregation "${aggregation}" requires a numeric yAxis or valueColumn` };
    if (!isNumericCol(measureCol, colMeta)) {
      return { ok: false, reason: `measure "${measureCol}" is not numeric (required for ${aggregation})` };
    }
  }

  // size mapping
  const sizeRaw = String(chart.size || 'medium').toLowerCase();
  const size = ['small', 'medium', 'large', 'wide'].includes(sizeRaw) ? sizeRaw : 'medium';
  const sort = ['asc', 'desc', 'none'].includes(String(chart.sort || '').toLowerCase()) ? String(chart.sort).toLowerCase() : 'desc';
  const limit = Number.isFinite(chart.limit) && chart.limit > 0 ? Math.min(50, Math.floor(chart.limit)) : 15;

  return {
    ok: true,
    chart: {
      id: id || `chart_${chartType}_${xAxis}_${yAxis || 'count'}`.toLowerCase().replace(/[^a-z0-9_]+/g, '_'),
      title: title.slice(0, 120),
      chartType,
      xAxis,
      yAxis,
      valueColumn,
      secondaryYAxis: chart.secondaryYAxis && headerSet.has(chart.secondaryYAxis) ? chart.secondaryYAxis : '',
      groupBy,
      aggregation,
      sort,
      limit,
      analysisType: String(chart.analysisType || '').slice(0, 40),
      description: String(chart.description || '').slice(0, 200),
      insightQuestion: String(chart.insightQuestion || '').slice(0, 200),
      reason: String(chart.reason || '').slice(0, 200),
      size,
    },
  };
}

// ─── 5. v1.0 ↔ INTERNAL TRANSLATOR ───────────────────────────────────────────
// Internal chart spec shape (used by ChartWidget / tabPlanner):
//   { id, type, title, description, xCol, yCol, aggregation, timeSeries, timeGroupBy, limit, width }

const AGG_MAP_TO_INTERNAL = { sum:'sum', count:'count', average:'avg', min:'min', max:'max', unique_count:'unique_count' };
const AGG_MAP_TO_BLUEPRINT = { sum:'sum', count:'count', avg:'average', min:'min', max:'max', unique_count:'unique_count' };

export function toInternalChart(bp, dateCols = []) {
  const dateSet = new Set(dateCols);
  const isTimeSeries = dateSet.has(bp.xAxis) && ['line', 'area'].includes(bp.chartType);
  const widthBySize = { small: 'half', medium: 'half', large: 'full', wide: 'full' };
  return {
    id: bp.id,
    type: normalizeChartTypeName(bp.chartType),
    title: bp.title,
    description: bp.description,
    reason: bp.reason || '',
    insightQuestion: bp.insightQuestion || '',
    analysisType: bp.analysisType || '',
    xCol: bp.xAxis,
    yCol: bp.yAxis,
    valueColumn: bp.valueColumn || bp.yAxis || '',
    groupBy: bp.groupBy || bp.secondaryYAxis || '',
    secondaryYAxis: bp.secondaryYAxis || '',
    aggregation: AGG_MAP_TO_INTERNAL[bp.aggregation] || 'sum',
    timeSeries: isTimeSeries,
    timeGroupBy: 'month',
    limit: bp.limit,
    size: bp.size || 'medium',
    width: widthBySize[bp.size] || 'half',
  };
}

export function toBlueprintChart(internal) {
  const sizeByWidth = internal.width === 'full' ? 'large' : 'medium';
  return {
    id: internal.id,
    title: internal.title,
    chartType: internal.type,
    xAxis: internal.xCol,
    yAxis: internal.yCol,
    valueColumn: internal.valueColumn || internal.yCol || '',
    secondaryYAxis: internal.secondaryYAxis || '',
    groupBy: internal.groupBy || '',
    aggregation: AGG_MAP_TO_BLUEPRINT[internal.aggregation] || 'sum',
    sort: 'desc',
    limit: internal.limit || 15,
    analysisType: internal.analysisType || '',
    description: internal.description || '',
    insightQuestion: internal.insightQuestion || '',
    reason: internal.reason || '',
    size: sizeByWidth,
  };
}

// ─── 6. LOCAL KPI + CHART EVALUATORS ─────────────────────────────────────────
/**
 * Compute a KPI value from raw rows + spec — fully local, no AI.
 */
export function calculateKpiFromSpec(rows, kpiSpec) {
  if (!rows?.length || !kpiSpec?.column) return { value: 0, formatted: '—' };
  const col = kpiSpec.column;
  const agg = kpiSpec.aggregation;

  let value = 0;
  if (agg === 'count') {
    value = rows.filter(r => r[col] !== null && r[col] !== undefined && r[col] !== '').length;
  } else if (agg === 'unique_count') {
    value = new Set(rows.map(r => String(r[col] ?? '').trim()).filter(Boolean)).size;
  } else {
    const nums = extractNums(rows, col);
    if (!nums.length) return { value: 0, formatted: '—' };
    if (agg === 'sum')     value = nums.reduce((s, v) => s + v, 0);
    else if (agg === 'average') value = nums.reduce((s, v) => s + v, 0) / nums.length;
    else if (agg === 'min') value = Math.min(...nums);
    else if (agg === 'max') value = Math.max(...nums);
  }

  return { value, formatted: formatKpiValue(value, kpiSpec.format || 'number') };
}

export function formatKpiValue(value, format) {
  if (value == null || !Number.isFinite(value)) return '—';
  switch (format) {
    case 'currency': {
      if (value >= 1e7) return `₹${(value/1e7).toFixed(2)} Cr`;
      if (value >= 1e5) return `₹${(value/1e5).toFixed(2)} L`;
      if (value >= 1e3) return `₹${(value/1e3).toFixed(1)} K`;
      return `₹${Math.round(value).toLocaleString('en-IN')}`;
    }
    case 'percent':  return `${value.toFixed(1)}%`;
    case 'duration': return `${value.toFixed(1)}`;
    case 'number':
    default: {
      if (value >= 1e7) return `${(value/1e7).toFixed(2)} Cr`;
      if (value >= 1e5) return `${(value/1e5).toFixed(2)} L`;
      if (value >= 1e3) return `${(value/1e3).toFixed(1)} K`;
      return Math.round(value).toLocaleString('en-IN');
    }
  }
}

/**
 * Compute chart data from raw rows + spec — fully local, no AI.
 * Reuses analyticsEngine.aggregateForChart / buildDateTrends.
 */
export function calculateChartDataFromSpec(rows, chartSpec, analysis = {}) {
  if (!rows?.length || !chartSpec?.xAxis) return [];
  const internal = toInternalChart(chartSpec, (analysis.temporals || []));
  // Time series for line/area on date column
  if (internal.timeSeries) {
    return buildDateTrends(rows, internal.xCol, internal.yCol || null, internal.timeGroupBy || 'month');
  }
  return aggregateForChart(rows, internal.xCol, internal.yCol || null, internal.aggregation || 'sum', internal.limit || 20);
}

// ─── 7. LOCAL SMART BLUEPRINT (no AI) ────────────────────────────────────────
/**
 * Produce a Blueprint v1.0 from deterministic analysis only.
 * Used by Local Smart Builder mode and as fallback when AI fails.
 */
export function createLocalSmartBlueprint(rows, headers, analysis, userPrompt = '') {
  // Reuse the existing multi-tab planner and translate its internal shape to v1.0
  const internalPlan = buildMultiTabPlan(analysis, rows, userPrompt);

  const tabs = (internalPlan.tabs || []).map(t => ({
    tabId: t.id,
    tabName: t.title,
    tabType: tabTypeFromInternalId(t.id),
    summary: t.summary || '',
    recommendedActions: t.recommendedActions || [],
    kpis: (t.kpis || []).map(kpi => ({
      id: kpi.id,
      name: kpi.label || kpi.name || kpi.id,
      column: kpi.column || guessColumnFromKpi(kpi, analysis),
      aggregation: guessAggregationFromKpi(kpi),
      format: kpi.format || guessFormatFromKpi(kpi),
      description: kpi.description || '',
    })).filter(k => k.column),
    charts: (t.charts || []).map(toBlueprintChart),
    insights: t.insights || [],
  }));

  return {
    version: BLUEPRINT_VERSION,
    reportTitle: internalPlan.title,
    domain: mapDomainToBlueprint(internalPlan.domain),
    confidence: internalPlan.confidence,
    executiveSummary: internalPlan.summary || '',
    tabs,
  };
}

function tabTypeFromInternalId(id) {
  const map = {
    overview: 'overview', agent: 'performance', status: 'distribution',
    category: 'performance', trend: 'trend', forecast: 'forecasting',
    risk: 'risk', insights: 'summary', financial: 'performance',
    duration: 'performance', geography: 'distribution',
  };
  return map[id] || 'detail';
}

function guessColumnFromKpi(kpi, analysis) {
  if (kpi.column) return kpi.column;
  // Heuristic fallback — most KPI generators expose the source column on .col or via label
  const label = (kpi.label || '').toLowerCase();
  if (/total|sum|amount|revenue|sales|payment/.test(label) && analysis.primaryAmountCol) return analysis.primaryAmountCol;
  if (/agent|performer/.test(label) && analysis.primaryAgentCol) return analysis.primaryAgentCol;
  if (/records|total/.test(label)) return analysis.headers[0];
  return analysis.headers[0];
}

function guessAggregationFromKpi(kpi) {
  const id = (kpi.id || '').toLowerCase();
  if (id.includes('total') || id.includes('sum')) return 'sum';
  if (id.includes('avg') || id.includes('average')) return 'average';
  if (id.includes('unique') || id.includes('active')) return 'unique_count';
  if (id.includes('count') || id.includes('record')) return 'count';
  if (id.includes('rate') || id.includes('margin') || id.includes('growth')) return 'average';
  if (id.includes('min')) return 'min';
  if (id.includes('max')) return 'max';
  return 'sum';
}

function guessFormatFromKpi(kpi) {
  const icon = kpi.icon || '';
  if (icon === 'currency') return 'currency';
  if (icon === 'percent') return 'percent';
  if (icon === 'time') return 'duration';
  return 'number';
}

function mapDomainToBlueprint(internalDomain) {
  const map = {
    sales_crm: 'sales', hr_payroll: 'hr', ecommerce: 'sales',
    finance: 'finance', logistics: 'logistics', healthcare: 'operations',
    education: 'education', real_estate: 'generic', telecom: 'operations',
    generic: 'generic',
  };
  return map[internalDomain] || 'generic';
}

// ─── 8. CACHE ────────────────────────────────────────────────────────────────
const CACHE_KEY = 'blueprintx_cache_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 12;

export function hashDatasetSignature(headers = [], rowCount = 0, semanticTypes = {}) {
  const raw = JSON.stringify({
    h: headers,
    n: rowCount,
    s: Object.fromEntries(Object.entries(semanticTypes).sort()),
  });
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return `bp_${Math.abs(hash).toString(36)}`;
}

function loadAllCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const now = Date.now();
    const cleaned = {};
    Object.entries(raw).forEach(([k, v]) => {
      if (v && (now - (v.t || 0)) < CACHE_TTL_MS) cleaned[k] = v;
    });
    return cleaned;
  } catch { return {}; }
}

function saveAllCache(cache) {
  try {
    const entries = Object.entries(cache).sort(([, a], [, b]) => (b.t || 0) - (a.t || 0));
    const trimmed = Object.fromEntries(entries.slice(0, CACHE_MAX));
    localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage cache writes are best-effort.
  }
}

export function getCachedBlueprint(signature) {
  if (!signature) return null;
  const cache = loadAllCache();
  return cache[signature]?.blueprint || null;
}

export function setCachedBlueprint(signature, blueprint, source = 'ai') {
  if (!signature || !blueprint) return;
  const cache = loadAllCache();
  cache[signature] = { blueprint, source, t: Date.now() };
  saveAllCache(cache);
}

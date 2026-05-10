/**
 * STATISTICAL ANALYTICS ENGINE v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure deterministic analytics. Zero AI dependency.
 *
 * Capabilities:
 *  • Full descriptive statistics (mean, median, std, quartiles, skewness)
 *  • Time-series analysis (MoM, QoQ, YoY growth, CAGR)
 *  • Anomaly detection (Z-score + IQR methods)
 *  • Trend classification (growing / declining / stable / volatile)
 *  • Correlation scoring between numeric columns
 *  • Segment analysis (automatic bucketing)
 *  • Auto-insight generation from data patterns
 */

import { parseFlexibleDate } from './semanticEngine.js';

// ─── Descriptive Statistics ────────────────────────────────────────────────────
export function describeNumeric(nums) {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const variance = sorted.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const q1 = sorted[Math.floor(n * 0.25)];
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  const skewness = std > 0 ? (3 * (mean - median)) / std : 0;
  const min = sorted[0];
  const max = sorted[n - 1];

  return { n, sum, mean, median, std, variance, q1, q3, iqr, skewness, min, max };
}

// ─── Parse numeric value safely ───────────────────────────────────────────────
export function parseNum(v) {
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const n = parseFloat(String(v || '').replace(/[₹$Rs.,% ]/g, ''));
  return isNaN(n) ? null : n;
}

// ─── Extract numeric column values ────────────────────────────────────────────
export function extractNums(rows, col) {
  return rows.map(r => parseNum(r[col])).filter(v => v !== null);
}

// ─── Aggregation Engine ────────────────────────────────────────────────────────
export function aggregateForChart(rows, xCol, yCol, method = 'sum', limit = 30) {
  const agg = {};
  rows.forEach(r => {
    const k = String(r[xCol] ?? '').trim();
    if (!k || k === 'undefined' || k === 'null') return;
    if (!agg[k]) agg[k] = { sum: 0, count: 0, values: [] };
    agg[k].count++;
    if (yCol) {
      const v = parseNum(r[yCol]);
      if (v !== null) { agg[k].sum += v; agg[k].values.push(v); }
    }
  });

  return Object.entries(agg)
    .map(([name, d]) => {
      let value;
      if (method === 'count') value = d.count;
      else if (method === 'avg') value = d.values.length ? d.sum / d.values.length : 0;
      else if (method === 'min') value = d.values.length ? Math.min(...d.values) : 0;
      else if (method === 'max') value = d.values.length ? Math.max(...d.values) : 0;
      else value = d.sum;
      return { name, value };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

// ─── Time-series Aggregation ───────────────────────────────────────────────────
export function buildDateTrends(rows, dateCol, valueCol, groupBy = 'month') {
  const buckets = {};
  rows.forEach(r => {
    const d = parseFlexibleDate(r[dateCol]);
    if (!d) return;
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    let key;
    if (groupBy === 'year') key = `${yr}`;
    else if (groupBy === 'quarter') key = `${yr}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
    else if (groupBy === 'week') {
      const wk = Math.ceil(((d - new Date(yr, 0, 1)) / 86400000 + new Date(yr, 0, 1).getDay() + 1) / 7);
      key = `${yr}-W${String(wk).padStart(2, '0')}`;
    } else if (groupBy === 'day') {
      key = `${yr}-${mo}-${String(d.getDate()).padStart(2, '0')}`;
    } else {
      key = `${yr}-${mo}`;
    }
    if (!buckets[key]) buckets[key] = { sum: 0, count: 0 };
    buckets[key].count++;
    if (valueCol) {
      const v = parseNum(r[valueCol]);
      if (v !== null) buckets[key].sum += v;
    }
  });

  const sorted = Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b))
    .map(([name, d]) => ({ name, value: valueCol ? d.sum : d.count }));

  if (!sorted.length) return [];

  const maxVal = Math.max(...sorted.map(d => d.value));
  const minVal = Math.min(...sorted.map(d => d.value));

  return sorted.map((d, i) => {
    const prev = i > 0 ? sorted[i - 1].value : null;
    const growth = prev !== null && prev > 0 ? Math.round(((d.value - prev) / prev) * 1000) / 10 : null;
    return { name: d.name, value: d.value, growth, isPeak: d.value === maxVal, isWorst: d.value === minVal && d.value !== maxVal };
  });
}

// ─── Trend Classification ──────────────────────────────────────────────────────
export function classifyTrend(values) {
  if (values.length < 3) return { trend: 'insufficient', slope: 0, r2: 0, label: 'Not enough data' };
  const n = values.length;
  const xs = values.map((_, i) => i);
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  const ssxy = xs.reduce((s, x, i) => s + (x - xMean) * (values[i] - yMean), 0);
  const ssx = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
  const slope = ssx ? ssxy / ssx : 0;
  const ssyy = values.reduce((s, y) => s + (y - yMean) ** 2, 0);
  const r2 = ssyy ? Math.min(1, ssxy ** 2 / (ssx * ssyy)) : 0;

  const pctSlope = yMean ? (slope / Math.abs(yMean)) * 100 : 0;
  const std = Math.sqrt(values.reduce((s, v) => s + (v - yMean) ** 2, 0) / n);
  const cv = yMean ? std / Math.abs(yMean) : 0;

  let trend, label;
  if (cv > 0.5) { trend = 'volatile'; label = 'High volatility'; }
  else if (pctSlope > 5 && r2 > 0.3) { trend = 'growing'; label = `Growing (+${pctSlope.toFixed(1)}%/period avg)`; }
  else if (pctSlope < -5 && r2 > 0.3) { trend = 'declining'; label = `Declining (${pctSlope.toFixed(1)}%/period avg)`; }
  else { trend = 'stable'; label = 'Relatively stable'; }

  return { trend, slope, r2: Math.round(r2 * 100) / 100, pctSlope, label, cv };
}

// ─── Anomaly Detection ─────────────────────────────────────────────────────────
export function detectAnomalies(values, method = 'iqr') {
  const nums = values.filter(v => v !== null && !isNaN(v));
  if (nums.length < 5) return { anomalies: [], method };

  let lowerBound, upperBound;
  if (method === 'zscore') {
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    const std = Math.sqrt(nums.reduce((a, v) => a + (v - mean) ** 2, 0) / nums.length);
    lowerBound = mean - 3 * std;
    upperBound = mean + 3 * std;
  } else {
    const sorted = [...nums].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    lowerBound = q1 - 1.5 * iqr;
    upperBound = q3 + 1.5 * iqr;
  }

  const anomalies = values.map((v, i) => ({ index: i, value: v, isAnomaly: v !== null && (v < lowerBound || v > upperBound) }))
    .filter(a => a.isAnomaly);

  return { anomalies, lowerBound, upperBound, method };
}

// ─── Correlation Matrix ────────────────────────────────────────────────────────
export function correlationMatrix(rows, numericCols) {
  if (numericCols.length < 2) return [];

  const data = numericCols.map(col => extractNums(rows, col));
  const result = [];

  for (let i = 0; i < numericCols.length; i++) {
    for (let j = i + 1; j < numericCols.length; j++) {
      const xs = data[i], ys = data[j];
      const n = Math.min(xs.length, ys.length);
      if (n < 5) continue;

      const xSlice = xs.slice(0, n), ySlice = ys.slice(0, n);
      const xMean = xSlice.reduce((a, b) => a + b, 0) / n;
      const yMean = ySlice.reduce((a, b) => a + b, 0) / n;
      const num = xSlice.reduce((s, x, k) => s + (x - xMean) * (ySlice[k] - yMean), 0);
      const den = Math.sqrt(
        xSlice.reduce((s, x) => s + (x - xMean) ** 2, 0) *
        ySlice.reduce((s, y) => s + (y - yMean) ** 2, 0)
      );
      const r = den ? Math.round((num / den) * 100) / 100 : 0;
      if (Math.abs(r) > 0.3) {
        result.push({ colA: numericCols[i], colB: numericCols[j], r, strength: Math.abs(r) > 0.7 ? 'strong' : 'moderate' });
      }
    }
  }
  return result.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, 5);
}

// ─── Growth Metrics ────────────────────────────────────────────────────────────
export function computeGrowthMetrics(trends) {
  if (trends.length < 2) return null;

  const first = trends[0].value;
  const last = trends[trends.length - 1].value;
  const n = trends.length;

  const totalGrowth = first > 0 ? ((last - first) / first) * 100 : 0;
  const cagr = first > 0 && n > 1 ? ((last / first) ** (1 / (n - 1)) - 1) * 100 : 0;

  const growthRates = trends.slice(1).map((t, i) => {
    const prev = trends[i].value;
    return prev > 0 ? ((t.value - prev) / prev) * 100 : 0;
  });
  const avgGrowth = growthRates.reduce((a, b) => a + b, 0) / Math.max(growthRates.length, 1);
  const bestPeriod = trends.reduce((best, t) => (t.growth !== null && t.growth > (best.growth || -Infinity)) ? t : best, trends[0]);
  const worstPeriod = trends.reduce((worst, t) => (t.growth !== null && t.growth < (worst.growth || Infinity)) ? t : worst, trends[0]);

  return { totalGrowth, cagr, avgGrowth, bestPeriod, worstPeriod, periodCount: n, trend: classifyTrend(trends.map(t => t.value)) };
}

// ─── Segment Analysis ─────────────────────────────────────────────────────────
export function segmentAnalysis(rows, dimCol, measureCol, topN = 10) {
  const agg = {};
  rows.forEach(r => {
    const k = String(r[dimCol] ?? '').trim();
    if (!k) return;
    const v = parseNum(r[measureCol]) ?? 0;
    if (!agg[k]) agg[k] = { sum: 0, count: 0 };
    agg[k].sum += v;
    agg[k].count++;
  });

  const entries = Object.entries(agg).map(([name, d]) => ({
    name, total: d.sum, count: d.count, avg: d.count ? d.sum / d.count : 0,
  })).sort((a, b) => b.total - a.total);

  const totalSum = entries.reduce((s, e) => s + e.total, 0);
  return entries.slice(0, topN).map((e, i) => ({
    rank: i + 1, name: e.name, total: e.total, count: e.count, avg: e.avg,
    pct: totalSum > 0 ? Math.round((e.total / totalSum) * 1000) / 10 : 0,
  }));
}

// ─── Auto Insights Generator ───────────────────────────────────────────────────
export function generateAutoInsights(analysis, rows) {
  const insights = [];
  const { primaryAmountCol, primaryAgentCol, primaryStatusCol, primaryDateCol, colMeta, rowCount } = analysis;

  // 1. Dataset size context
  insights.push(`Dataset has ${rowCount.toLocaleString('en-IN')} records across ${analysis.headers.length} columns`);

  // 2. Revenue/Amount insight
  if (primaryAmountCol && colMeta[primaryAmountCol]?.sum) {
    const { sum, avg, min, max } = colMeta[primaryAmountCol];
    insights.push(`Total ${primaryAmountCol}: ₹${formatCompact(sum)} · Avg: ₹${formatCompact(avg)} per record`);
    if (max / Math.max(avg, 1) > 5) insights.push(`${primaryAmountCol} has high variance — top values are ${Math.round(max / avg)}× the average`);
  }

  // 3. Status breakdown insight
  if (primaryStatusCol) {
    const counts = {};
    rows.forEach(r => { const v = String(r[primaryStatusCol] || '').trim(); if (v) counts[v] = (counts[v] || 0) + 1; });
    const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
    if (sorted.length > 0) {
      const top = sorted[0];
      const pct = Math.round((top[1] / rowCount) * 100);
      insights.push(`${top[0]} is the dominant status at ${pct}% of records (${top[1].toLocaleString('en-IN')} rows)`);
    }
  }

  // 4. Top agent insight
  if (primaryAgentCol && primaryAmountCol) {
    const segs = segmentAnalysis(rows, primaryAgentCol, primaryAmountCol, 1);
    if (segs.length) insights.push(`Top performer: ${segs[0].name} with ${formatCompact(segs[0].total)} (${segs[0].pct}% of total)`);
  }

  // 5. Time trend insight
  if (primaryDateCol && primaryAmountCol) {
    const trends = buildDateTrends(rows, primaryDateCol, primaryAmountCol, 'month');
    const metrics = computeGrowthMetrics(trends);
    if (metrics) {
      const dir = metrics.totalGrowth >= 0 ? 'grew' : 'declined';
      insights.push(`${primaryAmountCol} ${dir} ${Math.abs(metrics.totalGrowth).toFixed(1)}% over the dataset period`);
    }
  }

  // 6. Data quality note
  const lowDensityCols = analysis.headers.filter(h => (colMeta[h]?.density || 100) < 70);
  if (lowDensityCols.length > 0) insights.push(`${lowDensityCols.length} column(s) have >30% missing values: ${lowDensityCols.slice(0, 3).join(', ')}`);

  return insights.slice(0, 5);
}

// ─── Format compact numbers ────────────────────────────────────────────────────
export function formatCompact(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const v = Number(n);
  if (Math.abs(v) >= 1e7) return `${(v / 1e7).toFixed(2)} Cr`;
  if (Math.abs(v) >= 1e5) return `${(v / 1e5).toFixed(2)} L`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)} K`;
  return Math.round(v).toLocaleString('en-IN');
}

export function formatKPIValue(value, semanticType) {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  if (isNaN(n)) return String(value);
  const financialTypes = ['revenue','payment','collection','cost','profit','balance','invoice_amt','salary','commission','emi','outstanding','numeric'];
  const prefix = financialTypes.includes(semanticType) ? '₹' : '';
  return prefix + formatCompact(n);
}

// ─── DashboardStorage ──────────────────────────────────────────────────────────
const STORAGE_KEY = 'adm_v3';
const MAX_SAVED = 12;

export const DashboardStorage = {
  load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } },
  save(entry) {
    try {
      const list = this.load().filter(d => d.id !== entry.id);
      list.unshift(entry);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_SAVED)));
    } catch {}
  },
  remove(id) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.load().filter(d => d.id !== id))); } catch {} },
  getById(id) { return this.load().find(d => d.id === id) || null; },
};

// ─── Data Quality Analysis ─────────────────────────────────────────────────────
export function analyzeDataQuality(rows, headers) {
  if (!rows.length) return { score: 100, issues: [], nullCols: [], dupCount: 0 };

  const issues = [];
  let penalty = 0;
  const nullCols = [];

  // Per-column null/missing analysis
  headers.forEach(h => {
    const nullCount = rows.filter(r => r[h] === null || r[h] === undefined || String(r[h]).trim() === '').length;
    const nullRate  = nullCount / rows.length;
    if (nullRate > 0.5)      { issues.push(`"${h}": ${Math.round(nullRate * 100)}% missing`); penalty += 10; nullCols.push(h); }
    else if (nullRate > 0.3) { issues.push(`"${h}": ${Math.round(nullRate * 100)}% missing`); penalty += 5;  nullCols.push(h); }
    else if (nullRate > 0.1) { penalty += 2; nullCols.push(h); }
  });

  // Duplicate detection on a sample (cap at 2000 for performance)
  const sampleSize = Math.min(rows.length, 2000);
  const sample = rows.slice(0, sampleSize);
  const rowKeys = new Set();
  let dupCount = 0;
  sample.forEach(r => {
    const key = headers.map(h => String(r[h] ?? '')).join(' ');
    if (rowKeys.has(key)) dupCount++;
    else rowKeys.add(key);
  });
  const estimatedDups = Math.round((dupCount / sampleSize) * rows.length);
  if (estimatedDups > 0) {
    issues.push(`~${estimatedDups.toLocaleString()} duplicate rows estimated`);
    penalty += Math.min(10, Math.round((dupCount / sampleSize) * 100));
  }

  return {
    score:    Math.max(0, Math.min(100, 100 - penalty)),
    issues,
    nullCols,
    dupCount: estimatedDups,
  };
}

// ─── Build AI payload (for AI fallback) ───────────────────────────────────────
export function buildAIPayload(analysis, userPrompt = '', helperText = '') {
  const { headers, colMeta, rowCount, semanticMap, relationships } = analysis;
  const colLines = headers.map(h => {
    const m = colMeta[h];
    const st = m?.semanticType || 'text';
    let extra = '';
    if (m?.min !== undefined) extra = `, range: ${Math.round(m.min)}–${Math.round(m.max)}, avg: ${Math.round(m.avg || 0)}`;
    else if (m?.unique <= 10) extra = `, values: [${(m.sample || []).slice(0, 5).join(', ')}]`;
    else extra = `, unique: ${m?.unique}`;
    return `  - "${h}" (${st}${extra})`;
  }).join('\n');

  return [
    `ROWS: ${rowCount}`,
    `COLUMNS:\n${colLines}`,
    relationships?.length > 0 ? `RELATIONSHIPS:\n${relationships.slice(0, 5).map(r => `  - ${r}`).join('\n')}` : '',
    userPrompt ? `USER_REQUEST: ${userPrompt}` : '',
    helperText ? `COLUMN_NOTES: ${helperText}` : '',
  ].filter(Boolean).join('\n\n').slice(0, 3500);
}

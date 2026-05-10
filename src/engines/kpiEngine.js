/**
 * KPI DETECTION ENGINE v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Auto-detects business KPIs from any dataset. Zero AI dependency.
 *
 * KPI Templates (business domain–aware):
 *  • Financial  — total revenue, total cost, profit margin, collection rate
 *  • Sales/CRM  — total leads, conversion rate, top performer, avg deal size
 *  • Operations — total records, success rate, avg duration, unique entities
 *  • Trend      — MoM growth, CAGR, best/worst period
 *  • Comparative— vs target, actual vs budget
 */

import { ST, ROLE } from './semanticEngine.js';
import { buildDateTrends, computeGrowthMetrics, segmentAnalysis, formatKPIValue, extractNums, describeNumeric } from './analyticsEngine.js';

// ─── KPI icon map ──────────────────────────────────────────────────────────────
const ICON = {
  currency: 'currency', count: 'count', percent: 'percent',
  person: 'person', trend: 'trend', time: 'time',
};

// ─── KPI builder helpers ───────────────────────────────────────────────────────
function makeKPI(id, label, value, formatted, icon, extras = {}) {
  return { id, label, value, formatted, change: null, changeLabel: '', icon, sparkline: undefined, ...extras };
}

// ─── KPI Generators ────────────────────────────────────────────────────────────
const KPI_GENERATORS = [

  // ── 1. Total Amount / Revenue ────────────────────────────────────────────────
  {
    id: 'total_amount',
    priority: 100,
    condition: (a) => !!a.primaryAmountCol,
    generate: (a, rows) => {
      const col = a.primaryAmountCol;
      const nums = extractNums(rows, col);
      const total = nums.reduce((s, v) => s + v, 0);
      const spark = a.primaryDateCol
        ? buildDateTrends(rows, a.primaryDateCol, col, 'month').slice(-8).map(t => t.value)
        : [];
      return makeKPI('total_amount', `Total ${col}`, total, formatKPIValue(total, a.colMeta[col]?.semanticType), ICON.currency, {
        sparkline: spark.length >= 3 ? spark : undefined,
      });
    },
  },

  // ── 2. Total Records ─────────────────────────────────────────────────────────
  {
    id: 'total_records',
    priority: 95,
    condition: () => true,
    generate: (a, rows) => makeKPI('total_records', 'Total Records', rows.length, rows.length.toLocaleString('en-IN'), ICON.count),
  },

  // ── 3. Unique Leads / Entities ───────────────────────────────────────────────
  {
    id: 'unique_entities',
    priority: 90,
    condition: (a) => a.mobileCols.length > 0 || a.idCols.length > 0,
    generate: (a, rows) => {
      const col = a.mobileCols[0] || a.idCols[0];
      const unique = new Set(rows.map(r => String(r[col] || '')).filter(v => v && v !== 'undefined')).size;
      const label = a.mobileCols.length > 0 ? 'Unique Leads' : `Unique ${col}`;
      return makeKPI('unique_entities', label, unique, unique.toLocaleString('en-IN'), ICON.count);
    },
  },

  // ── 4. Success / Conversion Rate ─────────────────────────────────────────────
  {
    id: 'success_rate',
    priority: 88,
    condition: (a) => !!a.primaryStatusCol,
    generate: (a, rows) => {
      const POSITIVE = new Set([
        'paid','answered','converted','success','successful','approved','completed',
        'done','yes','active','won','collected','settled','closed','resolved','interested',
      ]);
      const pos = rows.filter(r => POSITIVE.has(String(r[a.primaryStatusCol] || '').toLowerCase().trim())).length;
      const rate = rows.length > 0 ? (pos / rows.length) * 100 : 0;
      return makeKPI('success_rate', 'Success Rate', rate, `${rate.toFixed(1)}%`, ICON.percent, {
        changeLabel: `${pos.toLocaleString('en-IN')} of ${rows.length.toLocaleString('en-IN')}`,
      });
    },
  },

  // ── 5. MoM Growth ────────────────────────────────────────────────────────────
  {
    id: 'mom_growth',
    priority: 85,
    condition: (a) => !!a.primaryDateCol && !!a.primaryAmountCol,
    generate: (a, rows) => {
      const trends = buildDateTrends(rows, a.primaryDateCol, a.primaryAmountCol, 'month');
      if (trends.length < 2) return null;
      const last = trends[trends.length - 1];
      const prev = trends[trends.length - 2];
      const g = prev.value > 0 ? ((last.value - prev.value) / prev.value) * 100 : 0;
      return makeKPI('mom_growth', 'MoM Growth', g, `${g >= 0 ? '+' : ''}${g.toFixed(1)}%`, ICON.trend, {
        change: g,
        changeLabel: `vs ${prev.name}`,
        sparkline: trends.slice(-8).map(t => t.value),
      });
    },
  },

  // ── 6. Top Performer ─────────────────────────────────────────────────────────
  {
    id: 'top_performer',
    priority: 82,
    condition: (a) => !!a.primaryAgentCol && !!a.primaryAmountCol,
    generate: (a, rows) => {
      const segs = segmentAnalysis(rows, a.primaryAgentCol, a.primaryAmountCol, 1);
      if (!segs.length) return null;
      return makeKPI('top_performer', 'Top Performer', segs[0].name, segs[0].name, ICON.person, {
        changeLabel: formatKPIValue(segs[0].total, a.colMeta[a.primaryAmountCol]?.semanticType),
      });
    },
  },

  // ── 7. Average Transaction / Ticket ─────────────────────────────────────────
  {
    id: 'avg_transaction',
    priority: 78,
    condition: (a) => !!a.primaryAmountCol,
    generate: (a, rows) => {
      const nums = extractNums(rows, a.primaryAmountCol);
      const avg = nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : 0;
      return makeKPI('avg_transaction', `Avg ${a.primaryAmountCol}`, avg, formatKPIValue(avg, a.colMeta[a.primaryAmountCol]?.semanticType), ICON.currency);
    },
  },

  // ── 8. Collection Rate (outstanding vs paid) ─────────────────────────────────
  {
    id: 'collection_rate',
    priority: 80,
    condition: (a) => {
      const types = Object.values(a.colMeta || {}).map(m => m.semanticType);
      return types.includes(ST.COLLECTION) || types.includes(ST.OUTSTANDING) || types.includes(ST.PAYMENT);
    },
    generate: (a, rows) => {
      const collCol = Object.keys(a.colMeta || {}).find(h => [ST.COLLECTION, ST.PAYMENT].includes(a.colMeta[h]?.semanticType));
      const totCol  = Object.keys(a.colMeta || {}).find(h => [ST.OUTSTANDING, ST.BALANCE, ST.TARGET].includes(a.colMeta[h]?.semanticType));
      if (!collCol || !totCol) return null;
      const coll = extractNums(rows, collCol).reduce((s, v) => s + v, 0);
      const tot  = extractNums(rows, totCol).reduce((s, v) => s + v, 0);
      if (!tot) return null;
      const rate = (coll / tot) * 100;
      return makeKPI('collection_rate', 'Collection Rate', rate, `${rate.toFixed(1)}%`, ICON.percent, {
        changeLabel: `${formatKPIValue(coll, ST.COLLECTION)} of ${formatKPIValue(tot, ST.OUTSTANDING)}`,
      });
    },
  },

  // ── 9. Total Cost ─────────────────────────────────────────────────────────────
  {
    id: 'total_cost',
    priority: 75,
    condition: (a) => {
      const types = Object.values(a.colMeta || {}).map(m => m.semanticType);
      return types.includes(ST.COST);
    },
    generate: (a, rows) => {
      const col = Object.keys(a.colMeta || {}).find(h => a.colMeta[h]?.semanticType === ST.COST);
      if (!col) return null;
      const total = extractNums(rows, col).reduce((s, v) => s + v, 0);
      return makeKPI('total_cost', `Total ${col}`, total, formatKPIValue(total, ST.COST), ICON.currency);
    },
  },

  // ── 10. Active / Unique Agents ───────────────────────────────────────────────
  {
    id: 'active_agents',
    priority: 72,
    condition: (a) => !!a.primaryAgentCol,
    generate: (a, rows) => {
      const unique = new Set(rows.map(r => String(r[a.primaryAgentCol] || '')).filter(Boolean)).size;
      return makeKPI('active_agents', `Active ${a.primaryAgentCol}s`, unique, unique.toLocaleString('en-IN'), ICON.count);
    },
  },

  // ── 11. Profit Margin ────────────────────────────────────────────────────────
  {
    id: 'profit_margin',
    priority: 85,
    condition: (a) => {
      const types = Object.values(a.colMeta || {}).map(m => m.semanticType);
      return types.includes(ST.REVENUE) && types.includes(ST.COST);
    },
    generate: (a, rows) => {
      const revCol  = Object.keys(a.colMeta || {}).find(h => a.colMeta[h]?.semanticType === ST.REVENUE);
      const costCol = Object.keys(a.colMeta || {}).find(h => a.colMeta[h]?.semanticType === ST.COST);
      if (!revCol || !costCol) return null;
      const rev  = extractNums(rows, revCol).reduce((s, v) => s + v, 0);
      const cost = extractNums(rows, costCol).reduce((s, v) => s + v, 0);
      if (!rev) return null;
      const margin = ((rev - cost) / rev) * 100;
      return makeKPI('profit_margin', 'Profit Margin', margin, `${margin.toFixed(1)}%`, ICON.percent, {
        change: margin,
        changeLabel: `${formatKPIValue(rev - cost, ST.PROFIT)} profit`,
      });
    },
  },

  // ── 12. Avg Duration / TAT ───────────────────────────────────────────────────
  {
    id: 'avg_duration',
    priority: 68,
    condition: (a) => {
      const types = Object.values(a.colMeta || {}).map(m => m.semanticType);
      return types.includes(ST.DURATION);
    },
    generate: (a, rows) => {
      const col = Object.keys(a.colMeta || {}).find(h => a.colMeta[h]?.semanticType === ST.DURATION);
      if (!col) return null;
      const nums = extractNums(rows, col);
      const avg = nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : 0;
      return makeKPI('avg_duration', `Avg ${col}`, avg, `${avg.toFixed(1)}`, ICON.time);
    },
  },
];

// ─── Main export: generateKPIs ─────────────────────────────────────────────────
/**
 * Run all applicable KPI generators and return the top N.
 */
export function generateKPIs(analysis, rows, maxKPIs = 6) {
  const results = [];
  const usedIds = new Set();

  const sorted = [...KPI_GENERATORS].sort((a, b) => b.priority - a.priority);

  for (const gen of sorted) {
    if (results.length >= maxKPIs) break;
    if (usedIds.has(gen.id)) continue;
    try {
      if (!gen.condition(analysis)) continue;
      const kpi = gen.generate(analysis, rows);
      if (kpi) { results.push(kpi); usedIds.add(gen.id); }
    } catch (_) {}
  }

  return results;
}

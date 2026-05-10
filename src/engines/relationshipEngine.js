/**
 * RELATIONSHIP INTELLIGENCE ENGINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Discovers business relationships between dataset columns.
 * Groups columns by business function.
 * Recommends optimal dashboard templates.
 * Zero AI dependency — purely rule-based.
 */

import { ST } from './semanticEngine.js';

// ─── Relationship type metadata ────────────────────────────────────────────────
export const REL_META = {
  temporal:    { icon: '📅', color: '#6366f1', bg: 'rgba(99,102,241,0.1)',   label: 'Temporal trend'   },
  performance: { icon: '👤', color: '#10b981', bg: 'rgba(16,185,129,0.1)',   label: 'Performance'      },
  geographic:  { icon: '🌍', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',   label: 'Geographic'       },
  conversion:  { icon: '🔄', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   label: 'Conversion funnel'},
  financial:   { icon: '💰', color: '#10b981', bg: 'rgba(16,185,129,0.1)',   label: 'Financial'        },
  operational: { icon: '⚙', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',   label: 'Operational'      },
};

// ─── Detect column relationships ───────────────────────────────────────────────
export function detectRelationships(analysis) {
  const {
    primaryDateCol, primaryAmountCol, primaryAgentCol,
    primaryStatusCol, primaryCategoryCol, colMeta = {}, headers = [],
  } = analysis;

  const rels = [];
  const seen = new Set();

  const add = (from, to, type, label, strength, chartHint = 'bar') => {
    if (!from || !to) return;
    const key = `${from}|${to}|${type}`;
    if (!seen.has(key)) {
      seen.add(key);
      rels.push({ from, to, type, label, strength, chartHint });
    }
  };

  // ── Temporal relationships (date drives X)
  if (primaryDateCol) {
    if (primaryAmountCol) add(primaryDateCol, primaryAmountCol, 'temporal', `${primaryDateCol} → ${primaryAmountCol} over time`, 0.95, 'area');
    if (primaryStatusCol) add(primaryDateCol, primaryStatusCol, 'temporal', `${primaryStatusCol} volume over time`, 0.78, 'bar');
    if (primaryAgentCol)  add(primaryDateCol, primaryAgentCol,  'temporal', `${primaryAgentCol} activity timeline`, 0.72, 'line');
  }

  // ── Performance relationships (agent drives output)
  if (primaryAgentCol) {
    if (primaryAmountCol) add(primaryAgentCol, primaryAmountCol, 'performance', `${primaryAgentCol} → ${primaryAmountCol} leaderboard`, 0.92, 'hbar');
    if (primaryStatusCol) add(primaryAgentCol, primaryStatusCol, 'performance', `${primaryAgentCol} conversion performance`, 0.85, 'bar');
  }

  // ── Geographic relationships (region drives revenue)
  const geoCols = headers.filter(h => [ST.REGION, ST.CITY, ST.BRANCH].includes(colMeta[h]?.semanticType));
  geoCols.slice(0, 2).forEach(gc => {
    if (primaryAmountCol) add(gc, primaryAmountCol, 'geographic', `Regional ${primaryAmountCol} comparison`, 0.80, 'bar');
    if (primaryStatusCol) add(gc, primaryStatusCol, 'geographic', `Regional ${primaryStatusCol} distribution`, 0.70, 'pie');
  });

  // ── Conversion/funnel (status drives outcomes)
  if (primaryStatusCol && primaryAmountCol) {
    add(primaryStatusCol, primaryAmountCol, 'conversion', `${primaryStatusCol} → ${primaryAmountCol} conversion`, 0.88, 'bar');
  }
  const srcCols = headers.filter(h => [ST.SOURCE, ST.CHANNEL, ST.CAMPAIGN].includes(colMeta[h]?.semanticType));
  srcCols.slice(0, 1).forEach(sc => {
    if (primaryStatusCol) add(sc, primaryStatusCol, 'conversion', `${sc} → lead conversion rate`, 0.82, 'bar');
    if (primaryAmountCol) add(sc, primaryAmountCol, 'financial', `${sc} → revenue attribution`, 0.72, 'bar');
  });

  // ── Financial relationships
  if (primaryCategoryCol && primaryAmountCol) {
    add(primaryCategoryCol, primaryAmountCol, 'financial', `${primaryCategoryCol} revenue breakdown`, 0.82, 'bar');
  }
  const emiCol  = headers.find(h => [ST.EMI].includes(colMeta[h]?.semanticType));
  const collCol = headers.find(h => [ST.COLLECTION, ST.OUTSTANDING].includes(colMeta[h]?.semanticType));
  if (emiCol && collCol) add(emiCol, collCol, 'financial', 'EMI → collection efficiency', 0.90, 'line');

  // ── Operational (category/product)
  const depCol = headers.find(h => colMeta[h]?.semanticType === ST.DEPARTMENT);
  if (depCol && primaryAmountCol) add(depCol, primaryAmountCol, 'operational', `${depCol} budget breakdown`, 0.75, 'bar');

  return rels.slice(0, 8);
}

// ─── Column business grouping ──────────────────────────────────────────────────
const COL_GROUPS = [
  { name: 'Financial Metrics',  icon: '💰', color: '#10b981', types: [ST.REVENUE, ST.PAYMENT, ST.COLLECTION, ST.OUTSTANDING, ST.BALANCE, ST.EMI, ST.COMMISSION, ST.SALARY, ST.COST, ST.PROFIT, ST.INVOICE_AMT, ST.DISCOUNT, ST.TAX, ST.TARGET] },
  { name: 'Time Intelligence',  icon: '📅', color: '#6366f1', types: [ST.DATE, ST.DATETIME, ST.MONTH_COL, ST.YEAR_COL, ST.WEEK_COL, ST.QUARTER_COL] },
  { name: 'Sales & CRM',        icon: '🎯', color: '#f59e0b', types: [ST.STATUS, ST.SOURCE, ST.CHANNEL, ST.CAMPAIGN, ST.SEGMENT] },
  { name: 'Team Hierarchy',     icon: '👥', color: '#8b5cf6', types: [ST.AGENT, ST.EMPLOYEE, ST.MANAGER, ST.VENDOR, ST.CALLER] },
  { name: 'Customer Data',      icon: '👤', color: '#06b6d4', types: [ST.CUSTOMER, ST.PHONE, ST.EMAIL, ST.NAME] },
  { name: 'Geographic Data',    icon: '🌍', color: '#3b82f6', types: [ST.REGION, ST.CITY, ST.BRANCH] },
  { name: 'Operations',         icon: '⚙',  color: '#64748b', types: [ST.DURATION, ST.CATEGORY, ST.PRODUCT, ST.DEPARTMENT, ST.BATCH, ST.QUANTITY, ST.SCORE, ST.RATE, ST.PERCENTAGE] },
  { name: 'Identifiers',        icon: '🔑', color: '#94a3b8', types: [ST.ID, ST.NUMERIC] },
];

export function groupColumns(analysis) {
  const { headers = [], colMeta = {} } = analysis;
  const result = [];
  const used = new Set();

  COL_GROUPS.forEach(({ name, icon, color, types }) => {
    const cols = headers.filter(h => types.includes(colMeta[h]?.semanticType) && !used.has(h));
    if (cols.length) {
      result.push({ name, icon, color, cols });
      cols.forEach(c => used.add(c));
    }
  });

  const others = headers.filter(h => !used.has(h));
  if (others.length) result.push({ name: 'Other Data', icon: '📋', color: '#64748b', cols: others });
  return result;
}

// ─── Dashboard template recommendations ───────────────────────────────────────
export function recommendDashboards(analysis) {
  const { primaryDateCol, primaryAmountCol, primaryAgentCol, primaryStatusCol,
          primaryCategoryCol, colMeta = {}, headers = [] } = analysis;
  const recs = [];

  if (primaryAmountCol && primaryDateCol)
    recs.push({ title: 'Revenue Intelligence', icon: '💰', fit: 95, tags: ['Revenue', 'Trends', 'Growth'] });

  if (headers.some(h => [ST.COLLECTION, ST.OUTSTANDING, ST.EMI].includes(colMeta[h]?.semanticType)))
    recs.push({ title: 'Collection Tracker',   icon: '📋', fit: 93, tags: ['EMI', 'Collections', 'Efficiency'] });

  if (primaryAgentCol && primaryAmountCol)
    recs.push({ title: 'Team Performance',     icon: '🏆', fit: 90, tags: ['Agents', 'Leaderboard', 'KPIs'] });

  if (primaryStatusCol && (primaryAgentCol || primaryAmountCol))
    recs.push({ title: 'CRM Analytics',        icon: '🎯', fit: 88, tags: ['Leads', 'Conversion', 'Pipeline'] });

  if (headers.some(h => [ST.REGION, ST.CITY, ST.BRANCH].includes(colMeta[h]?.semanticType)) && primaryAmountCol)
    recs.push({ title: 'Regional Sales',       icon: '🗺', fit: 85, tags: ['Geography', 'Territory'] });

  if (primaryCategoryCol && primaryAmountCol)
    recs.push({ title: 'Category Analysis',    icon: '📊', fit: 82, tags: ['Categories', 'Comparison'] });

  if (headers.some(h => [ST.SOURCE, ST.CHANNEL].includes(colMeta[h]?.semanticType)) && primaryStatusCol)
    recs.push({ title: 'Lead Analytics',       icon: '🎯', fit: 80, tags: ['Sources', 'Funnels', 'ROI'] });

  if (headers.some(h => colMeta[h]?.semanticType === ST.SALARY))
    recs.push({ title: 'HR & Payroll',         icon: '👥', fit: 78, tags: ['Salary', 'Headcount', 'HR'] });

  return recs.slice(0, 4);
}

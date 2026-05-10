/**
 * INSIGHT INTELLIGENCE ENGINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates deterministic, statistically-driven business insights.
 * Mimics the reasoning of a business analyst. Zero AI dependency.
 *
 * All insights are derived from actual data patterns — correlations,
 * Pareto distributions, trend analysis, funnel breakdowns.
 */

import { ST } from './semanticEngine.js';
import { extractNums, buildDateTrends, segmentAnalysis, formatKPIValue, formatCompact } from './analyticsEngine.js';

const POSITIVE_STATUS = new Set([
  'paid','answered','converted','success','successful','approved','completed',
  'done','yes','active','won','collected','settled','closed','resolved',
  'interested','enrolled','admitted','delivered','fulfilled',
]);

function pct(n, d) { return d > 0 ? Math.round((n / d) * 100) : 0; }

export function generateInsights(analysis, rows, maxInsights = 8) {
  if (!rows?.length || !analysis) return [];

  // Cap sample for performance — insights are statistically valid at 5k rows
  const sample = rows.length > 5000 ? rows.slice(0, 5000) : rows;

  const {
    primaryDateCol, primaryAmountCol, primaryAgentCol,
    primaryStatusCol, primaryCategoryCol, colMeta = {}, headers = [],
  } = analysis;

  const insights = [];
  const push = (msg) => { if (msg) insights.push(msg); };

  try {
    // ── 1. Geographic concentration ─────────────────────────────────────────
    const geoCol = headers.find(h => [ST.REGION, ST.CITY, ST.BRANCH].includes(colMeta[h]?.semanticType));
    if (geoCol && primaryAmountCol) {
      const segs = segmentAnalysis(sample, geoCol, primaryAmountCol, 10);
      if (segs.length >= 2) {
        const top = segs[0];
        const top3Sum = segs.slice(0, 3).reduce((s, x) => s + x.total, 0);
        const totalSum = segs.reduce((s, x) => s + x.total, 0);
        const top3Pct = pct(top3Sum, totalSum);
        push(`${top.name} leads in ${primaryAmountCol} with ${top.pct}% share — top 3 ${geoCol}s account for ${top3Pct}% of total`);
      }
    }

    // ── 2. Agent Pareto distribution ────────────────────────────────────────
    if (primaryAgentCol && primaryAmountCol) {
      const segs = segmentAnalysis(sample, primaryAgentCol, primaryAmountCol, 50);
      if (segs.length >= 3) {
        const totalSum = segs.reduce((s, x) => s + x.total, 0);
        const top3Sum  = segs.slice(0, 3).reduce((s, x) => s + x.total, 0);
        const top3Pct  = pct(top3Sum, totalSum);
        push(`Top 3 ${primaryAgentCol}s generate ${top3Pct}% of total ${primaryAmountCol} — classic Pareto concentration`);
        push(`${segs[0].name} is the top ${primaryAgentCol} with ${formatKPIValue(segs[0].total, colMeta[primaryAmountCol]?.semanticType)}, ${segs[0].pct}% of total`);
      }
    }

    // ── 3. Revenue/amount trend direction ───────────────────────────────────
    if (primaryDateCol && primaryAmountCol) {
      const trends = buildDateTrends(sample, primaryDateCol, primaryAmountCol, 'month');
      if (trends.length >= 3) {
        const recent = trends.slice(-3);
        const declining = recent.every((t, i) => i === 0 || t.value < recent[i - 1].value);
        const growing   = recent.every((t, i) => i === 0 || t.value > recent[i - 1].value);
        if (declining) push(`⚠ ${primaryAmountCol} declined for ${recent.length} consecutive periods — investigation recommended`);
        if (growing)   push(`↑ ${primaryAmountCol} grew consistently for ${recent.length} consecutive periods — positive momentum`);

        const best = trends.reduce((b, t) => t.value > b.value ? t : b);
        push(`Peak performance: ${best.name} recorded the highest ${primaryAmountCol} at ${formatKPIValue(best.value, colMeta[primaryAmountCol]?.semanticType)}`);

        const totalGrowth = trends[0].value > 0
          ? ((trends[trends.length - 1].value - trends[0].value) / trends[0].value * 100).toFixed(1)
          : null;
        if (totalGrowth !== null) push(`${primaryAmountCol} ${+totalGrowth >= 0 ? 'grew' : 'declined'} ${Math.abs(totalGrowth)}% across ${trends.length} periods`);
      }
    }

    // ── 4. Status / conversion rate ─────────────────────────────────────────
    if (primaryStatusCol) {
      const counts = {};
      sample.forEach(r => {
        const v = String(r[primaryStatusCol] || '').trim();
        if (v) counts[v] = (counts[v] || 0) + 1;
      });
      const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const posCount = entries
        .filter(([k]) => POSITIVE_STATUS.has(k.toLowerCase()))
        .reduce((s, [, v]) => s + v, 0);
      const rate = pct(posCount, sample.length);
      if (rate > 0) push(`${rate}% positive ${primaryStatusCol} rate — ${posCount.toLocaleString()} of ${sample.length.toLocaleString()} records converted`);
      if (entries[0]) push(`"${entries[0][0]}" is the dominant ${primaryStatusCol} status (${pct(entries[0][1], sample.length)}% of records)`);
    }

    // ── 5. Source/channel conversion differential ───────────────────────────
    const srcCol = headers.find(h => [ST.SOURCE, ST.CHANNEL].includes(colMeta[h]?.semanticType));
    if (srcCol && primaryStatusCol) {
      const bySource = {};
      sample.forEach(r => {
        const src = String(r[srcCol] || '').trim();
        const st  = String(r[primaryStatusCol] || '').toLowerCase().trim();
        if (!src) return;
        if (!bySource[src]) bySource[src] = { total: 0, pos: 0 };
        bySource[src].total++;
        if (POSITIVE_STATUS.has(st)) bySource[src].pos++;
      });
      const rates = Object.entries(bySource)
        .filter(([, v]) => v.total >= 5)
        .map(([name, v]) => ({ name, rate: v.total > 0 ? (v.pos / v.total) * 100 : 0 }))
        .sort((a, b) => b.rate - a.rate);
      if (rates.length >= 2) {
        const best = rates[0], worst = rates[rates.length - 1];
        const mult = worst.rate > 0 ? (best.rate / worst.rate).toFixed(1) : '∞';
        push(`"${best.name}" converts ${mult}x better than "${worst.name}" (${Math.round(best.rate)}% vs ${Math.round(worst.rate)}%)`);
      }
    }

    // ── 6. Category revenue concentration ──────────────────────────────────
    if (primaryCategoryCol && primaryAmountCol) {
      const segs = segmentAnalysis(sample, primaryCategoryCol, primaryAmountCol, 10);
      if (segs.length >= 2) {
        const allCats = new Set(sample.map(r => String(r[primaryCategoryCol] || '').trim()).filter(Boolean)).size;
        push(`"${segs[0].name}" leads ${primaryCategoryCol} performance with ${segs[0].pct}% revenue share across ${allCats} categories`);
      }
    }

    // ── 7. EMI / collection efficiency ─────────────────────────────────────
    const emiCol  = headers.find(h => colMeta[h]?.semanticType === ST.EMI);
    const collCol = headers.find(h => [ST.COLLECTION, ST.OUTSTANDING].includes(colMeta[h]?.semanticType));
    if (emiCol && collCol) {
      const emiTotal  = extractNums(sample, emiCol).reduce((s, v) => s + v, 0);
      const collTotal = extractNums(sample, collCol).reduce((s, v) => s + v, 0);
      if (emiTotal > 0) {
        const effPct = Math.round((collTotal / emiTotal) * 100);
        push(`Collection efficiency: ${effPct}% of EMI obligations collected (${formatCompact(collTotal)} of ${formatCompact(emiTotal)})`);
      }
    }

    // ── 8. Data quality warning ─────────────────────────────────────────────
    const sparseCol = headers.find(h => {
      const nullRate = sample.filter(r => !r[h] || String(r[h]).trim() === '').length / sample.length;
      return nullRate > 0.25;
    });
    if (sparseCol) {
      const nullPct = Math.round(sample.filter(r => !r[sparseCol] || String(r[sparseCol]).trim() === '').length / sample.length * 100);
      push(`⚠ Data quality: "${sparseCol}" has ${nullPct}% missing values — analysis accuracy may be affected`);
    }

  } catch {}

  return [...new Set(insights)].slice(0, maxInsights);
}

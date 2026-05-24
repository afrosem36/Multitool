/**
 * DASHBOARD COMPONENTS — read-only canvas pieces
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared between AiDashboardMaker (editor) and SharedReportView (public viewer).
 *
 * IMPORTANT: this file must NOT import from AuthContext, useDashboardStore,
 * xlsx, or any user-input plumbing. The shared public viewer pulls this file
 * in directly, so anything imported here ships in the public bundle.
 *
 * Pure presentational + small pure helpers only.
 */

import React, { useState, useMemo } from 'react';
import {
  TrendingUp, CheckCircle, Trophy, LayoutDashboard,
  ArrowUpRight, ArrowDownRight, Minus, Clock, Database, Target, Users, DollarSign,
  Activity, BarChart, PieChart as PieIcon, LineChart as LineIcon, Brain,
  Globe, Layers, Lightbulb, AlertTriangle, ScatterChart as ScatterIcon,
  Radar as RadarIcon, GitMerge, Info, Sparkles, ListChecks, FileSpreadsheet,
  Cpu,
} from 'lucide-react';
import {
  BarChart as ReBar, Bar,
  LineChart as ReLine, Line,
  AreaChart as ReArea, Area,
  PieChart as RePie, Pie, Cell,
  ScatterChart as ReScatter, Scatter,
  RadarChart as ReRadar, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart as ReComposed,
  Treemap as ReTreemap,
  FunnelChart as ReFunnelChart, Funnel,
  RadialBarChart as ReRadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { aggregateForChart, buildDateTrends, formatKPIValue } from '../../engines/analyticsEngine';
import { parseFlexibleDate } from '../../engines/semanticEngine';
import { computeForecast } from '../../engines/tabPlanner';

const COLORS = ['#6366f1','#10b981','#f59e0b','#3b82f6','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16','#f97316'];

// ─── Chart data builder ──────────────────────────────────────────────────────
export function buildChartData(spec, rows, analysis) {
  if (!spec || !rows?.length) return [];
  const type = normalizeChartType(spec.type || spec.chartType);
  const xCol = spec.xCol || spec.xAxis;
  const yCol = spec.yCol || spec.yAxis;
  const valueCol = spec.valueColumn || spec.valueCol || yCol;
  const groupBy = spec.groupBy || spec.secondaryYAxis || spec.seriesCol;
  const limit = spec.limit || defaultLimitForType(type);
  const aggregation = normalizeAggregation(spec.aggregation || 'sum');

  if (type === 'correlationMatrix') return buildCorrelationMatrix(rows, analysis);
  if (type === 'calendarHeatmap') return buildCalendarHeatmap(rows, xCol || analysis?.primaryDateCol, valueCol, aggregation);
  if (type === 'histogram') return buildHistogram(rows, valueCol || yCol || xCol, limit);
  if (type === 'heatmap') return buildHeatmapData(rows, xCol, groupBy || yCol, valueCol, aggregation, limit);
  if (type === 'stackedBar') return buildStackedBarData(rows, xCol, groupBy || spec.stackBy || analysis?.primaryStatusCol, valueCol, aggregation, limit);
  if (type === 'funnel') return buildFunnelData(rows, xCol || analysis?.primaryStatusCol, valueCol, aggregation, limit);
  if (type === 'gauge' || type === 'radialBar') return buildGaugeData(rows, spec, analysis);
  if (type === 'waterfall') return buildWaterfallData(rows, spec, analysis);
  if (type === 'scatter') return buildScatterData(rows, xCol, yCol || valueCol, limit);
  if (type === 'table') return buildTableData(rows, xCol, valueCol, aggregation, limit);

  if (spec.timeSeries && (xCol || analysis?.primaryDateCol)) {
    return buildDateTrends(rows, xCol || analysis.primaryDateCol, valueCol || null, spec.timeGroupBy || 'month');
  }
  const data = aggregateForChart(rows, xCol, valueCol || null, aggregation, Math.max(limit + 20, 30));
  return collapseSmallCategories(data, limit, type);
}

export const ADVANCED_CHART_TYPES = [
  'bar', 'horizontalBar', 'stackedBar', 'line', 'area', 'pie', 'donut', 'composed',
  'scatter', 'radar', 'table', 'heatmap', 'treemap', 'funnel', 'gauge', 'radialBar',
  'waterfall', 'histogram', 'correlationMatrix', 'calendarHeatmap', 'kpiTrendCard',
];

export function normalizeChartType(type) {
  const raw = String(type || 'bar').trim();
  const map = {
    hbar: 'horizontalBar',
    horizontalbar: 'horizontalBar',
    stackedbar: 'stackedBar',
    radialbar: 'radialBar',
    correlationmatrix: 'correlationMatrix',
    calendarheatmap: 'calendarHeatmap',
    kpitrendcard: 'kpiTrendCard',
  };
  return map[raw.toLowerCase()] || raw;
}

function normalizeAggregation(agg) {
  const a = String(agg || 'sum').toLowerCase();
  if (a === 'average') return 'avg';
  return a;
}

function defaultLimitForType(type) {
  if (['pie', 'donut'].includes(type)) return 8;
  if (['heatmap', 'stackedBar'].includes(type)) return 12;
  if (type === 'calendarHeatmap') return 180;
  return 15;
}

function parseNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = parseFloat(String(v ?? '').replace(/[₹$Rs.,% ]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function valueForAggregation(rows, valueCol, aggregation) {
  if (!valueCol || aggregation === 'count') return rows.length;
  if (aggregation === 'unique_count') {
    return new Set(rows.map(r => String(r[valueCol] ?? '').trim()).filter(Boolean)).size;
  }
  const nums = rows.map(r => parseNumber(r[valueCol])).filter(v => v !== null);
  if (!nums.length) return 0;
  if (aggregation === 'avg') return nums.reduce((s, v) => s + v, 0) / nums.length;
  if (aggregation === 'min') return Math.min(...nums);
  if (aggregation === 'max') return Math.max(...nums);
  return nums.reduce((s, v) => s + v, 0);
}

function collapseSmallCategories(data, limit = 12, type = 'bar') {
  const max = Math.max(1, limit || 12);
  const sorted = [...(data || [])].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  if (sorted.length <= max) return sorted;
  const keep = sorted.slice(0, max);
  const rest = sorted.slice(max);
  if (['pie', 'donut', 'treemap'].includes(type) && rest.length) {
    keep.push({ name: 'Others', value: rest.reduce((s, d) => s + (Number(d.value) || 0), 0) });
  }
  return keep;
}

function buildGroupedRows(rows, col, limit = 15) {
  const buckets = new Map();
  rows.forEach(r => {
    const key = String(r[col] ?? '').trim();
    if (!key) return;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(r);
  });
  return [...buckets.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, limit);
}

function buildHeatmapData(rows, xCol, yCol, valueCol, aggregation = 'count', limit = 12) {
  if (!xCol || !yCol) return [];
  const xGroups = buildGroupedRows(rows, xCol, limit).map(([name]) => name);
  const yGroups = buildGroupedRows(rows, yCol, limit).map(([name]) => name);
  const data = [];
  yGroups.forEach(y => {
    xGroups.forEach(x => {
      const matches = rows.filter(r => String(r[xCol] ?? '').trim() === x && String(r[yCol] ?? '').trim() === y);
      data.push({ x, y, name: `${x} / ${y}`, value: valueForAggregation(matches, valueCol, aggregation) });
    });
  });
  return data;
}

function buildStackedBarData(rows, xCol, stackCol, valueCol, aggregation = 'count', limit = 12) {
  if (!xCol || !stackCol) return [];
  const xGroups = buildGroupedRows(rows, xCol, limit).map(([name]) => name);
  const stackGroups = buildGroupedRows(rows, stackCol, 6).map(([name]) => name);
  return xGroups.map(x => {
    const row = { name: x };
    stackGroups.forEach(stack => {
      const matches = rows.filter(r => String(r[xCol] ?? '').trim() === x && String(r[stackCol] ?? '').trim() === stack);
      row[stack] = valueForAggregation(matches, valueCol, aggregation);
    });
    return row;
  });
}

function buildFunnelData(rows, stageCol, valueCol, aggregation = 'count', limit = 10) {
  if (!stageCol) return [];
  return collapseSmallCategories(aggregateForChart(rows, stageCol, valueCol || null, aggregation, limit), limit, 'funnel');
}

function buildHistogram(rows, numericCol, bins = 12) {
  if (!numericCol) return [];
  const nums = rows.map(r => parseNumber(r[numericCol])).filter(v => v !== null).sort((a, b) => a - b);
  if (!nums.length) return [];
  const min = nums[0], max = nums[nums.length - 1];
  if (min === max) return [{ name: String(min), value: nums.length, min, max }];
  const bucketCount = Math.max(5, Math.min(20, bins || 12));
  const step = (max - min) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    min: min + step * i,
    max: i === bucketCount - 1 ? max : min + step * (i + 1),
    value: 0,
  }));
  nums.forEach(v => {
    const idx = Math.min(bucketCount - 1, Math.floor((v - min) / step));
    buckets[idx].value += 1;
  });
  return buckets.map(b => ({ name: `${Math.round(b.min).toLocaleString('en-IN')}-${Math.round(b.max).toLocaleString('en-IN')}`, value: b.value, ...b }));
}

function buildCorrelationMatrix(rows, analysis) {
  const numericCols = (analysis?.headers || []).filter(h => {
    const m = analysis?.colMeta?.[h] || {};
    return m.dataType === 'number' || m.role === 'measure';
  }).slice(0, 8);
  if (numericCols.length < 3) return [];
  const matrix = [];
  numericCols.forEach(a => {
    numericCols.forEach(b => {
      const pairs = rows.map(r => [parseNumber(r[a]), parseNumber(r[b])]).filter(([x, y]) => x !== null && y !== null);
      if (!pairs.length) return;
      const xs = pairs.map(p => p[0]), ys = pairs.map(p => p[1]);
      const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
      const my = ys.reduce((s, v) => s + v, 0) / ys.length;
      const num = pairs.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0);
      const den = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0) * ys.reduce((s, y) => s + (y - my) ** 2, 0));
      matrix.push({ x: a, y: b, name: `${a} / ${b}`, value: den ? Math.round((num / den) * 100) / 100 : 0 });
    });
  });
  return matrix;
}

function buildCalendarHeatmap(rows, dateCol, valueCol, aggregation = 'count') {
  if (!dateCol) return [];
  const buckets = {};
  rows.forEach(r => {
    const d = parseFlexibleDate(r[dateCol]);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(r);
  });
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-180)
    .map(([date, dayRows]) => ({ date, name: date, value: valueForAggregation(dayRows, valueCol, aggregation) }));
}

function buildGaugeData(rows, spec, analysis) {
  const percentCol = spec.yCol || spec.yAxis || spec.valueColumn;
  let value = null;
  if (percentCol) {
    const nums = rows.map(r => parseNumber(r[percentCol])).filter(v => v !== null);
    if (nums.length) {
      const avg = nums.reduce((s, v) => s + v, 0) / nums.length;
      value = avg <= 1 ? avg * 100 : avg;
    }
  }
  if (value === null && analysis?.primaryAmountCol) {
    const targetCol = (analysis.headers || []).find(h => /target|goal|quota|planned/i.test(h));
    if (targetCol) {
      const actual = rows.reduce((s, r) => s + (parseNumber(r[analysis.primaryAmountCol]) || 0), 0);
      const target = rows.reduce((s, r) => s + (parseNumber(r[targetCol]) || 0), 0);
      value = target > 0 ? (actual / target) * 100 : null;
    }
  }
  const pct = Math.max(0, Math.min(100, value == null ? 0 : value));
  return [{ name: spec.title || 'Progress', value: pct, remaining: Math.max(0, 100 - pct) }];
}

function buildWaterfallData(rows, spec, analysis) {
  const xCol = spec.xCol || spec.xAxis || analysis?.primaryCategoryCol;
  const yCol = spec.yCol || spec.yAxis || spec.valueColumn || analysis?.primaryAmountCol;
  if (!xCol || !yCol) return [];
  let running = 0;
  return aggregateForChart(rows, xCol, yCol, normalizeAggregation(spec.aggregation || 'sum'), spec.limit || 10)
    .map(d => {
      const start = running;
      running += Number(d.value) || 0;
      return { ...d, start, end: running, positive: d.value >= 0 ? d.value : 0, negative: d.value < 0 ? Math.abs(d.value) : 0 };
    });
}

function buildScatterData(rows, xCol, yCol, limit = 500) {
  if (!xCol || !yCol) return [];
  return rows.map((r, i) => ({
    name: r.Name || r.name || `Row ${i + 1}`,
    x: parseNumber(r[xCol]),
    y: parseNumber(r[yCol]),
  })).filter(d => d.x !== null && d.y !== null).slice(0, Math.min(1000, limit || 500));
}

function buildTableData(rows, xCol, valueCol, aggregation = 'count', limit = 25) {
  if (!xCol) return rows.slice(0, limit).map((r, i) => ({ name: `Row ${i + 1}`, ...r }));
  return aggregateForChart(rows, xCol, valueCol || null, aggregation, limit);
}

// ─── KpiCard ─────────────────────────────────────────────────────────────────
export function KpiCard({ kpi, T }) {
  const pos = kpi.change !== null && kpi.change > 0;
  const neg = kpi.change !== null && kpi.change < 0;
  const icons = {
    currency: <DollarSign size={13} style={{ color:'#10b981' }}/>,
    count:    <Database   size={13} style={{ color:'#6366f1' }}/>,
    percent:  <Target     size={13} style={{ color:'#f59e0b' }}/>,
    person:   <Users      size={13} style={{ color:'#8b5cf6' }}/>,
    trend:    <Activity   size={13} style={{ color:'#3b82f6' }}/>,
    time:     <Clock      size={13} style={{ color:'#06b6d4' }}/>,
  };
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:'1.1rem', transition:'border-color .2s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.55rem' }}>
        <div style={{ fontSize:'.68rem', fontWeight:700, color:T.sub, textTransform:'uppercase', letterSpacing:'.06em' }}>{kpi.label}</div>
        {icons[kpi.icon] || icons.count}
      </div>
      <div style={{ fontSize:'1.75rem', fontWeight:800, color:T.text, lineHeight:1, marginBottom:'.45rem' }}>{kpi.formatted}</div>
      <div style={{ display:'flex', alignItems:'center', gap:'.4rem', flexWrap:'wrap' }}>
        {pos && <><ArrowUpRight size={12} style={{ color:'#10b981' }}/><span style={{ fontSize:'.7rem', color:'#10b981', fontWeight:600 }}>+{kpi.change?.toFixed(1)}%</span></>}
        {neg && <><ArrowDownRight size={12} style={{ color:'#ef4444' }}/><span style={{ fontSize:'.7rem', color:'#ef4444', fontWeight:600 }}>{kpi.change?.toFixed(1)}%</span></>}
        {!pos && !neg && <><Minus size={10} style={{ color:T.sub }}/><span style={{ fontSize:'.68rem', color:T.sub }}>Stable</span></>}
        {kpi.changeLabel && <span style={{ fontSize:'.65rem', color:T.sub }}>{kpi.changeLabel}</span>}
      </div>
      {kpi.sparkline?.length >= 3 && (
        <div style={{ marginTop:'.6rem', height:26 }}>
          <ResponsiveContainer width="100%" height={26}>
            <ReArea data={kpi.sparkline.map((v, i) => ({ i, v }))} margin={{ top:0, right:0, bottom:0, left:0 }}>
              <Area type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={1.5} fill="rgba(99,102,241,0.12)" dot={false} isAnimationActive={false}/>
            </ReArea>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── ChartWidget ─────────────────────────────────────────────────────────────
const TYPE_SWITCHER = [
  { type:'bar',      Icon: BarChart    },
  { type:'horizontalBar', Icon: BarChart },
  { type:'line',     Icon: LineIcon    },
  { type:'area',     Icon: TrendingUp  },
  { type:'pie',      Icon: PieIcon     },
  { type:'scatter',  Icon: ScatterIcon },
  { type:'radar',    Icon: RadarIcon   },
  { type:'composed', Icon: GitMerge    },
];

function HeatmapGrid({ data, T, fmtY, correlation = false }) {
  if (!data?.length) return <EmptyChart T={T}/>;
  const xs = [...new Set(data.map(d => d.x))];
  const ys = [...new Set(data.map(d => d.y))];
  const maxAbs = Math.max(...data.map(d => Math.abs(Number(d.value) || 0)), 1);
  const byKey = Object.fromEntries(data.map(d => [`${d.x}|||${d.y}`, d]));
  return (
    <div style={{ height:'100%', display:'grid', gridTemplateColumns:`110px repeat(${xs.length}, minmax(36px, 1fr))`, gridAutoRows:'minmax(26px, 1fr)', gap:3, overflow:'auto' }}>
      <div/>
      {xs.map(x => <div key={x} title={x} style={{ color:T.sub, fontSize:10, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textAlign:'center' }}>{x}</div>)}
      {ys.map(y => (
        <React.Fragment key={y}>
          <div title={y} style={{ color:T.sub, fontSize:10, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', alignSelf:'center' }}>{y}</div>
          {xs.map(x => {
            const d = byKey[`${x}|||${y}`] || { value: 0 };
            const raw = Number(d.value) || 0;
            const intensity = Math.min(1, Math.abs(raw) / maxAbs);
            const color = correlation
              ? raw >= 0 ? `rgba(16,185,129,${0.12 + intensity * 0.75})` : `rgba(239,68,68,${0.12 + intensity * 0.75})`
              : `rgba(99,102,241,${0.08 + intensity * 0.72})`;
            return (
              <div key={x} title={`${x} / ${y}: ${correlation ? raw.toFixed(2) : fmtY(raw)}`}
                style={{ minHeight:26, borderRadius:5, background:color, border:`1px solid ${T.border}`,
                  display:'flex', alignItems:'center', justifyContent:'center', color:T.text, fontSize:10, fontWeight:700 }}>
                {correlation ? raw.toFixed(1) : (raw ? fmtY(raw) : '')}
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

function CalendarHeatmap({ data, T, fmtY }) {
  if (!data?.length) return <EmptyChart T={T}/>;
  const max = Math.max(...data.map(d => Number(d.value) || 0), 1);
  return (
    <div style={{ height:'100%', display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(18px, 1fr))', gap:4, alignContent:'start', overflow:'auto' }}>
      {data.map(d => {
        const intensity = Math.min(1, (Number(d.value) || 0) / max);
        return (
          <div key={d.date} title={`${d.date}: ${fmtY(d.value)}`}
            style={{ aspectRatio:'1/1', borderRadius:4, background:`rgba(16,185,129,${0.08 + intensity * 0.78})`, border:`1px solid ${T.border}` }}/>
        );
      })}
    </div>
  );
}

function TableChart({ data, T, fmtY }) {
  if (!data?.length) return <EmptyChart T={T}/>;
  const cols = Object.keys(data[0]).slice(0, 6);
  return (
    <div style={{ height:'100%', overflow:'auto', border:`1px solid ${T.border}`, borderRadius:8 }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.72rem' }}>
        <thead>
          <tr>{cols.map(c => <th key={c} style={{ position:'sticky', top:0, background:T.card2, color:T.sub, textAlign:'left', padding:'.45rem .55rem', borderBottom:`1px solid ${T.border}` }}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {data.slice(0, 40).map((r, i) => (
            <tr key={i}>
              {cols.map(c => {
                const v = r[c];
                return <td key={c} style={{ padding:'.42rem .55rem', borderBottom:`1px solid ${T.border}`, color:T.text, whiteSpace:'nowrap' }}>{typeof v === 'number' ? fmtY(v) : String(v ?? '')}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyChart({ T }) {
  return (
    <div style={{ height:'100%', minHeight:180, display:'flex', alignItems:'center', justifyContent:'center',
      border:`1px dashed ${T.border}`, borderRadius:10, color:T.sub, fontSize:'.78rem', background:T.input }}>
      No chart data available
    </div>
  );
}

export function ChartWidget({ spec: initSpec, data, T, onExpand, readOnly = false }) {
  const initialType = normalizeChartType(initSpec.type || initSpec.chartType || 'bar');
  const [activeType, setActiveType] = useState(initialType);
  const spec = { ...initSpec, type: activeType };
  const chartData = data || [];
  const keys = chartData.length > 0
    ? Object.keys(chartData[0]).filter(k => !['name','x','y','date','min','max','start','end','remaining','growth','isPeak','isWorst','forecast'].includes(k))
    : ['value'];

  const fmtY = v => {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v ?? '');
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    if (abs >= 1e7) return `${sign}${(abs/1e7).toFixed(1)}Cr`;
    if (abs >= 1e5) return `${sign}${(abs/1e5).toFixed(1)}L`;
    if (abs >= 1e3) return `${sign}${(abs/1e3).toFixed(0)}K`;
    return `${sign}${Math.round(abs).toLocaleString('en-IN')}`;
  };
  const ttStyle = { background:T.card, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, fontSize:'.73rem' };
  const axTick  = { fill:T.sub, fontSize:10 };
  const common  = { data: chartData, margin:{ top:5, right:10, left:-10, bottom:5 } };
  const isAdvanced = ['heatmap','correlationMatrix','calendarHeatmap','gauge','table','kpiTrendCard'].includes(spec.type);
  const chartHeight = initSpec.width === 'full' || initSpec.size === 'large' || initSpec.size === 'wide' ? 292 : 238;

  const chart = (() => {
    switch (spec.type) {
      case 'bar': return (
        <ReBar {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
          <XAxis dataKey="name" tick={axTick} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
          <YAxis tick={axTick} tickLine={false} axisLine={false} tickFormatter={fmtY}/>
          <Tooltip contentStyle={ttStyle} formatter={v => [fmtY(v)]}/>
          <Legend wrapperStyle={{ color:T.sub, fontSize:10 }}/>
          {keys.map((k,i) => <Bar key={k} dataKey={k} fill={COLORS[i%COLORS.length]} radius={[4,4,0,0]}/>)}
        </ReBar>
      );
      case 'histogram': return (
        <ReBar {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
          <XAxis dataKey="name" tick={{ ...axTick, fontSize:9 }} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
          <YAxis tick={axTick} tickLine={false} axisLine={false} tickFormatter={fmtY}/>
          <Tooltip contentStyle={ttStyle} formatter={v => [fmtY(v), 'Count']}/>
          <Bar dataKey="value" fill="#06b6d4" radius={[4,4,0,0]}/>
        </ReBar>
      );
      case 'horizontalBar': return (
        <ReBar layout="vertical" {...common} margin={{ top:5, right:12, left:10, bottom:5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false}/>
          <XAxis type="number" tick={axTick} tickLine={false} axisLine={false} tickFormatter={fmtY}/>
          <YAxis type="category" dataKey="name" width={110} tick={{ ...axTick, fontSize:9 }} tickLine={false} axisLine={false}/>
          <Tooltip contentStyle={ttStyle} formatter={v => [fmtY(v)]}/>
          {keys.map((k,i) => <Bar key={k} dataKey={k} fill={COLORS[i%COLORS.length]} radius={[0,4,4,0]}/>)}
        </ReBar>
      );
      case 'stackedBar': return (
        <ReBar {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
          <XAxis dataKey="name" tick={axTick} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
          <YAxis tick={axTick} tickLine={false} axisLine={false} tickFormatter={fmtY}/>
          <Tooltip contentStyle={ttStyle} formatter={v => [fmtY(v)]}/>
          <Legend wrapperStyle={{ color:T.sub, fontSize:10 }}/>
          {keys.map((k,i) => <Bar key={k} dataKey={k} stackId="a" fill={COLORS[i%COLORS.length]} radius={i === keys.length - 1 ? [4,4,0,0] : [0,0,0,0]}/>)}
        </ReBar>
      );
      case 'line': return (
        <ReLine {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
          <XAxis dataKey="name" tick={axTick} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
          <YAxis tick={axTick} tickLine={false} axisLine={false} tickFormatter={fmtY}/>
          <Tooltip contentStyle={ttStyle} formatter={v => [fmtY(v)]}/>
          <Legend wrapperStyle={{ color:T.sub, fontSize:10 }}/>
          {keys.map((k,i) => <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i%COLORS.length]} strokeWidth={2.5} dot={false} activeDot={{ r:4 }}/>)}
        </ReLine>
      );
      case 'area': return (
        <ReArea {...common}>
          <defs>
            {keys.map((k,i) => (
              <linearGradient key={k} id={`ag${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={COLORS[i%COLORS.length]} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={COLORS[i%COLORS.length]} stopOpacity={0}/>
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
          <XAxis dataKey="name" tick={axTick} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
          <YAxis tick={axTick} tickLine={false} axisLine={false} tickFormatter={fmtY}/>
          <Tooltip contentStyle={ttStyle} formatter={v => [fmtY(v)]}/>
          <Legend wrapperStyle={{ color:T.sub, fontSize:10 }}/>
          {keys.map((k,i) => <Area key={k} type="monotone" dataKey={k} stroke={COLORS[i%COLORS.length]} strokeWidth={2.5} fill={`url(#ag${i})`}/>)}
        </ReArea>
      );
      case 'pie':
      case 'donut': return (
        <RePie>
          <Pie data={chartData} cx="50%" cy="50%" outerRadius={88} innerRadius={spec.type === 'donut' ? 48 : 0} dataKey="value" nameKey="name"
            label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
          </Pie>
          <Tooltip contentStyle={ttStyle}/>
        </RePie>
      );
      case 'scatter': {
        const xKey = chartData[0]?.x !== undefined ? 'x' : (keys[0] || 'value');
        const yKey = chartData[0]?.y !== undefined ? 'y' : (keys[1] || keys[0] || 'value');
        const scatterPts = chartData.map(d => ({ x: parseFloat(d[xKey])||0, y: parseFloat(d[yKey])||0, name: d.name }));
        return (
          <ReScatter margin={{ top:5, right:10, left:-10, bottom:5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
            <XAxis dataKey="x" type="number" name={xKey} tick={axTick} tickLine={false} axisLine={false} tickFormatter={fmtY}/>
            <YAxis dataKey="y" type="number" name={yKey} tick={axTick} tickLine={false} axisLine={false} tickFormatter={fmtY}/>
            <Tooltip contentStyle={ttStyle} cursor={{ strokeDasharray:'3 3' }}
              content={({ payload }) => payload?.[0] ? (
                <div style={ttStyle}><div style={{ padding:'.35rem .6rem', fontSize:'.73rem' }}>
                  <div style={{ fontWeight:600, color:T.text }}>{payload[0].payload.name}</div>
                  <div>{xKey}: {fmtY(payload[0].payload.x)}</div>
                  <div>{yKey}: {fmtY(payload[0].payload.y)}</div>
                </div></div>
              ) : null}/>
            <Scatter data={scatterPts} fill={COLORS[0]} fillOpacity={0.75}/>
          </ReScatter>
        );
      }
      case 'radar': {
        const metrics = keys.slice(0, 6);
        return (
          <ReRadar cx="50%" cy="50%" outerRadius={80} data={chartData.slice(0, 12)}>
            <PolarGrid stroke={T.border}/>
            <PolarAngleAxis dataKey="name" tick={{ fill:T.sub, fontSize:9 }}/>
            <PolarRadiusAxis tick={false} axisLine={false}/>
            <Tooltip contentStyle={ttStyle} formatter={v => [fmtY(v)]}/>
            {metrics.map((k, i) => (
              <Radar key={k} name={k} dataKey={k} stroke={COLORS[i%COLORS.length]} fill={COLORS[i%COLORS.length]} fillOpacity={0.18}/>
            ))}
            <Legend wrapperStyle={{ color:T.sub, fontSize:10 }}/>
          </ReRadar>
        );
      }
      case 'composed': {
        const barKey  = keys[0] || 'value';
        const lineKey = keys[1] || null;
        return (
          <ReComposed {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
            <XAxis dataKey="name" tick={axTick} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
            <YAxis tick={axTick} tickLine={false} axisLine={false} tickFormatter={fmtY}/>
            <Tooltip contentStyle={ttStyle} formatter={v => [fmtY(v)]}/>
            <Legend wrapperStyle={{ color:T.sub, fontSize:10 }}/>
            <Bar dataKey={barKey} fill={COLORS[0]} radius={[4,4,0,0]} fillOpacity={0.85}/>
            {lineKey && <Line type="monotone" dataKey={lineKey} stroke={COLORS[1]} strokeWidth={2.5} dot={false}/>}
          </ReComposed>
        );
      }
      case 'treemap': return (
        <ReTreemap data={chartData} dataKey="value" nameKey="name" stroke={T.card} fill="#6366f1"
          content={({ x, y, width, height, name, value, index }) => (
            <g>
              <rect x={x} y={y} width={width} height={height} fill={COLORS[(index || 0) % COLORS.length]} fillOpacity={0.82} stroke={T.card}/>
              {width > 58 && height > 34 && (
                <>
                  <text x={x + 7} y={y + 16} fill="#fff" fontSize={10} fontWeight={700}>{String(name).slice(0, 18)}</text>
                  <text x={x + 7} y={y + 31} fill="rgba(255,255,255,.85)" fontSize={9}>{fmtY(value)}</text>
                </>
              )}
            </g>
          )}/>
      );
      case 'funnel': return (
        <ReFunnelChart>
          <Tooltip contentStyle={ttStyle} formatter={v => [fmtY(v)]}/>
          <Funnel dataKey="value" data={chartData} isAnimationActive>
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
          </Funnel>
        </ReFunnelChart>
      );
      case 'radialBar':
      case 'gauge': {
        const pct = Number(chartData[0]?.value) || 0;
        return (
          <ReRadialBarChart innerRadius="72%" outerRadius="100%" data={[{ name:'Complete', value:pct, fill:'#10b981' }, { name:'Remaining', value:Math.max(0, 100 - pct), fill:T.hover }]} startAngle={180} endAngle={0}>
            <RadialBar dataKey="value" cornerRadius={8} background/>
            <Tooltip contentStyle={ttStyle} formatter={v => [`${Number(v).toFixed(1)}%`]}/>
            <text x="50%" y="54%" textAnchor="middle" fill={T.text} fontSize="28" fontWeight="800">{pct.toFixed(1)}%</text>
            <text x="50%" y="66%" textAnchor="middle" fill={T.sub} fontSize="11">{spec.type === 'gauge' ? 'Achievement' : 'Progress'}</text>
          </ReRadialBarChart>
        );
      }
      case 'waterfall': return (
        <ReComposed {...common}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
          <XAxis dataKey="name" tick={axTick} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
          <YAxis tick={axTick} tickLine={false} axisLine={false} tickFormatter={fmtY}/>
          <Tooltip contentStyle={ttStyle} formatter={v => [fmtY(v)]}/>
          <Bar dataKey="positive" stackId="wf" fill="#10b981" radius={[4,4,0,0]}/>
          <Bar dataKey="negative" stackId="wf" fill="#ef4444" radius={[4,4,0,0]}/>
          <Line type="monotone" dataKey="end" stroke="#f59e0b" strokeWidth={2} dot={false}/>
        </ReComposed>
      );
      case 'heatmap': return <HeatmapGrid data={chartData} T={T} fmtY={fmtY}/>;
      case 'correlationMatrix': return <HeatmapGrid data={chartData} T={T} fmtY={fmtY} correlation/>;
      case 'calendarHeatmap': return <CalendarHeatmap data={chartData} T={T} fmtY={fmtY}/>;
      case 'table': return <TableChart data={chartData} T={T} fmtY={fmtY}/>;
      case 'kpiTrendCard': {
        const current = chartData[chartData.length - 1]?.value || chartData[0]?.value || 0;
        return (
          <div style={{ height:'100%', display:'flex', flexDirection:'column', justifyContent:'center', gap:'.8rem' }}>
            <div style={{ fontSize:'2rem', fontWeight:800, color:T.text }}>{fmtY(current)}</div>
            <ResponsiveContainer width="100%" height={92}>
              <ReArea data={chartData}>
                <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} fill="rgba(99,102,241,0.16)" dot={false}/>
              </ReArea>
            </ResponsiveContainer>
          </div>
        );
      }
      default: return null;
    }
  })();

  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:'1rem',
      display:'flex', flexDirection:'column', gap:'.5rem', transition:'border-color .2s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'.5rem' }}>
        <div>
          <div style={{ fontWeight:600, fontSize:'.83rem', color:T.text }}>{initSpec.title}</div>
          {initSpec.description && <div style={{ fontSize:'.68rem', color:T.sub }}>{initSpec.description}</div>}
        </div>
        {!readOnly && (
          <div style={{ display:'flex', alignItems:'center', gap:'.22rem' }}>
            {TYPE_SWITCHER.map(({ type, Icon }) => (
              <button key={type} onClick={() => setActiveType(type)}
                style={{ background: activeType===type ? 'rgba(99,102,241,0.15)' : 'none',
                  border:`1px solid ${activeType===type ? '#6366f1' : T.border}`, borderRadius:6,
                  padding:'.2rem .35rem', cursor:'pointer', color: activeType===type ? '#6366f1' : T.sub, display:'flex' }}>
                <Icon size={10}/>
              </button>
            ))}
            {onExpand && (
              <button onClick={onExpand} style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:6,
                padding:'.2rem .35rem', cursor:'pointer', color:T.sub, display:'flex', marginLeft:'.12rem' }}>
                <TrendingUp size={10}/>
              </button>
            )}
          </div>
        )}
      </div>
      {chartData.length === 0 ? (
        <EmptyChart T={T}/>
      ) : isAdvanced ? (
        <div style={{ height:chartHeight, minHeight:220 }}>{chart || <EmptyChart T={T}/>}</div>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          {chart || <div/>}
        </ResponsiveContainer>
      )}
      {(initSpec.reason || initSpec.insightQuestion) && (
        <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:'.45rem', display:'flex', flexDirection:'column', gap:'.18rem' }}>
          {initSpec.insightQuestion && <div style={{ fontSize:'.68rem', color:T.text, fontWeight:600 }}>{initSpec.insightQuestion}</div>}
          {initSpec.reason && <div style={{ fontSize:'.66rem', color:T.sub, lineHeight:1.45 }}>Why this chart matters: {initSpec.reason}</div>}
        </div>
      )}
    </div>
  );
}

// ─── AgentLeaderboard ────────────────────────────────────────────────────────
export function AgentLeaderboard({ agentData, T }) {
  if (!agentData?.length) return null;
  const maxVal = agentData[0]?.value || 1;
  const medals = ['🥇','🥈','🥉'];
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:'1.1rem' }}>
      <div style={{ fontWeight:700, fontSize:'.86rem', color:T.text, marginBottom:'.8rem',
        display:'flex', alignItems:'center', gap:'.5rem' }}>
        <Trophy size={13} style={{ color:'#f59e0b' }}/> Performance Leaderboard
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'.38rem' }}>
        {agentData.slice(0, 10).map((a, i) => (
          <div key={a.name} style={{ display:'flex', alignItems:'center', gap:'.65rem' }}>
            <div style={{ width:20, textAlign:'center', fontSize:'.75rem', flexShrink:0 }}>
              {i < 3 ? medals[i] : <span style={{ color:T.sub, fontWeight:600, fontSize:'.72rem' }}>{i+1}</span>}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.15rem' }}>
                <span style={{ fontSize:'.78rem', fontWeight:600, color:T.text,
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'60%' }}>{a.name}</span>
                <span style={{ fontSize:'.73rem', fontWeight:700, color:'#10b981', flexShrink:0 }}>
                  {formatKPIValue(a.value, 'payment')}
                </span>
              </div>
              <div style={{ height:4, background:T.hover, borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:3, width:`${(a.value/maxVal)*100}%`,
                  background: i===0 ? '#f59e0b' : i===1 ? '#94a3b8' : i===2 ? '#b45309' : '#6366f1', transition:'width .5s' }}/>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab Navigation ──────────────────────────────────────────────────────────
const TAB_ICONS = {
  overview:  LayoutDashboard,
  agent:     Users,
  status:    Activity,
  category:  Layers,
  trend:     TrendingUp,
  forecast:  Brain,
  risk:      AlertTriangle,
  geography: Globe,
  financial: DollarSign,
  duration:  Clock,
  insights:  Lightbulb,
};

export function TabNav({ tabs, activeTabId, onChange, T }) {
  if (!tabs?.length) return null;
  return (
    <div style={{ display:'flex', gap:'.25rem', overflowX:'auto', padding:'.3rem',
      background:T.card, border:`1px solid ${T.border}`, borderRadius:12, position:'sticky', top:60, zIndex:10 }}>
      {tabs.map(t => {
        const Icon = TAB_ICONS[t.id] || LayoutDashboard;
        const active = t.id === activeTabId;
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            style={{ display:'inline-flex', alignItems:'center', gap:'.4rem',
              padding:'.5rem .85rem', borderRadius:9, border:'none', flexShrink:0,
              cursor:'pointer', fontSize:'.8rem', fontWeight:600, transition:'all .15s',
              background: active ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'transparent',
              color: active ? '#fff' : T.sub,
              boxShadow: active ? '0 3px 10px rgba(99,102,241,0.35)' : 'none' }}>
            <Icon size={12}/> {t.title}
          </button>
        );
      })}
    </div>
  );
}

// ─── Tab Header ──────────────────────────────────────────────────────────────
export function TabHeader({ tab, T }) {
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14,
      padding:'1rem 1.25rem', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' }}>
      <div style={{ flex:1, minWidth:260 }}>
        <div style={{ fontWeight:700, fontSize:'1.05rem', color:T.text, marginBottom:'.2rem' }}>{tab.title}</div>
        {tab.description && (
          <div style={{ fontSize:'.78rem', color:T.sub, lineHeight:1.5 }}>{tab.description}</div>
        )}
      </div>
      {tab.summary && (
        <div style={{ maxWidth:420, padding:'.55rem .8rem', borderRadius:10,
          background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)',
          fontSize:'.74rem', color:T.sub, lineHeight:1.5 }}>
          <Info size={11} style={{ color:'#818cf8', marginRight:'.35rem', verticalAlign:'-1px' }}/>
          {tab.summary}
        </div>
      )}
    </div>
  );
}

// ─── Insights Panel ──────────────────────────────────────────────────────────
export function InsightsPanel({ insights, title = 'Key Insights', T, accent = '#6366f1', icon: Icon = Lightbulb, source }) {
  if (!insights?.length) return null;
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:'1rem 1.25rem' }}>
      <div style={{ fontWeight:600, fontSize:'.82rem', marginBottom:'.65rem',
        display:'flex', alignItems:'center', gap:'.45rem', color:T.text }}>
        <Icon size={13} style={{ color: accent }}/> {title}
        {source && <span style={{ fontSize:'.62rem', color:T.sub, fontWeight:400, marginLeft:'.2rem' }}>— {source}</span>}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'.35rem' }}>
        {insights.map((ins, i) => (
          <div key={i} style={{ display:'flex', gap:'.5rem', alignItems:'flex-start', fontSize:'.78rem', color:T.sub, lineHeight:1.55 }}>
            <CheckCircle size={11} style={{ color: accent, flexShrink:0, marginTop:4 }}/>
            <span style={{ color:T.text }}>{String(ins).replace(/^[⚠↑]\s*/, '')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recommended Actions ─────────────────────────────────────────────────────
export function RecommendedActionsPanel({ actions, T }) {
  if (!actions?.length) return null;
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:'1rem 1.25rem' }}>
      <div style={{ fontWeight:600, fontSize:'.82rem', marginBottom:'.65rem',
        display:'flex', alignItems:'center', gap:'.45rem', color:T.text }}>
        <ListChecks size={13} style={{ color:'#34d399' }}/> Recommended Actions
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'.35rem' }}>
        {actions.map((a, i) => (
          <div key={i} style={{ display:'flex', gap:'.5rem', alignItems:'flex-start', fontSize:'.78rem',
            color:T.text, lineHeight:1.55, padding:'.4rem .55rem',
            background:'rgba(16,185,129,0.04)', border:'1px solid rgba(16,185,129,0.1)', borderRadius:8 }}>
            <span style={{ fontSize:'.7rem', fontWeight:800, color:'#34d399', flexShrink:0,
              width:18, height:18, borderRadius:'50%', background:'rgba(16,185,129,0.12)',
              display:'flex', alignItems:'center', justifyContent:'center' }}>{i + 1}</span>
            <span>{a}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Forecast Chart ──────────────────────────────────────────────────────────
export function ForecastChart({ spec, historical, T }) {
  const series = useMemo(() => computeForecast(historical, 3), [historical]);
  if (!series.length) return null;
  const splitIdx = series.findIndex(p => p.forecast);
  const lastReal = splitIdx > 0 ? series[splitIdx - 1] : null;

  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:'1rem' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.45rem' }}>
        <div>
          <div style={{ fontWeight:600, fontSize:'.85rem', color:T.text }}>{spec.title}</div>
          <div style={{ fontSize:'.7rem', color:T.sub }}>{spec.description}</div>
        </div>
        <span style={{ fontSize:'.62rem', fontWeight:600, color:'#fbbf24',
          padding:'.18rem .55rem', borderRadius:100,
          background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.25)' }}>
          ESTIMATE
        </span>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ReArea data={series} margin={{ top:5, right:15, left:-10, bottom:5 }}>
          <defs>
            <linearGradient id="gradHistorical" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="#6366f1" stopOpacity={0.4}/>
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02}/>
            </linearGradient>
            <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="#fbbf24" stopOpacity={0.35}/>
              <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.02}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
          <XAxis dataKey="name" tick={{ fill:T.sub, fontSize:10 }} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
          <YAxis tick={{ fill:T.sub, fontSize:10 }} tickLine={false} axisLine={false}
            tickFormatter={v => v >= 1e7 ? `${(v/1e7).toFixed(1)}Cr` : v >= 1e5 ? `${(v/1e5).toFixed(1)}L` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : Math.round(v)}/>
          <Tooltip contentStyle={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, fontSize:'.73rem' }}
            formatter={(v, _n, p) => [`${Math.round(v).toLocaleString('en-IN')}`, p.payload.forecast ? 'Projected' : 'Actual']}/>
          <Area type="monotone" dataKey={(p) => p.forecast ? null : p.value}
            stroke="#6366f1" strokeWidth={2.5} fill="url(#gradHistorical)" name="Actual"/>
          <Area type="monotone" dataKey={(p) => p.forecast ? p.value : (p === lastReal ? p.value : null)}
            stroke="#fbbf24" strokeWidth={2.5} strokeDasharray="5 5" fill="url(#gradForecast)" name="Forecast"/>
        </ReArea>
      </ResponsiveContainer>
      <div style={{ marginTop:'.5rem', display:'flex', gap:'1rem', flexWrap:'wrap', fontSize:'.68rem', color:T.sub }}>
        <span><span style={{ display:'inline-block', width:8, height:2, background:'#6366f1', marginRight:'.3rem', verticalAlign:'middle' }}/>Historical</span>
        <span><span style={{ display:'inline-block', width:8, height:2, background:'#fbbf24', marginRight:'.3rem', verticalAlign:'middle', borderTop:'1px dashed #fbbf24' }}/>Projected (next 3 periods)</span>
      </div>
    </div>
  );
}

// ─── Dashboard Canvas (multi-tab BI layout) ──────────────────────────────────
function chartGridColumn(spec = {}) {
  const size = spec.size || spec.width;
  if (size === 'wide' || size === 'large' || size === 'full') return '1 / -1';
  return 'auto';
}

export function DashboardCanvas({ dashboard, rows: _rows, headers: _headers, analysis: _analysis, activeTabId, onChangeTab, onExpandChart, T, readOnly = false }) {
  void _rows;
  void _headers;
  void _analysis;
  const plan = dashboard?.plan;
  if (!plan) return null;

  const tabs = plan.tabs || [];
  const usingTabs = tabs.length > 0;
  const activeTab = usingTabs
    ? (tabs.find(t => t.id === activeTabId) || tabs[0])
    : null;

  const Header = () => (
    <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.04))',
      border:`1px solid rgba(99,102,241,0.18)`, borderRadius:16, padding:'1.25rem 1.5rem' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:280 }}>
          <div style={{ fontSize:'1.6rem', fontWeight:800, color:T.text, marginBottom:'.25rem' }}>{plan.title}</div>
          {plan.subtitle && <div style={{ fontSize:'.85rem', color:T.sub }}>{plan.subtitle}</div>}
        </div>
        <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
          {dashboard.fileName && (
            <span style={{ display:'inline-flex', alignItems:'center', gap:'.3rem', padding:'.3rem .65rem',
              borderRadius:100, fontSize:'.7rem', fontWeight:600,
              background:T.input, border:`1px solid ${T.border}`, color:T.sub }}>
              <FileSpreadsheet size={11}/> {dashboard.fileName}
            </span>
          )}
          {dashboard.rowCount > 0 && (
            <span style={{ display:'inline-flex', alignItems:'center', gap:'.3rem', padding:'.3rem .65rem',
              borderRadius:100, fontSize:'.7rem', fontWeight:600,
              background:T.input, border:`1px solid ${T.border}`, color:T.sub }}>
              <Database size={11}/> {dashboard.rowCount.toLocaleString('en-IN')} rows
            </span>
          )}
          {plan.domain && (
            <span style={{ display:'inline-flex', alignItems:'center', gap:'.3rem', padding:'.3rem .65rem',
              borderRadius:100, fontSize:'.7rem', fontWeight:700,
              background:'rgba(6,182,212,0.1)', border:'1px solid rgba(6,182,212,0.25)', color:'#22d3ee' }}>
              <Globe size={11}/> {String(plan.domain).replace('_', ' ').toUpperCase()}
            </span>
          )}
          {plan.confidence != null && (
            <span style={{ display:'inline-flex', alignItems:'center', gap:'.3rem', padding:'.3rem .65rem',
              borderRadius:100, fontSize:'.7rem', fontWeight:700,
              background: plan.confidence >= 80 ? 'rgba(16,185,129,0.1)' : plan.confidence >= 55 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${plan.confidence >= 80 ? 'rgba(16,185,129,0.25)' : plan.confidence >= 55 ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'}`,
              color: plan.confidence >= 80 ? '#10b981' : plan.confidence >= 55 ? '#fbbf24' : '#f87171' }}>
              <Cpu size={11}/> {plan.confidence}% confidence
            </span>
          )}
        </div>
      </div>
    </div>
  );

  // Legacy flat fallback
  if (!usingTabs) {
    const flatCharts = dashboard.builtCharts || [];
    const kpis = dashboard.kpis || [];
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
        <Header/>
        {plan.insights?.length > 0 && <InsightsPanel insights={plan.insights} T={T} title="Key Insights"/>}
        {kpis.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'.85rem' }}>
            {kpis.map((kpi, i) => <KpiCard key={kpi.id || i} kpi={kpi} T={T}/>)}
          </div>
        )}
        {flatCharts.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap:'1rem' }}>
            {flatCharts.map((c, i) => {
              return (
                <div key={i} style={{ gridColumn: chartGridColumn(c.spec) }}>
                  <ChartWidget spec={c.spec} data={c.data} T={T} onExpand={readOnly ? null : () => onExpandChart?.(c)} readOnly={readOnly}/>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Multi-tab BI layout ──
  const tabData = dashboard.tabChartData?.[activeTab?.id] || [];
  const kpis = activeTab?.kpis || [];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
      <Header/>
      <TabNav tabs={tabs} activeTabId={activeTab?.id} onChange={onChangeTab} T={T}/>
      <TabHeader tab={activeTab} T={T}/>

      {activeTab?.isInsights ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap:'1rem' }}>
          <InsightsPanel insights={plan.insights || activeTab.insights}
            title="Executive Summary" T={T} accent="#818cf8" icon={Sparkles}
            source={dashboard.source === 'engine' ? 'intelligence engine' : 'AI + engine'}/>
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:'1rem 1.25rem' }}>
              <div style={{ fontWeight:600, fontSize:'.82rem', marginBottom:'.65rem',
                display:'flex', alignItems:'center', gap:'.45rem', color:T.text }}>
                <ListChecks size={13} style={{ color:'#34d399' }}/> Tab-by-Tab Summary
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'.55rem' }}>
                {tabs.filter(t => !t.isInsights).map(t => (
                  <div key={t.id} style={{ paddingLeft:'.55rem', borderLeft:`2px solid ${T.border}` }}>
                    <div style={{ fontSize:'.76rem', fontWeight:700, color:T.text }}>{t.title}</div>
                    <div style={{ fontSize:'.71rem', color:T.sub, marginTop:'.1rem', lineHeight:1.5 }}>
                      {t.summary || t.description || '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {kpis.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'.85rem' }}>
              {kpis.map((kpi, i) => <KpiCard key={kpi.id || i} kpi={kpi} T={T}/>)}
            </div>
          )}

          {tabData.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap:'1rem' }}>
              {tabData.map((c, i) => {
                if (activeTab?.isForecast) {
                  return (
                    <div key={i} style={{ gridColumn:'1 / -1' }}>
                      <ForecastChart spec={c.spec} historical={c.data} T={T}/>
                    </div>
                  );
                }
                return (
                  <div key={i} style={{ gridColumn: chartGridColumn(c.spec) }}>
                    <ChartWidget spec={c.spec} data={c.data} T={T} onExpand={readOnly ? null : () => onExpandChart?.(c)} readOnly={readOnly}/>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab?.recommendedActions?.length > 0 && (
            <RecommendedActionsPanel actions={activeTab.recommendedActions} T={T}/>
          )}

          {activeTab?.insights?.length > 0 && (
            <InsightsPanel insights={activeTab.insights}
              title={`${activeTab.title} — Insights`}
              T={T} accent="#34d399"/>
          )}

          {tabData.length === 0 && kpis.length === 0 && (
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14,
              padding:'2rem', textAlign:'center', color:T.sub, fontSize:'.85rem' }}>
              No data could be computed for this tab from the current dataset.
            </div>
          )}
        </>
      )}
    </div>
  );
}

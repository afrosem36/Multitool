/**
 * Dashboard Intelligence Engine
 * Pure JS — no React. All exports are tree-shakable.
 * Understands business data patterns before any AI call.
 */

// ─── Semantic types ────────────────────────────────────────────────────────────
// date_col | amount_col | agent_col | status_col | id_col | mobile_col
// category_col | name_col | numeric_col | text_col

export const SEMANTIC_PATTERNS = {
  date_col: ['date','month','year','created','payment','due','scheduled','booking','joined','dt','period','week','day','timestamp','time','dob','expiry','invoice_date','order_date'],
  amount_col: ['amount','revenue','fee','price','cost','payment','salary','collection','paid','total','value','sum','earnings','balance','charge','receivable','invoice_amt','outstanding','emi','premium','installment','deposit','credit','debit','transaction'],
  agent_col: ['agent','employee','salesperson','sales_person','assigned','collector','created_by','owner','rep','staff','exec','handled','assignee','caller','advisor','manager','rm','executive','tele','telecaller'],
  status_col: ['status','state','stage','result','disposition','outcome','flag','type_','remark'],
  id_col: ['_id','lead_id','invoice_id','student_id','customer_id','ticket_id','order_id','case_id','account_id','ref_no','sr_no','serial'],
  mobile_col: ['mobile','phone','contact','cell','tel','whatsapp','call_no','phone_no','mob'],
  category_col: ['category','course','product','campaign','service','segment','class','group','department','vertical','channel','source','medium','tag','label','zone','region','city','branch','batch','type'],
  name_col: ['name','full_name','customer_name','client','company','firm','org','organisation','organization'],
};

const KNOWN_STATUS_VALUES = new Set([
  'paid','unpaid','answered','not answered','unanswered','pending','converted','failed',
  'successful','success','active','inactive','open','closed','resolved','approved',
  'rejected','cancelled','cancel','done','new','processing','completed','expired',
  'overdue','yes','no','interested','not interested','callback','follow up',
  'junk','invalid','duplicate','won','lost','dropped','fresh','hot','cold','warm',
  'collected','uncollected','settled','default','bounced',
]);

// ─── Date helpers ──────────────────────────────────────────────────────────────

export function parseFlexibleDate(raw) {
  if (raw === null || raw === undefined || raw === '') return null;

  // Excel serial number (typical range: 1 – 60000)
  if (typeof raw === 'number' && raw > 1 && raw < 60000) {
    const epoch = new Date(1899, 11, 30);
    const d = new Date(epoch.getTime() + raw * 86400000);
    if (d.getFullYear() > 1970 && d.getFullYear() < 2100) return d;
  }

  const s = String(raw).trim();
  if (!s) return null;

  // Bare integers are not dates
  if (/^\d{1,6}$/.test(s)) return null;

  // ISO / default parse
  const d1 = new Date(s);
  if (!isNaN(d1.getTime()) && d1.getFullYear() > 1900 && d1.getFullYear() < 2100) return d1;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmy) {
    const yr = dmy[3].length === 2
      ? (parseInt(dmy[3]) > 50 ? 1900 + parseInt(dmy[3]) : 2000 + parseInt(dmy[3]))
      : parseInt(dmy[3]);
    const d2 = new Date(yr, parseInt(dmy[2]) - 1, parseInt(dmy[1]));
    if (!isNaN(d2.getTime())) return d2;
  }

  // "Jan-2024" / "Jan 2024"
  const mon = s.match(/^([a-z]{3})[\s\-](\d{4})$/i);
  if (mon) {
    const d3 = new Date(`${mon[1]} 1 ${mon[2]}`);
    if (!isNaN(d3.getTime())) return d3;
  }

  return null;
}

function isDateLike(v) {
  return parseFlexibleDate(v) !== null;
}

// ─── Basic type detection (improved) ──────────────────────────────────────────

function detectBasicType(values) {
  const sample = values.filter(v => v !== null && v !== undefined && v !== '');
  if (sample.length === 0) return 'text';

  const numHits = sample.filter(v => {
    const n = parseFloat(String(v).replace(/[₹Rs.,$ %]/g, ''));
    return !isNaN(n) && String(v).trim() !== '';
  });
  if (numHits.length / sample.length > 0.8) return 'number';

  const dateHits = sample.slice(0, 30).filter(v => isDateLike(v));
  if (dateHits.length / Math.min(sample.length, 30) > 0.6) return 'date';

  return 'text';
}

// ─── classifyColumnSemantic ────────────────────────────────────────────────────

export function classifyColumnSemantic(colName, sampleValues, dataType) {
  // Date — fast path
  if (dataType === 'date') return 'date_col';

  const norm = colName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const has = (kws) => kws.some(kw => norm.includes(kw));

  // Value-based date check (column name might not signal it)
  if (!has(SEMANTIC_PATTERNS.amount_col) && !has(SEMANTIC_PATTERNS.id_col)) {
    const sample = sampleValues.filter(Boolean).slice(0, 30);
    const dateHits = sample.filter(v => isDateLike(v));
    if (sample.length > 0 && dateHits.length / sample.length > 0.6) return 'date_col';
  }

  // Name keyword checks in priority order
  if (has(SEMANTIC_PATTERNS.date_col)) return 'date_col';
  if (has(SEMANTIC_PATTERNS.amount_col)) return 'amount_col';
  if (has(SEMANTIC_PATTERNS.agent_col)) return 'agent_col';

  // Status: name keywords first
  if (has(SEMANTIC_PATTERNS.status_col)) return 'status_col';
  // Status: value-set detection
  {
    const sample = sampleValues.filter(Boolean).slice(0, 50);
    const unique = new Set(sample.map(v => String(v).toLowerCase().trim()));
    if (unique.size >= 2 && unique.size <= 20) {
      const known = [...unique].filter(v => KNOWN_STATUS_VALUES.has(v));
      if (known.length >= 2 || (unique.size > 0 && known.length / unique.size >= 0.4)) {
        return 'status_col';
      }
    }
  }

  // mobile before id — a "Customer Mobile" is a mobile col, not id
  if (has(SEMANTIC_PATTERNS.mobile_col)) return 'mobile_col';
  if (has(SEMANTIC_PATTERNS.id_col)) return 'id_col';
  if (has(SEMANTIC_PATTERNS.category_col)) return 'category_col';
  if (has(SEMANTIC_PATTERNS.name_col)) return 'name_col';

  if (dataType === 'number') return 'numeric_col';
  return 'text_col';
}

// ─── analyzeDataset ────────────────────────────────────────────────────────────

export function analyzeDataset(rows, headers) {
  const colMeta = {};
  const semanticMap = {};

  headers.forEach(h => {
    const vals = rows.map(r => r[h]);
    const nonNull = vals.filter(v => v !== null && v !== undefined && v !== '');
    const unique = [...new Set(nonNull.map(String))];
    const dataType = detectBasicType(vals);

    const meta = {
      col: h,
      dataType,
      semanticType: null, // filled below
      unique: unique.length,
      nullCount: vals.length - nonNull.length,
      sample: unique.slice(0, 8),
    };

    if (dataType === 'number') {
      const nums = nonNull
        .map(v => parseFloat(String(v).replace(/[₹Rs.,$ %]/g, '')))
        .filter(n => !isNaN(n));
      if (nums.length > 0) {
        meta.min = Math.min(...nums);
        meta.max = Math.max(...nums);
        meta.sum = nums.reduce((a, b) => a + b, 0);
        meta.avg = meta.sum / nums.length;
      }
    }

    meta.semanticType = classifyColumnSemantic(h, nonNull.map(String), dataType);
    colMeta[h] = meta;
    semanticMap[h] = meta.semanticType;
  });

  const getFirst = type => headers.find(h => semanticMap[h] === type) || null;

  const primaryDateCol     = getFirst('date_col');
  const primaryAmountCol   = getFirst('amount_col') || getFirst('numeric_col');
  const primaryAgentCol    = getFirst('agent_col');
  const primaryStatusCol   = getFirst('status_col');
  const primaryCategoryCol = getFirst('category_col');
  const idCols             = headers.filter(h => semanticMap[h] === 'id_col');
  const mobileCols         = headers.filter(h => semanticMap[h] === 'mobile_col');

  const relationships = [];
  if (primaryDateCol && primaryAmountCol)
    relationships.push(`${primaryDateCol} + ${primaryAmountCol} → monthly revenue / growth trend`);
  if (primaryAgentCol && primaryAmountCol)
    relationships.push(`${primaryAgentCol} + ${primaryAmountCol} → agent performance ranking`);
  if (primaryStatusCol)
    relationships.push(`${primaryStatusCol} → conversion / status distribution`);
  if (primaryCategoryCol && primaryAmountCol)
    relationships.push(`${primaryCategoryCol} + ${primaryAmountCol} → category analytics`);
  if (mobileCols.length > 0)
    relationships.push(`${mobileCols[0]} → total leads / customers count`);
  if (idCols.length > 0 && !mobileCols.length)
    relationships.push(`${idCols[0]} → unique record volume`);

  return {
    headers,
    colMeta,
    rowCount: rows.length,
    semanticMap,
    primaryDateCol,
    primaryAmountCol,
    primaryAgentCol,
    primaryStatusCol,
    primaryCategoryCol,
    idCols,
    mobileCols,
    relationships,
  };
}

// ─── generateChartSpecs ────────────────────────────────────────────────────────

export function generateChartSpecs(analysis) {
  const {
    primaryDateCol, primaryAmountCol, primaryAgentCol,
    primaryStatusCol, primaryCategoryCol, colMeta, headers, semanticMap,
  } = analysis;

  const specs = [];
  const seen = new Set();

  const add = (s) => {
    const key = `${s.type}|${s.xCol}|${s.yCol}`;
    if (seen.has(key)) return;
    seen.add(key);
    specs.push(s);
  };

  // ── Rule 1: date + amount → area monthly trend ────────────────────────────
  if (primaryDateCol && primaryAmountCol) {
    add({
      type: 'area',
      title: `Monthly ${primaryAmountCol}`,
      description: `Total ${primaryAmountCol} grouped by month`,
      xCol: primaryDateCol,
      yCol: primaryAmountCol,
      groupBy: null,
      aggregation: 'sum',
      limit: 24,
      colorScheme: 0,
      timeSeries: true,
      timeGroupBy: 'month',
    });
  }

  // ── Rule 2: agent + amount → horizontal bar ────────────────────────────────
  if (primaryAgentCol && primaryAmountCol) {
    add({
      type: 'hbar',
      title: `${primaryAmountCol} by ${primaryAgentCol}`,
      description: `Total ${primaryAmountCol} per ${primaryAgentCol} (top 15)`,
      xCol: primaryAgentCol,
      yCol: primaryAmountCol,
      groupBy: null,
      aggregation: 'sum',
      limit: 15,
      colorScheme: 1,
      timeSeries: false,
    });
  }

  // ── Rule 3: status → pie chart ─────────────────────────────────────────────
  if (primaryStatusCol) {
    const m = colMeta[primaryStatusCol];
    if (m && m.unique >= 2 && m.unique <= 15) {
      add({
        type: 'pie',
        title: `${primaryStatusCol} Distribution`,
        description: `Breakdown of records by ${primaryStatusCol}`,
        xCol: primaryStatusCol,
        yCol: null,
        groupBy: null,
        aggregation: 'count',
        limit: 15,
        colorScheme: 2,
        timeSeries: false,
      });
    }
  }

  // ── Rule 4: category + amount → bar chart ─────────────────────────────────
  if (primaryCategoryCol && primaryAmountCol) {
    const m = colMeta[primaryCategoryCol];
    if (m && m.unique >= 2 && m.unique <= 30) {
      add({
        type: 'bar',
        title: `${primaryAmountCol} by ${primaryCategoryCol}`,
        description: `Total ${primaryAmountCol} per ${primaryCategoryCol}`,
        xCol: primaryCategoryCol,
        yCol: primaryAmountCol,
        groupBy: null,
        aggregation: 'sum',
        limit: 15,
        colorScheme: 3,
        timeSeries: false,
      });
    }
  }

  // ── Rule 5: date + amount → line growth chart ──────────────────────────────
  if (primaryDateCol && primaryAmountCol && specs.length < 5) {
    add({
      type: 'line',
      title: `${primaryAmountCol} Growth`,
      description: `Month-over-month ${primaryAmountCol} trend`,
      xCol: primaryDateCol,
      yCol: primaryAmountCol,
      groupBy: null,
      aggregation: 'sum',
      limit: 24,
      colorScheme: 4,
      timeSeries: true,
      timeGroupBy: 'month',
    });
  }

  // ── Rule 6: agent count bar ───────────────────────────────────────────────
  if (primaryAgentCol && specs.length < 5) {
    add({
      type: 'bar',
      title: `Records by ${primaryAgentCol}`,
      description: `Activity count per ${primaryAgentCol}`,
      xCol: primaryAgentCol,
      yCol: null,
      groupBy: null,
      aggregation: 'count',
      limit: 15,
      colorScheme: 5,
      timeSeries: false,
    });
  }

  // ── Rule 7: category without amount → pie ─────────────────────────────────
  if (primaryCategoryCol && !primaryAmountCol && specs.length < 5) {
    const m = colMeta[primaryCategoryCol];
    if (m && m.unique >= 2 && m.unique <= 15) {
      add({
        type: 'pie',
        title: `Distribution by ${primaryCategoryCol}`,
        description: `Count of records per ${primaryCategoryCol}`,
        xCol: primaryCategoryCol,
        yCol: null,
        groupBy: null,
        aggregation: 'count',
        limit: 12,
        colorScheme: 3,
        timeSeries: false,
      });
    }
  }

  // ── Rule 8: date only → line count ────────────────────────────────────────
  if (primaryDateCol && !primaryAmountCol && specs.length < 4) {
    add({
      type: 'line',
      title: 'Records Over Time',
      description: 'Volume of records by month',
      xCol: primaryDateCol,
      yCol: null,
      groupBy: null,
      aggregation: 'count',
      limit: 24,
      colorScheme: 0,
      timeSeries: true,
      timeGroupBy: 'month',
    });
  }

  // ── Fallback: any text + numeric pair ─────────────────────────────────────
  if (specs.length === 0) {
    const textCol = headers.find(h => ['text_col','name_col','category_col'].includes(semanticMap[h]));
    const numCol  = headers.find(h => ['numeric_col','amount_col'].includes(semanticMap[h]));
    if (textCol && numCol) {
      add({
        type: 'bar',
        title: `${numCol} by ${textCol}`,
        description: 'Summary chart',
        xCol: textCol,
        yCol: numCol,
        groupBy: null,
        aggregation: 'sum',
        limit: 15,
        colorScheme: 0,
        timeSeries: false,
      });
    }
  }

  return specs.slice(0, 6);
}

// ─── aggregateForChart ─────────────────────────────────────────────────────────

export function aggregateForChart(rows, xCol, yCol, method = 'sum', limit = 30) {
  const agg = {};

  rows.forEach(r => {
    const k = String(r[xCol] ?? '').trim();
    if (!k || k === 'undefined' || k === 'null') return;
    if (!agg[k]) agg[k] = { sum: 0, count: 0 };
    agg[k].count += 1;
    if (yCol) {
      const v = parseFloat(String(r[yCol] || 0).replace(/[₹Rs.,$ %]/g, '')) || 0;
      agg[k].sum += v;
    }
  });

  return Object.entries(agg)
    .map(([name, d]) => ({
      name,
      value: method === 'count' ? d.count
           : method === 'avg'   ? (d.count > 0 ? d.sum / d.count : 0)
           :                      d.sum,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

// ─── buildDateTrends ───────────────────────────────────────────────────────────

export function buildDateTrends(rows, dateCol, valueCol, groupBy = 'month') {
  const buckets = {};

  rows.forEach(r => {
    const d = parseFlexibleDate(r[dateCol]);
    if (!d) return;

    const yr  = d.getFullYear();
    const mo  = String(d.getMonth() + 1).padStart(2, '0');
    const dy  = String(d.getDate()).padStart(2, '0');

    let key;
    if (groupBy === 'month')     key = `${yr}-${mo}`;
    else if (groupBy === 'week') {
      const startOfYear = new Date(yr, 0, 1);
      const wk = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
      key = `${yr}-W${String(wk).padStart(2, '0')}`;
    } else {
      key = `${yr}-${mo}-${dy}`;
    }

    if (!buckets[key]) buckets[key] = { sum: 0, count: 0 };
    buckets[key].count += 1;
    if (valueCol) {
      const v = parseFloat(String(r[valueCol] || 0).replace(/[₹Rs.,$ %]/g, '')) || 0;
      buckets[key].sum += v;
    }
  });

  const sorted = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, d]) => ({ name, value: valueCol ? d.sum : d.count }));

  if (!sorted.length) return [];

  const maxVal = Math.max(...sorted.map(d => d.value));
  const minVal = Math.min(...sorted.map(d => d.value));

  return sorted.map((d, i) => {
    const prev = i > 0 ? sorted[i - 1].value : null;
    const growth = prev !== null && prev > 0
      ? Math.round(((d.value - prev) / prev) * 1000) / 10
      : null;
    return { name: d.name, value: d.value, growth, isPeak: d.value === maxVal, isWorst: d.value === minVal && d.value !== maxVal };
  });
}

// ─── generateKPIs ──────────────────────────────────────────────────────────────

export function generateKPIs(analysis, rows) {
  const {
    primaryAmountCol, primaryAgentCol, primaryStatusCol,
    primaryDateCol, idCols, mobileCols, colMeta,
  } = analysis;

  const kpis = [];

  // 1. Total Amount / Revenue
  if (primaryAmountCol) {
    const m = colMeta[primaryAmountCol];
    const total = m?.sum ?? rows.reduce((s, r) => {
      return s + (parseFloat(String(r[primaryAmountCol] || 0).replace(/[₹Rs.,$ %]/g, '')) || 0);
    }, 0);
    const spark = buildDateTrends(rows, primaryDateCol, primaryAmountCol, 'month').slice(-8).map(t => t.value);
    kpis.push({
      id: 'total_amount',
      label: `Total ${primaryAmountCol}`,
      value: total,
      formatted: formatKPIValue(total, 'amount_col'),
      change: null,
      changeLabel: '',
      icon: 'currency',
      sparkline: spark.length >= 3 ? spark : undefined,
    });
  }

  // 2. Total Records
  kpis.push({
    id: 'total_records',
    label: 'Total Records',
    value: rows.length,
    formatted: rows.length.toLocaleString('en-IN'),
    change: null,
    changeLabel: '',
    icon: 'count',
  });

  // 3. Unique Entities (mobile / ID)
  const entityCol = mobileCols[0] || idCols[0];
  if (entityCol) {
    const unique = new Set(
      rows.map(r => String(r[entityCol] || '')).filter(v => v && v !== 'undefined' && v !== 'null')
    );
    kpis.push({
      id: 'unique_entities',
      label: mobileCols.length > 0 ? 'Total Leads' : `Unique ${entityCol}`,
      value: unique.size,
      formatted: unique.size.toLocaleString('en-IN'),
      change: null,
      changeLabel: '',
      icon: 'count',
    });
  }

  // 4. Success Rate
  if (primaryStatusCol) {
    const POSITIVE = new Set([
      'paid','answered','converted','success','successful','approved',
      'completed','done','yes','active','won','collected','settled',
    ]);
    const pos = rows.filter(r => POSITIVE.has(String(r[primaryStatusCol] || '').toLowerCase().trim())).length;
    if (rows.length > 0) {
      const rate = (pos / rows.length) * 100;
      kpis.push({
        id: 'success_rate',
        label: 'Success Rate',
        value: rate,
        formatted: `${rate.toFixed(1)}%`,
        change: null,
        changeLabel: `${pos} of ${rows.length}`,
        icon: 'percent',
      });
    }
  }

  // 5. Top Performer
  if (primaryAgentCol && primaryAmountCol) {
    const totals = {};
    rows.forEach(r => {
      const a = String(r[primaryAgentCol] || '').trim();
      if (!a) return;
      const v = parseFloat(String(r[primaryAmountCol] || 0).replace(/[₹Rs.,$ %]/g, '')) || 0;
      totals[a] = (totals[a] || 0) + v;
    });
    const top = Object.entries(totals).sort(([, a], [, b]) => b - a)[0];
    if (top) {
      kpis.push({
        id: 'top_performer',
        label: 'Top Performer',
        value: top[0],
        formatted: top[0],
        change: null,
        changeLabel: formatKPIValue(top[1], 'amount_col'),
        icon: 'person',
      });
    }
  }

  // 6. MoM Growth
  if (primaryDateCol && primaryAmountCol) {
    const trends = buildDateTrends(rows, primaryDateCol, primaryAmountCol, 'month');
    if (trends.length >= 2) {
      const last = trends[trends.length - 1];
      const prev = trends[trends.length - 2];
      if (prev.value > 0) {
        const g = ((last.value - prev.value) / prev.value) * 100;
        kpis.push({
          id: 'mom_growth',
          label: 'MoM Growth',
          value: g,
          formatted: `${g >= 0 ? '+' : ''}${g.toFixed(1)}%`,
          change: g,
          changeLabel: `vs ${prev.name}`,
          icon: 'trend',
          sparkline: trends.slice(-8).map(t => t.value),
        });
      }
    }
  }

  // 7. Avg transaction
  if (primaryAmountCol && colMeta[primaryAmountCol]?.avg && kpis.length < 7) {
    const avg = colMeta[primaryAmountCol].avg;
    kpis.push({
      id: 'avg_tx',
      label: `Avg ${primaryAmountCol}`,
      value: avg,
      formatted: formatKPIValue(avg, 'amount_col'),
      change: null,
      changeLabel: '',
      icon: 'currency',
    });
  }

  return kpis.slice(0, 6);
}

// ─── formatKPIValue ────────────────────────────────────────────────────────────

export function formatKPIValue(value, semanticType) {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  if (isNaN(n)) return String(value);

  const prefix = semanticType === 'amount_col' ? '₹' : '';

  if (n >= 1e7)  return `${prefix}${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5)  return `${prefix}${(n / 1e5).toFixed(2)} L`;
  if (n >= 1e3)  return `${prefix}${(n / 1e3).toFixed(1)} K`;
  return `${prefix}${Math.round(n).toLocaleString('en-IN')}`;
}

// ─── buildAIPayload ────────────────────────────────────────────────────────────

export function buildAIPayload(analysis, userPrompt = '', helperText = '') {
  const { headers, colMeta, rowCount, semanticMap, relationships } = analysis;

  const colLines = headers.map(h => {
    const m = colMeta[h];
    const st = semanticMap[h];
    let extra = '';
    if ((st === 'amount_col' || st === 'numeric_col') && m.min !== undefined) {
      extra = `, range: ${Math.round(m.min)}–${Math.round(m.max)}, avg: ${Math.round(m.avg)}`;
    } else if (m.unique <= 10) {
      extra = `, values: [${m.sample.slice(0, 5).join(', ')}]`;
    } else {
      extra = `, unique: ${m.unique}`;
    }
    return `  - "${h}" (${st}${extra})`;
  }).join('\n');

  const parts = [
    `ROWS: ${rowCount}`,
    `COLUMNS:\n${colLines}`,
    relationships.length > 0
      ? `DETECTED_RELATIONSHIPS:\n${relationships.map(r => `  - ${r}`).join('\n')}`
      : '',
    userPrompt  ? `USER_REQUEST: ${userPrompt}`    : '',
    helperText  ? `COLUMN_NOTES: ${helperText}`    : '',
  ].filter(Boolean);

  return parts.join('\n\n').slice(0, 3500);
}

// ─── buildFallbackPlan ─────────────────────────────────────────────────────────

export function buildFallbackPlan(analysis, userPrompt = '') {
  const charts = generateChartSpecs(analysis);
  const { primaryAmountCol, primaryAgentCol, primaryStatusCol,
          primaryCategoryCol, primaryDateCol, colMeta } = analysis;

  let title = userPrompt || 'Data Dashboard';
  if (!userPrompt) {
    if (primaryAmountCol && primaryAgentCol) title = 'Agent Performance Dashboard';
    else if (primaryAmountCol && primaryDateCol) title = 'Revenue Analytics Dashboard';
    else if (primaryStatusCol) title = 'Status & Conversion Dashboard';
    else if (primaryCategoryCol) title = 'Category Performance Dashboard';
  }

  const insights = [];
  insights.push(`Dataset has ${analysis.rowCount.toLocaleString('en-IN')} records across ${analysis.headers.length} columns`);
  if (primaryAmountCol && colMeta[primaryAmountCol]?.sum) {
    insights.push(`Total ${primaryAmountCol}: ${formatKPIValue(colMeta[primaryAmountCol].sum, 'amount_col')}`);
  }
  if (analysis.relationships.length > 0) {
    insights.push(`Key patterns: ${analysis.relationships.slice(0, 2).join('; ')}`);
  }

  return {
    title,
    subtitle: `Auto-generated from ${analysis.rowCount.toLocaleString()} rows × ${analysis.headers.length} columns`,
    insights: insights.slice(0, 3),
    charts,
    columnLabels: {},
  };
}

// ─── DashboardStorage ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'adm_recent_v2';
const MAX_SAVED   = 10;

export const DashboardStorage = {
  load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { return []; }
  },
  save(entry) {
    try {
      const list = this.load().filter(d => d.id !== entry.id);
      list.unshift(entry);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_SAVED)));
    } catch {}
  },
  remove(id) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.load().filter(d => d.id !== id)));
    } catch {}
  },
  getById(id) {
    return this.load().find(d => d.id === id) || null;
  },
};

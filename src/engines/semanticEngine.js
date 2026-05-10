/**
 * SEMANTIC INTELLIGENCE ENGINE v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Proprietary rule-based column classification system. Zero AI dependency.
 *
 * Classification pipeline (5 signals → weighted confidence score):
 *  1. Lexical      — keyword matching on normalised column name
 *  2. Statistical  — cardinality, density, value range
 *  3. Value-set    — sample value pattern analysis
 *  4. Co-signal    — presence of related columns boosts confidence
 *  5. Domain vote  — majority-vote over all columns → dataset domain
 */

// ─── Semantic Types ────────────────────────────────────────────────────────────
export const ST = {
  // Temporal
  DATE: 'date', DATETIME: 'datetime', MONTH_COL: 'month_col',
  YEAR_COL: 'year_col', WEEK_COL: 'week_col', QUARTER_COL: 'quarter_col',

  // Financial measures (all are MEASURE role)
  REVENUE: 'revenue', COST: 'cost', PROFIT: 'profit', PAYMENT: 'payment',
  BALANCE: 'balance', INVOICE_AMT: 'invoice_amt', COMMISSION: 'commission',
  SALARY: 'salary', DISCOUNT: 'discount', TAX: 'tax', EMI: 'emi',
  OUTSTANDING: 'outstanding', COLLECTION: 'collection', TARGET: 'target',

  // Performance metrics
  RATE: 'rate', SCORE: 'score', PERCENTAGE: 'percentage', RATIO: 'ratio',
  DURATION: 'duration', COUNT_METRIC: 'count_metric', QUANTITY: 'quantity',

  // People dimensions
  AGENT: 'agent', EMPLOYEE: 'employee', CUSTOMER: 'customer',
  MANAGER: 'manager', VENDOR: 'vendor', CALLER: 'caller',

  // Classification dimensions
  STATUS: 'status', CATEGORY: 'category', PRODUCT: 'product',
  REGION: 'region', CITY: 'city', DEPARTMENT: 'department',
  CHANNEL: 'channel', SOURCE: 'source', BRANCH: 'branch',
  CAMPAIGN: 'campaign', SEGMENT: 'segment', BATCH: 'batch',

  // Identity (non-aggregatable)
  ID: 'id', PHONE: 'phone', EMAIL: 'email', NAME: 'name',

  // Generic fallbacks
  NUMERIC: 'numeric', TEXT: 'text',
};

// ─── Semantic Role ─────────────────────────────────────────────────────────────
export const ROLE = {
  MEASURE:    'measure',     // Numeric facts → SUM / AVG / COUNT
  DIMENSION:  'dimension',   // Group-by axis → categorical
  TEMPORAL:   'temporal',    // Time axis
  IDENTIFIER: 'identifier',  // Keys, IDs, phones — non-aggregatable
  ATTRIBUTE:  'attribute',   // Names, descriptions — low-cardinality text
};

// ─── Dataset Domain ────────────────────────────────────────────────────────────
export const DOMAIN = {
  SALES_CRM:    'sales_crm',
  FINANCE:      'finance',
  HR_PAYROLL:   'hr_payroll',
  ECOMMERCE:    'ecommerce',
  LOGISTICS:    'logistics',
  HEALTHCARE:   'healthcare',
  EDUCATION:    'education',
  REAL_ESTATE:  'real_estate',
  TELECOM:      'telecom',
  GENERIC:      'generic',
};

// ─── Role lookup per semantic type ────────────────────────────────────────────
const ST_ROLE = {
  [ST.DATE]: ROLE.TEMPORAL, [ST.DATETIME]: ROLE.TEMPORAL,
  [ST.MONTH_COL]: ROLE.TEMPORAL, [ST.YEAR_COL]: ROLE.TEMPORAL,
  [ST.WEEK_COL]: ROLE.TEMPORAL, [ST.QUARTER_COL]: ROLE.TEMPORAL,

  [ST.REVENUE]: ROLE.MEASURE, [ST.COST]: ROLE.MEASURE,
  [ST.PROFIT]: ROLE.MEASURE, [ST.PAYMENT]: ROLE.MEASURE,
  [ST.BALANCE]: ROLE.MEASURE, [ST.INVOICE_AMT]: ROLE.MEASURE,
  [ST.COMMISSION]: ROLE.MEASURE, [ST.SALARY]: ROLE.MEASURE,
  [ST.DISCOUNT]: ROLE.MEASURE, [ST.TAX]: ROLE.MEASURE,
  [ST.EMI]: ROLE.MEASURE, [ST.OUTSTANDING]: ROLE.MEASURE,
  [ST.COLLECTION]: ROLE.MEASURE, [ST.TARGET]: ROLE.MEASURE,
  [ST.RATE]: ROLE.MEASURE, [ST.SCORE]: ROLE.MEASURE,
  [ST.PERCENTAGE]: ROLE.MEASURE, [ST.RATIO]: ROLE.MEASURE,
  [ST.DURATION]: ROLE.MEASURE, [ST.COUNT_METRIC]: ROLE.MEASURE,
  [ST.QUANTITY]: ROLE.MEASURE, [ST.NUMERIC]: ROLE.MEASURE,

  [ST.AGENT]: ROLE.DIMENSION, [ST.EMPLOYEE]: ROLE.DIMENSION,
  [ST.CUSTOMER]: ROLE.DIMENSION, [ST.MANAGER]: ROLE.DIMENSION,
  [ST.VENDOR]: ROLE.DIMENSION, [ST.CALLER]: ROLE.DIMENSION,
  [ST.STATUS]: ROLE.DIMENSION, [ST.CATEGORY]: ROLE.DIMENSION,
  [ST.PRODUCT]: ROLE.DIMENSION, [ST.REGION]: ROLE.DIMENSION,
  [ST.CITY]: ROLE.DIMENSION, [ST.DEPARTMENT]: ROLE.DIMENSION,
  [ST.CHANNEL]: ROLE.DIMENSION, [ST.SOURCE]: ROLE.DIMENSION,
  [ST.BRANCH]: ROLE.DIMENSION, [ST.CAMPAIGN]: ROLE.DIMENSION,
  [ST.SEGMENT]: ROLE.DIMENSION, [ST.BATCH]: ROLE.DIMENSION,
  [ST.TEXT]: ROLE.ATTRIBUTE,

  [ST.ID]: ROLE.IDENTIFIER, [ST.PHONE]: ROLE.IDENTIFIER,
  [ST.EMAIL]: ROLE.IDENTIFIER, [ST.NAME]: ROLE.ATTRIBUTE,
};

// ─── Lexical Patterns ──────────────────────────────────────────────────────────
// Each entry: { type, keywords[], exactWords[], weight }
// Higher weight = stronger signal
const LEXICAL_RULES = [
  // ── Temporal ──
  { type: ST.DATE, weight: 0.9,
    kw: ['date','dt','day','dob','expiry','invoice_date','order_date','joined','created','updated','modified','booking','scheduled','due','period'],
    exact: ['date','dob','day','dt'] },
  { type: ST.DATETIME, weight: 0.9,
    kw: ['timestamp','time','datetime','created_at','updated_at'],
    exact: ['timestamp','time','datetime'] },
  { type: ST.MONTH_COL, weight: 0.85,
    kw: ['month','mth','mon'],
    exact: ['month','mth'] },
  { type: ST.YEAR_COL, weight: 0.85,
    kw: ['year','yr','fy','fiscal_year'],
    exact: ['year','yr'] },
  { type: ST.WEEK_COL, weight: 0.8,
    kw: ['week','wk','week_no'],
    exact: ['week','wk'] },
  { type: ST.QUARTER_COL, weight: 0.8,
    kw: ['quarter','qtr','q1','q2','q3','q4'],
    exact: ['quarter','qtr'] },

  // ── Financial measures ──
  { type: ST.REVENUE, weight: 0.95,
    kw: ['revenue','income','earnings','sales_amt','total_revenue','gross'],
    exact: ['revenue','income','gross'] },
  { type: ST.PAYMENT, weight: 0.92,
    kw: ['payment','amount','amt','paid','pay','remittance','disbursement','transaction'],
    exact: ['amount','amt','paid','payment'] },
  { type: ST.COLLECTION, weight: 0.9,
    kw: ['collection','collected','recovery','receivable'],
    exact: ['collection','collected'] },
  { type: ST.COST, weight: 0.9,
    kw: ['cost','expense','expenditure','spend','spending','outflow','debit'],
    exact: ['cost','expense'] },
  { type: ST.PROFIT, weight: 0.9,
    kw: ['profit','margin','net','pnl','p&l','nett'],
    exact: ['profit','margin','net'] },
  { type: ST.BALANCE, weight: 0.88,
    kw: ['balance','outstanding','pending','due','overdue','arrear'],
    exact: ['balance','outstanding'] },
  { type: ST.OUTSTANDING, weight: 0.88,
    kw: ['outstanding','overdue','arrear','pending_amt','dues'],
    exact: ['outstanding','overdue'] },
  { type: ST.SALARY, weight: 0.92,
    kw: ['salary','ctc','payroll','wage','stipend','remuneration'],
    exact: ['salary','wage','ctc'] },
  { type: ST.COMMISSION, weight: 0.9,
    kw: ['commission','incentive','bonus','payout','reward'],
    exact: ['commission','bonus','incentive'] },
  { type: ST.DISCOUNT, weight: 0.88,
    kw: ['discount','rebate','concession','offer'],
    exact: ['discount','rebate'] },
  { type: ST.TAX, weight: 0.9,
    kw: ['tax','gst','vat','tds','cess','levy'],
    exact: ['tax','gst','vat','tds'] },
  { type: ST.EMI, weight: 0.92,
    kw: ['emi','instalment','installment','repayment'],
    exact: ['emi','instalment'] },
  { type: ST.TARGET, weight: 0.88,
    kw: ['target','goal','quota','budget','forecast'],
    exact: ['target','goal','quota'] },
  { type: ST.INVOICE_AMT, weight: 0.88,
    kw: ['invoice','bill','billing','invoice_amt','bill_amount'],
    exact: ['invoice','bill'] },

  // ── Performance ──
  { type: ST.PERCENTAGE, weight: 0.85,
    kw: ['percent','pct','ratio','rate_pct','perc'],
    exact: ['percent','pct','perc'] },
  { type: ST.RATE, weight: 0.82,
    kw: ['rate','apr','interest_rate','yield','return'],
    exact: ['rate'] },
  { type: ST.SCORE, weight: 0.82,
    kw: ['score','rating','rank','grade','marks','gpa','cibil','creditScore'],
    exact: ['score','rating','rank','grade'] },
  { type: ST.DURATION, weight: 0.8,
    kw: ['duration','tenure','period','days','hours','minutes','time_taken','tat','sla'],
    exact: ['duration','tenure','tat','sla'] },
  { type: ST.QUANTITY, weight: 0.8,
    kw: ['qty','quantity','units','pieces','count','volume'],
    exact: ['qty','quantity','units','count'] },

  // ── People dimensions ──
  { type: ST.AGENT, weight: 0.93,
    kw: ['agent','exec','executive','telecaller','caller','tele','advisor','rm','rep','salesperson','sales_rep','collector','dsa'],
    exact: ['agent','caller','telecaller','advisor'] },
  { type: ST.EMPLOYEE, weight: 0.9,
    kw: ['employee','emp','staff','associate','member','personnel','user'],
    exact: ['employee','emp','staff'] },
  { type: ST.MANAGER, weight: 0.88,
    kw: ['manager','team_lead','supervisor','lead','head','tl','sm'],
    exact: ['manager','lead','supervisor'] },
  { type: ST.CUSTOMER, weight: 0.88,
    kw: ['customer','client','consumer','borrower','applicant','member'],
    exact: ['customer','client','consumer'] },
  { type: ST.VENDOR, weight: 0.85,
    kw: ['vendor','supplier','partner','distributor','dealer'],
    exact: ['vendor','supplier','partner'] },

  // ── Classification dimensions ──
  { type: ST.STATUS, weight: 0.9,
    kw: ['status','state','stage','result','disposition','outcome','flag','remark','call_result'],
    exact: ['status','state','stage','result','disposition'] },
  { type: ST.CATEGORY, weight: 0.85,
    kw: ['category','cat','type','class','segment','group'],
    exact: ['category','cat','type','class'] },
  { type: ST.PRODUCT, weight: 0.85,
    kw: ['product','item','sku','service','plan','scheme','loan_type'],
    exact: ['product','item','sku','service'] },
  { type: ST.REGION, weight: 0.85,
    kw: ['region','zone','area','territory','state','country','location'],
    exact: ['region','zone','territory'] },
  { type: ST.CITY, weight: 0.85,
    kw: ['city','town','district','pincode','zip'],
    exact: ['city','town','district'] },
  { type: ST.BRANCH, weight: 0.85,
    kw: ['branch','office','center','outlet','hub','location'],
    exact: ['branch','office','outlet'] },
  { type: ST.DEPARTMENT, weight: 0.85,
    kw: ['department','dept','division','function','unit','vertical','team'],
    exact: ['department','dept','division'] },
  { type: ST.CHANNEL, weight: 0.82,
    kw: ['channel','medium','platform','mode','via'],
    exact: ['channel','medium','mode'] },
  { type: ST.SOURCE, weight: 0.82,
    kw: ['source','lead_source','utm_source','origin','referral','referred'],
    exact: ['source','origin','referral'] },
  { type: ST.CAMPAIGN, weight: 0.82,
    kw: ['campaign','promo','promotion','offer','ad','advertisement','scheme'],
    exact: ['campaign','promo'] },
  { type: ST.SEGMENT, weight: 0.8,
    kw: ['segment','tier','level','bucket','cohort'],
    exact: ['segment','tier','level','bucket'] },
  { type: ST.BATCH, weight: 0.8,
    kw: ['batch','cohort','intake','group_id','class_id'],
    exact: ['batch','intake'] },

  // ── Identity ──
  { type: ST.ID, weight: 0.95,
    kw: ['_id','lead_id','case_id','ticket_id','ref_no','sr_no','serial','invoice_no','order_id','emp_id','student_id','customer_id','account_no','loan_id'],
    exact: ['id','sr','no','ref','serial'] },
  { type: ST.PHONE, weight: 0.95,
    kw: ['mobile','phone','contact','cell','tel','whatsapp','mob','number'],
    exact: ['mobile','phone','contact','cell','tel'] },
  { type: ST.EMAIL, weight: 0.98,
    kw: ['email','mail','e_mail','email_id'],
    exact: ['email','mail'] },
  { type: ST.NAME, weight: 0.88,
    kw: ['name','full_name','customer_name','client_name','fname','lname','first_name','last_name'],
    exact: ['name','fullname'] },
];

// ─── Value-set pattern dictionaries ───────────────────────────────────────────
const STATUS_VALUES = new Set([
  'paid','unpaid','answered','not answered','unanswered','pending','converted','failed',
  'successful','success','active','inactive','open','closed','resolved','approved',
  'rejected','cancelled','cancel','done','new','processing','completed','expired',
  'overdue','yes','no','interested','not interested','callback','follow up','followup',
  'junk','invalid','duplicate','won','lost','dropped','fresh','hot','cold','warm',
  'collected','uncollected','settled','default','bounced','ringing','busy','switched off',
  'noanswer','dnd','wrong number','not reachable','dnc','ptpbroken','ptp',
]);

const MONTH_NAMES = new Set([
  'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec',
  'january','february','march','april','june','july','august','september',
  'october','november','december',
]);

// ─── Domain vote weights ───────────────────────────────────────────────────────
const DOMAIN_SIGNALS = {
  [DOMAIN.SALES_CRM]:   [ST.AGENT, ST.LEAD, ST.CALLER, ST.STATUS, ST.COMMISSION, ST.SOURCE, ST.CAMPAIGN],
  [DOMAIN.FINANCE]:     [ST.PAYMENT, ST.BALANCE, ST.REVENUE, ST.COST, ST.PROFIT, ST.TAX, ST.EMI, ST.OUTSTANDING, ST.INVOICE_AMT],
  [DOMAIN.HR_PAYROLL]:  [ST.EMPLOYEE, ST.SALARY, ST.DEPARTMENT, ST.MANAGER, ST.BATCH],
  [DOMAIN.ECOMMERCE]:   [ST.PRODUCT, ST.QUANTITY, ST.DISCOUNT, ST.REVENUE, ST.CHANNEL],
  [DOMAIN.LOGISTICS]:   [ST.QUANTITY, ST.REGION, ST.CITY, ST.DURATION, ST.VENDOR, ST.BRANCH],
  [DOMAIN.HEALTHCARE]:  [ST.PATIENT, ST.SCORE, ST.DURATION],
  [DOMAIN.EDUCATION]:   [ST.BATCH, ST.SCORE, ST.DEPARTMENT, ST.CATEGORY],
  [DOMAIN.TELECOM]:     [ST.CALLER, ST.DURATION, ST.PHONE, ST.STATUS],
  [DOMAIN.REAL_ESTATE]: [ST.REGION, ST.CITY, ST.REVENUE, ST.BRANCH],
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function normalise(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function hasKeyword(norm, keywords) {
  return keywords.some(kw => norm.includes(kw));
}

function isExact(norm, words) {
  return words.some(w => norm === w || norm.startsWith(w + '_') || norm.endsWith('_' + w));
}

export function parseFlexibleDate(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number' && raw > 1 && raw < 60000) {
    const d = new Date(new Date(1899, 11, 30).getTime() + raw * 86400000);
    if (d.getFullYear() > 1970 && d.getFullYear() < 2100) return d;
  }
  const s = String(raw).trim();
  if (!s || /^\d{1,6}$/.test(s)) return null;
  const d1 = new Date(s);
  if (!isNaN(d1.getTime()) && d1.getFullYear() > 1900 && d1.getFullYear() < 2100) return d1;
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmy) {
    const yr = dmy[3].length === 2 ? (parseInt(dmy[3]) > 50 ? 1900 : 2000) + parseInt(dmy[3]) : parseInt(dmy[3]);
    const d2 = new Date(yr, parseInt(dmy[2]) - 1, parseInt(dmy[1]));
    if (!isNaN(d2.getTime())) return d2;
  }
  const mon = s.match(/^([a-z]{3,9})[\s\-](\d{4})$/i);
  if (mon) { const d3 = new Date(`${mon[1]} 1 ${mon[2]}`); if (!isNaN(d3.getTime())) return d3; }
  return null;
}

// ─── Signal 1: Lexical ─────────────────────────────────────────────────────────
function lexicalSignal(colName) {
  const norm = normalise(colName);
  let best = null;
  let bestScore = 0;

  for (const rule of LEXICAL_RULES) {
    let score = 0;
    if (isExact(norm, rule.exact || [])) score = rule.weight * 1.1;
    else if (hasKeyword(norm, rule.kw)) score = rule.weight * 0.85;
    if (score > bestScore) { bestScore = score; best = rule.type; }
  }
  return { type: best, confidence: Math.min(bestScore, 1) };
}

// ─── Signal 2: Statistical ─────────────────────────────────────────────────────
function statisticalSignal(colName, values, stats) {
  const { cardinality, density, isNumeric, isDate, pctNumeric, rangeMin, rangeMax } = stats;
  const norm = normalise(colName);

  if (isDate) return { type: ST.DATE, confidence: 0.85 };

  if (isNumeric) {
    // High cardinality numeric with large range → measure
    if (cardinality > 50 && rangeMax - rangeMin > 100) return { type: ST.NUMERIC, confidence: 0.6 };
    // Low cardinality numeric (2–20 unique values) → likely a rating or code, treat as dimension
    if (cardinality <= 20 && cardinality >= 2) return { type: ST.SCORE, confidence: 0.4 };
    return { type: ST.NUMERIC, confidence: 0.5 };
  }

  // Text with low cardinality → dimension
  if (!isNumeric && cardinality >= 2 && cardinality <= 30) return { type: ST.CATEGORY, confidence: 0.45 };
  // Text with high cardinality → likely name or id
  if (!isNumeric && cardinality > 100) return { type: ST.TEXT, confidence: 0.3 };

  return { type: ST.TEXT, confidence: 0.2 };
}

// ─── Signal 3: Value-set analysis ─────────────────────────────────────────────
function valueSetSignal(sampleValues) {
  const sample = sampleValues.filter(Boolean).slice(0, 80);
  if (!sample.length) return { type: null, confidence: 0 };

  // Date detection
  const dateFrac = sample.filter(v => parseFlexibleDate(v) !== null).length / sample.length;
  if (dateFrac > 0.7) return { type: ST.DATE, confidence: Math.min(0.9, dateFrac) };

  // Month name detection
  const monthFrac = sample.filter(v => MONTH_NAMES.has(String(v).toLowerCase().trim())).length / sample.length;
  if (monthFrac > 0.6) return { type: ST.MONTH_COL, confidence: Math.min(0.9, monthFrac) };

  // Email detection
  const emailFrac = sample.filter(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))).length / sample.length;
  if (emailFrac > 0.5) return { type: ST.EMAIL, confidence: 0.97 };

  // Phone detection (7+ consecutive digits)
  const phoneFrac = sample.filter(v => /^[\+\d\s\-\(\)]{7,15}$/.test(String(v).trim()) && /\d{7,}/.test(String(v))).length / sample.length;
  if (phoneFrac > 0.5) return { type: ST.PHONE, confidence: 0.92 };

  // Status value detection
  const uniq = [...new Set(sample.map(v => String(v).toLowerCase().trim()))];
  if (uniq.length >= 2 && uniq.length <= 25) {
    const knownFrac = uniq.filter(v => STATUS_VALUES.has(v)).length / uniq.length;
    if (knownFrac >= 0.35) return { type: ST.STATUS, confidence: Math.min(0.88, 0.5 + knownFrac * 0.4) };
  }

  // Purely numeric strings → measure candidate
  const numFrac = sample.filter(v => !isNaN(parseFloat(String(v).replace(/[₹$,% ]/g, ''))) && String(v).trim() !== '').length / sample.length;
  if (numFrac > 0.85) return { type: ST.NUMERIC, confidence: 0.55 };

  return { type: null, confidence: 0 };
}

// ─── Compute column stats ──────────────────────────────────────────────────────
function computeStats(values) {
  const nonEmpty = values.filter(v => v !== null && v !== undefined && v !== '');
  const density = nonEmpty.length / Math.max(values.length, 1);
  const unique = new Set(nonEmpty.map(String));

  const numParsed = nonEmpty.map(v => parseFloat(String(v).replace(/[₹$Rs.,% ]/g, ''))).filter(n => !isNaN(n));
  const pctNumeric = numParsed.length / Math.max(nonEmpty.length, 1);
  const isNumeric = pctNumeric > 0.8;

  const dateParsed = nonEmpty.slice(0, 30).filter(v => parseFlexibleDate(v) !== null);
  const isDate = dateParsed.length / Math.max(Math.min(nonEmpty.length, 30), 1) > 0.7;

  const rangeMin = isNumeric && numParsed.length ? Math.min(...numParsed) : 0;
  const rangeMax = isNumeric && numParsed.length ? Math.max(...numParsed) : 0;

  return { cardinality: unique.size, density, isNumeric, isDate, pctNumeric, rangeMin, rangeMax, numParsed };
}

// ─── Classify a single column ──────────────────────────────────────────────────
function classifyColumn(colName, values) {
  const stats = computeStats(values);
  const nonEmpty = values.filter(v => v !== null && v !== undefined && v !== '');
  const sample = nonEmpty.slice(0, 80).map(String);

  const lex  = lexicalSignal(colName);
  const stat = statisticalSignal(colName, values, stats);
  const vs   = valueSetSignal(sample);

  // Weighted combination: lexical > value-set > statistical
  const candidates = [];
  if (lex.confidence > 0)  candidates.push({ type: lex.type,  score: lex.confidence  * 0.55 });
  if (vs.confidence > 0)   candidates.push({ type: vs.type,   score: vs.confidence   * 0.35 });
  if (stat.confidence > 0) candidates.push({ type: stat.type, score: stat.confidence * 0.10 });

  // Merge scores by type
  const merged = {};
  candidates.forEach(({ type, score }) => { merged[type] = (merged[type] || 0) + score; });

  let bestType = ST.TEXT, bestScore = 0;
  for (const [type, score] of Object.entries(merged)) {
    if (score > bestScore) { bestScore = score; bestType = type; }
  }

  // Hard overrides: if value-set strongly says DATE or EMAIL, trust it
  if (vs.confidence >= 0.85 && (vs.type === ST.DATE || vs.type === ST.EMAIL || vs.type === ST.PHONE || vs.type === ST.STATUS)) {
    bestType = vs.type;
    bestScore = Math.max(bestScore, vs.confidence);
  }

  return {
    semanticType: bestType,
    role: ST_ROLE[bestType] || ROLE.ATTRIBUTE,
    confidence: Math.min(Math.round(bestScore * 100) / 100, 1),
    stats,
  };
}

// ─── Detect dataset domain ─────────────────────────────────────────────────────
function detectDomain(semanticMap) {
  const types = new Set(Object.values(semanticMap).map(c => c.semanticType));
  const scores = {};
  for (const [domain, signals] of Object.entries(DOMAIN_SIGNALS)) {
    scores[domain] = signals.filter(s => types.has(s)).length;
  }
  let best = DOMAIN.GENERIC, bestScore = 0;
  for (const [domain, score] of Object.entries(scores)) {
    if (score > bestScore) { bestScore = score; best = domain; }
  }
  return best;
}

// ─── Detect column relationships ───────────────────────────────────────────────
function detectRelationships(semanticMap, headers) {
  const byRole = { [ROLE.MEASURE]: [], [ROLE.TEMPORAL]: [], [ROLE.DIMENSION]: [], [ROLE.IDENTIFIER]: [], [ROLE.ATTRIBUTE]: [] };
  headers.forEach(h => {
    const { role } = semanticMap[h] || { role: ROLE.ATTRIBUTE };
    if (byRole[role]) byRole[role].push(h);
  });

  const relationships = [];
  const pushRel = (a, b, type) => relationships.push({ columns: [a, b], type });

  byRole[ROLE.TEMPORAL].forEach(t => {
    byRole[ROLE.MEASURE].forEach(m => pushRel(t, m, 'time_series'));
    byRole[ROLE.DIMENSION].forEach(d => pushRel(t, d, 'temporal_breakdown'));
  });
  byRole[ROLE.DIMENSION].forEach(d => {
    byRole[ROLE.MEASURE].forEach(m => pushRel(d, m, 'categorical_aggregate'));
  });

  // Natural language descriptions
  const descriptions = relationships.slice(0, 6).map(r => {
    if (r.type === 'time_series') return `${r.columns[0]} × ${r.columns[1]} → time trend analysis`;
    if (r.type === 'categorical_aggregate') return `${r.columns[0]} × ${r.columns[1]} → comparison / ranking`;
    return `${r.columns[0]} × ${r.columns[1]} → breakdown`;
  });

  return { byRole, relationships, descriptions };
}

// ─── Main export: analyzeDataset ───────────────────────────────────────────────
/**
 * Full semantic analysis of a dataset.
 * Returns enriched metadata for every column + dataset-level insights.
 */
export function analyzeDataset(rows, headers) {
  const semanticMap = {};
  const colMeta = {};

  headers.forEach(h => {
    const values = rows.map(r => r[h]);
    const result = classifyColumn(h, values);
    semanticMap[h] = result;

    const { stats } = result;
    const nonEmpty = values.filter(v => v !== null && v !== undefined && v !== '');

    colMeta[h] = {
      col: h,
      semanticType: result.semanticType,
      role: result.role,
      confidence: result.confidence,
      dataType: stats.isDate ? 'date' : stats.isNumeric ? 'number' : 'text',
      unique: stats.cardinality,
      nullCount: values.length - nonEmpty.length,
      density: Math.round(stats.density * 100),
      sample: [...new Set(nonEmpty.map(String).slice(0, 8))],
      min: stats.rangeMin,
      max: stats.rangeMax,
      sum: stats.isNumeric ? stats.numParsed.reduce((a, b) => a + b, 0) : undefined,
      avg: stats.isNumeric && stats.numParsed.length ? stats.numParsed.reduce((a, b) => a + b, 0) / stats.numParsed.length : undefined,
    };
  });

  const domain = detectDomain(semanticMap);
  const { byRole, relationships, descriptions } = detectRelationships(semanticMap, headers);

  const getFirst = (role) => headers.find(h => semanticMap[h]?.role === role) || null;
  const getFirstST = (...types) => headers.find(h => types.includes(semanticMap[h]?.semanticType)) || null;

  const primaryDateCol    = getFirstST(ST.DATE, ST.DATETIME, ST.MONTH_COL);
  const primaryAmountCol  = getFirstST(ST.REVENUE, ST.PAYMENT, ST.COLLECTION, ST.COST, ST.PROFIT, ST.BALANCE, ST.INVOICE_AMT, ST.SALARY, ST.EMI, ST.COMMISSION, ST.NUMERIC);
  const primaryAgentCol   = getFirstST(ST.AGENT, ST.EMPLOYEE, ST.CALLER);
  const primaryStatusCol  = getFirstST(ST.STATUS);
  const primaryCategoryCol = getFirstST(ST.CATEGORY, ST.PRODUCT, ST.REGION, ST.CHANNEL, ST.SOURCE, ST.BRANCH, ST.DEPARTMENT);
  const idCols            = headers.filter(h => semanticMap[h]?.role === ROLE.IDENTIFIER && semanticMap[h]?.semanticType === ST.ID);
  const mobileCols        = headers.filter(h => semanticMap[h]?.semanticType === ST.PHONE);
  const measures          = byRole[ROLE.MEASURE];
  const dimensions        = byRole[ROLE.DIMENSION];
  const temporals         = byRole[ROLE.TEMPORAL];

  // Overall confidence: average across all columns
  const avgConfidence = Math.round(
    headers.reduce((s, h) => s + (semanticMap[h]?.confidence || 0), 0) / Math.max(headers.length, 1) * 100
  );

  return {
    headers, colMeta, semanticMap, domain,
    rowCount: rows.length,
    relationships: descriptions,
    columnRelationships: relationships,
    byRole, measures, dimensions, temporals,
    primaryDateCol, primaryAmountCol, primaryAgentCol,
    primaryStatusCol, primaryCategoryCol,
    idCols, mobileCols,
    avgConfidence,
    needsAI: avgConfidence < 55, // Flag for AI assistance
  };
}

// ─── Legacy compatibility exports ─────────────────────────────────────────────
export const SEMANTIC_STYLE = {
  [ST.DATE]: { bg: 'rgba(99,102,241,0.12)', color: '#818cf8', label: 'Date' },
  [ST.DATETIME]: { bg: 'rgba(99,102,241,0.12)', color: '#818cf8', label: 'DateTime' },
  [ST.MONTH_COL]: { bg: 'rgba(99,102,241,0.12)', color: '#818cf8', label: 'Month' },
  [ST.YEAR_COL]: { bg: 'rgba(99,102,241,0.12)', color: '#818cf8', label: 'Year' },
  [ST.REVENUE]: { bg: 'rgba(16,185,129,0.12)', color: '#34d399', label: 'Revenue' },
  [ST.PAYMENT]: { bg: 'rgba(16,185,129,0.12)', color: '#34d399', label: 'Payment' },
  [ST.COLLECTION]: { bg: 'rgba(16,185,129,0.12)', color: '#34d399', label: 'Collection' },
  [ST.COST]: { bg: 'rgba(239,68,68,0.12)', color: '#f87171', label: 'Cost' },
  [ST.PROFIT]: { bg: 'rgba(16,185,129,0.12)', color: '#34d399', label: 'Profit' },
  [ST.BALANCE]: { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', label: 'Balance' },
  [ST.SALARY]: { bg: 'rgba(16,185,129,0.12)', color: '#34d399', label: 'Salary' },
  [ST.COMMISSION]: { bg: 'rgba(16,185,129,0.12)', color: '#34d399', label: 'Commission' },
  [ST.EMI]: { bg: 'rgba(16,185,129,0.12)', color: '#34d399', label: 'EMI' },
  [ST.OUTSTANDING]: { bg: 'rgba(239,68,68,0.12)', color: '#f87171', label: 'Outstanding' },
  [ST.TARGET]: { bg: 'rgba(139,92,246,0.12)', color: '#a78bfa', label: 'Target' },
  [ST.DISCOUNT]: { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', label: 'Discount' },
  [ST.TAX]: { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', label: 'Tax' },
  [ST.INVOICE_AMT]: { bg: 'rgba(16,185,129,0.12)', color: '#34d399', label: 'Invoice' },
  [ST.PERCENTAGE]: { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', label: 'Percent' },
  [ST.RATE]: { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', label: 'Rate' },
  [ST.SCORE]: { bg: 'rgba(139,92,246,0.12)', color: '#a78bfa', label: 'Score' },
  [ST.DURATION]: { bg: 'rgba(6,182,212,0.12)', color: '#22d3ee', label: 'Duration' },
  [ST.QUANTITY]: { bg: 'rgba(16,185,129,0.08)', color: '#6ee7b7', label: 'Quantity' },
  [ST.AGENT]: { bg: 'rgba(139,92,246,0.12)', color: '#a78bfa', label: 'Agent' },
  [ST.EMPLOYEE]: { bg: 'rgba(139,92,246,0.12)', color: '#a78bfa', label: 'Employee' },
  [ST.CUSTOMER]: { bg: 'rgba(6,182,212,0.12)', color: '#22d3ee', label: 'Customer' },
  [ST.MANAGER]: { bg: 'rgba(139,92,246,0.12)', color: '#a78bfa', label: 'Manager' },
  [ST.VENDOR]: { bg: 'rgba(139,92,246,0.12)', color: '#a78bfa', label: 'Vendor' },
  [ST.CALLER]: { bg: 'rgba(139,92,246,0.12)', color: '#a78bfa', label: 'Caller' },
  [ST.STATUS]: { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', label: 'Status' },
  [ST.CATEGORY]: { bg: 'rgba(251,146,60,0.12)', color: '#fb923c', label: 'Category' },
  [ST.PRODUCT]: { bg: 'rgba(251,146,60,0.12)', color: '#fb923c', label: 'Product' },
  [ST.REGION]: { bg: 'rgba(251,146,60,0.12)', color: '#fb923c', label: 'Region' },
  [ST.CITY]: { bg: 'rgba(251,146,60,0.12)', color: '#fb923c', label: 'City' },
  [ST.DEPARTMENT]: { bg: 'rgba(251,146,60,0.12)', color: '#fb923c', label: 'Dept' },
  [ST.CHANNEL]: { bg: 'rgba(251,146,60,0.12)', color: '#fb923c', label: 'Channel' },
  [ST.SOURCE]: { bg: 'rgba(251,146,60,0.12)', color: '#fb923c', label: 'Source' },
  [ST.BRANCH]: { bg: 'rgba(251,146,60,0.12)', color: '#fb923c', label: 'Branch' },
  [ST.CAMPAIGN]: { bg: 'rgba(251,146,60,0.12)', color: '#fb923c', label: 'Campaign' },
  [ST.SEGMENT]: { bg: 'rgba(251,146,60,0.12)', color: '#fb923c', label: 'Segment' },
  [ST.BATCH]: { bg: 'rgba(251,146,60,0.12)', color: '#fb923c', label: 'Batch' },
  [ST.ID]: { bg: 'rgba(6,182,212,0.12)', color: '#22d3ee', label: 'ID' },
  [ST.PHONE]: { bg: 'rgba(6,182,212,0.12)', color: '#22d3ee', label: 'Phone' },
  [ST.EMAIL]: { bg: 'rgba(99,102,241,0.12)', color: '#818cf8', label: 'Email' },
  [ST.NAME]: { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', label: 'Name' },
  [ST.NUMERIC]: { bg: 'rgba(16,185,129,0.08)', color: '#6ee7b7', label: 'Number' },
  [ST.TEXT]: { bg: 'rgba(148,163,184,0.08)', color: '#94a3b8', label: 'Text' },
};

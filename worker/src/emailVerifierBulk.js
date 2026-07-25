import * as XLSX from 'xlsx';
import * as cpexcel from 'xlsx/dist/cpexcel.full.mjs';
import {
  claimRateLimit,
  createConfirmationToken,
  hashConfirmationToken,
  runTechnicalCheck,
  sendWithResend,
  verifyTurnstile,
} from './emailVerifier.js';

XLSX.set_cptable(cpexcel);

const EMAIL_COLUMNS = new Set([
  'email',
  'emailaddress',
  'emailid',
  'mail',
  'workemail',
  'officialemail',
]);
const ALLOWED_EXTENSIONS = new Set(['csv', 'xls', 'xlsx']);
const ALLOWED_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
  '',
]);
const JOB_STATUSES = new Set([
  'uploaded', 'ready', 'queued', 'processing', 'partially_completed',
  'completed', 'cancelled', 'failed', 'expired',
]);
const TERMINAL_JOB_STATUSES = new Set(['completed', 'cancelled', 'failed', 'expired']);
const CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000;
const PREVIEW_LIMIT = 20;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function jsonError(c, message, status = 400, code = 'BAD_REQUEST', details = undefined) {
  return c.json({ error: message, code, ...(details ? { details } : {}) }, status);
}

function envNumber(env, key, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const value = Number(env?.[key]);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export function getBulkLimits(env = {}, mode = 'instant') {
  return {
    maxRows: mode === 'confirm_by_email'
      ? envNumber(env, 'EMAIL_BULK_SEND_MAX_ROWS', 250, { max: 1000 })
      : envNumber(env, 'EMAIL_BULK_INSTANT_MAX_ROWS', 5000, { max: 10000 }),
    maxFileBytes: envNumber(env, 'EMAIL_BULK_MAX_FILE_MB', 10, { max: 25 }) * 1024 * 1024,
    batchSize: mode === 'confirm_by_email'
      ? envNumber(env, 'EMAIL_BULK_SEND_BATCH_SIZE', 10, { max: 50 })
      : envNumber(env, 'EMAIL_BULK_BATCH_SIZE', 25, { max: 100 }),
    concurrency: envNumber(env, 'EMAIL_BULK_SEND_CONCURRENCY', 5, { max: 10 }),
    instantTurnstileRows: envNumber(env, 'EMAIL_BULK_INSTANT_TURNSTILE_ROWS', 100, { max: 5000 }),
    retentionDays: envNumber(env, 'EMAIL_JOB_RETENTION_DAYS', 30, { max: 90 }),
  };
}

function extensionOf(filename = '') {
  const match = /\.([a-z0-9]+)$/i.exec(String(filename));
  return match ? match[1].toLowerCase() : '';
}

export function normalizeColumnName(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

export function detectEmailColumns(columns) {
  const matches = columns.filter((column) => EMAIL_COLUMNS.has(normalizeColumnName(column)));
  return {
    matches,
    selected: matches.length === 1 ? matches[0] : null,
    requiresSelection: matches.length !== 1,
  };
}

export function normalizeBulkEmail(value) {
  if (value === null || value === undefined) return '';
  const raw = String(value).replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').trim();
  if (/[\r\n]/.test(raw)) return '';
  const at = raw.lastIndexOf('@');
  if (at <= 0 || at === raw.length - 1) return raw;
  return `${raw.slice(0, at)}@${raw.slice(at + 1).toLowerCase()}`;
}

export function escapeSpreadsheetValue(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export function escapeCsvValue(value) {
  const safe = escapeSpreadsheetValue(value);
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function rowsToCsv(headers, rows) {
  const lines = [headers.map(escapeCsvValue).join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvValue(row?.[header])).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}`;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  const input = String(text || '').replace(/^\uFEFF/, '');

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && input[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted value.');
  row.push(value);
  if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
  return rows;
}

function matrixToRecords(matrix) {
  if (!Array.isArray(matrix) || matrix.length === 0) {
    return { columns: [], records: [] };
  }
  const rawHeaders = matrix[0].map((value, index) => String(value ?? '').trim() || `column_${index + 1}`);
  const used = new Map();
  const columns = rawHeaders.map((header) => {
    const seen = used.get(header) || 0;
    used.set(header, seen + 1);
    return seen === 0 ? header : `${header}_${seen + 1}`;
  });
  const records = matrix.slice(1).map((cells, rowIndex) => {
    const values = {};
    columns.forEach((column, columnIndex) => {
      values[column] = cells?.[columnIndex] ?? '';
    });
    return { originalRowNumber: rowIndex + 2, values };
  }).filter(({ values }) => Object.values(values).some((value) => String(value ?? '').trim() !== ''));
  return { columns, records };
}

export function parseSpreadsheetBytes(bytes, filename, mimeType = '', maxRows = 5000) {
  const extension = extensionOf(filename);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error('Upload a .csv, .xls, or .xlsx file.');
  }
  if (!ALLOWED_MIME_TYPES.has(String(mimeType || '').toLowerCase())) {
    throw new Error('The uploaded file type is not supported.');
  }

  let matrix;
  if (extension === 'csv') {
    matrix = parseCsv(new TextDecoder('utf-8', { fatal: false }).decode(bytes));
  } else {
    const workbook = XLSX.read(bytes, {
      type: 'array',
      raw: true,
      dense: true,
      sheetRows: maxRows + 2,
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      cellStyles: false,
      bookVBA: false,
    });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) throw new Error('The workbook does not contain a worksheet.');
    matrix = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    });
  }

  const parsed = matrixToRecords(matrix);
  if (parsed.columns.length === 0) throw new Error('The file does not contain a header row.');
  if (parsed.records.length > maxRows) {
    throw new Error(`This job exceeds the ${maxRows.toLocaleString()} row limit.`);
  }
  return parsed;
}

function syntaxValidForBulk(email) {
  if (!email || email.length > 254 || /[\s<>()\[\]\\,;:"]/.test(email)) return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return false;
  const labels = domain.split('.');
  return labels.length >= 2 && labels.every((label) =>
    label.length > 0 && label.length <= 63 &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
  );
}

function findColumn(columns, target) {
  const normalizedTarget = normalizeColumnName(target);
  return columns.find((column) => normalizeColumnName(column) === normalizedTarget) || null;
}

export function prepareBulkRows(records, columns, emailColumn) {
  if (!columns.includes(emailColumn)) throw new Error('Select a valid email column.');
  const optionalColumns = {
    name: findColumn(columns, 'name'),
    company: findColumn(columns, 'company'),
    department: findColumn(columns, 'department'),
    designation: findColumn(columns, 'designation'),
    referenceId: findColumn(columns, 'referenceid'),
  };
  const seen = new Set();
  const rows = [];
  let invalid = 0;
  let duplicates = 0;

  for (const record of records) {
    const originalValue = record.values[emailColumn];
    const normalizedEmail = normalizeBulkEmail(originalValue);
    const valid = syntaxValidForBulk(normalizedEmail);
    const duplicateKey = valid ? normalizedEmail : '';
    if (valid && seen.has(duplicateKey)) {
      duplicates += 1;
      continue;
    }
    if (valid) seen.add(duplicateKey);
    else invalid += 1;

    const known = new Set([emailColumn, ...Object.values(optionalColumns).filter(Boolean)]);
    const optionalData = {};
    for (const [key, value] of Object.entries(record.values)) {
      if (!known.has(key) && Object.keys(optionalData).length < 20) optionalData[key] = String(value ?? '').slice(0, 500);
    }
    rows.push({
      originalRowNumber: record.originalRowNumber,
      originalEmailValue: String(originalValue ?? '').slice(0, 500),
      email: valid ? normalizedEmail : null,
      normalizedEmail: valid ? normalizedEmail : null,
      name: optionalColumns.name ? String(record.values[optionalColumns.name] ?? '').slice(0, 200) : '',
      company: optionalColumns.company ? String(record.values[optionalColumns.company] ?? '').slice(0, 200) : '',
      department: optionalColumns.department ? String(record.values[optionalColumns.department] ?? '').slice(0, 200) : '',
      designation: optionalColumns.designation ? String(record.values[optionalColumns.designation] ?? '').slice(0, 200) : '',
      referenceId: optionalColumns.referenceId ? String(record.values[optionalColumns.referenceId] ?? '').slice(0, 200) : '',
      optionalData,
      syntaxValid: valid,
      reason: valid ? 'Ready for verification.' : 'Malformed or missing email address.',
    });
  }
  return {
    rows,
    counts: {
      total: records.length,
      valid: rows.length - invalid,
      invalid,
      duplicates,
    },
  };
}

async function sha256Base64Url(value) {
  const input = value instanceof Uint8Array ? value : new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', input);
  let binary = '';
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createAccessToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function getDb(env) {
  return env.multitool_db || env.DB;
}

function requestIp(c) {
  return c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
}

function apiOrigin(c) {
  return (c.env.PUBLIC_API_URL || new URL(c.req.url).origin).replace(/\/+$/, '');
}

async function getAuthorizedJob(c, { allowTerminal = true } = {}) {
  const db = getDb(c.env);
  if (!db || !c.env.TOKEN_HASH_SECRET) return { error: 'configuration' };
  const token = c.req.header('x-email-job-token') || '';
  if (!token) return { error: 'unauthorized' };
  const tokenHash = await hashConfirmationToken(token, c.env.TOKEN_HASH_SECRET);
  const job = await db.prepare(
    'SELECT * FROM email_verification_jobs WHERE id = ? AND access_token_hash = ? LIMIT 1'
  ).bind(c.req.param('jobId'), tokenHash).first();
  if (!job) return { error: 'unauthorized' };
  if (!allowTerminal && TERMINAL_JOB_STATUSES.has(job.status)) return { error: 'terminal', job };
  return { job, db };
}

function publicPreviewRow(row) {
  return {
    originalRowNumber: row.originalRowNumber,
    email: row.email || row.originalEmailValue,
    valid: row.syntaxValid,
    reason: row.reason,
    name: row.name,
    company: row.company,
  };
}

async function insertRows(db, jobId, rows, now) {
  const chunkSize = 40;
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const statements = rows.slice(offset, offset + chunkSize).map((row) => db.prepare(`
      INSERT INTO email_verification_job_rows (
        id, job_id, original_row_number, original_email_value, email, normalized_email,
        name, company, department, designation, reference_id, optional_data,
        technical_status, delivery_status, engagement_status, confirmation_status,
        confidence_score, syntax_valid, smtp_status, reason, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_sent',
        'no_open_detected', 'not_confirmed', 0, ?, 'not_attempted', ?, ?, ?)
    `).bind(
      crypto.randomUUID(), jobId, row.originalRowNumber, row.originalEmailValue,
      row.email, row.normalizedEmail, row.name, row.company, row.department,
      row.designation, row.referenceId, JSON.stringify(row.optionalData),
      row.syntaxValid ? null : 'precheck_failed', row.syntaxValid ? 1 : 0,
      row.reason, now, now
    ));
    await db.batch(statements);
  }
}

export function summaryFromJob(job) {
  const total = Number(job.total_rows || 0);
  const processed = Number(job.processed_rows || 0);
  return {
    jobId: job.id,
    mode: job.mode,
    status: JOB_STATUSES.has(job.status) ? job.status : 'failed',
    total,
    processed,
    percentage: total === 0 ? 0 : Math.min(100, Math.round((processed / total) * 100)),
    likelyDeliverable: Number(job.likely_deliverable_rows || 0),
    delivered: Number(job.delivered_rows || 0),
    undeliverable: Number(job.undeliverable_rows || 0),
    risky: Number(job.risky_rows || 0),
    catchAll: Number(job.catch_all_rows || 0),
    pending: Number(job.pending_rows || 0),
    openDetected: Number(job.opened_rows || 0),
    clicked: Number(job.clicked_rows || 0),
    confirmed: Number(job.confirmed_rows || 0),
    failed: Number(job.failed_rows || 0),
    delayed: Number(job.delayed_rows || 0),
    softBounce: Number(job.soft_bounce_rows || 0),
    hardBounce: Number(job.hard_bounce_rows || 0),
    suppressed: Number(job.suppressed_rows || 0),
    complaints: Number(job.complaint_rows || 0),
    latestEventAt: job.latest_event_at || job.updated_at,
    createdAt: job.created_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
  };
}

async function claimQuota(db, key, amount, maximum, expiresAt, now = new Date().toISOString()) {
  await db.prepare(
    'DELETE FROM email_verification_rate_limits WHERE rate_key = ? AND expires_at <= ?'
  ).bind(key, now).run();
  const result = await db.prepare(`
    INSERT INTO email_verification_rate_limits (rate_key, request_count, expires_at)
    VALUES (?, ?, ?)
    ON CONFLICT(rate_key) DO UPDATE SET request_count = request_count + excluded.request_count
    WHERE request_count + excluded.request_count <= ?
  `).bind(key, amount, expiresAt, maximum).run();
  return (result.meta?.changes || 0) > 0;
}

async function sendQueueMessages(queue, messages) {
  for (let offset = 0; offset < messages.length; offset += 100) {
    await queue.sendBatch(messages.slice(offset, offset + 100).map((body) => ({ body })));
  }
}

function headerStyle(sheet, width) {
  for (let column = 0; column < width; column += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: column })];
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '4F46E5' } },
        alignment: { vertical: 'center', wrapText: true },
      };
    }
  }
  sheet['!autofilter'] = { ref: sheet['!ref'] };
  sheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' };
}

function workbookResponse(workbook, filename) {
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx', cellStyles: true });
  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

export function createSampleTemplateWorkbook() {
  const workbook = XLSX.utils.book_new();
  const headers = ['email', 'name', 'company', 'department', 'designation', 'reference_id'];
  const rows = [
    ['employee1@example.com', 'Avery Example', 'Example Company', 'Operations', 'Analyst', 'REF-001'],
    ['employee2@example.org', 'Jordan Example', 'Example Organisation', 'Finance', 'Manager', 'REF-002'],
    ['employee3@example.net', 'Taylor Example', 'Example Network', 'Technology', 'Engineer', 'REF-003'],
  ];
  const dataSheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  dataSheet['!cols'] = [{ wch: 30 }, { wch: 22 }, { wch: 24 }, { wch: 18 }, { wch: 20 }, { wch: 16 }];
  headerStyle(dataSheet, headers.length);
  XLSX.utils.book_append_sheet(workbook, dataSheet, 'Email List');

  const instructions = [
    ['Email Verifier Bulk Template — Instructions'],
    ['Required column', 'The email column is required. All other columns are optional.'],
    ['Supported formats', '.xlsx, .xls, and .csv files up to the configured 10 MB default.'],
    ['Bulk Instant Check', 'Checks format, domain, MX records, and risk signals. No email is sent. Default maximum: 5,000 rows.'],
    ['Bulk Confirm by Email', 'Sends one fixed permission-based confirmation message to each approved address. Default maximum: 250 rows.'],
    ['Permission', 'You must own the addresses or have permission before sending confirmation emails. Never upload scraped, purchased, or unsolicited lists.'],
    ['Open tracking', 'Open tracking is an estimate and is not proof that a human read the message. Privacy tools may create automatic opens.'],
    ['Strongest signal', 'A secure confirmation-link click is the strongest verification result.'],
  ];
  const instructionSheet = XLSX.utils.aoa_to_sheet(instructions);
  instructionSheet['!cols'] = [{ wch: 25 }, { wch: 100 }];
  instructionSheet['!rows'] = instructions.map(() => ({ hpt: 34 }));
  for (let row = 0; row < instructions.length; row += 1) {
    for (let column = 0; column < 2; column += 1) {
      const cell = instructionSheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell) cell.s = { alignment: { vertical: 'top', wrapText: true }, font: row === 0 ? { bold: true, sz: 15 } : column === 0 ? { bold: true } : {} };
    }
  }
  XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Instructions');
  return workbook;
}

export function registerEmailVerifierBulkRoutes(app) {
  app.get('/api/email-verifier/template.xlsx', (c) =>
    workbookResponse(createSampleTemplateWorkbook(), 'email-verifier-sample.xlsx')
  );

  app.post('/api/email-verifier/bulk/upload', async (c) => {
    const db = getDb(c.env);
    if (!db) return jsonError(c, 'Verification storage is unavailable.', 503, 'DATABASE_UNAVAILABLE');
    if (!c.env.TOKEN_HASH_SECRET) {
      return jsonError(c, 'Email verification is not configured.', 503, 'CONFIGURATION_ERROR');
    }

    try {
      const form = await c.req.formData();
      const file = form.get('file');
      const mode = String(form.get('mode') || 'instant');
      const selectedColumn = String(form.get('emailColumn') || '');
      const idempotencyKey = String(form.get('idempotencyKey') || '').slice(0, 120) || null;
      if (!['instant', 'confirm_by_email'].includes(mode)) {
        return jsonError(c, 'Select a supported bulk verification mode.', 400, 'INVALID_MODE');
      }
      if (!file || typeof file.arrayBuffer !== 'function') {
        return jsonError(c, 'Choose a CSV or Excel file to upload.', 400, 'FILE_REQUIRED');
      }

      const limits = getBulkLimits(c.env, mode);
      if (file.size <= 0) return jsonError(c, 'The uploaded file is empty.', 400, 'EMPTY_FILE');
      if (file.size > limits.maxFileBytes) {
        return jsonError(c, `The file exceeds the ${Math.round(limits.maxFileBytes / 1024 / 1024)} MB limit.`, 413, 'FILE_TOO_LARGE');
      }
      const extension = extensionOf(file.name);
      if (!ALLOWED_EXTENSIONS.has(extension)) {
        return jsonError(c, 'Upload a .csv, .xls, or .xlsx file.', 415, 'UNSUPPORTED_FILE');
      }
      if (!ALLOWED_MIME_TYPES.has(String(file.type || '').toLowerCase())) {
        return jsonError(c, 'The uploaded file MIME type is not supported.', 415, 'UNSUPPORTED_FILE');
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const parsed = parseSpreadsheetBytes(bytes, file.name, file.type, limits.maxRows);
      const detected = detectEmailColumns(parsed.columns);

      if (!selectedColumn && detected.requiresSelection) {
        return c.json({
          requiresColumnSelection: true,
          columns: parsed.columns,
          suggestedColumns: detected.matches,
          preview: parsed.records.slice(0, PREVIEW_LIMIT).map((record) => ({
            originalRowNumber: record.originalRowNumber,
            ...record.values,
          })),
          file: { name: file.name, size: file.size, type: file.type || '' },
          limits: { maxRows: limits.maxRows, maxFileBytes: limits.maxFileBytes },
        });
      }

      const emailColumn = selectedColumn || detected.selected;
      if (!parsed.columns.includes(emailColumn)) {
        return jsonError(c, 'Select one of the columns found in the file.', 400, 'EMAIL_COLUMN_REQUIRED', {
          columns: parsed.columns,
        });
      }
      const prepared = prepareBulkRows(parsed.records, parsed.columns, emailColumn);
      if (prepared.counts.total === 0) {
        return jsonError(c, 'The file does not contain any data rows.', 400, 'NO_ROWS');
      }

      const ipHash = await hashConfirmationToken(requestIp(c), c.env.TOKEN_HASH_SECRET);
      const sourceMaterial = new Uint8Array(bytes.length + new TextEncoder().encode(mode).length);
      sourceMaterial.set(bytes, 0);
      sourceMaterial.set(new TextEncoder().encode(mode), bytes.length);
      const sourceHash = await sha256Base64Url(sourceMaterial);
      const recentCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      if (idempotencyKey) {
        const repeatedRequest = await db.prepare(`
          SELECT id FROM email_verification_jobs
          WHERE requester_ip_hash = ? AND idempotency_key = ? LIMIT 1
        `).bind(ipHash, idempotencyKey).first();
        if (repeatedRequest) {
          return jsonError(c, 'This upload request was already accepted.', 409, 'DUPLICATE_REQUEST');
        }
      }
      const duplicate = await db.prepare(`
        SELECT id FROM email_verification_jobs
        WHERE requester_ip_hash = ? AND source_hash = ? AND mode = ?
          AND created_at >= ? AND status NOT IN ('cancelled', 'failed', 'expired')
        LIMIT 1
      `).bind(ipHash, sourceHash, mode, recentCutoff).first();
      if (duplicate) {
        return jsonError(c, 'This file was already uploaded recently. Continue the existing job or wait before uploading it again.', 409, 'DUPLICATE_JOB');
      }

      const accessToken = createAccessToken();
      const accessTokenHash = await hashConfirmationToken(accessToken, c.env.TOKEN_HASH_SECRET);
      const jobId = `job_${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + limits.retentionDays * 24 * 60 * 60 * 1000).toISOString();
      const processingLimits = JSON.stringify({
        maxRows: limits.maxRows,
        maxFileBytes: limits.maxFileBytes,
        batchSize: limits.batchSize,
        concurrency: limits.concurrency,
      });

      await db.prepare(`
        INSERT INTO email_verification_jobs (
          id, access_token_hash, idempotency_key, source_hash, mode, original_filename,
          source_mime_type, email_column, status, total_rows, valid_rows, invalid_rows,
          duplicate_rows, requester_ip_hash, retention_days, processing_limits,
          created_at, updated_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        jobId, accessTokenHash, idempotencyKey, sourceHash, mode,
        String(file.name).slice(0, 255), String(file.type || '').slice(0, 120),
        emailColumn, prepared.counts.total, prepared.counts.valid, prepared.counts.invalid,
        prepared.counts.duplicates, ipHash, limits.retentionDays, processingLimits,
        now, now, expiresAt
      ).run();

      try {
        await insertRows(db, jobId, prepared.rows, now);
      } catch (insertError) {
        await db.prepare('DELETE FROM email_verification_jobs WHERE id = ?').bind(jobId).run();
        throw insertError;
      }

      return c.json({
        jobId,
        accessToken,
        mode,
        status: 'ready',
        emailColumn,
        counts: prepared.counts,
        preview: prepared.rows.slice(0, PREVIEW_LIMIT).map(publicPreviewRow),
        requiresTurnstile: mode === 'confirm_by_email' ||
          prepared.counts.valid > limits.instantTurnstileRows,
        limits: { maxRows: limits.maxRows, maxFileBytes: limits.maxFileBytes },
      }, 201);
    } catch (error) {
      console.error('Bulk email upload failed', {
        message: error?.message,
        name: error?.name,
      });
      const message = error?.message || 'The file could not be parsed.';
      const status = /row limit/i.test(message) ? 413 : 400;
      return jsonError(c, message, status, status === 413 ? 'ROW_LIMIT_EXCEEDED' : 'FILE_PARSE_FAILED');
    }
  });

  app.post('/api/email-verifier/bulk/:jobId/start', async (c) => {
    const authorized = await getAuthorizedJob(c);
    if (authorized.error === 'configuration') return jsonError(c, 'Email verification is not configured.', 503, 'CONFIGURATION_ERROR');
    if (authorized.error === 'unauthorized') return jsonError(c, 'Bulk job not found or access denied.', 404, 'NOT_FOUND');
    const { db, job } = authorized;
    if (job.status !== 'ready') {
      if (['queued', 'processing', 'partially_completed'].includes(job.status)) {
        return c.json(summaryFromJob(job), 202);
      }
      return jsonError(c, `A ${job.status} job cannot be started.`, 409, 'JOB_NOT_READY');
    }
    if (!c.env.EMAIL_VERIFICATION_QUEUE) {
      return jsonError(c, 'Bulk processing is not configured.', 503, 'QUEUE_UNAVAILABLE');
    }

    try {
      const body = await c.req.json();
      const limits = getBulkLimits(c.env, job.mode);
      const needsTurnstile = job.mode === 'confirm_by_email' ||
        Number(job.valid_rows) > limits.instantTurnstileRows;
      if (job.mode === 'confirm_by_email' && body.consent !== true) {
        return jsonError(c, 'Permission is required before sending verification emails.', 400, 'CONSENT_REQUIRED');
      }
      if (needsTurnstile) {
        if (!body.turnstileToken) {
          return jsonError(c, 'Complete the bot-protection check before starting this job.', 428, 'TURNSTILE_REQUIRED');
        }
        const action = job.mode === 'confirm_by_email'
          ? 'email_verifier_bulk_send'
          : 'email_verifier_bulk_instant';
        const turnstileValid = await verifyTurnstile(body.turnstileToken, requestIp(c), c.env, action);
        if (!turnstileValid) {
          return jsonError(c, 'Bot-protection verification failed. Please try again.', 403, 'TURNSTILE_FAILED');
        }
      }

      const now = new Date();
      const hourExpiry = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      const dayExpiry = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1
      )).toISOString();
      const ipHourlyLimit = job.mode === 'confirm_by_email'
        ? envNumber(c.env, 'EMAIL_BULK_SEND_IP_HOURLY_LIMIT', 2, { max: 20 })
        : envNumber(c.env, 'EMAIL_BULK_INSTANT_IP_HOURLY_LIMIT', 10, { max: 100 });
      const ipDailyLimit = job.mode === 'confirm_by_email'
        ? envNumber(c.env, 'EMAIL_BULK_SEND_IP_DAILY_LIMIT', 500, { max: 5000 })
        : envNumber(c.env, 'EMAIL_BULK_INSTANT_IP_DAILY_LIMIT', 20000, { max: 100000 });
      if (!(await claimRateLimit(db, `bulk-job-hour:${job.requester_ip_hash}:${job.mode}`, ipHourlyLimit, hourExpiry))) {
        return jsonError(c, 'Too many bulk jobs were started from this network. Try again later.', 429, 'RATE_LIMITED');
      }
      if (!(await claimQuota(
        db,
        `bulk-rows-day:${job.requester_ip_hash}:${job.mode}:${now.toISOString().slice(0, 10)}`,
        Number(job.valid_rows),
        ipDailyLimit,
        dayExpiry
      ))) {
        return jsonError(c, 'The daily bulk recipient limit for this network has been reached.', 429, 'DAILY_LIMIT_REACHED');
      }
      if (job.mode === 'confirm_by_email') {
        const globalLimit = envNumber(c.env, 'EMAIL_BULK_SEND_DAILY_LIMIT', 1000, { max: 100000 });
        if (!(await claimQuota(
          db,
          `bulk-global-send:${now.toISOString().slice(0, 10)}`,
          Number(job.valid_rows),
          globalLimit,
          dayExpiry
        ))) {
          return jsonError(c, 'The service-wide daily verification-email limit has been reached.', 429, 'GLOBAL_DAILY_LIMIT_REACHED');
        }
      }

      const rows = await db.prepare(`
        SELECT id FROM email_verification_job_rows
        WHERE job_id = ? AND syntax_valid = 1 AND processed_at IS NULL
        ORDER BY original_row_number
      `).bind(job.id).all();
      const ids = (rows.results || []).map((row) => row.id);
      const messages = [];
      for (let offset = 0; offset < ids.length; offset += limits.batchSize) {
        messages.push({
          kind: 'email_verification_bulk',
          jobId: job.id,
          mode: job.mode,
          rowIds: ids.slice(offset, offset + limits.batchSize),
          attempt: 1,
        });
      }

      const startedAt = now.toISOString();
      await db.prepare(`
        UPDATE email_verification_jobs
        SET status = 'queued', consent_confirmed = ?,
            processed_rows = invalid_rows + duplicate_rows,
            started_at = ?, updated_at = ?
        WHERE id = ? AND status = 'ready'
      `).bind(job.mode === 'confirm_by_email' ? 1 : 0, startedAt, startedAt, job.id).run();
      await db.prepare(`
        UPDATE email_verification_job_rows
        SET processed_at = ?, updated_at = ?, latest_event = 'precheck_failed',
            latest_event_at = ?
        WHERE job_id = ? AND syntax_valid = 0 AND processed_at IS NULL
      `).bind(startedAt, startedAt, startedAt, job.id).run();
      if (messages.length > 0) {
        await sendQueueMessages(c.env.EMAIL_VERIFICATION_QUEUE, messages);
      } else {
        await db.prepare(`
          UPDATE email_verification_jobs
          SET status = 'completed', completed_at = ?, updated_at = ?
          WHERE id = ?
        `).bind(startedAt, startedAt, job.id).run();
      }
      const updated = await db.prepare('SELECT * FROM email_verification_jobs WHERE id = ?').bind(job.id).first();
      return c.json(summaryFromJob(updated), 202);
    } catch (error) {
      console.error('Bulk email job start failed', { jobId: job.id, message: error?.message });
      return jsonError(c, 'The bulk job could not be started.', 500, 'START_FAILED');
    }
  });

  app.get('/api/email-verifier/bulk/:jobId/status', async (c) => {
    const authorized = await getAuthorizedJob(c);
    if (authorized.error) return jsonError(c, 'Bulk job not found or access denied.', 404, 'NOT_FOUND');
    return c.json(summaryFromJob(authorized.job));
  });

  app.get('/api/email-verifier/bulk/:jobId/results', async (c) => {
    const authorized = await getAuthorizedJob(c);
    if (authorized.error) return jsonError(c, 'Bulk job not found or access denied.', 404, 'NOT_FOUND');
    const { db, job } = authorized;
    const page = Math.max(1, Number.parseInt(c.req.query('page') || '1', 10) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(c.req.query('pageSize') || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));
    const search = String(c.req.query('search') || '').trim().slice(0, 200);
    const technical = String(c.req.query('technicalStatus') || '').trim();
    const delivery = String(c.req.query('deliveryStatus') || '').trim();
    const confirmation = String(c.req.query('confirmationStatus') || '').trim();
    const sort = String(c.req.query('sort') || 'row_asc');
    const where = ['job_id = ?'];
    const bindings = [job.id];
    if (search) {
      where.push('(normalized_email LIKE ? OR original_email_value LIKE ?)');
      bindings.push(`%${search.replace(/[%_]/g, '\\$&')}%`, `%${search.replace(/[%_]/g, '\\$&')}%`);
    }
    if (technical) { where.push('technical_status = ?'); bindings.push(technical); }
    if (delivery) { where.push('delivery_status = ?'); bindings.push(delivery); }
    if (confirmation) { where.push('confirmation_status = ?'); bindings.push(confirmation); }
    const orderBy = {
      confidence_asc: 'confidence_score ASC, original_row_number ASC',
      confidence_desc: 'confidence_score DESC, original_row_number ASC',
      email_asc: 'normalized_email ASC, original_row_number ASC',
      row_desc: 'original_row_number DESC',
      row_asc: 'original_row_number ASC',
    }[sort] || 'original_row_number ASC';
    const whereSql = where.join(' AND ');
    const totalRow = await db.prepare(
      `SELECT COUNT(*) AS total FROM email_verification_job_rows WHERE ${whereSql}`
    ).bind(...bindings).first();
    const total = Number(totalRow?.total || 0);
    const result = await db.prepare(`
      SELECT id, original_row_number, original_email_value, email, normalized_email,
        name, company, department, designation, reference_id, technical_status,
        delivery_status, engagement_status, confirmation_status, confidence_score,
        syntax_valid, domain_valid, mx_valid, disposable, role_based, catch_all,
        domain, suggested_email, smtp_status, sent_at, delivered_at, first_opened_at,
        last_opened_at, open_count, first_clicked_at, last_clicked_at, click_count,
        confirmed_at, delayed_at, bounced_at, bounce_type, bounce_reason, complained_at,
        failed_at, latest_event, latest_event_at, reason, score_breakdown
      FROM email_verification_job_rows
      WHERE ${whereSql}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).bind(...bindings, pageSize, (page - 1) * pageSize).all();
    const items = (result.results || []).map(publicJobRow);
    return c.json({
      jobId: job.id,
      status: job.status,
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      summary: summaryFromJob(job),
    });
  });

  app.post('/api/email-verifier/bulk/:jobId/cancel', async (c) => {
    const authorized = await getAuthorizedJob(c);
    if (authorized.error) return jsonError(c, 'Bulk job not found or access denied.', 404, 'NOT_FOUND');
    const { db, job } = authorized;
    if (TERMINAL_JOB_STATUSES.has(job.status)) return c.json(summaryFromJob(job));
    const now = new Date().toISOString();
    await db.prepare(`
      UPDATE email_verification_jobs
      SET status = 'cancelled', cancelled_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(now, now, job.id).run();
    const updated = await db.prepare('SELECT * FROM email_verification_jobs WHERE id = ?').bind(job.id).first();
    return c.json(summaryFromJob(updated));
  });

  app.delete('/api/email-verifier/bulk/:jobId', async (c) => {
    const authorized = await getAuthorizedJob(c);
    if (authorized.error) return jsonError(c, 'Bulk job not found or access denied.', 404, 'NOT_FOUND');
    const { db, job } = authorized;
    if (['queued', 'processing', 'partially_completed'].includes(job.status)) {
      return jsonError(c, 'Cancel the job before deleting it.', 409, 'JOB_ACTIVE');
    }
    await db.batch([
      db.prepare('DELETE FROM email_verification_events WHERE job_row_id IN (SELECT id FROM email_verification_job_rows WHERE job_id = ?)').bind(job.id),
      db.prepare('DELETE FROM email_verification_job_rows WHERE job_id = ?').bind(job.id),
      db.prepare('DELETE FROM email_verification_jobs WHERE id = ?').bind(job.id),
    ]);
    return c.json({ deleted: true, jobId: job.id });
  });

  app.get('/api/email-verifier/bulk/:jobId/export.csv', async (c) => {
    const authorized = await getAuthorizedJob(c);
    if (authorized.error) return jsonError(c, 'Bulk job not found or access denied.', 404, 'NOT_FOUND');
    const result = await authorized.db.prepare(`
      SELECT * FROM email_verification_job_rows WHERE job_id = ? ORDER BY original_row_number
    `).bind(authorized.job.id).all();
    const rows = (result.results || []).map(exportRow);
    const headers = exportHeaders();
    return new Response(rowsToCsv(headers, rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="email-verification-${authorized.job.id}.csv"`,
        'Cache-Control': 'private, no-store',
      },
    });
  });

  app.get('/api/email-verifier/bulk/:jobId/export.xlsx', async (c) => {
    const authorized = await getAuthorizedJob(c);
    if (authorized.error) return jsonError(c, 'Bulk job not found or access denied.', 404, 'NOT_FOUND');
    const result = await authorized.db.prepare(`
      SELECT * FROM email_verification_job_rows WHERE job_id = ? ORDER BY original_row_number
    `).bind(authorized.job.id).all();
    const workbook = createReportWorkbook(authorized.job, result.results || []);
    return workbookResponse(workbook, `email-verification-${authorized.job.id}.xlsx`);
  });
}

function publicJobRow(row) {
  return {
    id: row.id,
    originalRowNumber: row.original_row_number,
    email: row.normalized_email || row.original_email_value,
    name: row.name,
    company: row.company,
    department: row.department,
    designation: row.designation,
    referenceId: row.reference_id,
    technicalStatus: row.technical_status || 'unknown',
    deliveryStatus: row.delivery_status || 'not_sent',
    engagementStatus: row.engagement_status || 'no_open_detected',
    confirmationStatus: row.confirmation_status || 'not_confirmed',
    confidenceScore: Number(row.confidence_score || 0),
    syntaxValid: row.syntax_valid === 1,
    domainValid: row.domain_valid == null ? null : row.domain_valid === 1,
    mxValid: row.mx_valid == null ? null : row.mx_valid === 1,
    disposable: row.disposable === 1,
    roleBased: row.role_based === 1,
    catchAll: row.catch_all == null ? null : row.catch_all === 1,
    domain: row.domain,
    suggestedEmail: row.suggested_email,
    smtpStatus: row.smtp_status,
    sentAt: row.sent_at,
    deliveredAt: row.delivered_at,
    firstOpenedAt: row.first_opened_at,
    lastOpenedAt: row.last_opened_at,
    openCount: Number(row.open_count || 0),
    firstClickedAt: row.first_clicked_at,
    lastClickedAt: row.last_clicked_at,
    clickCount: Number(row.click_count || 0),
    confirmedAt: row.confirmed_at,
    latestEvent: row.latest_event,
    latestEventAt: row.latest_event_at,
    reason: row.reason,
    scoreBreakdown: safeJson(row.score_breakdown, []),
  };
}

function safeJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function exportHeaders() {
  return [
    'original_row_number', 'email', 'name', 'company', 'department', 'designation',
    'reference_id', 'technical_status', 'delivery_status', 'engagement_status',
    'confirmation_status', 'confidence_score', 'syntax_valid', 'domain_valid',
    'mx_valid', 'disposable', 'role_based', 'catch_all', 'domain', 'suggested_email',
    'smtp_status', 'sent_at', 'delivered_at', 'first_opened_at', 'last_opened_at',
    'open_count', 'first_clicked_at', 'last_clicked_at', 'click_count', 'confirmed_at',
    'delayed_at', 'bounced_at', 'bounce_type', 'bounce_reason', 'complained_at',
    'failed_at', 'latest_event', 'reason',
  ];
}

function exportRow(row) {
  return {
    original_row_number: row.original_row_number,
    email: row.normalized_email || row.original_email_value,
    name: row.name,
    company: row.company,
    department: row.department,
    designation: row.designation,
    reference_id: row.reference_id,
    technical_status: row.technical_status,
    delivery_status: row.delivery_status,
    engagement_status: row.engagement_status,
    confirmation_status: row.confirmation_status,
    confidence_score: row.confidence_score,
    syntax_valid: row.syntax_valid,
    domain_valid: row.domain_valid,
    mx_valid: row.mx_valid,
    disposable: row.disposable,
    role_based: row.role_based,
    catch_all: row.catch_all,
    domain: row.domain,
    suggested_email: row.suggested_email,
    smtp_status: row.smtp_status,
    sent_at: row.sent_at,
    delivered_at: row.delivered_at,
    first_opened_at: row.first_opened_at,
    last_opened_at: row.last_opened_at,
    open_count: row.open_count,
    first_clicked_at: row.first_clicked_at,
    last_clicked_at: row.last_clicked_at,
    click_count: row.click_count,
    confirmed_at: row.confirmed_at,
    delayed_at: row.delayed_at,
    bounced_at: row.bounced_at,
    bounce_type: row.bounce_type,
    bounce_reason: row.bounce_reason,
    complained_at: row.complained_at,
    failed_at: row.failed_at,
    latest_event: row.latest_event,
    reason: row.reason,
  };
}

export function createReportWorkbook(job, databaseRows) {
  const workbook = XLSX.utils.book_new();
  const summary = summaryFromJob(job);
  const generatedAt = new Date().toISOString();
  const summaryRows = [
    ['Email Verification Summary', ''],
    ['Job ID', job.id],
    ['Verification Mode', job.mode],
    ['Original File Name', escapeSpreadsheetValue(job.original_filename)],
    ['Created At', job.created_at],
    ['Started At', job.started_at || ''],
    ['Completed At', job.completed_at || ''],
    ['Total Uploaded', summary.total],
    ['Valid Rows', Number(job.valid_rows || 0)],
    ['Invalid Rows', Number(job.invalid_rows || 0)],
    ['Duplicates Removed', Number(job.duplicate_rows || 0)],
    ['Processed Rows', summary.processed],
    ['Likely Deliverable', summary.likelyDeliverable],
    ['Delivered', summary.delivered],
    ['Open Detected', summary.openDetected],
    ['Click Detected', summary.clicked],
    ['Confirmed Active', summary.confirmed],
    ['Undeliverable', summary.undeliverable],
    ['Risky', summary.risky],
    ['Catch-All', summary.catchAll],
    ['Pending', summary.pending],
    ['Delayed', summary.delayed],
    ['Soft Bounce', summary.softBounce],
    ['Hard Bounce', summary.hardBounce],
    ['Suppressed', summary.suppressed],
    ['Complaints', summary.complaints],
    ['Failed', summary.failed],
    ['Completion Percentage', summary.percentage / 100],
    ['Generated At', generatedAt],
    ['Important limitation', 'Open tracking is an estimate. A secure confirmation-link click is the strongest proof. SMTP probing is unavailable from Cloudflare and is not treated as a failed address.'],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 30 }, { wch: 92 }];
  summarySheet['A1'].s = { font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '4F46E5' } } };
  summarySheet['B1'].s = summarySheet['A1'].s;
  for (let row = 1; row < summaryRows.length; row += 1) {
    const label = summarySheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
    const value = summarySheet[XLSX.utils.encode_cell({ r: row, c: 1 })];
    if (label) label.s = { font: { bold: true }, fill: { fgColor: { rgb: row % 2 ? 'EEF2FF' : 'FFFFFF' } } };
    if (value) value.s = { alignment: { wrapText: true, vertical: 'top' } };
  }
  const percentageCell = summarySheet[`B${summaryRows.findIndex(([label]) => label === 'Completion Percentage') + 1}`];
  if (percentageCell) percentageCell.z = '0%';
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  const headers = exportHeaders();
  const resultRows = databaseRows.filter((row) => row.syntax_valid === 1).map(exportRow);
  const resultSheet = XLSX.utils.json_to_sheet(
    resultRows.map((row) => Object.fromEntries(headers.map((header) => [header, escapeSpreadsheetValue(row[header])]))),
    { header: headers }
  );
  resultSheet['!cols'] = headers.map((header) => ({
    wch: Math.min(42, Math.max(12, header.length + 2)),
  }));
  headerStyle(resultSheet, headers.length);
  XLSX.utils.book_append_sheet(workbook, resultSheet, 'Results');

  const invalidHeaders = ['original_row_number', 'original_email_value', 'name', 'company', 'reason'];
  const invalidRows = databaseRows.filter((row) => row.syntax_valid !== 1).map((row) => ({
    original_row_number: row.original_row_number,
    original_email_value: escapeSpreadsheetValue(row.original_email_value),
    name: escapeSpreadsheetValue(row.name),
    company: escapeSpreadsheetValue(row.company),
    reason: escapeSpreadsheetValue(row.reason),
  }));
  const invalidSheet = XLSX.utils.json_to_sheet(invalidRows, { header: invalidHeaders });
  invalidSheet['!cols'] = [{ wch: 20 }, { wch: 36 }, { wch: 24 }, { wch: 24 }, { wch: 50 }];
  headerStyle(invalidSheet, invalidHeaders.length);
  XLSX.utils.book_append_sheet(workbook, invalidSheet, 'Invalid Rows');

  const guideRows = [
    ['Status dimension', 'Status', 'Meaning'],
    ['Technical', 'Likely Deliverable', 'Valid format, resolvable domain, and usable MX records.'],
    ['Technical', 'Undeliverable', 'Invalid syntax, missing domain, missing MX, hard bounce, or complaint.'],
    ['Technical', 'Risky', 'Disposable, role-based, mistyped, or otherwise higher-risk address.'],
    ['Technical', 'Catch-All', 'The domain may accept arbitrary recipients; the exact mailbox is uncertain.'],
    ['Technical', 'Unknown', 'There is not enough evidence. SMTP being unavailable is not a failure.'],
    ['Technical', 'Precheck Failed', 'The uploaded value was malformed or could not be checked.'],
    ['Delivery', 'Not Sent / Queued / Sending / Sent', 'Provider delivery workflow states.'],
    ['Delivery', 'Delivered', 'The receiving server accepted the message; this does not prove a human read it.'],
    ['Delivery', 'Delayed / Soft Bounce', 'Temporary delivery problem.'],
    ['Delivery', 'Hard Bounce / Suppressed / Complaint / Failed', 'Terminal delivery or reputation-protection state.'],
    ['Engagement', 'No Open Detected', 'No tracking event was observed. This is not proof the message was unseen.'],
    ['Engagement', 'Open Detected', 'An estimated open event was observed; privacy systems can create automatic opens.'],
    ['Engagement', 'Click Detected', 'A tracked link was requested.'],
    ['Confirmation', 'Confirmed Active', 'The unique secure confirmation link was completed; this is the strongest signal.'],
    ['Confidence score', '0–100', 'A transparent evidence score, not a guarantee of inbox placement or human ownership. Opens alone never produce 100.'],
  ];
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
  guideSheet['!cols'] = [{ wch: 18 }, { wch: 34 }, { wch: 100 }];
  headerStyle(guideSheet, 3);
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'Status Guide');

  const infoRows = [
    ['Job Information', ''],
    ['Mode', job.mode],
    ['Source file', escapeSpreadsheetValue(job.original_filename)],
    ['Selected email column', escapeSpreadsheetValue(job.email_column)],
    ['Requester timestamp', job.created_at],
    ['Processing limits', escapeSpreadsheetValue(job.processing_limits)],
    ['Retention period', `${job.retention_days || 30} days`],
    ['Export generated at', generatedAt],
  ];
  const infoSheet = XLSX.utils.aoa_to_sheet(infoRows);
  infoSheet['!cols'] = [{ wch: 28 }, { wch: 90 }];
  infoSheet['A1'].s = { font: { bold: true, sz: 15 } };
  XLSX.utils.book_append_sheet(workbook, infoSheet, 'Job Information');
  return workbook;
}

function technicalFields(result) {
  const scoreBreakdown = [
    { signal: 'Valid syntax', points: result.syntax.valid ? 10 : 0 },
    { signal: 'Domain resolves', points: result.domain.valid === true ? 15 : 0 },
    { signal: 'MX records found', points: result.mx.valid === true ? 25 : 0 },
    { signal: 'Not disposable', points: !result.disposable.value ? 10 : 0 },
    { signal: 'Not role-based', points: !result.roleBased.value ? 5 : 0 },
  ];
  return {
    technicalStatus: result.status,
    confidenceScore: result.confidenceScore,
    syntaxValid: result.syntax.valid ? 1 : 0,
    domainValid: result.domain.valid == null ? null : result.domain.valid ? 1 : 0,
    mxValid: result.mx.valid == null ? null : result.mx.valid ? 1 : 0,
    disposable: result.disposable.value ? 1 : 0,
    roleBased: result.roleBased.value ? 1 : 0,
    catchAll: result.catchAll.value == null ? null : result.catchAll.value ? 1 : 0,
    domain: result.email.split('@')[1] || '',
    suggestedEmail: result.suggestedEmail,
    smtpStatus: result.smtp.status,
    reason: result.reason,
    scoreBreakdown,
  };
}

async function suppressionForEmail(db, email) {
  return db.prepare(`
    SELECT reason FROM email_verification_suppressions WHERE normalized_email IN (?, ?)
    UNION ALL
    SELECT CASE WHEN delivery_status = 'complaint' THEN 'complaint' ELSE 'hard_bounce' END
    FROM email_verifications
    WHERE normalized_email IN (?, ?) AND delivery_status IN ('complaint', 'bounced')
    LIMIT 1
  `).bind(email, email.toLowerCase(), email, email.toLowerCase()).first();
}

async function historicalDelivery(db, email) {
  return db.prepare(`
    SELECT delivered_at FROM email_verifications
    WHERE normalized_email IN (?, ?) AND delivered_at IS NOT NULL
    ORDER BY delivered_at DESC LIMIT 1
  `).bind(email, email.toLowerCase()).first();
}

async function updateJobAggregates(db, jobId) {
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE email_verification_jobs
    SET
      processed_rows = duplicate_rows + (SELECT COUNT(*) FROM email_verification_job_rows WHERE job_id = ? AND processed_at IS NOT NULL),
      likely_deliverable_rows = (SELECT COUNT(*) FROM email_verification_job_rows WHERE job_id = ? AND technical_status = 'likely_deliverable'),
      undeliverable_rows = (SELECT COUNT(*) FROM email_verification_job_rows WHERE job_id = ? AND technical_status = 'undeliverable'),
      risky_rows = (SELECT COUNT(*) FROM email_verification_job_rows WHERE job_id = ? AND technical_status = 'risky'),
      catch_all_rows = (SELECT COUNT(*) FROM email_verification_job_rows WHERE job_id = ? AND technical_status = 'catch_all'),
      delivered_rows = (SELECT COUNT(*) FROM email_verification_job_rows WHERE job_id = ? AND delivery_status = 'delivered'),
      pending_rows = (SELECT COUNT(*) FROM email_verification_job_rows WHERE job_id = ? AND delivery_status IN ('queued', 'sending', 'sent', 'pending')),
      opened_rows = (SELECT COUNT(*) FROM email_verification_job_rows WHERE job_id = ? AND open_count > 0),
      clicked_rows = (SELECT COUNT(*) FROM email_verification_job_rows WHERE job_id = ? AND click_count > 0),
      confirmed_rows = (SELECT COUNT(*) FROM email_verification_job_rows WHERE job_id = ? AND confirmation_status = 'confirmed_active'),
      bounced_rows = (SELECT COUNT(*) FROM email_verification_job_rows WHERE job_id = ? AND delivery_status IN ('soft_bounce', 'hard_bounce')),
      delayed_rows = (SELECT COUNT(*) FROM email_verification_job_rows WHERE job_id = ? AND delivery_status = 'delayed'),
      soft_bounce_rows = (SELECT COUNT(*) FROM email_verification_job_rows WHERE job_id = ? AND delivery_status = 'soft_bounce'),
      hard_bounce_rows = (SELECT COUNT(*) FROM email_verification_job_rows WHERE job_id = ? AND delivery_status = 'hard_bounce'),
      suppressed_rows = (SELECT COUNT(*) FROM email_verification_job_rows WHERE job_id = ? AND delivery_status = 'suppressed'),
      complaint_rows = (SELECT COUNT(*) FROM email_verification_job_rows WHERE job_id = ? AND delivery_status = 'complaint'),
      failed_rows = (SELECT COUNT(*) FROM email_verification_job_rows WHERE job_id = ? AND delivery_status = 'failed'),
      latest_event_at = COALESCE((SELECT MAX(latest_event_at) FROM email_verification_job_rows WHERE job_id = ?), latest_event_at),
      updated_at = ?
    WHERE id = ?
  `).bind(
    ...Array(18).fill(jobId),
    now,
    jobId
  ).run();
  const job = await db.prepare('SELECT * FROM email_verification_jobs WHERE id = ?').bind(jobId).first();
  if (!job) return null;
  if (!TERMINAL_JOB_STATUSES.has(job.status) && Number(job.processed_rows) >= Number(job.total_rows)) {
    await db.prepare(`
      UPDATE email_verification_jobs
      SET status = 'completed', completed_at = COALESCE(completed_at, ?), updated_at = ?
      WHERE id = ?
    `).bind(now, now, jobId).run();
    job.status = 'completed';
    job.completed_at = job.completed_at || now;
  } else if (job.status === 'processing' && Number(job.processed_rows) > Number(job.invalid_rows)) {
    await db.prepare("UPDATE email_verification_jobs SET status = 'partially_completed' WHERE id = ?").bind(jobId).run();
  }
  return job;
}

async function processInstantRow(db, job, row) {
  const result = await runTechnicalCheck(row.normalized_email);
  const fields = technicalFields(result);
  const suppressed = await suppressionForEmail(db, row.normalized_email);
  const delivered = await historicalDelivery(db, row.normalized_email);
  if (delivered && !suppressed && fields.technicalStatus !== 'undeliverable') {
    fields.confidenceScore = Math.min(99, fields.confidenceScore + 10);
    fields.scoreBreakdown.push({ signal: 'Historical successful delivery', points: 10 });
  }
  if (suppressed) {
    fields.technicalStatus = 'undeliverable';
    fields.confidenceScore = 0;
    fields.reason = `Suppressed after a previous ${String(suppressed.reason).replace(/_/g, ' ')}.`;
    fields.scoreBreakdown.push({ signal: 'Suppression history', points: 'score set to 0' });
  }
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE email_verification_job_rows
    SET technical_status = ?, confidence_score = ?, syntax_valid = ?, domain_valid = ?,
      mx_valid = ?, disposable = ?, role_based = ?, catch_all = ?, domain = ?,
      suggested_email = ?, smtp_status = ?, reason = ?, score_breakdown = ?,
      processed_at = ?, updated_at = ?, latest_event = 'technical_check',
      latest_event_at = ?
    WHERE id = ? AND job_id = ? AND processed_at IS NULL
  `).bind(
    fields.technicalStatus, fields.confidenceScore, fields.syntaxValid, fields.domainValid,
    fields.mxValid, fields.disposable, fields.roleBased, fields.catchAll, fields.domain,
    fields.suggestedEmail, fields.smtpStatus, fields.reason, JSON.stringify(fields.scoreBreakdown),
    now, now, now, row.id, job.id
  ).run();
}

async function shouldPauseSending(db, job, env) {
  const current = await db.prepare('SELECT * FROM email_verification_jobs WHERE id = ?').bind(job.id).first();
  const processed = Math.max(1, Number(current?.processed_rows || 0) - Number(current?.invalid_rows || 0));
  const hardBouncePercent = (Number(current?.hard_bounce_rows || 0) / processed) * 100;
  const complaintPercent = (Number(current?.complaint_rows || 0) / processed) * 100;
  const bounceLimit = Number(env.EMAIL_BOUNCE_PAUSE_PERCENT || 8);
  const complaintLimit = Number(env.EMAIL_COMPLAINT_STOP_PERCENT || 0.1);
  const dayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
  const global = await db.prepare(`
    SELECT COUNT(*) AS sent,
      SUM(CASE WHEN delivery_status = 'complaint' THEN 1 ELSE 0 END) AS complaints
    FROM email_verification_job_rows
    WHERE sent_at >= ?
  `).bind(dayStart).first();
  const globalComplaintPercent = Number(global?.sent || 0) > 0
    ? (Number(global?.complaints || 0) / Number(global.sent)) * 100
    : 0;
  if (globalComplaintPercent > complaintLimit) {
    return 'The global complaint safety threshold was exceeded. Sending is paused.';
  }
  if (complaintPercent > complaintLimit) return 'Complaint safety threshold exceeded.';
  if (processed >= 10 && hardBouncePercent > bounceLimit) return 'Hard-bounce safety threshold exceeded.';
  return null;
}

async function processConfirmationRow(db, job, row, env) {
  const pauseReason = await shouldPauseSending(db, job, env);
  if (pauseReason) {
    const now = new Date().toISOString();
    await db.prepare(`
      UPDATE email_verification_job_rows
      SET delivery_status = 'failed', technical_status = COALESCE(technical_status, 'unknown'),
        reason = ?, failed_at = ?, processed_at = ?, updated_at = ?,
        latest_event = 'safety_paused', latest_event_at = ?
      WHERE id = ? AND job_id = ? AND processed_at IS NULL
    `).bind(pauseReason, now, now, now, now, row.id, job.id).run();
    return;
  }

  const result = await runTechnicalCheck(row.normalized_email);
  const fields = technicalFields(result);
  const suppressed = await suppressionForEmail(db, row.normalized_email);
  const now = new Date().toISOString();
  if (suppressed || !result.syntax.valid || result.domain.valid !== true || result.mx.valid !== true) {
    await db.prepare(`
      UPDATE email_verification_job_rows
      SET technical_status = ?, delivery_status = ?, confidence_score = ?, syntax_valid = ?,
        domain_valid = ?, mx_valid = ?, disposable = ?, role_based = ?, catch_all = ?,
        domain = ?, suggested_email = ?, smtp_status = ?, reason = ?, score_breakdown = ?,
        processed_at = ?, updated_at = ?, latest_event = ?, latest_event_at = ?
      WHERE id = ? AND job_id = ? AND processed_at IS NULL
    `).bind(
      suppressed ? 'undeliverable' : fields.technicalStatus,
      suppressed ? 'suppressed' : 'not_sent',
      suppressed ? 0 : fields.confidenceScore,
      fields.syntaxValid, fields.domainValid, fields.mxValid, fields.disposable,
      fields.roleBased, fields.catchAll, fields.domain, fields.suggestedEmail,
      fields.smtpStatus,
      suppressed ? `Suppressed after a previous ${String(suppressed.reason).replace(/_/g, ' ')}.` : fields.reason,
      JSON.stringify(fields.scoreBreakdown), now, now,
      suppressed ? 'suppressed' : 'precheck_failed', now, row.id, job.id
    ).run();
    return;
  }

  const emailHash = await hashConfirmationToken(row.normalized_email, env.TOKEN_HASH_SECRET);
  const allowed = await claimRateLimit(
    db,
    `send-email:${emailHash}`,
    1,
    new Date(Date.now() + CONFIRMATION_TTL_MS).toISOString()
  );
  if (!allowed) {
    await db.prepare(`
      UPDATE email_verification_job_rows
      SET technical_status = ?, delivery_status = 'suppressed', confidence_score = ?,
        reason = 'A verification email was already sent to this address within the cooldown period.',
        processed_at = ?, updated_at = ?, latest_event = 'cooldown_suppressed', latest_event_at = ?
      WHERE id = ? AND job_id = ? AND processed_at IS NULL
    `).bind(fields.technicalStatus, fields.confidenceScore, now, now, now, row.id, job.id).run();
    return;
  }

  const domain = row.normalized_email.split('@')[1].toLowerCase();
  const perDomainLimit = envNumber(env, 'EMAIL_BULK_PER_DOMAIN_PER_MINUTE', 20, { max: 100 });
  const domainAllowed = await claimRateLimit(
    db,
    `bulk-domain:${domain}`,
    perDomainLimit,
    new Date(Date.now() + 60 * 1000).toISOString()
  );
  if (!domainAllowed) {
    const error = new Error('TRANSIENT_DOMAIN_THROTTLE');
    error.transient = true;
    throw error;
  }

  const { token, tokenHash } = await createConfirmationToken(env.TOKEN_HASH_SECRET);
  const expiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS).toISOString();
  const confirmUrl = `${env.PUBLIC_API_URL || 'https://multi-tool-backend.multitoolhub-api.workers.dev'}/api/email-verifier/confirm/${encodeURIComponent(token)}`;
  await db.prepare(`
    UPDATE email_verification_job_rows
    SET technical_status = ?, delivery_status = 'sending', confidence_score = ?,
      syntax_valid = ?, domain_valid = ?, mx_valid = ?, disposable = ?, role_based = ?,
      catch_all = ?, domain = ?, suggested_email = ?, smtp_status = ?, reason = ?,
      score_breakdown = ?, confirmation_token_hash = ?, confirmation_expires_at = ?,
      updated_at = ?, latest_event = 'sending', latest_event_at = ?
    WHERE id = ? AND job_id = ? AND processed_at IS NULL
  `).bind(
    fields.technicalStatus, fields.confidenceScore, fields.syntaxValid, fields.domainValid,
    fields.mxValid, fields.disposable, fields.roleBased, fields.catchAll, fields.domain,
    fields.suggestedEmail, fields.smtpStatus, 'Sending a permission-based confirmation email.',
    JSON.stringify(fields.scoreBreakdown), tokenHash, expiresAt, now, now, row.id, job.id
  ).run();

  try {
    const providerId = await sendWithResend({
      env,
      email: row.normalized_email,
      verificationId: row.id,
      jobRowId: row.id,
      confirmUrl,
    });
    const sentAt = new Date().toISOString();
    await db.prepare(`
      UPDATE email_verification_job_rows
      SET provider_email_id = ?, delivery_status = 'sent', sent_at = ?, processed_at = ?,
        updated_at = ?, latest_event = 'email.sent', latest_event_at = ?,
        reason = 'The verification email was accepted by the provider.'
      WHERE id = ? AND job_id = ?
    `).bind(providerId, sentAt, sentAt, sentAt, sentAt, row.id, job.id).run();
  } catch (error) {
    await db.prepare('DELETE FROM email_verification_rate_limits WHERE rate_key = ?')
      .bind(`send-email:${emailHash}`).run();
    throw error;
  }
}

async function mapWithConcurrency(items, concurrency, operation) {
  let cursor = 0;
  const errors = [];
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        await operation(items[index]);
      } catch (error) {
        errors.push(error);
      }
    }
  });
  await Promise.all(workers);
  if (errors.length > 0) throw errors[0];
}

export async function processEmailVerificationQueue(batch, env) {
  const db = getDb(env);
  if (!db) throw new Error('Email verification database binding is unavailable');
  for (const message of batch.messages) {
    const payload = message.body || {};
    if (payload.kind !== 'email_verification_bulk' || !payload.jobId || !Array.isArray(payload.rowIds)) {
      message.ack();
      continue;
    }
    if (payload.rowIds.length === 0) {
      message.ack();
      continue;
    }
    try {
      const job = await db.prepare('SELECT * FROM email_verification_jobs WHERE id = ?').bind(payload.jobId).first();
      if (!job || TERMINAL_JOB_STATUSES.has(job.status)) {
        message.ack();
        continue;
      }
      await db.prepare(`
        UPDATE email_verification_jobs SET status = 'processing', updated_at = ?
        WHERE id = ? AND status = 'queued'
      `).bind(new Date().toISOString(), job.id).run();
      const placeholders = payload.rowIds.map(() => '?').join(',');
      const result = await db.prepare(`
        SELECT * FROM email_verification_job_rows
        WHERE job_id = ? AND id IN (${placeholders}) AND processed_at IS NULL
        ORDER BY original_row_number
      `).bind(job.id, ...payload.rowIds).all();
      const rows = result.results || [];
      const limits = getBulkLimits(env, job.mode);
      await mapWithConcurrency(
        rows,
        job.mode === 'confirm_by_email' ? limits.concurrency : Math.min(10, limits.concurrency * 2),
        (row) => job.mode === 'confirm_by_email'
          ? processConfirmationRow(db, job, row, env)
          : processInstantRow(db, job, row)
      );
      await updateJobAggregates(db, job.id);
      message.ack();
    } catch (error) {
      console.error('Bulk email queue batch failed', {
        jobId: payload.jobId,
        attempt: payload.attempt,
        message: error?.message,
      });
      const currentAttempt = Number(message.attempts || payload.attempt || 1);
      const nextAttempt = currentAttempt + 1;
      if (error?.transient !== false && nextAttempt <= 4) {
        message.retry({ delaySeconds: Math.min(300, 2 ** nextAttempt * 5) });
      } else {
        const now = new Date().toISOString();
        await db.prepare(`
          UPDATE email_verification_job_rows
          SET technical_status = COALESCE(technical_status, 'precheck_failed'),
            delivery_status = CASE WHEN ? = 'confirm_by_email' THEN 'failed' ELSE delivery_status END,
            reason = 'Processing failed after the retry limit.', failed_at = ?,
            processed_at = COALESCE(processed_at, ?), updated_at = ?,
            latest_event = 'processing_failed', latest_event_at = ?
          WHERE job_id = ? AND id IN (${payload.rowIds.map(() => '?').join(',')})
            AND processed_at IS NULL
        `).bind(payload.mode, now, now, now, now, payload.jobId, ...payload.rowIds).run();
        await updateJobAggregates(db, payload.jobId);
        message.ack();
      }
    }
  }
}

export async function cleanupExpiredEmailVerificationJobs(env, now = new Date()) {
  const db = getDb(env);
  if (!db) return { deletedJobs: 0, deletedInvalidRows: 0, deletedEvents: 0 };
  const nowIso = now.toISOString();
  const invalidCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const eventCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const invalidResult = await db.prepare(`
    DELETE FROM email_verification_job_rows
    WHERE syntax_valid = 0 AND created_at < ?
  `).bind(invalidCutoff).run();
  const eventResult = await db.prepare(
    'DELETE FROM email_verification_events WHERE created_at < ?'
  ).bind(eventCutoff).run();
  const expired = await db.prepare(
    'SELECT id FROM email_verification_jobs WHERE expires_at <= ? LIMIT 100'
  ).bind(nowIso).all();
  let deletedJobs = 0;
  for (const row of expired.results || []) {
    await db.batch([
      db.prepare('DELETE FROM email_verification_events WHERE job_row_id IN (SELECT id FROM email_verification_job_rows WHERE job_id = ?)').bind(row.id),
      db.prepare('DELETE FROM email_verification_job_rows WHERE job_id = ?').bind(row.id),
      db.prepare('DELETE FROM email_verification_jobs WHERE id = ?').bind(row.id),
    ]);
    deletedJobs += 1;
  }
  return {
    deletedJobs,
    deletedInvalidRows: Number(invalidResult.meta?.changes || 0),
    deletedEvents: Number(eventResult.meta?.changes || 0),
  };
}

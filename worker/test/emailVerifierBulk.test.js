import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import {
  createReportWorkbook,
  createSampleTemplateWorkbook,
  detectEmailColumns,
  escapeCsvValue,
  escapeSpreadsheetValue,
  getBulkLimits,
  normalizeBulkEmail,
  normalizeColumnName,
  parseCsv,
  parseSpreadsheetBytes,
  prepareBulkRows,
  rowsToCsv,
  summaryFromJob,
} from '../src/emailVerifierBulk.js';

function csvBytes(value) {
  return new TextEncoder().encode(value);
}

function workbookBytes(bookType = 'xlsx') {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['email address', 'name', 'company'],
    ['employee1@example.com', 'Avery', 'Example'],
    ['employee2@example.org', 'Jordan', 'Example Org'],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Recipients');
  return new Uint8Array(XLSX.write(workbook, { type: 'array', bookType }));
}

test('normalizes email column aliases', () => {
  assert.equal(normalizeColumnName(' Work_Email '), 'workemail');
  assert.equal(normalizeColumnName('EMAIL-ID'), 'emailid');
  assert.deepEqual(detectEmailColumns(['Name', 'Official Email', 'Company']), {
    matches: ['Official Email'],
    selected: 'Official Email',
    requiresSelection: false,
  });
});

test('requires manual email-column selection for multiple or missing candidates', () => {
  assert.deepEqual(detectEmailColumns(['email', 'work_email']).matches, ['email', 'work_email']);
  assert.equal(detectEmailColumns(['email', 'work_email']).requiresSelection, true);
  assert.deepEqual(detectEmailColumns(['recipient', 'name']), {
    matches: [],
    selected: null,
    requiresSelection: true,
  });
});

test('CSV parser handles quotes, commas, newlines, blank rows, and a BOM', () => {
  const rows = parseCsv('\uFEFFemail,name\r\n"one@example.com","Doe, Jane"\r\n\r\n"two@example.org","Line 1\nLine 2"');
  assert.equal(rows.length, 3);
  assert.equal(rows[1][1], 'Doe, Jane');
  assert.equal(rows[2][1], 'Line 1\nLine 2');
});

test('parses CSV, XLS, and XLSX uploads', () => {
  const csv = parseSpreadsheetBytes(
    csvBytes('email,name\nemployee1@example.com,Avery'),
    'recipients.csv',
    'text/csv',
    10,
  );
  assert.deepEqual(csv.columns, ['email', 'name']);
  assert.equal(csv.records[0].originalRowNumber, 2);

  const xls = parseSpreadsheetBytes(workbookBytes('xls'), 'recipients.xls', 'application/vnd.ms-excel', 10);
  assert.equal(xls.columns[0], 'email address');
  assert.equal(xls.records.length, 2);

  const xlsx = parseSpreadsheetBytes(
    workbookBytes('xlsx'),
    'recipients.xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    10,
  );
  assert.equal(xlsx.columns[0], 'email address');
  assert.equal(xlsx.records.length, 2);
});

test('rejects unsupported files and configured row overflow', () => {
  assert.throws(
    () => parseSpreadsheetBytes(csvBytes('email\na@example.com'), 'recipients.txt', 'text/plain', 10),
    /csv, .xls, or .xlsx/i,
  );
  assert.throws(
    () => parseSpreadsheetBytes(
      csvBytes('email\na@example.com\nb@example.com\nc@example.com'),
      'recipients.csv',
      'text/csv',
      2,
    ),
    /row limit/i,
  );
});

test('bulk normalization preserves the local part and lowercases only the domain', () => {
  assert.equal(normalizeBulkEmail('  Case.Sensitive@EXAMPLE.COM\u200B '), 'Case.Sensitive@example.com');
  assert.equal(normalizeBulkEmail('bad\n@example.com'), '');
});

test('prepares rows, removes duplicates, and preserves invalid rows', () => {
  const columns = ['email', 'name', 'company', 'Custom'];
  const records = [
    { originalRowNumber: 2, values: { email: 'Case@EXAMPLE.COM', name: 'One', company: 'A', Custom: 'X' } },
    { originalRowNumber: 3, values: { email: 'Case@example.com', name: 'Duplicate', company: 'A', Custom: 'Y' } },
    { originalRowNumber: 4, values: { email: 'not-an-email', name: 'Invalid', company: 'B', Custom: 'Z' } },
  ];
  const prepared = prepareBulkRows(records, columns, 'email');
  assert.deepEqual(prepared.counts, { total: 3, valid: 1, invalid: 1, duplicates: 1 });
  assert.equal(prepared.rows.length, 2);
  assert.equal(prepared.rows[0].originalRowNumber, 2);
  assert.equal(prepared.rows[0].optionalData.Custom, 'X');
  assert.equal(prepared.rows[1].syntaxValid, false);
  assert.match(prepared.rows[1].reason, /malformed/i);
});

test('spreadsheet and CSV exports neutralize formula injection', () => {
  for (const value of ['=1+1', '+SUM(A1:A2)', '-2+3', '@cmd']) {
    assert.equal(escapeSpreadsheetValue(value).startsWith("'"), true);
    assert.equal(escapeCsvValue(value).startsWith("'"), true);
  }
  const csv = rowsToCsv(['email', 'reason'], [{ email: '=cmd', reason: 'has,comma' }]);
  assert.match(csv, /^\uFEFFemail,reason/);
  assert.match(csv, /'=cmd,"has,comma"/);
});

test('sample template contains both required worksheets and safe examples', () => {
  const workbook = createSampleTemplateWorkbook();
  assert.deepEqual(workbook.SheetNames, ['Email List', 'Instructions']);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Email List'], { header: 1 });
  assert.deepEqual(rows[0], ['email', 'name', 'company', 'department', 'designation', 'reference_id']);
  assert.equal(rows[1][0], 'employee1@example.com');
  assert.equal(rows[3][0], 'employee3@example.net');
});

test('bulk limits are configurable and mode-specific', () => {
  assert.equal(getBulkLimits({}, 'instant').maxRows, 5000);
  assert.equal(getBulkLimits({}, 'confirm_by_email').maxRows, 250);
  assert.equal(getBulkLimits({ EMAIL_BULK_SEND_MAX_ROWS: '75' }, 'confirm_by_email').maxRows, 75);
});

test('status summary reports real progress and separate event dimensions', () => {
  const summary = summaryFromJob({
    id: 'job_1',
    mode: 'instant',
    status: 'processing',
    total_rows: 100,
    processed_rows: 47,
    likely_deliverable_rows: 35,
    delivered_rows: 23,
    undeliverable_rows: 4,
    risky_rows: 5,
    catch_all_rows: 3,
    pending_rows: 12,
    opened_rows: 6,
    clicked_rows: 2,
    confirmed_rows: 1,
    failed_rows: 0,
  });
  assert.equal(summary.percentage, 47);
  assert.equal(summary.delivered, 23);
  assert.equal(summary.openDetected, 6);
  assert.equal(summary.confirmed, 1);
});

test('Excel report contains five required sheets and escaped row values', () => {
  const job = {
    id: 'job_report',
    mode: 'instant',
    status: 'completed',
    original_filename: '=unsafe.xlsx',
    email_column: 'email',
    total_rows: 1,
    valid_rows: 1,
    invalid_rows: 0,
    duplicate_rows: 0,
    processed_rows: 1,
    retention_days: 30,
    processing_limits: '{}',
    created_at: '2026-07-25T00:00:00.000Z',
    started_at: '2026-07-25T00:00:01.000Z',
    completed_at: '2026-07-25T00:00:02.000Z',
    updated_at: '2026-07-25T00:00:02.000Z',
  };
  const rows = [{
    original_row_number: 2,
    normalized_email: '=unsafe@example.com',
    syntax_valid: 1,
    technical_status: 'likely_deliverable',
    delivery_status: 'not_sent',
    engagement_status: 'no_open_detected',
    confirmation_status: 'not_confirmed',
    confidence_score: 65,
  }];
  const workbook = createReportWorkbook(job, rows);
  assert.deepEqual(workbook.SheetNames, [
    'Summary', 'Results', 'Invalid Rows', 'Status Guide', 'Job Information',
  ]);
  const resultRows = XLSX.utils.sheet_to_json(workbook.Sheets.Results, { header: 1 });
  assert.equal(resultRows[1][1], "'=unsafe@example.com");
});

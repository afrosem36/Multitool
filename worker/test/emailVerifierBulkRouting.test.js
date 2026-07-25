import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/index.js';

test('bulk job preflight allows the capability-token header', async () => {
  const response = await worker.fetch(
    new Request('http://127.0.0.1:8787/api/email-verifier/bulk/job_test/status', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'x-email-job-token',
      },
    }),
    {},
    {},
  );
  assert.equal(response.status, 204);
  assert.match(response.headers.get('Access-Control-Allow-Headers') || '', /X-Email-Job-Token/i);
  assert.match(response.headers.get('Access-Control-Allow-Methods') || '', /DELETE/);
});

test('sample template route returns an XLSX attachment without database access', async () => {
  const response = await worker.fetch(
    new Request('http://127.0.0.1:8787/api/email-verifier/template.xlsx'),
    {},
    {},
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Type') || '', /spreadsheetml/);
  assert.match(response.headers.get('Content-Disposition') || '', /email-verifier-sample\.xlsx/);
  assert.equal((await response.arrayBuffer()).byteLength > 1000, true);
});

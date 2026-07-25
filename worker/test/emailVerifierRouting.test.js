import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/index.js';

const SEND_URL = 'http://127.0.0.1:8787/api/email-verifier/send';

test('OPTIONS email verifier send returns 204 with CORS methods', async () => {
  const response = await worker.fetch(new Request(SEND_URL, {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:5173' },
  }), {}, {});

  assert.equal(response.status, 204);
  assert.match(response.headers.get('Access-Control-Allow-Methods'), /POST/);
  assert.equal(await response.text(), '');
});

test('POST email verifier send reaches the handler instead of returning 405', async () => {
  const response = await worker.fetch(new Request(SEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      consent: false,
    }),
  }), {
    multitool_db: {},
    TOKEN_HASH_SECRET: 'routing-test-secret',
  }, {});
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.code, 'CONSENT_REQUIRED');
});

test('unsupported email verifier send methods return structured 405', async () => {
  const response = await worker.fetch(new Request(SEND_URL, {
    method: 'GET',
  }), {}, {});
  const body = await response.json();

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'POST, OPTIONS');
  assert.deepEqual(body, {
    success: false,
    code: 'METHOD_NOT_ALLOWED',
    message: 'Method not allowed',
  });
});

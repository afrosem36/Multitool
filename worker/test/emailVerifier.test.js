import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import {
  applySmtpEvidence,
  calculateTechnicalResult,
  checkDomain,
  claimWebhookEvent,
  createConfirmationToken,
  hashConfirmationToken,
  inspectAddress,
  isConfirmationExpired,
  isSendRateLimited,
  isTurnstileResultValid,
  mapResendEvent,
  normalizeEmail,
  reduceDeliveryStatus,
  validateEmailSyntax,
  verifyResendWebhookSignature,
} from '../src/emailVerifier.js';

test('normalizes and accepts valid email syntax', () => {
  assert.equal(normalizeEmail('  Person+tag@Example.COM '), 'person+tag@example.com');
  assert.equal(validateEmailSyntax('person+tag@example.com'), true);
});

test('rejects invalid email syntax', () => {
  for (const email of ['plainaddress', 'a@@example.com', '.a@example.com', 'a..b@example.com', 'a@example']) {
    assert.equal(validateEmailSyntax(email), false, email);
  }
});

test('detects disposable, role-based, and mistyped domains', () => {
  assert.equal(inspectAddress('user@mailinator.com').disposable, true);
  assert.equal(inspectAddress('support@example.com').roleBased, true);
  assert.equal(inspectAddress('user@gmial.com').suggestedEmail, 'user@gmail.com');
});

test('detects a domain with MX records', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ Status: 0, Answer: [{ type: 15, data: '10 mx.example.com.' }] }),
  });
  const result = await checkDomain('example.com', fetchImpl);
  assert.equal(result.domainValid, true);
  assert.equal(result.mxValid, true);
});

test('detects a domain without MX records', async () => {
  const fetchImpl = async (url) => ({
    ok: true,
    json: async () => url.includes('type=MX')
      ? ({ Status: 0, Answer: [] })
      : ({ Status: 3, Answer: [] }),
  });
  const result = await checkDomain('missing.example', fetchImpl);
  assert.equal(result.domainValid, false);
  assert.equal(result.mxValid, false);
});

test('SMTP timeout and blocking never turn a likely address invalid', () => {
  const base = calculateTechnicalResult(inspectAddress('person@example.com'), {
    domainValid: true,
    mxValid: true,
    dnsStatus: 'completed',
  });
  assert.equal(applySmtpEvidence(base, 'timeout').status, 'likely_deliverable');
  assert.equal(applySmtpEvidence(base, 'blocked').status, 'likely_deliverable');
});

test('maps delivery, hard bounce, and complaint webhooks', () => {
  assert.deepEqual(mapResendEvent('email.delivered'), { status: 'delivered', deliveryStatus: 'delivered' });
  assert.deepEqual(mapResendEvent('email.bounced'), { status: 'undeliverable', deliveryStatus: 'hard_bounce' });
  assert.deepEqual(mapResendEvent('email.complained'), { status: 'complaint', deliveryStatus: 'complaint' });
  assert.deepEqual(mapResendEvent('email.opened'), {
    status: null,
    deliveryStatus: null,
    engagementStatus: 'open_detected',
  });
  assert.deepEqual(mapResendEvent('email.clicked'), {
    status: null,
    deliveryStatus: null,
    engagementStatus: 'click_detected',
  });
  assert.deepEqual(mapResendEvent('email.failed'), { status: 'unknown', deliveryStatus: 'failed' });
  assert.deepEqual(mapResendEvent('email.suppressed'), { status: 'undeliverable', deliveryStatus: 'suppressed' });
});

test('delivery reducer protects terminal and stronger out-of-order states', () => {
  assert.equal(reduceDeliveryStatus('delivered', 'email.sent'), 'delivered');
  assert.equal(reduceDeliveryStatus('hard_bounce', 'email.delivered'), 'hard_bounce');
  assert.equal(reduceDeliveryStatus('complaint', 'email.sent'), 'complaint');
  assert.equal(reduceDeliveryStatus('sent', 'email.delivery_delayed'), 'delayed');
  assert.equal(reduceDeliveryStatus('sent', 'email.bounced', 'soft'), 'soft_bounce');
  assert.equal(reduceDeliveryStatus('sent', 'email.bounced', 'hard'), 'hard_bounce');
});

test('creates a secure confirmation token and stores a hash instead of raw token', async () => {
  const secret = 'test-secret';
  const first = await createConfirmationToken(secret);
  const second = await createConfirmationToken(secret);
  assert.notEqual(first.token, first.tokenHash);
  assert.notEqual(first.token, second.token);
  assert.equal(first.tokenHash, await hashConfirmationToken(first.token, secret));
});

test('detects expired confirmation tokens', () => {
  assert.equal(isConfirmationExpired('2025-01-01T00:00:00.000Z', Date.parse('2025-01-02T00:00:00.000Z')), true);
  assert.equal(isConfirmationExpired('2025-01-03T00:00:00.000Z', Date.parse('2025-01-02T00:00:00.000Z')), false);
});

test('enforces per-email and per-IP send limits', () => {
  assert.equal(isSendRateLimited({ emailSentWithinDay: true, ipSendsWithinHour: 0 }).limited, true);
  assert.equal(isSendRateLimited({ emailSentWithinDay: false, ipSendsWithinHour: 5 }).limited, true);
  assert.equal(isSendRateLimited({ emailSentWithinDay: false, ipSendsWithinHour: 4 }).limited, false);
});

test('accepts Cloudflare always-pass test results only with the matching test secret', () => {
  const dummyResult = {
    success: true,
    hostname: 'example.com',
    action: undefined,
    'error-codes': [],
  };
  assert.equal(isTurnstileResultValid(dummyResult, {
    TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
  }), true);
  assert.equal(isTurnstileResultValid(dummyResult, {
    TURNSTILE_SECRET_KEY: 'production-secret',
  }), false);
});

test('production Turnstile results require the expected action and an allowed hostname', () => {
  const env = {
    TURNSTILE_SECRET_KEY: 'production-secret',
    TURNSTILE_ALLOWED_HOSTNAMES: 'multitool.space,www.multitool.space',
  };
  assert.equal(isTurnstileResultValid({
    success: true,
    hostname: 'multitool.space',
    action: 'email_verifier_send',
  }, env), true);
  assert.equal(isTurnstileResultValid({
    success: true,
    hostname: 'www.multitoolhub.space',
    action: 'email_verifier_send',
  }, {
    ...env,
    TURNSTILE_ALLOWED_HOSTNAMES:
      'multitoolhub.space,www.multitoolhub.space,multitool.space,www.multitool.space',
  }), true);
  assert.equal(isTurnstileResultValid({
    success: true,
    hostname: 'attacker.example',
    action: 'email_verifier_send',
  }, env), false);
  assert.equal(isTurnstileResultValid({
    success: true,
    hostname: 'multitool.space',
    action: 'email_verifier_bulk_send',
  }, env, 'email_verifier_bulk_send'), true);
});

test('duplicate webhook events are not claimed twice', async () => {
  const ids = new Set();
  const db = {
    prepare: () => ({
      bind: (eventId) => ({
        run: async () => {
          const duplicate = ids.has(eventId);
          ids.add(eventId);
          return { meta: { changes: duplicate ? 0 : 1 } };
        },
      }),
    }),
  };
  assert.equal(await claimWebhookEvent(db, 'event-1', 'email.delivered'), true);
  assert.equal(await claimWebhookEvent(db, 'event-1', 'email.delivered'), false);
});

test('verifies valid webhook signatures and rejects invalid ones', async () => {
  const secretBytes = Buffer.from('webhook-secret');
  const secret = `whsec_${secretBytes.toString('base64')}`;
  const payload = '{"type":"email.delivered"}';
  const id = 'msg_test';
  const timestamp = '1700000000';
  const signature = createHmac('sha256', secretBytes)
    .update(`${id}.${timestamp}.${payload}`)
    .digest('base64');
  const headers = { id, timestamp, signature: `v1,${signature}` };
  assert.equal(await verifyResendWebhookSignature(payload, headers, secret, 1700000000), true);
  assert.equal(await verifyResendWebhookSignature(`${payload}x`, headers, secret, 1700000000), false);
});

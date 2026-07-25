import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { Hono } from 'hono';
import { registerEmailVerifierRoutes } from '../src/emailVerifier.js';

function createCheckedDb({ bulk = false } = {}) {
  const statements = [];
  return {
    statements,
    prepare(sql) {
      const compact = String(sql).replace(/\s+/g, ' ').trim();
      return {
        bind(...bindings) {
          const placeholders = (compact.match(/\?/g) || []).length;
          assert.equal(
            bindings.length,
            placeholders,
            `SQL binding mismatch (${bindings.length} bindings for ${placeholders} placeholders): ${compact}`,
          );
          statements.push({ sql: compact, bindings });
          return {
            async run() {
              return { meta: { changes: 1 } };
            },
            async first() {
              if (compact.includes('FROM email_verifications') && compact.includes('provider_message_id')) {
                if (bulk) return null;
                return {
                  id: 'verification_1',
                  normalized_email: 'safe@example.com',
                  provider_message_id: 'provider_1',
                  status: 'pending',
                  technical_status: 'likely_deliverable',
                  delivery_status: 'sent',
                  engagement_status: 'no_open_detected',
                  confirmation_status: 'not_confirmed',
                  confidence_score: 65,
                  open_count: 0,
                  click_count: 0,
                  reason: 'Sent.',
                };
              }
              if (compact.includes('FROM email_verification_job_rows')) {
                if (!bulk) return null;
                return {
                  id: 'job_row_1',
                  job_id: 'job_1',
                  normalized_email: 'safe@example.com',
                  provider_email_id: 'provider_1',
                  technical_status: 'likely_deliverable',
                  delivery_status: 'sent',
                  engagement_status: 'no_open_detected',
                  confirmation_status: 'not_confirmed',
                  confidence_score: 65,
                  open_count: 0,
                  click_count: 0,
                  reason: 'Sent.',
                };
              }
              return null;
            },
          };
        },
      };
    },
  };
}

function signedWebhook(type, eventId) {
  const secretBytes = Buffer.from('route-webhook-secret');
  const secret = `whsec_${secretBytes.toString('base64')}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const payload = JSON.stringify({
    type,
    created_at: new Date().toISOString(),
    data: {
      email_id: 'provider_1',
      tags: [{ name: 'verification_id', value: 'verification_1' }],
      ...(type === 'email.bounced' ? { bounce: { type: 'hard', message: 'Mailbox rejected' } } : {}),
    },
  });
  const signature = createHmac('sha256', secretBytes)
    .update(`${eventId}.${timestamp}.${payload}`)
    .digest('base64');
  return {
    payload,
    secret,
    headers: {
      'content-type': 'application/json',
      'svix-id': eventId,
      'svix-timestamp': timestamp,
      'svix-signature': `v1,${signature}`,
    },
  };
}

for (const [type, id] of [
  ['email.delivered', 'event-delivered'],
  ['email.opened', 'event-opened'],
  ['email.clicked', 'event-clicked'],
  ['email.bounced', 'event-bounced'],
  ['email.failed', 'event-failed'],
  ['email.suppressed', 'event-suppressed'],
  ['email.complained', 'event-complained'],
]) {
  test(`signed ${type} webhook reaches the dimension-safe update`, async () => {
    const app = new Hono();
    registerEmailVerifierRoutes(app);
    const db = createCheckedDb();
    const webhook = signedWebhook(type, id);
    const response = await app.fetch(
      new Request('https://worker.example/api/email-verifier/webhooks/resend', {
        method: 'POST',
        headers: webhook.headers,
        body: webhook.payload,
      }),
      {
        multitool_db: db,
        RESEND_WEBHOOK_SECRET: webhook.secret,
      },
    );
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.deepEqual(body, { received: true });
    assert.equal(db.statements.some(({ sql }) => sql.startsWith('UPDATE email_verifications')), true);
  });
}

test('invalid webhook signature is rejected before database mutation', async () => {
  const app = new Hono();
  registerEmailVerifierRoutes(app);
  const db = createCheckedDb();
  const response = await app.fetch(
    new Request('https://worker.example/api/email-verifier/webhooks/resend', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'svix-id': 'bad-event',
        'svix-timestamp': String(Math.floor(Date.now() / 1000)),
        'svix-signature': 'v1,invalid',
      },
      body: '{"type":"email.delivered"}',
    }),
    { multitool_db: db, RESEND_WEBHOOK_SECRET: 'whsec_dGVzdA==' },
  );
  assert.equal(response.status, 401);
  assert.equal(db.statements.length, 0);
});

for (const [type, id] of [
  ['email.delivered', 'bulk-event-delivered'],
  ['email.opened', 'bulk-event-opened'],
  ['email.clicked', 'bulk-event-clicked'],
  ['email.complained', 'bulk-event-complained'],
]) {
  test(`signed ${type} webhook updates a bulk row and job counters`, async () => {
    const app = new Hono();
    registerEmailVerifierRoutes(app);
    const db = createCheckedDb({ bulk: true });
    const webhook = signedWebhook(type, id);
    const response = await app.fetch(
      new Request('https://worker.example/api/email-verifier/webhooks/resend', {
        method: 'POST',
        headers: webhook.headers,
        body: webhook.payload,
      }),
      { multitool_db: db, RESEND_WEBHOOK_SECRET: webhook.secret },
    );
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(db.statements.some(({ sql }) => sql.startsWith('UPDATE email_verification_job_rows')), true);
    assert.equal(db.statements.some(({ sql }) => sql.startsWith('UPDATE email_verification_jobs')), true);
  });
}

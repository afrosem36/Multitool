# Email Verifier deployment

The Email Verifier uses the Vite frontend, the `multi-tool-backend` Cloudflare
Worker, the `multitool-db` D1 database, Cloudflare Queues, Turnstile, and
Resend. The bulk uploader parses the source file in memory and never stores the
uploaded file in R2. Only normalized job rows and results are retained.

## Architecture and safety

The two bulk workflows are deliberately separated:

- Bulk Instant Check performs syntax, DNS, MX, disposable, role, typo,
  suppression, historical-delivery, catch-all-when-known, and confidence
  classification. It never sends mail.
- Bulk Confirm by Email prechecks first, excludes invalid/suppressed rows,
  requires consent and Turnstile, then queues fixed branded messages in
  controlled batches. Uploading never starts a send.

The frontend receives a one-time job access token after upload. D1 stores only
its HMAC hash. Every status, result, export, cancel, and delete request must send
the token in `X-Email-Job-Token`. Queue messages contain job and row IDs, never
raw uploaded lists or secrets.

## 1. Install and test

Use `worker/wrangler.toml` as the authoritative backend configuration. Do not
deploy this backend from the root `wrangler.jsonc`.

```sh
cd worker
npm install
npm test
npx wrangler deploy --dry-run --config wrangler.toml
```

The Worker uses the current official SheetJS tarball declared in
`worker/package.json`, rather than the stale public npm registry release.

## 2. Create Cloudflare Queues

Create the processing queue and its dead-letter queue once:

```sh
cd worker
npx wrangler queues create email-verification-jobs
npx wrangler queues create email-verification-jobs-dlq
```

`worker/wrangler.toml` binds the same queue as producer and consumer:

- producer binding: `EMAIL_VERIFICATION_QUEUE`
- consumer batch: one queue message; each message contains 25 Instant rows or
  10 Confirm rows by default
- consumer concurrency: one Worker invocation
- email concurrency inside a message: five
- maximum retries: four, then the dead-letter queue

This intentionally favors sender reputation over throughput. Monitor with:

```sh
npx wrangler tail --config wrangler.toml
npx wrangler queues list
```

## 3. Apply the additive D1 migration

Migration `017_email_verifier_bulk.sql` adds job, row, event-history,
suppression, engagement, and provider-time cursor fields. It does not modify
the already-applied migration 016.

Local:

```sh
npx wrangler d1 migrations apply multitool-db --local --config wrangler.toml
```

Production:

```sh
npx wrangler d1 migrations apply multitool-db --remote --config wrangler.toml
```

Apply the production migration before deploying the Worker or exposing the bulk
frontend. D1 migrations are forward-only; rollback leaves the additive tables
in place.

## 4. Configure Worker secrets and variables

Set secrets interactively:

```sh
npx wrangler secret put RESEND_API_KEY --config wrangler.toml
npx wrangler secret put RESEND_WEBHOOK_SECRET --config wrangler.toml
npx wrangler secret put TURNSTILE_SECRET_KEY --config wrangler.toml
npx wrangler secret put TOKEN_HASH_SECRET --config wrangler.toml
```

`TOKEN_HASH_SECRET` must be long, random, private, and stable. Changing it
invalidates active confirmation links and bulk access tokens.

Required non-secret production values are in `worker/wrangler.toml`:

```text
FRONTEND_URL=https://www.multitoolhub.space
PUBLIC_API_URL=https://multi-tool-backend.multitoolhub-api.workers.dev
EMAIL_VERIFIER_FROM=Email Verifier <verification@mail.multitoolhub.space>
TURNSTILE_ALLOWED_HOSTNAMES=multitoolhub.space,www.multitoolhub.space
```

Bulk safety variables:

```text
EMAIL_INSTANT_TURNSTILE_THRESHOLD=10
EMAIL_INSTANT_HOURLY_LIMIT=30
EMAIL_INSTANT_DAILY_LIMIT=100
EMAIL_BULK_INSTANT_MAX_ROWS=5000
EMAIL_BULK_SEND_MAX_ROWS=250
EMAIL_BULK_MAX_FILE_MB=10
EMAIL_BULK_SEND_DAILY_LIMIT=1000
EMAIL_BULK_BATCH_SIZE=25
EMAIL_BULK_SEND_BATCH_SIZE=10
EMAIL_BULK_SEND_CONCURRENCY=5
EMAIL_BULK_INSTANT_TURNSTILE_ROWS=100
EMAIL_BULK_INSTANT_IP_HOURLY_LIMIT=10
EMAIL_BULK_INSTANT_IP_DAILY_LIMIT=20000
EMAIL_BULK_SEND_IP_HOURLY_LIMIT=2
EMAIL_BULK_SEND_IP_DAILY_LIMIT=500
EMAIL_BULK_PER_DOMAIN_PER_MINUTE=20
EMAIL_JOB_RETENTION_DAYS=30
EMAIL_BOUNCE_PAUSE_PERCENT=8
EMAIL_COMPLAINT_STOP_PERCENT=0.1
```

The complaint threshold is a percentage; `0.1` means 0.1%. The hard-bounce
threshold is evaluated after at least ten processed recipients. Complaints,
hard bounces, and provider suppressions are written to the suppression table
and never retried automatically.

## 5. Configure Turnstile and Vercel

Create a Turnstile widget allowing `multitoolhub.space` and
`www.multitoolhub.space`. Vercel needs only public frontend values:

```text
VITE_API_URL=https://multi-tool-backend.multitoolhub-api.workers.dev
VITE_TURNSTILE_SITE_KEY=<public-site-key>
```

The secret key belongs only in Worker secrets. Actions validated by the Worker:

- `email_verifier_instant` after the adaptive single-check threshold
- `email_verifier_send` for single Confirm by Email
- `email_verifier_bulk_instant` for thresholded bulk Instant jobs
- `email_verifier_bulk_send` for every bulk Confirm job

## 6. Configure Resend sending, tracking, and webhooks

Verify the sending domain `mail.multitoolhub.space`; the fixed sender is:

```text
Email Verifier <verification@mail.multitoolhub.space>
```

Enable open and click tracking in Resend:

1. Open **Domains** and select `mail.multitoolhub.space`.
2. Open **Configuration**.
3. Under **Enable tracking metrics**, click **Configure**.
4. Choose a tracking subdomain, enable both open and click tracking, and click
   **Add domain**.
5. Add the CNAME record Resend provides to Cloudflare DNS. Add the additional
   CAA record if Resend displays one.
6. Return to Resend, click **I've added the records**, and wait for verification.

Do not remove an old verified tracking DNS record; previously sent tracked
links depend on it.

Create one webhook pointing to:

```text
https://multi-tool-backend.multitoolhub-api.workers.dev/api/email-verifier/webhooks/resend
```

Subscribe to:

- `email.sent`
- `email.delivered`
- `email.delivery_delayed`
- `email.bounced`
- `email.failed`
- `email.suppressed`
- `email.opened`
- `email.clicked`
- `email.complained`

The Worker verifies the Svix signature, deduplicates provider event IDs, uses
provider timestamps, stores a redacted event history, and preserves terminal
states when events arrive out of order. Open tracking is an estimate, not proof
of a human read; the unique secure confirmation link is the strongest signal.

## 7. Local development

Copy `worker/.dev.vars.example` to `worker/.dev.vars` and fill real local
secrets. For deterministic local Turnstile testing only, use Cloudflare's
matching always-pass test site/secret pair.

```sh
cd worker
npx wrangler d1 migrations apply multitool-db --local --config wrangler.toml
npm run dev
```

In a second terminal:

```sh
cd ..
npm run dev:client
```

The local Worker is fixed to `http://127.0.0.1:8787`; set
`VITE_API_URL=http://127.0.0.1:8787`. Wrangler simulates Queue consumers
locally. Test retention cleanup with:

```sh
npx wrangler dev --test-scheduled --config wrangler.toml
curl "http://127.0.0.1:8787/__scheduled?cron=17+3+*+*+*"
```

Use only addresses you control, Resend test recipients, and reserved
`example.com`, `example.org`, or `example.net` data for no-send parsing tests.
Never send real test messages to uninvolved recipients.

## 8. Production deploy and verification

Deploy in this order:

```sh
cd worker
npm test
npx wrangler d1 migrations apply multitool-db --remote --config wrangler.toml
npm run deploy

cd ..
npm install
npm run build
npm run deploy:frontend
```

Verify:

1. Single Instant Check normally shows no Turnstile and sends no mail.
2. Single Confirm is blocked without consent or Turnstile.
3. CSV, XLS, and XLSX uploads show a server-authoritative preview and never
   start automatically.
4. Ambiguous files require manual email-column selection.
5. Bulk Instant progresses from real Queue/D1 counts and sends no mail.
6. Bulk Confirm displays its send count, warning, consent, final action, and
   Turnstile before queuing.
7. Status, search, filters, pagination, CSV, Excel, cancel, and delete require
   the job token.
8. Delivered, opened, clicked, confirmed, delayed, bounce, suppression,
   complaint, and failed events remain separate.
9. Replaying a webhook is acknowledged without applying it twice.
10. Formula-like uploaded values beginning with `=`, `+`, `-`, or `@` are
    neutralized in CSV and Excel exports.

## 9. Retention and cleanup

The daily UTC cron in `worker/wrangler.toml` invokes the scheduled cleanup:

- source files: never persisted; released immediately after parsing
- invalid rows: seven days
- jobs and result rows: 30 days by default
- redacted webhook event history: 30 days
- confirmation tokens: 24 hours

Deleting a job removes its rows and related event history. Logs include job IDs
and failure classes, never raw lists, secrets, confirmation tokens, or full
webhook payloads.

## 10. Rollback

If production validation fails:

1. Roll the Vercel frontend back to the previous deployment so users cannot
   create new bulk jobs.
2. Pause `email-verification-jobs` in Cloudflare Queues if sending must stop
   immediately.
3. Deploy the previous Worker version.
4. Keep migration 017 applied; it is additive and old code ignores the tables.
5. Do not purge the queue until retained jobs have been inspected. Resume it
   only after the fixed Worker is deployed.
6. If sender reputation is at risk, disable the Resend API key or lower
   `EMAIL_BULK_SEND_DAILY_LIMIT` before resuming.

Direct SMTP probing remains intentionally unavailable from Cloudflare. That
absence is shown as an unavailable signal and never treated as proof that an
address is invalid.

# Email Verifier deployment

The Email Verifier uses the existing Vite frontend, Cloudflare Worker, and
`multitool-db` D1 database. Resend sends the one-time confirmation message and
Cloudflare Turnstile protects only the send action. Instant checks never send
mail.

## 1. Prepare the sending domain

In Resend, add and verify `mail.multitoolhub.space`, then publish the DNS records
Resend supplies in Cloudflare DNS. The production sender defaults to:

`Email Verifier <verification@mail.multitoolhub.space>`

Create a Resend webhook for:

- `email.sent`
- `email.delivered`
- `email.bounced`
- `email.delivery_delayed`
- `email.complained`

Point it to:

`https://<worker-domain>/api/email-verifier/webhooks/resend`

Keep the webhook signing secret; it begins with `whsec_`.

## 2. Configure Cloudflare secrets

From the `worker` directory, set each secret interactively:

```sh
npx wrangler secret put RESEND_API_KEY --config wrangler.toml
npx wrangler secret put RESEND_WEBHOOK_SECRET --config wrangler.toml
npx wrangler secret put TURNSTILE_SECRET_KEY --config wrangler.toml
npx wrangler secret put TOKEN_HASH_SECRET --config wrangler.toml
```

`TOKEN_HASH_SECRET` should be a long cryptographically random value and must be
kept stable. Changing it invalidates unexpired confirmation links and changes
requester-IP hashes.

Set these non-secret Worker variables in the Cloudflare dashboard or
`wrangler.toml` for the production environment:

```text
FRONTEND_URL=https://multitool.space
PUBLIC_API_URL=https://<worker-domain>
EMAIL_VERIFIER_FROM=Email Verifier <verification@mail.multitoolhub.space>
TURNSTILE_ALLOWED_HOSTNAMES=multitoolhub.space,www.multitoolhub.space,multitool.space,www.multitool.space
```

Create a Turnstile widget for `multitoolhub.space`. Add its public site key to the
frontend deployment as:

```text
VITE_TURNSTILE_SITE_KEY=<public-site-key>
VITE_API_URL=https://<worker-domain>
```

The Turnstile secret key belongs only in the Worker secrets.

## 3. Apply D1 and deploy

```sh
cd worker
npm install
npm test
npm run migrate
npm run deploy
```

Then deploy the frontend using the existing project command:

```sh
cd ..
npm install
npm run build
npm run deploy:frontend
```

Apply the D1 migration before exposing the frontend route. Configure the Resend
webhook after the Worker route is live.

## 4. Production verification

1. Run an Instant Check and confirm no email is sent.
2. Use a Resend test/sandbox recipient where supported; do not use an address
   belonging to an uninvolved person.
3. Confirm the send action is blocked without consent or Turnstile.
4. Confirm the status endpoint moves only in response to Resend events.
5. Open the confirmation link and verify the status becomes `Confirmed Active`
   with confidence 100.
6. Replay a webhook and verify it is acknowledged as a duplicate without
   changing the record twice.
7. Verify complaint and hard-bounce recipients cannot receive another
   verification email.

Direct SMTP mailbox probing is intentionally not performed from Cloudflare.
The interface reports it as unavailable, and a timeout or blocked probe is
never treated as proof that an address is invalid.

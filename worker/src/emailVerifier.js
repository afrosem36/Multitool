const EMAIL_MAX_LENGTH = 254;
const LOCAL_MAX_LENGTH = 64;
const CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000;
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
const TURNSTILE_ALWAYS_PASS_TEST_SECRET = '1x0000000000000000000000000000000AA';

const ROLE_LOCAL_PARTS = new Set([
  'admin', 'billing', 'contact', 'help', 'info', 'marketing', 'office',
  'postmaster', 'sales', 'security', 'support', 'team', 'webmaster',
]);

const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com', 'dispostable.com', 'fakeinbox.com', 'getnada.com',
  'guerrillamail.com', 'guerrillamail.net', 'maildrop.cc', 'mailinator.com',
  'mintemail.com', 'mohmal.com', 'sharklasers.com', 'temp-mail.org',
  'tempmail.com', 'throwawaymail.com', 'trashmail.com', 'yopmail.com',
]);

const DOMAIN_CORRECTIONS = new Map([
  ['gamil.com', 'gmail.com'],
  ['gmai.com', 'gmail.com'],
  ['gmail.co', 'gmail.com'],
  ['gmial.com', 'gmail.com'],
  ['hotnail.com', 'hotmail.com'],
  ['hotmai.com', 'hotmail.com'],
  ['outlok.com', 'outlook.com'],
  ['outllook.com', 'outlook.com'],
  ['yaho.com', 'yahoo.com'],
  ['yahoo.co', 'yahoo.com'],
]);

const STATUS_LABELS = {
  confirmed: 'Confirmed Active',
  delivered: 'Delivered',
  likely_deliverable: 'Likely Deliverable',
  undeliverable: 'Undeliverable',
  catch_all: 'Catch-All',
  risky: 'Risky',
  delayed: 'Delayed',
  pending: 'Pending',
  unknown: 'Unknown',
  complaint: 'Complaint',
  precheck_failed: 'Precheck Failed',
};

function jsonError(c, message, status = 400, code = 'BAD_REQUEST') {
  return c.json({ error: message, code }, status);
}

export function normalizeEmail(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  const at = raw.lastIndexOf('@');
  if (at <= 0) return raw;
  return `${raw.slice(0, at).toLowerCase()}@${raw.slice(at + 1).toLowerCase()}`;
}

export function validateEmailSyntax(value) {
  const email = normalizeEmail(value);
  if (!email || email.length > EMAIL_MAX_LENGTH || /[\s<>()\[\]\\,;:"]/.test(email)) {
    return false;
  }
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length > LOCAL_MAX_LENGTH || local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    return false;
  }
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return false;
  if (!domain || domain.length > 253 || domain.includes('..')) return false;
  const labels = domain.split('.');
  return labels.length >= 2 && labels.every((label) =>
    label.length > 0 &&
    label.length <= 63 &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
  );
}

export function inspectAddress(email) {
  const normalizedEmail = normalizeEmail(email);
  const [localPart = '', domain = ''] = normalizedEmail.split('@');
  const suggestedDomain = DOMAIN_CORRECTIONS.get(domain) || null;
  return {
    normalizedEmail,
    localPart,
    domain,
    syntaxValid: validateEmailSyntax(normalizedEmail),
    disposable: DISPOSABLE_DOMAINS.has(domain),
    roleBased: ROLE_LOCAL_PARTS.has(localPart),
    suggestedEmail: suggestedDomain ? `${localPart}@${suggestedDomain}` : null,
  };
}

async function resolveDns(name, type, fetchImpl = fetch) {
  const response = await fetchImpl(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
    { headers: { Accept: 'application/dns-json' } }
  );
  if (!response.ok) throw new Error('DNS lookup unavailable');
  const body = await response.json();
  return {
    status: body.Status,
    answers: Array.isArray(body.Answer) ? body.Answer : [],
  };
}

export async function checkDomain(domain, fetchImpl = fetch) {
  try {
    const mx = await resolveDns(domain, 'MX', fetchImpl);
    const mxAnswers = mx.answers
      .filter((answer) => answer.type === 15 && !String(answer.data).trim().startsWith('0 .'))
      .map((answer) => String(answer.data).trim());
    const mxValid = mx.status === 0 && mxAnswers.length > 0;

    let domainValid = mxValid;
    if (!domainValid) {
      const [a, aaaa] = await Promise.all([
        resolveDns(domain, 'A', fetchImpl),
        resolveDns(domain, 'AAAA', fetchImpl),
      ]);
      domainValid = (a.status === 0 && a.answers.length > 0) ||
        (aaaa.status === 0 && aaaa.answers.length > 0);
    }

    return { domainValid, mxValid, mxRecords: mxAnswers, dnsStatus: 'completed' };
  } catch {
    return { domainValid: null, mxValid: null, mxRecords: [], dnsStatus: 'timeout' };
  }
}

export function calculateTechnicalResult(address, dns) {
  let score = 0;
  if (address.syntaxValid) score += 10;
  if (dns.domainValid === true) score += 15;
  if (dns.mxValid === true) score += 25;
  if (!address.disposable) score += 10;
  if (!address.roleBased) score += 5;

  let status = 'unknown';
  let reason = 'There is not enough evidence to classify this address.';

  if (!address.syntaxValid) {
    status = 'undeliverable';
    score = 0;
    reason = 'The email address format is invalid.';
  } else if (dns.dnsStatus === 'timeout') {
    status = address.disposable || address.roleBased ? 'risky' : 'unknown';
    reason = 'The DNS lookup did not complete. This does not mean the address is invalid.';
  } else if (!dns.domainValid) {
    status = 'undeliverable';
    score = Math.min(score, 10);
    reason = 'The domain could not be found in DNS.';
  } else if (!dns.mxValid) {
    status = 'undeliverable';
    score = Math.min(score, 30);
    reason = 'The domain exists but does not publish a usable MX mail-server record.';
  } else if (address.disposable || address.roleBased || address.suggestedEmail) {
    status = 'risky';
    reason = address.disposable
      ? 'The domain is associated with temporary or disposable email addresses.'
      : address.roleBased
        ? 'This is a role-based address that may be shared by several people.'
        : `The domain may be mistyped. Did you mean ${address.suggestedEmail}?`;
  } else {
    status = 'likely_deliverable';
    reason = 'The format is valid and the domain has active mail servers. The exact mailbox was not probed from the Cloudflare Worker.';
  }

  return {
    status,
    statusLabel: STATUS_LABELS[status],
    confidenceScore: Math.max(0, Math.min(score, 90)),
    reason,
  };
}

export function applySmtpEvidence(result, smtpStatus, catchAll = null) {
  if (smtpStatus === 'accepted') {
    return {
      ...result,
      status: catchAll ? 'catch_all' : result.status,
      statusLabel: catchAll ? STATUS_LABELS.catch_all : result.statusLabel,
      confidenceScore: Math.min(result.confidenceScore + (catchAll ? 0 : 15), catchAll ? 80 : 95),
      reason: catchAll
        ? 'The domain accepts mail for random addresses, so this individual mailbox cannot be confirmed.'
        : 'The receiving server accepted a mailbox-level SMTP probe.',
    };
  }
  if (smtpStatus === 'rejected') {
    return {
      ...result,
      status: 'undeliverable',
      statusLabel: STATUS_LABELS.undeliverable,
      confidenceScore: Math.min(result.confidenceScore, 5),
      reason: 'The receiving server permanently rejected this mailbox.',
    };
  }
  if (smtpStatus === 'timeout' || smtpStatus === 'blocked' || smtpStatus === 'temporary_rejection') {
    return {
      ...result,
      reason: `${result.reason} The SMTP check was ${smtpStatus.replace(/_/g, ' ')}, which is not evidence that the mailbox is invalid.`,
    };
  }
  return result;
}

export async function runTechnicalCheck(email, fetchImpl = fetch) {
  const address = inspectAddress(email);
  const dns = address.syntaxValid
    ? await checkDomain(address.domain, fetchImpl)
    : { domainValid: false, mxValid: false, mxRecords: [], dnsStatus: 'not_run' };
  const result = calculateTechnicalResult(address, dns);
  const scoreBreakdown = [
    { signal: 'Valid syntax', points: address.syntaxValid ? 10 : 0 },
    { signal: 'Domain resolves', points: dns.domainValid === true ? 15 : 0 },
    { signal: 'MX records found', points: dns.mxValid === true ? 25 : 0 },
    { signal: 'Not disposable', points: !address.disposable ? 10 : 0 },
    { signal: 'Not role-based', points: !address.roleBased ? 5 : 0 },
  ];

  return {
    email: address.normalizedEmail,
    ...result,
    syntax: { valid: address.syntaxValid, label: address.syntaxValid ? 'Valid format' : 'Invalid format' },
    domain: {
      valid: dns.domainValid,
      label: dns.dnsStatus === 'timeout'
        ? 'DNS lookup timed out'
        : dns.domainValid ? 'Domain found' : 'Domain not found',
    },
    mx: {
      valid: dns.mxValid,
      records: dns.mxRecords,
      label: dns.dnsStatus === 'timeout'
        ? 'MX lookup timed out'
        : dns.mxValid ? 'Mail servers found' : 'No usable mail servers found',
    },
    disposable: {
      value: address.disposable,
      label: address.disposable ? 'Disposable domain detected' : 'Not found on the disposable-domain list',
    },
    roleBased: {
      value: address.roleBased,
      label: address.roleBased ? 'Role-based address detected' : 'Not a common role-based address',
    },
    smtp: {
      status: 'not_attempted',
      label: 'Not attempted from Cloudflare',
      explanation: 'Direct SMTP probing is unavailable in this Worker and is not required to classify the address.',
    },
    catchAll: {
      value: null,
      label: 'Unknown without a safe SMTP test',
    },
    deliveryStatus: 'not_sent',
    confirmationStatus: 'not_requested',
    suggestedEmail: address.suggestedEmail,
    scoreBreakdown,
    checkedAt: new Date().toISOString(),
  };
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

async function hmacBase64(value, secret, secretIsBase64 = false) {
  const keyBytes = secretIsBase64 ? base64ToBytes(secret) : new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return bytesToBase64(new Uint8Array(signature));
}

async function hashValue(value, secret) {
  return hmacBase64(value, secret);
}

export async function hashConfirmationToken(token, secret) {
  return hashValue(token, secret);
}

export async function createConfirmationToken(secret) {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = bytesToBase64(tokenBytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return { token, tokenHash: await hashConfirmationToken(token, secret) };
}

export async function verifyResendWebhookSignature(payload, headers, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!payload || !secret || !headers?.id || !headers?.timestamp || !headers?.signature) return false;
  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > WEBHOOK_TOLERANCE_SECONDS) return false;

  try {
    const encodedSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    const expected = await hmacBase64(`${headers.id}.${headers.timestamp}.${payload}`, encodedSecret, true);
    return headers.signature
      .split(/\s+/)
      .some((part) => part.startsWith('v1,') && constantTimeEqual(part.slice(3), expected));
  } catch {
    return false;
  }
}

export function mapResendEvent(type) {
  return {
    'email.sent': { status: 'pending', deliveryStatus: 'sent' },
    'email.delivered': { status: 'delivered', deliveryStatus: 'delivered' },
    'email.bounced': { status: 'undeliverable', deliveryStatus: 'hard_bounce' },
    'email.delivery_delayed': { status: 'delayed', deliveryStatus: 'delayed' },
    'email.complained': { status: 'complaint', deliveryStatus: 'complaint' },
    'email.failed': { status: 'unknown', deliveryStatus: 'failed' },
    'email.suppressed': { status: 'undeliverable', deliveryStatus: 'suppressed' },
    'email.opened': { status: null, deliveryStatus: null, engagementStatus: 'open_detected' },
    'email.clicked': { status: null, deliveryStatus: null, engagementStatus: 'click_detected' },
  }[type] || null;
}

export function isConfirmationExpired(expiresAt, now = Date.now()) {
  const expiry = Date.parse(expiresAt);
  return !Number.isFinite(expiry) || expiry <= now;
}

export function isSendRateLimited({ emailSentWithinDay, ipSendsWithinHour }) {
  if (emailSentWithinDay) return { limited: true, reason: 'This address has already received a verification email in the last 24 hours.' };
  if (ipSendsWithinHour >= 5) return { limited: true, reason: 'Too many verification emails were requested from this network. Try again later.' };
  return { limited: false, reason: null };
}

export async function claimWebhookEvent(db, eventId, eventType, receivedAt = new Date().toISOString()) {
  const claimed = await db.prepare(
    'INSERT OR IGNORE INTO email_verification_webhook_events (event_id, event_type, received_at) VALUES (?, ?, ?)'
  ).bind(eventId, eventType, receivedAt).run();
  return (claimed.meta?.changes || 0) > 0;
}

export async function claimRateLimit(db, rateKey, maximum, expiresAt, now = new Date().toISOString()) {
  await db.prepare(
    'DELETE FROM email_verification_rate_limits WHERE rate_key = ? AND expires_at <= ?'
  ).bind(rateKey, now).run();
  const result = await db.prepare(`
    INSERT INTO email_verification_rate_limits (rate_key, request_count, expires_at)
    VALUES (?, 1, ?)
    ON CONFLICT(rate_key) DO UPDATE SET request_count = request_count + 1
    WHERE request_count < ?
  `).bind(rateKey, expiresAt, maximum).run();
  return (result.meta?.changes || 0) > 0;
}

export async function getRateLimitCount(db, rateKey, now = new Date().toISOString()) {
  const row = await db.prepare(
    'SELECT request_count FROM email_verification_rate_limits WHERE rate_key = ? AND expires_at > ?'
  ).bind(rateKey, now).first();
  return Number(row?.request_count || 0);
}

function publicResultFromRow(row) {
  let scoreBreakdown = [];
  try {
    scoreBreakdown = row.score_breakdown ? JSON.parse(row.score_breakdown) : [];
  } catch {
    scoreBreakdown = [];
  }
  return {
    verificationId: row.id,
    email: row.normalized_email,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] || STATUS_LABELS.unknown,
    confidenceScore: row.confidence_score ?? 0,
    syntax: { valid: row.syntax_valid === 1, label: row.syntax_valid ? 'Valid format' : 'Invalid format' },
    domain: {
      valid: row.domain_valid == null ? null : row.domain_valid === 1,
      label: row.domain_valid == null ? 'DNS lookup timed out' : row.domain_valid ? 'Domain found' : 'Domain not found',
    },
    mx: {
      valid: row.mx_valid == null ? null : row.mx_valid === 1,
      label: row.mx_valid == null ? 'MX lookup timed out' : row.mx_valid ? 'Mail servers found' : 'No usable mail servers found',
    },
    disposable: { value: row.disposable === 1, label: row.disposable ? 'Disposable domain detected' : 'Not detected' },
    roleBased: { value: row.role_based === 1, label: row.role_based ? 'Role-based address detected' : 'Not detected' },
    smtp: { status: row.smtp_status || 'not_attempted', label: 'Not attempted from Cloudflare' },
    catchAll: {
      value: row.catch_all == null ? null : row.catch_all === 1,
      label: row.catch_all == null ? 'Unknown without a safe SMTP test' : row.catch_all ? 'Catch-all detected' : 'Not catch-all',
    },
    deliveryStatus: row.delivery_status || 'not_sent',
    engagementStatus: row.engagement_status ||
      (Number(row.click_count || 0) > 0 ? 'click_detected' :
        Number(row.open_count || 0) > 0 ? 'open_detected' : 'no_open_detected'),
    confirmationStatus: row.confirmation_status ||
      (row.confirmed_at ? 'confirmed_active' : row.sent_at ? 'not_confirmed' : 'not_requested'),
    reason: row.reason,
    checkedAt: row.updated_at,
    latestEvent: row.latest_event,
    latestEventAt: row.latest_event_at || row.updated_at,
    deliveredAt: row.delivered_at,
    firstOpenedAt: row.first_opened_at,
    lastOpenedAt: row.last_opened_at,
    openCount: Number(row.open_count || 0),
    firstClickedAt: row.first_clicked_at,
    lastClickedAt: row.last_clicked_at,
    clickCount: Number(row.click_count || 0),
    confirmedAt: row.confirmed_at,
    expiresAt: row.expires_at,
    scoreBreakdown,
    trackingNote: 'Open tracking is an estimate. Some email clients block tracking images, while privacy features may generate automatic opens. A secure confirmation-link click remains the strongest proof.',
  };
}

export function isTurnstileResultValid(result, env, expectedAction = 'email_verifier_send') {
  if (result?.success !== true) return false;
  if (env.TURNSTILE_SECRET_KEY === TURNSTILE_ALWAYS_PASS_TEST_SECRET) return true;

  const allowedHostnames = new Set(
    (env.TURNSTILE_ALLOWED_HOSTNAMES ||
      'multitoolhub.space,www.multitoolhub.space,multitool.space,www.multitool.space,localhost,127.0.0.1')
      .split(',')
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean)
  );
  return (
    result.action === expectedAction &&
    allowedHostnames.has(String(result.hostname || '').toLowerCase())
  );
}

export async function verifyTurnstile(token, ip, env, expectedAction = 'email_verifier_send') {
  if (!env.TURNSTILE_SECRET_KEY) throw new Error('Turnstile is not configured');
  const body = new FormData();
  body.append('secret', env.TURNSTILE_SECRET_KEY);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  body.append('idempotency_key', crypto.randomUUID());
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  });
  if (!response.ok) return false;
  const result = await response.json();
  const valid = isTurnstileResultValid(result, env, expectedAction);
  if (!valid) {
    console.error('Turnstile validation failed', {
      success: result.success,
      errorCodes: result['error-codes'],
      hostname: result.hostname,
      action: result.action,
    });
  }
  return valid;
}

function getRequestIp(c) {
  return c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

function getApiOrigin(c) {
  return (c.env.PUBLIC_API_URL || new URL(c.req.url).origin).replace(/\/+$/, '');
}

function buildConfirmationEmail(confirmUrl) {
  const escapedUrl = confirmUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return {
    subject: 'Confirm your email address',
    text: `Hello,

A one-time verification was requested for this email address on multitoolhub.space.

Confirm that this email is active:
${confirmUrl}

If you did not request this verification, you can safely ignore this message.

Regards,
Multitoolhub.space`,
    html: `<!doctype html>
<html><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#172033">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px">
    <div style="background:#ffffff;border:1px solid #dfe6f0;border-radius:18px;padding:34px">
      <div style="font-size:14px;font-weight:700;color:#4f46e5;margin-bottom:22px">MULTITOOLHUB.SPACE</div>
      <h1 style="font-size:25px;margin:0 0 18px">Confirm your email address</h1>
      <p style="line-height:1.65;margin:0 0 18px">Hello,</p>
      <p style="line-height:1.65;margin:0 0 24px">A one-time verification was requested for this email address on multitoolhub.space.</p>
      <a href="${escapedUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:10px">Confirm Email</a>
      <p style="line-height:1.65;color:#667085;font-size:14px;margin:26px 0 0">This link expires after 24 hours. If you did not request this verification, you can safely ignore this message.</p>
      <p style="line-height:1.65;margin:24px 0 0">Regards,<br>Multitoolhub.space</p>
    </div>
  </div>
</body></html>`,
  };
}

export async function sendWithResend({ env, email, verificationId, jobRowId = null, confirmUrl }) {
  if (!env.RESEND_API_KEY) throw new Error('Email delivery is not configured');
  const template = buildConfirmationEmail(confirmUrl);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `email-verification/${verificationId}`,
    },
    body: JSON.stringify({
      from: env.EMAIL_VERIFIER_FROM || env.FROM_EMAIL ||
        'Email Verifier <verification@mail.multitoolhub.space>',
      to: [email],
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: [
        { name: 'verification_id', value: verificationId },
        ...(jobRowId ? [{ name: 'job_row_id', value: jobRowId }] : []),
      ],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id) {
    console.error('Resend email send failed', {
      status: response.status,
      type: data.name || data.type || data.code,
      message: data.message || data.error?.message || 'Provider rejected the request',
    });
    const error = new Error('The verification email could not be sent');
    error.transient = response.status === 429 || response.status >= 500;
    throw error;
  }
  return data.id;
}

async function insertVerification(db, values) {
  await db.prepare(`
    INSERT INTO email_verifications (
      id, email, normalized_email, confirmation_token_hash, provider_message_id,
      verification_mode, status, confidence_score, syntax_valid, domain_valid,
      mx_valid, disposable, role_based, catch_all, smtp_status, delivery_status,
      technical_status, engagement_status, confirmation_status, score_breakdown,
      reason, requester_ip_hash, created_at, updated_at, sent_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    values.id, values.email, values.normalizedEmail, values.tokenHash || null,
    values.providerMessageId || null, values.mode, values.status, values.confidenceScore,
    values.syntaxValid ? 1 : 0,
    values.domainValid == null ? null : values.domainValid ? 1 : 0,
    values.mxValid == null ? null : values.mxValid ? 1 : 0,
    values.disposable ? 1 : 0, values.roleBased ? 1 : 0,
    values.catchAll == null ? null : values.catchAll ? 1 : 0,
    values.smtpStatus || 'not_attempted', values.deliveryStatus || 'not_sent',
    values.status, 'no_open_detected',
    values.mode === 'confirmation' ? 'not_confirmed' : 'not_requested',
    JSON.stringify(values.scoreBreakdown || []),
    values.reason, values.ipHash, values.createdAt, values.createdAt,
    values.sentAt || null, values.expiresAt || null
  ).run();
}

function providerEventTimestamp(event) {
  const raw = event?.created_at || event?.data?.created_at || event?.data?.createdAt;
  const parsed = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function resendTagValue(tags, name) {
  if (Array.isArray(tags)) return tags.find((tag) => tag?.name === name)?.value || '';
  return tags?.[name] || '';
}

function bounceDetails(event) {
  const rawType = String(
    event?.data?.bounce?.type ||
    event?.data?.bounce_type ||
    event?.data?.type ||
    ''
  ).toLowerCase();
  const reason = String(
    event?.data?.bounce?.message ||
    event?.data?.reason ||
    event?.data?.message ||
    ''
  ).slice(0, 1000);
  const soft = /soft|temporary|transient|mailbox[_ -]?full|delayed/.test(`${rawType} ${reason}`.toLowerCase());
  return { type: soft ? 'soft' : 'hard', reason: reason || null };
}

export function reduceDeliveryStatus(current, eventType, bounceType = 'hard') {
  const terminal = new Set(['complaint', 'hard_bounce', 'suppressed']);
  if (current === 'complaint') return current;
  if (eventType === 'email.complained') return 'complaint';
  if (current === 'hard_bounce' && eventType !== 'email.complained') return current;
  if (current === 'suppressed' && !['email.complained', 'email.bounced'].includes(eventType)) return current;
  if (eventType === 'email.bounced') return bounceType === 'soft' ? 'soft_bounce' : 'hard_bounce';
  if (eventType === 'email.suppressed') return terminal.has(current) ? current : 'suppressed';
  if (eventType === 'email.failed') return terminal.has(current) ? current : 'failed';
  if (eventType === 'email.delivered') return terminal.has(current) || current === 'failed' ? current : 'delivered';
  if (eventType === 'email.delivery_delayed') {
    return terminal.has(current) || ['failed', 'delivered'].includes(current) ? current : 'delayed';
  }
  if (eventType === 'email.sent') {
    return terminal.has(current) || ['failed', 'delivered', 'delayed', 'soft_bounce'].includes(current)
      ? current
      : 'sent';
  }
  return current || 'not_sent';
}

function legacyStatusForDelivery(currentStatus, deliveryStatus) {
  if (currentStatus === 'confirmed') return currentStatus;
  return {
    delivered: 'delivered',
    delayed: 'delayed',
    soft_bounce: 'risky',
    hard_bounce: 'undeliverable',
    suppressed: 'undeliverable',
    complaint: 'complaint',
    failed: 'unknown',
    sent: 'pending',
  }[deliveryStatus] || currentStatus || 'pending';
}

function deliveryReason(eventType, bounceReason) {
  return {
    'email.sent': 'The email provider accepted the verification request.',
    'email.delivered': 'The receiving mail server accepted the verification message.',
    'email.delivery_delayed': 'The receiving server reported a temporary delivery delay.',
    'email.bounced': bounceReason || 'The receiving server rejected the verification message.',
    'email.failed': 'The email provider reported a terminal delivery failure.',
    'email.suppressed': 'The provider suppressed this address to protect sender reputation.',
    'email.complained': 'The recipient marked the verification message as spam. Further sends are suppressed.',
  }[eventType] || null;
}

async function recordSuppression(db, normalizedEmail, reason, verificationId, jobRowId, providerCreatedAt) {
  if (!normalizedEmail || !reason) return;
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO email_verification_suppressions (
      normalized_email, reason, source_verification_id, source_job_row_id,
      provider_created_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(normalized_email) DO UPDATE SET
      reason = excluded.reason,
      source_verification_id = COALESCE(excluded.source_verification_id, source_verification_id),
      source_job_row_id = COALESCE(excluded.source_job_row_id, source_job_row_id),
      provider_created_at = excluded.provider_created_at,
      updated_at = excluded.updated_at
  `).bind(
    normalizedEmail, reason, verificationId || null, jobRowId || null,
    providerCreatedAt, now, now
  ).run();
}

async function refreshBulkWebhookCounters(db, jobId, eventAt) {
  await db.prepare(`
    UPDATE email_verification_jobs
    SET delivered_rows = (SELECT COUNT(*) FROM email_verification_job_rows WHERE job_id = ? AND delivery_status = 'delivered'),
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
        latest_event_at = CASE WHEN latest_event_at IS NULL OR latest_event_at < ? THEN ? ELSE latest_event_at END,
        updated_at = ?
    WHERE id = ?
  `).bind(
    ...Array(12).fill(jobId),
    eventAt, eventAt, new Date().toISOString(), jobId
  ).run();
}

export function registerEmailVerifierRoutes(app) {
  app.use('/api/email-verifier/*', async (c, next) => {
    const rawPathname = new URL(c.req.url).pathname;
    const pathname = rawPathname === '/' ? '/' : rawPathname.replace(/\/+$/, '');
    console.log('Email verifier route', {
      pathname,
      method: c.req.method,
    });
    await next();
  });

  app.post('/api/email-verifier/check', async (c) => {
    const db = c.env.multitool_db || c.env.DB;
    if (!db) return jsonError(c, 'Verification storage is unavailable.', 503, 'DATABASE_UNAVAILABLE');
    if (!c.env.TOKEN_HASH_SECRET) return jsonError(c, 'Email verification is not configured.', 503, 'CONFIGURATION_ERROR');
    try {
      const body = await c.req.json();
      const email = normalizeEmail(body.email);
      const ip = getRequestIp(c);
      const ipHash = await hashValue(ip, c.env.TOKEN_HASH_SECRET);
      const hourlyKey = `instant-ip:${ipHash}`;
      const challengeThreshold = Math.max(1, Number(c.env.EMAIL_INSTANT_TURNSTILE_THRESHOLD || 10));
      const hourlyLimit = Math.max(challengeThreshold, Number(c.env.EMAIL_INSTANT_HOURLY_LIMIT || 30));
      const dailyLimit = Math.max(hourlyLimit, Number(c.env.EMAIL_INSTANT_DAILY_LIMIT || 100));
      const hourlyCount = await getRateLimitCount(db, hourlyKey);
      if (hourlyCount >= challengeThreshold) {
        if (!body.turnstileToken) {
          return jsonError(
            c,
            'Complete the bot-protection check to continue with additional instant checks.',
            428,
            'TURNSTILE_REQUIRED'
          );
        }
        const turnstileValid = await verifyTurnstile(
          body.turnstileToken,
          ip,
          c.env,
          'email_verifier_instant'
        );
        if (!turnstileValid) {
          return jsonError(c, 'Bot-protection verification failed. Please try again.', 403, 'TURNSTILE_FAILED');
        }
      }
      const checkAllowed = await claimRateLimit(
        db,
        hourlyKey,
        hourlyLimit,
        new Date(Date.now() + 60 * 60 * 1000).toISOString()
      );
      if (!checkAllowed) return jsonError(c, 'Too many checks were requested. Try again later.', 429, 'RATE_LIMITED');
      const today = new Date().toISOString().slice(0, 10);
      const dayAllowed = await claimRateLimit(
        db,
        `instant-day:${ipHash}:${today}`,
        dailyLimit,
        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      );
      if (!dayAllowed) return jsonError(c, 'The daily Instant Check limit has been reached.', 429, 'RATE_LIMITED');

      const result = await runTechnicalCheck(email);
      const id = crypto.randomUUID();
      await insertVerification(db, {
        id,
        email,
        normalizedEmail: result.email,
        mode: 'instant',
        status: result.status,
        confidenceScore: result.confidenceScore,
        syntaxValid: result.syntax.valid,
        domainValid: result.domain.valid,
        mxValid: result.mx.valid,
        disposable: result.disposable.value,
        roleBased: result.roleBased.value,
        catchAll: result.catchAll.value,
        smtpStatus: result.smtp.status,
        reason: result.reason,
        scoreBreakdown: result.scoreBreakdown,
        ipHash,
        createdAt: result.checkedAt,
      });
      return c.json({ verificationId: id, ...result });
    } catch (error) {
      console.error('Email verifier check failed:', error?.message);
      return jsonError(c, 'The check could not be completed. Please try again.', 500, 'CHECK_FAILED');
    }
  });

  app.post('/api/email-verifier/send', async (c) => {
    const db = c.env.multitool_db || c.env.DB;
    if (!db) return jsonError(c, 'Verification storage is unavailable.', 503, 'DATABASE_UNAVAILABLE');
    if (!c.env.TOKEN_HASH_SECRET) return jsonError(c, 'Email verification is not configured.', 503, 'CONFIGURATION_ERROR');
    try {
      const body = await c.req.json();
      if (body.consent !== true) return jsonError(c, 'Permission is required before sending a verification email.', 400, 'CONSENT_REQUIRED');
      if (!body.turnstileToken) return jsonError(c, 'Please complete the bot-protection check.', 400, 'TURNSTILE_REQUIRED');

      const email = normalizeEmail(body.email);
      const technical = await runTechnicalCheck(email);
      if (!technical.syntax.valid || technical.domain.valid === false || technical.mx.valid === false) {
        return jsonError(c, technical.reason, 422, 'UNDELIVERABLE');
      }
      if (technical.domain.valid == null || technical.mx.valid == null) {
        return jsonError(c, 'DNS could not be checked right now. No email was sent.', 503, 'DNS_UNAVAILABLE');
      }

      const ip = getRequestIp(c);
      const turnstileValid = await verifyTurnstile(body.turnstileToken, ip, c.env);
      if (!turnstileValid) return jsonError(c, 'Bot-protection verification failed. Please try again.', 403, 'TURNSTILE_FAILED');

      const ipHash = await hashValue(ip, c.env.TOKEN_HASH_SECRET);
      const emailHash = await hashValue(email, c.env.TOKEN_HASH_SECRET);
      const suppressed = await db.prepare(
        "SELECT status FROM email_verifications WHERE normalized_email = ? AND status IN ('complaint', 'undeliverable') AND delivery_status IN ('complaint', 'bounced') ORDER BY updated_at DESC LIMIT 1"
      ).bind(email).first();
      if (suppressed) {
        return jsonError(c, 'This address is suppressed after a previous bounce or complaint.', 409, 'ADDRESS_SUPPRESSED');
      }
      const ipAllowed = await claimRateLimit(
        db,
        `send-ip:${ipHash}`,
        5,
        new Date(Date.now() + 60 * 60 * 1000).toISOString()
      );
      if (!ipAllowed) {
        return jsonError(c, 'Too many verification emails were requested from this network. Try again later.', 429, 'RATE_LIMITED');
      }
      const emailAllowed = await claimRateLimit(
        db,
        `send-email:${emailHash}`,
        1,
        new Date(Date.now() + CONFIRMATION_TTL_MS).toISOString()
      );
      if (!emailAllowed) {
        return jsonError(c, 'This address has already received a verification email in the last 24 hours.', 429, 'RATE_LIMITED');
      }

      const id = crypto.randomUUID();
      const { token, tokenHash } = await createConfirmationToken(c.env.TOKEN_HASH_SECRET);
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS).toISOString();

      await insertVerification(db, {
        id,
        email,
        normalizedEmail: email,
        tokenHash,
        mode: 'confirmation',
        status: 'pending',
        confidenceScore: technical.confidenceScore,
        syntaxValid: technical.syntax.valid,
        domainValid: technical.domain.valid,
        mxValid: technical.mx.valid,
        disposable: technical.disposable.value,
        roleBased: technical.roleBased.value,
        catchAll: technical.catchAll.value,
        smtpStatus: technical.smtp.status,
        deliveryStatus: 'requesting',
        reason: 'A permission-based confirmation email is being sent.',
        scoreBreakdown: technical.scoreBreakdown,
        ipHash,
        createdAt: now,
        expiresAt,
      });

      const confirmUrl = `${getApiOrigin(c)}/api/email-verifier/confirm/${encodeURIComponent(token)}`;
      let providerMessageId;
      try {
        providerMessageId = await sendWithResend({
          env: c.env,
          email,
          verificationId: id,
          confirmUrl,
        });
      } catch (sendError) {
        await db.prepare(
          "UPDATE email_verifications SET status = 'unknown', delivery_status = 'provider_failed', reason = ?, updated_at = ? WHERE id = ?"
        ).bind('The email provider did not accept the verification request.', new Date().toISOString(), id).run();
        await db.prepare('DELETE FROM email_verification_rate_limits WHERE rate_key = ?')
          .bind(`send-email:${emailHash}`).run();
        throw sendError;
      }

      await db.prepare(`
        UPDATE email_verifications
        SET provider_message_id = ?, delivery_status = 'sent', sent_at = ?, updated_at = ?,
            reason = 'The verification email was accepted by the provider.'
        WHERE id = ?
      `).bind(providerMessageId, now, now, id).run();
      return c.json({ verificationId: id, status: 'pending', statusLabel: STATUS_LABELS.pending }, 202);
    } catch (error) {
      console.error('Email verifier send failed:', error?.message);
      return jsonError(c, 'The verification email could not be sent. Please try again later.', 500, 'SEND_FAILED');
    }
  });

  app.all('/api/email-verifier/send', (c) => {
    c.header('Allow', 'POST, OPTIONS');
    return c.json({
      success: false,
      code: 'METHOD_NOT_ALLOWED',
      message: 'Method not allowed',
    }, 405);
  });

  app.get('/api/email-verifier/status/:verificationId', async (c) => {
    const db = c.env.multitool_db || c.env.DB;
    try {
      const row = await db.prepare('SELECT * FROM email_verifications WHERE id = ? LIMIT 1')
        .bind(c.req.param('verificationId')).first();
      if (!row) return jsonError(c, 'Verification not found.', 404, 'NOT_FOUND');
      if (row.status === 'pending' && isConfirmationExpired(row.expires_at)) {
        await db.prepare(
          "UPDATE email_verifications SET status = 'unknown', delivery_status = 'expired', reason = 'The confirmation link expired.', updated_at = ? WHERE id = ?"
        ).bind(new Date().toISOString(), row.id).run();
        row.status = 'unknown';
        row.delivery_status = 'expired';
        row.reason = 'The confirmation link expired.';
      }
      return c.json(publicResultFromRow(row));
    } catch (error) {
      console.error('Email verifier status failed:', error?.message);
      return jsonError(c, 'The verification status is temporarily unavailable.', 500, 'STATUS_FAILED');
    }
  });

  app.get('/api/email-verifier/confirm/:token', async (c) => {
    const db = c.env.multitool_db || c.env.DB;
    const html = (title, message, success = false) => c.html(`<!doctype html>
      <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${title} | Multitoolhub.space</title></head>
      <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1020;color:#f8fafc;font-family:Inter,Arial,sans-serif">
      <main style="width:min(520px,calc(100% - 40px));box-sizing:border-box;padding:38px;border:1px solid #29324c;border-radius:22px;background:#11182c;text-align:center">
      <div style="width:58px;height:58px;margin:0 auto 20px;display:grid;place-items:center;border-radius:50%;background:${success ? '#123d32' : '#3b2230'};font-size:28px">${success ? '✓' : '!'}</div>
      <h1 style="margin:0 0 12px;font-size:28px">${title}</h1><p style="margin:0;color:#aab5cf;line-height:1.65">${message}</p>
      <a href="${(c.env.FRONTEND_URL || 'https://www.multitoolhub.space')}/tools/email-verifier" style="display:inline-block;margin-top:26px;color:#a5b4fc">Return to Email Verifier</a>
      </main></body></html>`, success ? 200 : 400);
    try {
      if (!c.env.TOKEN_HASH_SECRET) throw new Error('TOKEN_HASH_SECRET is not configured');
      const tokenHash = await hashValue(c.req.param('token'), c.env.TOKEN_HASH_SECRET);
      const row = await db.prepare(
        'SELECT id, status, expires_at FROM email_verifications WHERE confirmation_token_hash = ? LIMIT 1'
      ).bind(tokenHash).first();
      const bulkRow = row ? null : await db.prepare(`
        SELECT id, job_id, technical_status, delivery_status, confirmation_status,
          confirmation_expires_at
        FROM email_verification_job_rows
        WHERE confirmation_token_hash = ? LIMIT 1
      `).bind(tokenHash).first();
      if (!row && !bulkRow) return html('Invalid confirmation link', 'This confirmation link is not valid or has already been removed.');
      const expiresAt = row?.expires_at || bulkRow?.confirmation_expires_at;
      if (isConfirmationExpired(expiresAt)) {
        if (bulkRow) {
          await db.prepare(`
            UPDATE email_verification_job_rows
            SET confirmation_status = 'expired', updated_at = ?
            WHERE id = ? AND confirmation_status != 'confirmed_active'
          `).bind(new Date().toISOString(), bulkRow.id).run();
        }
        return html('Confirmation link expired', 'This one-time confirmation link has expired. Request a new verification if needed.');
      }
      if (row?.status === 'complaint' || bulkRow?.delivery_status === 'complaint') {
        return html('Verification unavailable', 'This address reported the message as spam, so the verification remains suppressed.');
      }
      if (bulkRow) {
        if (bulkRow.confirmation_status !== 'confirmed_active') {
          const now = new Date().toISOString();
          await db.prepare(`
            UPDATE email_verification_job_rows
            SET confirmation_status = 'confirmed_active', confidence_score = 100,
              confirmed_at = ?, updated_at = ?, latest_event = 'confirmed',
              latest_event_at = ?,
              reason = 'The recipient completed the unique secure confirmation link.'
            WHERE id = ? AND delivery_status != 'complaint'
          `).bind(now, now, now, bulkRow.id).run();
          await db.prepare(`
            UPDATE email_verification_jobs
            SET confirmed_rows = (
              SELECT COUNT(*) FROM email_verification_job_rows
              WHERE job_id = ? AND confirmation_status = 'confirmed_active'
            ), latest_event_at = ?, updated_at = ?
            WHERE id = ?
          `).bind(bulkRow.job_id, now, now, bulkRow.job_id).run();
        }
      } else if (row.status !== 'confirmed') {
        const now = new Date().toISOString();
        await db.prepare(`
          UPDATE email_verifications
          SET status = 'confirmed', technical_status = 'confirmed',
              confirmation_status = 'confirmed_active', confidence_score = 100,
              confirmed_at = ?, updated_at = ?, latest_event = 'confirmed',
              latest_event_at = ?,
              reason = 'The recipient opened the secure confirmation link.'
          WHERE id = ?
        `).bind(now, now, now, row.id).run();
      }
      return html('Email confirmed', 'This email address is now Confirmed Active. The confirmation proves the link was opened, not where future messages will be placed.', true);
    } catch (error) {
      console.error('Email confirmation failed:', error?.message);
      return html('Confirmation unavailable', 'The confirmation could not be completed right now. Please try again later.');
    }
  });

  app.post('/api/email-verifier/webhooks/resend', async (c) => {
    const db = c.env.multitool_db || c.env.DB;
    const payload = await c.req.text();
    const webhookHeaders = {
      id: c.req.header('svix-id'),
      timestamp: c.req.header('svix-timestamp'),
      signature: c.req.header('svix-signature'),
    };
    if (!(await verifyResendWebhookSignature(payload, webhookHeaders, c.env.RESEND_WEBHOOK_SECRET))) {
      return jsonError(c, 'Invalid webhook signature.', 401, 'INVALID_SIGNATURE');
    }

    try {
      const event = JSON.parse(payload);
      const mapped = mapResendEvent(event.type);
      if (!mapped) return c.json({ received: true, ignored: true });
      const eventId = webhookHeaders.id;
      if (!(await claimWebhookEvent(db, eventId, event.type))) {
        return c.json({ received: true, duplicate: true });
      }

      const messageId = event.data?.email_id || event.data?.id || '';
      const eventTags = event.data?.tags;
      const taggedVerificationId = resendTagValue(eventTags, 'verification_id');
      const taggedJobRowId = resendTagValue(eventTags, 'job_row_id');
      if (!messageId && !taggedVerificationId && !taggedJobRowId) {
        return c.json({ received: true, ignored: true });
      }

      const single = await db.prepare(`
        SELECT * FROM email_verifications
        WHERE provider_message_id = ? OR id = ? LIMIT 1
      `).bind(messageId, taggedVerificationId).first();
      const bulk = await db.prepare(`
        SELECT * FROM email_verification_job_rows
        WHERE provider_email_id = ? OR id = ? LIMIT 1
      `).bind(messageId, taggedJobRowId).first();
      if (!single && !bulk) {
        await db.prepare('DELETE FROM email_verification_webhook_events WHERE event_id = ?').bind(eventId).run();
        return jsonError(c, 'Verification record is not ready.', 503, 'RETRY_WEBHOOK');
      }

      const eventAt = providerEventTimestamp(event);
      const receivedAt = new Date().toISOString();
      const bounce = bounceDetails(event);
      const redactedPayload = JSON.stringify({
        type: event.type,
        bounceType: event.type === 'email.bounced' ? bounce.type : undefined,
        bounceReason: event.type === 'email.bounced' ? bounce.reason : undefined,
      });
      await db.prepare(`
        INSERT INTO email_verification_events (
          id, verification_id, job_row_id, provider_event_id, provider_email_id,
          event_type, provider_created_at, event_payload, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(), single?.id || null, bulk?.id || null, eventId,
        messageId || single?.provider_message_id || bulk?.provider_email_id || null,
        event.type, eventAt, redactedPayload, receivedAt
      ).run();

      if (single) {
        const isEngagement = event.type === 'email.opened' || event.type === 'email.clicked';
        const deliveryIsNewer = !single.delivery_event_at || eventAt >= single.delivery_event_at;
        let deliveryStatus = single.delivery_status || 'not_sent';
        let legacyStatus = single.status;
        let score = Number(single.confidence_score || 0);
        if (!isEngagement && deliveryIsNewer) {
          deliveryStatus = reduceDeliveryStatus(deliveryStatus, event.type, bounce.type);
          legacyStatus = legacyStatusForDelivery(legacyStatus, deliveryStatus);
          if (['hard_bounce', 'suppressed', 'complaint'].includes(deliveryStatus)) score = 0;
          else if (deliveryStatus === 'delivered' && single.status !== 'confirmed') {
            score = Math.min(99, score + (single.delivery_status === 'delivered' ? 0 : 15));
          }
        }
        if (single.status === 'confirmed' || single.confirmation_status === 'confirmed_active') score = 100;
        if (event.type === 'email.opened' && score < 100) score = Math.min(99, score + 2);
        if (event.type === 'email.clicked' && score < 100) score = Math.min(99, score + 5);
        const reason = deliveryReason(event.type, bounce.reason) || single.reason;
        await db.prepare(`
          UPDATE email_verifications
          SET status = ?, technical_status = COALESCE(technical_status, ?),
              delivery_status = ?, engagement_status = ?,
              confidence_score = ?, bounce_reason = COALESCE(?, bounce_reason),
              reason = ?, updated_at = ?, latest_event = ?, latest_event_at =
                CASE WHEN latest_event_at IS NULL OR latest_event_at < ? THEN ? ELSE latest_event_at END,
              delivery_event_at = CASE WHEN ? = 1 THEN ? ELSE delivery_event_at END,
              provider_message_id = COALESCE(provider_message_id, NULLIF(?, '')),
              sent_at = CASE WHEN ? = 'email.sent' THEN COALESCE(sent_at, ?) ELSE sent_at END,
              delivered_at = CASE WHEN ? = 'email.delivered' THEN COALESCE(delivered_at, ?) ELSE delivered_at END,
              delayed_at = CASE WHEN ? = 'email.delivery_delayed' THEN COALESCE(delayed_at, ?) ELSE delayed_at END,
              bounced_at = CASE WHEN ? = 'email.bounced' THEN COALESCE(bounced_at, ?) ELSE bounced_at END,
              failed_at = CASE WHEN ? IN ('email.failed', 'email.suppressed') THEN COALESCE(failed_at, ?) ELSE failed_at END,
              complained_at = CASE WHEN ? = 'email.complained' THEN COALESCE(complained_at, ?) ELSE complained_at END,
              first_opened_at = CASE WHEN ? = 'email.opened' THEN
                CASE WHEN first_opened_at IS NULL OR first_opened_at > ? THEN ? ELSE first_opened_at END
                ELSE first_opened_at END,
              last_opened_at = CASE WHEN ? = 'email.opened' THEN
                CASE WHEN last_opened_at IS NULL OR last_opened_at < ? THEN ? ELSE last_opened_at END
                ELSE last_opened_at END,
              open_count = open_count + CASE WHEN ? = 'email.opened' THEN 1 ELSE 0 END,
              first_clicked_at = CASE WHEN ? = 'email.clicked' THEN
                CASE WHEN first_clicked_at IS NULL OR first_clicked_at > ? THEN ? ELSE first_clicked_at END
                ELSE first_clicked_at END,
              last_clicked_at = CASE WHEN ? = 'email.clicked' THEN
                CASE WHEN last_clicked_at IS NULL OR last_clicked_at < ? THEN ? ELSE last_clicked_at END
                ELSE last_clicked_at END,
              click_count = click_count + CASE WHEN ? = 'email.clicked' THEN 1 ELSE 0 END,
              engagement_event_at = CASE WHEN ? = 1 AND
                (engagement_event_at IS NULL OR engagement_event_at < ?) THEN ? ELSE engagement_event_at END
          WHERE id = ?
        `).bind(
          legacyStatus, legacyStatus, deliveryStatus,
          event.type === 'email.clicked' ? 'click_detected' :
            event.type === 'email.opened' && single.engagement_status !== 'click_detected'
              ? 'open_detected'
              : single.engagement_status || 'no_open_detected',
          score, bounce.reason, reason, receivedAt, event.type, eventAt, eventAt,
          !isEngagement && deliveryIsNewer ? 1 : 0, eventAt, messageId,
          event.type, eventAt, event.type, eventAt, event.type, eventAt,
          event.type, eventAt, event.type, eventAt, event.type, eventAt,
          event.type, eventAt, eventAt, event.type, eventAt, eventAt, event.type,
          event.type, eventAt, eventAt, event.type, eventAt, eventAt, event.type,
          isEngagement ? 1 : 0, eventAt, eventAt, single.id
        ).run();
        if (['email.bounced', 'email.suppressed', 'email.complained'].includes(event.type)) {
          const suppressionReason = event.type === 'email.complained'
            ? 'complaint'
            : event.type === 'email.suppressed' ? 'provider_suppressed' :
              bounce.type === 'hard' ? 'hard_bounce' : null;
          await recordSuppression(db, single.normalized_email, suppressionReason, single.id, null, eventAt);
        }
      }

      if (bulk) {
        const isEngagement = event.type === 'email.opened' || event.type === 'email.clicked';
        const deliveryIsNewer = !bulk.delivery_event_at || eventAt >= bulk.delivery_event_at;
        let deliveryStatus = bulk.delivery_status || 'not_sent';
        let technicalStatus = bulk.technical_status || 'unknown';
        let score = Number(bulk.confidence_score || 0);
        if (!isEngagement && deliveryIsNewer) {
          deliveryStatus = reduceDeliveryStatus(deliveryStatus, event.type, bounce.type);
          if (['hard_bounce', 'suppressed', 'complaint'].includes(deliveryStatus)) {
            technicalStatus = 'undeliverable';
            score = 0;
          } else if (deliveryStatus === 'soft_bounce' && technicalStatus !== 'undeliverable') {
            technicalStatus = 'risky';
          } else if (deliveryStatus === 'delivered') {
            score = Math.min(99, score + (bulk.delivery_status === 'delivered' ? 0 : 15));
          }
        }
        if (bulk.confirmation_status === 'confirmed_active') score = 100;
        if (event.type === 'email.opened' && score < 100) score = Math.min(99, score + 2);
        if (event.type === 'email.clicked' && score < 100) score = Math.min(99, score + 5);
        await db.prepare(`
          UPDATE email_verification_job_rows
          SET technical_status = ?, delivery_status = ?, engagement_status = ?,
              confidence_score = ?, bounce_type = COALESCE(?, bounce_type),
              bounce_reason = COALESCE(?, bounce_reason), reason = ?,
              updated_at = ?, latest_event = ?, latest_event_at =
                CASE WHEN latest_event_at IS NULL OR latest_event_at < ? THEN ? ELSE latest_event_at END,
              delivery_event_at = CASE WHEN ? = 1 THEN ? ELSE delivery_event_at END,
              provider_email_id = COALESCE(provider_email_id, NULLIF(?, '')),
              sent_at = CASE WHEN ? = 'email.sent' THEN COALESCE(sent_at, ?) ELSE sent_at END,
              delivered_at = CASE WHEN ? = 'email.delivered' THEN COALESCE(delivered_at, ?) ELSE delivered_at END,
              delayed_at = CASE WHEN ? = 'email.delivery_delayed' THEN COALESCE(delayed_at, ?) ELSE delayed_at END,
              bounced_at = CASE WHEN ? = 'email.bounced' THEN COALESCE(bounced_at, ?) ELSE bounced_at END,
              failed_at = CASE WHEN ? IN ('email.failed', 'email.suppressed') THEN COALESCE(failed_at, ?) ELSE failed_at END,
              complained_at = CASE WHEN ? = 'email.complained' THEN COALESCE(complained_at, ?) ELSE complained_at END,
              first_opened_at = CASE WHEN ? = 'email.opened' THEN
                CASE WHEN first_opened_at IS NULL OR first_opened_at > ? THEN ? ELSE first_opened_at END
                ELSE first_opened_at END,
              last_opened_at = CASE WHEN ? = 'email.opened' THEN
                CASE WHEN last_opened_at IS NULL OR last_opened_at < ? THEN ? ELSE last_opened_at END
                ELSE last_opened_at END,
              open_count = open_count + CASE WHEN ? = 'email.opened' THEN 1 ELSE 0 END,
              first_clicked_at = CASE WHEN ? = 'email.clicked' THEN
                CASE WHEN first_clicked_at IS NULL OR first_clicked_at > ? THEN ? ELSE first_clicked_at END
                ELSE first_clicked_at END,
              last_clicked_at = CASE WHEN ? = 'email.clicked' THEN
                CASE WHEN last_clicked_at IS NULL OR last_clicked_at < ? THEN ? ELSE last_clicked_at END
                ELSE last_clicked_at END,
              click_count = click_count + CASE WHEN ? = 'email.clicked' THEN 1 ELSE 0 END,
              engagement_event_at = CASE WHEN ? = 1 AND
                (engagement_event_at IS NULL OR engagement_event_at < ?) THEN ? ELSE engagement_event_at END
          WHERE id = ?
        `).bind(
          technicalStatus, deliveryStatus,
          event.type === 'email.clicked' ? 'click_detected' :
            event.type === 'email.opened' && bulk.engagement_status !== 'click_detected'
              ? 'open_detected'
              : bulk.engagement_status || 'no_open_detected',
          score, event.type === 'email.bounced' ? bounce.type : null, bounce.reason,
          deliveryReason(event.type, bounce.reason) || bulk.reason, receivedAt,
          event.type, eventAt, eventAt, !isEngagement && deliveryIsNewer ? 1 : 0,
          eventAt, messageId, event.type, eventAt, event.type, eventAt,
          event.type, eventAt, event.type, eventAt, event.type, eventAt,
          event.type, eventAt, event.type, eventAt, eventAt, event.type,
          eventAt, eventAt, event.type, event.type, eventAt, eventAt,
          event.type, eventAt, eventAt, event.type, isEngagement ? 1 : 0,
          eventAt, eventAt, bulk.id
        ).run();
        await refreshBulkWebhookCounters(db, bulk.job_id, eventAt);
        if (['email.bounced', 'email.suppressed', 'email.complained'].includes(event.type)) {
          const suppressionReason = event.type === 'email.complained'
            ? 'complaint'
            : event.type === 'email.suppressed' ? 'provider_suppressed' :
              bounce.type === 'hard' ? 'hard_bounce' : null;
          await recordSuppression(db, bulk.normalized_email, suppressionReason, null, bulk.id, eventAt);
        }
      }
      return c.json({ received: true });
    } catch (error) {
      console.error('Resend webhook failed:', error?.message);
      return jsonError(c, 'Webhook processing failed.', 500, 'WEBHOOK_FAILED');
    }
  });
}

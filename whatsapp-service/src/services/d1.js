// HTTP client that calls the Cloudflare Worker for all D1 data operations.
// The Worker runs at WA_WORKER_URL (default: http://localhost:8787 in dev,
// or your deployed workers.dev URL in production).

const BASE = () => `${process.env.WA_WORKER_URL || 'http://localhost:8787'}/api/wa/internal`;
const SECRET = () => process.env.WA_SHARED_SECRET || 'dev-local-secret';

async function call(method, path, body) {
  const url = `${BASE()}${path}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'x-wa-secret': SECRET() },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || `D1 call failed ${res.status}: ${path}`);
  }
  return res.json();
}

module.exports = {
  upsertMessage:      (data)  => call('POST', '/messages/upsert', data),
  bulkUpsertMessages: (rows)  => call('POST', '/messages/bulk', { rows }),
  getLastCustomerMsg: (chatId, sessionId) => call('GET', `/messages/last-customer?chatId=${encodeURIComponent(chatId)}&sessionId=${encodeURIComponent(sessionId || 'legacy')}`),
  upsertChat:         (data)  => call('POST', '/chats/upsert', data),
  upsertContact:      (data)  => call('POST', '/contacts/upsert', data),
  bulkUpsertChats:    (rows)  => call('POST', '/chats/bulk', { rows }),
  bulkUpsertContacts: (rows)  => call('POST', '/contacts/bulk', { rows }),
};

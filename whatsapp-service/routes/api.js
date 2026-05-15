// Thin proxy layer — all data operations are forwarded to the Cloudflare Worker.
// Session management (QR, connect/disconnect) is handled locally.

const express = require('express');
const router  = express.Router();

const WORKER_URL = () => `${process.env.WA_WORKER_URL || 'http://localhost:8787'}/api/wa`;
const WA_SECRET  = () => process.env.WA_SHARED_SECRET || 'dev-local-secret';

function waHeaders() {
  return { 'Content-Type': 'application/json', 'x-wa-secret': WA_SECRET() };
}

async function proxyGet(path, query = {}) {
  const qs = Object.keys(query).length ? `?${new URLSearchParams(query)}` : '';
  const res = await fetch(`${WORKER_URL()}${path}${qs}`, { headers: waHeaders() });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: 'Worker error' }));
    const err = new Error(e.error || 'Worker request failed');
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function proxyMutate(method, path, body) {
  const opts = { method, headers: waHeaders() };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${WORKER_URL()}${path}`, opts);
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: 'Worker error' }));
    const err = new Error(e.error || 'Worker request failed');
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function handle(fn) {
  return async (req, res) => {
    try { res.json(await fn(req)); }
    catch (err) { res.status(err.status || 500).json({ error: err.message }); }
  };
}

function withSession(req, query = req.query) {
  const sessionId = req.app.get('waService').sessionId || req.query.sessionId || 'legacy';
  return { ...query, sessionId };
}

// ── Session routes (local, no DB) ──────────────────────────────────────────
router.get('/status', (req, res) => {
  res.json(req.app.get('waService').getState());
});

router.post('/session/reconnect', async (req, res) => {
  try {
    await req.app.get('waService').initialize();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/session/disconnect', async (req, res) => {
  try {
    await req.app.get('waService').destroy();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Data routes (proxied to Worker) ───────────────────────────────────────
router.get('/chats', handle(req => proxyGet('/chats', withSession(req))));

router.get('/chats/:chatId/messages', async (req, res) => {
  try {
    const chatId = req.params.chatId;
    if (req.query.hydrate === '1') {
      await req.app.get('waService').hydrateChatMessages(chatId, req.query.limit || 50);
    }
    const query = { ...req.query };
    delete query.hydrate;
    res.json(await proxyGet(`/chats/${encodeURIComponent(chatId)}/messages`, withSession(req, query)));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/chats/:chatId/messages', async (req, res) => {
  try {
    const result = await req.app.get('waService').sendMessage(req.params.chatId, req.body?.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/groups/:chatId/participants', async (req, res) => {
  try {
    res.json(await req.app.get('waService').getGroupParticipants(req.params.chatId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/media/:id', async (req, res) => {
  try {
    const qs = new URLSearchParams(withSession(req));
    const upstream = await fetch(`${WORKER_URL()}/media/${encodeURIComponent(req.params.id)}?${qs}`, { headers: waHeaders() });
    if (!upstream.ok) {
      const e = await upstream.json().catch(() => ({ error: 'Media request failed' }));
      return res.status(upstream.status).json(e);
    }
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/contacts', handle(req => proxyGet('/contacts', withSession(req))));

router.patch('/contacts/:phone', handle(req =>
  proxyMutate('PATCH', `/contacts/${encodeURIComponent(req.params.phone)}?${new URLSearchParams(withSession(req))}`, req.body)
));

router.get('/leads',        handle(req => proxyGet('/leads', withSession(req))));
router.post('/leads',       handle(req => proxyMutate('POST',   '/leads',              { ...req.body, sessionId: withSession(req).sessionId })));
router.patch('/leads/:id',  handle(req => proxyMutate('PATCH',  `/leads/${req.params.id}`, { ...req.body, sessionId: withSession(req).sessionId })));
router.delete('/leads/:id', handle(req => proxyMutate('DELETE', `/leads/${req.params.id}?${new URLSearchParams(withSession(req))}`)));

// Ticket status + internal notes
router.patch('/chats/:chatId/ticket', handle(req =>
  proxyMutate('PATCH', `/chats/${encodeURIComponent(req.params.chatId)}/ticket`, { ...req.body, sessionId: withSession(req).sessionId })
));
router.get('/notes/:chatId',  handle(req => proxyGet(`/notes/${encodeURIComponent(req.params.chatId)}`, withSession(req))));
router.post('/notes/:chatId', handle(req =>
  proxyMutate('POST', `/notes/${encodeURIComponent(req.params.chatId)}`, { ...req.body, sessionId: withSession(req).sessionId })
));

router.get('/analytics',        handle(req => proxyGet('/analytics',       withSession(req))));
router.get('/qa/queue',         handle(req => proxyGet('/qa/queue',        withSession(req))));
router.get('/search',           handle(req => proxyGet('/search',          withSession(req))));
router.get('/reports/summary',  handle(req => proxyGet('/reports/summary', withSession(req))));
router.get('/notifications',    handle(req => proxyGet('/notifications',   withSession(req))));

module.exports = router;

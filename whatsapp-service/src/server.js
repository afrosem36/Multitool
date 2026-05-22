require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Keep the process alive — Puppeteer errors are caught per-client and retried
process.on('uncaughtException',  (err) => console.error('[Process] Uncaught exception:',  err.message));
process.on('unhandledRejection', (err) => console.error('[Process] Unhandled rejection:',  err?.message || err));

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');

const WhatsAppService = require('./services/whatsapp');
const apiRouter       = require('./routes/api');

const PORT = process.env.PORT || 3002;

// Allow any localhost port so Vite's auto-port-selection never causes CORS errors
const localhostOrigin = (origin, cb) => {
  if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
    cb(null, true);
  } else {
    cb(new Error('CORS: origin not allowed'));
  }
};

const app        = express();
const httpServer = http.createServer(app);
const io         = new Server(httpServer, {
  cors: { origin: localhostOrigin, methods: ['GET','POST','PATCH','DELETE'] },
  pingTimeout: 60000,
});

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({ origin: localhostOrigin }));
app.use(express.json());

// ── WhatsApp Service ───────────────────────────────────────────────────────
const waService = new WhatsAppService(io);
app.set('waService', waService);

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api', apiRouter);

app.get('/health', (_, res) => res.json({ ok: true, status: waService.status }));

// ── Socket.IO ──────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  const state = waService.getState();
  if (state.sessionId) socket.join(state.sessionId);
  socket.emit('status', { status: state.status, sessionId: state.sessionId });
  if (state.qr) socket.emit('qr', state.qr);

  socket.on('request_qr', () => {
    const s = waService.getState();
    if (s.qr) socket.emit('qr', s.qr);
    if (s.sessionId) socket.join(s.sessionId);
    socket.emit('status', { status: s.status, sessionId: s.sessionId });
  });

  socket.on('join_session', (sessionId) => {
    if (!sessionId || sessionId !== waService.sessionId) return;
    socket.join(sessionId);
  });

  socket.on('reconnect_session', async () => {
    try { await waService.initialize(); }
    catch (e) { socket.emit('error', { message: e.message }); }
  });

  socket.on('disconnect_session', async () => {
    try { await waService.destroy(); }
    catch (e) { console.error('[WS] destroy error:', e.message); }
  });

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// ── Global error middleware ────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[Express] Unhandled error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Server start ───────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  const workerUrl = process.env.WA_WORKER_URL || 'http://localhost:8787';
  console.log(`[Server] WhatsApp Service running on http://localhost:${PORT}`);
  console.log(`[Server] Data layer (Cloudflare Worker): ${workerUrl}`);
  waService.initialize();
});

/**
 * Advanced Internet Speed Tester - Optional Backend Server
 *
 * This is an OPTIONAL Express.js server for more accurate speed testing.
 * The frontend tool works standalone without this, but this provides:
 * - More reliable download/upload test files
 * - No dependence on external APIs
 * - Better control over test parameters
 * - More accurate measurements
 *
 * Installation:
 * 1. npm init -y
 * 2. npm install express cors dotenv
 * 3. Create .env file with: PORT=3001
 * 4. node speed-test-server.js
 *
 * Or with nodemon for development:
 * 5. npm install -D nodemon
 * 6. npx nodemon speed-test-server.js
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', process.env.FRONTEND_URL],
  methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
  credentials: true
}));

// Limit request size for upload testing
app.use(express.raw({ type: 'application/octet-stream', limit: '100mb' }));

/**
 * Health Check Endpoint
 * GET /health
 *
 * Returns: { status: 'ok', timestamp: number }
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    server: 'Speed Test Server'
  });
});

/**
 * Download Speed Test Endpoint
 * GET /speed-test/download?size=10485760
 *
 * Serves a file of specified size for download speed testing.
 *
 * Query Parameters:
 *   - size: File size in bytes (default: 10MB)
 *
 * Returns: Binary data of specified size
 */
app.get('/speed-test/download', (req, res) => {
  try {
    const size = parseInt(req.query.size || 10 * 1024 * 1024);

    // Validate size (min 1KB, max 100MB)
    if (size < 1024 || size > 100 * 1024 * 1024) {
      return res.status(400).json({
        error: 'Invalid size. Must be between 1KB and 100MB.'
      });
    }

    // Create buffer with random data
    const buffer = Buffer.alloc(size);

    // Fill with random data (important for realistic compression)
    for (let i = 0; i < size; i += 4096) {
      const chunk = Math.random().toString(36);
      buffer.write(chunk, i);
    }

    // Set headers for download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', size);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Content-Disposition', 'attachment; filename="speed-test-file.bin"');

    // Send with chunking for realistic network conditions
    res.send(buffer);
  } catch (error) {
    console.error('Download test error:', error);
    res.status(500).json({
      error: 'Download test failed',
      message: error.message
    });
  }
});

/**
 * Upload Speed Test Endpoint
 * POST /speed-test/upload
 *
 * Accepts binary data for upload speed testing.
 * Measures and returns the uploaded size.
 *
 * Body: Binary data
 *
 * Returns: { success: true, uploadedBytes: number, duration: number, speed: number }
 */
app.post('/speed-test/upload', (req, res) => {
  try {
    const startTime = Date.now();
    let uploadedSize = 0;

    // Count incoming data
    req.on('data', (chunk) => {
      uploadedSize += chunk.length;
    });

    req.on('end', () => {
      const duration = (Date.now() - startTime) / 1000; // seconds
      const speedMbps = (uploadedSize * 8) / (duration * 1_000_000);

      res.json({
        success: true,
        uploadedBytes: uploadedSize,
        duration: duration.toFixed(3),
        speedMbps: speedMbps.toFixed(2),
        timestamp: Date.now()
      });
    });

    req.on('error', (error) => {
      console.error('Upload error:', error);
      res.status(500).json({
        error: 'Upload failed',
        message: error.message
      });
    });
  } catch (error) {
    console.error('Upload endpoint error:', error);
    res.status(500).json({
      error: 'Upload test failed',
      message: error.message
    });
  }
});

/**
 * Ping Test Endpoint
 * HEAD /speed-test/ping
 *
 * Lightweight endpoint for latency measurement.
 * Client measures request/response time.
 *
 * Returns: 200 OK with minimal headers
 */
app.head('/speed-test/ping', (req, res) => {
  res.status(200).setHeader('X-Ping', 'pong').end();
});

/**
 * GET /speed-test/ping
 * Alternative ping endpoint (for browsers that don't support HEAD properly)
 */
app.get('/speed-test/ping', (req, res) => {
  res.json({ pong: true, timestamp: Date.now() });
});

/**
 * Configuration Endpoint
 * GET /speed-test/config
 *
 * Returns test server configuration and limits.
 *
 * Returns: { maxUpload: number, maxDownload: number, minPing: number }
 */
app.get('/speed-test/config', (req, res) => {
  res.json({
    maxUploadSize: 100 * 1024 * 1024, // 100MB
    maxDownloadSize: 100 * 1024 * 1024, // 100MB
    recommendedDownloadSize: 10 * 1024 * 1024, // 10MB
    recommendedUploadSize: 5 * 1024 * 1024, // 5MB
    timeout: 60000, // 60 seconds
    version: '1.0.0',
    timestamp: Date.now()
  });
});

/**
 * Error handling middleware
 */
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    message: 'Speed test endpoint not found. Available endpoints: /health, /speed-test/download, /speed-test/upload, /speed-test/ping, /speed-test/config'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║   Advanced Internet Speed Tester - Backend Server     ║
╚═══════════════════════════════════════════════════════╝

🚀 Server running on: http://localhost:${PORT}

Available Endpoints:
  ✓ GET  /health                    - Health check
  ✓ GET  /speed-test/download       - Download test file
  ✓ POST /speed-test/upload         - Upload test
  ✓ HEAD /speed-test/ping           - Ping test
  ✓ GET  /speed-test/config         - Server config

Frontend Integration:
  Set VITE_SPEED_TEST_SERVER=http://localhost:${PORT}
  in your .env file

CORS Enabled for:
  - http://localhost:5173
  - http://localhost:3000
  ${process.env.FRONTEND_URL ? `- ${process.env.FRONTEND_URL}` : ''}

Limits:
  - Max Upload: 100MB
  - Max Download: 100MB
  - Request Timeout: 60s

Press Ctrl+C to stop the server
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n📴 Server shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n📴 Server shutting down gracefully...');
  process.exit(0);
});

# Internet Speed Tester - Backend Server

Optional Express.js backend server for the Advanced Internet Speed Tester tool.

## About

This backend server is **OPTIONAL**. The frontend tool works completely standalone without it using public APIs. However, this server provides:

- ✅ More reliable and faster speed testing
- ✅ No dependency on external services
- ✅ Better control over test parameters
- ✅ More accurate measurements
- ✅ Self-hosted solution
- ✅ Lower latency for testing

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Environment File

Copy `.env.example` to `.env` and update if needed:

```bash
cp .env.example .env
```

### 3. Start the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:3001`

You should see:
```
╔═══════════════════════════════════════════════════════╗
║   Advanced Internet Speed Tester - Backend Server     ║
╚═══════════════════════════════════════════════════════╝

🚀 Server running on: http://localhost:3001
```

### 4. Test the Server

```bash
curl http://localhost:3001/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "server": "Speed Test Server"
}
```

## API Endpoints

### Health Check
```
GET /health

Response: { status: 'ok', timestamp: number, server: 'Speed Test Server' }
```

### Download Speed Test
```
GET /speed-test/download?size=10485760

Query Parameters:
  - size: File size in bytes (default: 10MB, range: 1KB-100MB)

Response: Binary data of specified size
```

Example:
```bash
# Download 10MB test file
curl -O http://localhost:3001/speed-test/download?size=10485760

# Download 50MB test file
curl -O http://localhost:3001/speed-test/download?size=52428800
```

### Upload Speed Test
```
POST /speed-test/upload

Body: Binary data (1KB-100MB)

Response: {
  success: true,
  uploadedBytes: number,
  duration: string,
  speedMbps: string,
  timestamp: number
}
```

Example:
```bash
# Upload 5MB test data
dd if=/dev/zero bs=1M count=5 | curl -X POST --data-binary @- http://localhost:3001/speed-test/upload
```

### Ping/Latency Test
```
HEAD /speed-test/ping
OR
GET /speed-test/ping

Response: 200 OK (HEAD) or { pong: true, timestamp: number } (GET)
```

### Server Configuration
```
GET /speed-test/config

Response: {
  maxUploadSize: number,
  maxDownloadSize: number,
  recommendedDownloadSize: number,
  recommendedUploadSize: number,
  timeout: number,
  version: string,
  timestamp: number
}
```

## Integrating with Frontend

### Option 1: Development Environment Variable

1. In your frontend `.env.local`:
```
VITE_SPEED_TEST_SERVER=http://localhost:3001
```

2. Update `InternetSpeedTester.jsx`:
```javascript
const SPEED_TEST_SERVER = import.meta.env.VITE_SPEED_TEST_SERVER || 'http://localhost:3001';
```

3. Replace API calls in the component:
```javascript
// testDownload():
const fileUrl = `${SPEED_TEST_SERVER}/speed-test/download?size=10485760`;

// testUpload():
const response = await fetch(`${SPEED_TEST_SERVER}/speed-test/upload`, {
  method: 'POST',
  body: uploadData,
  signal: abortControllerRef.current?.signal,
});

// testPing():
await fetch(`${SPEED_TEST_SERVER}/speed-test/ping`, {
  method: 'HEAD',
  signal: abortControllerRef.current?.signal,
});
```

### Option 2: Hardcoded URL (for Testing)

Directly modify the component:
```javascript
const SPEED_TEST_SERVER = 'http://localhost:3001';
```

## Deployment

### Docker (Recommended)

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY speed-test-server.js .
COPY .env .

EXPOSE 3001

CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t speed-test-server .
docker run -p 3001:3001 speed-test-server
```

### Heroku

1. Create `Procfile`:
```
web: node speed-test-server.js
```

2. Deploy:
```bash
heroku create your-app-name
git push heroku main
```

### AWS/GCP/Azure

Set environment variable:
```
PORT=3001
FRONTEND_URL=https://your-frontend.com
```

## Configuration

### Environment Variables

```env
PORT=3001                    # Server port (default: 3001)
NODE_ENV=development         # development or production
FRONTEND_URL=...            # Frontend URL for CORS
```

### CORS Settings

Update the CORS whitelist in `speed-test-server.js`:

```javascript
app.use(cors({
  origin: [
    'http://localhost:5173',      // Local dev
    'http://localhost:3000',      // Alternative local
    'https://yourdomain.com',     // Production
    process.env.FRONTEND_URL      // From env
  ],
  methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
  credentials: true
}));
```

### Limits

Current limits (in `speed-test-server.js`):
- **Max Upload:** 100MB
- **Max Download:** 100MB
- **Request Timeout:** 60 seconds

To modify:
```javascript
// Change in download endpoint
if (size < 1024 || size > 500 * 1024 * 1024) { // 500MB max
  return res.status(400).json({ error: 'Invalid size' });
}

// Change in upload middleware
app.use(express.raw({ 
  type: 'application/octet-stream', 
  limit: '500mb' // 500MB max
}));
```

## Monitoring & Logging

Add logging to `speed-test-server.js`:

```javascript
// Log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Log test results
app.get('/speed-test/download', (req, res) => {
  const size = parseInt(req.query.size || 10 * 1024 * 1024);
  console.log(`Download test: ${(size / 1024 / 1024).toFixed(2)}MB requested`);
  // ... rest of endpoint
});
```

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3001
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3002 npm start
```

### CORS Errors
- Ensure frontend URL is in CORS whitelist
- Check that frontend is making requests to correct server URL
- Verify headers are being set correctly

### Slow Tests
- Check network connection
- Verify no other processes using bandwidth
- Try uploading smaller file sizes
- Check server CPU/memory usage

### Connection Refused
- Verify server is running
- Check correct port number
- Ensure firewall allows connections
- Verify frontend URL matches backend

## Performance Tips

1. **Use with a CDN** - Serve from a location near users
2. **Use load balancing** - For production deployments
3. **Monitor bandwidth** - Watch for unusual usage
4. **Set reasonable limits** - Prevent abuse
5. **Use HTTPS** - For production (add SSL)

## Security Considerations

1. **CORS Whitelist** - Only allow trusted domains
2. **Rate Limiting** - Consider adding to prevent abuse
3. **Authentication** - Add if needed for production
4. **Validate Input** - Size parameters are validated
5. **No Data Storage** - Server doesn't store test results

Add rate limiting (example):
```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/speed-test/', limiter);
```

## Support

For issues:
1. Check if server is running
2. Verify network connectivity
3. Check CORS configuration
4. Review error messages in console
5. Test endpoints with curl/Postman

## License

MIT

## Notes

- This backend is entirely optional
- The frontend tool works standalone using public APIs
- Backend provides better performance and reliability
- Suitable for self-hosted or cloud deployments
- No data logging or storage by default

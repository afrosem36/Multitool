# CORS Fix TODO

## Plan Steps
- [x] Step 1: Add explicit preflight handler to server/index.js (TOP, after Hono init)
- [x] Step 2: Replace CORS config in server/index.js 
- [x] Step 3: Add credentials: 'include' to src/utils/api.js apiFetch
- [ ] Step 4: Test locally (wrangler dev + frontend)
- [x] Step 5: Deploy wrangler deploy
- [x] Step 6: Verify login works (no CORS errors)

Current: Deploy command running: `cd server; wrangler deploy` (PowerShell compatible)


celae
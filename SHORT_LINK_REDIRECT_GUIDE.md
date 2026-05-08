# File Sharing & URL Shortener - Deployment Debugging Guide

## Issue Summary
File sharing and URL shortener work locally but redirect to the main website in production.

## Root Cause
The short links (`/s/slug`) were not properly routed in the frontend. The requests were being caught by the React catch-all route and redirected to home.

## Fixes Applied

### 1. **New Short Link Route Handler** ✅
- Created `/src/pages/misc/ShortLinkRedirect.jsx`
- Added route `/s/:slug` to `App.jsx` (routes BEFORE Layout wrapper)
- Properly handles:
  - Direct redirects (no lead gate form)
  - Lead gate forms (with data collection)
  - Error handling and expiration

### 2. **Fixed URL Construction** ✅
- Modified `UrlShortener.jsx` to ensure full URLs are always displayed
- Added `getFullShortUrl()` function to construct complete URLs
- Handles different URL formats from backend (slug, path, full URL)

### 3. **Fixed File Sharing URLs** ✅
- Updated `FileShare.jsx` to construct full URLs from slugs
- Improved error handling with better error messages
- Better response parsing for backend compatibility

## Testing Checklist

### ✅ Local Testing (http://localhost:5173)
1. Create a short link: `https://yourdomain.com/s/abc123`
2. Click the link → should redirect to destination URL
3. File sharing: Upload file → click short link → should download/redirect

### ✅ Production Testing (https://yourdomain.com)
After deployment:

```bash
# Test 1: Direct short link access
https://yourdomain.com/s/your-slug

# Test 2: With form (lead gate)
# Upload file/URL with form → submit form → redirect to destination

# Test 3: Check browser console
# Should see "Redirecting..." then redirect
# No 404 errors
```

## Backend Configuration Issues to Check

If short links still redirect to homepage in production:

### Issue 1: Backend Not Configured
**Check:** Does your backend have `/api/s/:slug/config` endpoint?
```javascript
// Backend should have these endpoints:
GET  /api/s/:slug/config      → Returns form config
POST /api/s/:slug/submit      → Processes form, returns redirect URL
GET  /api/s/:slug/background  → Returns background image URL
```

**Fix:** Ensure backend is properly deployed and these endpoints exist.

### Issue 2: Wrong Base URL
**Check:** Verify `VITE_API_URL` in `.env.production`:
```env
# Should be your actual backend domain
VITE_API_URL=https://your-backend-domain.com
```

### Issue 3: CORS Issues
**Check:** Backend CORS headers
```
Access-Control-Allow-Origin: https://yourdomain.com
Access-Control-Allow-Methods: GET, POST, OPTIONS
```

### Issue 4: Redirect Not Happening
**Check:** Browser console for errors:
1. Open DevTools (F12)
2. Go to Console tab
3. Test a short link
4. Look for "Short link redirect error" messages
5. Check Network tab for API calls to `https://your-backend-domain.com/api/s/...`

## How to Debug in Production

### Step 1: Check Frontend Route
```javascript
// In browser console
console.log(window.location.pathname); // Should be /s/slug
```

### Step 2: Check API Response
```javascript
// Test API manually
fetch('https://your-backend-domain.com/api/s/your-slug/config')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

### Step 3: Check Network Requests
1. Open DevTools → Network tab
2. Test a short link
3. Look for:
   - ✅ Request to `/api/s/slug/config` (200 OK)
   - ✅ Redirect to destination URL

## Common Issues & Solutions

### Problem: "Short link not found or expired"
**Cause:** Backend doesn't have the link data
**Fix:** Check backend database, re-create the short link

### Problem: "Server error: 404"
**Cause:** Backend `/api/s/` endpoint not found
**Fix:** Deploy backend with proper route handlers

### Problem: "Failed to process short link"
**Cause:** Backend error or malformed response
**Fix:** Check backend logs, ensure API response format matches frontend expectations

### Problem: Redirects to website homepage
**Cause:** Frontend route not catching `/s/` URLs
**Fix:** ✅ Already fixed by adding `/s/:slug` route

## Frontend Response Format Expected

The backend should return JSON in this format:

```json
// GET /api/s/:slug/config
{
  "data": {
    "requiresDataCollection": false,
    "formConfig": null
  }
}

// POST /api/s/:slug/submit
{
  "data": {
    "longUrl": "https://example.com/destination"
  }
}
```

## Environment Variables Required

### Production (.env.production)
```env
VITE_API_URL=https://your-backend-domain.com
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

### Local (.env)
```env
VITE_API_URL=http://127.0.0.1:8787
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

## Testing Commands

```bash
# Build for production
npm run build

# Preview production build locally
npm run preview

# Test short link at http://localhost:4173/s/your-slug
```

## Summary of Changes

| File | Change |
|------|--------|
| `src/App.jsx` | Added `/s/:slug` route with ShortLinkRedirect |
| `src/pages/misc/ShortLinkRedirect.jsx` | New component to handle short link redirects |
| `src/pages/other-tools/UrlShortener.jsx` | Added URL construction logic |
| `src/pages/misc/FileShare.jsx` | Improved URL construction and error handling |
| `.env.production` | ✅ Already configured correctly |

## Next Steps

1. ✅ Deploy the frontend changes
2. Verify backend is deployed and endpoints are working
3. Test short links in production
4. Monitor browser console for any errors
5. Check backend logs if issues persist

## Questions?

If you're still seeing redirects to homepage:
1. Check browser console (F12 → Console)
2. Check Network tab for API failures
3. Check backend logs for errors
4. Verify `VITE_API_URL` is correct in production

---
Generated: 2026-05-08

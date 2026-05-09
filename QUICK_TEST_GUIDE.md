# Quick Test Guide - File Download Fix

## What Changed?
The file download system now has:
- ✅ Dedicated download page with proper error handling
- ✅ No mysterious redirects to homepage on errors
- ✅ Clear states for loading, success, expired, and missing files
- ✅ Better UX messaging

## Quick Test URLs

### Test Valid Download
```
http://localhost:5173/s/test-valid/download
```
Expected: "Download Ready" with file name and download button

### Test Expired File
```
http://localhost:5173/s/test-expired/download
```
Expected: "Link Expired" message (requires backend to return 410 status)

### Test Missing File
```
http://localhost:5173/s/test-missing/download
```
Expected: "File not found" message (requires backend to return 404 status)

## Component Locations

| Component | Path | Route |
|-----------|------|-------|
| DownloadPage (NEW) | `src/pages/misc/DownloadPage.jsx` | `/s/:slug/download` |
| ShortLinkRedirect (Updated) | `src/pages/misc/ShortLinkRedirect.jsx` | `/s/:slug` |
| LeadGate (Improved) | `src/pages/misc/LeadGate.jsx` | `/gate/:slug` |
| ExpiredLink | `src/pages/misc/ExpiredLink.jsx` | `/link-expired/:slug` |

## Testing Scenarios

### ✅ Scenario 1: Normal File Download
```
1. Start dev server: npm run dev
2. Go to: http://localhost:5173/s/{valid-slug}
3. Should redirect to: http://localhost:5173/s/{valid-slug}/download
4. Should show: Loading spinner → "Download Ready"
5. Click "Download Now": File opens in new tab
```

### ✅ Scenario 2: File with Required Form
```
1. Go to: http://localhost:5173/s/{slug-with-form}
2. Should redirect to: http://localhost:5173/gate/{slug}
3. Should show: Form to fill out
4. Fill form and submit
5. Should open download URL in new tab
```

### ✅ Scenario 3: Expired File (410)
```
1. Go to: http://localhost:5173/s/{expired-slug}
2. Should redirect to: /s/{expired-slug}/download
3. DownloadPage fetches API
4. Backend returns 410 status
5. Should show: "Link Expired" message (NOT redirect to home!)
```

### ✅ Scenario 4: Missing File (404)
```
1. Go to: http://localhost:5173/s/{missing-slug}
2. Should redirect to: /s/{slug}/download
3. DownloadPage fetches API
4. Backend returns 404 status
5. Should show: "File not found" message (NOT redirect to home!)
```

### ✅ Scenario 5: Network Error
```
1. Open DevTools Network tab
2. Throttle to "Slow 3G"
3. Go to: http://localhost:5173/s/{valid-slug}
4. Should show: Loading spinner for several seconds
5. Then show: Download Ready state
6. (Or error state if it times out)
```

## What to Look For

### In Browser
- [ ] No homepage redirects on error
- [ ] Loading state appears while fetching
- [ ] Error messages are clear and specific
- [ ] Buttons work and navigate correctly
- [ ] Mobile responsive layout

### In DevTools Network Tab
```
GET /api/s/{slug}/config           ← ShortLinkRedirect checks config
GET /api/s/{slug}/download         ← DownloadPage gets download URL
GET /api/share/file/{id}/download  ← Actual file download
```

### In DevTools Console
- [ ] No JavaScript errors
- [ ] No CORS errors
- [ ] Download logs appear: `[Download] Fetching download URL...`
- [ ] ShortLink logs appear: `[ShortLink] Processing redirect...`

## Known Limitations (Pre-Backend Changes)

⚠️ The following will fail until backend is updated:

1. **410 Expired status** - Backend must return 410 for expired files
2. **File metadata** - Backend must return `isFileDownload` flag
3. **Download URL** - Backend must return absolute URLs
4. **CORS headers** - Backend must include `Access-Control-Allow-Origin`

See `DOWNLOAD_FIX_GUIDE.md` for backend requirements.

## Troubleshooting

### Problem: Page redirects to homepage
**Cause**: Catch-all route is catching the request
**Fix**: Verify routes in `src/App.jsx` - `/s/:slug/download` should come before catch-all

### Problem: Page shows 404 error
**Cause**: Component not found in import
**Fix**: Verify `src/pages/misc/DownloadPage.jsx` exists

### Problem: Loading spinner never stops
**Cause**: API request is stuck or not returning
**Fix**: Check DevTools Network tab for pending requests, check backend logs

### Problem: File won't download
**Cause**: Missing CORS headers or wrong Content-Disposition
**Fix**: Check network response headers in DevTools

### Problem: Wrong file name shows
**Cause**: API not returning `fileName` field
**Fix**: Backend should include file name in `/api/s/:slug/download` response

## Files to Check Before Testing

```
✅ src/App.jsx                             (routes updated)
✅ src/pages/misc/DownloadPage.jsx         (new component)
✅ src/pages/misc/ShortLinkRedirect.jsx    (file detection added)
✅ src/pages/misc/LeadGate.jsx             (file handling improved)
✅ DOWNLOAD_FIX_GUIDE.md                   (backend requirements)
✅ DOWNLOAD_FIX_SUMMARY.md                 (full implementation details)
```

## Success Criteria

✅ All of these should be true after implementation:

1. **Successful download works** - File downloads when link is valid
2. **No homepage redirect** - Expired/missing files show error, not redirect
3. **Clear error messages** - Users understand what went wrong
4. **Loading state visible** - Users see something while waiting
5. **Works on mobile** - Responsive design adapts to screen size
6. **No console errors** - Clean browser console
7. **CORS works** - No CORS error blocks the request
8. **Form flow works** - Can fill form before download
9. **All states display** - Loading, success, error, expired all work
10. **No infinite loops** - Doesn't keep trying to download failing files

---

**Ready to test!** 🚀

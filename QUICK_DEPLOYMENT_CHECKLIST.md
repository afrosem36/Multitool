# Quick Deployment Checklist ⚡

## 🔧 Pre-Deployment (Local Testing)

- [ ] Pull latest changes
- [ ] Run `npm install` (if needed)
- [ ] Run `npm run dev`
- [ ] Test URL shortener locally
  - Create a short link
  - Click it → should work ✓
- [ ] Test file sharing locally
  - Upload a file
  - Download link should work ✓
- [ ] Test report analyzer
  - Upload a report
  - Should show analysis ✓
- [ ] Check mobile layout
  - No overlapping content ✓
- [ ] Open DevTools (F12)
  - No errors in Console tab ✓

## 📦 Build for Production

```bash
# Build
npm run build

# Preview (optional)
npm run preview
```

- [ ] Build succeeds without errors
- [ ] No warnings in build output

## 🚀 Deploy to Production

```bash
# Deploy your hosting platform command
# Example: vercel deploy, netlify deploy, etc.
```

- [ ] Frontend deployed successfully
- [ ] Website is accessible at https://yourdomain.com

## ✅ Post-Deployment Testing

### Test Short Links
```bash
# In browser address bar, test:
https://yourdomain.com/s/your-slug
```

- [ ] Opens and processes correctly
- [ ] Redirects to destination URL (NOT homepage)
- [ ] No 404 errors
- [ ] Console shows [ShortLink] logs (F12 → Console)

### Test File Sharing
```bash
# Create a new file share link
# Copy the short link URL
# Test in new browser/private window
```

- [ ] File uploads successfully
- [ ] Short link appears
- [ ] Clicking link downloads/shows file
- [ ] Does NOT redirect to homepage

### Test URL Shortener
```bash
# Create a new short link
# Test the generated short link
```

- [ ] Link displays as full URL (https://...)
- [ ] Clicking link redirects to destination
- [ ] Custom slug validation works
- [ ] Duplicate slug validation works

### Test Report Analyzer
```bash
# Navigate to /ai-tools
# Click "Medical & Blood Report Analyzer"
```

- [ ] Page loads
- [ ] Can upload image/PDF
- [ ] Analyze button works
- [ ] Analysis displays correctly

### Test Mobile Layout
```bash
# Open DevTools (F12)
# Click device toggle (mobile view)
# Resize to mobile size
```

- [ ] No overlapping content
- [ ] Bottom navigation not covering content
- [ ] All buttons clickable
- [ ] File upload works

## 🐛 Debugging (if issues occur)

### Step 1: Open DevTools
```
Press F12 → Go to Console tab
```

### Step 2: Test Short Link
```
Navigate to: https://yourdomain.com/s/your-slug
Look for [ShortLink] log messages
```

### Step 3: Check Logs
```
Look for error messages like:
- [ShortLink] Processing redirect for slug: ...
- [ShortLink] API Base URL: ...
- [ShortLink] Fetching config from: ...
```

### Step 4: Verify API
```
In Console, run:
fetch('https://your-backend-domain.com/api/s/your-slug/config')
  .then(r => r.json())
  .then(d => console.log(d))
```

### Step 5: Check Network Tab
```
Open DevTools → Network tab
Test short link
Look for request to /api/s/slug/config
Check if it returns 200 OK
```

## 📝 Common Issues & Quick Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Redirects to homepage | No frontend route | ✅ Already fixed |
| "Short link not found" | Backend issue | Check backend logs |
| "Server error: 404" | API endpoint missing | Deploy backend |
| Mobile overlapping | CSS issue | ✅ Already fixed |
| Duplicate buttons | Component conflict | ✅ Already fixed |

## 📞 When to Contact Support

Contact your backend team if:
- [ ] API endpoint returns 404
- [ ] Backend logs show errors
- [ ] `/api/s/` endpoints not working
- [ ] Database connection issues

## ✨ Success Indicators

When everything works:
- ✅ Short links redirect correctly (not to homepage)
- ✅ File sharing downloads work
- ✅ URL shortener creates working links
- ✅ No console errors
- ✅ Mobile layout looks good
- ✅ Report analyzer loads and works

## 🎉 Deployment Complete!

Once all tests pass:
1. Monitor production for 24 hours
2. Check analytics for traffic patterns
3. Monitor error logs for any issues
4. Share with team/users

---

**Estimated time:** 30-45 minutes
**Difficulty:** Low (mostly testing)
**Risk level:** Low (backend-agnostic fixes)

Good luck! 🚀

# Flow Diagrams

## 1. Current Architecture (Before Fix)

```
User opens /s/{slug}
           ↓
   ShortLinkRedirect
           ↓
   Fetch /api/s/{slug}/config
           ↓
   ┌─────────────────────┬──────────────────────┐
   ↓                     ↓                      ↓
Form Found?         Direct Redirect?       Error ❌
   ↓                     ↓                      ↓
LeadGate         window.location          Show Error Page
   ↓             .replace()                But then...
Show Form              ↓                      ↓
   ↓             Navigate to              ❌ Redirect to /
   ↓             other website             (Catch-all route!)
Submit Form           ✓                      ❌ BAD UX!
   ↓
Get Download URL
   ↓
   ├─ If includes '/api/s/'
   │  and '/download'
   │  → window.open() ✓
   │
   └─ Otherwise
      → window.location.href ✓
```

**Problem**: No dedicated download page, errors might get caught by catch-all route

---

## 2. New Architecture (After Fix)

```
User opens /s/{slug}
           ↓
   ShortLinkRedirect
           ↓
   Fetch /api/s/{slug}/config
           ↓
   ┌──────────────────┬──────────────────┬──────────────────┐
   ↓                  ↓                   ↓                  ↓
File Download?    Form Found?         Direct URL?        Error?
   ↓                  ↓                   ↓                  ↓
✨NEW          LeadGate          window.location    Error Page
DownloadPage     Show Form        .replace() ✓      with Action
   ↓                  ↓                                Buttons
   ↓                Submit Form
   ↓                  ↓
Fetch             Get Response
/api/s/           ↓
{slug}/           API returns:
download          {
   ↓              longUrl,
   ↓              isFileDownload
   ├─200 ✓         (NEW FLAG)
   │ Download      }
   │ Ready!        ↓
   │ (File name,   If isFileDownload
   │  size,        OR includes /download:
   │  button)      window.open()
   │               ✓ CLEANER!
   ├─404 ✓
   │ File Not Found
   │ (Try Again btn)
   │
   └─410 ✓
     Expired
     (Contact creator msg)

All error states STAY on page
No redirect to homepage!
```

**Improvement**: Dedicated download page handles all states gracefully

---

## 3. Detailed DownloadPage State Machine

```
                    ┌─────────────────┐
                    │    START PAGE   │
                    └────────┬────────┘
                             │
                             ↓
                    ┌─────────────────┐
                    │   Loading State │──→ Spinner + "Preparing Download"
                    └────────┬────────┘
                             │
         Fetch /api/s/{slug}/download
         
         Response received?
         ↓
         ┌─────────────────────┬──────────────────┬──────────────┐
         ↓                     ↓                  ↓              ↓
      Status 200           Status 404        Status 410      Other Error
      (Success)          (Not Found)         (Expired)       (500, etc)
         ↓                     ↓                  ↓              ↓
    ✅ SUCCESS STATE      ❌ ERROR STATE    ⏰ EXPIRED STATE  ❌ ERROR STATE
         │                     │                  │              │
         │ Display:            │ Display:         │ Display:      │ Display:
         │ • File name         │ • Error icon     │ • Clock icon  │ • Alert icon
         │ • "Download Ready"  │ • "File not      │ • "Link       │ • Error message
         │ • Download button   │   found" msg     │   Expired"    │ • Try Again button
         │ • Back Home button  │ • Try Again btn  │ • "Ask        │ • Back Home button
         │                     │ • Back Home btn  │   creator..."│
         │                     │                  │ • Back Home   │
         ↓                     │                  │   button      │
    User clicks                │                  ↓              │
    "Download Now"             │           User clicks          │
         │                     │           "Return Home"       │
         ↓                     ↓                  ↓              ↓
    window.open()         navigate("/")    navigate("/")   navigate("/")
    (new tab)             OR                OR               OR
    File downloads        Try Again →      navigate("/")    Try Again →
    ✓ SUCCESS             Re-fetch API                      Re-fetch API
```

---

## 4. Request Flow Diagram

### Scenario: User opens /s/abc123 where abc123 is a file share

```
Browser
   ↓
/s/abc123
   │
   ├─ ROUTE 1: /s/:slug/download? NO
   ├─ ROUTE 2: /s/:slug? YES → ShortLinkRedirect.jsx
   │
   ├─ ShortLinkRedirect checks config
   │  GET /api/s/abc123/config
   │  Backend returns:
   │  {
   │    success: true,
   │    data: {
   │      isFileDownload: true,  ← KEY FLAG
   │      type: "file",
   │      fileName: "doc.pdf"
   │    }
   │  }
   │
   ├─ ShortLinkRedirect detects isFileDownload: true
   ├─ Calls: navigate(`/s/abc123/download`, { replace: true })
   │
   ├─ Browser now shows /s/abc123/download
   │
   ├─ ROUTE MATCH: /s/:slug/download? YES → DownloadPage.jsx
   │
   ├─ DownloadPage state: 'loading'
   │  Shows spinner + "Preparing Download"
   │
   ├─ DownloadPage fetches metadata
   │  GET /api/s/abc123/download
   │  Backend returns:
   │  {
   │    success: true,
   │    data: {
   │      downloadUrl: "http://api.com/api/share/file/xyz/download",
   │      fileName: "document.pdf",
   │      fileSize: 2048000,
   │      expiresAt: "2026-06-09T00:00:00Z"
   │    }
   │  }
   │
   ├─ Response status: 200
   ├─ DownloadPage state: 'success'
   ├─ Shows file name + download button
   │
   ├─ User clicks "Download Now"
   ├─ Calls: window.open(downloadUrl, '_blank')
   │
   ├─ Browser opens new tab
   ├─ New tab: GET /api/share/file/xyz/download
   │  Backend streams file data
   │  Sets header: Content-Disposition: attachment; filename="document.pdf"
   │  User's browser downloads the file
   │
   └─ ✅ SUCCESS! File downloaded, user still on DownloadPage
```

### Alternative Scenario: Expired File (410 status)

```
ShortLinkRedirect → navigate to /s/abc123/download
         ↓
    DownloadPage
         ↓
    GET /api/s/abc123/download
         ↓
    Backend returns: HTTP 410 (Gone)
    {
      success: false,
      error: "This file link has expired"
    }
         ↓
    Status code: 410 (matched in code)
    DownloadPage state: 'expired'
         ↓
    Shows:
    • Clock icon
    • "Link Expired"
    • "Contact the creator for a new share link"
    • "Return Home" button
         ↓
    ✅ User sees clear message instead of homepage redirect!
```

---

## 5. Component Dependency Graph

```
App.jsx
   │
   ├─ Layout (wrapper for most routes)
   │   └─ Many page components...
   │
   ├─ ShortLinkRedirect ✓ (MODIFIED)
   │   └─ Uses: API, useNavigate
   │   └─ Calls: navigate() to DownloadPage when isFileDownload
   │
   ├─ DownloadPage ✨ (NEW)
   │   └─ Uses: API, useNavigate
   │   └─ Manages: 4 states (loading, success, error, expired)
   │   └─ Status codes: 200, 404, 410
   │
   ├─ LeadGate ✓ (MODIFIED)
   │   └─ Uses: API, isFileDownload flag
   │   └─ Opens downloads in new tab
   │
   └─ ExpiredLink
       └─ Static page (complementary component)
```

---

## 6. API Contract Diagram

```
Frontend                          Backend
   │                                 │
   ├─ GET /api/s/{slug}/config       │
   │─────────────────────────────────→
   │                    Returns:      │
   │  ┌──────────────────────────────┐│
   │  │ {                            ││
   │  │   data: {                    ││
   │  │     isFileDownload: bool ← NEW││
   │  │     type: "file"|"url"       ││
   │  │     fileName: string (opt)   ││
   │  │     requiresDataCollection   ││
   │  │     formConfig               ││
   │  │   }                          ││
   │  │ }                            ││
   │  └──────────────────────────────┘│
   │                    ← ── ── ── ──│
   │
   │  (if isFileDownload)
   │
   ├─ GET /api/s/{slug}/download     │
   │─────────────────────────────────→
   │                    Returns:      │
   │  ┌──────────────────────────────┐│
   │  │ Status 200:                  ││
   │  │ {                            ││
   │  │   data: {                    ││
   │  │     downloadUrl: string      ││ ← MUST be absolute URL
   │  │     fileName: string         ││
   │  │     fileSize: number (opt)   ││
   │  │     expiresAt: ISO string    ││
   │  │   }                          ││
   │  │ }                            ││
   │  │                              ││
   │  │ Status 404:                  ││
   │  │ { error: "File not found" }  ││
   │  │                              ││
   │  │ Status 410:                  ││
   │  │ { error: "File expired" }    ││
   │  └──────────────────────────────┘│
   │                    ← ── ── ── ──│
   │
   │  (if downloadUrl received)
   │
   ├─ GET {downloadUrl}              │
   │─────────────────────────────────→
   │  (opens in new tab)              │
   │                  Streams file    │
   │  Headers:        │
   │  ├─ Content-Type: application/pdf│
   │  ├─ Content-Disposition:         │
   │  │  attachment; filename="..."   │
   │  ├─ Content-Length               │
   │  └─ Access-Control-Allow-Origin  │
   │                    ← file data ──│
```

---

## 7. Browser History (What User Sees)

```
User Journey for File Download:

Timeline                         URL in Address Bar         Page Content
─────────────────────────────────────────────────────────────────────────
1. Click download link
   ↓
2. Navigate to                  /s/abc123                  ShortLinkRedirect
   Fetching config...           (same)                     Loading...
   ↓
3. Config received,             /s/abc123/download         DownloadPage
   isFileDownload: true          (replaced - user          Preparing...
   Redirecting...                doesn't see old URL)       (Loading state)
   ↓
4. API returns 200              /s/abc123/download         DownloadPage
   with downloadUrl             (same)                     ✓ Download Ready!
   ↓
5. User clicks                  /s/abc123/download         DownloadPage
   "Download Now"               (same)                     Still shows
                                                           "Download Ready"
   ↓
   New tab opens →              /api/share/file/xyz/download
                                                           Browser's
                                                           download dialog
   ↓
6. File downloads               /s/abc123/download         DownloadPage
   to user's computer           (original tab)             (user can see
                                                           it succeeded)

✅ User is happy! Clear flow, no mysterious redirects.
```

---

## 8. State Transitions Detail

```
DownloadPage Component State Machine:

Initial State: 'loading'
┌─────────────────────────────────────┐
│ useEffect runs on mount             │
│ → fetchDownload()                   │
│ → setState('loading')               │
└────────────┬────────────────────────┘
             │
             ↓ Async fetch begins
             │
    ┌────────────────────────────────────┐
    │ try {                              │
    │   GET /api/s/:slug/download        │
    │ }                                  │
    └────┬────────────────────────┬──────┘
         │                        │
    Success                   Catch error
         │                        │
         ↓                        ↓
  ┌────────────────────┐  ┌──────────────┐
  │ Check status code  │  │ setState     │
  │ (200|404|410|other)│  │ ('error')    │
  └──┬──────┬───┬──┬───┘  └──────────────┘
     │      │   │  │
   200    404  410 Other
     │      │   │  │
     ↓      ↓   ↓  ↓
  success error expired error
     │      │   │  │
     └──────┼───┼──┘
            ↓
     setState('state')
            ↓
     Component re-renders
     with appropriate UI
```

---

## 9. Error Recovery Flow

```
User sees error state
        ↓
┌───────────────────┐
│ Option 1: Try     │  → Reload page
│ Again Button      │     (or call fetch again)
└───────┬───────────┘
        │
        └─→ Fetch /api/s/{slug}/download again
            ↓
            ├─ If fixed: setState('success')
            │
            └─ If still error: setState('error') (same state)
                   (User can try again)

┌────────────────────┐
│ Option 2: Return   │  → navigate("/")
│ Home Button        │     Go to homepage
└────────────────────┘

Both options keep user informed and in control.
❌ NO invisible redirects!
```

---

**These diagrams show the complete flow from user click to successful download, and how errors are handled gracefully.**

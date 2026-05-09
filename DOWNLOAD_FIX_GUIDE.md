# File Download Fix - Backend Requirements

## Overview
The frontend has been updated to handle file downloads with proper loading, success, error, and expired states. The backend API needs to be updated to support these requirements.

## Frontend Changes
- ✅ New `DownloadPage` component created with proper UX states
- ✅ Routes updated to handle `/s/:slug/download` path
- ✅ ShortLinkRedirect now detects file downloads and redirects appropriately

## Backend API Requirements

### 1. **Endpoint: GET `/api/s/:slug/config`**
**Purpose**: Get metadata about a shared link (used by ShortLinkRedirect)

**Response (Success - 200)**:
```json
{
  "success": true,
  "data": {
    "isFileDownload": true,  // IMPORTANT: indicates this is a file download
    "type": "file",          // or "url" for regular redirects
    "fileName": "document.pdf",
    "fileSize": 1024000,
    "expiresAt": "2026-06-09T12:00:00Z",
    "requiresDataCollection": false,
    "formConfig": null
  }
}
```

**Response (Expired - 410)**:
```json
{
  "success": false,
  "error": "This file has expired"
}
```

**Response (Not Found - 404)**:
```json
{
  "success": false,
  "error": "File not found or expired"
}
```

---

### 2. **Endpoint: GET `/api/s/:slug/download`**
**Purpose**: Get the download URL and file metadata (used by DownloadPage)

**Required CORS Headers**:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

**Response (Success - 200)**:
```json
{
  "success": true,
  "data": {
    "downloadUrl": "/api/share/file/:id/download",  // Absolute URL recommended
    "fileName": "document.pdf",
    "fileSize": 1024000,
    "expiresAt": "2026-06-09T12:00:00Z",
    "mimeType": "application/pdf"
  }
}
```

**Response (File Not Found - 404)**:
```json
{
  "success": false,
  "error": "File not found. The share link may have been deleted."
}
```

**Response (Expired - 410)**:
```json
{
  "success": false,
  "error": "This file link has expired. Please ask the creator for a new share link."
}
```

**Response (Server Error - 500)**:
```json
{
  "success": false,
  "error": "Unable to generate download link"
}
```

---

### 3. **Endpoint: GET `/api/share/file/:id/download`** (or similar)
**Purpose**: Serve the actual file download

**Requirements**:
- Set proper `Content-Disposition: attachment; filename="..."` header
- Set `Content-Type` based on file type
- Return actual file data with 200 status
- Return 404 if file doesn't exist
- Return 410 if file has expired

**Example Response Headers**:
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="document.pdf"
Content-Length: 1024000
Access-Control-Allow-Origin: *
```

---

### 4. **Validation Checklist**

Before each API response:

- [ ] File exists in storage
- [ ] File hasn't expired (compare `expiresAt` with current time)
- [ ] User has access to the file (if access control is needed)
- [ ] Download URL is complete and absolute (starts with `http://` or `https://`)
- [ ] All CORS headers are present (especially `Access-Control-Allow-Origin`)

---

## Implementation Priority

### High Priority (Must Fix)
1. ✅ Return proper status codes:
   - `404` for missing files
   - `410` for expired files  
   - `200` for success
2. ✅ Add CORS headers to `/api/s/:slug/download` endpoint
3. ✅ Return complete download URLs (not relative)
4. ✅ Include proper error messages in JSON responses

### Medium Priority (Recommended)
1. Add `isFileDownload` or `type: "file"` flag to config endpoint
2. Include file metadata (fileName, fileSize, expiresAt)
3. Log download failures for debugging

### Low Priority (Nice to Have)
1. Track successful downloads for analytics
2. Add rate limiting to prevent abuse
3. Support custom expiry messages

---

## Testing

### Test Case 1: Successful Download
```
1. Create a fresh file share link
2. Navigate to `/s/{slug}/download`
3. DownloadPage should show "Download Ready"
4. Click "Download Now" button
5. File should download in new tab
```

### Test Case 2: Expired File
```
1. Create a file share link with 1-minute expiry
2. Wait 2 minutes
3. Navigate to `/s/{slug}/download`
4. DownloadPage should show "Link Expired" error
5. API should return 410 status
```

### Test Case 3: Missing File
```
1. Delete a file from storage
2. Navigate to `/s/{slug}/download`
3. DownloadPage should show "File not found" error
4. API should return 404 status
```

### Test Case 4: LeadGate Form Then Download
```
1. Create file share with form requirement
2. Navigate to `/s/{slug}`
3. Should show form (not download page)
4. Submit form
5. Should redirect to `/api/s/{slug}/download` in new tab
6. File should download
```

---

## Common Issues & Solutions

### Issue: Download redirects to homepage
**Cause**: Form submission redirects to wrong URL format
**Fix**: Ensure API returns complete download URL: `${API_BASE_URL}/api/s/{slug}/download` or full external URL

### Issue: CORS error on download
**Cause**: Missing `Access-Control-Allow-Origin` header
**Fix**: Add CORS headers to download endpoint

### Issue: File downloads but with wrong name
**Cause**: Missing `Content-Disposition` header
**Fix**: Always set `Content-Disposition: attachment; filename="..."`

### Issue: Status code 200 but file doesn't exist
**Cause**: Server doesn't validate file before responding
**Fix**: Always check file existence before sending 200 response

---

## Code Examples

### Node.js / Express Example
```javascript
app.get('/api/s/:slug/download', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    
    // Fetch file metadata
    const file = await getFileBySlug(slug);
    
    // Check if file exists
    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found or expired'
      });
    }
    
    // Check if expired
    if (new Date(file.expiresAt) < new Date()) {
      return res.status(410).json({
        success: false,
        error: 'This file link has expired'
      });
    }
    
    // Return download URL
    const downloadUrl = `${process.env.API_URL}/api/share/file/${file.id}/download`;
    res.json({
      success: true,
      data: {
        downloadUrl,
        fileName: file.name,
        fileSize: file.size,
        expiresAt: file.expiresAt,
        mimeType: file.mimeType
      }
    });
  } catch (error) {
    console.error('[Download API] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to prepare download'
    });
  }
});
```

### Cloudflare Workers Example
```javascript
export async function handleDownload(request, { slug }) {
  try {
    // Add CORS headers
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    // Handle OPTIONS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    // Fetch file metadata
    const file = await DB.getFile({ slug });
    
    if (!file) {
      return new Response(
        JSON.stringify({ success: false, error: 'File not found' }),
        { status: 404, headers }
      );
    }

    if (new Date(file.expiresAt) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: 'File expired' }),
        { status: 410, headers }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          downloadUrl: `${URL.origin}/api/share/file/${file.id}/download`,
          fileName: file.name,
          fileSize: file.size,
          expiresAt: file.expiresAt
        }
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('[Download] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
```

---

## Notes for Backend Developer

1. The frontend **no longer** attempts to redirect `/api/s/:id/download` URLs directly
2. Downloads now go through a dedicated page component with proper error handling
3. The API must return proper HTTP status codes (not always 200)
4. CORS headers are essential for the download flow to work
5. Expired files should return 410, not 404
6. Test with network throttling to ensure loading state displays properly

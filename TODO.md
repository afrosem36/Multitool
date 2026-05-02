# Background Changer Update Plan

## Task: Remove 20MB size limit from Admin Panel Background Changer

### Information Gathered:
1. **GlobalBackground.jsx** - Already supports both images AND videos correctly
   - Detects type using `file.type.startsWith('video')` 
   - Renders `<video>` element for video type, `<img>` for image type
   - Has fallback handling with onError

2. **AdminPage.jsx** - Has upload functionality with 20MB size limit
   - Current check: `if (file.size > 20 * 1024 * 1024)`
   - This check needs to be removed to allow unlimited file sizes

### Plan:
1. Remove the 20MB size check from AdminPage.jsx `handleFileChange` function
2. Test that uploads work properly

### Changes Made:
- Updated size limit from 20MB (20 * 1024 * 1024) to 3GB (3000000 * 1024)
- Error message updated to "max 3GB"

### Dependent Files:
- src/pages/AdminPage.jsx

### Followup Steps:
- Push changes to Git ✓

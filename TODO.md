# Fix "Mark as Complete" Issue

## Current Status
- [x] Analyzed the issue: API URL mismatch in Dashboard.js
- [x] Fix API URL in Dashboard.js handleComplete function
- [x] Test the fix - Backend and frontend are running

## Details
The backend registers the authority blueprint with `url_prefix='/api'`, but the frontend is calling `/authority/complete/...` instead of `/api/authority/complete/...`, causing 404 errors.

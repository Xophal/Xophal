Bulk Import Guide

Use the admin bulk import UI at the Admin → Content → Imports page to upload CSV, JSON, or XLSX files and validate them before processing.

Quick steps

1. Sign in to the app as an admin user.
2. Open the Admin area: /admin/content/imports
3. Select the Entity Type (e.g., `questions`, `mock_tests`, `lessons`, `notes`).
4. Choose a file (CSV, JSON, or XLSX) and click `Preview Import`.
5. Review the preview, fix any issues, then let the page trigger processing or call the processing endpoint manually.

File formats

- CSV: simple header row with columns matching the entity fields. See `docs/import-samples` for examples.
- JSON: pass an array of objects or `{ "rows": [ ... ] }`.
- XLSX: first worksheet is used.

Processing

- The UI will POST to `/api/admin/imports/upload` (multipart) or `/api/admin/imports` (JSON) to create a validated import job.
- The UI will attempt to POST `/api/admin/imports/process` to start processing; you can also trigger this manually from the server or via curl (requires admin auth).

Notes

- Import runs as the authenticated admin; ensure your account has admin privileges.
- The server validation will produce a preview with `issues` and `previewRows` to inspect row-level problems before inserting.

If you want, I can:
- Add a small admin form to create single items (posts/lessons) from the UI.
- Add more sample CSVs for `lessons`, `notes`, and `topics`.

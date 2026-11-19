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

## Question Bank CSV/XLSX imports

The Question Bank importer is at `/admin/qbank/import`. It is separate from the
general CMS importer above and only imports objective choice questions today.

1. Select the board, class, subject, and optional default chapter/topic.
2. Select a UTF-8 `.csv` or `.xlsx` file and choose its initial status and duplicate policy.
3. Review the auto-detected column mapping. Change it in the preview if needed, then select **Apply column mapping**.
4. Inspect the first 50 rows and validation/duplicate counts. Invalid rows are not imported.
5. Select **Import validated rows** to start the server-side job. Check the Import History list for its final status.

File limits are 10 MB and 5,000 data rows. Legacy `.xls` workbooks, executable signatures,
XLSX formulas/rich-text cells, invalid UTF-8, unknown chapters/topics, and rows without
a valid question, two options, and correct answer are rejected. Header detection accepts
common aliases such as `question`, `question_text`, `option_a`, `correct_answer`,
`neg_marks`, `difficulty`, `chapter`, and `topic`. Chapter/topic cell values must match
active catalog names; otherwise choose defaults or fix the source values.

Imports default to **Pending review** and cannot silently overwrite a question. The
**Skip** policy omits detected duplicates; **Import separately** requires the admin to
choose that policy explicitly. The current importer does not implement a merge/update
policy. Auto-approval is available only to `admin`/`super_admin` roles.

Templates are downloadable from `/api/admin/qbank/templates/single_correct`,
`/api/admin/qbank/templates/multiple_correct`, and `/api/admin/qbank/templates/true_false`.
Import errors and possible duplicates can be downloaded from the staged batch preview.

### Question Bank schema and migration

The importer reuses the existing normalized `questions`, `question_options`, and
`question_answers` tables and adds import metadata, version/duplicate tracking, and
indexes via `050_question_bank_bulk_import.sql` and `051_question_bank_rls.sql`.
`054_question_review_audit_trigger.sql` records initial and subsequent engine-status
transitions. `056_qbank_import_transaction_and_test_snapshots.sql` adds the transactional
import RPC and published mock-test snapshot tables. Migration `052_secure_ebook_delivery.sql` and the separate `053_*` migration
are unrelated. Source migrations are not proof that the remote database has been updated.

For local development, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
and server-only `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`; never expose the service-role
key to browser code. Start Supabase with `npm run db:start`, then apply migrations to a
local or development project with `npx supabase db push`. Do not push this additive
migration set to production before reviewing it and validating RLS on a non-production DB.

The staged API still performs preview and duplicate detection synchronously, but execution
is handed to `import_question_batch` for server-side row processing and per-row savepoints.
It is not a background worker and does not provide crash-safe retry queues; keep imports
within the listed limit and inspect the batch result. Published tests are snapshot when
published through `publish_mock_test_snapshot`, and the existing attempt paper snapshot
protects historical student answers from later question edits.

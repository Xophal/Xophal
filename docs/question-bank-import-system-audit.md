# Xophal Question Bank and Bulk Import Audit

**Audit date:** 2026-11-19
**Scope:** Repository source, migrations, route handlers, UI, tests, and setup documentation.
**Live database access:** Not available in this workspace. Applied migration state, production RLS, and live row counts could not be verified. No production data was queried or changed.

## 1. Architecture summary

- **Application:** Next.js 16 App Router under `src/app`, TypeScript strict project configuration, Tailwind CSS and local Radix-based UI components. Admin, student, creator, auth, and marketing route groups are present.
- **Persistence:** Supabase/PostgreSQL is the runtime database. Migrations live in `supabase/migrations`; `prisma/schema.prisma` is a second schema description and is not the runtime path used by the inspected routes. Generated Supabase types are in `src/types/database.types.ts`.
- **Authentication:** Supabase cookie-based sessions, role-bearing `profiles`, route-level `requireAdminAuth` / `requireAdminRole`, and `src/proxy.ts` routing checks. Sensitive routes use a server-only-by-convention service-role Supabase client after checking the caller.
- **Taxonomy:** Dynamic `boards → classes → subjects → chapters → topics → subtopics`; the database contains seed data but admin screens manage academic taxonomy. Questions connect through taxonomy foreign keys.
- **Question bank:** There are two related paths: a legacy question editor/API (`/api/admin/questions`, attached to `mock_test_questions`) and an engine-aware question bank (`/api/admin/engine/questions`, `engine_*` columns, separate `question_answers`, `question_tags`, and `question_stats`). The latter supports a server-paginated list, editor, CSV import, and review transitions.
- **Tests:** Legacy `mock_tests → mock_test_questions → test_attempts/test_responses` is student-facing. The newer blueprint engine uses `blueprints → test_instances → test_instance_questions → attempts/attempt_answers`. Migration 046 adds frozen paper/answer snapshots for the legacy mock-test flow; the engine also freezes a generated test instance.
- **Validation/testing:** Zod, Vitest unit/integration suites, Playwright smoke tests, deployment checks, and import examples are already configured.

## 2. Existing functionality and status

| Area | Status | Findings |
|---|---|---|
| Dynamic boards/classes/subjects/chapters/topics | **Already implemented** | Taxonomy tables, public active catalog routes, admin CRUD routes/pages, and seeded CBSE/SEBA data exist. Subjects belong to classes; board/class are not directly stored on engine questions. |
| Engine question editing | **Partially implemented** | Nine engine kinds are modeled; manual create/edit, options, answers/rubrics, filters, pagination, archive, and a review queue are present. Several requested question behaviors are not completely validated or represented. |
| Review and approval | **Partially implemented** | Engine statuses are `draft`, `reviewed`, `published`, `retired`; reviewer metadata is stored. Requested `pending review`, `rejected`, and `archived` are represented only inconsistently in the legacy status model. The history table exists but normal service transitions do not write it. |
| Engine CSV import | **Partially implemented** | RFC-4180-style parsing and a 500-row cap exist, and rows are validated before writes. The service then inserts each question and side table separately, with no transaction; a later failure can leave a partial import. It lacks database duplicate detection and column mapping. |
| Generic CSV/XLSX/JSON imports | **Partially implemented; needs improvement** | Upload, validation, `import_jobs`, and a processing route exist. The process route supports some entities and has material correctness/security gaps (see findings below). |
| Import history | **Missing as an admin feature** | `import_jobs` records data, but the inspected API offers job creation and processing only; no admin history/detail UI or read endpoint was found. |
| Test authoring | **Partially implemented** | Admin can create, edit, publish, and add/remove/reorder/section questions. Selection is a limited legacy interface, not a fully filtered scalable selector or random/distribution builder. |
| Student test catalog and attempts | **Partially implemented** | `/api/mock-tests` and the test runner use actual published tests. `/admin` and authenticated attempt endpoints exist. The student `/tests` page contains static sample data but immediately redirects to `/mock-tests`, making that sample view unreachable. |
| Historical test content | **Partially implemented** | Frozen attempt papers and response snapshots preserve the paper as sat. Published-test editing does not create a formal immutable test version; some question relationship changes unpublish the test, while content edits can still affect later attempts. |
| Media/math rendering | **Missing or incomplete** | Image URL fields and a general upload flow exist, but the question editor has no integrated question/option storage upload. No KaTeX or equivalent math-renderer dependency was found in the manifest. |
| Tests | **Already implemented, coverage incomplete** | Unit, integration, and E2E test infrastructure covers auth, import basics, question bank, generator, and attempt APIs. The end-to-end import→review→publish→student workflow and dedicated import abuse/security tests were not found. |

## 3. Database entities and relationships

### Requested entities

| Entity | Existing table/model | Columns and relationships (summary) | Status |
|---|---|---|---|
| Boards | `boards` | UUID id, unique code/slug, name, active flag, metadata. Parent of classes. | Exists |
| Classes | `classes` | UUID id, `board_id` FK, code/name/slug, grade, active flag; unique board+slug. | Exists |
| Subjects | `subjects` | UUID id, `class_id` FK, code/name/slug, active flag; unique class+slug. | Exists |
| Chapters | `chapters` | UUID id, `subject_id` FK, name/code/slug, chapter number, active flag; unique subject+slug. | Exists |
| Topics | `topics` | UUID id, `chapter_id` FK, name/code/slug, active flag; unique chapter+slug. | Exists |
| Subtopics | `subtopics` | Added in migration 013; UUID id, `topic_id` FK, code/name/slug, active flag; unique topic+slug. | Exists |
| Questions | `questions` | UUID id; taxonomy/type/difficulty/language FKs; text/HTML/image, marks, tags, active/verified, creator, timestamps. Migrations add engine type/stem/parent/subtopic/difficulty/skill/negative marks/time/board pattern/year/lang/workflow/source. | Exists; hybrid/duplicated representations |
| Question options | `question_options` | UUID id, question FK, text/HTML/image, correctness flag, sort order; engine migration adds label/body/position. | Exists |
| Question drafts | No separate table | Draft is a status on `questions`; review states are split between legacy and engine enums. | No separate table; not necessarily needed |
| Tests | `mock_tests`; also `blueprints` | `mock_tests` has type, slug/title, subject/chapter, totals, duration, access, publication, and behavior settings. Blueprints are a separate engine authoring construct. | Exists in two flows |
| Test questions | `mock_test_questions`; `test_instance_questions` | Legacy unique `(mock_test_id, question_id)`; engine unique `(instance_id, question_id)` with position and score snapshots. | Exists in two flows |
| Test attempts | `test_attempts`; `attempts` | Legacy attempt references mock test; engine attempt references a frozen instance and has deadline/status. | Exists in two flows |
| Attempt answers | `test_responses`; `attempt_answers` | Legacy responses unique `(attempt_id, question_id)`; engine answers are unique per attempt/question. | Exists in two flows |
| Profiles | `profiles` | UUID id references `auth.users`; role, board/class, account, profile, and progression fields. | Exists |

### Question-bank support tables

- `question_answers`: one answer/rubric/explanation row per question; restricted RLS is intended to keep keys out of student attempt payloads.
- `question_tags`, `question_stats`, `question_review_history`: tags, aggregate statistics, and review-audit history.
- `question_translations`, `question_option_translations`: translation records.
- `import_jobs`: uploader, entity/format/status, filename, row counts, validation report, preview data/options, timestamps. It has no import-batch FK on questions.
- Indexes include taxonomy FKs, type/difficulty/active fields, a GIN English text-search index, status/language, import owner/date, engine test-instance ordering, and attempt lookups. Dedicated composite indexes for the full bank filter set and engine status are not evident.

### Constraints and migration history

- Major relationships use UUID primary keys and foreign keys; legacy test-question uniqueness and engine frozen-instance uniqueness are present.
- Migration history in source includes the initial schema, RLS and authorization hardening, import jobs, storage, workflow and engine migrations, frozen test snapshots, review history, and later security/payment work. The current worktree includes question-bank migrations `050`, `051`, and `054`; separate `052`/`053` migration files may exist for other features.
- Source migration files do **not** prove which migrations are applied to a particular Supabase project. Live migration history, actual indexes, table contents, and effective policies require deployment credentials/access and remain unverified.

## 4. Security findings

### Critical/high-priority

1. **[Critical correctness/security] The engine CSV route accepts row-level `status`, including `published`.** Although its `defaultStatus` only chooses draft/reviewed, the CSV schema accepts all engine statuses and `bulkCreateEngineQuestions` uses each row's status. This bypasses the intended “imports never auto-publish” behavior for any admin who can invoke the route. No stricter role gate or separate approval is applied.
2. **[High] Import completion can be falsely reported.** Generic processing logs and skips individual question/option insert errors, increments processed counts even if option insertion fails, and then marks the job `COMPLETED`. Status update errors are ignored. It also has no atomic transaction or guarded `VALIDATED → IMPORTING` compare-and-set, making repeated/concurrent processing and partial results possible.
3. **[High] Generic XLSX upload has no row-count limit.** It accepts up to a 10 MB upload, parses all rows into memory, and stores the entire file-derived payload in `import_jobs.preview_data`. The UI automatically triggers processing after upload rather than requiring an explicit review/confirmation step. `.xls` is accepted by extension but passed to the XLSX parser, and parsing does not robustly validate workbook content or dangerous cell types.
4. **[High] Engine writes are not transactionally consistent.** Question, options, answers, and tag/stats writes are multiple requests. Some failed side-table reads/writes are ignored; options can be deleted before a failed replacement. Import has the same partial-write risk.
5. **[High] Question edits mutate the shared current bank row.** Test attempts have snapshots, but the bank question/answer is shared; old/published test definitions do not universally hold an immutable version snapshot. Later attempts on a test may receive updated content/key.

### Other security and integrity observations

- Route-level authorization exists for inspected admin question/import/test endpoints, and service-role use is server-side; the key is not imported by client components. However, the broad generic CMS importer currently allows all admin-role users, without a separate high-privilege auto-approval policy.
- RLS migrations restrict question/options to admin/reviewer and separate `question_answers`; sanitized attempt RPCs omit `is_correct`, answers, rubrics, and explanations before submission. The answer solution RPC checks attempt ownership and submitted status. These properties are supported by source only and need live-role verification.
- `import_jobs` RLS has an owner/admin read policy; route writes bypass RLS using service-role credentials and depend on every route enforcing auth and ownership. Processing checks ownership but does not check job state atomically.
- No question-import rate-limit call was found in either import route. `checkRateLimit` itself deliberately fails open for backing-store errors, so it is not a robust abuse guard unless the deployment has a healthy limiter and policy.
- The generic import Zod schema permits arbitrary entity strings/JSON record values; row validation is shallow. The import route sanitizes CSV search in the public test catalog, but imported content and HTML fields need consistent rendering/validation policy.
- Storage migration creates a **public** bucket with public reads and permits authenticated users to upload a limited MIME set to their own folder. This is not a dedicated, admin-only question-media policy.
- `question_review_history` RLS and indexes exist, but ordinary engine state transitions update columns and do not insert this table. The migration itself notes lack of comprehensive transition capture.
- SQL injection is not evident in the inspected data queries (Supabase query builder and parameterized RPC calls); HTML/XSS risk depends on render paths for `question_html`/`explanation_html`, which should be checked before enabling arbitrary HTML imports.
- Profile privilege fields have a protection trigger and client insert revocation in migration 005. Admin roles are checked server-side; the legacy authorization audit document is stale and contradicts current admin APIs/pages.

## 5. Gaps against requested capabilities

- One canonical question lifecycle with `Draft`, `Pending Review`, `Approved`, `Rejected`, and `Archived`, including rejection reason and immutable review history.
- A centralized workflow that does not split between legacy mock-test questions and engine questions.
- Database-driven question board/class selection plus multi-dimensional filters (subject/chapter/topic/subtopic, language, import batch/date, creation date, status, and sorting).
- Dashboard counts/analytics for total, approved, pending, draft, rejected, duplicates, taxonomy breakdown, and recent imports.
- Complete per-type manual answer validation for every subjective and objective format remains dependent on per-database vocabulary and final editor QA.
- Saved column-mapping templates and a durable background/retry worker remain outside the synchronous migration-backed RPC workflow.
- Integrated admin-safe question and option image storage and KaTeX rendering are not yet a complete end-to-end authoring workflow.
- Live board/class/subject eligibility filtering and full requested recommendation/history surfaces require production profile and entitlement data verification.
- End-to-end browser tests and deployed RLS/security verification remain required even though focused route tests and the local build pass.

## 6. Potential conflicts and performance concerns

- **Two question/test engines** are active architectural paths. Replacing either would risk existing student attempts, seeded data, and existing tests. The engine bank currently feeds the legacy test builder only when questions are also legacy `published` and recognized as usable MCQ; engine `published` status is dual-written for compatibility.
- `engine_type` and legacy `question_type_id`, `engine_status` and legacy `status`, `stem` and `question_text`, plus duplicated option columns need consistent writes. Ad hoc updates in the generic importer do not fully construct all engine side tables.
- Board pattern is an enum on engine questions (`CBSE`, `SEBA`, `OTHER`), not an FK to boards; class is inferred through subject. Do not hardcode taxonomy or add duplicate classification until this mapping is resolved.
- The editor vocab endpoint caps topic options at 200 and subtopics at 500. The legacy test builder fetches up to 200 available questions and loads all currently attached questions. These are bounded but omit pagination and can hide eligible content.
- Question filter search uses `ILIKE` on `question_text` and does not use the existing GIN full-text index. The generic admin question route returns a paginated list but the admin import page and job storage can retain a large parsed payload.
- Row-by-row engine import is sequential and multiple round-trips per question; bulk insert without transaction/RPC would not be a safe scalability fix. Large imports need durable staged rows/jobs and a server-side transaction/batch function.
- Prisma enums/models and Supabase migrations are separate schemas and may diverge; migration SQL and generated Supabase types must remain the source of truth for runtime.

## 7. Recommended implementation sequence

1. **Protect the existing platform:** force imported engine questions to draft; make import job transitions atomic/idempotent; fail the job if any row/side-table fails; enforce row/file/input limits and explicit preview confirmation.
2. **Complete auditability and transaction boundaries:** add a server-side transactional import primitive and question create/update transaction or RPC; write review history for every transition; record per-row results and retries.
3. **Unify lifecycle and academic filters:** adopt one compatible lifecycle mapping, add question import-batch association and board/class filtering through taxonomy relationships, and expose counts plus server-side pagination/sorting.
4. **Complete importer UX:** map CSV/XLSX headers to the existing engine schema, validate each row, resolve academic defaults, detect duplicates, support deliberate duplicate policies, export errors/templates, and expose import history.
5. **Protect historical test content:** snapshot question/options/answer/marks into immutable published test versions or frozen papers; then adapt the existing builder to select/version bank questions rather than create duplicate storage.
6. **Complete authoring and review UX:** validate all types and objective grading, add bulk review/rejection, media upload and safe math rendering, and connect question analytics.
7. **Integrate student eligibility/results:** connect actual published versions to board/class/subject, windows, and entitlements; keep keys hidden until configured release.
8. **Verify:** unit/integration/E2E/security tests and role-by-role RLS checks on a disposable Supabase environment. Never apply destructive/production migrations as part of this work.

## 8. Implementation scope initiated after audit

The audit identifies the most urgent compatible changes as import integrity and question review correctness. Any implementation should use additive/reversible migrations and preserve both existing test engines until migration can be verified. A full production rollout still requires a deployed Supabase environment for transactional/RLS tests and explicit validation of applied migrations.

## 9. Audit and implementation checkpoint — 2026-11-20

The source audit above was checked against the current worktree before implementation. This is a source review only: the project has no configured live database credentials in this session, so no claim is made about deployed rows, applied migrations, or effective production RLS.

### Findings by classification

| Classification | Findings |
|---|---|
| **Already implemented** | Next.js App Router, strict TypeScript configuration, Tailwind/local Radix UI, Supabase session and role helpers, dynamic academic taxonomy, legacy and engine question/test flows, server-paginated engine list, attempts and frozen attempt snapshots, Zod, Vitest and Playwright. |
| **Partially implemented** | Question CRUD/review, bank filters, question version snapshots, CSV import, XLSX/CSV generic imports, import job history data, test construction, student test catalog/attempt handling. Two parallel question/test paths remain and have not been merged. |
| **Missing** | Full production end-to-end import→review→test→student workflow; a durable asynchronous worker and row-level retry/idempotency; complete random/distribution test builder; complete editor for all nine objective/subjective formats; math rendering and dedicated question-media upload; exhaustive advanced filter controls and analytics; saved mapping templates; live RLS verification. |
| **Needs improvement** | Existing question-bank files were malformed and failed TypeScript parsing; legacy question search/listing is incomplete; importer accepted `.xls` as XLSX and had incomplete option/answer validation, unbounded duplicate comparison, non-atomic multi-table writes, and no manual mapping/history UX. Import processing is still synchronous and reports partial row failures rather than providing a durable worker. |
| **Critical security/integrity issue (source-level)** | Generic import processing can skip failed question/option inserts yet report completion; the engine CSV import accepts row status that can be `published`; imported question content has no full transaction boundary. These findings are based on inspected route/service code, not exploitation or live testing. |

### Work completed in this pass

- Repaired malformed Question Bank question service, import service, and listing page; restored a syntactically valid server-paginated list and usable API response handling.
- Added dynamic Question Bank summary counts, import-history visibility, admin navigation, and a dedicated CSV/XLSX import page.
- Added upload size/row caps, strict UTF-8 CSV handling, XLSX signature checks, rejection of legacy `.xls` and executable signatures, basic formula/rich-text cell rejection, header auto-mapping, row validation, manual column remapping, duplicate preview, explicit import confirmation, and a downloadable validation/error report.
- Added owner/admin checks, high-privilege-only auto-approval, a compare-and-set `validated → importing` transition, row-level failures, and status finalization that does not label a partial import as completed.
- Added question/answer/option validation and taxonomy relationship checks to the new CRUD service; deletion now retires questions with test or version references.
- Added additive migration `054_question_review_audit_trigger.sql` to record initial question status and subsequent engine-status changes within the database transaction.
- Added migration `056_qbank_import_transaction_and_test_snapshots.sql` for row-level-savepoint import RPC execution and immutable published mock-test snapshots.
- Added manual, random, and chapter-distribution question selection to the existing mock-test question API and admin UI.
- Expanded importer templates to include single/multiple correct, true/false, fill-in-the-blank, match-following, and numerical question formats.
- Added focused unit tests for import format detection, invalid encoding, header mapping, multi-answer validation, and Unicode duplicate normalization.

### Remaining limitations and deployment steps

- This workspace no longer contains the prior build-blocking `tslib` resolution issue, and the production build passes with Turbopack using dummy build-time environment values.
- Saved mapping templates, a durable background/retry queue, complete per-type authoring/media/math QA, live entitlement data verification, browser E2E, and deployed RLS verification remain outstanding.
- Focused tests executed: 44 unit tests and 12 mock-test integration tests pass. Live Supabase, deployed RLS, migration execution, import RPC execution, and browser end-to-end workflows were not executed.
- Review-only source inspection identified migrations through `056`; it does not establish that any migration has been applied. Apply migrations only in a disposable/development Supabase environment first, validate RPCs and role policies, then deploy through the project's normal migration process. No migration was executed in this session.

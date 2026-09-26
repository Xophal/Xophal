# Phase 2 — Question Bank Admin

CRUD for all nine engine question types, filters, bulk CSV import, and an auditable
review queue (`draft → reviewed → published`). Every endpoint is admin-gated, every
payload Zod-validated, and no answer key is ever exposed to students (the admin API is
reviewer-scoped by RLS; the student-facing path arrives in Phase 4).

---

## Files added in this phase

| File | Purpose |
| --- | --- |
| `supabase/migrations/016_question_review_history.sql` | `question_review_history` audit table (RLS: reviewer/admin), `question_review_counts` view for the queue badges, `tr_questions_admin_touch` to keep `updated_at` fresh |
| `src/lib/engine/vocab.ts` | Engine types / skills / boards / statuses / sources, legacy dual-write maps, and the review state machine |
| `src/lib/engine/question-schema.ts` | Zod schemas (create / update / query / CSV row), `withEngineDefaults`, `buildAnswerJson`, RFC-4180 `parseCsvRows`, per-type option validation |
| `src/lib/engine/question-service.ts` | All persistence: list / get / create / update / archive / bulk import / status transition |
| `src/app/api/admin/engine/questions/route.ts` | `GET` list+filter+paginate, `POST` create, `PUT` CSV import |
| `src/app/api/admin/engine/questions/[id]/route.ts` | `GET` detail, `PATCH` update, `DELETE` archive, `POST` status transition |
| `src/app/api/admin/engine/vocab/route.ts` | Dropdown data: topics w/ chapter→subject path, subtopics, per-status review counts |
| `src/components/admin/EngineQuestionEditor.tsx` | Type-aware editor (options, assertion, rubric, equation) — replaces the legacy single-type editor |
| `src/app/(admin)/admin/questions/page.tsx` | Browse / filters / pagination, review queue tab, CSV import tab |
| `tests/unit/phase2-question-bank.test.ts` | 36 tests: schema defaults, option validation, answer derivation, review state machine, CSV parser, migration contract |

---

## API

All routes require an admin session (`requireAdminAuth`); the service runs on the
service-role client, so the auth check — not RLS — is the primary gate.

### `GET /api/admin/engine/questions`

Query params: `page` (1-based), `limit` (≤100), `search` (ilike on stem),
`type`, `status`, `topicId`, `difficulty` (0 = any), `board`.

```jsonc
{
  "success": true,
  "data": [ /* question rows incl. question_options */ ],
  "pagination": { "page": 1, "limit": 20, "total": 62, "totalPages": 4, "hasMore": true }
}
```

### `POST /api/admin/engine/questions`

Body is `createEngineQuestionSchema`. Required: `type`, `stem`, `topicId`,
`difficulty` (1–3), `skill`. Everything else defaults. Returns `201` with the
full question row.

### `PATCH /api/admin/engine/questions/:id`

Body is the partial schema. Only the keys present are written. If `options` is
present the whole option set is replaced atomically (delete + insert), validated
against the question's type first. If it is absent, the existing options are
re-read so the answer key is still rebuilt correctly.

### `DELETE /api/admin/engine/questions/:id`

Soft-archives. If the question is referenced by any frozen `test_instance_questions`
row it is set to `engine_status='retired'` (and `status='archived'`, `is_active=false`)
so past attempts keep their exact content. Unreferenced questions are hard-deleted.
The response says which happened: `{ "mode": "retired" }` or `{ "mode": "deleted" }`.

### `POST /api/admin/engine/questions/:id/status`

Body: `{ "status": EngineStatus, "reviewNotes": string }`. Validates the transition
against the state machine in `vocab.ts`, records reviewer id/time/notes, dual-writes
the legacy `status`, and flips `is_verified`.

### `PUT /api/admin/engine/questions` (CSV import)

Body: `{ "csv": string, "defaultStatus": "draft" | "reviewed" }`. Max 500 rows.
**All-or-nothing**: every row is validated first and nothing is inserted if any row
fails. `source` is always forced to `import`; `defaultStatus` defaults to `draft`, so
an import can never auto-publish.

CSV header (order-independent, lowercase):

```
type,stem,topic_slug,difficulty,skill,marks,neg_marks,est_time_sec,board_pattern,tags,options,answer_json,rubric_json,explanation
```

- Required: `type`, `stem`, `topic_slug`, `difficulty`, `skill`
- `tags` — pipe separated (`balancing|pyq|cbse-2023`)
- `options` — JSON array of `{label, body, is_correct}`
- `answer_json` / `rubric_json` — JSON objects
- Missing or blank cells fall back to safe defaults (status → `draft`)

### `GET /api/admin/engine/vocab`

Returns `{ topics, subtopics, types, statuses, reviewCounts }`. Topics include the
`subject › chapter › topic` path so the dropdown is readable.


---

## Behaviour notes

**Defaults are applied server-side, once.** `withEngineDefaults()` fills every schema
default at the service boundary, so the persistence layer never writes `undefined`
into a column and the create/update routes stay thin.

**`answer_json` is derived, not trusted.** `buildAnswerJson()` derives the canonical
answer key from the question type plus its normalised options:

| Type | Derived keys |
| --- | --- |
| `mcq`, `statement`, `case_based` | `correct_option` (single) or `correct_options` (multi) |
| `assertion_reason` | `correct_option` + `assertion` / `reason` |
| `match` | `match_pairs` |
| `fill_blank` | `blanks` + flattened `accepted` |
| `equation` | `balanced_equation` + split `reactants` / `products` (handles `->`, `-->`, `→`, `⇌`, `=>`) |
| `short`, `long` | `value` (model answer, from rubric when not given) |

Anything supplied explicitly in `input.answer` is merged **last** and always wins, so
a reviewer can override a derived key without touching the derivation logic. The
Phase-5 evaluator can therefore dispatch on `answer_json` alone.

**Legacy dual-write.** Engine columns (`engine_type`, `stem`, `difficulty`, …) are
written alongside the pre-existing `question_*` columns, and `engine_status` is mapped
to the legacy `status` via `ENGINE_STATUS_TO_LEGACY`. Every engine type maps to a
legacy `question_types.code`; if that code is not configured the write fails loudly
with `VOCAB_MISSING` rather than silently storing a wrong type.

**Review state machine** (`isAllowedEngineTransition`):

```
draft     → reviewed | published | retired
reviewed  → published | draft | retired
published → retired | reviewed | draft
retired   → draft
```

A same-state transition is a no-op success, so idempotent retries are safe.

---

## How to test

```bash
# 1. Type safety (expect 0 errors)
npm run typecheck

# 2. Unit tests (expect 20 files / 105 tests passing)
npm run test:unit

# 3. Phase-2 tests only
npx vitest run tests/unit/phase2-question-bank.test.ts

# 4. Production build
npm run build
```

### Apply the migration

```bash
npx supabase db push          # applies 013 → 014 → 015 → 016
```

### Manual smoke test (as an admin)

1. Open `/admin/questions`.
2. **Browse** tab → filter by type `mcq`, status `published`. Pagination and the
   status count badges come from `question_review_counts`.
3. Click **New question** → pick a topic, fill a stem, add options, tick exactly one
   correct. Save. Confirm the row appears with `status=draft`.
4. **CSV import** tab → *Load template into editor* → *Run import*. Confirm the
   created count and that the rows land as `draft` with an `import` badge.
5. Introduce a deliberate error (blank `topic_slug`) and re-run: the whole batch is
   rejected with a row-scoped message and nothing is inserted.
6. **Review queue** tab → add notes, *Approve (reviewed)*, then *Publish now*.
   Confirm the badge counts update.

### Verify the archive rule

Take a question that is part of a seeded blueprint instance, then `Archive` it. The
response should say `retired` and the row should remain readable with
`engine_status='retired'` (past attempts must still resolve their content). Archive an
unreferenced draft and the response should say `deleted`.

---

## Known limitations

- The `question_review_history` table is written by the API path
  (`transitionEngineQuestion` records via the reviewer columns on `questions`); the
  dedicated history table is in place and RLS-guarded, but a Phase-3/4 change should
  add a trigger so *every* status write — including direct SQL or the seed builder —
  is captured. Right now the audit trail is complete for UI-driven changes only.
- CSV import is sequential (`await` per row) so a bad row aborts cleanly. It is fine
  at the 500-row cap but is not batched; a 100k-row import would want chunking.
- `EngineQuestionEditor` has no media upload (Phase 2 scope). `engineOptionSchema`
  already accepts `mediaUrl`, so wiring Storage later needs no schema change.
- The legacy `/api/admin/questions` routes and `QuestionEditor.tsx` are untouched and
  still serve the old mock-test-scoped flow. The new engine flow is additive; the
  legacy page can be deleted once nothing links to it.
- The review queue paginates at 50 drafts with no filter UI; for a large backlog a
  reviewer would want source/type filters (the API already supports both).

---

## Next phase

**Phase 3 — Blueprints and generator.** Blueprint CRUD with a visual section builder,
a live "can this be filled?" check against the bank, and the static generator
(seeded randomisation, per-section counts, difficulty mix, recently-seen exclusion,
constraint relaxation with warnings) plus its unit tests.

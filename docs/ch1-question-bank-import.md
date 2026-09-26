# Ch1 question bank import (migration 017)

Loads the Class 10 Science, Chapter 1 "Chemical Reactions and Equations" question
bank (207 questions + 7 case passages + 576 options) into the **existing** engine
schema, so it shows up in `/admin/questions`, can be reviewed and published, and
can be drawn on by blueprints/generator exactly like a hand-authored question.

## Files

| File | Purpose |
| --- | --- |
| `docs/imports/ch1-class10-science/*.csv` | Source bank (verbatim from the question-bank zip): `taxonomy` (7 topics / 28 subtopics), `questions` (207), `options` (576), `case_passages` (7) |
| `scripts/qbank_ch1/build_017.js` | Builds the migration from those CSVs (`npm run qb:build`) |
| `supabase/migrations/017_question_bank_ch1_import.sql` | Generated, idempotent seed (1.0 MB, 5296 lines) |
| `scripts/qbank_ch1/verify.cjs` | Read-only counts against the configured project (`npm run qb:verify`) |
| `tests/unit/ch1-question-bank-import.test.ts` | 13 contract tests: CSV ↔ SQL agreement, no publishing, idempotency |

## Why not the zip's `import-question-bank.mjs`

That script targets the throwaway MASTER PROMPT schema: a self-referencing
`topics(slug, level, parent_id)` tree, `questions.legacy_id`, and
`question_options(label, body, position)`. This app has none of that shape:

```
boards -> classes -> subjects -> chapters -> topics -> subtopics
questions (legacy FKs: question_types, difficulty_levels + engine columns from 013)
question_options (option_text/sort_order + label/body/position from 013)
```

Run against this database, that script would fail on the first `topics` insert.
Instead the CSVs are compiled into a migration that resolves every FK **by code**
(`b.code='cbse' AND c.code='class-10' AND s.code='science' AND ch.code='chemical-reactions'`),
so it is board-agnostic and re-runnable.

## What lands where

| CSV | Table | Notes |
| --- | --- | --- |
| `taxonomy.csv` topic rows | `topics` | `ON CONFLICT (chapter_id, slug)` - reuses a topic that another seed already created (`corrosion`, `rancidity`, `exothermic-endothermic`) instead of duplicating it |
| `taxonomy.csv` subtopic rows | `subtopics` | `ON CONFLICT (topic_id, slug)`; the generator refuses to build if a question names a subtopic that is not in `taxonomy.csv` (that would silently leave `subtopic_id` NULL) |
| `case_passages.csv` | `questions` | `engine_question_type` has no `case_passage` value, so a passage is a zero-mark `case_based` draft row (migration 014's convention) that children point at via `parent_id` |
| `questions.csv` | `questions` | 31 columns written: legacy FKs + engine columns, `tags` text[] and `question_tags` rows, `common_mistake` / `exam_focus` in `metadata` |
| `options.csv` | `question_options` | `option_text` **and** `body`/`label`/`position` (013 keeps both shapes) |
| `answer_text` / `explanation` | `question_answers` | `answer_json` in the exact shape `buildAnswerJson` derives (see `docs/phase2-question-bank.md`), plus the legacy `correct_options` / `value` / `key_points` keys migration 014 writes |

`questions.legacy_id` is a new column (added by this migration) holding the CSV
`question_id` / `passage_id`. It is the stable external key: re-running the
migration updates rows instead of creating duplicates, and the review queue can
trace a row back to the source file.

## Everything lands as draft

`engine_status='draft'`, `status='draft'`, `is_verified=false`, `source='ai'`
(the CSV marks every row "AI-original (needs review)"). The migration contains
**no** write that publishes anything - a test asserts the word `published` never
appears outside comments and the verification query. Publishing stays a manual
step in `/admin/questions`.

## Apply

```bash
npm run qb:build        # regenerate the migration from the CSVs
npx supabase db push    # applies every pending migration
npm run qb:verify       # read-only counts + engine_status breakdown
```

`db push` also applies 013-016, which the project had not pushed yet: 013
(engine columns, `subtopics`, `question_answers`, `question_tags`,
`question_stats`), 014 (62 older Ch1 questions, **published**), 015 (attempt RPCs
+ reviewer RLS), 016 (review history). 017 aborts with a clear `RAISE EXCEPTION`
if 012 or 013 are missing.

**Status: applied** to the linked project (`nsupjccgmchkwtkyazwvk`). Verified
read-only afterwards, not from the migration's own log:

```
questions 207 | case passages 7 | options 576 | answers 207 (269 incl. 014's 62)
engine_status breakdown: {"draft":207}          <- nothing published
engine_type breakdown: mcq 81, case_based 21, assertion_reason 21, statement 14,
                              match 7, fill_blank 21, equation 19, short 16, long 7
case children linked to a parent: 21
questions with no topic / no subtopic / no answer key: 0 / 0 / 0
```

Idempotency was proven, not assumed: 017 was reverted with
`supabase migration repair --status reverted 017` and pushed a second time.
Counts stayed at 207 questions and 4 options per question - no duplicates.

### Two bugs fixed in earlier migrations to get 013-017 to apply

Both were pre-existing defects in the untracked Phase-1/Phase-2 work, not in the
CSV import, and both blocked `db push`:

1. **014 replaced a live table with a view.** It ran
   `CREATE OR REPLACE VIEW leaderboard_entries`, but migration 001 creates
   `leaderboard_entries` as a **table** (`rank`, `total_xp`, `tests_completed`)
   that `/leaderboard` and `/api/student/leaderboard` read. The push failed with
   `"leaderboard_entries" is not a view`. The per-blueprint analytics view is
   now `blueprint_leaderboard` (fixed in `scripts/seed014/part5_verify.js`, the
   generator, and the regenerated `014`).
2. **015 used a reserved word as an output column.** `position` is reserved in
   Postgres (`POSITION(x IN y)`), so `RETURNS TABLE (... position INT ...)` was a
   syntax error. Now quoted: `"position" INT`.

### Parsing rules the builder enforces
- Answer text is split on `|` **only** (`splitVariants`). A comma-aware split
  corrupts equations whose conditions contain commas - it turned
  `6CO2 + 6H2O -> C6H12O6 + 6O2 (sunlight, chlorophyll)` into two truncated
  answers. Tag cells (`tags`, `exam_focus`) still split on `;`/`,`/`|`.
- The build refuses to run if a question names a `topic_slug` or `subtopic` that
  is not in `taxonomy.csv` (an unmatched subtopic would silently leave
  `subtopic_id` NULL), if a `case_based` child points at a missing passage, if a
  type/difficulty is unknown, or if an option row references a missing question.

## Review-queue state (migrations 018 + 019)

Two follow-up migrations keep the whole chapter in one reviewable state:

- **018** — `question_review_counts` now excludes case-passage parents, matching
  the filter `listEngineQuestions` applies. Without it the badge counted the
  zero-mark passages alongside real questions.
- **019** — returns migration 014's 62 seed questions to `draft`. That seed
  inserted them already `published`, so pushing 014 put them live and bypassed
  the review queue entirely. It is scoped by `metadata->>'seed_code' LIKE 'Q%'`
  so it can never touch CSV-imported or hand-authored content, and it skips any
  question already used by a frozen test instance (past attempts must keep
  resolving their exact content).

Final state of the chapter:

```
total questions 276  =  207 imported + 62 seed + 7 case passages
engine_status      : draft 276, published 0
review queue badge : draft 267  (the 9 case-passage parents are excluded)
anon client can read: 0 questions, 0 answers, 0 options
```

## Publishing

Publishing is manual and is the only step left. In `/admin/questions`: filter by
`draft`, *Mark reviewed*, then *Publish now*. `is_verified` and the legacy
`status` column are kept in lock-step by the transition endpoint.

## Published (migration 020)

On the owner's instruction the reviewed chapter was published. This is what makes
the bank usable: `loadPool()` reads `engine_status = 'published'`, so until this
the generator could not build a paper out of it.

- Scoped to the Ch1 chapter only (`cbse / class-10 / science /
  chemical-reactions`) - no other chapter is touched.
- Case-passage parents are published too, because the `case_based` children
  resolve them through `parent_id` at serve time. They are still never *served*
  standalone, because `matchesFilter` excludes a `case_based` row with no
  `parent_id`.
- `engine_status`, the legacy `status` and `is_verified` move in lock-step, the
  same way `transitionEngineQuestion` does.
- A `question_review_history` row is written per question, so the audit trail is
  complete for a bulk publish (the API path records it per question; a migration
  otherwise would not).

```
engine_status      : published 276, draft 0
legacy status      : published 276, all is_verified
review queue badge : published 267   (the 9 case-passage parents are excluded)
loadPool()         : 276 questions available to the generator
review history     : 276 rows recorded
anon client        : 0 answer keys, 0 is_correct values
```

Rolling back is one statement: `update questions set engine_status='draft',
status='draft', is_verified=false where engine_status='published';`

## Known limitations

- The bank is attached to the **CBSE** Class 10 Science chapter only. Rows whose
  `board_pattern` is `CBSE/SEBA` are stored as `SEBA` (the enum has no combined
  value); the original string is kept in `metadata.board_pattern_raw`.
- Options are replaced wholesale on re-run (`DELETE` + insert) for
  import-owned questions. Fine while they are drafts; it would discard manual
  edits to a question that has already been published.
- `option_html` is written as NULL (matching `src/app/api/admin/questions`), so
  nothing renders the chemical notation as HTML. KaTeX rendering of subscripts
  is a UI concern and is not part of this import.
- The generated SQL is a build artifact: edit the CSVs or the builder, never the
  migration. `tests/unit/ch1-question-bank-import.test.ts` fails if they drift.

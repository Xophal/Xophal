# Phase 1 — Mock-Test Engine Schema + Class 10 Science Ch1 Seed

## Files added
- `supabase/migrations/013_mock_test_engine.sql` — engine schema: `subtopics`,
  engine columns on `questions`/`question_options`, `question_answers`,
  `question_tags`, `question_stats`, `blueprints`, `blueprint_sections`,
  `test_instances`, `test_instance_questions`, `attempts`, `attempt_answers`,
  `topic_mastery`, `streaks`, `leaderboard_entries` view, RLS, deadline guard.
- `supabase/migrations/014_seed_class10_science_ch1.sql` — generated seed:
  SEBA chapter row, 6 topics, 16 subtopics, **62 questions** (60 graded +
  2 zero-mark case parents), options, answers, rubrics, explanations, tags,
  stats, **6 starter blueprints** + sections.
- `supabase/migrations/015_engine_rls_hardening.sql` — sanitized RPCs:
  `get_attempt_questions` (no correct flags) and `get_attempt_solutions`
  (post-submission only).
- `scripts/seed014/` — data files (`q01..q10`, `bp_a/bp_b`, `taxonomy.js`,
  `sqlutil.js`, `part1..part5_*.js`, `build_014.js`). Rebuild with
  `node scripts/seed014/build_014.js`.
- `src/types/engine.ts` — typed engine contracts.
- `tests/unit/phase1-mock-engine-seed.test.ts` — seed contract test.

## Apply
1. `npx supabase db push` (or run 013, 014, 015 in order in SQL editor).
2. Verify: `node scripts/seed014/build_014.js` then
   `npx vitest run tests/unit/phase1-mock-engine-seed.test.ts`.
3. Apply migration `046_mock_test_engine_completion.sql` before enabling the
   student routes. It snapshots generated papers and answer keys separately,
   enforces blueprint visibility and attempt limits, and adds the answer-save,
   submit, result, and student practice-test routes at `/engine-tests`.

## Notes
- Ids are deterministic (sha1 of `ch1q-<code>`), so 014 is re-runnable.
- Case children Q27–Q29 → parent Q26; Q31–Q33 → parent Q30.
- Blueprint `filter_json` stores both resolved `topic_ids` and `topic_slugs`.

## Fixed mock-test compatibility

Migration `051_engine_fixed_mock_test_compatibility.sql` adds an additive bridge
from legacy `mock_tests` to engine `blueprints`. It backfills a blueprint and a
`blueprint_fixed_questions` snapshot only for legacy tests whose assigned
questions are supported `mcq` or `assertion_reason` choice questions and all
have at least two options and at least one correct option. Other legacy tests
remain on their existing routes and are not silently converted.

The fixed-question snapshot keeps the original question IDs, order, marks,
negative marks, option labels, and answer keys. It does not duplicate question
bank rows. The snapshot table is inaccessible to `anon` and `authenticated`;
engine question delivery and grading continue through trusted server paths.

For a linked blueprint, the engine start route follows the source test's
published/active status, premium entitlement or test-specific grant, and the
attempt limit. Attempt creation is serialized per user and blueprint in the
database. Results honor the source test's `show_solutions` setting and do not
return per-question correctness or answer keys when review is disabled.

This is a compatibility layer, not a production cutover. Existing URLs,
legacy attempts, analytics, and result history remain on the legacy model.
Apply and validate migration 051 in a verified staging project before routing
any production traffic to the linked engine blueprints. Confirm skipped legacy
tests and answer-option formats against real staging metadata first.
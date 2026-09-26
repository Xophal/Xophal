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

## Notes
- Ids are deterministic (sha1 of `ch1q-<code>`), so 014 is re-runnable.
- Case children Q27–Q29 → parent Q26; Q31–Q33 → parent Q30.
- Blueprint `filter_json` stores both resolved `topic_ids` and `topic_slugs`.
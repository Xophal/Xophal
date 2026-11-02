# Phase 4 — Student Attempt Workflows

The engine attempt routes use cookie-scoped authentication and database RPCs:

- Question delivery uses `get_attempt_questions`, which checks ownership and
  omits answer-key/review fields.
- Submission uses `submit_engine_attempt`, which checks ownership, deadline,
  question membership, and option labels, then scores and closes the attempt.
- Answer saves now use `save_engine_attempt_answers` from migration 054. The
  RPC locks the attempt row, rechecks owner/status/deadline, validates question
  and option membership, and writes only response/time/flag fields. Saves and
  submission therefore serialize on the same row; a save cannot alter answer
  data after submission has been scored.
- Results respect the linked legacy test's `show_solutions` setting and omit
  per-question grading when review is disabled.

The API and RPC are implemented locally. Migration 054 has not been applied to
staging or production. Validate student-owned saves, cross-user denial, expired
and submitted-attempt denial, invalid question/option rejection, scoring, and
solution visibility on a staging database before deployment.

Verification performed locally:

- TypeScript check passed.
- Targeted unit suite passed.
- Production Next.js build passed.
- The full unit suite reports one failure in the unchanged
  `engine-result-route.test.ts`: it expects the route not to instantiate its
  admin client before calling the mocked attempt-state lookup. The result route
  was not changed in this phase.

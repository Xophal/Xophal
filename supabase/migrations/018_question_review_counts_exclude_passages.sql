-- ============================================================================
-- Migration 018: exclude case-passage parents from the review-count view
-- A case-based parent is the passage row: it carries the shared stem, scores
-- zero marks and is never served as a standalone question. Because
-- engine_question_type has no 'case_passage' value it is stored as a
-- case_based question, so the view in 016 counted the 7 Ch1 passages alongside
-- the 207 real questions and the review-queue badge read 214.
-- The rows are untouched - children still resolve them via parent_id.
-- ============================================================================

CREATE OR REPLACE VIEW question_review_counts AS
SELECT
  engine_status AS status,
  COUNT(*)::BIGINT AS count
FROM questions
WHERE engine_status IS NOT NULL
  -- same rule as NOT_A_CASE_PARENT in src/lib/engine/question-service.ts
  AND (engine_type <> 'case_based' OR parent_id IS NOT NULL)
GROUP BY engine_status;

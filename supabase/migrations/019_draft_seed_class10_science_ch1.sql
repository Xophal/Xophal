-- ============================================================================
-- Migration 019: return the migration-014 seed questions to draft
--
-- The Phase-1 seed (014) inserted its 62 Ch1 questions already marked
-- `published`, so they went live the moment 014 was pushed - bypassing the
-- review queue the rest of the system depends on (draft -> reviewed ->
-- published). The 207 questions imported by 017 all land as draft, so the
-- chapter had 60 reviewable questions sitting in two different states.
--
-- This puts them back in the review queue with everything else. It is scoped
-- to the seed by the same marker 014 uses (metadata->>'seed_code'), so it
-- never touches hand-authored or CSV-imported content.
--
-- Safety: a question already used by a frozen test instance is left alone and
-- reported instead, because past attempts must keep resolving their exact
-- content (the same rule as archiveEngineQuestion in question-service.ts).
-- Idempotent: re-running simply re-drafts the same rows.
-- ============================================================================

DO $$
DECLARE
  v_targeted INT;
  v_skipped  INT;
BEGIN
  SELECT COUNT(*) INTO v_targeted
  FROM questions q
  WHERE q.metadata ->> 'seed_code' LIKE 'Q%'
    AND q.engine_status = 'published';

  SELECT COUNT(*) INTO v_skipped
  FROM questions q
  WHERE q.metadata ->> 'seed_code' LIKE 'Q%'
    AND q.engine_status = 'published'
    AND EXISTS (SELECT 1 FROM test_instance_questions tiq WHERE tiq.question_id = q.id);

  UPDATE questions q
  SET engine_status = 'draft',
      status        = 'draft',
      is_verified   = false,
      updated_at    = NOW()
  WHERE q.metadata ->> 'seed_code' LIKE 'Q%'
    AND q.engine_status = 'published'
    AND NOT EXISTS (SELECT 1 FROM test_instance_questions tiq WHERE tiq.question_id = q.id);

  RAISE NOTICE 'QBANK019: drafted % seed questions (% left published because they are in a frozen test)', v_targeted - v_skipped, v_skipped;
END $$;

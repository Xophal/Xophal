-- ============================================================================
-- Migration 020: publish the reviewed Class 10 Science Ch1 question bank
--
-- Owner decision: the chapter has been reviewed and is going live. Publishing is
-- what makes the bank usable - loadPool() reads engine_status = 'published',
-- so until now the generator could not build a paper out of it.
--
-- Scope: the Ch1 chapter only (cbse / class-10 / science / chemical-reactions),
-- so no other chapter's content is touched. Case-passage parents are published
-- too: they are structural content of the bank and the case_based children
-- resolve them through parent_id at serve time. They are still never *served*
-- as standalone questions, because matchesFilter excludes a case_based row
-- with no parent_id.
--
-- The three status columns are moved in lock-step, mirroring
-- transitionEngineQuestion in question-service.ts: engine_status (the engine's
-- state), the legacy questions.status, and is_verified.
--
-- Review history is written here too, so the audit trail is complete for a
-- bulk publish (the API path records it per question; a migration otherwise
-- would not).
--
-- Idempotent: re-running publishes nothing further.
-- ============================================================================

DO $$
DECLARE
  v_published INT;
  v_reviewed  INT;
BEGIN
  SELECT COUNT(*) INTO v_published
  FROM questions q
  JOIN topics tp ON q.topic_id = tp.id
  JOIN chapters ch ON tp.chapter_id = ch.id
  JOIN subjects s ON ch.subject_id = s.id
  JOIN classes c ON s.class_id = c.id
  JOIN boards b ON c.board_id = b.id
  WHERE b.code = 'cbse' AND c.code = 'class-10' AND s.code = 'science' AND ch.code = 'chemical-reactions'
    AND q.engine_status = 'draft';

  -- audit trail for the bulk transition
  INSERT INTO question_review_history (question_id, from_status, to_status, actor_id, note)
  SELECT q.id, q.engine_status, 'published', NULL,
         'Bulk publish of the reviewed Class 10 Science Ch1 bank (migration 020).'
  FROM questions q
  JOIN topics tp ON q.topic_id = tp.id
  JOIN chapters ch ON tp.chapter_id = ch.id
  JOIN subjects s ON ch.subject_id = s.id
  JOIN classes c ON s.class_id = c.id
  JOIN boards b ON c.board_id = b.id
  WHERE b.code = 'cbse' AND c.code = 'class-10' AND s.code = 'science' AND ch.code = 'chemical-reactions'
    AND q.engine_status = 'draft';

  UPDATE questions q
  SET engine_status = 'published',
      status        = 'published',
      is_verified   = true,
      updated_at    = NOW()
  FROM topics tp
  JOIN chapters ch ON tp.chapter_id = ch.id
  JOIN subjects s ON ch.subject_id = s.id
  JOIN classes c ON s.class_id = c.id
  JOIN boards b ON c.board_id = b.id
  WHERE q.topic_id = tp.id
    AND b.code = 'cbse' AND c.code = 'class-10' AND s.code = 'science' AND ch.code = 'chemical-reactions'
    AND q.engine_status = 'draft';

  SELECT COUNT(*) INTO v_reviewed
  FROM questions q
  JOIN topics tp ON q.topic_id = tp.id
  JOIN chapters ch ON tp.chapter_id = ch.id
  JOIN subjects s ON ch.subject_id = s.id
  JOIN classes c ON s.class_id = c.id
  JOIN boards b ON c.board_id = b.id
  WHERE b.code = 'cbse' AND c.code = 'class-10' AND s.code = 'science' AND ch.code = 'chemical-reactions'
    AND q.engine_status = 'published';

  RAISE NOTICE 'QBANK020: published % questions, chapter now has % published', v_published, v_reviewed;
END $$;

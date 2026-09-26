-- ============================================================================
-- Migration: 016_question_review_history.sql
-- Phase 2 — Question bank admin: auditable review queue.
-- Every engine_status transition is recorded; CSV/AI bulk inserts stay
-- attributable. Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS question_review_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  from_status engine_question_status,
  to_status engine_question_status NOT NULL,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qrh_question_created
  ON question_review_history(question_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qrh_to_status
  ON question_review_history(to_status, created_at DESC);

ALTER TABLE question_review_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='question_review_history_reviewer_read') THEN
    CREATE POLICY question_review_history_reviewer_read ON question_review_history
      FOR SELECT USING (is_reviewer_or_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='question_review_history_reviewer_write') THEN
    CREATE POLICY question_review_history_reviewer_write ON question_review_history
      FOR INSERT WITH CHECK (is_reviewer_or_admin());
  END IF;
END $$;

-- Keep updated_at fresh on questions when admins edit through the API.
DROP TRIGGER IF EXISTS tr_questions_admin_touch ON questions;
CREATE OR REPLACE FUNCTION touch_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_questions_admin_touch
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION touch_questions_updated_at();

-- Review-queue counts helper (admin/reviewer only via RLS on questions).
CREATE OR REPLACE VIEW question_review_counts AS
SELECT
  engine_status AS status,
  COUNT(*)::BIGINT AS count
FROM questions
WHERE engine_status IS NOT NULL
GROUP BY engine_status;

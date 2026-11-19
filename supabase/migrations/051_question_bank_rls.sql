-- ============================================================================
-- Migration 051: RLS policies for Question Bank & Bulk Import tables
-- ============================================================================

-- Import batches: owners read all, admins/reviewers read all, owners write their own
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='import_batches' AND policyname='import_batches_owner_read') THEN
    CREATE POLICY import_batches_owner_read ON import_batches
      FOR SELECT USING (user_id = auth.uid() OR is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='import_batches' AND policyname='import_batches_owner_write') THEN
    CREATE POLICY import_batches_owner_write ON import_batches
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='import_batches' AND policyname='import_batches_admin_update') THEN
    CREATE POLICY import_batches_admin_update ON import_batches
      FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
  END IF;
END $$;

-- Question versions: admins/reviewers read all, admins write
ALTER TABLE question_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='question_versions' AND policyname='question_versions_admin_read') THEN
    CREATE POLICY question_versions_admin_read ON question_versions
      FOR SELECT USING (is_reviewer_or_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='question_versions' AND policyname='question_versions_admin_write') THEN
    CREATE POLICY question_versions_admin_write ON question_versions
      FOR ALL USING (is_admin()) WITH CHECK (is_admin());
  END IF;
END $$;

-- Question duplicates: admins/reviewers read all, admins write
ALTER TABLE question_duplicates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='question_duplicates' AND policyname='question_duplicates_admin_read') THEN
    CREATE POLICY question_duplicates_admin_read ON question_duplicates
      FOR SELECT USING (is_reviewer_or_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='question_duplicates' AND policyname='question_duplicates_admin_write') THEN
    CREATE POLICY question_duplicates_admin_write ON question_duplicates
      FOR ALL USING (is_admin()) WITH CHECK (is_admin());
  END IF;
END $$;

-- Questions: existing policies allow admin/all. Import-batch association does not change read access.
-- Reviewer can read all questions for review queue.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='questions' AND policyname='questions_reviewer_read_batch') THEN
    CREATE POLICY questions_reviewer_read_batch ON questions
      FOR SELECT USING (is_reviewer_or_admin());
  END IF;
END $$;
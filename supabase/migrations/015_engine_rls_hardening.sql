-- ============================================================================
-- Migration 015: engine RLS hardening + sanitized attempt-question access
-- Principle: correct answers are NEVER sent to the client during an attempt.
-- questions/question_options keep admin/reviewer-only direct access; the
-- client reads attempt questions only through the sanitized RPC below, which
-- strips is_correct/answer_json/rubric/explanation.
-- Idempotent.
-- ============================================================================

-- Reviewer read access to taxonomy + bank stems (no answers table here)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='questions_reviewer_read') THEN
    CREATE POLICY questions_reviewer_read ON questions FOR SELECT USING (is_reviewer_or_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='question_options_reviewer_read') THEN
    CREATE POLICY question_options_reviewer_read ON question_options FOR SELECT USING (is_reviewer_or_admin());
  END IF;
END $$;

-- Sanitized RPC: returns frozen instance questions WITHOUT correct flags.
-- NOTE: "position" is a reserved word in Postgres (POSITION(x IN y)), so the
-- output column must be double-quoted here. It is referenced as tiq.position
-- inside the body, which is unambiguous.
CREATE OR REPLACE FUNCTION get_attempt_questions(p_attempt_id UUID)
RETURNS TABLE (question_id UUID, engine_type TEXT, stem TEXT, marks NUMERIC, neg_marks NUMERIC, "position" INT, options JSONB)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_user UUID; v_status TEXT;
BEGIN
  SELECT a.user_id, a.status::TEXT INTO v_user, v_status FROM attempts a WHERE a.id = p_attempt_id;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF v_user <> auth.uid() AND NOT is_reviewer_or_admin() THEN RAISE EXCEPTION 'Not your attempt'; END IF;
  RETURN QUERY
  SELECT q.id, q.engine_type::TEXT, q.stem, tiq.marks, tiq.neg_marks, tiq.position,
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('label',o.label,'body',o.body,'position',o.position) ORDER BY o.position),'[]'::jsonb)
     FROM question_options o WHERE o.question_id = q.id)
  FROM attempts a JOIN test_instances ti ON ti.id = a.instance_id
  JOIN test_instance_questions tiq ON tiq.instance_id = ti.id
  JOIN questions q ON q.id = tiq.question_id
  WHERE a.id = p_attempt_id ORDER BY tiq.position;
END; $fn$;

-- Post-submission solutions RPC: answers/explanations only after submitted/expired/graded.
CREATE OR REPLACE FUNCTION get_attempt_solutions(p_attempt_id UUID)
RETURNS TABLE (question_id UUID, answer_json JSONB, explanation TEXT, is_correct BOOLEAN, marks_awarded NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_user UUID; v_status TEXT;
BEGIN
  SELECT a.user_id, a.status::TEXT INTO v_user, v_status FROM attempts a WHERE a.id = p_attempt_id;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF v_user <> auth.uid() AND NOT is_reviewer_or_admin() THEN RAISE EXCEPTION 'Not your attempt'; END IF;
  IF v_status NOT IN ('submitted','expired','graded') AND NOT is_reviewer_or_admin() THEN
    RAISE EXCEPTION 'Solutions available only after submission';
  END IF;
  RETURN QUERY
  SELECT qa.question_id, qa.answer_json, qa.explanation, aa.is_correct, aa.marks_awarded
  FROM question_answers qa LEFT JOIN attempt_answers aa
    ON aa.question_id = qa.question_id AND aa.attempt_id = p_attempt_id;
END; $fn$;

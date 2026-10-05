-- Ensure disabled accounts cannot retain role-based database access or entitlements.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
      AND p.is_active = true
      AND r.code IN ('super_admin', 'admin', 'content_manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth, pg_temp;

CREATE OR REPLACE FUNCTION is_reviewer_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid()
      AND p.is_active = true
      AND r.code IN ('super_admin', 'admin', 'content_manager', 'reviewer', 'author')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth, pg_temp;

CREATE OR REPLACE FUNCTION is_premium_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.subscriptions s
    JOIN public.profiles p ON p.id = s.user_id
    WHERE s.user_id = auth.uid()
      AND p.is_active = true
      AND s.status = 'active'
      AND s.expires_at > NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth, pg_temp;

-- SECURITY DEFINER RPCs must reject anonymous callers and safely compare auth.uid().
CREATE OR REPLACE FUNCTION get_attempt_questions(p_attempt_id UUID)
RETURNS TABLE (
  question_id UUID,
  engine_type TEXT,
  stem TEXT,
  marks NUMERIC,
  neg_marks NUMERIC,
  "position" INT,
  options JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $fn$
DECLARE
  v_user UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true
  ) THEN
    RAISE EXCEPTION 'Active authentication required';
  END IF;

  SELECT a.user_id INTO v_user
  FROM public.attempts a
  WHERE a.id = p_attempt_id;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Attempt not found';
  END IF;
  IF v_user IS DISTINCT FROM auth.uid() AND NOT public.is_reviewer_or_admin() THEN
    RAISE EXCEPTION 'Not your attempt';
  END IF;

  RETURN QUERY
  SELECT q.id, q.engine_type::TEXT, q.stem, tiq.marks, tiq.neg_marks, tiq.position,
    (
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object('label', o.label, 'body', o.body, 'position', o.position) ORDER BY o.position),
        '[]'::jsonb
      )
      FROM public.question_options o
      WHERE o.question_id = q.id
    )
  FROM public.attempts a
  JOIN public.test_instances ti ON ti.id = a.instance_id
  JOIN public.test_instance_questions tiq ON tiq.instance_id = ti.id
  JOIN public.questions q ON q.id = tiq.question_id
  WHERE a.id = p_attempt_id
  ORDER BY tiq.position;
END;
$fn$;

CREATE OR REPLACE FUNCTION get_attempt_solutions(p_attempt_id UUID)
RETURNS TABLE (
  question_id UUID,
  answer_json JSONB,
  explanation TEXT,
  is_correct BOOLEAN,
  marks_awarded NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $fn$
DECLARE
  v_user UUID;
  v_status TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active = true
  ) THEN
    RAISE EXCEPTION 'Active authentication required';
  END IF;

  SELECT a.user_id, a.status::TEXT INTO v_user, v_status
  FROM public.attempts a
  WHERE a.id = p_attempt_id;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Attempt not found';
  END IF;
  IF v_user IS DISTINCT FROM auth.uid() AND NOT public.is_reviewer_or_admin() THEN
    RAISE EXCEPTION 'Not your attempt';
  END IF;
  IF v_status NOT IN ('submitted', 'expired', 'graded') AND NOT public.is_reviewer_or_admin() THEN
    RAISE EXCEPTION 'Solutions available only after submission';
  END IF;

  RETURN QUERY
  SELECT qa.question_id, qa.answer_json, qa.explanation, aa.is_correct, aa.marks_awarded
  FROM public.attempts a
  JOIN public.test_instances ti ON ti.id = a.instance_id
  JOIN public.test_instance_questions tiq ON tiq.instance_id = ti.id
  JOIN public.question_answers qa ON qa.question_id = tiq.question_id
  LEFT JOIN public.attempt_answers aa
    ON aa.question_id = qa.question_id AND aa.attempt_id = p_attempt_id
  WHERE a.id = p_attempt_id;
END;
$fn$;

REVOKE ALL ON FUNCTION get_attempt_questions(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_attempt_solutions(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_attempt_questions(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_attempt_solutions(UUID) TO authenticated, service_role;

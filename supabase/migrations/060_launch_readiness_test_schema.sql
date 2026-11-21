BEGIN;

ALTER TABLE public.mock_tests
  ADD COLUMN IF NOT EXISTS access_category TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS available_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS available_until TIMESTAMPTZ;

UPDATE public.mock_tests
SET access_category = 'premium'
WHERE is_premium = TRUE OR COALESCE(access_price, 0) > 0;

ALTER TABLE public.mock_tests
  DROP CONSTRAINT IF EXISTS mock_tests_access_category_check,
  ADD CONSTRAINT mock_tests_access_category_check
    CHECK (access_category IN ('free', 'premium', 'subscription_exclusive', 'subject_specific', 'board_class_specific')),
  DROP CONSTRAINT IF EXISTS mock_tests_availability_window_check,
  ADD CONSTRAINT mock_tests_availability_window_check
    CHECK (available_until IS NULL OR available_from IS NULL OR available_until > available_from);

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS duration_value INTEGER NOT NULL DEFAULT 30 CHECK (duration_value > 0),
  ADD COLUMN IF NOT EXISTS duration_unit TEXT NOT NULL DEFAULT 'days' CHECK (duration_unit IN ('days', 'months', 'years')),
  ADD COLUMN IF NOT EXISTS applicable_board_codes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS applicable_class_numbers INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS applicable_subject_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS included_mock_test_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS test_categories TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS access_limitations JSONB NOT NULL DEFAULT '{}'::JSONB;

UPDATE public.subscription_plans
SET duration_value = duration_days
WHERE duration_value = 30 AND duration_unit = 'days' AND duration_days <> 30;

CREATE INDEX IF NOT EXISTS mock_tests_access_window_idx
  ON public.mock_tests (access_category, available_from, available_until)
  WHERE is_active = TRUE AND is_published = TRUE;

CREATE OR REPLACE FUNCTION public.can_access_mock_test(
  p_user_id UUID,
  p_mock_test_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_test RECORD;
  v_profile RECORD;
BEGIN
  IF p_user_id IS NULL OR p_mock_test_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF COALESCE(auth.role(), '') <> 'service_role'
    AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id)
  THEN
    RETURN FALSE;
  END IF;

  SELECT
    mt.id,
    mt.is_premium,
    COALESCE(mt.access_price, 0) AS access_price,
    mt.access_category,
    mt.available_from,
    mt.available_until,
    COALESCE(mt.subject_id, ch.subject_id) AS subject_id,
    sub.class_id,
    cl.grade_number AS class_number,
    br.id AS board_id,
    br.code AS board_code
  INTO v_test
  FROM public.mock_tests mt
  LEFT JOIN public.chapters ch ON ch.id = mt.chapter_id
  LEFT JOIN public.subjects sub ON sub.id = COALESCE(mt.subject_id, ch.subject_id)
  LEFT JOIN public.classes cl ON cl.id = sub.class_id
  LEFT JOIN public.boards br ON br.id = cl.board_id
  WHERE mt.id = p_mock_test_id
    AND mt.is_active = TRUE
    AND mt.is_published = TRUE;

  IF NOT FOUND
    OR (v_test.available_from IS NOT NULL AND v_test.available_from > NOW())
    OR (v_test.available_until IS NOT NULL AND v_test.available_until <= NOW())
  THEN
    RETURN FALSE;
  END IF;

  SELECT p.board_id, p.class_id, p.is_active
  INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF NOT FOUND OR v_profile.is_active IS DISTINCT FROM TRUE THEN
    RETURN FALSE;
  END IF;

  IF (v_profile.board_id IS NOT NULL AND v_test.board_id IS NOT NULL AND v_profile.board_id <> v_test.board_id)
    OR (v_profile.class_id IS NOT NULL AND v_test.class_id IS NOT NULL AND v_profile.class_id <> v_test.class_id)
  THEN
    RETURN FALSE;
  END IF;

  IF v_test.access_category = 'free'
    AND v_test.is_premium IS DISTINCT FROM TRUE
    AND v_test.access_price <= 0
  THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.test_access_grants g
    WHERE g.user_id = p_user_id AND g.mock_test_id = p_mock_test_id
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
    WHERE s.user_id = p_user_id
      AND s.status = 'active'
      AND s.starts_at <= NOW()
      AND s.expires_at > NOW()
      AND (
        (cardinality(sp.applicable_board_codes) > 0 AND v_test.board_code = ANY(sp.applicable_board_codes))
        OR (
          cardinality(sp.applicable_board_codes) = 0
          AND (
            NOT EXISTS (SELECT 1 FROM public.product_catalog pc WHERE pc.subscription_plan_id = sp.id)
            OR EXISTS (
              SELECT 1 FROM public.product_catalog pc
              WHERE pc.subscription_plan_id = sp.id AND pc.board_code = v_test.board_code
            )
          )
        )
      )
      AND (
        (cardinality(sp.applicable_class_numbers) > 0 AND v_test.class_number = ANY(sp.applicable_class_numbers))
        OR (
          cardinality(sp.applicable_class_numbers) = 0
          AND (
            NOT EXISTS (SELECT 1 FROM public.product_catalog pc WHERE pc.subscription_plan_id = sp.id)
            OR EXISTS (
              SELECT 1 FROM public.product_catalog pc
              WHERE pc.subscription_plan_id = sp.id AND pc.class_number = v_test.class_number
            )
          )
        )
      )
      AND (
        cardinality(sp.applicable_subject_ids) = 0
        OR v_test.subject_id = ANY(sp.applicable_subject_ids)
      )
      AND (
        cardinality(sp.included_mock_test_ids) = 0
        OR p_mock_test_id = ANY(sp.included_mock_test_ids)
      )
      AND (
        cardinality(sp.test_categories) = 0
        OR v_test.access_category = ANY(sp.test_categories)
      )
      AND (
        NOT (sp.access_limitations ? 'max_attempts_per_test')
        OR CASE
          WHEN (sp.access_limitations->>'max_attempts_per_test') ~ '^[1-9][0-9]{0,6}$'
          THEN (
            SELECT COUNT(*)
            FROM public.test_attempts ta
            WHERE ta.user_id = p_user_id
              AND ta.mock_test_id = p_mock_test_id
              AND ta.status <> 'in_progress'
              AND ta.started_at >= s.starts_at
          ) < (sp.access_limitations->>'max_attempts_per_test')::INTEGER
          ELSE FALSE
        END
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_mock_test(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_mock_test(UUID, UUID) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.mock_test_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_test_id UUID NOT NULL REFERENCES public.mock_tests(id) ON DELETE CASCADE,
  version_number INT NOT NULL DEFAULT 1,
  snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mock_test_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.mock_test_version_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.mock_test_versions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  section_id UUID REFERENCES public.mock_test_sections(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  marks_override NUMERIC(5,2),
  question_snapshot JSONB NOT NULL,
  correct_option_ids UUID[] NOT NULL DEFAULT '{}'::UUID[],
  UNIQUE (version_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_mock_test_versions_test
  ON public.mock_test_versions(mock_test_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_mock_test_version_questions_version
  ON public.mock_test_version_questions(version_id, sort_order);

ALTER TABLE public.mock_test_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_test_version_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mock_test_versions_admin ON public.mock_test_versions;
CREATE POLICY mock_test_versions_admin ON public.mock_test_versions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS mock_test_version_questions_admin ON public.mock_test_version_questions;
CREATE POLICY mock_test_version_questions_admin ON public.mock_test_version_questions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON TABLE public.mock_test_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.mock_test_version_questions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.mock_test_versions TO service_role;
GRANT ALL ON TABLE public.mock_test_version_questions TO service_role;

CREATE OR REPLACE FUNCTION public.publish_mock_test_snapshot(p_mock_test_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_test public.mock_tests%ROWTYPE;
  v_version public.mock_test_versions%ROWTYPE;
  v_next_number INTEGER;
  v_question_count INTEGER;
BEGIN
  SELECT * INTO v_test
  FROM public.mock_tests
  WHERE id = p_mock_test_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mock test not found';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_question_count
  FROM public.mock_test_questions mtq
  JOIN public.questions q ON q.id = mtq.question_id
  WHERE mtq.mock_test_id = p_mock_test_id
    AND q.status = 'published'
    AND q.is_active = TRUE;
  IF v_question_count = 0 THEN
    RAISE EXCEPTION 'Test not ready: at least one published active question is required';
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO v_next_number
  FROM public.mock_test_versions
  WHERE mock_test_id = p_mock_test_id;

  INSERT INTO public.mock_test_versions(mock_test_id, version_number, snapshot, published_by)
  VALUES (p_mock_test_id, v_next_number, to_jsonb(v_test), auth.uid())
  RETURNING * INTO v_version;

  INSERT INTO public.mock_test_version_questions (
    version_id, question_id, section_id, sort_order, marks_override,
    question_snapshot, correct_option_ids
  )
  SELECT
    v_version.id,
    q.id,
    mtq.section_id,
    mtq.sort_order,
    mtq.marks_override,
    jsonb_build_object(
      'id', q.id,
      'question_text', q.question_text,
      'question_html', q.question_html,
      'explanation', q.explanation,
      'image_url', q.image_url,
      'marks', COALESCE(mtq.marks_override, q.marks, 1),
      'negative_marks', COALESCE(NULLIF(q.negative_marks, 0),
        COALESCE(mtq.marks_override, q.marks, 1) * COALESCE(v_test.negative_marks_ratio, 0)),
      'time_seconds', q.time_seconds,
      'topic_id', q.topic_id,
      'chapter_id', q.chapter_id,
      'subject_id', q.subject_id,
      'question_type', CASE WHEN qt.code IS NULL THEN NULL ELSE jsonb_build_object('code', qt.code) END,
      'options', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', qo.id,
          'option_text', qo.option_text,
          'option_html', qo.option_html,
          'image_url', qo.image_url,
          'sort_order', qo.sort_order,
          'label', qo.label,
          'body', qo.body,
          'position', qo.position
        ) ORDER BY qo.sort_order, qo.id)
        FROM public.question_options qo
        WHERE qo.question_id = q.id
      ), '[]'::JSONB)
    ),
    COALESCE((
      SELECT array_agg(qo.id ORDER BY qo.sort_order, qo.id)
      FROM public.question_options qo
      WHERE qo.question_id = q.id AND qo.is_correct
    ), '{}'::UUID[])
  FROM public.mock_test_questions mtq
  JOIN public.questions q ON q.id = mtq.question_id
  LEFT JOIN public.question_types qt ON qt.id = q.question_type_id
  WHERE mtq.mock_test_id = p_mock_test_id
    AND q.status = 'published'
    AND q.is_active = TRUE;

  UPDATE public.mock_tests
  SET is_published = TRUE, published_at = NOW(), is_active = TRUE
  WHERE id = p_mock_test_id;

  RETURN jsonb_build_object(
    'mock_test_id', p_mock_test_id,
    'version_id', v_version.id,
    'version_number', v_version.version_number,
    'question_count', v_question_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_mock_test_snapshot(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_mock_test_snapshot(UUID) TO service_role;

COMMIT;

ALTER TABLE public.blueprints
  ADD COLUMN IF NOT EXISTS source_mock_test_id UUID
  REFERENCES public.mock_tests(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_blueprints_source_mock_test
  ON public.blueprints(source_mock_test_id)
  WHERE source_mock_test_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.blueprint_fixed_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES public.blueprints(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.blueprint_sections(id) ON DELETE SET NULL,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL,
  marks NUMERIC(5,2) NOT NULL,
  neg_marks NUMERIC(5,2) NOT NULL DEFAULT 0,
  question_snapshot JSONB NOT NULL,
  answer_json JSONB NOT NULL,
  CONSTRAINT uq_blueprint_fixed_question UNIQUE (blueprint_id, question_id),
  CONSTRAINT uq_blueprint_fixed_position UNIQUE (blueprint_id, position)
);

CREATE INDEX IF NOT EXISTS idx_blueprint_fixed_questions_order
  ON public.blueprint_fixed_questions(blueprint_id, position);

ALTER TABLE public.blueprint_fixed_questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.blueprint_fixed_questions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.blueprint_fixed_questions TO service_role;

WITH eligible_tests AS (
  SELECT
    mt.*,
    COUNT(mtq.question_id)::INTEGER AS question_count
  FROM public.mock_tests mt
  JOIN public.mock_test_questions mtq ON mtq.mock_test_id = mt.id
  JOIN public.questions question ON question.id = mtq.question_id
  GROUP BY mt.id
  HAVING BOOL_AND(
    COALESCE(question.engine_type::TEXT IN ('mcq', 'assertion_reason'), FALSE)
    AND EXISTS (
        SELECT 1
        FROM public.question_options qo
        WHERE qo.question_id = mtq.question_id
          AND qo.is_correct IS TRUE
      )
      AND (
        SELECT COUNT(*)
        FROM public.question_options qo
        WHERE qo.question_id = mtq.question_id
      ) >= 2
  )
)
INSERT INTO public.blueprints (
  name,
  slug,
  description,
  kind,
  duration_sec,
  total_marks,
  marking_scheme_json,
  shuffle_questions,
  shuffle_options,
  is_public,
  chapter_id,
  subject_id,
  created_by,
  source_mock_test_id
)
SELECT
  test.title,
  'legacy-mock-' || REPLACE(test.id::TEXT, '-', ''),
  test.description,
  'custom',
  GREATEST(30, test.duration_minutes * 60),
  test.total_marks,
  jsonb_build_object(
    'default_marks', 1,
    'default_neg_marks', 0
  ),
  test.shuffle_questions,
  test.shuffle_options,
  test.is_published AND test.is_active,
  test.chapter_id,
  test.subject_id,
  test.created_by,
  test.id
FROM eligible_tests test
WHERE NOT EXISTS (
  SELECT 1
  FROM public.blueprints existing
  WHERE existing.source_mock_test_id = test.id
);

INSERT INTO public.blueprint_sections (
  blueprint_id,
  title,
  position,
  filter_json,
  count,
  marks_per_q,
  neg_marks
)
SELECT
  blueprint.id,
  'Fixed questions',
  0,
  '{}'::JSONB,
  COUNT(mtq.question_id)::INTEGER,
  1,
  0
FROM public.blueprints blueprint
JOIN public.mock_test_questions mtq
  ON mtq.mock_test_id = blueprint.source_mock_test_id
WHERE blueprint.source_mock_test_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.blueprint_sections section
    WHERE section.blueprint_id = blueprint.id
  )
GROUP BY blueprint.id;

WITH option_rows AS (
  SELECT
    qo.id,
    qo.question_id,
    COALESCE(NULLIF(qo.label, ''), CHR(64 + ROW_NUMBER() OVER (
      PARTITION BY qo.question_id ORDER BY qo.sort_order, qo.id
    )::INTEGER)) AS label,
    COALESCE(qo.body, qo.option_text) AS body,
    qo.sort_order,
    qo.image_url,
    qo.is_correct
  FROM public.question_options qo
),
eligible_tests AS (
  SELECT
    mt.id AS mock_test_id,
    mt.negative_marking,
    mt.negative_marks_ratio,
    mt.shuffle_questions,
    mt.shuffle_options
  FROM public.mock_tests mt
  WHERE EXISTS (
    SELECT 1
    FROM public.blueprints blueprint
    WHERE blueprint.source_mock_test_id = mt.id
  )
)
INSERT INTO public.blueprint_fixed_questions (
  blueprint_id,
  section_id,
  question_id,
  position,
  marks,
  neg_marks,
  question_snapshot,
  answer_json
)
SELECT
  blueprint.id,
  section.id,
  question.id,
  ROW_NUMBER() OVER (
    PARTITION BY blueprint.id
    ORDER BY mtq.sort_order, mtq.question_id
  )::INTEGER - 1,
  COALESCE(mtq.marks_override, question.marks, 0),
  CASE
    WHEN legacy.negative_marking IS TRUE
    THEN COALESCE(
      NULLIF(question.negative_marks, 0),
      COALESCE(mtq.marks_override, question.marks, 0) * COALESCE(legacy.negative_marks_ratio, 0)
    )
    ELSE 0
  END,
  jsonb_build_object(
    'engine_type', CASE
      WHEN question.engine_type::TEXT = 'statement' THEN 'statement'
      WHEN question.engine_type::TEXT IN ('mcq', 'assertion_reason', 'match', 'case_based', 'fill_blank', 'equation', 'short', 'long')
        THEN question.engine_type::TEXT
      ELSE 'mcq'
    END,
    'stem', COALESCE(question.stem, question.question_text, ''),
    'explanation', question.explanation,
    'image_url', question.image_url,
    'topic_id', question.topic_id,
    'parent_id', question.parent_id,
    'difficulty', question.difficulty,
    'skill', question.skill::TEXT,
    'board_pattern', question.board_pattern::TEXT,
    'pyq_year', question.pyq_year,
    'lang', question.lang,
    'select_multiple', (
      SELECT COUNT(*) > 1
      FROM option_rows option_row
      WHERE option_row.question_id = question.id
        AND option_row.is_correct IS TRUE
    ),
    'options', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', option_row.id,
          'label', option_row.label,
          'body', option_row.body,
          'image_url', option_row.image_url,
          'position', option_row.sort_order
        )
        ORDER BY option_row.sort_order, option_row.id
      )
      FROM option_rows option_row
      WHERE option_row.question_id = question.id
    ), '[]'::JSONB)
  ),
  jsonb_build_object(
    'correct_options', COALESCE((
      SELECT jsonb_agg(option_row.label ORDER BY option_row.label)
      FROM option_rows option_row
      WHERE option_row.question_id = question.id
        AND option_row.is_correct IS TRUE
    ), '[]'::JSONB)
  )
FROM public.blueprints blueprint
JOIN eligible_tests legacy ON legacy.mock_test_id = blueprint.source_mock_test_id
JOIN public.mock_test_questions mtq ON mtq.mock_test_id = legacy.mock_test_id
JOIN public.questions question ON question.id = mtq.question_id
JOIN public.blueprint_sections section
  ON section.blueprint_id = blueprint.id
 AND section.position = 0
WHERE NOT EXISTS (
  SELECT 1
  FROM public.blueprint_fixed_questions existing
  WHERE existing.blueprint_id = blueprint.id
    AND existing.question_id = question.id
);

CREATE OR REPLACE FUNCTION public.create_engine_attempt(
  p_blueprint_id UUID,
  p_instance_id UUID,
  p_user_id UUID,
  p_started_at TIMESTAMPTZ,
  p_deadline_at TIMESTAMPTZ,
  p_max_score NUMERIC,
  p_metadata JSONB DEFAULT '{}'::JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $function$
DECLARE
  v_blueprint public.blueprints%ROWTYPE;
  v_attempt public.attempts%ROWTYPE;
  v_max_attempts INTEGER := 0;
  v_attempt_count INTEGER := 0;
BEGIN
  IF p_blueprint_id IS NULL OR p_instance_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Blueprint, instance, and user are required';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::TEXT || ':' || p_blueprint_id::TEXT, 0)
  );

  SELECT * INTO v_blueprint
  FROM public.blueprints
  WHERE id = p_blueprint_id
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Blueprint not found'; END IF;

  SELECT attempt.* INTO v_attempt
  FROM public.attempts attempt
  JOIN public.test_instances instance ON instance.id = attempt.instance_id
  WHERE attempt.user_id = p_user_id
    AND instance.blueprint_id = p_blueprint_id
    AND attempt.status = 'in_progress'
    AND attempt.deadline_at + INTERVAL '30 seconds' > NOW()
  ORDER BY attempt.started_at DESC
  LIMIT 1
  FOR UPDATE OF attempt;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'attempt_id', v_attempt.id,
      'instance_id', v_attempt.instance_id,
      'started_at', v_attempt.started_at,
      'deadline_at', v_attempt.deadline_at,
      'max_score', v_attempt.max_score,
      'status', v_attempt.status,
      'resumed', TRUE
    );
  END IF;

  UPDATE public.attempts attempt
  SET status = 'expired',
      updated_at = NOW()
  FROM public.test_instances instance
  WHERE attempt.instance_id = instance.id
    AND instance.blueprint_id = p_blueprint_id
    AND attempt.user_id = p_user_id
    AND attempt.status = 'in_progress'
    AND attempt.deadline_at + INTERVAL '30 seconds' <= NOW();

  IF v_blueprint.source_mock_test_id IS NOT NULL THEN
    SELECT COALESCE(max_attempts, 0)
    INTO v_max_attempts
    FROM public.mock_tests
    WHERE id = v_blueprint.source_mock_test_id;
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_attempt_count
  FROM public.attempts attempt
  JOIN public.test_instances instance ON instance.id = attempt.instance_id
  WHERE attempt.user_id = p_user_id
    AND instance.blueprint_id = p_blueprint_id;

  IF v_max_attempts > 0 AND v_attempt_count >= v_max_attempts THEN
    RAISE EXCEPTION 'Maximum attempts reached';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.test_instances instance
    WHERE instance.id = p_instance_id
      AND instance.blueprint_id = p_blueprint_id
      AND instance.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Test instance does not belong to this student and blueprint';
  END IF;

  INSERT INTO public.attempts (
    instance_id,
    user_id,
    status,
    started_at,
    deadline_at,
    max_score,
    metadata
  )
  VALUES (
    p_instance_id,
    p_user_id,
    'in_progress',
    p_started_at,
    p_deadline_at,
    p_max_score,
    COALESCE(p_metadata, '{}'::JSONB)
  )
  RETURNING * INTO v_attempt;

  RETURN jsonb_build_object(
    'attempt_id', v_attempt.id,
    'instance_id', v_attempt.instance_id,
    'started_at', v_attempt.started_at,
    'deadline_at', v_attempt.deadline_at,
    'max_score', v_attempt.max_score,
    'status', v_attempt.status,
    'resumed', FALSE
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_engine_attempt(UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_engine_attempt(UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, JSONB)
  TO service_role;

CREATE TABLE IF NOT EXISTS public.test_attempt_papers (
  attempt_id UUID NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL,
  marks NUMERIC(8,2) NOT NULL,
  negative_marks NUMERIC(8,2) NOT NULL DEFAULT 0,
  question_snapshot JSONB NOT NULL,
  correct_option_ids UUID[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (attempt_id, question_id),
  UNIQUE (attempt_id, position)
);

ALTER TABLE public.test_attempt_papers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.test_attempt_papers FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.test_attempt_papers TO service_role;

ALTER TABLE public.test_instance_questions
  ADD COLUMN IF NOT EXISTS question_snapshot JSONB;

CREATE TABLE IF NOT EXISTS public.test_instance_answers (
  instance_id UUID NOT NULL REFERENCES public.test_instances(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  answer_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  PRIMARY KEY (instance_id, question_id)
);
ALTER TABLE public.test_instance_answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.test_instance_answers FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.test_instance_answers TO service_role;

ALTER TABLE public.test_instances
  ADD COLUMN IF NOT EXISTS duration_sec INTEGER,
  ADD COLUMN IF NOT EXISTS slug VARCHAR(300),
  ADD COLUMN IF NOT EXISTS name VARCHAR(300);

UPDATE public.test_instances instance
SET duration_sec = blueprint.duration_sec,
    slug = blueprint.slug,
    name = blueprint.name
FROM public.blueprints blueprint
WHERE blueprint.id = instance.blueprint_id
  AND (instance.duration_sec IS NULL OR instance.slug IS NULL OR instance.name IS NULL);

UPDATE public.test_instance_questions frozen
SET question_snapshot = jsonb_build_object(
  'id', question.id,
  'engine_type', question.engine_type,
  'stem', question.stem,
  'topic_id', question.topic_id,
  'subtopic_id', question.subtopic_id,
  'parent_id', question.parent_id,
  'difficulty', question.difficulty,
  'skill', question.skill,
  'board_pattern', question.board_pattern,
  'pyq_year', question.pyq_year,
  'lang', question.lang,
  'select_multiple', COALESCE((
    SELECT CASE
      WHEN jsonb_typeof(answer.answer_json->'correct_options') = 'array'
      THEN jsonb_array_length(answer.answer_json->'correct_options') > 1
      ELSE false
    END
    FROM public.question_answers answer
    WHERE answer.question_id = question.id
  ), false),
  'options', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', opt.id, 'label', opt.label, 'body', opt.body, 'position', opt.position
    ) ORDER BY opt.position, opt.id)
    FROM public.question_options opt
    WHERE opt.question_id = question.id
  ), '[]'::JSONB)
)
FROM public.questions question
WHERE question.id = frozen.question_id
  AND frozen.question_snapshot IS NULL;

INSERT INTO public.test_instance_answers (instance_id, question_id, answer_json)
SELECT frozen.instance_id, frozen.question_id, answer.answer_json
FROM public.test_instance_questions frozen
JOIN public.question_answers answer ON answer.question_id = frozen.question_id
ON CONFLICT (instance_id, question_id) DO NOTHING;

INSERT INTO public.test_attempt_papers (
  attempt_id, question_id, position, marks, negative_marks, question_snapshot, correct_option_ids
)
SELECT
  ta.id,
  q.id,
  ROW_NUMBER() OVER (
    PARTITION BY ta.id
    ORDER BY
      CASE WHEN mt.shuffle_questions THEN md5(ta.id::TEXT || mtq.question_id::TEXT) END,
      CASE WHEN NOT mt.shuffle_questions THEN mtq.sort_order END,
      mtq.question_id
  )::INTEGER - 1,
  COALESCE(mtq.marks_override, q.marks, 0),
  COALESCE(NULLIF(q.negative_marks, 0), COALESCE(mtq.marks_override, q.marks, 0) * COALESCE(mt.negative_marks_ratio, 0)),
  jsonb_build_object(
    'id', q.id,
    'question_text', q.question_text,
    'question_html', q.question_html,
    'explanation', q.explanation,
    'image_url', q.image_url,
    'marks', COALESCE(mtq.marks_override, q.marks, 0),
    'negative_marks', COALESCE(NULLIF(q.negative_marks, 0), COALESCE(mtq.marks_override, q.marks, 0) * COALESCE(mt.negative_marks_ratio, 0)),
    'time_seconds', q.time_seconds,
    'topic_id', q.topic_id,
    'chapter_id', q.chapter_id,
    'subject_id', q.subject_id,
    'question_type', jsonb_build_object('code', qt.code),
    'options', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', qo.id,
        'option_text', qo.option_text,
        'option_html', qo.option_html,
        'image_url', qo.image_url,
        'sort_order', qo.sort_order,
        'label', qo.label,
        'body', qo.body,
        'position', qo.position,
        'is_correct', qo.is_correct
      ) ORDER BY
        CASE WHEN mt.shuffle_options THEN md5(ta.id::TEXT || qo.id::TEXT) END,
        CASE WHEN NOT mt.shuffle_options THEN qo.sort_order END,
        qo.id)
      FROM public.question_options qo
      WHERE qo.question_id = q.id
    ), '[]'::jsonb)
  ),
  COALESCE((
    SELECT ARRAY_AGG(qo.id ORDER BY qo.id)
    FROM public.question_options qo
    WHERE qo.question_id = q.id AND qo.is_correct
  ), '{}')
FROM public.test_attempts ta
JOIN public.mock_tests mt ON mt.id = ta.mock_test_id
JOIN public.mock_test_questions mtq ON mtq.mock_test_id = mt.id
JOIN public.questions q ON q.id = mtq.question_id
LEFT JOIN public.question_types qt ON qt.id = q.question_type_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.test_attempt_papers paper
  WHERE paper.attempt_id = ta.id AND paper.question_id = q.id
)
ON CONFLICT (attempt_id, question_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.start_mock_test_attempt(
  p_user_id UUID,
  p_mock_test_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_test public.mock_tests%ROWTYPE;
  v_attempt public.test_attempts%ROWTYPE;
  v_question_count INTEGER;
  v_total_marks NUMERIC(8,2);
  v_attempt_count INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_mock_test_id IS NULL THEN
    RAISE EXCEPTION 'User and test are required';
  END IF;

  SELECT * INTO v_test
  FROM public.mock_tests
  WHERE id = p_mock_test_id AND is_active = true AND is_published = true
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Mock test not found'; END IF;

  SELECT COUNT(*)::INTEGER, COALESCE(SUM(COALESCE(mtq.marks_override, q.marks, 0)), 0)::NUMERIC(8,2)
  INTO v_question_count, v_total_marks
  FROM public.mock_test_questions mtq
  JOIN public.questions q ON q.id = mtq.question_id
  WHERE mtq.mock_test_id = p_mock_test_id;

  IF v_question_count = 0 THEN RAISE EXCEPTION 'Mock test has no questions'; END IF;

  SELECT * INTO v_attempt
  FROM public.test_attempts
  WHERE user_id = p_user_id AND mock_test_id = p_mock_test_id AND status = 'in_progress'
  ORDER BY started_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF NOT EXISTS (SELECT 1 FROM public.test_attempt_papers WHERE attempt_id = v_attempt.id) THEN
      INSERT INTO public.test_attempt_papers (
        attempt_id, question_id, position, marks, negative_marks, question_snapshot, correct_option_ids
      )
      SELECT
        v_attempt.id,
        q.id,
        ROW_NUMBER() OVER (
          ORDER BY
            CASE WHEN v_test.shuffle_questions THEN md5(v_attempt.id::TEXT || mtq.question_id::TEXT) END,
            CASE WHEN NOT v_test.shuffle_questions THEN mtq.sort_order END,
            mtq.question_id
        )::INTEGER - 1,
        COALESCE(mtq.marks_override, q.marks, 0),
        COALESCE(NULLIF(q.negative_marks, 0), COALESCE(mtq.marks_override, q.marks, 0) * COALESCE(v_test.negative_marks_ratio, 0)),
        jsonb_build_object(
          'id', q.id,
          'question_text', q.question_text,
          'question_html', q.question_html,
          'explanation', q.explanation,
          'image_url', q.image_url,
          'marks', COALESCE(mtq.marks_override, q.marks, 0),
          'negative_marks', COALESCE(NULLIF(q.negative_marks, 0), COALESCE(mtq.marks_override, q.marks, 0) * COALESCE(v_test.negative_marks_ratio, 0)),
          'time_seconds', q.time_seconds,
          'topic_id', q.topic_id,
          'chapter_id', q.chapter_id,
          'subject_id', q.subject_id,
          'question_type', jsonb_build_object('code', qt.code),
          'options', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', qo.id, 'option_text', qo.option_text, 'option_html', qo.option_html,
              'image_url', qo.image_url, 'sort_order', qo.sort_order, 'label', qo.label,
              'body', qo.body, 'position', qo.position, 'is_correct', qo.is_correct
            ) ORDER BY
              CASE WHEN v_test.shuffle_options THEN md5(v_attempt.id::TEXT || qo.id::TEXT) END,
              CASE WHEN NOT v_test.shuffle_options THEN qo.sort_order END,
              qo.id)
            FROM public.question_options qo WHERE qo.question_id = q.id
          ), '[]'::jsonb)
        ),
        COALESCE((
          SELECT ARRAY_AGG(qo.id ORDER BY qo.id)
          FROM public.question_options qo
          WHERE qo.question_id = q.id AND qo.is_correct
        ), '{}')
      FROM public.mock_test_questions mtq
      JOIN public.questions q ON q.id = mtq.question_id
      LEFT JOIN public.question_types qt ON qt.id = q.question_type_id
      WHERE mtq.mock_test_id = p_mock_test_id;
    END IF;

    RETURN jsonb_build_object(
      'id', v_attempt.id,
      'started_at', v_attempt.started_at,
      'status', v_attempt.status,
      'duration_minutes', COALESCE((v_attempt.metadata #>> '{paper_settings,duration_minutes}')::INTEGER, v_test.duration_minutes),
      'resumed', true
    );
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_attempt_count
  FROM public.test_attempts
  WHERE user_id = p_user_id AND mock_test_id = p_mock_test_id;

  IF v_test.max_attempts > 0 AND v_attempt_count >= v_test.max_attempts THEN
    RAISE EXCEPTION 'Maximum attempts reached';
  END IF;

  INSERT INTO public.test_attempts (
    user_id, mock_test_id, status, total_questions, total_marks, metadata
  ) VALUES (
    p_user_id,
    p_mock_test_id,
    'in_progress',
    v_question_count,
    v_total_marks,
    jsonb_build_object('paper_settings', jsonb_build_object(
      'duration_minutes', v_test.duration_minutes,
      'negative_marking', COALESCE(v_test.negative_marking, false),
      'negative_marks_ratio', COALESCE(v_test.negative_marks_ratio, 0),
      'show_solutions', COALESCE(v_test.show_solutions, true)
    ))
  )
  RETURNING * INTO v_attempt;

  INSERT INTO public.test_attempt_papers (
    attempt_id, question_id, position, marks, negative_marks, question_snapshot, correct_option_ids
  )
  SELECT
    v_attempt.id,
    q.id,
    ROW_NUMBER() OVER (
      ORDER BY
        CASE WHEN v_test.shuffle_questions THEN md5(v_attempt.id::TEXT || mtq.question_id::TEXT) END,
        CASE WHEN NOT v_test.shuffle_questions THEN mtq.sort_order END,
        mtq.question_id
    )::INTEGER - 1,
    COALESCE(mtq.marks_override, q.marks, 0),
    COALESCE(NULLIF(q.negative_marks, 0), COALESCE(mtq.marks_override, q.marks, 0) * COALESCE(v_test.negative_marks_ratio, 0)),
    jsonb_build_object(
      'id', q.id,
      'question_text', q.question_text,
      'question_html', q.question_html,
      'explanation', q.explanation,
      'image_url', q.image_url,
      'marks', COALESCE(mtq.marks_override, q.marks, 0),
      'negative_marks', COALESCE(NULLIF(q.negative_marks, 0), COALESCE(mtq.marks_override, q.marks, 0) * COALESCE(v_test.negative_marks_ratio, 0)),
      'time_seconds', q.time_seconds,
      'topic_id', q.topic_id,
      'chapter_id', q.chapter_id,
      'subject_id', q.subject_id,
      'question_type', jsonb_build_object('code', qt.code),
      'options', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', qo.id,
          'option_text', qo.option_text,
          'option_html', qo.option_html,
          'image_url', qo.image_url,
          'sort_order', qo.sort_order,
          'label', qo.label,
          'body', qo.body,
          'position', qo.position,
          'is_correct', qo.is_correct
        ) ORDER BY
          CASE WHEN v_test.shuffle_options THEN md5(v_attempt.id::TEXT || qo.id::TEXT) END,
          CASE WHEN NOT v_test.shuffle_options THEN qo.sort_order END,
          qo.id)
        FROM public.question_options qo
        WHERE qo.question_id = q.id
      ), '[]'::jsonb)
    ),
    COALESCE((
      SELECT ARRAY_AGG(qo.id ORDER BY qo.id)
      FROM public.question_options qo
      WHERE qo.question_id = q.id AND qo.is_correct
    ), '{}')
  FROM public.mock_test_questions mtq
  JOIN public.questions q ON q.id = mtq.question_id
  LEFT JOIN public.question_types qt ON qt.id = q.question_type_id
  WHERE mtq.mock_test_id = p_mock_test_id;

  RETURN jsonb_build_object(
    'id', v_attempt.id,
    'started_at', v_attempt.started_at,
    'status', v_attempt.status,
    'duration_minutes', v_test.duration_minutes,
    'resumed', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_mock_test_attempt(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_mock_test_attempt(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.submit_test_attempt(
  p_attempt_id UUID,
  p_responses JSONB DEFAULT '[]'::JSONB,
  p_expired BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_attempt public.test_attempts%ROWTYPE;
  v_duration_minutes INTEGER;
  v_negative_marking BOOLEAN;
  v_deadline TIMESTAMPTZ;
  v_answered_count INTEGER;
  v_correct_count INTEGER;
  v_wrong_count INTEGER;
  v_total_marks NUMERIC;
  v_marks_obtained NUMERIC;
  v_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF jsonb_typeof(p_responses) <> 'array' THEN RAISE EXCEPTION 'responses must be an array'; END IF;

  SELECT * INTO v_attempt
  FROM public.test_attempts
  WHERE id = p_attempt_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'attempt not found'; END IF;
  IF v_attempt.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF v_attempt.status IN ('submitted', 'expired') THEN
    RETURN jsonb_build_object('attempt_id', v_attempt.id, 'status', v_attempt.status, 'already_submitted', true);
  END IF;

  SELECT
    COALESCE((v_attempt.metadata #>> '{paper_settings,duration_minutes}')::INTEGER, mt.duration_minutes),
    COALESCE((v_attempt.metadata #>> '{paper_settings,negative_marking}')::BOOLEAN, mt.negative_marking, false)
  INTO v_duration_minutes, v_negative_marking
  FROM public.mock_tests mt
  WHERE mt.id = v_attempt.mock_test_id;

  IF v_duration_minutes IS NULL OR v_duration_minutes <= 0 THEN
    RAISE EXCEPTION 'invalid test duration';
  END IF;
  v_deadline := v_attempt.started_at + make_interval(mins => v_duration_minutes);

  IF NOT p_expired AND NOW() >= v_deadline THEN RAISE EXCEPTION 'attempt expired'; END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_responses) AS r(question_id UUID)
    LEFT JOIN public.test_attempt_papers paper
      ON paper.attempt_id = v_attempt.id AND paper.question_id = r.question_id
    WHERE r.question_id IS NULL OR paper.question_id IS NULL
  ) THEN
    RAISE EXCEPTION 'response contains a question outside this attempt';
  END IF;

  IF EXISTS (
    SELECT r.question_id
    FROM jsonb_to_recordset(p_responses) AS r(question_id UUID)
    GROUP BY r.question_id
    HAVING COUNT(*) > 1
  ) THEN RAISE EXCEPTION 'response contains duplicate questions'; END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_responses) AS r(question_id UUID, selected_option_ids UUID[])
    CROSS JOIN LATERAL unnest(COALESCE(r.selected_option_ids, ARRAY[]::UUID[])) AS selected(option_id)
    JOIN public.test_attempt_papers paper
      ON paper.attempt_id = v_attempt.id AND paper.question_id = r.question_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(paper.question_snapshot->'options') opt(value)
      WHERE opt.value->>'id' = selected.option_id::TEXT
    )
  ) THEN RAISE EXCEPTION 'response contains an invalid option'; END IF;

  INSERT INTO public.test_responses (
    attempt_id, question_id, selected_option_ids, text_answer, numerical_answer,
    time_spent_seconds, is_bookmarked, is_review_later, is_visited, question_snapshot
  )
  SELECT
    v_attempt.id,
    r.question_id,
    r.selected_option_ids,
    NULLIF(BTRIM(r.text_answer), ''),
    r.numerical_answer,
    GREATEST(0, COALESCE(r.time_spent_seconds, 0)),
    COALESCE(r.is_bookmarked, false),
    COALESCE(r.is_review_later, false),
    COALESCE(r.is_visited, false),
    paper.question_snapshot
  FROM jsonb_to_recordset(p_responses) AS r(
    question_id UUID,
    selected_option_ids UUID[],
    text_answer TEXT,
    numerical_answer NUMERIC,
    time_spent_seconds INTEGER,
    is_bookmarked BOOLEAN,
    is_review_later BOOLEAN,
    is_visited BOOLEAN
  )
  JOIN public.test_attempt_papers paper
    ON paper.attempt_id = v_attempt.id AND paper.question_id = r.question_id
  ON CONFLICT (attempt_id, question_id) DO UPDATE SET
    selected_option_ids = EXCLUDED.selected_option_ids,
    text_answer = EXCLUDED.text_answer,
    numerical_answer = EXCLUDED.numerical_answer,
    time_spent_seconds = EXCLUDED.time_spent_seconds,
    is_bookmarked = EXCLUDED.is_bookmarked,
    is_review_later = EXCLUDED.is_review_later,
    is_visited = EXCLUDED.is_visited,
    question_snapshot = COALESCE(test_responses.question_snapshot, EXCLUDED.question_snapshot),
    updated_at = NOW();

  UPDATE public.test_responses response
  SET
    is_correct = CASE
      WHEN COALESCE(CARDINALITY(response.selected_option_ids), 0) = 0 THEN NULL
      ELSE ARRAY(SELECT unnest(response.selected_option_ids) ORDER BY 1) = paper.correct_option_ids
    END,
    marks_awarded = CASE
      WHEN COALESCE(CARDINALITY(response.selected_option_ids), 0) = 0 THEN 0
      WHEN ARRAY(SELECT unnest(response.selected_option_ids) ORDER BY 1) = paper.correct_option_ids THEN paper.marks
      WHEN v_negative_marking THEN -paper.negative_marks
      ELSE 0
    END,
    question_snapshot = COALESCE(response.question_snapshot, paper.question_snapshot),
    updated_at = NOW()
  FROM public.test_attempt_papers paper
  WHERE response.attempt_id = v_attempt.id
    AND paper.attempt_id = response.attempt_id
    AND paper.question_id = response.question_id;

  SELECT COUNT(*)::INTEGER INTO v_answered_count
  FROM public.test_responses response
  WHERE response.attempt_id = v_attempt.id
    AND (
      COALESCE(CARDINALITY(response.selected_option_ids), 0) > 0
      OR NULLIF(BTRIM(response.text_answer), '') IS NOT NULL
      OR response.numerical_answer IS NOT NULL
    );

  SELECT
    COUNT(*) FILTER (WHERE response.is_correct IS TRUE)::INTEGER,
    COUNT(*) FILTER (WHERE response.is_correct IS FALSE)::INTEGER,
    COALESCE(SUM(response.marks_awarded), 0)
  INTO v_correct_count, v_wrong_count, v_marks_obtained
  FROM public.test_responses response
  WHERE response.attempt_id = v_attempt.id;

  SELECT COALESCE(SUM(marks), 0)
  INTO v_total_marks
  FROM public.test_attempt_papers
  WHERE attempt_id = v_attempt.id;

  v_status := CASE WHEN p_expired THEN 'expired' ELSE 'submitted' END;
  UPDATE public.test_attempts
  SET status = v_status,
      submitted_at = NOW(),
      answered_count = v_answered_count,
      correct_count = v_correct_count,
      wrong_count = v_wrong_count,
      marks_obtained = v_marks_obtained,
      total_marks = v_total_marks,
      percentage = CASE WHEN v_total_marks > 0 THEN ROUND((v_marks_obtained / v_total_marks) * 100, 2) ELSE 0 END,
      skipped_count = GREATEST(0, v_attempt.total_questions - v_answered_count),
      time_spent_seconds = LEAST(v_duration_minutes * 60, GREATEST(0, EXTRACT(EPOCH FROM NOW() - v_attempt.started_at)::INTEGER))
  WHERE id = v_attempt.id;

  RETURN jsonb_build_object(
    'attempt_id', v_attempt.id,
    'status', v_status,
    'already_submitted', false,
    'answered_count', v_answered_count,
    'correct_count', v_correct_count,
    'wrong_count', v_wrong_count,
    'marks_obtained', v_marks_obtained,
    'total_marks', v_total_marks,
    'percentage', CASE WHEN v_total_marks > 0 THEN ROUND((v_marks_obtained / v_total_marks) * 100, 2) ELSE 0 END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_test_attempt(UUID, JSONB, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_test_attempt(UUID, JSONB, BOOLEAN) TO authenticated;
REVOKE ALL ON FUNCTION public.submit_test_attempt_legacy(UUID, JSONB, BOOLEAN) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_attempt_questions(p_attempt_id UUID)
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
AS $$
DECLARE
  v_user UUID;
  v_shuffle_options BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles profile WHERE profile.id = auth.uid() AND profile.is_active = true
  ) THEN RAISE EXCEPTION 'Active authentication required'; END IF;

  SELECT attempt.user_id, blueprint.shuffle_options
  INTO v_user, v_shuffle_options
  FROM public.attempts attempt
  JOIN public.test_instances instance ON instance.id = attempt.instance_id
  JOIN public.blueprints blueprint ON blueprint.id = instance.blueprint_id
  WHERE attempt.id = p_attempt_id;

  IF v_user IS NULL THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF v_user IS DISTINCT FROM auth.uid() AND NOT public.is_reviewer_or_admin() THEN
    RAISE EXCEPTION 'Not your attempt';
  END IF;

  RETURN QUERY
  SELECT
    question.id,
    COALESCE(frozen.question_snapshot->>'engine_type', question.engine_type::TEXT),
    COALESCE(frozen.question_snapshot->>'stem', question.stem),
    frozen.marks,
    frozen.neg_marks,
    frozen.position,
    (
      SELECT COALESCE(
        jsonb_agg(option.value ORDER BY
          CASE WHEN v_shuffle_options THEN md5(p_attempt_id::TEXT || (opt.value->>'id')) END,
          CASE WHEN NOT v_shuffle_options THEN (opt.value->>'position')::INTEGER END
        ),
        '[]'::JSONB
      )
      FROM jsonb_array_elements(COALESCE(frozen.question_snapshot->'options', '[]'::JSONB)) AS opt(value)
    )
  FROM public.attempts attempt
  JOIN public.test_instances instance ON instance.id = attempt.instance_id
  JOIN public.test_instance_questions frozen ON frozen.instance_id = instance.id
  JOIN public.questions question ON question.id = frozen.question_id
  WHERE attempt.id = p_attempt_id
  ORDER BY frozen.position;
END;
$$;

REVOKE ALL ON FUNCTION public.get_attempt_questions(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attempt_questions(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_engine_attempt(
  p_attempt_id UUID,
  p_answers JSONB DEFAULT '[]'::JSONB,
  p_expired BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_attempt public.attempts%ROWTYPE;
  v_question_count INTEGER;
  v_correct_count INTEGER;
  v_wrong_count INTEGER;
  v_score NUMERIC(8,2);
  v_status public.engine_attempt_status;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF jsonb_typeof(p_answers) <> 'array' THEN RAISE EXCEPTION 'Answers must be an array'; END IF;

  SELECT * INTO v_attempt
  FROM public.attempts
  WHERE id = p_attempt_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF v_attempt.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Not your attempt'; END IF;

  IF v_attempt.status IN ('submitted', 'expired', 'graded') THEN
    RETURN jsonb_build_object('attempt_id', v_attempt.id, 'status', v_attempt.status, 'already_submitted', true);
  END IF;
  IF NOT p_expired AND NOW() >= v_attempt.deadline_at THEN RAISE EXCEPTION 'Attempt expired'; END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_answers) AS answer(question_id UUID)
    LEFT JOIN public.test_instance_questions frozen
      ON frozen.instance_id = v_attempt.instance_id AND frozen.question_id = answer.question_id
    WHERE answer.question_id IS NULL OR frozen.question_id IS NULL
  ) THEN RAISE EXCEPTION 'Answer contains a question outside this attempt'; END IF;

  IF EXISTS (
    SELECT question_id
    FROM jsonb_to_recordset(p_answers) AS answer(question_id UUID)
    GROUP BY question_id
    HAVING COUNT(*) > 1
  ) THEN RAISE EXCEPTION 'Answers contain duplicate questions'; END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_answers) AS answer(question_id UUID, response_json JSONB)
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(answer.response_json->'selected_options', '[]'::JSONB)) selected(label)
    JOIN public.test_instance_questions frozen
      ON frozen.instance_id = v_attempt.instance_id AND frozen.question_id = answer.question_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(frozen.question_snapshot->'options') option_row(value)
      WHERE option_row.value->>'label' = selected.label
    )
  ) THEN RAISE EXCEPTION 'Answer contains an invalid option'; END IF;

  INSERT INTO public.attempt_answers (
    attempt_id, question_id, response_json, time_spent_sec, flagged
  )
  SELECT
    v_attempt.id,
    answer.question_id,
    COALESCE(answer.response_json, '{}'::JSONB),
    GREATEST(0, COALESCE(answer.time_spent_sec, 0)),
    COALESCE(answer.flagged, false)
  FROM jsonb_to_recordset(p_answers) AS answer(
    question_id UUID,
    response_json JSONB,
    time_spent_sec INTEGER,
    flagged BOOLEAN
  )
  ON CONFLICT (attempt_id, question_id) DO UPDATE SET
    response_json = EXCLUDED.response_json,
    time_spent_sec = EXCLUDED.time_spent_sec,
    flagged = EXCLUDED.flagged,
    updated_at = NOW();

  UPDATE public.attempt_answers saved
  SET
    is_correct = CASE
      WHEN answer.answer_json ? 'correct_options' THEN
        CASE WHEN jsonb_array_length(COALESCE(saved.response_json->'selected_options', '[]'::JSONB)) = 0 THEN NULL
        ELSE COALESCE((
          SELECT jsonb_agg(to_jsonb(selected.label) ORDER BY selected.label)
          FROM jsonb_array_elements_text(COALESCE(saved.response_json->'selected_options', '[]'::JSONB)) selected(label)
        ), '[]'::JSONB) =
        COALESCE((
          SELECT jsonb_agg(to_jsonb(expected.label) ORDER BY expected.label)
          FROM jsonb_array_elements_text(answer.answer_json->'correct_options') expected(label)
        ), '[]'::JSONB) END
      ELSE NULL
    END,
    marks_awarded = CASE
      WHEN answer.answer_json IS NULL OR NOT (answer.answer_json ? 'correct_options') THEN NULL
      WHEN jsonb_array_length(COALESCE(saved.response_json->'selected_options', '[]'::JSONB)) = 0 THEN 0
      WHEN COALESCE((
        SELECT jsonb_agg(to_jsonb(selected.label) ORDER BY selected.label)
        FROM jsonb_array_elements_text(COALESCE(saved.response_json->'selected_options', '[]'::JSONB)) selected(label)
      ), '[]'::JSONB) =
      COALESCE((
        SELECT jsonb_agg(to_jsonb(expected.label) ORDER BY expected.label)
        FROM jsonb_array_elements_text(answer.answer_json->'correct_options') expected(label)
      ), '[]'::JSONB) THEN frozen.marks
      ELSE -frozen.neg_marks
    END
  FROM public.test_instance_questions frozen
  LEFT JOIN public.test_instance_answers answer
    ON answer.instance_id = frozen.instance_id AND answer.question_id = frozen.question_id
  WHERE saved.attempt_id = v_attempt.id
    AND frozen.instance_id = v_attempt.instance_id
    AND frozen.question_id = saved.question_id;

  SELECT
    COUNT(*) FILTER (WHERE is_correct IS TRUE)::INTEGER,
    COUNT(*) FILTER (WHERE is_correct IS FALSE)::INTEGER,
    COALESCE(SUM(marks_awarded), 0)
  INTO v_correct_count, v_wrong_count, v_score
  FROM public.attempt_answers
  WHERE attempt_id = v_attempt.id;

  SELECT COUNT(*)::INTEGER INTO v_question_count
  FROM public.test_instance_questions
  WHERE instance_id = v_attempt.instance_id;

  v_status := CASE WHEN p_expired THEN 'expired' ELSE 'submitted' END;
  UPDATE public.attempts
  SET status = v_status,
      submitted_at = NOW(),
      score = v_score,
      max_score = COALESCE((
        SELECT SUM(marks) FROM public.test_instance_questions WHERE instance_id = v_attempt.instance_id
      ), 0),
      time_spent_sec = LEAST(
        GREATEST(0, EXTRACT(EPOCH FROM v_attempt.deadline_at - v_attempt.started_at)::INTEGER),
        GREATEST(0, EXTRACT(EPOCH FROM NOW() - v_attempt.started_at)::INTEGER)
      ),
      updated_at = NOW()
  WHERE id = v_attempt.id;

  RETURN jsonb_build_object(
    'attempt_id', v_attempt.id,
    'status', v_status,
    'question_count', v_question_count,
    'correct_count', v_correct_count,
    'wrong_count', v_wrong_count,
    'score', v_score,
    'max_score', v_attempt.max_score,
    'already_submitted', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_engine_attempt(UUID, JSONB, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_engine_attempt(UUID, JSONB, BOOLEAN) TO authenticated;

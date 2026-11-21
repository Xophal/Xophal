BEGIN;

-- Limit concurrent starts to one in-progress attempt per student/test.
CREATE UNIQUE INDEX IF NOT EXISTS uq_test_attempts_one_in_progress
  ON public.test_attempts (user_id, mock_test_id)
  WHERE status = 'in_progress';

-- Prevent 500 simultaneous test starts from serializing on the shared mock_tests row.
-- Test data is read-only here; locking the test row is unnecessary.
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
  WHERE id = p_mock_test_id AND is_active = true AND is_published = true;

  IF NOT FOUND THEN RAISE EXCEPTION 'Mock test not found'; END IF;

  SELECT COUNT(*)::INTEGER,
         COALESCE(SUM(COALESCE(mtq.marks_override, q.marks, 0)), 0)::NUMERIC(8,2)
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
        COALESCE(NULLIF(q.negative_marks, 0),
          COALESCE(mtq.marks_override, q.marks, 0) * COALESCE(v_test.negative_marks_ratio, 0)),
        jsonb_build_object(
          'id', q.id,
          'question_text', q.question_text,
          'question_html', q.question_html,
          'explanation', q.explanation,
          'image_url', q.image_url,
          'marks', COALESCE(mtq.marks_override, q.marks, 0),
          'negative_marks', COALESCE(NULLIF(q.negative_marks, 0),
            COALESCE(mtq.marks_override, q.marks, 0) * COALESCE(v_test.negative_marks_ratio, 0)),
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
      'duration_minutes', COALESCE(
        (v_attempt.metadata #>> '{paper_settings,duration_minutes}')::INTEGER,
        v_test.duration_minutes
      ),
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
    COALESCE(NULLIF(q.negative_marks, 0),
      COALESCE(mtq.marks_override, q.marks, 0) * COALESCE(v_test.negative_marks_ratio, 0)),
    jsonb_build_object(
      'id', q.id,
      'question_text', q.question_text,
      'question_html', q.question_html,
      'explanation', q.explanation,
      'image_url', q.image_url,
      'marks', COALESCE(mtq.marks_override, q.marks, 0),
      'negative_marks', COALESCE(NULLIF(q.negative_marks, 0),
        COALESCE(mtq.marks_override, q.marks, 0) * COALESCE(v_test.negative_marks_ratio, 0)),
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

COMMIT;

-- A single RPC makes response persistence and final attempt state atomic.
CREATE OR REPLACE FUNCTION public.submit_test_attempt(
  p_attempt_id UUID,
  p_responses JSONB DEFAULT '[]'::jsonb,
  p_expired BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt test_attempts%ROWTYPE;
  v_duration_minutes INTEGER;
  v_is_expired BOOLEAN;
  v_answered_count INTEGER;
  v_correct_count INTEGER;
  v_wrong_count INTEGER;
  v_total_marks NUMERIC;
  v_marks_obtained NUMERIC;
  v_status TEXT;
BEGIN
  -- Load attempt row and lock it
  SELECT ta.*
    INTO v_attempt
    FROM test_attempts ta
   WHERE ta.id = p_attempt_id
   FOR UPDATE;

  -- Load duration from mock_tests and lock that row as well
  SELECT mt.duration_minutes
    INTO v_duration_minutes
    FROM mock_tests mt
   WHERE mt.id = v_attempt.mock_test_id
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'attempt not found'; END IF;
  IF v_attempt.user_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF v_attempt.status IN ('submitted', 'expired') THEN
    RETURN jsonb_build_object('attempt_id', v_attempt.id, 'status', v_attempt.status, 'already_submitted', true);
  END IF;

  IF jsonb_typeof(p_responses) <> 'array' THEN RAISE EXCEPTION 'responses must be an array'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_responses) AS r(question_id UUID, selected_option_ids UUID[], text_answer TEXT, numerical_answer NUMERIC, time_spent_seconds INTEGER, is_bookmarked BOOLEAN, is_review_later BOOLEAN)
    LEFT JOIN mock_test_questions mtq ON mtq.mock_test_id = v_attempt.mock_test_id AND mtq.question_id = r.question_id
    WHERE r.question_id IS NULL OR mtq.question_id IS NULL
  ) THEN RAISE EXCEPTION 'response contains a question outside this test'; END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_responses) AS r(question_id UUID, selected_option_ids UUID[])
    CROSS JOIN LATERAL unnest(COALESCE(r.selected_option_ids, ARRAY[]::UUID[])) option_id
    LEFT JOIN question_options qo ON qo.id = option_id AND qo.question_id = r.question_id
    WHERE qo.id IS NULL
  ) THEN RAISE EXCEPTION 'response contains an invalid option'; END IF;

  INSERT INTO test_responses (attempt_id, question_id, selected_option_ids, text_answer, numerical_answer, time_spent_seconds, is_bookmarked, is_review_later)
  SELECT v_attempt.id, r.question_id, r.selected_option_ids, NULLIF(BTRIM(r.text_answer), ''), r.numerical_answer,
         GREATEST(0, COALESCE(r.time_spent_seconds, 0)), COALESCE(r.is_bookmarked, false), COALESCE(r.is_review_later, false)
    FROM jsonb_to_recordset(p_responses) AS r(question_id UUID, selected_option_ids UUID[], text_answer TEXT, numerical_answer NUMERIC, time_spent_seconds INTEGER, is_bookmarked BOOLEAN, is_review_later BOOLEAN)
  ON CONFLICT (attempt_id, question_id) DO UPDATE SET
    selected_option_ids = EXCLUDED.selected_option_ids, text_answer = EXCLUDED.text_answer, numerical_answer = EXCLUDED.numerical_answer,
    time_spent_seconds = EXCLUDED.time_spent_seconds, is_bookmarked = EXCLUDED.is_bookmarked, is_review_later = EXCLUDED.is_review_later, updated_at = NOW();

  SELECT COUNT(*) INTO v_answered_count FROM test_responses tr
   WHERE tr.attempt_id = v_attempt.id
     AND (CARDINALITY(tr.selected_option_ids) > 0 OR NULLIF(BTRIM(tr.text_answer), '') IS NOT NULL OR tr.numerical_answer IS NOT NULL);

  -- Only objective option answers have trusted answer keys in the current schema.
  UPDATE test_responses tr
     SET is_correct = CASE
          WHEN CARDINALITY(tr.selected_option_ids) IS NULL OR CARDINALITY(tr.selected_option_ids) = 0 THEN NULL
          WHEN ARRAY(SELECT unnest(tr.selected_option_ids) ORDER BY 1) = ARRAY(SELECT qo.id FROM question_options qo WHERE qo.question_id = tr.question_id AND qo.is_correct ORDER BY qo.id) THEN TRUE
          ELSE FALSE
        END,
        marks_awarded = CASE
          WHEN CARDINALITY(tr.selected_option_ids) IS NULL OR CARDINALITY(tr.selected_option_ids) = 0 THEN 0
          WHEN ARRAY(SELECT unnest(tr.selected_option_ids) ORDER BY 1) = ARRAY(SELECT qo.id FROM question_options qo WHERE qo.question_id = tr.question_id AND qo.is_correct ORDER BY qo.id)
            THEN COALESCE(mtq.marks_override, q.marks)
          WHEN mt.negative_marking THEN -COALESCE(NULLIF(q.negative_marks, 0), COALESCE(mtq.marks_override, q.marks) * mt.negative_marks_ratio)
          ELSE 0
        END
    FROM questions q
    JOIN mock_test_questions mtq ON mtq.question_id = q.id AND mtq.mock_test_id = v_attempt.mock_test_id
    JOIN mock_tests mt ON mt.id = mtq.mock_test_id
   WHERE tr.attempt_id = v_attempt.id AND tr.question_id = q.id;

  SELECT COUNT(*) FILTER (WHERE is_correct), COUNT(*) FILTER (WHERE is_correct = FALSE), COALESCE(SUM(marks_awarded), 0)
    INTO v_correct_count, v_wrong_count, v_marks_obtained
    FROM test_responses WHERE attempt_id = v_attempt.id;
  SELECT COALESCE(SUM(COALESCE(mtq.marks_override, q.marks)), 0) INTO v_total_marks
    FROM mock_test_questions mtq JOIN questions q ON q.id = mtq.question_id
   WHERE mtq.mock_test_id = v_attempt.mock_test_id;

  v_is_expired := p_expired OR NOW() >= v_attempt.started_at + make_interval(mins => v_duration_minutes);
  v_status := CASE WHEN v_is_expired THEN 'expired' ELSE 'submitted' END;
  UPDATE test_attempts SET status = v_status, submitted_at = NOW(), answered_count = v_answered_count,
    correct_count = v_correct_count, wrong_count = v_wrong_count, marks_obtained = v_marks_obtained, total_marks = v_total_marks,
    percentage = CASE WHEN v_total_marks > 0 THEN ROUND((v_marks_obtained / v_total_marks) * 100, 2) ELSE 0 END,
    skipped_count = GREATEST(0, v_attempt.total_questions - v_answered_count),
    time_spent_seconds = LEAST(v_duration_minutes * 60, GREATEST(0, EXTRACT(EPOCH FROM NOW() - v_attempt.started_at)::INTEGER))
   WHERE id = v_attempt.id;

  RETURN jsonb_build_object('attempt_id', v_attempt.id, 'status', v_status, 'already_submitted', false, 'answered_count', v_answered_count,
    'correct_count', v_correct_count, 'wrong_count', v_wrong_count, 'marks_obtained', v_marks_obtained, 'total_marks', v_total_marks,
    'percentage', CASE WHEN v_total_marks > 0 THEN ROUND((v_marks_obtained / v_total_marks) * 100, 2) ELSE 0 END);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_test_attempt(UUID, JSONB, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_test_attempt(UUID, JSONB, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_engine_attempt_answers(
  p_attempt_id UUID,
  p_answers JSONB DEFAULT '[]'::JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_attempt public.attempts%ROWTYPE;
  v_answer_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array' THEN
    RAISE EXCEPTION 'Answers must be an array';
  END IF;
  IF jsonb_array_length(p_answers) > 500 THEN
    RAISE EXCEPTION 'Too many answers';
  END IF;

  SELECT * INTO v_attempt
  FROM public.attempts
  WHERE id = p_attempt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found';
  END IF;
  IF v_attempt.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not your attempt';
  END IF;
  IF v_attempt.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Attempt is already closed';
  END IF;
  IF NOW() >= v_attempt.deadline_at THEN
    RAISE EXCEPTION 'Attempt expired';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_answers) answer(value)
    WHERE jsonb_typeof(answer.value) <> 'object'
       OR jsonb_typeof(answer.value->'question_id') <> 'string'
       OR (answer.value->>'question_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR (
         answer.value ? 'selected_options'
         AND (
           jsonb_typeof(answer.value->'selected_options') <> 'array'
           OR jsonb_array_length(answer.value->'selected_options') > 20
         )
       )
       OR (
         answer.value ? 'text_answer'
         AND (
           jsonb_typeof(answer.value->'text_answer') NOT IN ('string', 'null')
           OR length(answer.value->>'text_answer') > 10000
         )
       )
       OR (
         answer.value ? 'numerical_answer'
         AND jsonb_typeof(answer.value->'numerical_answer') NOT IN ('number', 'null')
       )
       OR (
         answer.value ? 'time_spent_sec'
         AND (
           jsonb_typeof(answer.value->'time_spent_sec') <> 'number'
           OR (answer.value->>'time_spent_sec') !~ '^[0-9]+$'
           OR (answer.value->>'time_spent_sec')::NUMERIC > 86400
         )
       )
       OR (
         answer.value ? 'flagged'
         AND jsonb_typeof(answer.value->'flagged') NOT IN ('boolean', 'null')
       )
  ) THEN
    RAISE EXCEPTION 'Answer payload is invalid';
  END IF;

  IF EXISTS (
    SELECT question_id
    FROM jsonb_to_recordset(p_answers) AS answer(question_id UUID)
    GROUP BY question_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Answers contain duplicate questions';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_answers) AS answer(question_id UUID)
    LEFT JOIN public.test_instance_questions frozen
      ON frozen.instance_id = v_attempt.instance_id
     AND frozen.question_id = answer.question_id
    WHERE frozen.question_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Answer contains a question outside this attempt';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_answers) answer(value)
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(answer.value->'selected_options') = 'array'
          THEN answer.value->'selected_options'
        ELSE '[]'::JSONB
      END
    ) option_row(value)
    JOIN public.test_instance_questions frozen
      ON frozen.instance_id = v_attempt.instance_id
     AND frozen.question_id = (answer.value->>'question_id')::UUID
    WHERE jsonb_typeof(option_row.value) <> 'string'
       OR length(option_row.value #>> '{}') NOT BETWEEN 1 AND 10
       OR NOT EXISTS (
         SELECT 1
         FROM jsonb_array_elements(frozen.question_snapshot->'options') frozen_option(value)
         WHERE frozen_option.value->>'label' = option_row.value #>> '{}'
       )
  ) THEN
    RAISE EXCEPTION 'Answer contains an invalid option';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_answer_count
  FROM jsonb_array_elements(p_answers);

  INSERT INTO public.attempt_answers (
    attempt_id, question_id, response_json, time_spent_sec, flagged
  )
  SELECT
    v_attempt.id,
    answer.question_id,
    jsonb_build_object(
      'selected_options', COALESCE(answer.selected_options, '[]'::JSONB),
      'text_answer', answer.text_answer,
      'numerical_answer', answer.numerical_answer
    ),
    COALESCE(answer.time_spent_sec, 0),
    COALESCE(answer.flagged, false)
  FROM jsonb_to_recordset(p_answers) AS answer(
    question_id UUID,
    selected_options JSONB,
    text_answer TEXT,
    numerical_answer NUMERIC,
    time_spent_sec INTEGER,
    flagged BOOLEAN
  )
  ON CONFLICT (attempt_id, question_id) DO UPDATE SET
    response_json = EXCLUDED.response_json,
    time_spent_sec = EXCLUDED.time_spent_sec,
    flagged = EXCLUDED.flagged,
    updated_at = NOW();

  RETURN jsonb_build_object('saved', v_answer_count);
END;
$$;

REVOKE ALL ON FUNCTION public.save_engine_attempt_answers(UUID, JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_engine_attempt_answers(UUID, JSONB)
  TO authenticated;

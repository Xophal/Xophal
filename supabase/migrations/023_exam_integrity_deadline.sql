-- Reject legacy submissions that arrive after the server deadline.
ALTER FUNCTION public.submit_test_attempt(UUID, JSONB, BOOLEAN)
  RENAME TO submit_test_attempt_legacy;

CREATE OR REPLACE FUNCTION public.submit_test_attempt(
  p_attempt_id UUID,
  p_responses JSONB DEFAULT '[]'::jsonb,
  p_expired BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_attempt test_attempts%ROWTYPE;
  v_duration_minutes INTEGER;
BEGIN
  SELECT ta.* INTO v_attempt
  FROM test_attempts ta
  WHERE ta.id = p_attempt_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'attempt not found'; END IF;
  IF v_attempt.user_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT mt.duration_minutes INTO v_duration_minutes
  FROM mock_tests mt
  WHERE mt.id = v_attempt.mock_test_id;

  IF v_attempt.status IN ('submitted', 'expired') THEN
    RETURN jsonb_build_object('attempt_id', v_attempt.id, 'status', v_attempt.status, 'already_submitted', true);
  END IF;

  IF v_duration_minutes IS NULL OR NOW() >= v_attempt.started_at + make_interval(mins => v_duration_minutes) THEN
    RAISE EXCEPTION 'attempt expired';
  END IF;

  RETURN public.submit_test_attempt_legacy(p_attempt_id, p_responses, p_expired);
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_test_attempt(UUID, JSONB, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_test_attempt(UUID, JSONB, BOOLEAN) TO authenticated;

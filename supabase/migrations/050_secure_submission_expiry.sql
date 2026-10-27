-- Keep the existing RPC signatures, but never let callers choose whether the
-- database treats a submission as expired.
ALTER FUNCTION public.submit_test_attempt(UUID, JSONB, BOOLEAN)
  RENAME TO submit_test_attempt_with_caller_expiry;

REVOKE ALL ON FUNCTION public.submit_test_attempt_with_caller_expiry(UUID, JSONB, BOOLEAN)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.submit_test_attempt(
  p_attempt_id UUID,
  p_responses JSONB DEFAULT '[]'::JSONB,
  p_expired BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE SQL
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $function$
  SELECT public.submit_test_attempt_with_caller_expiry(
    p_attempt_id,
    p_responses,
    FALSE
  );
$function$;

REVOKE ALL ON FUNCTION public.submit_test_attempt(UUID, JSONB, BOOLEAN)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_test_attempt(UUID, JSONB, BOOLEAN)
  TO authenticated;

ALTER FUNCTION public.submit_engine_attempt(UUID, JSONB, BOOLEAN)
  RENAME TO submit_engine_attempt_with_caller_expiry;

REVOKE ALL ON FUNCTION public.submit_engine_attempt_with_caller_expiry(UUID, JSONB, BOOLEAN)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.submit_engine_attempt(
  p_attempt_id UUID,
  p_answers JSONB DEFAULT '[]'::JSONB,
  p_expired BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE SQL
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $function$
  SELECT public.submit_engine_attempt_with_caller_expiry(
    p_attempt_id,
    p_answers,
    FALSE
  );
$function$;

REVOKE ALL ON FUNCTION public.submit_engine_attempt(UUID, JSONB, BOOLEAN)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_engine_attempt(UUID, JSONB, BOOLEAN)
  TO authenticated;

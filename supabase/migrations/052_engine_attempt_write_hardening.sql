-- Students must not write attempt state or grading fields directly through
-- PostgREST. The application uses trusted server operations, and submissions
-- remain available through the ownership-checking SECURITY DEFINER RPC.

DROP POLICY IF EXISTS attempts_own_insert ON public.attempts;
DROP POLICY IF EXISTS attempts_own_update ON public.attempts;
DROP POLICY IF EXISTS attempt_answers_own_upsert ON public.attempt_answers;

REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.attempts, public.attempt_answers
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.attempts, public.attempt_answers
  TO service_role;

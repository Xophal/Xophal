-- Published test metadata is public for discovery; test content remains access-gated.
GRANT EXECUTE ON FUNCTION public.can_access_mock_test(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

DROP POLICY IF EXISTS mock_tests_read ON public.mock_tests;
CREATE POLICY mock_tests_read ON public.mock_tests
  FOR SELECT
  USING (
    is_published = TRUE
    AND is_active = TRUE
  );

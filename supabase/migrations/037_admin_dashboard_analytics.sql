CREATE OR REPLACE FUNCTION get_test_popularity(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(id UUID, title TEXT, attempts BIGINT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mt.id, mt.title::TEXT, COUNT(ta.id)
  FROM mock_tests AS mt
  JOIN test_attempts AS ta ON ta.mock_test_id = mt.id
  WHERE ta.status IN ('submitted', 'expired')
    AND (p_from IS NULL OR ta.started_at >= p_from)
    AND (p_to IS NULL OR ta.started_at <= p_to)
  GROUP BY mt.id, mt.title
  ORDER BY COUNT(ta.id) DESC, mt.title
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 100));
$$;

CREATE OR REPLACE FUNCTION get_daily_attempts_summary(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS TABLE(date DATE, completed_count BIGINT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DATE_TRUNC('day', ta.started_at)::DATE, COUNT(*)
  FROM test_attempts AS ta
  WHERE ta.status IN ('submitted', 'expired')
    AND (p_from IS NULL OR ta.started_at >= p_from)
    AND (p_to IS NULL OR ta.started_at <= p_to)
  GROUP BY DATE_TRUNC('day', ta.started_at)::DATE
  ORDER BY DATE_TRUNC('day', ta.started_at)::DATE;
$$;

CREATE OR REPLACE FUNCTION get_admin_assessment_metrics(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ,
  p_test_id UUID DEFAULT NULL
)
RETURNS TABLE(average_score NUMERIC, average_percentage NUMERIC, average_accuracy NUMERIC)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(AVG(ta.marks_obtained), 0),
    COALESCE(AVG(ta.percentage), 0),
    COALESCE(
      SUM(ta.correct_count)::NUMERIC * 100 / NULLIF(SUM(ta.correct_count + ta.wrong_count), 0),
      0
    )
  FROM test_attempts AS ta
  WHERE ta.status IN ('submitted', 'expired')
    AND (p_from IS NULL OR ta.started_at >= p_from)
    AND (p_to IS NULL OR ta.started_at <= p_to)
    AND (p_test_id IS NULL OR ta.mock_test_id = p_test_id);
$$;

REVOKE ALL ON FUNCTION get_test_popularity(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION get_daily_attempts_summary(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION get_admin_assessment_metrics(TIMESTAMPTZ, TIMESTAMPTZ, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_test_popularity(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_daily_attempts_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION get_admin_assessment_metrics(TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO service_role;
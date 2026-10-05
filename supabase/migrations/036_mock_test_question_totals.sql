CREATE OR REPLACE FUNCTION refresh_mock_test_totals(p_mock_test_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE mock_tests AS mt
  SET total_questions = totals.question_count,
      total_marks = totals.total_marks
  FROM (
    SELECT COUNT(*)::INT AS question_count,
           COALESCE(SUM(COALESCE(mtq.marks_override, q.marks, 0)), 0)::NUMERIC(8,2) AS total_marks
    FROM mock_test_questions AS mtq
    JOIN questions AS q ON q.id = mtq.question_id
    WHERE mtq.mock_test_id = p_mock_test_id
      AND q.status = 'published'
      AND q.is_active = true
  ) AS totals
  WHERE mt.id = p_mock_test_id;
END;
$$;

CREATE OR REPLACE FUNCTION refresh_mock_test_totals_after_link_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM refresh_mock_test_totals(OLD.mock_test_id);
  END IF;
  IF TG_OP <> 'DELETE' AND (TG_OP <> 'UPDATE' OR NEW.mock_test_id IS DISTINCT FROM OLD.mock_test_id) THEN
    PERFORM refresh_mock_test_totals(NEW.mock_test_id);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM refresh_mock_test_totals(NEW.mock_test_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION refresh_mock_test_totals_after_question_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  linked_test RECORD;
BEGIN
  FOR linked_test IN
    SELECT mock_test_id FROM mock_test_questions WHERE question_id = NEW.id
  LOOP
    PERFORM refresh_mock_test_totals(linked_test.mock_test_id);
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS mock_test_question_totals_on_link_change ON mock_test_questions;
CREATE TRIGGER mock_test_question_totals_on_link_change
AFTER INSERT OR UPDATE OR DELETE ON mock_test_questions
FOR EACH ROW EXECUTE FUNCTION refresh_mock_test_totals_after_link_change();

DROP TRIGGER IF EXISTS mock_test_question_totals_on_question_change ON questions;
CREATE TRIGGER mock_test_question_totals_on_question_change
AFTER UPDATE OF marks, status, is_active ON questions
FOR EACH ROW WHEN (
  OLD.marks IS DISTINCT FROM NEW.marks
  OR OLD.status IS DISTINCT FROM NEW.status
  OR OLD.is_active IS DISTINCT FROM NEW.is_active
)
EXECUTE FUNCTION refresh_mock_test_totals_after_question_change();

SELECT refresh_mock_test_totals(id) FROM mock_tests;

REVOKE ALL ON FUNCTION refresh_mock_test_totals(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION refresh_mock_test_totals_after_link_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION refresh_mock_test_totals_after_question_change() FROM PUBLIC, anon, authenticated;
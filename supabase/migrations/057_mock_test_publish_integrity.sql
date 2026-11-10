ALTER TABLE public.blueprints
  ALTER COLUMN is_public SET DEFAULT false;

CREATE OR REPLACE FUNCTION enforce_mock_test_publish_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_linked_count INTEGER;
  v_valid_count INTEGER;
  v_total_marks NUMERIC(8,2);
BEGIN
  IF NOT NEW.is_published THEN
    RETURN NEW;
  END IF;

  IF NEW.is_active IS NOT TRUE OR NEW.duration_minutes <= 0 THEN
    RAISE EXCEPTION 'An active test with a positive duration is required before publishing'
      USING ERRCODE = '23514';
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE question.status = 'published' AND question.is_active IS TRUE)::INTEGER,
    COALESCE(
      SUM(COALESCE(test_question.marks_override, question.marks, 0))
        FILTER (WHERE question.status = 'published' AND question.is_active IS TRUE),
      0
    )::NUMERIC(8,2)
  INTO v_linked_count, v_valid_count, v_total_marks
  FROM public.mock_test_questions AS test_question
  JOIN public.questions AS question ON question.id = test_question.question_id
  WHERE test_question.mock_test_id = NEW.id;

  IF v_linked_count = 0
    OR v_linked_count <> v_valid_count
    OR v_linked_count <> NEW.total_questions
    OR v_total_marks <> NEW.total_marks
  THEN
    RAISE EXCEPTION 'A mock test must have matching totals and only active, published questions before publishing'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mock_test_publish_integrity ON public.mock_tests;
CREATE TRIGGER mock_test_publish_integrity
BEFORE INSERT OR UPDATE OF is_published ON public.mock_tests
FOR EACH ROW
WHEN (NEW.is_published = true)
EXECUTE FUNCTION enforce_mock_test_publish_integrity();

CREATE OR REPLACE FUNCTION unpublish_mock_test_after_published_data_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.mock_tests
  SET is_published = false,
      published_at = NULL
  WHERE id = NEW.id
    AND is_published;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS mock_test_unpublish_after_published_data_change ON public.mock_tests;
CREATE TRIGGER mock_test_unpublish_after_published_data_change
AFTER UPDATE OF is_active, duration_minutes, total_questions, total_marks ON public.mock_tests
FOR EACH ROW
WHEN (
  OLD.is_published
  AND NEW.is_published
  AND (
    OLD.is_active IS DISTINCT FROM NEW.is_active
    OR OLD.duration_minutes IS DISTINCT FROM NEW.duration_minutes
    OR OLD.total_questions IS DISTINCT FROM NEW.total_questions
    OR OLD.total_marks IS DISTINCT FROM NEW.total_marks
  )
)
EXECUTE FUNCTION unpublish_mock_test_after_published_data_change();

CREATE OR REPLACE FUNCTION unpublish_mock_tests_for_unavailable_questions()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'published' OR NEW.is_active IS NOT TRUE THEN
    UPDATE public.mock_tests AS mock_test
    SET is_published = false,
        published_at = NULL
    WHERE mock_test.is_published
      AND EXISTS (
        SELECT 1
        FROM public.mock_test_questions AS test_question
        WHERE test_question.mock_test_id = mock_test.id
          AND test_question.question_id = NEW.id
      );
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS mock_test_unpublish_for_unavailable_question ON public.questions;
CREATE TRIGGER mock_test_unpublish_for_unavailable_question
AFTER UPDATE OF status, is_active ON public.questions
FOR EACH ROW
WHEN (
  OLD.status IS DISTINCT FROM NEW.status
  OR OLD.is_active IS DISTINCT FROM NEW.is_active
)
EXECUTE FUNCTION unpublish_mock_tests_for_unavailable_questions();

CREATE OR REPLACE FUNCTION unpublish_mock_tests_after_question_link_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    UPDATE public.mock_tests
    SET is_published = false,
        published_at = NULL
    WHERE id = OLD.mock_test_id
      AND is_published;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    UPDATE public.mock_tests
    SET is_published = false,
        published_at = NULL
    WHERE id = NEW.mock_test_id
      AND is_published;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS mock_test_unpublish_after_question_removal ON public.mock_test_questions;
DROP TRIGGER IF EXISTS mock_test_unpublish_after_question_link_change ON public.mock_test_questions;
CREATE TRIGGER mock_test_unpublish_after_question_link_change
AFTER INSERT OR UPDATE OF mock_test_id, question_id OR DELETE ON public.mock_test_questions
FOR EACH ROW
EXECUTE FUNCTION unpublish_mock_tests_after_question_link_change();

WITH linked_totals AS (
  SELECT
    test_question.mock_test_id,
    COUNT(*)::INTEGER AS linked_count,
    COUNT(*) FILTER (
      WHERE question.status = 'published'
        AND question.is_active IS TRUE
    )::INTEGER AS valid_count,
    COALESCE(
      SUM(COALESCE(test_question.marks_override, question.marks, 0))
        FILTER (WHERE question.status = 'published' AND question.is_active IS TRUE),
      0
    )::NUMERIC(8,2) AS valid_marks
  FROM public.mock_test_questions AS test_question
  JOIN public.questions AS question ON question.id = test_question.question_id
  GROUP BY test_question.mock_test_id
)
UPDATE public.mock_tests AS mock_test
SET is_published = false,
    published_at = NULL
FROM linked_totals
WHERE mock_test.id = linked_totals.mock_test_id
  AND mock_test.is_published
  AND (
    mock_test.is_active IS NOT TRUE
    OR mock_test.duration_minutes <= 0
    OR linked_totals.linked_count = 0
    OR linked_totals.linked_count <> linked_totals.valid_count
    OR linked_totals.linked_count <> mock_test.total_questions
    OR linked_totals.valid_marks <> mock_test.total_marks
  );

UPDATE public.mock_tests AS mock_test
SET is_published = false,
    published_at = NULL
WHERE mock_test.is_published
  AND NOT EXISTS (
    SELECT 1
    FROM public.mock_test_questions AS test_question
    WHERE test_question.mock_test_id = mock_test.id
  );

REVOKE ALL ON FUNCTION enforce_mock_test_publish_integrity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION unpublish_mock_test_after_published_data_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION unpublish_mock_tests_for_unavailable_questions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION unpublish_mock_tests_after_question_link_change() FROM PUBLIC, anon, authenticated;

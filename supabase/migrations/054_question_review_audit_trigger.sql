-- Capture review-state changes in the same transaction as the question write.
CREATE OR REPLACE FUNCTION public.audit_question_review_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.question_review_history (
      question_id, from_status, to_status, actor_id, note
    ) VALUES (
      NEW.id, NULL, NEW.engine_status, COALESCE(NEW.reviewed_by, NEW.created_by), NEW.review_notes
    );
    RETURN NEW;
  END IF;

  IF NEW.engine_status IS DISTINCT FROM OLD.engine_status THEN
    INSERT INTO public.question_review_history (
      question_id, from_status, to_status, actor_id, note
    ) VALUES (
      NEW.id, OLD.engine_status, NEW.engine_status, COALESCE(NEW.reviewed_by, NEW.created_by), NEW.review_notes
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS questions_review_audit_insert ON public.questions;
CREATE TRIGGER questions_review_audit_insert
  AFTER INSERT ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.audit_question_review_transition();

DROP TRIGGER IF EXISTS questions_review_audit_update ON public.questions;
CREATE TRIGGER questions_review_audit_update
  AFTER UPDATE OF engine_status ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.audit_question_review_transition();

REVOKE ALL ON FUNCTION public.audit_question_review_transition() FROM PUBLIC, anon, authenticated;

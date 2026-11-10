CREATE OR REPLACE FUNCTION public.audit_manual_payment_rejection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.status = 'pending_verification' AND NEW.status = 'rejected' THEN
    INSERT INTO public.admin_audit_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      previous_state,
      new_state,
      reason
    )
    VALUES (
      NEW.approved_by,
      'manual_payment_rejected',
      'payment_submission',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object(
        'status', NEW.status,
        'amount_minor', NEW.final_amount_minor,
        'currency', NEW.currency
      ),
      NEW.reason
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_manual_payment_rejection()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS manual_payment_rejection_audit ON public.payment_submissions;
CREATE TRIGGER manual_payment_rejection_audit
  AFTER UPDATE OF status ON public.payment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_manual_payment_rejection();

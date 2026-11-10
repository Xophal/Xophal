ALTER TABLE public.payment_submissions
  ADD COLUMN IF NOT EXISTS student_note TEXT
    CHECK (student_note IS NULL OR length(btrim(student_note)) BETWEEN 1 AND 1000);

ALTER TABLE public.manual_payment_settings
  DROP CONSTRAINT IF EXISTS manual_payment_settings_vpa_format;

ALTER TABLE public.manual_payment_settings
  ADD CONSTRAINT manual_payment_settings_vpa_format
    CHECK (
      upi_id IS NULL
      OR (
        upi_id ~ '^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$'
        AND length(split_part(upi_id, '@', 1)) BETWEEN 2 AND 256
        AND length(split_part(upi_id, '@', 2)) BETWEEN 2 AND 64
      )
    );

CREATE OR REPLACE FUNCTION public.keep_payment_claim_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.claimed_amount_minor IS DISTINCT FROM OLD.claimed_amount_minor
    OR NEW.payment_paid_at IS DISTINCT FROM OLD.payment_paid_at
    OR NEW.receipt_path IS DISTINCT FROM OLD.receipt_path
    OR NEW.student_note IS DISTINCT FROM OLD.student_note
  THEN
    RAISE EXCEPTION 'Payment claim details are immutable';
  END IF;

  RETURN NEW;
END;
$$;

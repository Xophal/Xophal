-- Student-submitted payment claims and private receipt storage.
-- Receipt contents and claimed payment details never grant subscription access.

ALTER TABLE public.payment_submissions
  ADD COLUMN IF NOT EXISTS claimed_amount_minor INTEGER
    CHECK (claimed_amount_minor IS NULL OR claimed_amount_minor > 0),
  ADD COLUMN IF NOT EXISTS payment_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receipt_path TEXT;

ALTER TABLE public.manual_payment_settings
  ADD COLUMN IF NOT EXISTS qr_code_url TEXT
    CHECK (
      qr_code_url IS NULL
      OR (left(qr_code_url, 1) = '/' AND left(qr_code_url, 2) <> '//')
    );

DROP POLICY IF EXISTS payment_submissions_owner_insert ON public.payment_submissions;
REVOKE INSERT ON TABLE public.payment_submissions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.payment_submissions TO service_role;

CREATE OR REPLACE FUNCTION public.keep_payment_claim_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.claimed_amount_minor IS DISTINCT FROM OLD.claimed_amount_minor
    OR NEW.payment_paid_at IS DISTINCT FROM OLD.payment_paid_at
    OR NEW.receipt_path IS DISTINCT FROM OLD.receipt_path
  THEN
    RAISE EXCEPTION 'Payment claim details are immutable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_claim_immutable ON public.payment_submissions;
CREATE TRIGGER payment_claim_immutable
  BEFORE UPDATE ON public.payment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.keep_payment_claim_immutable();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'upi-receipts',
  'upi-receipts',
  false,
  3145728,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- The server uses the service role for receipt operations. No student-facing
-- storage policy is created, so browser clients cannot read or replace files.

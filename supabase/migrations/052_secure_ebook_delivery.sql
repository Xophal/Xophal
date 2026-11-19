-- Secure ebook delivery for manual UPI purchases.
-- Existing manual_payment_requests and ebook_transactions remain canonical.

CREATE TABLE IF NOT EXISTS public.product_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.ebook_listings(id) ON DELETE CASCADE,
  storage_bucket TEXT NOT NULL DEFAULT 'ebook-pdfs',
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, storage_bucket, storage_path)
);

CREATE UNIQUE INDEX IF NOT EXISTS product_files_active_product_idx
  ON public.product_files(product_id) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.user_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.ebook_listings(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.ebook_transactions(id) ON DELETE RESTRICT,
  access_status TEXT NOT NULL DEFAULT 'active'
    CHECK (access_status IN ('active', 'revoked')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  UNIQUE (user_id, product_id),
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS user_library_user_idx
  ON public.user_library(user_id, access_status, granted_at DESC);
CREATE INDEX IF NOT EXISTS user_library_product_idx
  ON public.user_library(product_id, access_status);

CREATE TABLE IF NOT EXISTS public.payment_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.manual_payment_requests(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.ebook_transactions(id) ON DELETE SET NULL,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('submitted', 'under_review', 'approved', 'rejected', 'request_information', 'cancelled')),
  previous_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_verification_logs_request_idx
  ON public.payment_verification_logs(request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.download_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.ebook_listings(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES public.ebook_transactions(id) ON DELETE SET NULL,
  file_id UUID REFERENCES public.product_files(id) ON DELETE SET NULL,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS download_logs_user_idx
  ON public.download_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS download_logs_product_idx
  ON public.download_logs(product_id, created_at DESC);

ALTER TABLE public.manual_payment_requests
  ADD COLUMN IF NOT EXISTS payment_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_note TEXT;

ALTER TABLE public.manual_payment_requests DROP CONSTRAINT IF EXISTS manual_payment_requests_status_check;
ALTER TABLE public.manual_payment_requests ADD CONSTRAINT manual_payment_requests_status_check
  CHECK (status IN ('pending_payment', 'pending_verification', 'under_review', 'approved', 'rejected', 'cancelled'));

ALTER TABLE public.payment_submissions DROP CONSTRAINT IF EXISTS payment_submissions_status_check;
ALTER TABLE public.payment_submissions ADD CONSTRAINT payment_submissions_status_check
  CHECK (status IN ('pending_verification', 'under_review', 'approved', 'rejected', 'duplicate_flagged', 'cancelled'));

DROP INDEX IF EXISTS public.manual_payment_requests_active_ebook_idx;
CREATE UNIQUE INDEX manual_payment_requests_active_ebook_idx
  ON public.manual_payment_requests (user_id, ebook_id)
  WHERE ebook_id IS NOT NULL AND status IN ('pending_payment', 'pending_verification', 'under_review', 'approved');

DROP INDEX IF EXISTS public.manual_payment_requests_active_test_idx;
CREATE UNIQUE INDEX manual_payment_requests_active_test_idx
  ON public.manual_payment_requests (user_id, mock_test_id)
  WHERE mock_test_id IS NOT NULL AND status IN ('pending_payment', 'pending_verification', 'under_review', 'approved');

CREATE TABLE IF NOT EXISTS public.refund_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.ebook_transactions(id) ON DELETE RESTRICT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  refund_reference TEXT NOT NULL,
  refund_date TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('pending', 'confirmed', 'rejected')),
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, refund_reference)
);

CREATE INDEX IF NOT EXISTS refund_events_order_idx
  ON public.refund_events(order_id, created_at DESC);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ebook-pdfs', 'ebook-pdfs', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf'];

ALTER TABLE public.product_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_files_owner_read ON public.product_files;
CREATE POLICY product_files_owner_read ON public.product_files
  FOR SELECT USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_library l
      WHERE l.product_id = product_files.product_id
        AND l.user_id = auth.uid()
        AND l.access_status = 'active'
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS user_library_owner_read ON public.user_library;
CREATE POLICY user_library_owner_read ON public.user_library
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS payment_verification_logs_admin_read ON public.payment_verification_logs;
CREATE POLICY payment_verification_logs_admin_read ON public.payment_verification_logs
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS download_logs_owner_read ON public.download_logs;
CREATE POLICY download_logs_owner_read ON public.download_logs
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS refund_events_admin_read ON public.refund_events;
CREATE POLICY refund_events_admin_read ON public.refund_events
  FOR SELECT USING (public.is_admin());

REVOKE ALL ON public.product_files, public.user_library, public.payment_verification_logs,
  public.download_logs, public.refund_events FROM anon, authenticated;
GRANT SELECT ON public.product_files, public.user_library, public.payment_verification_logs,
  public.download_logs, public.refund_events TO authenticated;
GRANT ALL ON public.product_files, public.user_library, public.payment_verification_logs,
  public.download_logs, public.refund_events TO service_role;

DROP POLICY IF EXISTS ebook_pdf_owner_upload ON storage.objects;
CREATE POLICY ebook_pdf_owner_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ebook-pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS ebook_pdf_owner_delete ON storage.objects;
CREATE POLICY ebook_pdf_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ebook-pdfs' AND owner_id = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.grant_ebook_library_entitlement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.provider = 'manual_upi' AND NEW.status = 'VERIFIED' AND NEW.buyer_user_id IS NOT NULL THEN
    INSERT INTO public.user_library (user_id, product_id, order_id)
    VALUES (NEW.buyer_user_id, NEW.ebook_id, NEW.id)
    ON CONFLICT (user_id, product_id) DO UPDATE
      SET access_status = 'active', revoked_at = NULL, revoked_reason = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ebook_transaction_library_entitlement ON public.ebook_transactions;
CREATE TRIGGER ebook_transaction_library_entitlement
  AFTER INSERT OR UPDATE OF status ON public.ebook_transactions
  FOR EACH ROW EXECUTE FUNCTION public.grant_ebook_library_entitlement();

INSERT INTO public.user_library (user_id, product_id, order_id)
SELECT buyer_user_id, ebook_id, id
FROM public.ebook_transactions
WHERE provider = 'manual_upi'
  AND status = 'VERIFIED'
  AND buyer_user_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.log_manual_payment_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.payment_verification_logs(request_id, admin_id, action, new_status)
    VALUES (NEW.id, NEW.reviewed_by, 'submitted', NEW.status);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.payment_verification_logs(request_id, admin_id, action, previous_status, new_status, reason)
    VALUES (
      NEW.id,
      NEW.reviewed_by,
      CASE
        WHEN NEW.status = 'approved' THEN 'approved'
        WHEN NEW.status = 'rejected' THEN 'rejected'
        ELSE 'under_review'
      END,
      OLD.status,
      NEW.status,
      NEW.reason
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS manual_payment_verification_audit ON public.manual_payment_requests;
CREATE TRIGGER manual_payment_verification_audit
  AFTER INSERT OR UPDATE OF status, reviewed_by, reason ON public.manual_payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_manual_payment_verification();

CREATE OR REPLACE FUNCTION public.revoke_ebook_library_on_refund()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.status = 'confirmed' AND NEW.amount_minor >= (
    SELECT round(gross_amount * 100)::BIGINT
    FROM public.ebook_transactions WHERE id = NEW.order_id
  ) THEN
    UPDATE public.user_library
    SET access_status = 'revoked', revoked_at = now(), revoked_reason = NEW.reason
    WHERE order_id = NEW.order_id AND access_status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refund_revokes_ebook_library ON public.refund_events;
CREATE TRIGGER refund_revokes_ebook_library
  AFTER INSERT OR UPDATE OF status ON public.refund_events
  FOR EACH ROW EXECUTE FUNCTION public.revoke_ebook_library_on_refund();

CREATE OR REPLACE FUNCTION public.resolve_manual_payment_submission(
  p_submission_id UUID,
  p_actor_id UUID,
  p_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_submission public.payment_submissions%ROWTYPE;
  v_plan_id UUID;
  v_duration_days INTEGER;
  v_starts_at TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
  v_subscription_id UUID;
BEGIN
  IF p_status NOT IN ('approved', 'rejected') OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Invalid payment resolution';
  END IF;
  SELECT * INTO v_submission FROM public.payment_submissions WHERE id = p_submission_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_submission.status = p_status THEN
    RETURN jsonb_build_object('status', v_submission.status, 'already_resolved', true);
  END IF;
  IF v_submission.status NOT IN ('pending_verification', 'under_review') THEN
    RAISE EXCEPTION 'Payment submission has already been reviewed';
  END IF;

  IF p_status = 'rejected' THEN
    UPDATE public.payment_submissions
      SET status = 'rejected', reason = p_reason, approved_by = p_actor_id, approved_at = now(), updated_at = now()
      WHERE id = v_submission.id;
    RETURN jsonb_build_object('status', 'rejected');
  END IF;

  IF v_submission.product_snapshot IS NULL OR v_submission.final_amount_minor <= 0 OR v_submission.currency <> 'INR' THEN
    RAISE EXCEPTION 'Payment submission is missing a valid purchase snapshot';
  END IF;
  SELECT subscription_plan_id INTO v_plan_id
  FROM public.product_catalog WHERE id = v_submission.product_id;
  IF v_plan_id IS NULL THEN RAISE EXCEPTION 'Subscription plan is not configured for this product'; END IF;

  IF (v_submission.product_snapshot->>'class_number')::INTEGER = 9 THEN
    v_duration_days := (v_submission.product_snapshot->>'duration_days')::INTEGER;
    IF v_duration_days <= 0 THEN RAISE EXCEPTION 'Class 9 subscription duration is invalid'; END IF;
    v_starts_at := now();
    v_expires_at := v_starts_at + make_interval(days => v_duration_days);
  ELSIF (v_submission.product_snapshot->>'class_number')::INTEGER = 10 THEN
    v_starts_at := (v_submission.product_snapshot->>'validity_starts_at')::TIMESTAMPTZ;
    v_expires_at := (v_submission.product_snapshot->>'validity_ends_at')::TIMESTAMPTZ;
    IF v_starts_at IS NULL OR v_expires_at IS NULL OR v_expires_at <= v_starts_at THEN
      RAISE EXCEPTION 'Class 10 season dates must be configured before approval';
    END IF;
    IF v_expires_at <= now() THEN RAISE EXCEPTION 'Class 10 season has already expired'; END IF;
    v_starts_at := greatest(v_starts_at, now());
  ELSE
    RAISE EXCEPTION 'Unsupported subscription class';
  END IF;

  INSERT INTO public.subscriptions (
    user_id, plan_id, status, starts_at, expires_at, auto_renew, source_payment_submission_id
  ) VALUES (
    v_submission.user_id, v_plan_id, 'active', v_starts_at, v_expires_at, false, v_submission.id
  ) RETURNING id INTO v_subscription_id;

  UPDATE public.payment_submissions
    SET status = 'approved', reason = p_reason, approved_by = p_actor_id,
        approved_at = now(), subscription_id = v_subscription_id, updated_at = now()
    WHERE id = v_submission.id;

  INSERT INTO public.admin_audit_logs (actor_id, action, entity_type, entity_id, new_state, reason)
  VALUES (
    p_actor_id, 'manual_payment_approved', 'payment_submission', v_submission.id,
    jsonb_build_object('subscription_id', v_subscription_id, 'amount_minor', v_submission.final_amount_minor),
    p_reason
  );

  RETURN jsonb_build_object('status', 'approved', 'subscription_id', v_subscription_id);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_manual_payment_submission(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_manual_payment_submission(UUID, UUID, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_manual_payment_request(
  p_request_id UUID,
  p_actor_id UUID,
  p_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_request public.manual_payment_requests%ROWTYPE;
  v_ebook public.ebook_listings%ROWTYPE;
  v_order_id UUID;
  v_now TIMESTAMPTZ := now();
  v_commission_percent NUMERIC;
  v_commission_amount NUMERIC;
  v_seller_amount NUMERIC;
BEGIN
  IF p_status NOT IN ('approved', 'rejected') OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Invalid payment resolution';
  END IF;

  SELECT * INTO v_request FROM public.manual_payment_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_request.status = p_status THEN
    SELECT id INTO v_order_id FROM public.ebook_transactions
      WHERE provider_metadata->>'manual_payment_request_id' = p_request_id::text LIMIT 1;
    RETURN jsonb_build_object('id', v_request.id, 'status', v_request.status, 'order_id', v_order_id, 'already_resolved', true);
  END IF;
  IF v_request.status NOT IN ('pending_verification', 'under_review') THEN
    RAISE EXCEPTION 'Manual payment request has already been reviewed';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(lower(btrim(v_request.reference_code)), 0));
  IF EXISTS (
    SELECT 1 FROM public.manual_payment_requests r
    WHERE r.id <> v_request.id
      AND r.status IN ('pending_verification', 'under_review', 'approved')
      AND lower(btrim(r.reference_code)) = lower(btrim(v_request.reference_code))
  ) OR EXISTS (
    SELECT 1 FROM public.payment_submissions s
    WHERE s.status IN ('pending_verification', 'approved')
      AND lower(btrim(s.reference_code)) = lower(btrim(v_request.reference_code))
  ) THEN
    RAISE EXCEPTION 'UPI transaction reference has already been submitted';
  END IF;

  IF p_status = 'rejected' THEN
    UPDATE public.manual_payment_requests
      SET status = 'rejected', reason = NULLIF(btrim(p_reason), ''),
          reviewed_by = p_actor_id, reviewed_at = v_now, updated_at = v_now
      WHERE id = v_request.id;
    RETURN jsonb_build_object('id', v_request.id, 'status', 'rejected');
  END IF;

  IF v_request.resource_type = 'mock_test' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.mock_tests
      WHERE id = v_request.mock_test_id
        AND is_active = true
        AND is_published = true
        AND is_premium = true
    ) THEN
      RAISE EXCEPTION 'Mock test is no longer available for purchase';
    END IF;
    INSERT INTO public.test_access_grants (user_id, mock_test_id, source)
      VALUES (v_request.user_id, v_request.mock_test_id, 'manual_upi')
      ON CONFLICT (user_id, mock_test_id) DO NOTHING;
    UPDATE public.manual_payment_requests
      SET status = 'approved', reason = NULLIF(btrim(p_reason), ''),
          reviewed_by = p_actor_id, reviewed_at = v_now, updated_at = v_now
      WHERE id = v_request.id;
    RETURN jsonb_build_object('id', v_request.id, 'status', 'approved', 'resource_type', 'mock_test');
  END IF;

  SELECT * INTO v_ebook FROM public.ebook_listings
    WHERE id = v_request.ebook_id AND status = 'PUBLISHED' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'eBook is no longer available for purchase'; END IF;

  v_commission_percent := COALESCE((v_request.metadata->>'commission_percent')::NUMERIC, 0);
  v_commission_amount := COALESCE((v_request.metadata->>'commission_amount')::NUMERIC, 0);
  v_seller_amount := COALESCE((v_request.metadata->>'seller_amount')::NUMERIC, 0);

  INSERT INTO public.ebook_transactions (
    order_number, ebook_id, buyer_user_id, seller_user_id, provider,
    provider_transaction_id, status, order_status, currency, gross_amount,
    commission_percent, commission_amount, seller_amount, payment_fee,
    tax_amount, seller_net_amount, seller_net_before_refunds, payout_status,
    provider_metadata, verified_at, paid_at
  ) VALUES (
    'XB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    v_request.ebook_id, v_request.user_id, v_ebook.user_id, 'manual_upi',
    v_request.reference_code, 'VERIFIED', 'FULFILLED', v_request.currency,
    v_request.amount_minor / 100.0, v_commission_percent, v_commission_amount,
    v_seller_amount, 0, 0, v_seller_amount, v_seller_amount, 'NOT_AVAILABLE',
    v_request.metadata || jsonb_build_object('manual_payment_request_id', v_request.id),
    v_now, v_now
  ) RETURNING id INTO v_order_id;

  UPDATE public.manual_payment_requests
    SET status = 'approved', reason = NULLIF(btrim(p_reason), ''),
        reviewed_by = p_actor_id, reviewed_at = v_now, updated_at = v_now
    WHERE id = v_request.id;

  RETURN jsonb_build_object('id', v_request.id, 'status', 'approved', 'order_id', v_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_manual_payment_request(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_manual_payment_request(UUID, UUID, TEXT, TEXT) TO service_role;

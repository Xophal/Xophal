CREATE TABLE IF NOT EXISTS public.manual_payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resource_type VARCHAR(16) NOT NULL CHECK (resource_type IN ('ebook', 'mock_test')),
  ebook_id UUID REFERENCES public.ebook_listings(id) ON DELETE RESTRICT,
  mock_test_id UUID REFERENCES public.mock_tests(id) ON DELETE RESTRICT,
  title_snapshot TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  reference_code VARCHAR(160),
  evidence_url TEXT,
  status VARCHAR(24) NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'pending_verification', 'approved', 'rejected')),
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT manual_payment_request_resource_check CHECK (
    (resource_type = 'ebook' AND ebook_id IS NOT NULL AND mock_test_id IS NULL)
    OR (resource_type = 'mock_test' AND mock_test_id IS NOT NULL AND ebook_id IS NULL)
  ),
  CONSTRAINT manual_payment_request_reference_check CHECK (
    (status = 'pending_payment' AND reference_code IS NULL)
    OR (status IN ('pending_verification', 'approved', 'rejected') AND reference_code IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS manual_payment_requests_active_ebook_idx
  ON public.manual_payment_requests (user_id, ebook_id)
  WHERE ebook_id IS NOT NULL AND status IN ('pending_payment', 'pending_verification', 'approved');
CREATE UNIQUE INDEX IF NOT EXISTS manual_payment_requests_active_test_idx
  ON public.manual_payment_requests (user_id, mock_test_id)
  WHERE mock_test_id IS NOT NULL AND status IN ('pending_payment', 'pending_verification', 'approved');
CREATE UNIQUE INDEX IF NOT EXISTS manual_payment_requests_reference_idx
  ON public.manual_payment_requests (lower(btrim(reference_code)))
  WHERE reference_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS manual_payment_requests_review_queue_idx
  ON public.manual_payment_requests (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS ebook_manual_upi_settlement_due_idx
  ON public.ebook_transactions (seller_user_id)
  WHERE provider = 'manual_upi' AND status = 'VERIFIED' AND payout_status = 'NOT_AVAILABLE';

CREATE OR REPLACE FUNCTION public.prevent_duplicate_manual_payment_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_reference TEXT;
  v_duplicate BOOLEAN;
BEGIN
  v_reference := NULLIF(lower(btrim(NEW.reference_code)), '');
  IF v_reference IS NULL OR NEW.status NOT IN ('pending_verification', 'approved') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_reference, 0));

  IF TG_TABLE_NAME = 'payment_submissions' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.manual_payment_requests AS request
      WHERE lower(btrim(request.reference_code)) = v_reference
        AND request.status IN ('pending_verification', 'approved')
    ) INTO v_duplicate;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.payment_submissions AS submission
      WHERE lower(btrim(submission.reference_code)) = v_reference
        AND submission.status IN ('pending_verification', 'approved')
    ) INTO v_duplicate;
  END IF;

  IF v_duplicate THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'UPI transaction reference has already been submitted';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_duplicate_manual_payment_reference()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS payment_submissions_unique_manual_reference ON public.payment_submissions;
CREATE TRIGGER payment_submissions_unique_manual_reference
  BEFORE INSERT OR UPDATE ON public.payment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_manual_payment_reference();

DROP TRIGGER IF EXISTS manual_payment_requests_unique_subscription_reference ON public.manual_payment_requests;
CREATE TRIGGER manual_payment_requests_unique_subscription_reference
  BEFORE INSERT OR UPDATE ON public.manual_payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_manual_payment_reference();

ALTER TABLE public.manual_payment_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.manual_payment_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.manual_payment_requests TO service_role;

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
  v_now TIMESTAMPTZ := NOW();
  v_commission_percent NUMERIC;
  v_commission_amount NUMERIC;
  v_seller_amount NUMERIC;
BEGIN
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid manual payment resolution status';
  END IF;

  SELECT * INTO v_request
  FROM public.manual_payment_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_request.status = p_status THEN
    RETURN jsonb_build_object('id', v_request.id, 'status', v_request.status);
  END IF;
  IF v_request.status <> 'pending_verification' THEN
    RAISE EXCEPTION 'Manual payment request has already been reviewed';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(lower(btrim(v_request.reference_code)), 0));
  IF EXISTS (
    SELECT 1
    FROM public.payment_submissions AS submission
    WHERE lower(btrim(submission.reference_code)) = lower(btrim(v_request.reference_code))
      AND submission.status IN ('pending_verification', 'approved')
  ) OR EXISTS (
    SELECT 1
    FROM public.manual_payment_requests AS request
    WHERE request.id <> v_request.id
      AND lower(btrim(request.reference_code)) = lower(btrim(v_request.reference_code))
      AND request.status IN ('pending_verification', 'approved')
  ) THEN
    RAISE EXCEPTION 'UPI transaction reference has already been submitted';
  END IF;

  IF p_status = 'rejected' THEN
    UPDATE public.manual_payment_requests
    SET status = 'rejected',
        reason = NULLIF(btrim(p_reason), ''),
        reviewed_by = p_actor_id,
        reviewed_at = v_now,
        updated_at = v_now
    WHERE id = v_request.id;
    RETURN jsonb_build_object('id', v_request.id, 'status', 'rejected');
  END IF;

  IF v_request.resource_type = 'mock_test' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.mock_tests
      WHERE id = v_request.mock_test_id
        AND is_active = TRUE
        AND is_published = TRUE
        AND is_premium = TRUE
    ) THEN
      RAISE EXCEPTION 'Mock test is no longer available for purchase';
    END IF;

    INSERT INTO public.test_access_grants (user_id, mock_test_id, source)
    VALUES (v_request.user_id, v_request.mock_test_id, 'manual_upi')
    ON CONFLICT (user_id, mock_test_id) DO NOTHING;
  ELSE
    SELECT * INTO v_ebook
    FROM public.ebook_listings
    WHERE id = v_request.ebook_id
      AND status = 'PUBLISHED'
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'eBook is no longer available for purchase';
    END IF;

    v_commission_percent := COALESCE((v_request.metadata->>'commission_percent')::NUMERIC, 0);
    v_commission_amount := COALESCE((v_request.metadata->>'commission_amount')::NUMERIC, 0);
    v_seller_amount := COALESCE((v_request.metadata->>'seller_amount')::NUMERIC, 0);

    INSERT INTO public.ebook_transactions (
      order_number,
      ebook_id,
      buyer_user_id,
      seller_user_id,
      provider,
      provider_transaction_id,
      status,
      order_status,
      currency,
      gross_amount,
      commission_percent,
      commission_amount,
      seller_amount,
      payment_fee,
      tax_amount,
      seller_net_amount,
      seller_net_before_refunds,
      payout_status,
      provider_metadata,
      verified_at,
      paid_at
    )
    VALUES (
      'XB-' || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 12)),
      v_request.ebook_id,
      v_request.user_id,
      v_ebook.user_id,
      'manual_upi',
      v_request.reference_code,
      'VERIFIED',
      'FULFILLED',
      v_request.currency,
      v_request.amount_minor / 100.0,
      v_commission_percent,
      v_commission_amount,
      v_seller_amount,
      0,
      0,
      v_seller_amount,
      v_seller_amount,
      'NOT_AVAILABLE',
      v_request.metadata || jsonb_build_object(
        'manual_payment_request_id', v_request.id,
        'manual_payment_reference', v_request.reference_code
      ),
      v_now,
      v_now
    )
    RETURNING id INTO v_order_id;

    INSERT INTO public.ebook_events (
      event_name,
      ebook_id,
      user_id,
      source,
      metadata
    )
    VALUES (
      'ebook_purchase_completed',
      v_request.ebook_id,
      v_request.user_id,
      'manual_upi_approval',
      jsonb_build_object('order_id', v_order_id, 'payment_request_id', v_request.id)
    );
  END IF;

  UPDATE public.manual_payment_requests
  SET status = 'approved',
      reason = NULLIF(btrim(p_reason), ''),
      reviewed_by = p_actor_id,
      reviewed_at = v_now,
      updated_at = v_now
  WHERE id = v_request.id;

  RETURN jsonb_build_object(
    'id', v_request.id,
    'status', 'approved',
    'resource_type', v_request.resource_type,
    'order_id', v_order_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_manual_payment_request(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_manual_payment_request(UUID, UUID, TEXT, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_manual_upi_seller_settlement_due(p_seller_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  seller_user_id UUID,
  transaction_count BIGINT,
  amount NUMERIC
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
  SELECT
    ledger.seller_user_id,
    COUNT(*)::BIGINT,
    COALESCE(SUM(ledger.seller_net_amount), 0)::NUMERIC
  FROM public.ebook_transactions AS ledger
  WHERE ledger.provider = 'manual_upi'
    AND ledger.status = 'VERIFIED'
    AND ledger.payout_status = 'NOT_AVAILABLE'
    AND ledger.seller_net_amount > 0
    AND (p_seller_user_id IS NULL OR ledger.seller_user_id = p_seller_user_id)
  GROUP BY ledger.seller_user_id;
$$;

REVOKE ALL ON FUNCTION public.get_manual_upi_seller_settlement_due(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_manual_upi_seller_settlement_due(UUID)
  TO service_role;

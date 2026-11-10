-- Tie paid subscriptions to their originating provider payment so fulfillment
-- and refunds can be applied atomically and replayed safely.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS source_payment_id UUID UNIQUE
    REFERENCES public.payments(id) ON DELETE SET NULL;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS razorpay_refund_id VARCHAR(100);

WITH candidates AS (
  SELECT
    p.id AS payment_id,
    s.id AS subscription_id,
    ROW_NUMBER() OVER (
      PARTITION BY p.id
      ORDER BY ABS(EXTRACT(EPOCH FROM (s.created_at - p.created_at)))
    ) AS payment_match,
    ROW_NUMBER() OVER (
      PARTITION BY s.id
      ORDER BY ABS(EXTRACT(EPOCH FROM (s.created_at - p.created_at)))
    ) AS subscription_match
  FROM public.payments p
  JOIN public.subscriptions s
    ON s.user_id = p.user_id
   AND s.plan_id = p.plan_id
   AND s.created_at >= p.created_at
   AND s.created_at <= p.created_at + INTERVAL '1 day'
  WHERE p.plan_id IS NOT NULL
    AND p.razorpay_payment_id IS NOT NULL
    AND p.status IN ('paid', 'completed')
    AND s.source_payment_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.subscriptions linked
      WHERE linked.source_payment_id = p.id
    )
),
unambiguous_matches AS (
  SELECT payment_id, subscription_id
  FROM candidates
  WHERE payment_match = 1 AND subscription_match = 1
)
UPDATE public.subscriptions s
SET source_payment_id = m.payment_id
FROM unambiguous_matches m
WHERE s.id = m.subscription_id;

CREATE UNIQUE INDEX IF NOT EXISTS payments_razorpay_refund_id_unique
  ON public.payments (razorpay_refund_id)
  WHERE razorpay_refund_id IS NOT NULL;

ALTER TABLE public.payment_submissions
  DROP CONSTRAINT IF EXISTS payment_submissions_status_check;

ALTER TABLE public.payment_submissions
  ADD CONSTRAINT payment_submissions_status_check
  CHECK (status IN ('pending_verification', 'approved', 'rejected', 'duplicate_flagged', 'cancelled', 'refunded'));

CREATE OR REPLACE FUNCTION public.finalize_razorpay_payment(
  p_order_id TEXT,
  p_payment_id TEXT,
  p_amount_minor INTEGER,
  p_currency TEXT,
  p_event TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_plan public.subscription_plans%ROWTYPE;
  v_subscription_id UUID;
  v_test_id UUID;
BEGIN
  IF p_event IS NULL OR p_event NOT IN ('payment.captured', 'payment.failed')
    OR NULLIF(btrim(p_order_id), '') IS NULL
    OR NULLIF(btrim(p_payment_id), '') IS NULL
  THEN
    RAISE EXCEPTION 'Invalid Razorpay payment event';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE razorpay_order_id = p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment order not found';
  END IF;

  IF p_event = 'payment.failed' THEN
    IF v_payment.status IN ('pending', 'created') THEN
      UPDATE public.payments
      SET status = 'failed',
          updated_at = NOW()
      WHERE id = v_payment.id;
      RETURN jsonb_build_object('status', 'failed');
    END IF;
    RETURN jsonb_build_object('status', v_payment.status, 'duplicate', true);
  END IF;

  IF v_payment.razorpay_payment_id IS NOT NULL
    AND v_payment.razorpay_payment_id <> p_payment_id
  THEN
    RAISE EXCEPTION 'Payment order is already linked to a different provider payment';
  END IF;
  IF v_payment.status IN ('refunded', 'refund_pending') THEN
    RETURN jsonb_build_object('status', v_payment.status, 'duplicate', true);
  END IF;
  IF p_amount_minor IS NULL
    OR p_amount_minor <> ROUND(v_payment.final_amount * 100)::INTEGER
    OR p_currency IS NULL
    OR upper(p_currency) <> upper(COALESCE(v_payment.currency, 'INR'))
  THEN
    RAISE EXCEPTION 'Provider payment amount or currency does not match the order';
  END IF;

  IF v_payment.plan_id IS NOT NULL THEN
    SELECT * INTO v_plan
    FROM public.subscription_plans
    WHERE id = v_payment.plan_id;
    IF NOT FOUND OR v_plan.duration_days IS NULL OR v_plan.duration_days <= 0 THEN
      RAISE EXCEPTION 'Subscription plan is not configured';
    END IF;
  ELSIF COALESCE(v_payment.metadata->>'test_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_test_id := (v_payment.metadata->>'test_id')::UUID;
  ELSE
    RAISE EXCEPTION 'Payment is not linked to a supported product';
  END IF;

  UPDATE public.payments
  SET razorpay_payment_id = p_payment_id,
      status = 'paid',
      updated_at = NOW()
  WHERE id = v_payment.id;

  IF v_payment.plan_id IS NOT NULL THEN
    INSERT INTO public.subscriptions (
      user_id, plan_id, status, starts_at, expires_at, auto_renew, source_payment_id
    )
    VALUES (
      v_payment.user_id,
      v_payment.plan_id,
      'active',
      NOW(),
      NOW() + make_interval(days => v_plan.duration_days),
      false,
      v_payment.id
    )
    ON CONFLICT (source_payment_id) DO NOTHING;

    SELECT id INTO v_subscription_id
    FROM public.subscriptions
    WHERE source_payment_id = v_payment.id;
  ELSE
    INSERT INTO public.test_access_grants (user_id, mock_test_id, source)
    VALUES (v_payment.user_id, v_test_id, 'razorpay')
    ON CONFLICT (user_id, mock_test_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'status', 'paid',
    'duplicate', v_payment.status IN ('paid', 'completed'),
    'subscription_id', v_subscription_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.begin_razorpay_payment_refund(p_payment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
BEGIN
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF v_payment.status = 'refunded' THEN
    RETURN jsonb_build_object('status', 'refunded', 'refund_id', v_payment.razorpay_refund_id);
  END IF;
  IF v_payment.status = 'refund_pending' THEN
    RETURN jsonb_build_object('status', 'refund_pending', 'refund_id', v_payment.razorpay_refund_id);
  END IF;
  IF v_payment.status NOT IN ('paid', 'completed') OR v_payment.razorpay_payment_id IS NULL THEN
    RAISE EXCEPTION 'Only a captured provider payment can be refunded';
  END IF;

  UPDATE public.payments
  SET status = 'refund_pending', updated_at = NOW()
  WHERE id = v_payment.id;
  RETURN jsonb_build_object('status', 'started');
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_razorpay_payment_refund(
  p_payment_id UUID,
  p_refund_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
BEGIN
  IF p_refund_id IS NULL OR btrim(p_refund_id) = '' THEN
    RAISE EXCEPTION 'Provider refund ID is required';
  END IF;
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF v_payment.status = 'refunded' THEN
    RETURN jsonb_build_object('status', 'refunded', 'refund_id', v_payment.razorpay_refund_id);
  END IF;
  IF v_payment.status NOT IN ('paid', 'completed', 'refund_pending') THEN
    RAISE EXCEPTION 'Payment cannot enter refund processing';
  END IF;
  IF v_payment.razorpay_refund_id IS NOT NULL AND v_payment.razorpay_refund_id <> p_refund_id THEN
    RAISE EXCEPTION 'Payment is already linked to a different refund';
  END IF;

  UPDATE public.payments
  SET status = 'refund_pending',
      razorpay_refund_id = p_refund_id,
      updated_at = NOW()
  WHERE id = v_payment.id;
  RETURN jsonb_build_object('status', 'refund_pending', 'refund_id', p_refund_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_razorpay_payment_refund(
  p_payment_id UUID,
  p_refund_id TEXT,
  p_amount_minor INTEGER,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_test_id UUID;
BEGIN
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF v_payment.status = 'refunded' THEN
    RETURN jsonb_build_object('status', 'refunded', 'duplicate', true);
  END IF;
  IF v_payment.status NOT IN ('paid', 'completed', 'refund_pending')
    OR p_refund_id IS NULL
    OR p_amount_minor IS NULL
    OR p_amount_minor <> ROUND(v_payment.final_amount * 100)::INTEGER
  THEN
    RAISE EXCEPTION 'A confirmed full refund is required';
  END IF;
  IF v_payment.razorpay_refund_id IS NOT NULL AND v_payment.razorpay_refund_id <> p_refund_id THEN
    RAISE EXCEPTION 'Refund ID does not match the payment refund in progress';
  END IF;

  UPDATE public.payments
  SET status = 'refunded',
      razorpay_refund_id = p_refund_id,
      updated_at = NOW()
  WHERE id = v_payment.id;

  UPDATE public.subscriptions
  SET status = 'cancelled', updated_at = NOW()
  WHERE source_payment_id = v_payment.id
    AND status = 'active';

  IF COALESCE(v_payment.metadata->>'test_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_test_id := (v_payment.metadata->>'test_id')::UUID;
    DELETE FROM public.test_access_grants
    WHERE user_id = v_payment.user_id AND mock_test_id = v_test_id;
  END IF;

  INSERT INTO public.admin_audit_logs (
    actor_id, action, entity_type, entity_id, new_state, reason
  )
  VALUES (
    p_actor_id,
    'razorpay_payment_refunded',
    'payment',
    v_payment.id,
    jsonb_build_object('refund_id', p_refund_id, 'amount_minor', p_amount_minor),
    'Provider confirmed a full refund'
  );

  RETURN jsonb_build_object('status', 'refunded', 'refund_id', p_refund_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_razorpay_payment_refund(
  p_payment_id UUID,
  p_refund_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
BEGIN
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF v_payment.status = 'refund_pending'
    AND (v_payment.razorpay_refund_id IS NULL OR v_payment.razorpay_refund_id = p_refund_id)
  THEN
    UPDATE public.payments
    SET status = 'paid', razorpay_refund_id = NULL, updated_at = NOW()
    WHERE id = v_payment.id;
  END IF;
  RETURN jsonb_build_object('status', v_payment.status);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_manual_payment_submission_refund(
  p_submission_id UUID,
  p_actor_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_submission public.payment_submissions%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Reviewer identity is required';
  END IF;

  SELECT * INTO v_submission
  FROM public.payment_submissions
  WHERE id = p_submission_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment submission not found';
  END IF;
  IF v_submission.status = 'refunded' THEN
    RETURN jsonb_build_object('status', 'refunded', 'duplicate', true);
  END IF;
  IF v_submission.status <> 'approved' OR v_submission.subscription_id IS NULL THEN
    RAISE EXCEPTION 'Only an approved subscription payment can be refunded';
  END IF;

  UPDATE public.payment_submissions
  SET status = 'refunded',
      reason = COALESCE(p_reason, reason),
      approved_by = p_actor_id,
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = v_submission.id;

  UPDATE public.subscriptions
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = v_submission.subscription_id
    AND status = 'active';

  INSERT INTO public.admin_audit_logs (
    actor_id, action, entity_type, entity_id, previous_state, new_state, reason
  )
  VALUES (
    p_actor_id,
    'manual_payment_refunded',
    'payment_submission',
    v_submission.id,
    jsonb_build_object('status', 'approved', 'subscription_id', v_submission.subscription_id),
    jsonb_build_object('status', 'refunded'),
    p_reason
  );

  RETURN jsonb_build_object('status', 'refunded', 'subscription_id', v_submission.subscription_id);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_razorpay_payment(TEXT, TEXT, INTEGER, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_razorpay_payment_refund(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attach_razorpay_payment_refund(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_razorpay_payment_refund(UUID, TEXT, INTEGER, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_razorpay_payment_refund(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_manual_payment_submission_refund(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.finalize_razorpay_payment(TEXT, TEXT, INTEGER, TEXT, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_razorpay_payment_refund(UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.attach_razorpay_payment_refund(UUID, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_razorpay_payment_refund(UUID, TEXT, INTEGER, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_razorpay_payment_refund(UUID, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_manual_payment_submission_refund(UUID, UUID, TEXT)
  TO service_role;

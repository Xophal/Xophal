-- Serialize marketplace checkout creation and account for processed refunds.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS fulfilled_subscription_id UUID UNIQUE
    REFERENCES public.subscriptions(id) ON DELETE SET NULL;

ALTER TABLE public.ebook_transactions
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(10,2) NOT NULL DEFAULT 0
    CHECK (refunded_amount >= 0),
  ADD COLUMN IF NOT EXISTS seller_net_before_refunds NUMERIC(10,2)
    CHECK (seller_net_before_refunds IS NULL OR seller_net_before_refunds >= 0);

UPDATE public.ebook_transactions
SET seller_net_before_refunds = seller_net_amount
WHERE seller_net_before_refunds IS NULL
  AND seller_net_amount IS NOT NULL;

ALTER TABLE public.ebook_transactions
  DROP CONSTRAINT IF EXISTS ebook_transactions_refund_status_check;
ALTER TABLE public.ebook_transactions
  ADD CONSTRAINT ebook_transactions_refund_status_check
  CHECK (refund_status IN ('NONE', 'REQUESTED', 'PARTIAL', 'REFUNDED', 'DISPUTED'));

CREATE TABLE IF NOT EXISTS public.ebook_refund_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.ebook_transactions(id) ON DELETE RESTRICT,
  provider VARCHAR(40) NOT NULL,
  provider_refund_id VARCHAR(160) NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_refund_id)
);

ALTER TABLE public.ebook_refund_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ebook_refund_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ebook_refund_events TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_ebook_checkout(
  p_order_number TEXT,
  p_ebook_id UUID,
  p_buyer_user_id UUID,
  p_seller_user_id UUID,
  p_provider TEXT,
  p_provider_order_id TEXT,
  p_currency TEXT,
  p_gross_amount NUMERIC,
  p_commission_percent NUMERIC,
  p_commission_amount NUMERIC,
  p_seller_amount NUMERIC,
  p_provider_metadata JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_order public.ebook_transactions%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_buyer_user_id::TEXT || ':' || p_ebook_id::TEXT, 0));

  IF EXISTS (
    SELECT 1
    FROM public.ebook_transactions
    WHERE buyer_user_id = p_buyer_user_id
      AND ebook_id = p_ebook_id
      AND status = 'VERIFIED'
  ) THEN
    RETURN jsonb_build_object('outcome', 'already_purchased');
  END IF;

  SELECT * INTO v_order
  FROM public.ebook_transactions
  WHERE buyer_user_id = p_buyer_user_id
    AND ebook_id = p_ebook_id
    AND status = 'PENDING'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object('outcome', 'pending', 'order', to_jsonb(v_order));
  END IF;

  INSERT INTO public.ebook_transactions (
    order_number,
    ebook_id,
    buyer_user_id,
    seller_user_id,
    provider,
    provider_order_id,
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
    payout_status,
    provider_metadata
  )
  VALUES (
    p_order_number,
    p_ebook_id,
    p_buyer_user_id,
    p_seller_user_id,
    p_provider,
    p_provider_order_id,
    'PENDING',
    'CREATED',
    upper(p_currency),
    p_gross_amount,
    p_commission_percent,
    p_commission_amount,
    p_seller_amount,
    NULL,
    NULL,
    NULL,
    'NOT_AVAILABLE',
    COALESCE(p_provider_metadata, '{}'::JSONB)
  )
  RETURNING * INTO v_order;

  RETURN jsonb_build_object('outcome', 'created', 'order', to_jsonb(v_order));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth, pg_temp;

REVOKE ALL ON FUNCTION public.reserve_ebook_checkout(
  TEXT, UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ebook_checkout(
  TEXT, UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB
) TO service_role;

CREATE OR REPLACE FUNCTION public.fulfill_subscription_payment(
  p_order_id TEXT,
  p_payment_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_plan public.subscription_plans%ROWTYPE;
  v_starts_at TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
  v_subscription_id UUID;
BEGIN
  IF p_order_id IS NULL OR p_payment_id IS NULL THEN
    RAISE EXCEPTION 'Payment identifiers are required';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE razorpay_order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment order not found';
  END IF;

  IF v_payment.status = 'paid' THEN
    IF v_payment.razorpay_payment_id = p_payment_id
      AND v_payment.fulfilled_subscription_id IS NOT NULL
    THEN
      RETURN jsonb_build_object('already_fulfilled', true);
    END IF;
    RAISE EXCEPTION 'Payment order was already fulfilled';
  END IF;

  IF v_payment.status = 'completed' AND v_payment.razorpay_payment_id = p_payment_id THEN
    SELECT id INTO v_subscription_id
    FROM public.subscriptions
    WHERE user_id = v_payment.user_id
      AND plan_id = v_payment.plan_id
      AND (
        created_at BETWEEN v_payment.updated_at - INTERVAL '1 minute'
          AND v_payment.updated_at + INTERVAL '1 minute'
        OR (
          created_at <= v_payment.updated_at
          AND status = 'active'
          AND expires_at > v_payment.updated_at
        )
      )
    ORDER BY abs(extract(epoch FROM (created_at - v_payment.updated_at)))
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.payments
      SET status = 'paid',
          fulfilled_subscription_id = v_subscription_id,
          updated_at = NOW()
      WHERE id = v_payment.id;
      RETURN jsonb_build_object('already_fulfilled', true, 'subscription_id', v_subscription_id);
    END IF;
  END IF;

  IF v_payment.status NOT IN ('pending', 'completed') OR v_payment.plan_id IS NULL THEN
    RAISE EXCEPTION 'Payment order cannot be fulfilled';
  END IF;

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE id = v_payment.plan_id;

  IF NOT FOUND
    OR v_payment.final_amount <> v_plan.price
    OR upper(v_payment.currency) <> upper(v_plan.currency)
    OR v_plan.duration_days <= 0
  THEN
    RAISE EXCEPTION 'Payment does not match its subscription plan';
  END IF;

  IF v_plan.code = 'premium_beta'
    AND (v_plan.price <> 49 OR upper(v_plan.currency) <> 'INR' OR v_plan.duration_days <> 30)
  THEN
    RAISE EXCEPTION 'Premium Beta plan configuration is invalid';
  END IF;

  v_starts_at := GREATEST(
    NOW(),
    COALESCE((
      SELECT MAX(expires_at)
      FROM public.subscriptions
      WHERE user_id = v_payment.user_id
        AND status = 'active'
        AND expires_at > NOW()
    ), NOW())
  );
  v_expires_at := v_starts_at + make_interval(days => v_plan.duration_days);

  INSERT INTO public.subscriptions (
    user_id, plan_id, status, starts_at, expires_at, auto_renew
  )
  VALUES (
    v_payment.user_id, v_payment.plan_id, 'active', v_starts_at, v_expires_at, false
  )
  RETURNING id INTO v_subscription_id;

  UPDATE public.payments
  SET razorpay_payment_id = p_payment_id,
      status = 'paid',
      fulfilled_subscription_id = v_subscription_id,
      updated_at = NOW()
  WHERE id = v_payment.id;

  RETURN jsonb_build_object(
    'already_fulfilled', false,
    'subscription_id', v_subscription_id,
    'starts_at', v_starts_at,
    'expires_at', v_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_subscription_payment(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_subscription_payment(TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.record_ebook_refund(
  p_transaction_id UUID,
  p_provider_refund_id TEXT,
  p_amount_minor BIGINT
)
RETURNS JSONB AS $$
DECLARE
  v_order public.ebook_transactions%ROWTYPE;
  v_existing_event public.ebook_refund_events%ROWTYPE;
  v_refund_total_minor BIGINT;
  v_gross_amount_minor BIGINT;
  v_inserted INTEGER;
  v_fully_refunded BOOLEAN;
  v_base_seller_net NUMERIC(10,2);
BEGIN
  IF p_provider_refund_id IS NULL OR length(p_provider_refund_id) = 0
    OR p_amount_minor IS NULL OR p_amount_minor <= 0
  THEN
    RAISE EXCEPTION 'A provider refund id and positive amount are required';
  END IF;

  SELECT * INTO v_order
  FROM public.ebook_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.provider <> 'razorpay' THEN
    RAISE EXCEPTION 'Razorpay transaction not found';
  END IF;

  IF v_order.status = 'REFUNDED' THEN
    RETURN jsonb_build_object(
      'refund_total_minor', round(v_order.refunded_amount * 100)::BIGINT,
      'gross_amount_minor', round(v_order.gross_amount * 100)::BIGINT,
      'fully_refunded', true,
      'already_recorded', true
    );
  END IF;

  IF v_order.status <> 'VERIFIED' THEN
    RAISE EXCEPTION 'Only verified payments can be refunded';
  END IF;

  INSERT INTO public.ebook_refund_events (transaction_id, provider, provider_refund_id, amount_minor)
  VALUES (p_transaction_id, 'razorpay', p_provider_refund_id, p_amount_minor)
  ON CONFLICT (provider, provider_refund_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT * INTO v_existing_event
    FROM public.ebook_refund_events
    WHERE provider = 'razorpay'
      AND provider_refund_id = p_provider_refund_id;
    IF v_existing_event.transaction_id <> p_transaction_id
      OR v_existing_event.amount_minor <> p_amount_minor
    THEN
      RAISE EXCEPTION 'Provider refund id was reused with different payment details';
    END IF;
  END IF;

  SELECT COALESCE(sum(amount_minor), 0)::BIGINT
  INTO v_refund_total_minor
  FROM public.ebook_refund_events
  WHERE transaction_id = p_transaction_id
    AND provider = 'razorpay';

  v_gross_amount_minor := round(v_order.gross_amount * 100)::BIGINT;
  IF v_refund_total_minor > v_gross_amount_minor THEN
    RAISE EXCEPTION 'Processed refunds exceed the original payment amount';
  END IF;
  v_fully_refunded := v_refund_total_minor = v_gross_amount_minor;
  v_base_seller_net := COALESCE(v_order.seller_net_before_refunds, v_order.seller_net_amount);

  UPDATE public.ebook_transactions
  SET refunded_amount = round(v_refund_total_minor::NUMERIC / 100, 2),
      seller_net_before_refunds = COALESCE(seller_net_before_refunds, seller_net_amount),
      seller_net_amount = CASE
        WHEN v_base_seller_net IS NULL OR v_gross_amount_minor = 0 THEN seller_net_amount
        ELSE greatest(
          0,
          round(v_base_seller_net * (v_gross_amount_minor - v_refund_total_minor)::NUMERIC / v_gross_amount_minor, 2)
        )
      END,
      status = CASE WHEN v_fully_refunded THEN 'REFUNDED' ELSE status END,
      order_status = CASE WHEN v_fully_refunded THEN 'REFUNDED' ELSE order_status END,
      refund_status = CASE WHEN v_fully_refunded THEN 'REFUNDED' ELSE 'PARTIAL' END,
      payout_status = CASE
        WHEN v_fully_refunded AND payout_status IN ('NOT_AVAILABLE', 'PENDING', 'AVAILABLE') THEN 'FAILED'
        ELSE payout_status
      END,
      refunded_at = CASE WHEN v_fully_refunded THEN NOW() ELSE refunded_at END,
      updated_at = NOW()
  WHERE id = p_transaction_id;

  RETURN jsonb_build_object(
    'refund_total_minor', v_refund_total_minor,
    'gross_amount_minor', v_gross_amount_minor,
    'fully_refunded', v_fully_refunded,
    'already_recorded', v_inserted = 0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth, pg_temp;

REVOKE ALL ON FUNCTION public.record_ebook_refund(UUID, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ebook_refund(UUID, TEXT, BIGINT) TO service_role;

CREATE OR REPLACE FUNCTION public.record_ebook_payment_costs(
  p_transaction_id UUID,
  p_payment_fee NUMERIC,
  p_tax_amount NUMERIC
)
RETURNS VOID AS $$
BEGIN
  IF p_payment_fee IS NULL OR p_tax_amount IS NULL OR p_payment_fee < 0 OR p_tax_amount < 0 THEN
    RAISE EXCEPTION 'Provider fees and tax must be non-negative';
  END IF;

  UPDATE public.ebook_transactions
  SET payment_fee = round(p_payment_fee, 2),
      tax_amount = round(p_tax_amount, 2),
      seller_net_before_refunds = greatest(0, round(seller_amount - p_payment_fee - p_tax_amount, 2)),
      seller_net_amount = CASE
        WHEN gross_amount <= 0 THEN 0
        ELSE greatest(
          0,
          round(
            greatest(0, round(seller_amount - p_payment_fee - p_tax_amount, 2))
            * greatest(0, gross_amount - refunded_amount) / gross_amount,
            2
          )
        )
      END,
      updated_at = NOW()
  WHERE id = p_transaction_id
    AND status = 'VERIFIED'
    AND provider = 'razorpay';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION public.record_ebook_payment_costs(UUID, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ebook_payment_costs(UUID, NUMERIC, NUMERIC) TO service_role;

CREATE OR REPLACE FUNCTION public.get_ebook_earnings_summary(p_user_id UUID)
RETURNS TABLE (
  sales_count BIGINT,
  gross_sales NUMERIC,
  commission_total NUMERIC,
  seller_gross NUMERIC,
  payment_fees NUMERIC,
  tax_total NUMERIC,
  refunds_total NUMERIC,
  seller_net_total NUMERIC,
  pending_amount NUMERIC,
  available_amount NUMERIC,
  paid_amount NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE ledger.status = 'VERIFIED')::BIGINT,
    COALESCE(SUM(ledger.gross_amount) FILTER (WHERE ledger.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(SUM(
      ledger.commission_amount
      * greatest(0, ledger.gross_amount - ledger.refunded_amount)
      / NULLIF(ledger.gross_amount, 0)
    ) FILTER (WHERE ledger.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(SUM(
      ledger.seller_amount
      * greatest(0, ledger.gross_amount - ledger.refunded_amount)
      / NULLIF(ledger.gross_amount, 0)
    ) FILTER (WHERE ledger.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(SUM(ledger.payment_fee) FILTER (WHERE ledger.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(SUM(ledger.tax_amount) FILTER (WHERE ledger.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(SUM(
      CASE
        WHEN ledger.status = 'REFUNDED' AND ledger.refunded_amount = 0 THEN ledger.gross_amount
        ELSE ledger.refunded_amount
      END
    ) FILTER (WHERE ledger.status IN ('VERIFIED', 'REFUNDED')), 0)::NUMERIC,
    COALESCE(SUM(ledger.seller_net_amount) FILTER (WHERE ledger.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(SUM(ledger.seller_net_amount) FILTER (
      WHERE ledger.status = 'VERIFIED' AND ledger.payout_status = 'PENDING'
    ), 0)::NUMERIC,
    COALESCE(SUM(ledger.seller_net_amount) FILTER (
      WHERE ledger.status = 'VERIFIED' AND ledger.payout_status IN ('AVAILABLE', 'PROCESSING')
    ), 0)::NUMERIC,
    COALESCE((
      SELECT SUM(payout.amount)
      FROM public.ebook_payouts AS payout
      WHERE payout.seller_user_id = p_user_id
        AND payout.status = 'PAID'
    ), 0)::NUMERIC
  FROM public.ebook_transactions AS ledger
  WHERE ledger.seller_user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth, pg_temp;

REVOKE ALL ON FUNCTION public.get_ebook_earnings_summary(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ebook_earnings_summary(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.get_ebook_admin_revenue(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  transaction_count BIGINT,
  gross_sales NUMERIC,
  xophol_commission NUMERIC,
  seller_earnings NUMERIC,
  payment_fees NUMERIC,
  tax_total NUMERIC,
  refunds_total NUMERIC,
  net_marketplace_revenue NUMERIC,
  average_order_value NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE ledger.status = 'VERIFIED')::BIGINT,
    COALESCE(SUM(ledger.gross_amount) FILTER (WHERE ledger.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(SUM(
      ledger.commission_amount
      * greatest(0, ledger.gross_amount - ledger.refunded_amount)
      / NULLIF(ledger.gross_amount, 0)
    ) FILTER (WHERE ledger.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(SUM(
      ledger.seller_amount
      * greatest(0, ledger.gross_amount - ledger.refunded_amount)
      / NULLIF(ledger.gross_amount, 0)
    ) FILTER (WHERE ledger.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(SUM(ledger.payment_fee) FILTER (WHERE ledger.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(SUM(ledger.tax_amount) FILTER (WHERE ledger.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(SUM(
      CASE
        WHEN ledger.status = 'REFUNDED' AND ledger.refunded_amount = 0 THEN ledger.gross_amount
        ELSE ledger.refunded_amount
      END
    ) FILTER (WHERE ledger.status IN ('VERIFIED', 'REFUNDED')), 0)::NUMERIC,
    COALESCE(SUM(
      ledger.commission_amount
      * greatest(0, ledger.gross_amount - ledger.refunded_amount)
      / NULLIF(ledger.gross_amount, 0)
      - ledger.payment_fee
    ) FILTER (WHERE ledger.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(AVG(ledger.gross_amount) FILTER (WHERE ledger.status = 'VERIFIED'), 0)::NUMERIC
  FROM public.ebook_transactions AS ledger
  WHERE (p_from IS NULL OR ledger.created_at >= p_from)
    AND (p_to IS NULL OR ledger.created_at < p_to);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth, pg_temp;

REVOKE ALL ON FUNCTION public.get_ebook_admin_revenue(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ebook_admin_revenue(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

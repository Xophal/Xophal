-- Optional Premium Beta subscription. Keep the existing free plan and all
-- existing subscription, payment, and entitlement tables.
INSERT INTO public.subscription_plans (
  code, name, description, price, currency, duration_days, features, sort_order
)
VALUES (
  'premium_beta',
  'Premium Beta',
  'Early access pricing: 30 days of access to content marked Premium.',
  49,
  'INR',
  30,
  '["Premium-marked mock tests", "Premium-marked lessons and revision notes"]'::jsonb,
  2
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  currency = EXCLUDED.currency,
  duration_days = EXCLUDED.duration_days,
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

CREATE UNIQUE INDEX IF NOT EXISTS payments_razorpay_order_id_unique
  ON public.payments (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_razorpay_payment_id_unique
  ON public.payments (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.premium_beta_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name VARCHAR(40) NOT NULL
    CHECK (event_name IN ('pricing_viewed', 'premium_cta_clicked', 'checkout_opened', 'payment_initiated', 'payment_successful')),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS premium_beta_events_name_created_idx
  ON public.premium_beta_events (event_name, created_at DESC);

ALTER TABLE public.premium_beta_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.premium_beta_events FROM anon, authenticated;

-- A payment becomes paid and grants its subscription in one transaction.
-- Replaying the same provider payment is safe; a second payment cannot reuse it.
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
    IF v_payment.razorpay_payment_id = p_payment_id THEN
      RETURN jsonb_build_object('already_fulfilled', true);
    END IF;
    RAISE EXCEPTION 'Payment order was already fulfilled';
  END IF;

  IF v_payment.status <> 'pending' OR v_payment.plan_id IS NULL THEN
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

  UPDATE public.payments
  SET razorpay_payment_id = p_payment_id,
      status = 'paid',
      updated_at = NOW()
  WHERE id = v_payment.id;

  INSERT INTO public.subscriptions (
    user_id, plan_id, status, starts_at, expires_at, auto_renew
  )
  VALUES (
    v_payment.user_id, v_payment.plan_id, 'active', v_starts_at, v_expires_at, false
  )
  RETURNING id INTO v_subscription_id;

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

-- Do not grant access for a paid period that has been scheduled to start later.
CREATE OR REPLACE FUNCTION public.is_premium_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = auth.uid()
      AND s.status = 'active'
      AND s.starts_at <= NOW()
      AND s.expires_at > NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth, pg_temp;

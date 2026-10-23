-- Manual UPI subscription sales for the initial release. Payment approval is
-- an explicit staff action; evidence submitted by a student never grants access.

ALTER TABLE public.product_catalog
  DROP CONSTRAINT IF EXISTS product_catalog_product_type_check;

ALTER TABLE public.product_catalog
  ADD CONSTRAINT product_catalog_product_type_check
  CHECK (product_type IN ('free', 'class_9_monthly', 'class_10_season_pass', 'premium', 'pro'));

ALTER TABLE public.product_catalog
  ADD COLUMN IF NOT EXISTS early_bird_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS early_bird_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_plan_id UUID REFERENCES public.subscription_plans(id);

ALTER TABLE public.school_records
  ADD COLUMN IF NOT EXISTS class_10_total_students INTEGER NOT NULL DEFAULT 0
    CHECK (class_10_total_students >= 0),
  ADD COLUMN IF NOT EXISTS class_10_covered_students INTEGER NOT NULL DEFAULT 0
    CHECK (class_10_covered_students >= 0);

ALTER TABLE public.payment_submissions
  ADD COLUMN IF NOT EXISTS product_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS price_rule VARCHAR(24)
    CHECK (price_rule IS NULL OR price_rule IN ('regular', 'early_bird', 'school_pricing')),
  ADD COLUMN IF NOT EXISTS subscription_id UUID UNIQUE REFERENCES public.subscriptions(id);

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS source_payment_submission_id UUID UNIQUE
    REFERENCES public.payment_submissions(id);

CREATE UNIQUE INDEX IF NOT EXISTS payment_submissions_unique_active_reference
  ON public.payment_submissions (lower(btrim(reference_code)))
  WHERE reference_code IS NOT NULL
    AND status IN ('pending_verification', 'approved');

CREATE TABLE IF NOT EXISTS public.manual_payment_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  upi_id VARCHAR(255),
  payee_name VARCHAR(200),
  instructions TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT manual_payment_settings_vpa_format
    CHECK (upi_id IS NULL OR upi_id ~ '^[A-Za-z0-9._-]{2,256}@[A-Za-z0-9.-]{2,64}$')
);

ALTER TABLE public.manual_payment_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.manual_payment_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.manual_payment_settings TO anon, authenticated;
GRANT ALL ON TABLE public.manual_payment_settings TO service_role;

CREATE POLICY manual_payment_settings_public_read
  ON public.manual_payment_settings
  FOR SELECT
  USING (is_enabled = true);

-- Seed four distinct class/tier products. Class 10 access dates remain NULL
-- until an authorized administrator configures the HSLC 2027 season.
INSERT INTO public.subscription_plans (code, name, description, price, currency, duration_days, features, is_active, sort_order)
VALUES
  ('seba_class_9_premium', 'Class 9 Premium', 'Class 9 premium access for 30 days.', 49, 'INR', 30, '[]'::jsonb, true, 10),
  ('seba_class_9_pro', 'Class 9 Pro', 'Class 9 Pro access for 30 days.', 99, 'INR', 30, '[]'::jsonb, true, 20),
  ('seba_class_10_premium', 'HSLC 2027 Premium', 'Class 10 HSLC 2027 Premium season pass.', 199, 'INR', 365, '[]'::jsonb, true, 30),
  ('seba_class_10_pro', 'HSLC 2027 Pro', 'Class 10 HSLC 2027 Pro season pass.', 299, 'INR', 365, '[]'::jsonb, true, 40)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  currency = EXCLUDED.currency,
  duration_days = EXCLUDED.duration_days,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

INSERT INTO public.product_catalog (
  code, product_type, board_code, class_number, name, description,
  price_paise, early_bird_price_paise, school_price_paise, duration_days,
  validity_starts_at, validity_ends_at, early_bird_starts_at, early_bird_ends_at,
  is_active, is_public, metadata
)
VALUES
  ('seba_class_9_premium', 'premium', 'seba', 9, 'Class 9 Premium', '30 days of Class 9 premium access.', 4900, NULL, NULL, 30, NULL, NULL, NULL, NULL, true, true, '{"tier":"premium","payment_provider":"manual_upi"}'::jsonb),
  ('seba_class_9_pro', 'pro', 'seba', 9, 'Class 9 Pro', '30 days of Class 9 Pro access.', 9900, NULL, NULL, 30, NULL, NULL, NULL, NULL, true, true, '{"tier":"pro","payment_provider":"manual_upi"}'::jsonb),
  ('seba_class_10_premium', 'premium', 'seba', 10, 'HSLC 2027 Premium', 'Class 10 HSLC 2027 Premium season pass.', 19900, 14900, 9900, NULL, NULL, NULL, NULL, '2026-11-15 00:00:00+05:30', true, true, '{"tier":"premium","season":"hslc_2027","payment_provider":"manual_upi"}'::jsonb),
  ('seba_class_10_pro', 'pro', 'seba', 10, 'HSLC 2027 Pro', 'Class 10 HSLC 2027 Pro season pass.', 29900, 24900, 19900, NULL, NULL, NULL, NULL, '2026-11-15 00:00:00+05:30', true, true, '{"tier":"pro","season":"hslc_2027","payment_provider":"manual_upi"}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  product_type = EXCLUDED.product_type,
  board_code = EXCLUDED.board_code,
  class_number = EXCLUDED.class_number,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_paise = EXCLUDED.price_paise,
  early_bird_price_paise = EXCLUDED.early_bird_price_paise,
  school_price_paise = EXCLUDED.school_price_paise,
  duration_days = EXCLUDED.duration_days,
  early_bird_starts_at = EXCLUDED.early_bird_starts_at,
  early_bird_ends_at = EXCLUDED.early_bird_ends_at,
  is_active = EXCLUDED.is_active,
  is_public = EXCLUDED.is_public,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

CREATE OR REPLACE FUNCTION public.sync_catalog_subscription_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  IF NEW.product_type = 'free' THEN
    RETURN NEW;
  END IF;

  IF NEW.subscription_plan_id IS NULL THEN
    INSERT INTO public.subscription_plans (
      code, name, description, price, currency, duration_days, features, is_active, sort_order
    )
    VALUES (
      NEW.code,
      NEW.name,
      NEW.description,
      NEW.price_paise::NUMERIC / 100,
      'INR',
      COALESCE(NEW.duration_days, 365),
      '[]'::JSONB,
      NEW.is_active,
      50
    )
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      price = EXCLUDED.price,
      duration_days = EXCLUDED.duration_days,
      is_active = EXCLUDED.is_active,
      updated_at = NOW()
    RETURNING id INTO v_plan_id;

    NEW.subscription_plan_id := v_plan_id;
  ELSE
    UPDATE public.subscription_plans
    SET name = NEW.name,
        description = NEW.description,
        price = NEW.price_paise::NUMERIC / 100,
        duration_days = COALESCE(NEW.duration_days, 365),
        is_active = NEW.is_active,
        updated_at = NOW()
    WHERE id = NEW.subscription_plan_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_catalog_sync_subscription_plan ON public.product_catalog;
CREATE TRIGGER product_catalog_sync_subscription_plan
  BEFORE INSERT OR UPDATE OF code, name, description, price_paise, duration_days, is_active, subscription_plan_id
  ON public.product_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_catalog_subscription_plan();

UPDATE public.product_catalog
SET updated_at = NOW()
WHERE code IN (
  'seba_class_9_premium',
  'seba_class_9_pro',
  'seba_class_10_premium',
  'seba_class_10_pro'
);

CREATE OR REPLACE FUNCTION public.keep_payment_submission_snapshot_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.product_id IS DISTINCT FROM OLD.product_id
    OR NEW.school_id IS DISTINCT FROM OLD.school_id
    OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
    OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
    OR NEW.discount_minor IS DISTINCT FROM OLD.discount_minor
    OR NEW.final_amount_minor IS DISTINCT FROM OLD.final_amount_minor
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.reference_code IS DISTINCT FROM OLD.reference_code
    OR NEW.product_snapshot IS DISTINCT FROM OLD.product_snapshot
    OR NEW.price_rule IS DISTINCT FROM OLD.price_rule
  THEN
    RAISE EXCEPTION 'Payment submission purchase details are immutable';
  END IF;

  IF NEW.status = 'approved' AND NEW.subscription_id IS NULL THEN
    RAISE EXCEPTION 'Approved payment submissions must have a subscription';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_submission_snapshot_immutable ON public.payment_submissions;
CREATE TRIGGER payment_submission_snapshot_immutable
  BEFORE UPDATE ON public.payment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.keep_payment_submission_snapshot_immutable();

-- Only the service-role approval endpoint can perform this transaction. It
-- serializes review, rejects repeated approvals, and writes subscription access
-- before marking the payment approved in the same transaction.
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
  v_class_number INTEGER;
  v_duration_days INTEGER;
  v_starts_at TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
  v_subscription_id UUID;
  v_reference TEXT;
BEGIN
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Unsupported payment decision';
  END IF;
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
  IF v_submission.status <> 'pending_verification' THEN
    RAISE EXCEPTION 'Payment submission has already been reviewed';
  END IF;

  IF p_status = 'rejected' THEN
    UPDATE public.payment_submissions
    SET status = 'rejected',
        reason = p_reason,
        approved_by = p_actor_id,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = v_submission.id;

    RETURN jsonb_build_object('status', 'rejected');
  END IF;

  IF v_submission.product_snapshot IS NULL
    OR v_submission.final_amount_minor <= 0
    OR v_submission.currency <> 'INR'
  THEN
    RAISE EXCEPTION 'Payment submission is missing a valid purchase snapshot';
  END IF;

  v_reference := NULLIF(lower(btrim(v_submission.reference_code)), '');
  IF v_reference IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.payment_submissions ps
    WHERE ps.id <> v_submission.id
      AND ps.status = 'approved'
      AND lower(btrim(ps.reference_code)) = v_reference
  ) THEN
    RAISE EXCEPTION 'This UPI reference has already been approved';
  END IF;

  SELECT pc.subscription_plan_id
  INTO v_plan_id
  FROM public.product_catalog pc
  WHERE pc.id = v_submission.product_id;
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Subscription plan is not configured for this product';
  END IF;

  v_class_number := (v_submission.product_snapshot->>'class_number')::INTEGER;
  IF v_class_number = 9 THEN
    v_duration_days := (v_submission.product_snapshot->>'duration_days')::INTEGER;
    IF v_duration_days <= 0 THEN
      RAISE EXCEPTION 'Class 9 subscription duration is invalid';
    END IF;
    v_starts_at := NOW();
    v_expires_at := v_starts_at + make_interval(days => v_duration_days);
  ELSIF v_class_number = 10 THEN
    v_starts_at := (v_submission.product_snapshot->>'validity_starts_at')::TIMESTAMPTZ;
    v_expires_at := (v_submission.product_snapshot->>'validity_ends_at')::TIMESTAMPTZ;
    IF v_starts_at IS NULL OR v_expires_at IS NULL OR v_expires_at <= v_starts_at THEN
      RAISE EXCEPTION 'Class 10 season dates must be configured before approval';
    END IF;
    IF v_expires_at <= NOW() THEN
      RAISE EXCEPTION 'Class 10 season has already expired';
    END IF;
    v_starts_at := GREATEST(v_starts_at, NOW());
  ELSE
    RAISE EXCEPTION 'Unsupported subscription class';
  END IF;

  INSERT INTO public.subscriptions (
    user_id, plan_id, status, starts_at, expires_at, auto_renew, source_payment_submission_id
  )
  VALUES (
    v_submission.user_id, v_plan_id, 'active', v_starts_at, v_expires_at, false, v_submission.id
  )
  RETURNING id INTO v_subscription_id;

  UPDATE public.payment_submissions
  SET status = 'approved',
      reason = p_reason,
      approved_by = p_actor_id,
      approved_at = NOW(),
      subscription_id = v_subscription_id,
      updated_at = NOW()
  WHERE id = v_submission.id;

  INSERT INTO public.admin_audit_logs (
    actor_id, action, entity_type, entity_id, new_state, reason
  )
  VALUES (
    p_actor_id,
    'manual_payment_approved',
    'payment_submission',
    v_submission.id,
    jsonb_build_object(
      'subscription_id', v_subscription_id,
      'amount_minor', v_submission.final_amount_minor,
      'currency', v_submission.currency
    ),
    p_reason
  );

  RETURN jsonb_build_object(
    'status', 'approved',
    'subscription_id', v_subscription_id,
    'starts_at', v_starts_at,
    'expires_at', v_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_manual_payment_submission(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_manual_payment_submission(UUID, UUID, TEXT, TEXT)
  TO service_role;

-- Users may submit and read their own payment requests, but cannot directly
-- change their payment status or grant themselves paid access.
REVOKE UPDATE, DELETE ON TABLE public.payment_submissions FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS subscriptions_user_active_window_idx
  ON public.subscriptions (user_id, starts_at, expires_at)
  WHERE status = 'active';
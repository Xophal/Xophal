-- Paid access is server-created and scoped to the subscription's eligible tests.

REVOKE INSERT ON TABLE public.payment_submissions FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS payment_submissions_owner_insert ON public.payment_submissions;

ALTER TABLE public.payment_submissions
  ADD COLUMN IF NOT EXISTS subscription_plan_id UUID
    REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS payment_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_note TEXT,
  ADD COLUMN IF NOT EXISTS verified_amount_minor INTEGER,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

ALTER TABLE public.payment_submissions
  ADD COLUMN IF NOT EXISTS order_reference TEXT;
UPDATE public.payment_submissions
SET order_reference = 'XOP-SUB-' || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 12))
WHERE order_reference IS NULL;
ALTER TABLE public.payment_submissions
  ALTER COLUMN order_reference SET DEFAULT
    ('XOP-SUB-' || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 12))),
  ALTER COLUMN order_reference SET NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'subscription-payment-evidence',
  'subscription-payment-evidence',
  FALSE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS subscription_evidence_owner_upload ON storage.objects;
CREATE POLICY subscription_evidence_owner_upload
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'subscription-payment-evidence'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::TEXT)
    AND (storage.foldername(name))[2] = 'subscription-evidence'
  );

DROP POLICY IF EXISTS subscription_evidence_owner_admin_read ON storage.objects;
CREATE POLICY subscription_evidence_owner_admin_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'subscription-payment-evidence'
    AND (
      owner_id = (SELECT auth.uid()::TEXT)
      OR public.is_payment_verifier()
      OR public.is_subscription_admin()
    )
  );

ALTER TABLE public.payment_submissions
  DROP CONSTRAINT IF EXISTS payment_submissions_status_check;
ALTER TABLE public.payment_submissions
  ADD CONSTRAINT payment_submissions_status_check
  CHECK (status IN (
    'pending_payment', 'pending_verification', 'under_review', 'approved',
    'rejected', 'duplicate_flagged', 'cancelled'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS payment_submissions_order_reference_uidx
  ON public.payment_submissions (order_reference);
CREATE UNIQUE INDEX IF NOT EXISTS payment_submissions_open_subscription_order_uidx
  ON public.payment_submissions (user_id, subscription_plan_id)
  WHERE subscription_plan_id IS NOT NULL
    AND status IN ('pending_payment', 'pending_verification', 'under_review');
DROP INDEX IF EXISTS public.payment_submissions_unique_active_reference;
CREATE UNIQUE INDEX payment_submissions_unique_active_reference
  ON public.payment_submissions (lower(btrim(reference_code)))
  WHERE reference_code IS NOT NULL
    AND status IN ('pending_verification', 'under_review', 'approved');

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN (
    'pending', 'verification_pending', 'under_review', 'active', 'rejected',
    'expired', 'cancelled', 'suspended', 'refunded', 'past_due', 'trialing'
  ));

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS duration_value INTEGER NOT NULL DEFAULT 30 CHECK (duration_value > 0),
  ADD COLUMN IF NOT EXISTS duration_unit TEXT NOT NULL DEFAULT 'days'
    CHECK (duration_unit IN ('days', 'months', 'years')),
  ADD COLUMN IF NOT EXISTS applicable_board_codes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS applicable_class_numbers INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS applicable_subject_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS included_mock_test_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS test_categories TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS access_limitations JSONB NOT NULL DEFAULT '{}'::JSONB;

UPDATE public.subscription_plans
SET duration_value = duration_days
WHERE duration_value = 30
  AND duration_unit = 'days'
  AND duration_days <> 30;

CREATE TABLE IF NOT EXISTS public.payment_submission_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_submission_id UUID NOT NULL
    REFERENCES public.payment_submissions(id) ON DELETE RESTRICT,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'order_created', 'payment_submitted', 'under_review', 'approved',
    'rejected', 'cancelled'
  )),
  previous_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.payment_submission_events
  DROP CONSTRAINT IF EXISTS payment_submission_events_action_check;
ALTER TABLE public.payment_submission_events
  ADD CONSTRAINT payment_submission_events_action_check
  CHECK (action IN (
    'order_created', 'payment_submitted', 'additional_information_submitted', 'under_review', 'approved',
    'rejected', 'duplicate_flagged', 'cancelled'
  ));

CREATE INDEX IF NOT EXISTS payment_submission_events_order_idx
  ON public.payment_submission_events (payment_submission_id, created_at DESC);
ALTER TABLE public.payment_submission_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payment_submission_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.payment_submission_events TO authenticated;
GRANT ALL ON TABLE public.payment_submission_events TO service_role;
CREATE POLICY payment_submission_events_owner_read
  ON public.payment_submission_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.payment_submissions ps
      WHERE ps.id = payment_submission_events.payment_submission_id
        AND ps.user_id = auth.uid()
    )
  );
CREATE POLICY payment_submission_events_admin_read
  ON public.payment_submission_events FOR SELECT
  USING (
    public.is_payment_verifier()
    OR public.is_subscription_admin()
    OR public.is_refund_approver()
  );

CREATE TABLE IF NOT EXISTS public.subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscription_history_user_idx
  ON public.subscription_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS subscription_history_subscription_idx
  ON public.subscription_history (subscription_id, created_at DESC);
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.subscription_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.subscription_history TO authenticated;
GRANT ALL ON TABLE public.subscription_history TO service_role;
CREATE POLICY subscription_history_owner_read
  ON public.subscription_history FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_subscription_admin()
    OR public.is_payment_verifier()
    OR public.is_refund_approver()
  );

ALTER TABLE public.mock_tests
  ADD COLUMN IF NOT EXISTS access_category TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS available_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS available_until TIMESTAMPTZ;

UPDATE public.mock_tests
SET access_category = 'premium'
WHERE is_premium = true OR COALESCE(access_price, 0) > 0;

ALTER TABLE public.mock_tests
  DROP CONSTRAINT IF EXISTS mock_tests_access_category_check;
ALTER TABLE public.mock_tests
  ADD CONSTRAINT mock_tests_access_category_check
  CHECK (access_category IN ('free', 'premium', 'subscription_exclusive', 'subject_specific', 'board_class_specific'));

ALTER TABLE public.mock_tests
  DROP CONSTRAINT IF EXISTS mock_tests_availability_window_check;
ALTER TABLE public.mock_tests
  ADD CONSTRAINT mock_tests_availability_window_check
  CHECK (available_until IS NULL OR available_from IS NULL OR available_until > available_from);

CREATE INDEX IF NOT EXISTS subscription_plans_active_scope_idx
  ON public.subscription_plans (is_active, sort_order);
CREATE INDEX IF NOT EXISTS mock_tests_access_window_idx
  ON public.mock_tests (access_category, available_from, available_until)
  WHERE is_active = true AND is_published = true;

CREATE OR REPLACE FUNCTION public.can_access_mock_test(
  p_user_id UUID,
  p_mock_test_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_test RECORD;
  v_profile RECORD;
BEGIN
  IF p_user_id IS NULL OR p_mock_test_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF COALESCE(auth.role(), '') <> 'service_role'
    AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id)
  THEN
    RETURN FALSE;
  END IF;

  SELECT
    mt.id,
    mt.is_active,
    mt.is_published,
    mt.is_premium,
    COALESCE(mt.access_price, 0) AS access_price,
    mt.access_category,
    mt.available_from,
    mt.available_until,
    COALESCE(mt.subject_id, ch.subject_id) AS subject_id,
    sub.class_id,
    cl.grade_number AS class_number,
    br.id AS board_id,
    br.code AS board_code
  INTO v_test
  FROM public.mock_tests mt
  LEFT JOIN public.chapters ch ON ch.id = mt.chapter_id
  LEFT JOIN public.subjects sub ON sub.id = COALESCE(mt.subject_id, ch.subject_id)
  LEFT JOIN public.classes cl ON cl.id = sub.class_id
  LEFT JOIN public.boards br ON br.id = cl.board_id
  WHERE mt.id = p_mock_test_id
    AND mt.is_active = TRUE
    AND mt.is_published = TRUE;

  IF NOT FOUND
    OR (v_test.available_from IS NOT NULL AND v_test.available_from > NOW())
    OR (v_test.available_until IS NOT NULL AND v_test.available_until <= NOW())
  THEN
    RETURN FALSE;
  END IF;

  SELECT p.board_id, p.class_id, p.is_active
  INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF NOT FOUND OR v_profile.is_active IS DISTINCT FROM TRUE THEN
    RETURN FALSE;
  END IF;

  IF (v_profile.board_id IS NOT NULL AND v_test.board_id IS NOT NULL AND v_profile.board_id <> v_test.board_id)
    OR (v_profile.class_id IS NOT NULL AND v_test.class_id IS NOT NULL AND v_profile.class_id <> v_test.class_id)
  THEN
    RETURN FALSE;
  END IF;

  IF v_test.access_category = 'free'
    AND v_test.is_premium IS DISTINCT FROM TRUE
    AND v_test.access_price <= 0
  THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.test_access_grants g
    WHERE g.user_id = p_user_id
      AND g.mock_test_id = p_mock_test_id
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
    WHERE s.user_id = p_user_id
      AND s.status = 'active'
      AND s.starts_at <= NOW()
      AND s.expires_at > NOW()
      AND (
        (cardinality(sp.applicable_board_codes) > 0
          AND v_test.board_code = ANY(sp.applicable_board_codes))
        OR (
          cardinality(sp.applicable_board_codes) = 0
          AND (
            NOT EXISTS (
              SELECT 1 FROM public.product_catalog pc
              WHERE pc.subscription_plan_id = sp.id
            )
            OR EXISTS (
              SELECT 1 FROM public.product_catalog pc
              WHERE pc.subscription_plan_id = sp.id
                AND pc.board_code = v_test.board_code
            )
          )
        )
      )
      AND (
        (cardinality(sp.applicable_class_numbers) > 0
          AND v_test.class_number = ANY(sp.applicable_class_numbers))
        OR (
          cardinality(sp.applicable_class_numbers) = 0
          AND (
            NOT EXISTS (
              SELECT 1 FROM public.product_catalog pc
              WHERE pc.subscription_plan_id = sp.id
            )
            OR EXISTS (
              SELECT 1 FROM public.product_catalog pc
              WHERE pc.subscription_plan_id = sp.id
                AND pc.class_number = v_test.class_number
            )
          )
        )
      )
      AND (
        cardinality(sp.applicable_subject_ids) = 0
        OR v_test.subject_id = ANY(sp.applicable_subject_ids)
      )
      AND (
        cardinality(sp.included_mock_test_ids) = 0
        OR p_mock_test_id = ANY(sp.included_mock_test_ids)
      )
      AND (
        cardinality(sp.test_categories) = 0
        OR v_test.access_category = ANY(sp.test_categories)
      )
      AND (
        NOT (sp.access_limitations ? 'max_attempts_per_test')
        OR CASE
          WHEN (sp.access_limitations->>'max_attempts_per_test') ~ '^[1-9][0-9]{0,6}$'
          THEN (
            SELECT COUNT(*)
            FROM public.test_attempts ta
            WHERE ta.user_id = p_user_id
              AND ta.mock_test_id = p_mock_test_id
              AND ta.status <> 'in_progress'
              AND ta.started_at >= s.starts_at
          ) < (sp.access_limitations->>'max_attempts_per_test')::INTEGER
          ELSE FALSE
        END
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_mock_test(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_mock_test(UUID, UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS mock_tests_read ON public.mock_tests;
CREATE POLICY mock_tests_read ON public.mock_tests
  FOR SELECT
  USING (
    is_published = TRUE
    AND is_active = TRUE
    AND (
      (
        access_category = 'free'
        AND is_premium = FALSE
        AND COALESCE(access_price, 0) <= 0
        AND (available_from IS NULL OR available_from <= NOW())
        AND (available_until IS NULL OR available_until > NOW())
      )
      OR public.can_access_mock_test(auth.uid(), id)
      OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS mock_test_sections_read ON public.mock_test_sections;
CREATE POLICY mock_test_sections_read ON public.mock_test_sections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.mock_tests mt
      WHERE mt.id = mock_test_sections.mock_test_id
        AND mt.is_published = TRUE
        AND mt.is_active = TRUE
        AND (public.can_access_mock_test(auth.uid(), mt.id) OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS mock_test_questions_read ON public.mock_test_questions;
CREATE POLICY mock_test_questions_read ON public.mock_test_questions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.mock_tests mt
      WHERE mt.id = mock_test_questions.mock_test_id
        AND mt.is_published = TRUE
        AND mt.is_active = TRUE
        AND (public.can_access_mock_test(auth.uid(), mt.id) OR public.is_admin())
    )
  );

CREATE OR REPLACE FUNCTION public.keep_payment_submission_snapshot_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('pending_payment', 'pending_verification')
      OR NEW.subscription_id IS NOT NULL
      OR NEW.approved_by IS NOT NULL
      OR NEW.approved_at IS NOT NULL
    THEN
      RAISE EXCEPTION 'Payment submissions must start in a pending state';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.product_id IS DISTINCT FROM OLD.product_id
    OR NEW.subscription_plan_id IS DISTINCT FROM OLD.subscription_plan_id
    OR NEW.school_id IS DISTINCT FROM OLD.school_id
    OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
    OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
    OR NEW.discount_minor IS DISTINCT FROM OLD.discount_minor
    OR NEW.final_amount_minor IS DISTINCT FROM OLD.final_amount_minor
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.product_snapshot IS DISTINCT FROM OLD.product_snapshot
    OR NEW.price_rule IS DISTINCT FROM OLD.price_rule
    OR NEW.order_reference IS DISTINCT FROM OLD.order_reference
  THEN
    RAISE EXCEPTION 'Payment submission purchase details are immutable';
  END IF;

  IF NEW.reference_code IS DISTINCT FROM OLD.reference_code
    AND NOT (
      OLD.status = 'pending_payment'
      AND OLD.reference_code IS NULL
      AND NEW.reference_code IS NOT NULL
      AND NEW.status = 'pending_verification'
    )
  THEN
    RAISE EXCEPTION 'UPI transaction reference cannot be changed';
  END IF;

  IF NEW.status = 'approved' AND NEW.subscription_id IS NULL THEN
    RAISE EXCEPTION 'Approved payment submissions must have a subscription';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_submission_snapshot_immutable ON public.payment_submissions;
CREATE TRIGGER payment_submission_snapshot_immutable
  BEFORE INSERT OR UPDATE ON public.payment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.keep_payment_submission_snapshot_immutable();

CREATE OR REPLACE FUNCTION public.create_manual_subscription_order(
  p_user_id UUID,
  p_plan_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_plan public.subscription_plans%ROWTYPE;
  v_order public.payment_submissions%ROWTYPE;
  v_amount_minor INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_plan_id IS NULL THEN
    RAISE EXCEPTION 'Student and plan are required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT || ':' || p_plan_id::TEXT, 0));

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE id = p_plan_id
  FOR SHARE;

  IF NOT FOUND OR v_plan.is_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Subscription plan is not available';
  END IF;
  IF upper(v_plan.currency) <> 'INR'
    OR v_plan.price <= 0
    OR v_plan.price > 21474836.47
    OR v_plan.duration_value <= 0
  THEN
    RAISE EXCEPTION 'Subscription plan is not configured for manual UPI checkout';
  END IF;

  v_amount_minor := round(v_plan.price * 100)::INTEGER;
  IF v_amount_minor <= 0 THEN
    RAISE EXCEPTION 'Subscription plan amount is invalid';
  END IF;

  SELECT * INTO v_order
  FROM public.payment_submissions
  WHERE user_id = p_user_id
    AND subscription_plan_id = p_plan_id
    AND status IN ('pending_payment', 'pending_verification', 'under_review')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object('order', to_jsonb(v_order), 'already_exists', TRUE);
  END IF;

  INSERT INTO public.payment_submissions (
    user_id,
    subscription_plan_id,
    payment_method,
    amount_minor,
    discount_minor,
    final_amount_minor,
    currency,
    status,
    product_snapshot
  )
  VALUES (
    p_user_id,
    p_plan_id,
    'upi_manual',
    v_amount_minor,
    0,
    v_amount_minor,
    upper(v_plan.currency),
    'pending_payment',
    jsonb_build_object(
      'plan_id', v_plan.id,
      'code', v_plan.code,
      'name', v_plan.name,
      'price', v_plan.price,
      'amount_minor', v_amount_minor,
      'currency', upper(v_plan.currency),
      'duration_value', v_plan.duration_value,
      'duration_unit', v_plan.duration_unit,
      'duration_days', v_plan.duration_days,
      'applicable_board_codes', v_plan.applicable_board_codes,
      'applicable_class_numbers', v_plan.applicable_class_numbers,
      'applicable_subject_ids', v_plan.applicable_subject_ids,
      'included_mock_test_ids', v_plan.included_mock_test_ids,
      'test_categories', v_plan.test_categories,
      'features', v_plan.features,
      'access_limitations', v_plan.access_limitations
    )
  )
  RETURNING * INTO v_order;

  INSERT INTO public.payment_submission_events (
    payment_submission_id, actor_id, action, previous_status, new_status, metadata
  )
  VALUES (
    v_order.id,
    p_user_id,
    'order_created',
    NULL,
    v_order.status,
    jsonb_build_object('plan_id', v_plan.id, 'amount_minor', v_amount_minor, 'currency', upper(v_plan.currency))
  );

  RETURN jsonb_build_object('order', to_jsonb(v_order), 'already_exists', FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.create_manual_subscription_order(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_manual_subscription_order(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.submit_manual_subscription_payment(
  p_submission_id UUID,
  p_user_id UUID,
  p_reference_code TEXT,
  p_payment_paid_at TIMESTAMPTZ,
  p_evidence_url TEXT DEFAULT NULL,
  p_payment_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_order public.payment_submissions%ROWTYPE;
  v_reference TEXT;
BEGIN
  v_reference := NULLIF(btrim(p_reference_code), '');
  IF p_submission_id IS NULL OR p_user_id IS NULL OR v_reference IS NULL OR p_payment_paid_at IS NULL THEN
    RAISE EXCEPTION 'Order, transaction reference, and payment time are required';
  END IF;
  IF length(v_reference) > 255 OR (p_payment_note IS NOT NULL AND length(p_payment_note) > 1000) THEN
    RAISE EXCEPTION 'Payment details exceed the allowed length';
  END IF;
  IF p_evidence_url IS NOT NULL
    AND p_evidence_url NOT LIKE p_user_id::TEXT || '/subscription-evidence/%'
  THEN
    RAISE EXCEPTION 'Payment evidence must be an uploaded file from your account';
  END IF;

  SELECT * INTO v_order
  FROM public.payment_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Payment order not found';
  END IF;

  IF v_order.status = 'pending_verification' AND v_order.reference_code = v_reference THEN
    RETURN jsonb_build_object('id', v_order.id, 'status', v_order.status, 'already_submitted', TRUE);
  END IF;
  IF v_order.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'Payment order is no longer awaiting payment details';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(lower(v_reference), 0));
  IF EXISTS (
    SELECT 1
    FROM public.payment_submissions ps
    WHERE ps.id <> v_order.id
      AND ps.status IN ('pending_verification', 'under_review', 'approved')
      AND lower(btrim(ps.reference_code)) = lower(v_reference)
  ) OR EXISTS (
    SELECT 1
    FROM public.manual_payment_requests mr
    WHERE mr.status IN ('pending_verification', 'under_review', 'approved')
      AND lower(btrim(mr.reference_code)) = lower(v_reference)
  ) THEN
    RAISE EXCEPTION 'UPI transaction reference has already been submitted';
  END IF;

  UPDATE public.payment_submissions
  SET reference_code = v_reference,
      payment_paid_at = p_payment_paid_at,
      evidence_url = NULLIF(btrim(p_evidence_url), ''),
      payment_note = NULLIF(btrim(p_payment_note), ''),
      status = 'pending_verification',
      updated_at = NOW()
  WHERE id = v_order.id
  RETURNING * INTO v_order;

  INSERT INTO public.payment_submission_events (
    payment_submission_id, actor_id, action, previous_status, new_status, metadata
  )
  VALUES (
    v_order.id,
    p_user_id,
    'payment_submitted',
    'pending_payment',
    v_order.status,
    jsonb_build_object('reference_code', v_reference, 'payment_paid_at', p_payment_paid_at)
  );

  RETURN jsonb_build_object('id', v_order.id, 'order_reference', v_order.order_reference, 'status', v_order.status);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_manual_subscription_payment(UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_manual_subscription_payment(UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.submit_manual_subscription_information(
  p_submission_id UUID,
  p_user_id UUID,
  p_additional_information TEXT,
  p_evidence_path TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_submission public.payment_submissions%ROWTYPE;
  v_information TEXT := NULLIF(btrim(p_additional_information), '');
  v_evidence TEXT := NULLIF(btrim(p_evidence_path), '');
BEGIN
  IF p_submission_id IS NULL OR p_user_id IS NULL
    OR v_information IS NULL OR length(v_information) > 1000
  THEN
    RAISE EXCEPTION 'Additional payment information is required';
  END IF;
  IF v_evidence IS NOT NULL
    AND v_evidence !~ (
      '^' || p_user_id::TEXT || '/subscription-evidence/[0-9a-f-]{36}\.(jpg|png|webp)$'
    )
  THEN
    RAISE EXCEPTION 'Payment evidence must be an uploaded file from your account';
  END IF;

  SELECT * INTO v_submission
  FROM public.payment_submissions
  WHERE id = p_submission_id
  FOR UPDATE;
  IF NOT FOUND OR v_submission.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Payment order not found';
  END IF;
  IF v_submission.status <> 'under_review' THEN
    RAISE EXCEPTION 'Payment order is not requesting additional information';
  END IF;

  UPDATE public.payment_submissions
  SET payment_note = v_information,
      evidence_url = COALESCE(v_evidence, evidence_url),
      status = 'pending_verification',
      updated_at = NOW()
  WHERE id = v_submission.id;

  INSERT INTO public.payment_submission_events (
    payment_submission_id, actor_id, action, previous_status, new_status, reason, metadata
  )
  VALUES (
    v_submission.id, p_user_id, 'additional_information_submitted', 'under_review', 'pending_verification',
    v_information, jsonb_build_object('has_new_evidence', v_evidence IS NOT NULL)
  );

  RETURN jsonb_build_object('id', v_submission.id, 'status', 'pending_verification');
END;
$$;

REVOKE ALL ON FUNCTION public.submit_manual_subscription_information(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_manual_subscription_information(UUID, UUID, TEXT, TEXT)
  TO service_role;

DROP FUNCTION IF EXISTS public.resolve_manual_payment_submission(UUID, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.resolve_manual_payment_submission(
  p_submission_id UUID,
  p_actor_id UUID,
  p_status TEXT,
  p_reason TEXT DEFAULT NULL,
  p_verified_amount_minor INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_submission public.payment_submissions%ROWTYPE;
  v_plan public.subscription_plans%ROWTYPE;
  v_plan_id UUID;
  v_duration_value INTEGER;
  v_duration_unit TEXT;
  v_starts_at TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
  v_subscription_id UUID;
  v_reference TEXT;
  v_previous_status TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_status NOT IN ('approved', 'rejected') OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Invalid payment resolution';
  END IF;

  SELECT * INTO v_submission
  FROM public.payment_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment submission not found';
  END IF;

  IF v_submission.status = p_status THEN
    IF p_status = 'approved'
      AND v_submission.verified_amount_minor IS DISTINCT FROM p_verified_amount_minor
    THEN
      RAISE EXCEPTION 'This payment was already approved with a different verified amount';
    END IF;
    RETURN jsonb_build_object(
      'status', v_submission.status,
      'subscription_id', v_submission.subscription_id,
      'already_resolved', TRUE
    );
  END IF;

  IF v_submission.status NOT IN ('pending_verification', 'under_review') THEN
    RAISE EXCEPTION 'Payment submission has already been reviewed';
  END IF;
  v_previous_status := v_submission.status;

  IF p_status = 'rejected' THEN
    UPDATE public.payment_submissions
    SET status = 'rejected',
        reason = NULLIF(btrim(p_reason), ''),
        approved_by = p_actor_id,
        approved_at = v_now,
        updated_at = v_now
    WHERE id = v_submission.id;

    INSERT INTO public.payment_submission_events (
      payment_submission_id, actor_id, action, previous_status, new_status, reason
    )
    VALUES (v_submission.id, p_actor_id, 'rejected', v_previous_status, 'rejected', NULLIF(btrim(p_reason), ''));

    INSERT INTO public.admin_audit_logs (
      actor_id, action, entity_type, entity_id, previous_state, new_state, reason
    )
    VALUES (
      p_actor_id, 'manual_payment_rejected', 'payment_submission', v_submission.id,
      jsonb_build_object('status', v_previous_status),
      jsonb_build_object('status', 'rejected'),
      NULLIF(btrim(p_reason), '')
    );

    RETURN jsonb_build_object('status', 'rejected');
  END IF;

  IF p_verified_amount_minor IS NULL
    OR p_verified_amount_minor <= 0
    OR p_verified_amount_minor <> v_submission.final_amount_minor
    OR v_submission.final_amount_minor <= 0
    OR upper(v_submission.currency) <> 'INR'
  THEN
    RAISE EXCEPTION 'Verified payment amount must exactly match the INR order amount';
  END IF;

  IF v_submission.product_snapshot IS NULL
    OR (
      v_submission.product_snapshot ? 'amount_minor'
      AND v_submission.product_snapshot->>'amount_minor' ~ '^[0-9]+$'
      AND (v_submission.product_snapshot->>'amount_minor')::INTEGER <> v_submission.final_amount_minor
    )
  THEN
    RAISE EXCEPTION 'Payment submission is missing a valid immutable order amount';
  END IF;

  v_reference := NULLIF(lower(btrim(v_submission.reference_code)), '');
  IF v_reference IS NULL THEN
    RAISE EXCEPTION 'UPI transaction reference is required before approval';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.payment_submissions ps
    WHERE ps.id <> v_submission.id
      AND ps.status IN ('pending_verification', 'under_review', 'approved')
      AND lower(btrim(ps.reference_code)) = v_reference
  ) OR EXISTS (
    SELECT 1
    FROM public.manual_payment_requests mr
    WHERE mr.status IN ('pending_verification', 'under_review', 'approved')
      AND lower(btrim(mr.reference_code)) = v_reference
  ) THEN
    RAISE EXCEPTION 'This UPI reference has already been submitted';
  END IF;

  v_plan_id := v_submission.subscription_plan_id;
  IF v_plan_id IS NULL AND v_submission.product_id IS NOT NULL THEN
    SELECT pc.subscription_plan_id INTO v_plan_id
    FROM public.product_catalog pc
    WHERE pc.id = v_submission.product_id;
  END IF;
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Subscription plan is not configured for this order';
  END IF;

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE id = v_plan_id
  FOR SHARE;
  IF NOT FOUND OR v_plan.is_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Subscription plan is no longer active';
  END IF;

  v_duration_value := COALESCE(
    NULLIF(v_submission.product_snapshot->>'duration_value', '')::INTEGER,
    v_plan.duration_value,
    v_plan.duration_days
  );
  v_duration_unit := COALESCE(
    NULLIF(v_submission.product_snapshot->>'duration_unit', ''),
    v_plan.duration_unit,
    'days'
  );
  IF v_duration_value IS NULL OR v_duration_value <= 0
    OR v_duration_unit NOT IN ('days', 'months', 'years')
  THEN
    RAISE EXCEPTION 'Subscription plan duration is invalid';
  END IF;

  SELECT GREATEST(v_now, COALESCE(MAX(s.expires_at), v_now))
  INTO v_starts_at
  FROM public.subscriptions s
  WHERE s.user_id = v_submission.user_id
    AND s.status = 'active'
    AND s.expires_at > v_now;

  IF v_submission.product_snapshot->>'validity_starts_at' IS NOT NULL
    AND v_submission.product_snapshot->>'validity_ends_at' IS NOT NULL
  THEN
    v_starts_at := GREATEST(
      v_starts_at,
      (v_submission.product_snapshot->>'validity_starts_at')::TIMESTAMPTZ
    );
    v_expires_at := (v_submission.product_snapshot->>'validity_ends_at')::TIMESTAMPTZ;
  ELSE
    v_expires_at := CASE v_duration_unit
      WHEN 'days' THEN v_starts_at + make_interval(days => v_duration_value)
      WHEN 'months' THEN v_starts_at + make_interval(months => v_duration_value)
      WHEN 'years' THEN v_starts_at + make_interval(years => v_duration_value)
    END;
  END IF;

  IF v_expires_at IS NULL OR v_expires_at <= v_starts_at THEN
    RAISE EXCEPTION 'Subscription period is invalid or has expired';
  END IF;

  INSERT INTO public.subscriptions (
    user_id, plan_id, status, starts_at, expires_at, auto_renew, source_payment_submission_id
  )
  VALUES (
    v_submission.user_id, v_plan_id, 'active', v_starts_at, v_expires_at, FALSE, v_submission.id
  )
  RETURNING id INTO v_subscription_id;

  UPDATE public.payment_submissions
  SET status = 'approved',
      reason = NULLIF(btrim(p_reason), ''),
      approved_by = p_actor_id,
      approved_at = v_now,
      verified_amount_minor = p_verified_amount_minor,
      verified_at = v_now,
      subscription_id = v_subscription_id,
      updated_at = v_now
  WHERE id = v_submission.id;

  INSERT INTO public.subscription_history (
    subscription_id, user_id, plan_id, actor_id, action, previous_status, new_status, notes, metadata
  )
  VALUES (
    v_subscription_id, v_submission.user_id, v_plan_id, p_actor_id, 'activated', NULL, 'active',
    NULLIF(btrim(p_reason), ''),
    jsonb_build_object('payment_submission_id', v_submission.id, 'order_reference', v_submission.order_reference)
  );

  INSERT INTO public.payment_submission_events (
    payment_submission_id, actor_id, action, previous_status, new_status, reason, metadata
  )
  VALUES (
    v_submission.id, p_actor_id, 'approved', v_previous_status, 'approved', NULLIF(btrim(p_reason), ''),
    jsonb_build_object('subscription_id', v_subscription_id, 'verified_amount_minor', p_verified_amount_minor)
  );

  INSERT INTO public.admin_audit_logs (
    actor_id, action, entity_type, entity_id, previous_state, new_state, reason
  )
  VALUES (
    p_actor_id, 'manual_payment_approved', 'payment_submission', v_submission.id,
    jsonb_build_object('status', v_previous_status),
    jsonb_build_object(
      'status', 'approved',
      'subscription_id', v_subscription_id,
      'verified_amount_minor', p_verified_amount_minor,
      'currency', v_submission.currency,
      'starts_at', v_starts_at,
      'expires_at', v_expires_at
    ),
    NULLIF(btrim(p_reason), '')
  );

  RETURN jsonb_build_object(
    'status', 'approved',
    'subscription_id', v_subscription_id,
    'starts_at', v_starts_at,
    'expires_at', v_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_manual_payment_submission(UUID, UUID, TEXT, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_manual_payment_submission(UUID, UUID, TEXT, TEXT, INTEGER)
  TO service_role;

CREATE OR REPLACE FUNCTION public.set_manual_payment_submission_under_review(
  p_submission_id UUID,
  p_actor_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_submission public.payment_submissions%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL OR NULLIF(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Reviewer and additional information request are required';
  END IF;

  SELECT * INTO v_submission
  FROM public.payment_submissions
  WHERE id = p_submission_id
  FOR UPDATE;
  IF NOT FOUND OR v_submission.status <> 'pending_verification' THEN
    RAISE EXCEPTION 'Payment submission was not found or is no longer pending';
  END IF;

  UPDATE public.payment_submissions
  SET status = 'under_review',
      reason = btrim(p_reason),
      approved_by = p_actor_id,
      updated_at = NOW()
  WHERE id = v_submission.id;

  INSERT INTO public.payment_submission_events (
    payment_submission_id, actor_id, action, previous_status, new_status, reason
  )
  VALUES (v_submission.id, p_actor_id, 'under_review', v_submission.status, 'under_review', btrim(p_reason));

  INSERT INTO public.admin_audit_logs (
    actor_id, action, entity_type, entity_id, previous_state, new_state, reason
  )
  VALUES (
    p_actor_id, 'manual_payment_under_review', 'payment_submission', v_submission.id,
    jsonb_build_object('status', v_submission.status),
    jsonb_build_object('status', 'under_review'),
    btrim(p_reason)
  );

  RETURN jsonb_build_object('id', v_submission.id, 'status', 'under_review', 'reason', btrim(p_reason));
END;
$$;

REVOKE ALL ON FUNCTION public.set_manual_payment_submission_under_review(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_manual_payment_submission_under_review(UUID, UUID, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.set_manual_payment_submission_flag(
  p_submission_id UUID,
  p_actor_id UUID,
  p_status TEXT,
  p_reason TEXT DEFAULT NULL,
  p_duplicate_of UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_submission public.payment_submissions%ROWTYPE;
  v_previous_status TEXT;
  v_reason TEXT := NULLIF(btrim(p_reason), '');
BEGIN
  IF p_actor_id IS NULL OR p_status NOT IN ('duplicate_flagged', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid payment submission action';
  END IF;

  SELECT * INTO v_submission
  FROM public.payment_submissions
  WHERE id = p_submission_id
  FOR UPDATE;
  IF NOT FOUND OR v_submission.status NOT IN ('pending_payment', 'pending_verification', 'under_review') THEN
    RAISE EXCEPTION 'Payment submission was not found or is no longer actionable';
  END IF;
  IF p_status = 'duplicate_flagged' AND NULLIF(btrim(v_submission.reference_code), '') IS NULL THEN
    RAISE EXCEPTION 'A UPI transaction reference is required to flag a duplicate';
  END IF;

  v_previous_status := v_submission.status;
  UPDATE public.payment_submissions
  SET status = p_status,
      reason = v_reason,
      duplicate_of = CASE WHEN p_status = 'duplicate_flagged' THEN p_duplicate_of ELSE NULL END,
      approved_by = p_actor_id,
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = v_submission.id;

  INSERT INTO public.payment_submission_events (
    payment_submission_id, actor_id, action, previous_status, new_status, reason
  )
  VALUES (v_submission.id, p_actor_id, p_status, v_previous_status, p_status, v_reason);

  INSERT INTO public.admin_audit_logs (
    actor_id, action, entity_type, entity_id, previous_state, new_state, reason
  )
  VALUES (
    p_actor_id, 'manual_payment_' || p_status, 'payment_submission', v_submission.id,
    jsonb_build_object('status', v_previous_status),
    jsonb_build_object('status', p_status, 'duplicate_of', p_duplicate_of),
    v_reason
  );

  RETURN jsonb_build_object('id', v_submission.id, 'status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.set_manual_payment_submission_flag(UUID, UUID, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_manual_payment_submission_flag(UUID, UUID, TEXT, TEXT, UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION public.expire_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_subscription RECORD;
  v_expired_count INTEGER := 0;
BEGIN
  FOR v_subscription IN
    UPDATE public.subscriptions
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'active'
      AND expires_at <= NOW()
    RETURNING id, user_id, plan_id
  LOOP
    INSERT INTO public.subscription_history (
      subscription_id, user_id, plan_id, action, previous_status, new_status
    )
    VALUES (
      v_subscription.id, v_subscription.user_id, v_subscription.plan_id,
      'expired', 'active', 'expired'
    );
    v_expired_count := v_expired_count + 1;
  END LOOP;

  RETURN v_expired_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_subscriptions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_subscriptions() TO service_role;

CREATE TABLE IF NOT EXISTS public.subscription_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE RESTRICT,
  payment_submission_id UUID NOT NULL REFERENCES public.payment_submissions(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'verified', 'rejected')),
  refund_reference TEXT,
  refund_date TIMESTAMPTZ,
  reason TEXT NOT NULL,
  revoke_access BOOLEAN NOT NULL DEFAULT TRUE,
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    status <> 'verified'
    OR (NULLIF(btrim(refund_reference), '') IS NOT NULL AND refund_date IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS subscription_refunds_user_idx
  ON public.subscription_refunds (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS subscription_refunds_subscription_idx
  ON public.subscription_refunds (subscription_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS subscription_refunds_reference_uidx
  ON public.subscription_refunds (lower(btrim(refund_reference)))
  WHERE refund_reference IS NOT NULL AND status <> 'rejected';

ALTER TABLE public.subscription_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.subscription_refunds FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.subscription_refunds TO authenticated;
GRANT ALL ON TABLE public.subscription_refunds TO service_role;
CREATE POLICY subscription_refunds_owner_read
  ON public.subscription_refunds FOR SELECT
  USING (user_id = auth.uid() OR public.is_subscription_admin() OR public.is_refund_approver());

CREATE OR REPLACE FUNCTION public.set_subscription_status(
  p_subscription_id UUID,
  p_actor_id UUID,
  p_status TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_subscription public.subscriptions%ROWTYPE;
  v_previous_status TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_actor_id IS NULL OR p_status NOT IN ('active', 'suspended', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid subscription status action';
  END IF;

  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  IF v_subscription.status = p_status THEN
    RETURN jsonb_build_object('id', v_subscription.id, 'status', p_status, 'already_applied', TRUE);
  END IF;
  IF (p_status = 'active' AND v_subscription.status <> 'suspended')
    OR (p_status = 'suspended' AND v_subscription.status <> 'active')
    OR (p_status = 'cancelled' AND v_subscription.status NOT IN ('active', 'suspended'))
  THEN
    RAISE EXCEPTION 'This status transition is not allowed';
  END IF;
  IF p_status = 'active' AND v_subscription.expires_at <= v_now THEN
    RAISE EXCEPTION 'An expired subscription cannot be restored';
  END IF;
  IF v_subscription.status IN ('refunded', 'rejected') THEN
    RAISE EXCEPTION 'This subscription cannot be changed from its current status';
  END IF;

  v_previous_status := v_subscription.status;
  UPDATE public.subscriptions
  SET status = p_status, updated_at = v_now
  WHERE id = v_subscription.id;

  INSERT INTO public.subscription_history (
    subscription_id, user_id, plan_id, actor_id, action, previous_status, new_status, notes
  )
  VALUES (
    v_subscription.id, v_subscription.user_id, v_subscription.plan_id, p_actor_id,
    CASE p_status WHEN 'suspended' THEN 'suspended' WHEN 'cancelled' THEN 'revoked' ELSE 'restored' END,
    v_previous_status, p_status, NULLIF(btrim(p_notes), '')
  );

  INSERT INTO public.admin_audit_logs (
    actor_id, action, entity_type, entity_id, previous_state, new_state, reason
  )
  VALUES (
    p_actor_id, 'subscription_status_changed', 'subscription', v_subscription.id,
    jsonb_build_object('status', v_previous_status),
    jsonb_build_object('status', p_status),
    NULLIF(btrim(p_notes), '')
  );

  RETURN jsonb_build_object('id', v_subscription.id, 'status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.set_subscription_status(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_subscription_status(UUID, UUID, TEXT, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.save_subscription_refund(
  p_refund_id UUID,
  p_subscription_id UUID,
  p_actor_id UUID,
  p_amount_minor INTEGER,
  p_status TEXT,
  p_refund_reference TEXT DEFAULT NULL,
  p_refund_date TIMESTAMPTZ DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_revoke_access BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_subscription public.subscriptions%ROWTYPE;
  v_payment public.payment_submissions%ROWTYPE;
  v_refund public.subscription_refunds%ROWTYPE;
  v_previous_status TEXT;
  v_subscription_status TEXT;
  v_total_refunded BIGINT;
  v_original_amount_minor INTEGER;
  v_reference TEXT := NULLIF(btrim(p_refund_reference), '');
  v_reason TEXT := NULLIF(btrim(p_reason), '');
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_actor_id IS NULL OR p_amount_minor IS NULL OR p_amount_minor <= 0
    OR p_status NOT IN ('pending', 'verified', 'rejected')
    OR v_reason IS NULL OR length(v_reason) > 1000
  THEN
    RAISE EXCEPTION 'Refund amount, status, and reason are required';
  END IF;
  IF p_status = 'verified' AND (v_reference IS NULL OR p_refund_date IS NULL OR p_refund_date > v_now) THEN
    RAISE EXCEPTION 'A verified refund requires its actual reference and refund date';
  END IF;
  IF v_reference IS NOT NULL AND length(v_reference) > 160 THEN
    RAISE EXCEPTION 'Refund reference is too long';
  END IF;

  IF p_refund_id IS NULL THEN
    SELECT * INTO v_subscription
    FROM public.subscriptions
    WHERE id = p_subscription_id
    FOR UPDATE;
  ELSE
    SELECT * INTO v_refund
    FROM public.subscription_refunds
    WHERE id = p_refund_id
    FOR UPDATE;
    IF NOT FOUND OR v_refund.status <> 'pending' THEN
      RAISE EXCEPTION 'Only a pending refund can be updated';
    END IF;
    IF v_refund.subscription_id IS DISTINCT FROM p_subscription_id THEN
      RAISE EXCEPTION 'Refund record does not belong to this subscription';
    END IF;
    SELECT * INTO v_subscription
    FROM public.subscriptions
    WHERE id = v_refund.subscription_id
    FOR UPDATE;
    p_subscription_id := v_refund.subscription_id;
  END IF;
  IF NOT FOUND OR v_subscription.id IS DISTINCT FROM p_subscription_id THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  SELECT * INTO v_payment
  FROM public.payment_submissions
  WHERE id = v_subscription.source_payment_submission_id
    AND status = 'approved'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The subscription has no verified payment to refund';
  END IF;
  v_original_amount_minor := COALESCE(v_payment.verified_amount_minor, v_payment.final_amount_minor);
  IF v_original_amount_minor IS NULL OR v_original_amount_minor <= 0
    OR p_amount_minor > v_original_amount_minor
  THEN
    RAISE EXCEPTION 'Refund amount exceeds the verified payment';
  END IF;

  IF v_reference IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(lower(v_reference), 0));
    IF EXISTS (
      SELECT 1
      FROM public.subscription_refunds sr
      WHERE lower(btrim(sr.refund_reference)) = lower(v_reference)
        AND sr.status <> 'rejected'
        AND sr.id IS DISTINCT FROM p_refund_id
    ) THEN
      RAISE EXCEPTION 'Refund reference has already been recorded';
    END IF;
  END IF;

  IF p_status = 'verified' THEN
    SELECT COALESCE(SUM(amount_minor), 0) INTO v_total_refunded
    FROM public.subscription_refunds
    WHERE payment_submission_id = v_payment.id
      AND status = 'verified'
      AND id IS DISTINCT FROM p_refund_id;
    IF v_total_refunded + p_amount_minor > v_original_amount_minor THEN
      RAISE EXCEPTION 'Verified refunds exceed the original payment';
    END IF;
  END IF;

  IF p_refund_id IS NULL THEN
    INSERT INTO public.subscription_refunds (
      subscription_id, payment_submission_id, user_id, amount_minor, status,
      refund_reference, refund_date, reason, revoke_access, admin_id
    )
    VALUES (
      v_subscription.id, v_payment.id, v_subscription.user_id, p_amount_minor, p_status,
      v_reference, CASE WHEN p_status = 'verified' THEN p_refund_date ELSE NULL END,
      v_reason, COALESCE(p_revoke_access, TRUE), p_actor_id
    )
    RETURNING * INTO v_refund;
  ELSE
    UPDATE public.subscription_refunds
    SET amount_minor = p_amount_minor,
        status = p_status,
        refund_reference = v_reference,
        refund_date = CASE WHEN p_status = 'verified' THEN p_refund_date ELSE NULL END,
        reason = v_reason,
        revoke_access = COALESCE(p_revoke_access, v_refund.revoke_access),
        admin_id = p_actor_id,
        updated_at = v_now
    WHERE id = p_refund_id
    RETURNING * INTO v_refund;
  END IF;

  v_previous_status := v_subscription.status;
  v_subscription_status := v_previous_status;
  IF p_status = 'verified' AND v_refund.revoke_access
    AND v_subscription.status <> 'refunded'
  THEN
    UPDATE public.subscriptions
    SET status = 'refunded', updated_at = v_now
    WHERE id = v_subscription.id;
    v_subscription_status := 'refunded';

    INSERT INTO public.subscription_history (
      subscription_id, user_id, plan_id, actor_id, action, previous_status, new_status, notes, metadata
    )
    VALUES (
      v_subscription.id, v_subscription.user_id, v_subscription.plan_id, p_actor_id,
      'refunded', v_previous_status, 'refunded', v_reason,
      jsonb_build_object('refund_id', v_refund.id, 'amount_minor', p_amount_minor)
    );
  END IF;

  INSERT INTO public.admin_audit_logs (
    actor_id, action, entity_type, entity_id, previous_state, new_state, reason
  )
  VALUES (
    p_actor_id, 'subscription_refund_' || p_status, 'subscription_refund', v_refund.id,
    jsonb_build_object('status', CASE WHEN p_refund_id IS NULL THEN NULL ELSE 'pending' END),
    jsonb_build_object(
      'status', p_status,
      'amount_minor', p_amount_minor,
      'refund_reference', v_reference,
      'refund_date', p_refund_date,
      'subscription_status', v_subscription_status,
      'revoke_access', v_refund.revoke_access
    ),
    v_reason
  );

  RETURN jsonb_build_object(
    'id', v_refund.id,
    'subscription_id', v_refund.subscription_id,
    'status', v_refund.status,
    'subscription_status', v_subscription_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_subscription_refund(UUID, UUID, UUID, INTEGER, TEXT, TEXT, TIMESTAMPTZ, TEXT, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_subscription_refund(UUID, UUID, UUID, INTEGER, TEXT, TEXT, TIMESTAMPTZ, TEXT, BOOLEAN)
  TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'xophal-expire-subscriptions') THEN
      PERFORM cron.unschedule('xophal-expire-subscriptions');
    END IF;
    PERFORM cron.schedule(
      'xophal-expire-subscriptions',
      '*/15 * * * *',
      'SELECT public.expire_subscriptions()'
    );
  END IF;
END;
$$;

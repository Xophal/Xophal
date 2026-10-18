-- Phase 2: payment and product access foundation.
-- This migration is intentionally additive and keeps the existing payment/subscription model intact.
-- It introduces a distinct product catalog, controlled payment submissions, school verification records,
-- and permission helpers for payment verification, subscription admin, and refund review.

INSERT INTO public.roles (code, name, description, is_system)
VALUES
  ('payment_verifier', 'Payment Verifier', 'Approves or rejects manual payment submissions for paid access.', true),
  ('subscription_admin', 'Subscription Admin', 'Manages subscription products, prices, and entitlement configuration.', true),
  ('refund_approver', 'Refund Approver', 'Approves or rejects refund decisions for payment issues.', true),
  ('school_eligibility_reviewer', 'School Eligibility Reviewer', 'Verifies school roster coverage and discount eligibility decisions.', true)
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.user_has_role_codes(role_codes text[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE p.id = auth.uid()
      AND p.is_active = true
      AND r.code = ANY (role_codes)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_payment_verifier()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
  SELECT public.user_has_role_codes(ARRAY['super_admin', 'admin', 'payment_verifier']);
$$;

CREATE OR REPLACE FUNCTION public.is_subscription_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
  SELECT public.user_has_role_codes(ARRAY['super_admin', 'admin', 'subscription_admin']);
$$;

CREATE OR REPLACE FUNCTION public.is_refund_approver()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
  SELECT public.user_has_role_codes(ARRAY['super_admin', 'admin', 'refund_approver']);
$$;

CREATE OR REPLACE FUNCTION public.is_school_eligibility_reviewer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
  SELECT public.user_has_role_codes(ARRAY['super_admin', 'admin', 'school_eligibility_reviewer']);
$$;

CREATE TABLE IF NOT EXISTS public.product_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(80) UNIQUE NOT NULL,
  product_type VARCHAR(32) NOT NULL CHECK (product_type IN ('free', 'class_9_monthly', 'class_10_season_pass')),
  board_code VARCHAR(32) NOT NULL DEFAULT 'seba',
  class_number SMALLINT NOT NULL CHECK (class_number IN (9, 10)),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price_paise INTEGER NOT NULL DEFAULT 0 CHECK (price_paise >= 0),
  early_bird_price_paise INTEGER CHECK (early_bird_price_paise IS NULL OR early_bird_price_paise >= 0),
  school_price_paise INTEGER CHECK (school_price_paise IS NULL OR school_price_paise >= 0),
  duration_days INTEGER CHECK (duration_days IS NULL OR duration_days > 0),
  validity_starts_at TIMESTAMPTZ,
  validity_ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_catalog_active_scope
  ON public.product_catalog (board_code, class_number, product_type, is_active, is_public);

CREATE TABLE IF NOT EXISTS public.school_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  board_code VARCHAR(32) NOT NULL DEFAULT 'seba',
  total_enrollment INTEGER NOT NULL DEFAULT 0 CHECK (total_enrollment >= 0),
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID REFERENCES public.profiles(id),
  verified_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.school_student_eligibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.school_records(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.product_catalog(id) ON DELETE SET NULL,
  is_eligible BOOLEAN NOT NULL DEFAULT false,
  coverage_ratio NUMERIC(5,2) CHECK (coverage_ratio >= 0 AND coverage_ratio <= 100),
  verified_by UUID REFERENCES public.profiles(id),
  verified_at TIMESTAMPTZ,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, student_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.product_catalog(id) ON DELETE SET NULL,
  school_id UUID REFERENCES public.school_records(id) ON DELETE SET NULL,
  payment_method VARCHAR(32) NOT NULL DEFAULT 'upi_manual' CHECK (payment_method IN ('upi_manual', 'bulk_school_payment', 'other')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  discount_minor INTEGER NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  final_amount_minor INTEGER NOT NULL CHECK (final_amount_minor >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  reference_code VARCHAR(255),
  evidence_url TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'approved', 'rejected', 'duplicate_flagged', 'cancelled')),
  reason TEXT,
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  duplicate_of UUID REFERENCES public.payment_submissions(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_submissions_user_status
  ON public.payment_submissions (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_product_status
  ON public.payment_submissions (product_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_reference
  ON public.payment_submissions (reference_code);

CREATE TABLE IF NOT EXISTS public.refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_submission_id UUID NOT NULL REFERENCES public.payment_submissions(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  requested_amount_minor INTEGER NOT NULL CHECK (requested_amount_minor >= 0),
  status VARCHAR(24) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id UUID,
  previous_state JSONB,
  new_state JSONB,
  reason TEXT,
  request_id VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_student_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_catalog_public_read
  ON public.product_catalog
  FOR SELECT
  USING (is_public = true AND is_active = true);

CREATE POLICY product_catalog_admin_write
  ON public.product_catalog
  FOR ALL
  USING (public.is_subscription_admin())
  WITH CHECK (public.is_subscription_admin());

CREATE POLICY school_records_select
  ON public.school_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.school_student_eligibility sse
      WHERE sse.school_id = school_records.id
        AND sse.student_id = auth.uid()
    )
    OR public.is_school_eligibility_reviewer()
    OR public.is_subscription_admin()
  );

CREATE POLICY school_records_admin_write
  ON public.school_records
  FOR ALL
  USING (public.is_school_eligibility_reviewer() OR public.is_subscription_admin())
  WITH CHECK (public.is_school_eligibility_reviewer() OR public.is_subscription_admin());

CREATE POLICY school_student_eligibility_select
  ON public.school_student_eligibility
  FOR SELECT
  USING (
    student_id = auth.uid()
    OR public.is_school_eligibility_reviewer()
    OR public.is_subscription_admin()
  );

CREATE POLICY school_student_eligibility_admin_write
  ON public.school_student_eligibility
  FOR ALL
  USING (public.is_school_eligibility_reviewer() OR public.is_subscription_admin())
  WITH CHECK (public.is_school_eligibility_reviewer() OR public.is_subscription_admin());

CREATE POLICY payment_submissions_owner_select
  ON public.payment_submissions
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_payment_verifier()
    OR public.is_subscription_admin()
    OR public.is_refund_approver()
  );

CREATE POLICY payment_submissions_owner_insert
  ON public.payment_submissions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY payment_submissions_admin_update
  ON public.payment_submissions
  FOR UPDATE
  USING (public.is_payment_verifier() OR public.is_subscription_admin())
  WITH CHECK (public.is_payment_verifier() OR public.is_subscription_admin());

CREATE POLICY refund_requests_owner_select
  ON public.refund_requests
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_refund_approver()
    OR public.is_subscription_admin()
  );

CREATE POLICY refund_requests_owner_insert
  ON public.refund_requests
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY refund_requests_admin_update
  ON public.refund_requests
  FOR UPDATE
  USING (public.is_refund_approver() OR public.is_subscription_admin())
  WITH CHECK (public.is_refund_approver() OR public.is_subscription_admin());

CREATE POLICY admin_audit_logs_admin_only
  ON public.admin_audit_logs
  FOR ALL
  USING (public.is_subscription_admin() OR public.is_payment_verifier() OR public.is_refund_approver() OR public.is_school_eligibility_reviewer())
  WITH CHECK (public.is_subscription_admin() OR public.is_payment_verifier() OR public.is_refund_approver() OR public.is_school_eligibility_reviewer());

CREATE INDEX IF NOT EXISTS idx_school_eligibility_student_reviewed
  ON public.school_student_eligibility (student_id, verified_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity
  ON public.admin_audit_logs (entity_type, entity_id, created_at DESC);

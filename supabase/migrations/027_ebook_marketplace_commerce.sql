-- Incremental eBook marketplace changes.
--
-- 026 was already applied to the hosted project with only the ebook_listings
-- schema. This migration is written to be safe on both an already-provisioned
-- database and a fresh database (every statement is idempotent). It never drops
-- business data.

-- ---------------------------------------------------------------------------
-- Listings: lifecycle timestamps + merchandising flag
-- ---------------------------------------------------------------------------
ALTER TABLE ebook_listings ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE ebook_listings ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE ebook_listings ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

UPDATE ebook_listings SET submitted_at = created_at WHERE submitted_at IS NULL;
UPDATE ebook_listings SET published_at = approved_at WHERE published_at IS NULL AND approved_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS ebook_listings_featured_idx
  ON ebook_listings(is_featured, published_at DESC) WHERE status = 'PUBLISHED';

-- Guarantee the moderation states the admin workflow writes are permitted. The
-- table is empty on every deployment of this migration, so this cannot reject
-- pre-existing rows.
ALTER TABLE ebook_listings DROP CONSTRAINT IF EXISTS ebook_listings_status_check;
ALTER TABLE ebook_listings ADD CONSTRAINT ebook_listings_status_check
  CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'SUSPENDED'));

-- ---------------------------------------------------------------------------
-- Settings: allow non-numeric values (pricing rules, currency lists, ranges)
-- ---------------------------------------------------------------------------
ALTER TABLE ebook_marketplace_settings ALTER COLUMN percentage DROP NOT NULL;
ALTER TABLE ebook_marketplace_settings ADD COLUMN IF NOT EXISTS setting_value JSONB;
ALTER TABLE ebook_marketplace_settings ADD COLUMN IF NOT EXISTS label TEXT;

INSERT INTO ebook_marketplace_settings (setting_key, setting_value, label) VALUES
  ('ebook_min_price', '0'::jsonb, 'Minimum listing price'),
  ('ebook_max_price', '100000'::jsonb, 'Maximum listing price'),
  ('ebook_allow_free', 'true'::jsonb, 'Allow free eBook listings'),
  ('ebook_allowed_currencies', '["INR"]'::jsonb, 'Allowed listing currencies'),
  ('ebook_payout_hold_days', '7'::jsonb, 'Refund/dispute hold period before payouts (days)'),
  ('ebook_suggested_price_ranges', '[
      {"label": "Short notes / small guides", "min": 29, "max": 59},
      {"label": "Basic exam preparation", "min": 59, "max": 99},
      {"label": "Standard study books", "min": 99, "max": 199},
      {"label": "Comprehensive preparation", "min": 199, "max": 399},
      {"label": "Premium / large books", "min": 399, "max": 699}
    ]'::jsonb, 'Suggested price ranges (guidance only)')
ON CONFLICT (setting_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Payouts (delayed payout model)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ebook_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'PAID', 'FAILED')),
  provider VARCHAR(40),
  provider_reference VARCHAR(160),
  transaction_count INT NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  note TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ebook_payouts_seller_idx ON ebook_payouts(seller_user_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- Orders: per-order deductions and lifecycle timestamps
-- ---------------------------------------------------------------------------
ALTER TABLE ebook_transactions ADD COLUMN IF NOT EXISTS order_number VARCHAR(40);
ALTER TABLE ebook_transactions ADD COLUMN IF NOT EXISTS order_status VARCHAR(24) NOT NULL DEFAULT 'CREATED';
ALTER TABLE ebook_transactions ADD COLUMN IF NOT EXISTS refund_status VARCHAR(16) NOT NULL DEFAULT 'NONE';
ALTER TABLE ebook_transactions ADD COLUMN IF NOT EXISTS payment_fee NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE ebook_transactions ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE ebook_transactions ADD COLUMN IF NOT EXISTS seller_net_amount NUMERIC(10,2);
ALTER TABLE ebook_transactions ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE ebook_transactions ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE ebook_transactions ADD COLUMN IF NOT EXISTS payout_id UUID REFERENCES ebook_payouts(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ebook_transactions_order_number_key
  ON ebook_transactions(order_number) WHERE order_number IS NOT NULL;

-- The marketplace ledger originally shipped without the payout lifecycle column
-- (and without the seller-facing order status strings), so add them here before
-- the constraints below reference them.
ALTER TABLE ebook_transactions ADD COLUMN IF NOT EXISTS payout_status VARCHAR(24) NOT NULL DEFAULT 'NOT_AVAILABLE';
ALTER TABLE ebook_transactions ALTER COLUMN payout_status SET DEFAULT 'NOT_AVAILABLE';
ALTER TABLE ebook_transactions ALTER COLUMN order_status SET DEFAULT 'CREATED';
ALTER TABLE ebook_transactions ALTER COLUMN refund_status SET DEFAULT 'NONE';

ALTER TABLE ebook_transactions DROP CONSTRAINT IF EXISTS ebook_transactions_payout_status_check;
ALTER TABLE ebook_transactions ADD CONSTRAINT ebook_transactions_payout_status_check
  CHECK (payout_status IN ('NOT_AVAILABLE', 'PENDING', 'AVAILABLE', 'PROCESSING', 'PAID', 'FAILED'));

ALTER TABLE ebook_transactions DROP CONSTRAINT IF EXISTS ebook_transactions_status_check;
ALTER TABLE ebook_transactions ADD CONSTRAINT ebook_transactions_status_check
  CHECK (status IN ('PENDING', 'VERIFIED', 'REFUNDED', 'FAILED'));

ALTER TABLE ebook_transactions DROP CONSTRAINT IF EXISTS ebook_transactions_order_status_check;
ALTER TABLE ebook_transactions ADD CONSTRAINT ebook_transactions_order_status_check
  CHECK (order_status IN ('CREATED', 'PAID', 'FULFILLED', 'REFUNDED', 'CANCELLED'));

ALTER TABLE ebook_transactions DROP CONSTRAINT IF EXISTS ebook_transactions_refund_status_check;
ALTER TABLE ebook_transactions ADD CONSTRAINT ebook_transactions_refund_status_check
  CHECK (refund_status IN ('NONE', 'REQUESTED', 'REFUNDED', 'DISPUTED'));

ALTER TABLE ebook_transactions DROP CONSTRAINT IF EXISTS ebook_transactions_seller_net_amount_check;
ALTER TABLE ebook_transactions ADD CONSTRAINT ebook_transactions_seller_net_amount_check
  CHECK (seller_net_amount IS NULL OR seller_net_amount >= 0);

UPDATE ebook_transactions
  SET order_number = 'XB-' || upper(substr(replace(id::text, '-', ''), 1, 12))
  WHERE order_number IS NULL;
UPDATE ebook_transactions SET order_status = 'PAID' WHERE status = 'VERIFIED' AND order_status = 'CREATED';
UPDATE ebook_transactions SET refund_status = 'REFUNDED' WHERE status = 'REFUNDED' AND refund_status = 'NONE';
UPDATE ebook_transactions SET payout_status = 'PENDING' WHERE status = 'VERIFIED' AND payout_status = 'NOT_AVAILABLE';
UPDATE ebook_transactions
  SET seller_net_amount = seller_amount
  WHERE seller_net_amount IS NULL AND seller_amount IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Row Level Security for payouts
-- ---------------------------------------------------------------------------
ALTER TABLE ebook_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ebook_payouts_owner_read ON ebook_payouts;
CREATE POLICY ebook_payouts_owner_read ON ebook_payouts
  FOR SELECT USING (seller_user_id = auth.uid() OR is_admin());

REVOKE INSERT, UPDATE, DELETE ON ebook_payouts FROM anon, authenticated;
GRANT SELECT ON ebook_payouts TO authenticated;

-- ---------------------------------------------------------------------------
-- Server-only reporting functions
-- ---------------------------------------------------------------------------

-- Seller earnings split across the delayed-payout lifecycle. Deductions are
-- reported separately so gross, commission, fees, tax and refunds are never
-- conflated into a single "net" figure.
CREATE OR REPLACE FUNCTION get_ebook_earnings_summary(p_user_id UUID)
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
    COUNT(*) FILTER (WHERE t.status = 'VERIFIED')::BIGINT,
    COALESCE(SUM(t.gross_amount) FILTER (WHERE t.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(SUM(t.commission_amount) FILTER (WHERE t.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(SUM(t.seller_amount) FILTER (WHERE t.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(SUM(t.payment_fee) FILTER (WHERE t.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(SUM(t.tax_amount) FILTER (WHERE t.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(SUM(t.gross_amount) FILTER (WHERE t.status = 'REFUNDED'), 0)::NUMERIC,
    COALESCE(SUM(t.seller_net_amount) FILTER (WHERE t.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(SUM(t.seller_net_amount) FILTER (WHERE t.status = 'VERIFIED' AND t.payout_status = 'PENDING'), 0)::NUMERIC,
    COALESCE(SUM(t.seller_net_amount) FILTER (WHERE t.status = 'VERIFIED' AND t.payout_status IN ('AVAILABLE', 'PROCESSING')), 0)::NUMERIC,
    COALESCE(SUM(t.seller_net_amount) FILTER (WHERE t.payout_status = 'PAID'), 0)::NUMERIC
  FROM ebook_transactions t
  WHERE t.seller_user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION get_ebook_earnings_summary(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_ebook_earnings_summary(UUID) TO service_role;

-- Whole-marketplace revenue for the admin dashboard, optionally date-filtered.
CREATE OR REPLACE FUNCTION get_ebook_admin_revenue(
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
    COUNT(*) FILTER (WHERE t.status = 'VERIFIED')::BIGINT,
    COALESCE(SUM(t.gross_amount) FILTER (WHERE t.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(SUM(t.commission_amount) FILTER (WHERE t.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(SUM(t.seller_amount) FILTER (WHERE t.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(SUM(t.payment_fee) FILTER (WHERE t.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(SUM(t.tax_amount) FILTER (WHERE t.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(SUM(t.gross_amount) FILTER (WHERE t.status = 'REFUNDED'), 0)::NUMERIC,
    COALESCE(SUM(t.commission_amount - t.payment_fee) FILTER (WHERE t.status = 'VERIFIED'), 0)::NUMERIC,
    COALESCE(AVG(t.gross_amount) FILTER (WHERE t.status = 'VERIFIED'), 0)::NUMERIC
  FROM ebook_transactions t
  WHERE (p_from IS NULL OR t.created_at >= p_from)
    AND (p_to IS NULL OR t.created_at < p_to);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION get_ebook_admin_revenue(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_ebook_admin_revenue(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

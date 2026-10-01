-- Secondary eBook marketplace. The original eBook file never lives in Xophol;
-- listings point at the seller's external fulfilment destination.
--
-- This migration is the single canonical marketplace schema. It is idempotent,
-- so it can be re-run safely, and it does not touch mock-test, auth, or payment
-- tables. Incremental changes live in 027.

CREATE TABLE IF NOT EXISTS ebook_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ebook_contributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  slug VARCHAR(180) NOT NULL UNIQUE,
  display_name VARCHAR(160) NOT NULL,
  bio TEXT,
  expertise TEXT[] NOT NULL DEFAULT '{}',
  profile_image_url TEXT,
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ebook_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contributor_id UUID REFERENCES ebook_contributors(id) ON DELETE SET NULL,
  category_id UUID NOT NULL REFERENCES ebook_categories(id) ON DELETE RESTRICT,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
  title VARCHAR(240) NOT NULL,
  slug VARCHAR(260) NOT NULL UNIQUE,
  cover_image_url TEXT NOT NULL,
  short_description VARCHAR(500) NOT NULL,
  full_description TEXT NOT NULL,
  subject VARCHAR(160),
  exam VARCHAR(160),
  language VARCHAR(80) NOT NULL,
  page_count INT CHECK (page_count IS NULL OR page_count > 0),
  price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  external_product_url TEXT NOT NULL,
  preview_url TEXT,
  author_name VARCHAR(160) NOT NULL,
  publication_date DATE,
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING_REVIEW'
    CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'SUSPENDED')),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  admin_review_note TEXT,
  rejection_reason TEXT,
  internal_moderation_reason TEXT,
  rights_confirmed BOOLEAN NOT NULL DEFAULT false,
  rights_confirmed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  view_count BIGINT NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  external_click_count BIGINT NOT NULL DEFAULT 0 CHECK (external_click_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ebook_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ebook_id UUID NOT NULL REFERENCES ebook_listings(id) ON DELETE CASCADE,
  reporter_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason VARCHAR(40) NOT NULL CHECK (reason IN ('copyright', 'misleading', 'broken_link', 'inappropriate', 'fraud', 'other')),
  details VARCHAR(2000) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED')),
  admin_note TEXT,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin-configurable marketplace settings. Numeric percentage values live in
-- `percentage`; any other shape (booleans, arrays, ranges) lives in `setting_value`.
CREATE TABLE IF NOT EXISTS ebook_marketplace_settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  percentage NUMERIC(5,2) CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100)),
  setting_value JSONB,
  label TEXT,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order ledger. A row may only reach status = 'VERIFIED' after a signed provider
-- callback confirms capture; the client can never mark an order paid itself.
CREATE TABLE IF NOT EXISTS ebook_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(40) UNIQUE,
  ebook_id UUID NOT NULL REFERENCES ebook_listings(id) ON DELETE RESTRICT,
  buyer_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  seller_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  provider VARCHAR(40),
  provider_order_id VARCHAR(160) UNIQUE,
  provider_transaction_id VARCHAR(160) UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REFUNDED', 'FAILED')),
  order_status VARCHAR(24) NOT NULL DEFAULT 'CREATED'
    CHECK (order_status IN ('CREATED', 'PAID', 'FULFILLED', 'REFUNDED', 'CANCELLED')),
  refund_status VARCHAR(16) NOT NULL DEFAULT 'NONE' CHECK (refund_status IN ('NONE', 'REQUESTED', 'REFUNDED', 'DISPUTED')),
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  gross_amount NUMERIC(10,2) NOT NULL CHECK (gross_amount >= 0),
  commission_percent NUMERIC(5,2) CHECK (commission_percent IS NULL OR (commission_percent >= 0 AND commission_percent <= 100)),
  commission_amount NUMERIC(10,2) CHECK (commission_amount IS NULL OR commission_amount >= 0),
  seller_amount NUMERIC(10,2) CHECK (seller_amount IS NULL OR seller_amount >= 0),
  payment_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (payment_fee >= 0),
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  seller_net_amount NUMERIC(10,2) CHECK (seller_net_amount IS NULL OR seller_net_amount >= 0),
  payout_status VARCHAR(24) NOT NULL DEFAULT 'NOT_AVAILABLE'
    CHECK (payout_status IN ('NOT_AVAILABLE', 'PENDING', 'AVAILABLE', 'PROCESSING', 'PAID', 'FAILED')),
  provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  verified_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status <> 'VERIFIED' OR (provider_transaction_id IS NOT NULL AND verified_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS ebook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name VARCHAR(40) NOT NULL CHECK (event_name IN (
    'ebook_view', 'ebook_search', 'ebook_listing_submit', 'ebook_approved',
    'ebook_rejected', 'ebook_external_click', 'ebook_purchase_started',
    'ebook_purchase_completed', 'mock_test_from_ebook', 'mock_test_started',
    'mock_test_completed', 'author_profile_view'
  )),
  ebook_id UUID REFERENCES ebook_listings(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  source VARCHAR(100),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ebook_listings_publication_idx ON ebook_listings(status, published_at DESC);
CREATE INDEX IF NOT EXISTS ebook_listings_user_idx ON ebook_listings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ebook_listings_category_idx ON ebook_listings(category_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS ebook_listings_subject_idx ON ebook_listings(subject_id, status);
CREATE INDEX IF NOT EXISTS ebook_listings_exam_idx ON ebook_listings(exam_id, status);
CREATE INDEX IF NOT EXISTS ebook_listings_title_trgm_idx ON ebook_listings USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ebook_listings_author_trgm_idx ON ebook_listings USING GIN (author_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ebook_reports_queue_idx ON ebook_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS ebook_transactions_verified_idx ON ebook_transactions(status, verified_at DESC);
CREATE INDEX IF NOT EXISTS ebook_transactions_seller_idx ON ebook_transactions(seller_user_id, status, verified_at DESC);
CREATE INDEX IF NOT EXISTS ebook_events_name_date_idx ON ebook_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS ebook_events_listing_date_idx ON ebook_events(ebook_id, created_at DESC);

INSERT INTO ebook_categories (name, slug, description, sort_order) VALUES
  ('Board Exams', 'board-exams', 'Study guides and revision resources for school board examinations.', 10),
  ('Competitive Exams', 'competitive-exams', 'Preparation books for competitive and entrance examinations.', 20),
  ('General Knowledge', 'general-knowledge', 'General knowledge, current affairs, and civic learning resources.', 30),
  ('Languages', 'languages', 'Language learning, literature, and reading resources.', 40),
  ('Science and Mathematics', 'science-mathematics', 'Science, mathematics, and problem-solving study resources.', 50)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ebook_marketplace_settings (setting_key, percentage, label)
VALUES ('marketplace_commission_percent', 20, 'Xophol commission on each sale (%)')
ON CONFLICT (setting_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE ebook_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebook_contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebook_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebook_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebook_marketplace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebook_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ebook_categories_public_read ON ebook_categories;
CREATE POLICY ebook_categories_public_read ON ebook_categories
  FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS ebook_categories_admin_all ON ebook_categories;
CREATE POLICY ebook_categories_admin_all ON ebook_categories
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS ebook_contributors_public_read ON ebook_contributors;
CREATE POLICY ebook_contributors_public_read ON ebook_contributors
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM ebook_listings l WHERE l.contributor_id = id AND l.status = 'PUBLISHED')
  );
DROP POLICY IF EXISTS ebook_contributors_owner_read ON ebook_contributors;
CREATE POLICY ebook_contributors_owner_read ON ebook_contributors
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS ebook_listings_public_read ON ebook_listings;
CREATE POLICY ebook_listings_public_read ON ebook_listings
  FOR SELECT USING (status = 'PUBLISHED');
DROP POLICY IF EXISTS ebook_listings_owner_read ON ebook_listings;
CREATE POLICY ebook_listings_owner_read ON ebook_listings
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS ebook_reports_admin_read ON ebook_reports;
CREATE POLICY ebook_reports_admin_read ON ebook_reports
  FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS ebook_reports_reporter_read ON ebook_reports;
CREATE POLICY ebook_reports_reporter_read ON ebook_reports
  FOR SELECT USING (reporter_user_id = auth.uid());

DROP POLICY IF EXISTS ebook_marketplace_settings_admin_all ON ebook_marketplace_settings;
CREATE POLICY ebook_marketplace_settings_admin_all ON ebook_marketplace_settings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS ebook_transactions_owner_read ON ebook_transactions;
CREATE POLICY ebook_transactions_owner_read ON ebook_transactions
  FOR SELECT USING (buyer_user_id = auth.uid() OR seller_user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS ebook_events_admin_read ON ebook_events;
CREATE POLICY ebook_events_admin_read ON ebook_events
  FOR SELECT USING (is_admin());

-- Every write is performed by validated server handlers using the service role.
-- Clients (anon / authenticated) may never approve listings, edit money, or
-- record a verified transaction.
REVOKE INSERT, UPDATE, DELETE ON ebook_categories, ebook_contributors, ebook_listings,
  ebook_reports, ebook_marketplace_settings, ebook_transactions, ebook_events
  FROM anon, authenticated;
GRANT SELECT ON ebook_categories, ebook_contributors, ebook_listings TO anon, authenticated;
GRANT SELECT ON ebook_marketplace_settings, ebook_transactions, ebook_reports TO authenticated;

-- ---------------------------------------------------------------------------
-- Server-only helper functions
-- ---------------------------------------------------------------------------

-- Records an outbound click and returns the seller's destination. Returns NULL
-- for anything that is not a published listing.
CREATE OR REPLACE FUNCTION record_ebook_external_click(p_ebook_id UUID)
RETURNS TEXT AS $$
DECLARE
  destination TEXT;
BEGIN
  UPDATE ebook_listings
  SET external_click_count = external_click_count + 1
  WHERE id = p_ebook_id AND status = 'PUBLISHED'
  RETURNING external_product_url INTO destination;

  IF destination IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO ebook_events (event_name, ebook_id, source)
  VALUES ('ebook_external_click', p_ebook_id, 'listing_redirect');

  RETURN destination;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION record_ebook_external_click(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_ebook_external_click(UUID) TO service_role;

-- Gross marketplace accounting for verified sales only. Per-order deductions
-- (payment fees, tax, refunds) are surfaced separately by 027.
CREATE OR REPLACE FUNCTION get_ebook_sales_summary(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  transaction_count BIGINT,
  gross_sales NUMERIC,
  xophol_commission NUMERIC,
  seller_earnings NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    COALESCE(SUM(t.gross_amount), 0)::NUMERIC,
    COALESCE(SUM(t.commission_amount), 0)::NUMERIC,
    COALESCE(SUM(t.seller_amount), 0)::NUMERIC
  FROM ebook_transactions t
  WHERE t.status = 'VERIFIED'
    AND (p_user_id IS NULL OR t.seller_user_id = p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION get_ebook_sales_summary(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_ebook_sales_summary(UUID) TO service_role;




\n
-- eBook admin moderation phase: NEEDS_CHANGES / UNPUBLISHED states, an immutable
-- moderation audit trail, DB-enforced status transitions, and moderation stats.
--
-- Idempotent and additive only: no data is deleted, no existing policy is
-- loosened. Payment/checkout tables are not touched.

-- ---------------------------------------------------------------------------
-- 1. Extended lifecycle statuses
-- ---------------------------------------------------------------------------
ALTER TABLE ebook_listings DROP CONSTRAINT IF EXISTS ebook_listings_status_check;
ALTER TABLE ebook_listings ADD CONSTRAINT ebook_listings_status_check
  CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'SUSPENDED', 'NEEDS_CHANGES', 'UNPUBLISHED'));

-- Seller-visible feedback written by Request Changes (cleared on resubmission).
ALTER TABLE ebook_listings ADD COLUMN IF NOT EXISTS seller_feedback TEXT;

-- Cover the moderation queue ordering and the new filter dimensions.
CREATE INDEX IF NOT EXISTS ebook_listings_queue_idx ON ebook_listings(status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS ebook_listings_language_idx ON ebook_listings(language, status);
CREATE INDEX IF NOT EXISTS ebook_listings_seller_idx ON ebook_listings(user_id, status);

-- ---------------------------------------------------------------------------
-- 2. Moderation history (audit trail) + admin-only notes
--    action values: APPROVED | REJECTED | CHANGES_REQUESTED | SUSPENDED |
--                   UNPUBLISHED | RESTORED | FEATURED | UNFEATURED |
--                   NOTE | SUBMITTED | RESUBMITTED
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ebook_moderation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ebook_id UUID NOT NULL REFERENCES ebook_listings(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  previous_status VARCHAR(24),
  new_status VARCHAR(24),
  action VARCHAR(32) NOT NULL,
  reason TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ebook_moderation_history_listing_idx
  ON ebook_moderation_history(ebook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ebook_moderation_history_admin_idx
  ON ebook_moderation_history(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ebook_moderation_history_action_idx
  ON ebook_moderation_history(action, created_at DESC);

ALTER TABLE ebook_moderation_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ebook_moderation_history_admin_read ON ebook_moderation_history;
CREATE POLICY ebook_moderation_history_admin_read ON ebook_moderation_history
  FOR SELECT USING (is_admin());

-- Sellers and anonymous clients must never read, write or tamper with the
-- audit trail. Writes only ever come from validated server handlers through
-- the service role.
REVOKE INSERT, UPDATE, DELETE ON ebook_moderation_history FROM anon, authenticated;
GRANT SELECT ON ebook_moderation_history TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. DB-enforced status transitions (defence in depth behind the API checks)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_ebook_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  allowed BOOLEAN := false;
BEGIN
  -- Non-status edits (metadata, counters) never trip the guard.
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT (OLD.status, NEW.status) IN (
    ('DRAFT',          'PENDING_REVIEW'),
    ('PENDING_REVIEW', 'PUBLISHED'),
    ('PENDING_REVIEW', 'REJECTED'),
    ('PENDING_REVIEW', 'NEEDS_CHANGES'),
    ('NEEDS_CHANGES',  'PENDING_REVIEW'),
    ('REJECTED',       'PENDING_REVIEW'),
    ('PUBLISHED',      'PENDING_REVIEW'),   -- seller edit re-enters review
    ('PUBLISHED',      'SUSPENDED'),
    ('PUBLISHED',      'UNPUBLISHED'),
    ('SUSPENDED',      'PUBLISHED'),        -- admin restore
    ('UNPUBLISHED',    'PUBLISHED')         -- admin restore
  ) INTO allowed;

  IF NOT allowed THEN
    RAISE EXCEPTION 'ebook status transition % -> % is not allowed', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ebook_listings_status_transition ON ebook_listings;
CREATE TRIGGER ebook_listings_status_transition
  BEFORE UPDATE OF status ON ebook_listings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_ebook_status_transition();

-- ---------------------------------------------------------------------------
-- 4. Analytics event names for the new moderation actions
-- ---------------------------------------------------------------------------
ALTER TABLE ebook_events DROP CONSTRAINT IF EXISTS ebook_events_event_name_check;
ALTER TABLE ebook_events ADD CONSTRAINT ebook_events_event_name_check
  CHECK (event_name IN (
    'ebook_view', 'ebook_search', 'ebook_listing_submit', 'ebook_approved',
    'ebook_rejected', 'ebook_external_click', 'ebook_purchase_started',
    'ebook_purchase_completed', 'mock_test_from_ebook', 'mock_test_started',
    'mock_test_completed', 'author_profile_view',
    'ebook_changes_requested', 'ebook_suspended', 'ebook_unpublished',
    'ebook_restored', 'ebook_reported'
  ));

-- ---------------------------------------------------------------------------
-- 5. Moderation statistics for the admin dashboard (real values only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_ebook_moderation_stats()
RETURNS TABLE (
  pending_count BIGINT,
  published_count BIGINT,
  rejected_count BIGINT,
  suspended_count BIGINT,
  unpublished_count BIGINT,
  needs_changes_count BIGINT,
  draft_count BIGINT,
  open_reports BIGINT,
  approved_total BIGINT,
  rejected_total BIGINT,
  changes_requested_total BIGINT,
  suspended_total BIGINT,
  avg_review_hours NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM ebook_listings WHERE status = 'PENDING_REVIEW'),
    (SELECT COUNT(*) FROM ebook_listings WHERE status = 'PUBLISHED'),
    (SELECT COUNT(*) FROM ebook_listings WHERE status = 'REJECTED'),
    (SELECT COUNT(*) FROM ebook_listings WHERE status = 'SUSPENDED'),
    (SELECT COUNT(*) FROM ebook_listings WHERE status = 'UNPUBLISHED'),
    (SELECT COUNT(*) FROM ebook_listings WHERE status = 'NEEDS_CHANGES'),
    (SELECT COUNT(*) FROM ebook_listings WHERE status = 'DRAFT'),
    (SELECT COUNT(*) FROM ebook_reports WHERE status = 'OPEN'),
    (SELECT COUNT(*) FROM ebook_moderation_history WHERE action = 'APPROVED'),
    (SELECT COUNT(*) FROM ebook_moderation_history WHERE action = 'REJECTED'),
    (SELECT COUNT(*) FROM ebook_moderation_history WHERE action = 'CHANGES_REQUESTED'),
    (SELECT COUNT(*) FROM ebook_moderation_history WHERE action = 'SUSPENDED'),
    (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (h.created_at - l.submitted_at)) / 3600), 0)
       FROM ebook_moderation_history h
       JOIN ebook_listings l ON l.id = h.ebook_id
      WHERE h.action = 'APPROVED'
        AND l.submitted_at IS NOT NULL
        AND h.created_at >= l.submitted_at);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION get_ebook_moderation_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_ebook_moderation_stats() TO service_role;

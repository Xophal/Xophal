CREATE TABLE IF NOT EXISTS public.ebook_mock_test_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ebook_id UUID NOT NULL REFERENCES public.ebook_listings(id) ON DELETE CASCADE,
  mock_test_id UUID NOT NULL REFERENCES public.mock_tests(id) ON DELETE CASCADE,
  relation_type VARCHAR(16) NOT NULL DEFAULT 'RELATED'
    CHECK (relation_type IN ('RELATED', 'RECOMMENDED', 'PRIMARY', 'EXCLUDED')),
  priority INTEGER NOT NULL DEFAULT 100,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ebook_id, mock_test_id)
);

CREATE INDEX IF NOT EXISTS ebook_mock_test_relations_ebook_idx
  ON public.ebook_mock_test_relations (ebook_id, relation_type, priority, created_at);
CREATE INDEX IF NOT EXISTS ebook_mock_test_relations_test_idx
  ON public.ebook_mock_test_relations (mock_test_id, relation_type, priority, created_at);

ALTER TABLE public.ebook_mock_test_relations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ebook_mock_test_relations_admin_read ON public.ebook_mock_test_relations;
CREATE POLICY ebook_mock_test_relations_admin_read ON public.ebook_mock_test_relations
  FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS ebook_mock_test_relations_admin_write ON public.ebook_mock_test_relations;
CREATE POLICY ebook_mock_test_relations_admin_write ON public.ebook_mock_test_relations
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

REVOKE ALL ON public.ebook_mock_test_relations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ebook_mock_test_relations TO authenticated;
GRANT ALL ON public.ebook_mock_test_relations TO service_role;

ALTER TABLE public.ebook_events
  ADD COLUMN IF NOT EXISTS mock_test_id UUID REFERENCES public.mock_tests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attempt_id UUID REFERENCES public.test_attempts(id) ON DELETE SET NULL;

ALTER TABLE public.ebook_events
  DROP CONSTRAINT IF EXISTS ebook_events_event_name_check;
ALTER TABLE public.ebook_events
  ADD CONSTRAINT ebook_events_event_name_check CHECK (event_name IN (
    'ebook_view', 'ebook_page_view', 'ebook_search', 'ebook_filter_used',
    'ebook_category_view', 'ebook_author_view', 'ebook_share', 'ebook_share_clicked',
    'ebook_listing_submit', 'ebook_approved', 'ebook_rejected', 'ebook_external_click',
    'ebook_purchase_started', 'ebook_purchase_completed', 'ebook_from_mock_test',
    'mock_test_from_ebook', 'mock_test_view', 'mock_test_started', 'mock_test_completed',
    'ebook_mock_test_impression', 'ebook_mock_test_click', 'ebook_mock_test_started',
    'ebook_mock_test_completed', 'mock_test_ebook_impression', 'mock_test_ebook_click',
    'mock_test_ebook_external_click', 'author_profile_view', 'seller_profile_view',
    'ebook_created', 'ebook_submitted', 'ebook_resubmitted', 'ebook_changes_requested',
    'ebook_suspended', 'ebook_unpublished', 'ebook_restored', 'ebook_reported'
  ));

CREATE INDEX IF NOT EXISTS ebook_events_test_user_idx
  ON public.ebook_events (mock_test_id, user_id, event_name, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_learning_discovery_metrics(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  ebook_viewers BIGINT,
  ebook_to_mock_test_users BIGINT,
  ebook_to_mock_test_conversion NUMERIC,
  mock_test_users BIGINT,
  mock_test_to_ebook_users BIGINT,
  mock_test_to_ebook_discovery NUMERIC
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH scoped AS (
    SELECT event_name, ebook_id, mock_test_id, user_id, created_at
    FROM public.ebook_events
    WHERE user_id IS NOT NULL
      AND (p_from IS NULL OR created_at >= p_from)
      AND (p_to IS NULL OR created_at < p_to)
  ),
  ebook_viewers AS (
    SELECT user_id, MIN(created_at) AS viewed_at
    FROM scoped
    WHERE event_name = 'ebook_page_view'
    GROUP BY user_id
  ),
  ebook_converted AS (
    SELECT DISTINCT events.user_id
    FROM scoped AS events
    JOIN ebook_viewers AS viewers ON viewers.user_id = events.user_id
    WHERE events.event_name = 'ebook_mock_test_started'
    AND events.created_at >= viewers.viewed_at
  ),
  mock_test_users AS (
    SELECT user_id, MIN(created_at) AS viewed_at
    FROM scoped
    WHERE event_name = 'mock_test_view'
    GROUP BY user_id
  ),
  mock_test_discovered AS (
    SELECT DISTINCT events.user_id
    FROM scoped AS events
    JOIN mock_test_users AS viewers ON viewers.user_id = events.user_id
    WHERE events.event_name = 'ebook_from_mock_test'
    AND events.created_at >= viewers.viewed_at
  )
  SELECT
    (SELECT COUNT(*) FROM ebook_viewers),
    (SELECT COUNT(*) FROM ebook_converted),
    COALESCE(
      (SELECT COUNT(*)::NUMERIC FROM ebook_converted) * 100 /
      NULLIF((SELECT COUNT(*)::NUMERIC FROM ebook_viewers), 0),
      0
    ),
    (SELECT COUNT(*) FROM mock_test_users),
    (SELECT COUNT(*) FROM mock_test_discovered),
    COALESCE(
      (SELECT COUNT(*)::NUMERIC FROM mock_test_discovered) * 100 /
      NULLIF((SELECT COUNT(*)::NUMERIC FROM mock_test_users), 0),
      0
    );
$$;

REVOKE ALL ON FUNCTION public.get_learning_discovery_metrics(TIMESTAMPTZ, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_learning_discovery_metrics(TIMESTAMPTZ, TIMESTAMPTZ)
  TO service_role;

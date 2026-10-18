-- Notification read and dismissal state for global broadcasts is per user.
ALTER TABLE public.notification_receipts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Authenticated users may read and dismiss their own notifications, but must
-- not be able to change notification content, recipients, or broadcast scope.
REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON TABLE public.notifications TO authenticated;
GRANT UPDATE (is_read) ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;

CREATE OR REPLACE FUNCTION public.get_user_notifications(p_page INTEGER DEFAULT 1, p_limit INTEGER DEFAULT 20)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_page INTEGER := GREATEST(COALESCE(p_page, 1), 1);
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_user_id AND p.is_active = true
  ) THEN
    RAISE EXCEPTION 'Active account required';
  END IF;

  WITH visible AS (
    SELECT
      n.id,
      n.title,
      n.message,
      n.type,
      n.link_url,
      CASE WHEN n.is_global THEN COALESCE(r.is_read, false) ELSE n.is_read END AS is_read,
      n.is_global,
      n.created_at,
      COALESCE(r.is_dismissed, false) AS is_dismissed
    FROM public.notifications n
    LEFT JOIN public.notification_receipts r
      ON r.notification_id = n.id AND r.user_id = v_user_id
    WHERE (n.user_id = v_user_id AND n.is_global = false)
       OR (n.is_global = true AND n.user_id IS NULL)
  ), active AS (
    SELECT * FROM visible WHERE is_dismissed = false
  ), totals AS (
    SELECT
      COUNT(*)::INTEGER AS total,
      COUNT(*) FILTER (WHERE is_read = false)::INTEGER AS unread
    FROM active
  ), page_rows AS (
    SELECT id, title, message, type, link_url, is_read, is_global, created_at
    FROM active
    ORDER BY created_at DESC, id DESC
    LIMIT v_limit
    OFFSET (v_page::BIGINT - 1) * v_limit
  )
  SELECT jsonb_build_object(
    'items', COALESCE(
      (SELECT jsonb_agg(to_jsonb(page_rows) ORDER BY created_at DESC, id DESC) FROM page_rows),
      '[]'::JSONB
    ),
    'total', totals.total,
    'unread', totals.unread
  )
  INTO v_result
  FROM totals;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_notifications(INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_notifications(INTEGER, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_all_user_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_updated INTEGER := 0;
  v_receipts INTEGER := 0;
BEGIN
  IF v_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_user_id AND p.is_active = true
  ) THEN
    RAISE EXCEPTION 'Active authentication required';
  END IF;

  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = v_user_id AND is_global = false AND is_read = false;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  INSERT INTO public.notification_receipts (notification_id, user_id, is_read)
  SELECT n.id, v_user_id, true
  FROM public.notifications n
  WHERE n.is_global = true AND n.user_id IS NULL
  ON CONFLICT (notification_id, user_id)
  DO UPDATE SET is_read = true, updated_at = NOW()
  WHERE public.notification_receipts.is_read = false;
  GET DIAGNOSTICS v_receipts = ROW_COUNT;

  RETURN v_updated + v_receipts;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_all_user_notifications_read() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_all_user_notifications_read() TO authenticated;

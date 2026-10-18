-- Access grants are created by trusted server-side payment verification only.
ALTER TABLE public.test_access_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.test_access_grants FROM PUBLIC, anon, authenticated;

-- Deactivated accounts must not retain premium-content access through RLS.
CREATE OR REPLACE FUNCTION public.is_premium_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    JOIN public.profiles p ON p.id = s.user_id
    WHERE s.user_id = auth.uid()
      AND p.is_active = true
      AND s.status = 'active'
      AND s.starts_at <= NOW()
      AND s.expires_at > NOW()
  );
$$;

-- Student leaderboard entries contain profile-linked learning statistics.
-- Students may read their own entry; admins retain access through the existing
-- leaderboard_admin_write policy. Anonymous clients must not read entries.
DROP POLICY IF EXISTS leaderboard_public_read ON public.leaderboard_entries;

CREATE POLICY leaderboard_owner_read
  ON public.leaderboard_entries
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE SELECT ON public.leaderboard_entries FROM PUBLIC, anon;
GRANT SELECT ON public.leaderboard_entries TO authenticated;
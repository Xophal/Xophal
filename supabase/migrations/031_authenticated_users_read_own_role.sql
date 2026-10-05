-- Auth and route guards join profiles to roles to resolve the current user's
-- role. Keep role metadata private to each account while allowing that join.
GRANT SELECT ON TABLE public.roles TO authenticated;

DROP POLICY IF EXISTS roles_authenticated_read_own ON public.roles;
CREATE POLICY roles_authenticated_read_own
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT profile.role_id
      FROM public.profiles AS profile
      WHERE profile.id = (SELECT auth.uid())
    )
  );
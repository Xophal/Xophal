CREATE TABLE IF NOT EXISTS public.user_role_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'EMAIL_FAILED')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS user_role_invitations_one_pending_per_user
  ON public.user_role_invitations (user_id)
  WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS user_role_invitations_user_created_idx
  ON public.user_role_invitations (user_id, created_at DESC);

ALTER TABLE public.user_role_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_role_invitations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.user_role_invitations TO service_role;

CREATE OR REPLACE FUNCTION public.respond_to_user_role_invitation(
  p_token_hash TEXT,
  p_decision TEXT
)
RETURNS TABLE(result TEXT, role_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  invitation public.user_role_invitations%ROWTYPE;
  requested_role public.roles%ROWTYPE;
BEGIN
  IF p_decision NOT IN ('ACCEPT', 'REJECT') THEN
    RAISE EXCEPTION 'Invalid invitation decision';
  END IF;

  SELECT * INTO invitation
  FROM public.user_role_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  IF invitation.status <> 'PENDING' THEN
    RETURN QUERY SELECT invitation.status::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  IF invitation.expires_at <= NOW() THEN
    UPDATE public.user_role_invitations
    SET status = 'EXPIRED'
    WHERE id = invitation.id;
    RETURN QUERY SELECT 'EXPIRED'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles profile
    WHERE profile.id = invitation.user_id
      AND LOWER(BTRIM(profile.email)) = LOWER(BTRIM(invitation.email))
  ) THEN
    UPDATE public.user_role_invitations
    SET status = 'CANCELLED', responded_at = NOW()
    WHERE id = invitation.id;
    RETURN QUERY SELECT 'EMAIL_CHANGED'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  IF p_decision = 'ACCEPT' THEN
    SELECT * INTO requested_role
    FROM public.roles
    WHERE id = invitation.requested_role_id;

    IF NOT FOUND OR requested_role.code = 'super_admin' THEN
      RAISE EXCEPTION 'The requested role is unavailable';
    END IF;

    UPDATE public.profiles
    SET role_id = invitation.requested_role_id
    WHERE id = invitation.user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The user account is no longer available';
    END IF;

    UPDATE public.user_role_invitations
    SET status = 'ACCEPTED', responded_at = NOW()
    WHERE id = invitation.id;

    RETURN QUERY SELECT 'ACCEPTED'::TEXT, requested_role.name;
    RETURN;
  END IF;

  UPDATE public.user_role_invitations
  SET status = 'REJECTED', responded_at = NOW()
  WHERE id = invitation.id;
  RETURN QUERY SELECT 'REJECTED'::TEXT, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_user_role_invitation(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_user_role_invitation(TEXT, TEXT) TO service_role;

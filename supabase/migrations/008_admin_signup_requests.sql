-- Admin signup approval workflow. Main-admin identity is configured by
-- MAIN_ADMIN_EMAILS; pending requests never receive an admin role directly.
CREATE TABLE IF NOT EXISTS admin_signup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  requested_role VARCHAR(50) NOT NULL DEFAULT 'admin',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS admin_signup_requests_status_idx ON admin_signup_requests(status, created_at DESC);

ALTER TABLE admin_signup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages admin signup requests"
  ON admin_signup_requests FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
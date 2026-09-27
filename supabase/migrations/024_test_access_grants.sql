CREATE TABLE IF NOT EXISTS test_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mock_test_id UUID NOT NULL REFERENCES mock_tests(id) ON DELETE CASCADE,
  source VARCHAR(50) NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, mock_test_id)
);

CREATE INDEX IF NOT EXISTS idx_test_access_grants_user_test
  ON test_access_grants(user_id, mock_test_id);
ALTER TABLE mock_tests
  ADD COLUMN IF NOT EXISTS access_price NUMERIC(10,2) NOT NULL DEFAULT 0
  CHECK (access_price >= 0);
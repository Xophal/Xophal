CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  format VARCHAR(10) NOT NULL CHECK (format IN ('CSV', 'XLSX', 'JSON')),
  status VARCHAR(20) NOT NULL DEFAULT 'VALIDATED' CHECK (status IN ('VALIDATED', 'IMPORTING', 'COMPLETED', 'FAILED')),
  filename VARCHAR(500) NOT NULL,
  file_path TEXT,
  total_rows INT NOT NULL DEFAULT 0,
  valid_rows INT NOT NULL DEFAULT 0,
  invalid_rows INT NOT NULL DEFAULT 0,
  imported_rows INT NOT NULL DEFAULT 0,
  skipped_rows INT NOT NULL DEFAULT 0,
  validation_report JSONB NOT NULL DEFAULT '{}',
  preview_data JSONB NOT NULL DEFAULT '[]',
  options JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS import_jobs_user_created_idx ON import_jobs(user_id, created_at DESC);
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY import_jobs_owner_read ON import_jobs FOR SELECT USING (user_id = auth.uid() OR is_admin());
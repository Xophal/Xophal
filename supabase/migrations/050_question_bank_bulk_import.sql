-- ============================================================================
-- Migration 050: Question Bank & Bulk Import System
-- Additive changes only; no destructive operations.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. IMPORT BATCHES: track every bulk import job with full auditability
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  filename VARCHAR(500) NOT NULL,
  format VARCHAR(10) NOT NULL CHECK (format IN ('CSV', 'XLSX')),
  entity_type VARCHAR(50) NOT NULL DEFAULT 'questions',
  board_id UUID REFERENCES boards(id) ON DELETE SET NULL,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validating', 'validated', 'importing', 'completed', 'failed', 'cancelled')),
  total_rows INT NOT NULL DEFAULT 0,
  valid_rows INT NOT NULL DEFAULT 0,
  invalid_rows INT NOT NULL DEFAULT 0,
  imported_rows INT NOT NULL DEFAULT 0,
  skipped_rows INT NOT NULL DEFAULT 0,
  duplicate_rows INT NOT NULL DEFAULT 0,
  validation_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  preview_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  import_options JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_batches_user_created ON import_batches(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_batches_status ON import_batches(status);
CREATE INDEX IF NOT EXISTS idx_import_batches_entity ON import_batches(entity_type);

-- ----------------------------------------------------------------------------
-- 2. QUESTIONS: add import_batch_id for traceability
-- ----------------------------------------------------------------------------
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_questions_import_batch ON questions(import_batch_id) WHERE import_batch_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. QUESTION_VERSIONS: immutable snapshots for edit history & test protection
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS question_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  version_number INT NOT NULL DEFAULT 1,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_question_versions_question_version
  ON question_versions(question_id, version_number);
CREATE INDEX IF NOT EXISTS idx_question_versions_question_id
  ON question_versions(question_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. QUESTION_DUPLICATES: detected duplicate candidates
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS question_duplicates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL DEFAULT 'questions',
  source_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  similarity_score NUMERIC(5,4) NOT NULL DEFAULT 0,
  match_reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved_skip', 'resolved_import', 'resolved_update', 'dismissed')),
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_question_duplicates_pair
  ON question_duplicates(source_id, target_id);
CREATE INDEX IF NOT EXISTS idx_question_duplicates_status ON question_duplicates(status);
CREATE INDEX IF NOT EXISTS idx_question_duplicates_import_batch ON question_duplicates(import_batch_id);

-- ----------------------------------------------------------------------------
-- 5. INDEXES for question bank filtering & search (per Phase 8 requirements)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_questions_board_class_subject ON questions(subject_id, chapter_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_status_created ON questions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_engine_status_created ON questions(engine_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_engine_type ON questions(engine_type);
CREATE INDEX IF NOT EXISTS idx_questions_lang ON questions(lang);
CREATE INDEX IF NOT EXISTS idx_questions_source ON questions(source);

-- Full-text search index (complements existing GIN index)
CREATE INDEX IF NOT EXISTS idx_questions_search_gin
  ON questions USING gin(to_tsvector('english', coalesce(question_text, '') || ' ' || coalesce(stem, '')));

-- ----------------------------------------------------------------------------
-- 6. UPDATED_AT TRIGGERS for new tables
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS tr_import_batches_updated_at ON import_batches;
CREATE TRIGGER tr_import_batches_updated_at
  BEFORE UPDATE ON import_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_question_duplicates_updated_at ON question_duplicates;
CREATE TRIGGER tr_question_duplicates_updated_at
  BEFORE UPDATE ON question_duplicates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
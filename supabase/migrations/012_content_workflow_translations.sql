-- Complete the question content model with workflow states and translations.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_content_status') THEN
    CREATE TYPE question_content_status AS ENUM ('draft', 'review', 'approved', 'published', 'rejected', 'archived');
  END IF;
END $$;

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS status question_content_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

ALTER TABLE questions
  ADD CONSTRAINT questions_marks_non_negative CHECK (marks >= 0),
  ADD CONSTRAINT questions_negative_marks_non_negative CHECK (negative_marks >= 0),
  ADD CONSTRAINT questions_time_seconds_positive CHECK (time_seconds > 0);

CREATE TABLE IF NOT EXISTS question_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  language_id UUID NOT NULL REFERENCES languages(id) ON DELETE RESTRICT,
  question_text TEXT NOT NULL,
  question_html TEXT,
  explanation TEXT,
  explanation_html TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(question_id, language_id)
);

CREATE TABLE IF NOT EXISTS question_option_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id UUID NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
  language_id UUID NOT NULL REFERENCES languages(id) ON DELETE RESTRICT,
  option_text TEXT NOT NULL,
  option_html TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(option_id, language_id)
);

CREATE INDEX IF NOT EXISTS questions_status_idx ON questions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS questions_language_idx ON questions(language_id);
CREATE INDEX IF NOT EXISTS question_translations_question_language_idx ON question_translations(question_id, language_id);
CREATE INDEX IF NOT EXISTS question_option_translations_option_language_idx ON question_option_translations(option_id, language_id);

ALTER TABLE question_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_option_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY question_translations_admin_only ON question_translations
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY question_option_translations_admin_only ON question_option_translations
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE OR REPLACE FUNCTION update_question_translation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_question_translations_updated_at ON question_translations;
CREATE TRIGGER tr_question_translations_updated_at
  BEFORE UPDATE ON question_translations
  FOR EACH ROW EXECUTE FUNCTION update_question_translation_updated_at();

DROP TRIGGER IF EXISTS tr_question_option_translations_updated_at ON question_option_translations;
CREATE TRIGGER tr_question_option_translations_updated_at
  BEFORE UPDATE ON question_option_translations
  FOR EACH ROW EXECUTE FUNCTION update_question_translation_updated_at();

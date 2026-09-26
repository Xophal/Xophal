-- ============================================================================
-- Migration: 013_mock_test_engine.sql
-- Description: Core Schema for Mock-Test Engine
-- Non-negotiable principles:
--   1. Blueprint-driven engine
--   2. Frozen test instances
--   3. Server-side timer & deadline
--   4. Answer security: answers/explanations exposed only after submission
--   5. Granular RLS for student, admin, reviewer
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ----------------------------------------------------------------------------
-- 1. TAXONOMY: SUBTOPICS & HIERARCHY EXTENSION
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subtopics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(300) NOT NULL,
  slug VARCHAR(300) NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_subtopics_topic_slug UNIQUE (topic_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_subtopics_topic ON subtopics(topic_id);
CREATE INDEX IF NOT EXISTS idx_subtopics_slug ON subtopics(slug);

-- ----------------------------------------------------------------------------
-- 2. QUESTION BANK ENUMS & EXTENDED COLUMNS ON QUESTIONS
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engine_question_type') THEN
    CREATE TYPE engine_question_type AS ENUM (
      'mcq',
      'assertion_reason',
      'match',
      'statement',
      'case_based',
      'fill_blank',
      'equation',
      'short',
      'long'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engine_skill') THEN
    CREATE TYPE engine_skill AS ENUM ('recall', 'application', 'reasoning');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engine_board_pattern') THEN
    CREATE TYPE engine_board_pattern AS ENUM ('CBSE', 'SEBA', 'OTHER');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engine_question_status') THEN
    CREATE TYPE engine_question_status AS ENUM ('draft', 'reviewed', 'published', 'retired');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engine_question_source') THEN
    CREATE TYPE engine_question_source AS ENUM ('manual', 'ai', 'import');
  END IF;
END $$;

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS engine_type engine_question_type DEFAULT 'mcq',
  ADD COLUMN IF NOT EXISTS stem TEXT,
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS subtopic_id UUID REFERENCES subtopics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS difficulty INT CHECK (difficulty BETWEEN 1 AND 3) DEFAULT 2,
  ADD COLUMN IF NOT EXISTS skill engine_skill DEFAULT 'recall',
  ADD COLUMN IF NOT EXISTS neg_marks NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS est_time_sec INT DEFAULT 60,
  ADD COLUMN IF NOT EXISTS board_pattern engine_board_pattern DEFAULT 'CBSE',
  ADD COLUMN IF NOT EXISTS pyq_year INT,
  ADD COLUMN IF NOT EXISTS lang VARCHAR(10) DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS engine_status engine_question_status DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS source engine_question_source DEFAULT 'manual';

UPDATE questions SET stem = question_text WHERE stem IS NULL AND question_text IS NOT NULL;

ALTER TABLE question_options
  ADD COLUMN IF NOT EXISTS label VARCHAR(10),
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS position INT DEFAULT 0;

UPDATE question_options SET body = option_text WHERE body IS NULL AND option_text IS NOT NULL;
UPDATE question_options SET position = sort_order WHERE position = 0 AND sort_order IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. QUESTION ANSWERS & RUBRICS (STRICT SEPARATION FOR SECURITY)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS question_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  rubric_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_question_answers_qid UNIQUE (question_id)
);

CREATE INDEX IF NOT EXISTS idx_question_answers_qid ON question_answers(question_id);

-- ----------------------------------------------------------------------------
-- 4. QUESTION TAGS & QUESTION STATS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS question_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  tag VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_question_tags UNIQUE (question_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_question_tags_tag ON question_tags(tag);
CREATE INDEX IF NOT EXISTS idx_question_tags_qid ON question_tags(question_id);

CREATE TABLE IF NOT EXISTS question_stats (
  question_id UUID PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  attempts INT NOT NULL DEFAULT 0,
  correct_count INT NOT NULL DEFAULT 0,
  correct_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  avg_time INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. BLUEPRINTS & BLUEPRINT SECTIONS
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blueprint_kind') THEN
    CREATE TYPE blueprint_kind AS ENUM (
      'topic',
      'full_chapter',
      'board_pattern',
      'adaptive',
      'weak_area',
      'daily',
      'diagnostic',
      'speed',
      'custom'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(300) NOT NULL,
  slug VARCHAR(300) UNIQUE NOT NULL,
  description TEXT,
  kind blueprint_kind NOT NULL DEFAULT 'topic',
  duration_sec INT NOT NULL DEFAULT 1800,
  total_marks NUMERIC(8,2) NOT NULL DEFAULT 25,
  marking_scheme_json JSONB NOT NULL DEFAULT '{ "default_marks": 1, "default_neg_marks": 0 }'::jsonb,
  shuffle_questions BOOLEAN NOT NULL DEFAULT true,
  shuffle_options BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT true,
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blueprints_kind ON blueprints(kind);
CREATE INDEX IF NOT EXISTS idx_blueprints_slug ON blueprints(slug);
CREATE INDEX IF NOT EXISTS idx_blueprints_chapter ON blueprints(chapter_id);

CREATE TABLE IF NOT EXISTS blueprint_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  filter_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  count INT NOT NULL DEFAULT 5,
  marks_per_q NUMERIC(5,2) NOT NULL DEFAULT 1,
  neg_marks NUMERIC(5,2) NOT NULL DEFAULT 0,
  instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blueprint_sections_bp ON blueprint_sections(blueprint_id, position);

-- ----------------------------------------------------------------------------
-- 6. TESTS AND ATTEMPTS (FROZEN INSTANCES & SERVER TIMERS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seed VARCHAR(64) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_test_instances_user ON test_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_test_instances_bp ON test_instances(blueprint_id);

CREATE TABLE IF NOT EXISTS test_instance_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES test_instances(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  section_id UUID REFERENCES blueprint_sections(id) ON DELETE SET NULL,
  position INT NOT NULL DEFAULT 0,
  marks NUMERIC(5,2) NOT NULL DEFAULT 1,
  neg_marks NUMERIC(5,2) NOT NULL DEFAULT 0,
  CONSTRAINT uq_instance_question UNIQUE (instance_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_instance_questions_order ON test_instance_questions(instance_id, position);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engine_attempt_status') THEN
    CREATE TYPE engine_attempt_status AS ENUM ('in_progress', 'submitted', 'expired', 'graded');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engine_grader_type') THEN
    CREATE TYPE engine_grader_type AS ENUM ('auto', 'ai', 'human');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES test_instances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status engine_attempt_status NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  score NUMERIC(8,2) DEFAULT NULL,
  max_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  time_spent_sec INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attempts_user_status ON attempts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_attempts_deadline ON attempts(status, deadline_at);
CREATE INDEX IF NOT EXISTS idx_attempts_instance ON attempts(instance_id);

CREATE TABLE IF NOT EXISTS attempt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  response_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_correct BOOLEAN DEFAULT NULL,
  marks_awarded NUMERIC(5,2) DEFAULT NULL,
  time_spent_sec INT NOT NULL DEFAULT 0,
  flagged BOOLEAN NOT NULL DEFAULT false,
  visit_count INT NOT NULL DEFAULT 1,
  graded_by engine_grader_type DEFAULT 'auto',
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_attempt_answer UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt ON attempt_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_question ON attempt_answers(question_id);

-- ----------------------------------------------------------------------------
-- 7. ANALYTICS: TOPIC MASTERY & STREAKS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS topic_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  attempted INT NOT NULL DEFAULT 0,
  correct INT NOT NULL DEFAULT 0,
  mastery_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_topic_mastery UNIQUE (user_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_mastery_user ON topic_mastery(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_mastery_topic ON topic_mastery(topic_id);

CREATE TABLE IF NOT EXISTS streaks (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  last_activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE subtopics ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprint_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_instance_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;

-- Helper check if user is reviewer or admin
CREATE OR REPLACE FUNCTION is_reviewer_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.code IN ('super_admin', 'admin', 'content_manager', 'reviewer', 'author')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Taxonomy RLS
CREATE POLICY subtopics_public_read ON subtopics FOR SELECT USING (is_active = true);
CREATE POLICY subtopics_admin_all ON subtopics FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Question answers: EXTREMELY SENSITIVE.
-- Answers are NEVER readable by students during an attempt.
-- Students may only read answers of questions for attempts they have SUBMITTED, EXPIRED or GRADED.
CREATE POLICY question_answers_reviewer_admin ON question_answers
  FOR ALL USING (is_reviewer_or_admin()) WITH CHECK (is_reviewer_or_admin());

CREATE POLICY question_answers_student_submitted ON question_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM attempt_answers aa
      JOIN attempts a ON a.id = aa.attempt_id
      WHERE aa.question_id = question_answers.question_id
        AND a.user_id = auth.uid()
        AND a.status IN ('submitted', 'graded', 'expired')
    )
  );

-- Question tags and stats
CREATE POLICY question_tags_read ON question_tags FOR SELECT USING (true);
CREATE POLICY question_tags_admin ON question_tags FOR ALL USING (is_reviewer_or_admin()) WITH CHECK (is_reviewer_or_admin());

CREATE POLICY question_stats_read ON question_stats FOR SELECT USING (true);
CREATE POLICY question_stats_admin ON question_stats FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Blueprints & sections
CREATE POLICY blueprints_public_read ON blueprints FOR SELECT USING (is_public = true OR is_reviewer_or_admin());
CREATE POLICY blueprints_admin_all ON blueprints FOR ALL USING (is_reviewer_or_admin()) WITH CHECK (is_reviewer_or_admin());

CREATE POLICY blueprint_sections_read ON blueprint_sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM blueprints b
      WHERE b.id = blueprint_sections.blueprint_id
        AND (b.is_public = true OR is_reviewer_or_admin())
    )
  );
CREATE POLICY blueprint_sections_admin ON blueprint_sections FOR ALL USING (is_reviewer_or_admin()) WITH CHECK (is_reviewer_or_admin());

-- Test instances & questions
CREATE POLICY test_instances_own_or_admin ON test_instances
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL OR is_reviewer_or_admin());
CREATE POLICY test_instances_insert ON test_instances
  FOR INSERT WITH CHECK (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role' OR is_reviewer_or_admin());

CREATE POLICY test_instance_questions_read ON test_instance_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM test_instances ti
      WHERE ti.id = test_instance_questions.instance_id
        AND (ti.user_id = auth.uid() OR ti.user_id IS NULL OR is_reviewer_or_admin())
    )
  );

-- Attempts & attempt_answers (Students see ONLY their own)
CREATE POLICY attempts_own_read ON attempts FOR SELECT USING (user_id = auth.uid() OR is_reviewer_or_admin());
CREATE POLICY attempts_own_insert ON attempts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY attempts_own_update ON attempts FOR UPDATE USING (user_id = auth.uid() OR is_admin());

CREATE POLICY attempt_answers_own_read ON attempt_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM attempts a
      WHERE a.id = attempt_answers.attempt_id
        AND (a.user_id = auth.uid() OR is_reviewer_or_admin())
    )
  );

CREATE POLICY attempt_answers_own_upsert ON attempt_answers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM attempts a
      WHERE a.id = attempt_answers.attempt_id
        AND a.user_id = auth.uid()
        AND a.status = 'in_progress'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM attempts a
      WHERE a.id = attempt_answers.attempt_id
        AND a.user_id = auth.uid()
        AND a.status = 'in_progress'
    )
  );

-- Topic mastery & streaks
CREATE POLICY topic_mastery_own_read ON topic_mastery FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY topic_mastery_admin_write ON topic_mastery FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY streaks_own_read ON streaks FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY streaks_admin_write ON streaks FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ----------------------------------------------------------------------------
-- 9. TIMER & STATS UTILITY FUNCTIONS
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_row_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_subtopics_updated ON subtopics;
CREATE TRIGGER tr_subtopics_updated BEFORE UPDATE ON subtopics FOR EACH ROW EXECUTE FUNCTION update_row_timestamp();

DROP TRIGGER IF EXISTS tr_blueprints_updated ON blueprints;
CREATE TRIGGER tr_blueprints_updated BEFORE UPDATE ON blueprints FOR EACH ROW EXECUTE FUNCTION update_row_timestamp();

DROP TRIGGER IF EXISTS tr_attempts_updated ON attempts;
CREATE TRIGGER tr_attempts_updated BEFORE UPDATE ON attempts FOR EACH ROW EXECUTE FUNCTION update_row_timestamp();

DROP TRIGGER IF EXISTS tr_topic_mastery_updated ON topic_mastery;
CREATE TRIGGER tr_topic_mastery_updated BEFORE UPDATE ON topic_mastery FOR EACH ROW EXECUTE FUNCTION update_row_timestamp();

-- Guard function: reject answer saves if deadline has passed plus grace period
CREATE OR REPLACE FUNCTION check_attempt_deadline()
RETURNS TRIGGER AS $$
DECLARE
  v_deadline TIMESTAMPTZ;
  v_status engine_attempt_status;
  v_grace_seconds INT := 15; -- 15 seconds grace window for network lag
BEGIN
  SELECT deadline_at, status INTO v_deadline, v_status
  FROM attempts
  WHERE id = NEW.attempt_id;

  IF v_status <> 'in_progress' THEN
    RAISE EXCEPTION 'Cannot modify answers for an attempt that is %', v_status;
  END IF;

  IF NOW() > (v_deadline + (v_grace_seconds || ' seconds')::INTERVAL) THEN
    -- Auto-expire attempt
    UPDATE attempts SET status = 'expired', updated_at = NOW() WHERE id = NEW.attempt_id;
    RAISE EXCEPTION 'Attempt deadline has expired.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_attempt_answers_deadline ON attempt_answers;
CREATE TRIGGER tr_attempt_answers_deadline
  BEFORE INSERT OR UPDATE ON attempt_answers
  FOR EACH ROW EXECUTE FUNCTION check_attempt_deadline();


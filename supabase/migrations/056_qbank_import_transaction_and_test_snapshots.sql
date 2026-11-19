-- ============================================================================
-- Migration 056: Question Bank import transaction and published test snapshots
-- Additive and reversible; no existing rows or policies are deleted.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mock_test_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_test_id UUID NOT NULL REFERENCES public.mock_tests(id) ON DELETE CASCADE,
  version_number INT NOT NULL DEFAULT 1,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mock_test_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.mock_test_version_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.mock_test_versions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  section_id UUID REFERENCES public.mock_test_sections(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  marks_override NUMERIC(5,2),
  question_snapshot JSONB NOT NULL,
  correct_option_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  UNIQUE (version_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_mock_test_versions_test
  ON public.mock_test_versions(mock_test_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_mock_test_version_questions_version
  ON public.mock_test_version_questions(version_id, sort_order);

ALTER TABLE public.mock_test_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_test_version_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mock_test_versions_admin ON public.mock_test_versions;
CREATE POLICY mock_test_versions_admin ON public.mock_test_versions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS mock_test_version_questions_admin ON public.mock_test_version_questions;
CREATE POLICY mock_test_version_questions_admin ON public.mock_test_version_questions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON TABLE public.mock_test_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.mock_test_version_questions FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.publish_mock_test_snapshot(p_mock_test_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_test public.mock_tests%ROWTYPE;
  v_version public.mock_test_versions%ROWTYPE;
  v_next_number INTEGER;
  v_question_count INTEGER;
BEGIN
  SELECT * INTO v_test
  FROM public.mock_tests
  WHERE id = p_mock_test_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mock test not found';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_question_count
  FROM public.mock_test_questions mtq
  JOIN public.questions q ON q.id = mtq.question_id
  WHERE mtq.mock_test_id = p_mock_test_id
    AND q.status = 'published'
    AND q.is_active = true;

  IF v_question_count = 0 THEN
    RAISE EXCEPTION 'Test not ready: at least one published active question is required';
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO v_next_number
  FROM public.mock_test_versions
  WHERE mock_test_id = p_mock_test_id;

  INSERT INTO public.mock_test_versions (
    mock_test_id, version_number, snapshot, published_by
  ) VALUES (
    p_mock_test_id,
    v_next_number,
    to_jsonb(v_test),
    auth.uid()
  )
  RETURNING * INTO v_version;

  INSERT INTO public.mock_test_version_questions (
    version_id, question_id, section_id, sort_order, marks_override,
    question_snapshot, correct_option_ids
  )
  SELECT
    v_version.id,
    q.id,
    mtq.section_id,
    mtq.sort_order,
    mtq.marks_override,
    jsonb_build_object(
      'id', q.id,
      'question_text', q.question_text,
      'question_html', q.question_html,
      'explanation', q.explanation,
      'image_url', q.image_url,
      'marks', COALESCE(mtq.marks_override, q.marks, 1),
      'negative_marks', COALESCE(NULLIF(q.negative_marks, 0),
        COALESCE(mtq.marks_override, q.marks, 1) * COALESCE(v_test.negative_marks_ratio, 0)),
      'time_seconds', q.time_seconds,
      'topic_id', q.topic_id,
      'chapter_id', q.chapter_id,
      'subject_id', q.subject_id,
      'question_type', CASE WHEN qt.code IS NULL THEN NULL ELSE jsonb_build_object('code', qt.code) END,
      'options', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', qo.id,
          'option_text', qo.option_text,
          'option_html', qo.option_html,
          'image_url', qo.image_url,
          'sort_order', qo.sort_order,
          'label', qo.label,
          'body', qo.body,
          'position', qo.position
        ) ORDER BY qo.sort_order, qo.id)
        FROM public.question_options qo
        WHERE qo.question_id = q.id
      ), '[]'::jsonb)
    ),
    COALESCE((
      SELECT array_agg(qo.id ORDER BY qo.sort_order, qo.id)
      FROM public.question_options qo
      WHERE qo.question_id = q.id AND qo.is_correct
    ), '{}'::uuid[])
  FROM public.mock_test_questions mtq
  JOIN public.questions q ON q.id = mtq.question_id
  LEFT JOIN public.question_types qt ON qt.id = q.question_type_id
  WHERE mtq.mock_test_id = p_mock_test_id
    AND q.status = 'published'
    AND q.is_active = true;

  UPDATE public.mock_tests
  SET is_published = true,
      published_at = now(),
      is_active = true
  WHERE id = p_mock_test_id;

  RETURN jsonb_build_object(
    'mock_test_id', p_mock_test_id,
    'version_id', v_version.id,
    'version_number', v_version.version_number,
    'question_count', v_question_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_mock_test_snapshot(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_mock_test_snapshot(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.import_question_batch(
  p_batch_id UUID,
  p_actor_id UUID,
  p_rows JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row JSONB;
  v_row_no INTEGER;
  v_question_id UUID;
  v_question_type_id UUID;
  v_difficulty_id UUID;
  v_language_id UUID;
  v_option JSONB;
  v_option_index INTEGER;
  v_correct_labels TEXT[];
  v_status TEXT;
  v_imported INTEGER := 0;
  v_failed INTEGER := 0;
  v_skipped INTEGER := 0;
  v_errors JSONB := '[]'::jsonb;
BEGIN
  IF p_actor_id IS NULL OR p_batch_id IS NULL THEN
    RAISE EXCEPTION 'Actor and batch are required';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'Rows must be a JSON array';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_row_no := COALESCE((v_row->>'row_no')::INTEGER, 0);
    BEGIN
      IF EXISTS (
        SELECT 1 FROM public.questions q
        WHERE q.import_batch_id = p_batch_id
          AND COALESCE(q.metadata->>'import_row_no', '') = v_row_no::TEXT
      ) THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      SELECT id INTO v_question_type_id
      FROM public.question_types WHERE code = v_row->>'question_type';
      IF v_question_type_id IS NULL THEN RAISE EXCEPTION 'Question type is not configured'; END IF;

      SELECT id INTO v_difficulty_id
      FROM public.difficulty_levels WHERE code = v_row->>'difficulty';
      IF v_difficulty_id IS NULL THEN RAISE EXCEPTION 'Difficulty is not configured'; END IF;

      SELECT id INTO v_language_id
      FROM public.languages WHERE code = COALESCE(v_row->>'language', 'en');
      IF v_language_id IS NULL THEN RAISE EXCEPTION 'Language is not configured'; END IF;

      v_status := CASE
        WHEN v_row->>'status' = 'approved' THEN 'approved'
        WHEN v_row->>'status' = 'review' THEN 'review'
        ELSE 'draft'
      END;

      INSERT INTO public.questions (
        question_type_id, difficulty_level_id, language_id,
        topic_id, chapter_id, subject_id,
        question_text, explanation, marks, negative_marks, time_seconds,
        tags, metadata, is_active, is_verified, created_by, verified_by,
        status, engine_status, engine_type, stem, difficulty, skill,
        neg_marks, est_time_sec, board_pattern, lang, source, import_batch_id
      ) VALUES (
        v_question_type_id, v_difficulty_id, v_language_id,
        NULLIF(v_row->>'topic_id', '')::UUID,
        NULLIF(v_row->>'chapter_id', '')::UUID,
        NULLIF(v_row->>'subject_id', '')::UUID,
        v_row->>'question_text',
        NULLIF(v_row->>'explanation', ''),
        COALESCE((v_row->>'marks')::NUMERIC, 1),
        COALESCE((v_row->>'negative_marks')::NUMERIC, 0),
        COALESCE((v_row->>'time_seconds')::INTEGER, 60),
        ARRAY[]::TEXT[],
        jsonb_build_object('source', 'import', 'import_row_no', v_row_no),
        v_status <> 'rejected',
        v_status IN ('approved', 'published'),
        p_actor_id,
        CASE WHEN v_status IN ('approved', 'published') THEN p_actor_id ELSE NULL END,
        v_status,
        CASE
          WHEN v_status = 'review' THEN 'reviewed'
          WHEN v_status IN ('approved', 'published') THEN 'published'
          ELSE 'draft'
        END::engine_question_status,
        CASE
          WHEN v_row->>'question_type' = 'multiple_correct' THEN 'mcq'
          WHEN v_row->>'question_type' = 'true_false' THEN 'statement'
          ELSE 'mcq'
        END,
        v_row->>'question_text',
        CASE v_row->>'difficulty' WHEN 'easy' THEN 1 WHEN 'hard' THEN 3 ELSE 2 END,
        'recall',
        COALESCE((v_row->>'negative_marks')::NUMERIC, 0),
        COALESCE((v_row->>'time_seconds')::INTEGER, 60),
        'OTHER',
        COALESCE(v_row->>'language', 'en'),
        'import',
        p_batch_id
      )
      RETURNING id INTO v_question_id;

      v_correct_labels := ARRAY[]::TEXT[];
      v_option_index := 0;
      FOR v_option IN SELECT * FROM jsonb_array_elements(COALESCE(v_row->'options', '[]'::jsonb))
      LOOP
        v_option_index := v_option_index + 1;
        INSERT INTO public.question_options (
          question_id, option_text, is_correct, sort_order, label, body, position
        ) VALUES (
          v_question_id,
          v_option->>'body',
          COALESCE((v_option->>'is_correct')::BOOLEAN, false),
          v_option_index,
          v_option->>'label',
          v_option->>'body',
          v_option_index
        );
        IF COALESCE((v_option->>'is_correct')::BOOLEAN, false) THEN
          v_correct_labels := array_append(v_correct_labels, v_option->>'label');
        END IF;
      END LOOP;

      INSERT INTO public.question_answers (
        question_id, answer_json, rubric_json, explanation
      ) VALUES (
        v_question_id,
        CASE
          WHEN array_length(v_correct_labels, 1) = 1
            THEN jsonb_build_object('correct_option', v_correct_labels[1])
          ELSE jsonb_build_object('correct_options', to_jsonb(v_correct_labels))
        END,
        '{}'::jsonb,
        NULLIF(v_row->>'explanation', '')
      );

      INSERT INTO public.question_versions (
        question_id, version_number, snapshot, changed_by, change_reason
      ) VALUES (
        v_question_id, 1, v_row, p_actor_id, 'Initial bulk import'
      );
      v_imported := v_imported + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object(
        'rowNo', v_row_no,
        'errors', jsonb_build_array(SQLERRM)
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'imported', v_imported,
    'failed', v_failed,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_question_batch(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_question_batch(UUID, UUID, JSONB) TO service_role;

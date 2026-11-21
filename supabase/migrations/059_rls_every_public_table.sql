-- Enforce RLS and client privileges on every public application table.
-- Service-role operations remain the server-side trusted path and are not exposed to browsers.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.schemaname, r.tablename);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', r.schemaname, r.tablename);
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC, anon', r.schemaname, r.tablename);
  END LOOP;
END;
$$;

-- Anonymous clients must never receive direct table privileges. Public data
-- remains available through explicitly scoped RLS policies below.
GRANT USAGE ON SCHEMA public TO anon, authenticated;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'entity_types', 'question_types', 'difficulty_levels', 'languages',
    'test_types', 'content_types', 'roles', 'permissions', 'boards', 'classes',
    'subjects', 'chapters', 'topics', 'exams', 'exam_subjects', 'lessons',
    'notes', 'mock_tests', 'mock_test_sections', 'mock_test_questions', 'blogs',
    'announcements', 'banners', 'ebook_categories', 'ebook_contributors',
    'manual_payment_settings'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      RAISE NOTICE 'Skipping anonymous SELECT grant for missing public.%', table_name;
    ELSE
      EXECUTE format(
        'GRANT SELECT ON TABLE public.%I TO anon, authenticated',
        table_name
      );
    END IF;
  END LOOP;
END;
$$;

-- Ebook listings expose public discovery columns only. Fulfillment destinations
-- remain server-only and must never be granted to anon/authenticated roles.
DO $$
BEGIN
  IF to_regclass('public.ebook_listings') IS NULL THEN
    RAISE NOTICE 'Skipping ebook_listings column grant because the table is missing';
  ELSE
    EXECUTE 'REVOKE SELECT ON TABLE public.ebook_listings FROM anon, authenticated';
    EXECUTE 'GRANT SELECT (
      id, contributor_id, category_id, subject_id, exam_id, title, slug,
      cover_image_url, short_description, full_description, subject, exam,
      language, page_count, price, currency, preview_url, author_name,
      publication_date, status, is_featured, view_count, external_click_count,
      published_at, created_at, updated_at
    ) ON TABLE public.ebook_listings TO anon, authenticated';
  END IF;
END;
$$;

-- Student-owned reads and existing application RPC-backed writes.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profiles', 'subscriptions', 'payments', 'payment_submissions',
    'payment_submission_events', 'subscription_history',
    'subscription_refunds', 'test_attempts', 'test_responses',
    'test_attempt_papers', 'attempts', 'attempt_answers',
    'user_topic_progress', 'user_chapter_progress', 'user_daily_activity',
    'user_bookmarks', 'user_notes', 'notifications', 'notification_receipts',
    'push_subscriptions', 'user_library', 'download_logs', 'refund_requests',
    'refund_events'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      RAISE NOTICE 'Skipping authenticated SELECT grant for missing public.%', table_name;
    ELSE
      EXECUTE format(
        'GRANT SELECT ON TABLE public.%I TO authenticated',
        table_name
      );
    END IF;
  END LOOP;
END;
$$;

-- These tables are server/RPC-owned. Students must never create or mutate engine attempts or answers directly.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'attempts', 'attempt_answers', 'test_attempts', 'test_responses',
    'test_attempt_papers', 'test_instance_answers', 'question_answers',
    'topic_mastery', 'streaks', 'subscriptions', 'payments',
    'payment_submissions', 'manual_payment_requests', 'refund_requests',
    'refund_events', 'subscription_refunds', 'subscription_history',
    'payment_submission_events', 'admin_audit_logs', 'audit_logs',
    'user_role_invitations', 'admin_signup_requests', 'premium_beta_events'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      RAISE NOTICE 'Skipping write revoke for missing public.%', table_name;
    ELSE
      EXECUTE format(
        'REVOKE INSERT, UPDATE, DELETE ON TABLE public.%I FROM PUBLIC, anon, authenticated',
        table_name
      );
    END IF;
  END LOOP;
END;
$$;

-- Remove unsafe owner-write policies for the engine attempts tables. Creation,
-- resumption, saving, and submission remain in SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS attempts_own_insert ON public.attempts;
DROP POLICY IF EXISTS attempts_own_update ON public.attempts;
DROP POLICY IF EXISTS attempt_answers_own_upsert ON public.attempt_answers;
DROP POLICY IF EXISTS test_attempts_own ON public.test_attempts;
DROP POLICY IF EXISTS test_responses_own ON public.test_responses;

DROP POLICY IF EXISTS test_attempts_owner_read_only ON public.test_attempts;
CREATE POLICY test_attempts_owner_read_only
  ON public.test_attempts FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_reviewer_or_admin()
  );

DROP POLICY IF EXISTS test_responses_owner_read_only ON public.test_responses;
CREATE POLICY test_responses_owner_read_only
  ON public.test_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.test_attempts ta
      WHERE ta.id = test_responses.attempt_id
        AND (
          ta.user_id = auth.uid()
          OR public.is_reviewer_or_admin()
        )
    )
  );

-- Keep attempts read-only for the owning student or authorized reviewer/admin.
DROP POLICY IF EXISTS attempts_owner_read_only ON public.attempts;
CREATE POLICY attempts_owner_read_only
  ON public.attempts FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_reviewer_or_admin()
  );

DROP POLICY IF EXISTS attempt_answers_owner_read_only ON public.attempt_answers;
CREATE POLICY attempt_answers_owner_read_only
  ON public.attempt_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.attempts a
      WHERE a.id = attempt_answers.attempt_id
        AND (
          a.user_id = auth.uid()
          OR public.is_reviewer_or_admin()
        )
    )
  );

-- Explicit notification actions remain user-scoped.
DROP POLICY IF EXISTS notification_receipts_own ON public.notification_receipts;
CREATE POLICY notification_receipts_own
  ON public.notification_receipts FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own
  ON public.push_subscriptions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Tables with no application-facing policies must not grant direct access.
-- Service role remains all-privileged for trusted server operations.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'payment_submission_events', 'subscription_history',
    'subscription_refunds', 'manual_payment_requests', 'admin_audit_logs',
    'audit_logs', 'premium_beta_events'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      RAISE NOTICE 'Skipping service-role grant for missing public.%', table_name;
    ELSE
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', table_name);
    END IF;
  END LOOP;
END;
$$;

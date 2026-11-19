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

GRANT SELECT ON TABLE
  public.entity_types,
  public.question_types,
  public.difficulty_levels,
  public.languages,
  public.test_types,
  public.content_types,
  public.roles,
  public.permissions,
  public.boards,
  public.classes,
  public.subjects,
  public.chapters,
  public.topics,
  public.exams,
  public.exam_subjects,
  public.lessons,
  public.notes,
  public.mock_tests,
  public.mock_test_sections,
  public.mock_test_questions,
  public.test_types,
  public.blogs,
  public.announcements,
  public.banners,
  public.ebook_categories,
  public.ebook_contributors,
  public.ebook_listings,
  public.manual_payment_settings
TO anon, authenticated;

-- Student-owned reads and existing application RPC-backed writes.
GRANT SELECT ON TABLE
  public.profiles,
  public.subscriptions,
  public.payments,
  public.payment_submissions,
  public.subscription_history,
  public.subscription_refunds,
  public.test_attempts,
  public.test_responses,
  public.test_attempt_papers,
  public.attempts,
  public.attempt_answers,
  public.user_topic_progress,
  public.user_chapter_progress,
  public.user_daily_activity,
  public.user_bookmarks,
  public.user_notes,
  public.notifications,
  public.notification_receipts,
  public.push_subscriptions,
  public.user_library,
  public.download_logs,
  public.refund_requests,
  public.refund_events
TO authenticated;

-- These tables are server/RPC-owned. Students must never create or mutate engine attempts or answers directly.
REVOKE INSERT, UPDATE, DELETE ON TABLE
  public.attempts,
  public.attempt_answers,
  public.test_attempts,
  public.test_responses,
  public.test_attempt_papers,
  public.test_instance_answers,
  public.question_answers,
  public.topic_mastery,
  public.streaks
FROM PUBLIC, anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE
  public.subscriptions,
  public.payments,
  public.payment_submissions,
  public.manual_payment_requests,
  public.refund_requests,
  public.refund_events,
  public.subscription_refunds,
  public.subscription_history,
  public.admin_audit_logs,
  public.audit_logs,
  public.user_role_invitations,
  public.admin_signup_requests,
  public.premium_beta_events
FROM PUBLIC, anon, authenticated;

-- Remove unsafe owner-write policies for the engine attempts tables. Creation,
-- resumption, saving, and submission remain in SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS attempts_own_insert ON public.attempts;
DROP POLICY IF EXISTS attempts_own_update ON public.attempts;
DROP POLICY IF EXISTS attempt_answers_own_upsert ON public.attempt_answers;
DROP POLICY IF EXISTS test_attempts_own ON public.test_attempts;
DROP POLICY IF EXISTS test_responses_own ON public.test_responses;

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
GRANT ALL ON TABLE
  public.subscription_history,
  public.subscription_refunds,
  public.manual_payment_requests,
  public.admin_audit_logs,
  public.audit_logs,
  public.premium_beta_events
TO service_role;

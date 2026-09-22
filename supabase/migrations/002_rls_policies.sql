-- Row Level Security Policies

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_topic_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_chapter_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE blogs ENABLE ROW LEVEL SECURITY;

-- Helper: check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid() AND r.code IN ('super_admin', 'admin', 'content_manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Helper: check if user is premium
CREATE OR REPLACE FUNCTION is_premium_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_premium = true AND (premium_expires_at IS NULL OR premium_expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- PROFILES
CREATE POLICY profiles_select_own ON profiles FOR SELECT USING (id = auth.uid() OR is_admin());
CREATE POLICY profiles_update_own ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (
  id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role'
);

-- PUBLIC READ: Educational hierarchy
CREATE POLICY boards_public_read ON boards FOR SELECT USING (is_active = true);
CREATE POLICY classes_public_read ON classes FOR SELECT USING (is_active = true);
CREATE POLICY subjects_public_read ON subjects FOR SELECT USING (is_active = true);
CREATE POLICY chapters_public_read ON chapters FOR SELECT USING (is_active = true);
CREATE POLICY topics_public_read ON topics FOR SELECT USING (is_active = true);

-- ADMIN WRITE: Educational hierarchy
CREATE POLICY boards_admin_write ON boards FOR ALL USING (is_admin());
CREATE POLICY classes_admin_write ON classes FOR ALL USING (is_admin());
CREATE POLICY subjects_admin_write ON subjects FOR ALL USING (is_admin());
CREATE POLICY chapters_admin_write ON chapters FOR ALL USING (is_admin());
CREATE POLICY topics_admin_write ON topics FOR ALL USING (is_admin());

-- CONTENT
CREATE POLICY lessons_read ON lessons FOR SELECT USING (
  is_active = true AND (is_premium = false OR is_premium_user() OR is_admin())
);
CREATE POLICY lessons_admin ON lessons FOR ALL USING (is_admin());

CREATE POLICY notes_read ON notes FOR SELECT USING (
  is_active = true AND (is_premium = false OR is_premium_user() OR is_admin())
);
CREATE POLICY notes_admin ON notes FOR ALL USING (is_admin());

-- QUESTIONS (students see only during tests via service role)
CREATE POLICY questions_admin ON questions FOR ALL USING (is_admin());
CREATE POLICY question_options_admin ON question_options FOR ALL USING (is_admin());

-- MOCK TESTS
CREATE POLICY mock_tests_read ON mock_tests FOR SELECT USING (
  is_published = true AND is_active = true
);
CREATE POLICY mock_tests_admin ON mock_tests FOR ALL USING (is_admin());

-- TEST ATTEMPTS (own data only)
CREATE POLICY test_attempts_own ON test_attempts FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY test_responses_own ON test_responses FOR ALL USING (
  EXISTS (SELECT 1 FROM test_attempts WHERE id = attempt_id AND user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM test_attempts WHERE id = attempt_id AND user_id = auth.uid())
);

-- USER PROGRESS
CREATE POLICY user_topic_progress_own ON user_topic_progress FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY user_chapter_progress_own ON user_chapter_progress FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY user_daily_activity_own ON user_daily_activity FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY user_bookmarks_own ON user_bookmarks FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY user_notes_own ON user_notes FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- PAYMENTS & SUBSCRIPTIONS
CREATE POLICY subscriptions_own ON subscriptions FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY payments_own ON payments FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY payments_insert ON payments FOR INSERT WITH CHECK (user_id = auth.uid());

-- NOTIFICATIONS
CREATE POLICY notifications_own ON notifications FOR SELECT USING (
  user_id = auth.uid() OR is_global = true
);
CREATE POLICY notifications_update ON notifications FOR UPDATE USING (user_id = auth.uid());

-- ACHIEVEMENTS & CERTIFICATES
CREATE POLICY user_achievements_own ON user_achievements FOR SELECT USING (user_id = auth.uid());
CREATE POLICY certificates_own ON certificates FOR SELECT USING (user_id = auth.uid());

-- AI
CREATE POLICY ai_study_plans_own ON ai_study_plans FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY ai_analytics_own ON ai_analytics FOR SELECT USING (user_id = auth.uid());

-- BLOGS (public read)
CREATE POLICY blogs_public_read ON blogs FOR SELECT USING (is_published = true);
CREATE POLICY blogs_admin ON blogs FOR ALL USING (is_admin());

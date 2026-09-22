-- Authorization hardening
-- Apply after 002_rls_policies.sql. Sensitive mutations must use trusted server-side workflows.

-- Entitlements are derived from verified subscriptions, never from user-writable profile flags.
CREATE OR REPLACE FUNCTION is_premium_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM subscriptions s
    WHERE s.user_id = auth.uid()
      AND s.status = 'active'
      AND s.expires_at > NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Prevent authenticated clients from changing authorization, entitlement, account-state,
-- or server-calculated progression fields on their own profile.
CREATE OR REPLACE FUNCTION protect_profile_security_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    IF NEW.role_id IS DISTINCT FROM OLD.role_id
      OR NEW.is_premium IS DISTINCT FROM OLD.is_premium
      OR NEW.premium_expires_at IS DISTINCT FROM OLD.premium_expires_at
      OR NEW.is_active IS DISTINCT FROM OLD.is_active
      OR NEW.email_verified IS DISTINCT FROM OLD.email_verified
      OR NEW.total_xp IS DISTINCT FROM OLD.total_xp
      OR NEW.level IS DISTINCT FROM OLD.level
      OR NEW.current_streak IS DISTINCT FROM OLD.current_streak
      OR NEW.longest_streak IS DISTINCT FROM OLD.longest_streak
      OR NEW.last_active_date IS DISTINCT FROM OLD.last_active_date
    THEN
      RAISE EXCEPTION 'Protected profile fields can only be changed by a trusted server operation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS tr_protect_profile_security_fields ON profiles;
CREATE TRIGGER tr_protect_profile_security_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_security_fields();

DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Profiles are created by the auth trigger; clients must not insert arbitrary rows
-- containing role or entitlement fields.
REVOKE INSERT ON profiles FROM anon, authenticated;

-- Never expose privileged metadata or question-answer material to ordinary users.
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_assertions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_blanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_test_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE difficulty_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_subjects ENABLE ROW LEVEL SECURITY;

-- Public catalog/reference reads.
CREATE POLICY entity_types_public_read ON entity_types FOR SELECT USING (true);
CREATE POLICY question_types_public_read ON question_types FOR SELECT USING (true);
CREATE POLICY difficulty_levels_public_read ON difficulty_levels FOR SELECT USING (true);
CREATE POLICY languages_public_read ON languages FOR SELECT USING (true);
CREATE POLICY test_types_public_read ON test_types FOR SELECT USING (true);
CREATE POLICY content_types_public_read ON content_types FOR SELECT USING (true);
CREATE POLICY exams_public_read ON exams FOR SELECT USING (is_active = true);
CREATE POLICY exam_subjects_public_read ON exam_subjects FOR SELECT USING (true);
CREATE POLICY subscription_plans_public_read ON subscription_plans FOR SELECT USING (is_active = true);
CREATE POLICY achievements_public_read ON achievements FOR SELECT USING (is_active = true);

-- Privileged/reference data is admin-only.
CREATE POLICY roles_admin_only ON roles FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY permissions_admin_only ON permissions FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY role_permissions_admin_only ON role_permissions FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY coupons_admin_only ON coupons FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY media_assets_admin_only ON media_assets FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY audit_logs_admin_read ON audit_logs FOR SELECT USING (is_admin());
CREATE POLICY audit_logs_admin_write ON audit_logs FOR INSERT WITH CHECK (is_admin());
CREATE POLICY leaderboard_public_read ON leaderboard_entries FOR SELECT USING (true);
CREATE POLICY leaderboard_admin_write ON leaderboard_entries FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY announcements_public_read ON announcements FOR SELECT USING (
  is_active = true AND starts_at <= NOW() AND (expires_at IS NULL OR expires_at > NOW())
);
CREATE POLICY announcements_admin_write ON announcements FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY banners_public_read ON banners FOR SELECT USING (
  is_active = true AND starts_at <= NOW() AND (expires_at IS NULL OR expires_at > NOW())
);
CREATE POLICY banners_admin_write ON banners FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Premium test catalog and test structure require verified entitlement.
DROP POLICY IF EXISTS mock_tests_read ON mock_tests;
CREATE POLICY mock_tests_read ON mock_tests FOR SELECT USING (
  is_published = true
  AND is_active = true
  AND (is_premium = false OR is_premium_user() OR is_admin())
);
DROP POLICY IF EXISTS mock_tests_admin ON mock_tests;
CREATE POLICY mock_tests_admin ON mock_tests FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY mock_test_sections_read ON mock_test_sections FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM mock_tests mt
    WHERE mt.id = mock_test_id
      AND mt.is_published = true
      AND mt.is_active = true
      AND (mt.is_premium = false OR is_premium_user() OR is_admin())
  )
);
CREATE POLICY mock_test_questions_read ON mock_test_questions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM mock_tests mt
    WHERE mt.id = mock_test_id
      AND mt.is_published = true
      AND mt.is_active = true
      AND (mt.is_premium = false OR is_premium_user() OR is_admin())
  )
);
CREATE POLICY mock_test_sections_admin ON mock_test_sections FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY mock_test_questions_admin ON mock_test_questions FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Question answer material remains server/admin-only.
CREATE POLICY question_assertions_admin ON question_assertions FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY question_matches_admin ON question_matches FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY question_blanks_admin ON question_blanks FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Remove direct client mutation of server-calculated or financial records.
REVOKE INSERT, UPDATE, DELETE ON payments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON subscriptions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON test_attempts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON test_responses FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON user_achievements FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON certificates FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON leaderboard_entries FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON audit_logs FROM anon, authenticated;

-- Keep payment/subscription reads scoped to the owner/admin policies from migration 002.

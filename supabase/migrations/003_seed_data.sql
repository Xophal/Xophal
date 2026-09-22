-- Seed Data: Entity Types, Question Types, Difficulty Levels, Languages, Test Types, Roles, Permissions, Boards, Classes, Subjects

-- Entity Types
INSERT INTO entity_types (code, name, description) VALUES
  ('school_board', 'School Board', 'K-12 school education boards'),
  ('entrance_exam', 'Entrance Exam', 'University and college entrance exams'),
  ('competitive_exam', 'Competitive Exam', 'Government and competitive exams'),
  ('defence_exam', 'Defence Exam', 'Defence and armed forces exams'),
  ('teaching_exam', 'Teaching Exam', 'Teacher eligibility and certification exams'),
  ('professional_exam', 'Professional Exam', 'Professional certification exams'),
  ('olympiad', 'Olympiad', 'Olympiad and scholarship exams');

-- Question Types
INSERT INTO question_types (code, name, description, sort_order) VALUES
  ('single_correct', 'Single Correct', 'One correct answer from multiple options', 1),
  ('multiple_correct', 'Multiple Correct', 'Multiple correct answers', 2),
  ('true_false', 'True/False', 'True or False question', 3),
  ('fill_blank', 'Fill in the Blank', 'Fill in the missing word or phrase', 4),
  ('numerical', 'Numerical', 'Numerical answer type', 5),
  ('match_following', 'Match the Following', 'Match items from two columns', 6),
  ('assertion_reason', 'Assertion-Reason', 'Assertion and Reason based question', 7),
  ('case_study', 'Case Study', 'Case study based question', 8),
  ('paragraph_based', 'Paragraph Based', 'Comprehension paragraph based', 9),
  ('image_based', 'Image Based', 'Question with image', 10),
  ('diagram_based', 'Diagram Based', 'Question with diagram', 11);

-- Difficulty Levels
INSERT INTO difficulty_levels (code, name, weight, color, sort_order) VALUES
  ('easy', 'Easy', 1.0, '#22c55e', 1),
  ('medium', 'Medium', 2.0, '#f59e0b', 2),
  ('hard', 'Hard', 3.0, '#ef4444', 3),
  ('expert', 'Expert', 4.0, '#8b5cf6', 4);

-- Languages
INSERT INTO languages (code, name, native_name, is_default) VALUES
  ('en', 'English', 'English', true),
  ('hi', 'Hindi', 'हिन्दी', false),
  ('as', 'Assamese', 'অসমীয়া', false);

-- Test Types
INSERT INTO test_types (code, name, description, sort_order) VALUES
  ('topic_test', 'Topic Test', 'Test for a specific topic', 1),
  ('chapter_test', 'Chapter Test', 'Test covering a full chapter', 2),
  ('unit_test', 'Unit Test', 'Unit level test', 3),
  ('subject_test', 'Subject Test', 'Full subject test', 4),
  ('full_mock', 'Full Mock Test', 'Complete syllabus mock test', 5),
  ('previous_year', 'Previous Year Paper', 'Previous year question paper', 6),
  ('sample_paper', 'Sample Paper', 'Sample question paper', 7),
  ('custom_test', 'Custom Test', 'User created custom test', 8),
  ('adaptive_test', 'Adaptive Test', 'AI adaptive difficulty test', 9),
  ('ai_generated', 'AI Generated Test', 'AI generated mock test', 10);

-- Content Types
INSERT INTO content_types (code, name, mime_types) VALUES
  ('image', 'Image', ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('pdf', 'PDF Document', ARRAY['application/pdf']),
  ('video', 'Video', ARRAY['video/mp4','video/webm']),
  ('audio', 'Audio', ARRAY['audio/mpeg','audio/wav']);

-- Roles
INSERT INTO roles (code, name, description, is_system) VALUES
  ('super_admin', 'Super Admin', 'Full system access', true),
  ('admin', 'Admin', 'Administrative access', true),
  ('content_manager', 'Content Manager', 'Manage educational content', true),
  ('moderator', 'Moderator', 'Moderate user content', true),
  ('student', 'Student', 'Student user', true);

-- Permissions
INSERT INTO permissions (code, name, module) VALUES
  ('users.read', 'View Users', 'users'),
  ('users.write', 'Manage Users', 'users'),
  ('boards.read', 'View Boards', 'boards'),
  ('boards.write', 'Manage Boards', 'boards'),
  ('content.read', 'View Content', 'content'),
  ('content.write', 'Manage Content', 'content'),
  ('questions.read', 'View Questions', 'questions'),
  ('questions.write', 'Manage Questions', 'questions'),
  ('tests.read', 'View Tests', 'tests'),
  ('tests.write', 'Manage Tests', 'tests'),
  ('payments.read', 'View Payments', 'payments'),
  ('payments.write', 'Manage Payments', 'payments'),
  ('reports.read', 'View Reports', 'reports'),
  ('settings.write', 'Manage Settings', 'settings');

-- Role Permissions (Super Admin gets all)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code = 'super_admin';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'admin' AND p.code NOT IN ('settings.write');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'content_manager' AND p.module IN ('content', 'questions', 'tests', 'boards');

-- Subscription Plans
INSERT INTO subscription_plans (code, name, description, price, duration_days, features, sort_order) VALUES
  ('free', 'Free Plan', 'Basic access to limited content', 0, 365, '["Limited MCQs", "Basic Analytics", "Community Access"]', 1),
  ('premium_monthly', 'Premium Monthly', 'Full access for 1 month', 299, 30, '["Unlimited MCQs", "All Mock Tests", "Detailed Analytics", "AI Study Planner", "Previous Year Papers", "Sample Papers"]', 2),
  ('premium_yearly', 'Premium Yearly', 'Full access for 1 year', 2499, 365, '["Unlimited MCQs", "All Mock Tests", "Detailed Analytics", "AI Study Planner", "Previous Year Papers", "Sample Papers", "Priority Support", "Certificates"]', 3);

-- Achievements
INSERT INTO achievements (code, name, description, xp_reward, criteria) VALUES
  ('first_test', 'First Steps', 'Complete your first mock test', 50, '{"type": "tests_completed", "count": 1}'),
  ('streak_7', 'Week Warrior', 'Maintain a 7-day study streak', 100, '{"type": "streak", "days": 7}'),
  ('streak_30', 'Monthly Master', 'Maintain a 30-day study streak', 500, '{"type": "streak", "days": 30}'),
  ('perfect_score', 'Perfectionist', 'Score 100% in any mock test', 200, '{"type": "perfect_score", "count": 1}'),
  ('questions_100', 'Century Club', 'Answer 100 questions correctly', 150, '{"type": "correct_answers", "count": 100}'),
  ('questions_1000', 'Knowledge Seeker', 'Answer 1000 questions correctly', 1000, '{"type": "correct_answers", "count": 1000}');

-- ============================================================
-- BOARDS: SEBA & CBSE
-- ============================================================

INSERT INTO boards (code, name, slug, description, entity_type_id, state, sort_order) VALUES
  ('seba', 'Board of Secondary Education, Assam (SEBA)', 'seba', 'Assam Board of Secondary Education for Class 9 and 10', (SELECT id FROM entity_types WHERE code = 'school_board'), 'Assam', 1),
  ('cbse', 'Central Board of Secondary Education (CBSE)', 'cbse', 'National level board of education in India', (SELECT id FROM entity_types WHERE code = 'school_board'), NULL, 2);

-- CLASSES
INSERT INTO classes (board_id, code, name, slug, grade_number, sort_order) VALUES
  ((SELECT id FROM boards WHERE code = 'seba'), 'class-9', 'Class 9', 'class-9', 9, 1),
  ((SELECT id FROM boards WHERE code = 'seba'), 'class-10', 'Class 10', 'class-10', 10, 2),
  ((SELECT id FROM boards WHERE code = 'cbse'), 'class-9', 'Class 9', 'class-9', 9, 1),
  ((SELECT id FROM boards WHERE code = 'cbse'), 'class-10', 'Class 10', 'class-10', 10, 2);

-- SEBA CLASS 9 SUBJECTS
INSERT INTO subjects (class_id, code, name, slug, color, sort_order) VALUES
  ((SELECT c.id FROM classes c JOIN boards b ON c.board_id = b.id WHERE b.code = 'seba' AND c.code = 'class-9'), 'english', 'English', 'english', '#3b82f6', 1),
  ((SELECT c.id FROM classes c JOIN boards b ON c.board_id = b.id WHERE b.code = 'seba' AND c.code = 'class-9'), 'mathematics', 'Mathematics', 'mathematics', '#ef4444', 2),
  ((SELECT c.id FROM classes c JOIN boards b ON c.board_id = b.id WHERE b.code = 'seba' AND c.code = 'class-9'), 'science', 'Science', 'science', '#22c55e', 3),
  ((SELECT c.id FROM classes c JOIN boards b ON c.board_id = b.id WHERE b.code = 'seba' AND c.code = 'class-9'), 'social-science', 'Social Science', 'social-science', '#f59e0b', 4),
  ((SELECT c.id FROM classes c JOIN boards b ON c.board_id = b.id WHERE b.code = 'seba' AND c.code = 'class-9'), 'assamese', 'Assamese (MIL)', 'assamese', '#8b5cf6', 5);

-- SEBA CLASS 10 SUBJECTS
INSERT INTO subjects (class_id, code, name, slug, color, sort_order) VALUES
  ((SELECT c.id FROM classes c JOIN boards b ON c.board_id = b.id WHERE b.code = 'seba' AND c.code = 'class-10'), 'english', 'English', 'english', '#3b82f6', 1),
  ((SELECT c.id FROM classes c JOIN boards b ON c.board_id = b.id WHERE b.code = 'seba' AND c.code = 'class-10'), 'mathematics', 'Mathematics', 'mathematics', '#ef4444', 2),
  ((SELECT c.id FROM classes c JOIN boards b ON c.board_id = b.id WHERE b.code = 'seba' AND c.code = 'class-10'), 'science', 'Science', 'science', '#22c55e', 3),
  ((SELECT c.id FROM classes c JOIN boards b ON c.board_id = b.id WHERE b.code = 'seba' AND c.code = 'class-10'), 'social-science', 'Social Science', 'social-science', '#f59e0b', 4),
  ((SELECT c.id FROM classes c JOIN boards b ON c.board_id = b.id WHERE b.code = 'seba' AND c.code = 'class-10'), 'assamese', 'Assamese (MIL)', 'assamese', '#8b5cf6', 5);

-- CBSE CLASS 9 SUBJECTS
INSERT INTO subjects (class_id, code, name, slug, color, sort_order) VALUES
  ((SELECT c.id FROM classes c JOIN boards b ON c.board_id = b.id WHERE b.code = 'cbse' AND c.code = 'class-9'), 'english', 'English', 'english', '#3b82f6', 1),
  ((SELECT c.id FROM classes c JOIN boards b ON c.board_id = b.id WHERE b.code = 'cbse' AND c.code = 'class-9'), 'mathematics', 'Mathematics', 'mathematics', '#ef4444', 2),
  ((SELECT c.id FROM classes c JOIN boards b ON c.board_id = b.id WHERE b.code = 'cbse' AND c.code = 'class-9'), 'science', 'Science', 'science', '#22c55e', 3),
  ((SELECT c.id FROM classes c JOIN boards b ON c.board_id = b.id WHERE b.code = 'cbse' AND c.code = 'class-9'), 'social-science', 'Social Science', 'social-science', '#f59e0b', 4),
  ((SELECT c.id FROM classes c JOIN boards b ON c.board_id = b.id WHERE b.code = 'cbse' AND c.code = 'class-9'), 'hindi', 'Hindi', 'hindi', '#8b5cf6', 5);

-- CBSE CLASS 10 SUBJECTS
INSERT INTO subjects (class_id, code, name, slug, color, sort_order) VALUES
  ((SELECT c.id FROM classes c JOIN boards b ON c.board_id = b.id WHERE b.code = 'cbse' AND c.code = 'class-10'), 'english', 'English', 'english', '#3b82f6', 1),
  ((SELECT c.id FROM classes c JOIN boards b ON c.board_id = b.id WHERE b.code = 'cbse' AND c.code = 'class-10'), 'mathematics', 'Mathematics', 'mathematics', '#ef4444', 2),
  ((SELECT c.id FROM classes c JOIN boards b ON c.board_id = b.id WHERE b.code = 'cbse' AND c.code = 'class-10'), 'science', 'Science', 'science', '#22c55e', 3),
  ((SELECT c.id FROM classes c JOIN boards b ON c.board_id = b.id WHERE b.code = 'cbse' AND c.code = 'class-10'), 'social-science', 'Social Science', 'social-science', '#f59e0b', 4),
  ((SELECT c.id FROM classes c JOIN boards b ON c.board_id = b.id WHERE b.code = 'cbse' AND c.code = 'class-10'), 'hindi', 'Hindi', 'hindi', '#8b5cf6', 5);

-- Sample Chapters for SEBA Class 10 Mathematics
INSERT INTO chapters (subject_id, code, name, slug, chapter_number, sort_order) VALUES
  ((SELECT s.id FROM subjects s JOIN classes c ON s.class_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.code = 'seba' AND c.code = 'class-10' AND s.code = 'mathematics'), 'real-numbers', 'Real Numbers', 'real-numbers', 1, 1),
  ((SELECT s.id FROM subjects s JOIN classes c ON s.class_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.code = 'seba' AND c.code = 'class-10' AND s.code = 'mathematics'), 'polynomials', 'Polynomials', 'polynomials', 2, 2),
  ((SELECT s.id FROM subjects s JOIN classes c ON s.class_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.code = 'seba' AND c.code = 'class-10' AND s.code = 'mathematics'), 'linear-equations', 'Pair of Linear Equations in Two Variables', 'linear-equations', 3, 3),
  ((SELECT s.id FROM subjects s JOIN classes c ON s.class_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.code = 'seba' AND c.code = 'class-10' AND s.code = 'mathematics'), 'quadratic-equations', 'Quadratic Equations', 'quadratic-equations', 4, 4),
  ((SELECT s.id FROM subjects s JOIN classes c ON s.class_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.code = 'seba' AND c.code = 'class-10' AND s.code = 'mathematics'), 'arithmetic-progressions', 'Arithmetic Progressions', 'arithmetic-progressions', 5, 5);

-- Sample Topics for Real Numbers chapter
INSERT INTO topics (chapter_id, code, name, slug, sort_order) VALUES
  ((SELECT ch.id FROM chapters ch JOIN subjects s ON ch.subject_id = s.id JOIN classes c ON s.class_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.code = 'seba' AND c.code = 'class-10' AND s.code = 'mathematics' AND ch.code = 'real-numbers'), 'euclids-division-lemma', 'Euclid''s Division Lemma', 'euclids-division-lemma', 1),
  ((SELECT ch.id FROM chapters ch JOIN subjects s ON ch.subject_id = s.id JOIN classes c ON s.class_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.code = 'seba' AND c.code = 'class-10' AND s.code = 'mathematics' AND ch.code = 'real-numbers'), 'fundamental-theorem-arithmetic', 'Fundamental Theorem of Arithmetic', 'fundamental-theorem-arithmetic', 2),
  ((SELECT ch.id FROM chapters ch JOIN subjects s ON ch.subject_id = s.id JOIN classes c ON s.class_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.code = 'seba' AND c.code = 'class-10' AND s.code = 'mathematics' AND ch.code = 'real-numbers'), 'irrational-numbers', 'Irrational Numbers', 'irrational-numbers', 3),
  ((SELECT ch.id FROM chapters ch JOIN subjects s ON ch.subject_id = s.id JOIN classes c ON s.class_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.code = 'seba' AND c.code = 'class-10' AND s.code = 'mathematics' AND ch.code = 'real-numbers'), 'decimal-expansions', 'Decimal Expansions of Rational Numbers', 'decimal-expansions', 4);

-- Sample Chapters for CBSE Class 10 Mathematics
INSERT INTO chapters (subject_id, code, name, slug, chapter_number, sort_order) VALUES
  ((SELECT s.id FROM subjects s JOIN classes c ON s.class_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.code = 'cbse' AND c.code = 'class-10' AND s.code = 'mathematics'), 'real-numbers', 'Real Numbers', 'real-numbers', 1, 1),
  ((SELECT s.id FROM subjects s JOIN classes c ON s.class_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.code = 'cbse' AND c.code = 'class-10' AND s.code = 'mathematics'), 'polynomials', 'Polynomials', 'polynomials', 2, 2),
  ((SELECT s.id FROM subjects s JOIN classes c ON s.class_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.code = 'cbse' AND c.code = 'class-10' AND s.code = 'mathematics'), 'linear-equations', 'Pair of Linear Equations in Two Variables', 'linear-equations', 3, 3),
  ((SELECT s.id FROM subjects s JOIN classes c ON s.class_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.code = 'cbse' AND c.code = 'class-10' AND s.code = 'mathematics'), 'quadratic-equations', 'Quadratic Equations', 'quadratic-equations', 4, 4),
  ((SELECT s.id FROM subjects s JOIN classes c ON s.class_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.code = 'cbse' AND c.code = 'class-10' AND s.code = 'mathematics'), 'triangles', 'Triangles', 'triangles', 5, 5);

-- Sample CBSE Class 10 Science Chapters
INSERT INTO chapters (subject_id, code, name, slug, chapter_number, sort_order) VALUES
  ((SELECT s.id FROM subjects s JOIN classes c ON s.class_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.code = 'cbse' AND c.code = 'class-10' AND s.code = 'science'), 'chemical-reactions', 'Chemical Reactions and Equations', 'chemical-reactions', 1, 1),
  ((SELECT s.id FROM subjects s JOIN classes c ON s.class_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.code = 'cbse' AND c.code = 'class-10' AND s.code = 'science'), 'acids-bases-salts', 'Acids, Bases and Salts', 'acids-bases-salts', 2, 2),
  ((SELECT s.id FROM subjects s JOIN classes c ON s.class_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.code = 'cbse' AND c.code = 'class-10' AND s.code = 'science'), 'life-processes', 'Life Processes', 'life-processes', 3, 3),
  ((SELECT s.id FROM subjects s JOIN classes c ON s.class_id = c.id JOIN boards b ON c.board_id = b.id WHERE b.code = 'cbse' AND c.code = 'class-10' AND s.code = 'science'), 'light-reflection', 'Light - Reflection and Refraction', 'light-reflection', 4, 4);

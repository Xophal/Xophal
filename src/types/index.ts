export interface Board {
  id: string;
  code: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface Class {
  id: string;
  board_id: string;
  code: string;
  name: string;
  slug: string;
  grade_number: number | null;
  is_active: boolean;
  sort_order: number;
  board?: Board;
}

export interface Subject {
  id: string;
  class_id: string;
  code: string;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  color: string | null;
  is_active: boolean;
  sort_order: number;
  class?: Class;
}

export interface Chapter {
  id: string;
  subject_id: string;
  code: string;
  name: string;
  slug: string;
  chapter_number: number | null;
  is_active: boolean;
  sort_order: number;
  subject?: Subject;
}

export interface Topic {
  id: string;
  chapter_id: string;
  code: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  chapter?: Chapter;
}

export interface QuestionType {
  id: string;
  code: string;
  name: string;
}

export interface DifficultyLevel {
  id: string;
  code: string;
  name: string;
  color: string | null;
}

export interface QuestionOption {
  id: string;
  question_id: string;
  option_text: string;
  option_html: string | null;
  image_url: string | null;
  is_correct: boolean;
  sort_order: number;
}

export interface Question {
  id: string;
  question_type_id: string;
  difficulty_level_id: string | null;
  topic_id: string | null;
  chapter_id: string | null;
  subject_id: string | null;
  question_text: string;
  language_id: string | null;
  question_html: string | null;
  explanation: string | null;
  explanation_html: string | null;
  image_url: string | null;
  marks: number;
  negative_marks: number;
  time_seconds: number;
  is_active: boolean;
  status?: "draft" | "review" | "approved" | "published" | "rejected" | "archived";
  tags?: string[] | null;
  question_type?: QuestionType;
  difficulty_level?: DifficultyLevel;
  options?: QuestionOption[];
}

export interface MockTest {
  id: string;
  test_type_id: string;
  title: string;
  slug: string;
  description: string | null;
  subject_id: string | null;
  chapter_id: string | null;
  total_questions: number;
  total_marks: number;
  duration_minutes: number;
  passing_marks: number | null;
  negative_marking: boolean;
  negative_marks_ratio: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  is_premium: boolean;
  is_published: boolean;
  year: number | null;
  instructions: string | null;
}

export interface TestAttempt {
  id: string;
  user_id: string;
  mock_test_id: string;
  status: "in_progress" | "submitted" | "expired";
  started_at: string;
  submitted_at: string | null;
  time_spent_seconds: number;
  total_questions: number;
  answered_count: number;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  marks_obtained: number;
  total_marks: number;
  percentage: number;
  mock_test?: MockTest;
}

export interface TestResponse {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option_ids: string[] | null;
  text_answer: string | null;
  numerical_answer: number | null;
  is_correct: boolean | null;
  marks_awarded: number;
  time_spent_seconds: number;
  is_bookmarked: boolean;
  is_review_later: boolean;
  is_visited: boolean;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  is_active?: boolean;
  is_premium: boolean;
  premium_expires_at: string | null;
  email_verified?: boolean;
  daily_goal_minutes: number;
  current_streak: number;
  longest_streak: number;
  total_xp: number;
  level: number;
  board_id: string | null;
  class_id: string | null;
  role_id: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  bio?: string | null;
  settings?: {
    email_notifications?: boolean;
    weekly_digest?: boolean;
    test_reminders?: boolean;
    sound_effects?: boolean;
  } | null;
  roles?: Array<{ code: string; name: string }> | null;
}

export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  duration_days: number;
  features: string[];
  is_active: boolean;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface DashboardStats {
  totalTestsTaken: number;
  averageScore: number;
  currentStreak: number;
  totalXP: number;
  level: number;
  questionsAttempted: number;
  questionsCorrect: number;
  studyTimeMinutes: number;
  weakTopics: { topic: Topic; accuracy: number }[];
  strongTopics: { topic: Topic; accuracy: number }[];
  recentAttempts: TestAttempt[];
  dailyGoalProgress: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface ImportIssue {
  rowIndex: number;
  field?: string;
  message: string;
  severity: "error" | "warning";
}

export interface ImportPreviewResult {
  entityType: string;
  format: ImportFormat;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateCount: number;
  previewRows: unknown[];
  issues: ImportIssue[];
}

export type ImportFormat = "CSV" | "XLSX" | "JSON";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

import { publicEnv } from "@/lib/env";

export const APP_NAME = "Xophal";
export const APP_DESCRIPTION =
  "Board-focused learning and mock test platform for Class 9 and 10 students of CBSE and Assam Board, with notes, practice sets, and future-ready study resources.";
export const APP_URL = publicEnv.NEXT_PUBLIC_APP_URL;

export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  adminLogin: "/admin/login",
  adminRegister: "/admin/register",
  verifyEmail: "/verify-email",
  dashboard: "/dashboard",
  learn: "/learn",
  tests: "/tests",
  analytics: "/analytics",
  profile: "/profile",
  settings: "/settings",
  bookmarks: "/bookmarks",
  achievements: "/achievements",
  leaderboard: "/leaderboard",
  certificates: "/certificates",
  notifications: "/notifications",
  studyPlanner: "/study-planner",
  pricing: "/pricing",
  blog: "/blog",
  admin: "/admin",
} as const;

export const ADMIN_ROLES = ["super_admin", "admin", "content_manager", "reviewer"] as const;

export const FALLBACK_BOARDS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    code: "seba",
    name: "Board of Secondary Education, Assam (SEBA)",
    slug: "seba",
    description: "Assam Board of Secondary Education for Class 9 and 10",
    logo_url: null,
    is_active: true,
    sort_order: 1,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    code: "cbse",
    name: "Central Board of Secondary Education (CBSE)",
    slug: "cbse",
    description: "National-level board of education in India",
    logo_url: null,
    is_active: true,
    sort_order: 2,
  },
] as const;

export const FALLBACK_CLASSES: Record<string, Array<{ id: string; board_id: string; code: string; name: string; slug: string; grade_number: number; is_active: boolean; sort_order: number }>> = {
  "11111111-1111-4111-8111-111111111111": [
    { id: "33333333-3333-4333-8333-333333333333", board_id: "11111111-1111-4111-8111-111111111111", code: "class-9", name: "Class 9", slug: "class-9", grade_number: 9, is_active: true, sort_order: 1 },
    { id: "44444444-4444-4444-8444-444444444444", board_id: "11111111-1111-4111-8111-111111111111", code: "class-10", name: "Class 10", slug: "class-10", grade_number: 10, is_active: true, sort_order: 2 },
  ],
  "22222222-2222-4222-8222-222222222222": [
    { id: "55555555-5555-4555-8555-555555555555", board_id: "22222222-2222-4222-8222-222222222222", code: "class-9", name: "Class 9", slug: "class-9", grade_number: 9, is_active: true, sort_order: 1 },
    { id: "66666666-6666-4666-8666-666666666666", board_id: "22222222-2222-4222-8222-222222222222", code: "class-10", name: "Class 10", slug: "class-10", grade_number: 10, is_active: true, sort_order: 2 },
  ],
};

export const TEST_STATUS = {
  IN_PROGRESS: "in_progress",
  SUBMITTED: "submitted",
  EXPIRED: "expired",
} as const;

export const PAYMENT_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
  REFUNDED: "refunded",
} as const;

export const XP_REWARDS = {
  CORRECT_ANSWER: 10,
  TEST_COMPLETION: 50,
  PERFECT_SCORE: 200,
  DAILY_GOAL: 25,
  STREAK_BONUS: 15,
} as const;

export const CACHE_KEYS = {
  BOARDS: "boards:all",
  CLASSES: (boardId: string) => `classes:${boardId}`,
  SUBJECTS: (classId: string) => `subjects:${classId}`,
  CHAPTERS: (subjectId: string) => `chapters:${subjectId}`,
  TOPICS: (chapterId: string) => `topics:${chapterId}`,
  MOCK_TESTS: (filters: string) => `mock-tests:${filters}`,
  DASHBOARD: (userId: string) => `dashboard:${userId}`,
} as const;

export const CACHE_TTL = {
  SHORT: 300,
  MEDIUM: 3600,
  LONG: 86400,
} as const;

import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const otpEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address").max(255),
});

export const otpRequestSchema = otpEmailSchema.extend({
  intent: z.enum(["login", "signup", "admin-login"]),
  fullName: z.string().trim().min(2).max(255).optional(),
  boardId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
}).superRefine((value, context) => {
  if (value.intent === "signup" && !value.fullName) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["fullName"], message: "Full name is required" });
  }
});

export const otpVerifySchema = otpEmailSchema.extend({
  token: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  intent: z.enum(["login", "signup", "admin-login"]),
});

export const registerSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
  boardId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const adminRegisterSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(9, "Phone number must be at least 9 characters").optional().or(z.literal("")),
  role: z.enum(["admin", "content_manager", "reviewer", "super_admin"]).default("admin"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const boardSchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(200),
  description: z.string().optional(),
  logo_url: z.string().url().optional().or(z.literal("")),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

export const classSchema = z.object({
  board_id: z.string().uuid(),
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(200),
  grade_number: z.number().int().min(1).max(12).optional(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

export const subjectSchema = z.object({
  class_id: z.string().uuid(),
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(200),
  color: z.string().optional(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

export const chapterSchema = z.object({
  subject_id: z.string().uuid(),
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(300),
  slug: z.string().min(2).max(300),
  chapter_number: z.number().int().optional(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

export const topicSchema = z.object({
  chapter_id: z.string().uuid(),
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(300),
  slug: z.string().min(2).max(300),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

export const questionOptionSchema = z.object({
  option_text: z.string().min(1),
  option_html: z.string().optional(),
  image_url: z.string().url().optional().or(z.literal("")),
  is_correct: z.boolean().default(false),
  sort_order: z.number().int().default(0),
});

export const questionSchema = z.object({
  question_type_id: z.string().uuid(),
  difficulty_level_id: z.string().uuid().optional(),
  topic_id: z.string().uuid().optional(),
  chapter_id: z.string().uuid().optional(),
  subject_id: z.string().uuid().optional(),
  question_text: z.string().min(5),
  question_html: z.string().optional(),
  explanation: z.string().optional(),
  explanation_html: z.string().optional(),
  image_url: z.string().url().optional().or(z.literal("")),
  marks: z.number().positive().default(1),
  negative_marks: z.number().min(0).default(0),
  time_seconds: z.number().int().positive().default(60),
  tags: z.array(z.string()).optional(),
  options: z.array(questionOptionSchema).optional(),
  is_active: z.boolean().default(true),
});

export const mockTestSchema = z.object({
  test_type_id: z.string().uuid(),
  title: z.string().min(5).max(500),
  slug: z.string().min(5).max(500),
  description: z.string().optional(),
  subject_id: z.string().uuid().optional(),
  chapter_id: z.string().uuid().optional(),
  duration_minutes: z.number().int().positive().default(60),
  passing_marks: z.number().optional(),
  negative_marking: z.boolean().default(false),
  negative_marks_ratio: z.number().min(0).max(1).default(0.25),
  shuffle_questions: z.boolean().default(true),
  shuffle_options: z.boolean().default(true),
  is_premium: z.boolean().default(false),
  is_published: z.boolean().default(false),
  year: z.number().int().optional(),
  instructions: z.string().optional(),
  question_ids: z.array(z.string().uuid()).optional(),
});

export const testResponseSchema = z.object({
  question_id: z.string().uuid(),
  selected_option_ids: z.array(z.string().uuid()).optional(),
  text_answer: z.string().optional(),
  numerical_answer: z.number().optional(),
  time_spent_seconds: z.number().int().default(0),
  is_bookmarked: z.boolean().default(false),
  is_review_later: z.boolean().default(false),
});

export const finalTestSubmissionSchema = z.object({
  attempt_id: z.string().uuid(),
  expired: z.boolean().optional().default(false),
  responses: z.array(testResponseSchema).max(500),
});

export const profileUpdateSchema = z.object({
  full_name: z.string().trim().min(2).max(255).optional(),
  phone: z.string().trim().max(20).optional(),
  date_of_birth: z.string().max(10).optional(),
  gender: z.enum(["female", "male", "non_binary", "prefer_not_to_say"]).optional(),
  bio: z.string().trim().max(500).optional(),
  board_id: z.string().uuid().optional(),
  class_id: z.string().uuid().optional(),
  daily_goal_minutes: z.number().int().min(15).max(480).optional(),
  settings: z.object({
    email_notifications: z.boolean().optional(),
    weekly_digest: z.boolean().optional(),
    test_reminders: z.boolean().optional(),
    sound_effects: z.boolean().optional(),
  }).partial().optional(),
});

export const couponSchema = z.object({
  code: z.string().min(3).max(50),
  description: z.string().optional(),
  discount_type: z.enum(["percentage", "fixed"]),
  discount_value: z.number().positive(),
  max_uses: z.number().int().default(0),
  min_order_amount: z.number().default(0),
  valid_until: z.string().optional(),
  is_active: z.boolean().default(true),
});

export const importFormatEnum = z.enum(["CSV", "XLSX", "JSON"]);

export const importJobSchema = z.object({
  entity_type: z.string().min(2).max(100),
  format: importFormatEnum,
  filename: z.string().min(1).optional(),
  file_path: z.string().min(1).optional(),
  csv: z.string().optional(),
  rows: z.array(z.record(z.string(), z.any())).optional(),
  options: z.record(z.string(), z.any()).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type OtpRequestInput = z.infer<typeof otpRequestSchema>;
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type AdminRegisterInput = z.infer<typeof adminRegisterSchema>;
export type BoardInput = z.infer<typeof boardSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
export type MockTestInput = z.infer<typeof mockTestSchema>;
export type TestResponseInput = z.infer<typeof testResponseSchema>;
export type FinalTestSubmissionInput = z.infer<typeof finalTestSubmissionSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type ImportJobInput = z.infer<typeof importJobSchema>;

import { describe, expect, it } from "vitest";
import { sanitizeQuestionReview } from "@/app/api/mock-tests/results/[attemptId]/route";
import { finalTestSubmissionSchema, loginSchema, registerSchema } from "@/lib/validations";

describe("authentication validation", () => {
  it("accepts valid login credentials", () => {
    expect(loginSchema.safeParse({ email: "student@example.com", password: "secret1" }).success).toBe(true);
  });

  it("rejects invalid login credentials", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "short" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain("Invalid email address");
      expect(result.error.issues.map((issue) => issue.message)).toContain("Password must be at least 6 characters");
    }
  });

  it("requires matching registration passwords", () => {
    const result = registerSchema.safeParse({
      fullName: "Test Student",
      email: "student@example.com",
      password: "Secret123",
      confirmPassword: "different",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["confirmPassword"], message: "Passwords don't match" })
      );
    }
  });

  it("enforces a strong minimum password for registration", () => {
    expect(
      registerSchema.safeParse({
        fullName: "Test Student",
        email: "student@example.com",
        password: "short7",
        confirmPassword: "short7",
      }).success
    ).toBe(false);
  });

  it("ignores client-controlled expired flags in test submissions", () => {
    const result = finalTestSubmissionSchema.safeParse({
      attempt_id: "123e4567-e89b-12d3-a456-426614174000",
      expired: true,
      responses: [],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("expired");
    }
  });

  it("strips answer keys and explanations when solutions are hidden", () => {
    const sanitized = sanitizeQuestionReview(
      {
        question_text: "What is 2 + 2?",
        explanation: "Because 2 + 2 = 4.",
        options: [
          { id: "a", option_text: "3", is_correct: false },
          { id: "b", option_text: "4", is_correct: true },
        ],
      },
      false
    );

    expect(sanitized.explanation).toBeNull();
    expect(sanitized.question_options).toEqual([
      { id: "a", option_text: "3" },
      { id: "b", option_text: "4" },
    ]);
  });
});

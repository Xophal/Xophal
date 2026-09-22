import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/lib/validations";

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
      password: "secret1",
      confirmPassword: "different",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["confirmPassword"], message: "Passwords don't match" })
      );
    }
  });
});

import { NextRequest } from "next/server";
import { apiSuccess, ApiError, handleApiError, assertTrustedOrigin } from "@/lib/api-utils";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";
import { authRateLimit } from "@/lib/redis";
import { promoteMainAdminProfile } from "@/lib/auth";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.errors[0]?.message || "Invalid credentials", "VALIDATION_ERROR");

    // Apply rate limit per-IP + email key
    try {
      const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
      const emailKey = parsed.data.email.toLowerCase();
      if (!authRateLimit && process.env.NODE_ENV === "production") {
        throw new ApiError(503, "Authentication protection is temporarily unavailable.", "RATE_LIMIT_NOT_CONFIGURED");
      }
      if (authRateLimit) {
        const rlKey = `login:${ip}:${emailKey}`;
        const { success } = await authRateLimit.limit(rlKey);
        if (!success) throw new ApiError(429, "Too many login attempts. Please try again later.", "RATE_LIMIT");
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      // A limiter transport error must not silently disable brute-force
      // protection. Fail closed in production; stay permissive in dev so a
      // missing Redis does not block local sign-in.
      console.error("Login rate limiter failure", err);
      if (process.env.NODE_ENV === "production") {
        throw new ApiError(503, "Authentication protection is temporarily unavailable.", "RATE_LIMIT_UNAVAILABLE");
      }
    }

    const supabase = await createRouteHandlerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error || !data?.session) {
      const providerCode = (error?.code ?? "").toLowerCase();
      const providerMessage = (error?.message ?? "").toLowerCase();
      const isUnconfirmed =
        ["user_requires_confirm", "email_not_confirmed", "user_not_confirmed"].includes(providerCode) ||
        /email.*not confirmed|confirm.*email/.test(providerMessage);

      if (isUnconfirmed) {
        throw new ApiError(
          403,
          "Your email address is not verified yet. Use the email code option to verify it, or request a new code from the verification page.",
          "EMAIL_NOT_VERIFIED"
        );
      }

      throw new ApiError(401, "Invalid email or password.", "UNAUTHORIZED");
    }

    // Ensure a configured main administrator is raised to super_admin even if
    // their existing profile still carries a student role. No-op for everyone
    // else (no database work is performed for non-main-admin emails).
    if (data.user?.email) {
      await promoteMainAdminProfile({
        userId: data.user.id,
        email: data.user.email,
        profile: null,
      });
    }

    return apiSuccess({ message: "Signed in" });
  } catch (error) {
    return handleApiError(error);
  }
}

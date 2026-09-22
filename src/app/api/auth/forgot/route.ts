import { NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { z } from "zod";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";
import { apiSuccess, ApiError, handleApiError, assertTrustedOrigin } from "@/lib/api-utils";
import { authRateLimit } from "@/lib/redis";

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const parsed = forgotPasswordSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.errors[0]?.message || "Enter a valid email address", "VALIDATION_ERROR");
    }

    const supabase = await createRouteHandlerClient();
    // Rate limit forgot-password requests by IP+email to avoid account enumeration abuse.
    try {
      const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
      const emailKey = parsed.data.email.toLowerCase();
      if (!authRateLimit && process.env.NODE_ENV === "production") {
        throw new ApiError(503, "Authentication protection is temporarily unavailable.", "RATE_LIMIT_NOT_CONFIGURED");
      }
      if (authRateLimit) {
        const rlKey = `forgot:${ip}:${emailKey}`;
        const { success } = await authRateLimit.limit(rlKey);
        if (!success) {
          throw new ApiError(429, "Too many requests. Please try again later.", "RATE_LIMIT");
        }
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      // Non-fatal: continue if limiter has issues
    }
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email.toLowerCase(), {
      redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
    });
    if (error) console.error("Password reset request failed", error);

    // This response deliberately does not reveal whether the address has an
    // account, preventing email-account enumeration.
    return apiSuccess({ message: "If an account exists for that email, a reset link has been sent." });
  } catch (error) {
    return handleApiError(error);
  }
}

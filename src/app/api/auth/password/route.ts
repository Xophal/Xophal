import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { authRateLimit } from "@/lib/redis";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: z.string().min(8, "New password must be at least 8 characters.").max(128),
});

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const session = await requireAuth();
    if (!session?.user.email) {
      throw new ApiError(401, "Sign in again to change your password.", "UNAUTHORIZED");
    }

    const { currentPassword, newPassword } = await validateBody(
      changePasswordSchema,
      await request.json(),
    );
    if (currentPassword === newPassword) {
      throw new ApiError(400, "Choose a new password that is different from your current one.", "PASSWORD_UNCHANGED");
    }

    try {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || request.headers.get("x-real-ip")
        || "unknown";
      if (!authRateLimit && process.env.NODE_ENV === "production") {
        throw new ApiError(503, "Authentication protection is temporarily unavailable.", "RATE_LIMIT_NOT_CONFIGURED");
      }
      if (authRateLimit) {
        const { success } = await authRateLimit.limit(`change-password:${ip}:${session.user.id}`);
        if (!success) {
          throw new ApiError(429, "Too many attempts. Wait a moment before trying again.", "RATE_LIMIT");
        }
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error("Change-password rate limiter failure", error);
      if (process.env.NODE_ENV === "production") {
        throw new ApiError(503, "Authentication protection is temporarily unavailable.", "RATE_LIMIT_UNAVAILABLE");
      }
    }

    const supabase = await createRouteHandlerClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    });

    if (signInError || data.user?.id !== session.user.id) {
      throw new ApiError(400, "Your current password is incorrect.", "CURRENT_PASSWORD_INVALID");
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      console.error("Password update failed", { code: updateError.code, status: updateError.status });
      if (updateError.status === 400 || updateError.status === 422) {
        throw new ApiError(
          400,
          "The new password was rejected. Choose a different password that meets the account requirements.",
          "PASSWORD_REJECTED",
        );
      }
      throw new ApiError(503, "We couldn't update your password right now. Please try again.", "PASSWORD_UPDATE_FAILED");
    }

    return apiSuccess({ message: "Your password has been changed." });
  } catch (error) {
    return handleApiError(error);
  }
}

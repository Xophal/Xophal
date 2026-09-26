import { NextRequest } from "next/server";
import { apiSuccess, ApiError, handleApiError, assertTrustedOrigin } from "@/lib/api-utils";
import { z } from "zod";
import { authRateLimit } from "@/lib/redis";

const bodySchema = z.object({ email: z.string().email() });

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.errors[0]?.message || "Invalid payload", "VALIDATION_ERROR");

    // Rate limit resend requests by IP+email
    try {
      const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
      const emailKey = parsed.data.email.toLowerCase();
      if (!authRateLimit && process.env.NODE_ENV === "production") {
        throw new ApiError(503, "Authentication protection is temporarily unavailable.", "RATE_LIMIT_NOT_CONFIGURED");
      }
      if (authRateLimit) {
        const rlKey = `resend:${ip}:${emailKey}`;
        const { success } = await authRateLimit.limit(rlKey);
        if (!success) throw new ApiError(429, "Too many resend attempts. Please try again later.", "RATE_LIMIT");
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      // Fail closed in production so a limiter outage cannot be used to spam
      // verification emails at arbitrary addresses.
      console.error("Resend rate limiter failure", err);
      if (process.env.NODE_ENV === "production") {
        throw new ApiError(503, "Authentication protection is temporarily unavailable.", "RATE_LIMIT_UNAVAILABLE");
      }
    }

    const { createRouteHandlerClient } = await import("@/lib/supabase/route-handler");
    const { publicEnv } = await import("@/lib/env");
    const routeClient = await createRouteHandlerClient();

    const { error } = await routeClient.auth.resend({
      type: "signup",
      email: parsed.data.email,
      options: { emailRedirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback` },
    });

    if (error) {
      // Do not reveal whether the email exists; give a generic response.
      console.warn("Resend verification error:", error);
    }

    return apiSuccess({ message: "If this email exists, a verification link has been sent." });
  } catch (error) {
    return handleApiError(error);
  }
}

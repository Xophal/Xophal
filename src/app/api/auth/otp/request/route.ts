import { otpRequestSchema } from "@/lib/validations";
import { NextRequest } from "next/server";
import { ApiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";
import { authRateLimit } from "@/lib/redis";

// Minimum seconds the client must wait before requesting another code.
// Supabase Auth enforces its own per-email resend interval (default ~60s);
// lowering this below that only re-enables the button earlier — the server will
// still return a 429 until its interval has elapsed. The effective value is
// reported to the form so the countdown always reflects reality.
const OTP_RESEND_SECONDS = Math.max(30, Number(process.env.OTP_RESEND_SECONDS ?? 60) || 60);

function getRequestIp(request: NextRequest) {
  return request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const data = await validateBody(otpRequestSchema, await request.json());
    if (data.intent === "admin-login" && data.fullName) {
      throw new ApiError(400, "Invalid OTP request", "VALIDATION_ERROR");
    }

    if (!authRateLimit && process.env.NODE_ENV === "production") {
      throw new ApiError(503, "Authentication protection is temporarily unavailable.", "RATE_LIMIT_NOT_CONFIGURED");
    }

    if (authRateLimit) {
      const { success } = await authRateLimit.limit(`otp-request:${getRequestIp(request)}:${data.email}`);
      if (!success) throw new ApiError(429, "Too many code requests. Please try again later.", "RATE_LIMIT");
    }

    let error: { status?: number; code?: string; message?: string } | null = null;
    try {
      const supabase = await createRouteHandlerClient();
      ({ error } = await supabase.auth.signInWithOtp({
        email: data.email,
        options: {
          // Opt intentionally out of a Magic Link email redirect URL. Verified
          // via 6-digit OTP, so no callback URL is required and no localhost
          // link is embedded in the email (which breaks when opened from a
          // phone/another device). Configure the Supabase "Magic Link" email
          // template to render `{{ .Token }}` so the code is visible.
          shouldCreateUser: data.intent === "signup",
          data: data.intent === "signup"
            ? { full_name: data.fullName, board_id: data.boardId ?? null, class_id: data.classId ?? null }
            : undefined,
        },
      }));
    } catch (requestError) {
      console.error("OTP provider request failed", requestError);
      throw new ApiError(503, "Authentication email service is temporarily unavailable. Please try again later.", "OTP_PROVIDER_UNAVAILABLE");
    }

    if (error) {
      console.error("OTP request failed", error);
      const providerMessage = error.message || "";
      if (error.status === 429 || error.code === "over_email_send_rate_limit" || /only request this after/i.test(providerMessage)) {
        const waitSeconds = Number(providerMessage.match(/after\s+(\d+)\s+seconds?/i)?.[1] ?? OTP_RESEND_SECONDS);
        throw new ApiError(
          429,
          waitSeconds ? `Please wait ${waitSeconds} seconds before requesting another code.` : "Please wait before requesting another code.",
          "OTP_PROVIDER_RATE_LIMIT",
          waitSeconds
        );
      }
      throw new ApiError(400, "We could not send a code. Check the email and try again.", "OTP_REQUEST_FAILED");
    }

    return apiSuccess({
      message: "If the address is eligible, a verification code has been sent.",
      resendAfterSeconds: OTP_RESEND_SECONDS,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
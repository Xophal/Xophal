import { NextRequest } from "next/server";
import { ApiError, apiSuccess, handleApiError, validateBody, assertTrustedOrigin } from "@/lib/api-utils";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { authRateLimit } from "@/lib/redis";
import { isAdminRole } from "@/lib/roles";
import { isMainAdminEmail } from "@/lib/admin-approval";
import { promoteMainAdminProfile } from "@/lib/auth";
import { otpVerifySchema } from "@/lib/validations";

function getRequestIp(request: NextRequest) {
  return request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const data = await validateBody(otpVerifySchema, await request.json());

    if (!authRateLimit && process.env.NODE_ENV === "production") {
      throw new ApiError(503, "Authentication protection is temporarily unavailable.", "RATE_LIMIT_NOT_CONFIGURED");
    }

    if (authRateLimit) {
      const { success } = await authRateLimit.limit(`otp-verify:${getRequestIp(request)}:${data.email}`);
      if (!success) throw new ApiError(429, "Too many verification attempts. Please request a new code later.", "RATE_LIMIT");
    }

    const supabase = await createRouteHandlerClient();
    const { data: authData, error } = await supabase.auth.verifyOtp({
      email: data.email,
      token: data.token,
      type: "email",
    });

    if (error || !authData.user || !authData.session) {
      throw new ApiError(401, "That code is invalid or expired. Request a new code and try again.", "OTP_INVALID");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*, roles(code, name)")
      .eq("id", authData.user.id)
      .maybeSingle();

    // If the verified identity is a configured main administrator, raise its
    // profile to super_admin so /admin access is not blocked by a student role
    // (e.g. when the account was originally created via OTP signup or Google).
    const resolvedProfile = isMainAdminEmail(data.email)
      ? await promoteMainAdminProfile({ userId: authData.user.id, email: data.email, profile })
      : profile;

    if (data.intent === "admin-login" && !isAdminRole(resolvedProfile)) {
      await supabase.auth.signOut();
      throw new ApiError(403, "Admin access is required for this sign-in.", "FORBIDDEN");
    }

    if (resolvedProfile?.is_active === false) {
      await supabase.auth.signOut();
      throw new ApiError(403, "Account deactivated", "ACCOUNT_DEACTIVATED");
    }

    const adminClient = createAdminClient();
    const { error: verificationError } = await adminClient
      .from("profiles")
      .update({ email_verified: true })
      .eq("id", authData.user.id);

    if (verificationError) {
      console.error("OTP verification profile sync failed", verificationError);
      await supabase.auth.signOut();
      throw new ApiError(500, "Your email was verified, but account setup could not be completed.", "PROFILE_SYNC_FAILED");
    }

    if (data.intent === "signup") {
      const metadata = authData.user.user_metadata ?? {};
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: typeof metadata.full_name === "string" ? metadata.full_name : undefined,
          board_id: typeof metadata.board_id === "string" ? metadata.board_id : null,
          class_id: typeof metadata.class_id === "string" ? metadata.class_id : null,
        })
        .eq("id", authData.user.id);

      if (profileError) {
        console.error("OTP profile update failed", profileError);
        throw new ApiError(500, "Your account was verified, but profile setup could not be completed.", "PROFILE_SETUP_FAILED");
      }
    }

    return apiSuccess({
      message: "Signed in",
      isAdmin: isAdminRole(resolvedProfile),
      redirect: isAdminRole(resolvedProfile) ? "/admin" : "/dashboard",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
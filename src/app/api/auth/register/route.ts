import { NextRequest } from "next/server";
import { ApiError, apiSuccess, handleApiError, validateBody, assertTrustedOrigin } from "@/lib/api-utils";
import { buildProfileUpsertPayload } from "@/lib/auth";
import { adminRegisterSchema, registerSchema } from "@/lib/validations";
// Import admin client lazily inside the request handler to avoid
// throwing during module initialization if server-side env validation
// fails. This lets us return a proper ApiError from
// `ensureSupabaseRegistrationConfig` instead of a 500 on import.
import { authRateLimit } from "@/lib/redis";
import { ensureSupabaseRegistrationConfig } from "@/lib/supabase/check";
import { assertAdminApprovalConfigured, isMainAdminEmail, sendAdminApprovalRequest } from "@/lib/admin-approval";

// `ensureSupabaseRegistrationConfig` is provided from `src/lib/supabase/check.ts`

function formatSupabaseError(error: unknown) {
  if (!error) return "Unknown Supabase error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || error.toString();

  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;

    const tryStringProp = (key: string) => {
      const v = obj[key];
      return typeof v === "string" ? v : null;
    };

    const propsToCheck = [
      "message",
      "error",
      "msg",
      "statusText",
      "error_description",
    ];

    for (const p of propsToCheck) {
      const found = tryStringProp(p);
      if (found) return found;
    }

    const nestedData = obj["data"] ?? (obj["response"] && (obj["response"] as Record<string, unknown>)["data"]);
    if (nestedData && typeof nestedData === "object") {
      const nd = nestedData as Record<string, unknown>;
      for (const p of ["msg", "message", "error"]) {
        const v = nd[p];
        if (typeof v === "string") return v;
      }
    }

    const nestedBody = (obj["response"] && (obj["response"] as Record<string, unknown>)["body"]) ?? obj["body"];
    if (nestedBody && typeof nestedBody === "object") {
      const nb = nestedBody as Record<string, unknown>;
      for (const p of ["msg", "message", "error"]) {
        const v = nb[p];
        if (typeof v === "string") return v;
      }
    }

    const maybeToString = (obj as unknown as { toString?: () => string }).toString;
    if (typeof maybeToString === "function") {
      const str = maybeToString.call(obj);
      if (str !== "[object Object]") return str;
    }

    const descriptors = Object.getOwnPropertyNames(obj).reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {} as Record<string, unknown>);

    try {
      return JSON.stringify(descriptors, null, 2);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

export async function POST(request: NextRequest) {
  try {
    // Quick fail when server-side Supabase admin config is missing.
    assertTrustedOrigin(request);
    ensureSupabaseRegistrationConfig();

    const body = await request.json();
    const normalizedBody = {
      ...body,
      email: typeof body?.email === "string" ? body.email.trim().toLowerCase() : body?.email,
      fullName: typeof body?.fullName === "string" ? body.fullName.trim() : body?.fullName,
    };
    const isAdminRequest = Boolean(normalizedBody?.role && ["admin", "content_manager", "super_admin", "reviewer"].includes(normalizedBody.role));

    // Rate limit registration attempts by IP+email to mitigate abuse.
    try {
      const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
      const emailKey = (normalizedBody?.email || "").toString().toLowerCase();
      if (!authRateLimit && process.env.NODE_ENV === "production") {
        throw new ApiError(503, "Authentication protection is temporarily unavailable.", "RATE_LIMIT_NOT_CONFIGURED");
      }
      if (authRateLimit) {
        const rlKey = `register:${ip}:${emailKey}`;
        const { success } = await authRateLimit.limit(rlKey);
        if (!success) {
          throw new ApiError(429, "Too many registration attempts. Please try again later.", "RATE_LIMIT");
        }
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      // Non-fatal: allow registration to continue if rate limiter fails unexpectedly.
    }
    if (isAdminRequest && process.env.ENABLE_ADMIN_SELF_REGISTER !== "true") {
      throw new ApiError(403, "Privileged accounts can only be created by an authorized administrator.", "FORBIDDEN");
    }

    if (isAdminRequest) {
      assertAdminApprovalConfigured();
    }

    const adminData = isAdminRequest ? await validateBody(adminRegisterSchema, normalizedBody) : null;
    const studentData = !isAdminRequest ? await validateBody(registerSchema, normalizedBody) : null;
    const data = adminData ?? studentData;

    if (!data) {
      throw new ApiError(400, "Invalid registration payload.", "INVALID_PAYLOAD");
    }

    const isMainAdmin = isAdminRequest && isMainAdminEmail(data.email);
    const selectedRole = isMainAdmin ? "super_admin" : "student";

    ensureSupabaseRegistrationConfig();
    let adminClient;
    try {
      const mod = await import("@/lib/supabase/admin");
      adminClient = mod.createAdminClient();
    } catch (err) {
      if (err instanceof ApiError) throw err;
      console.error("Registration service error during admin client init:", err);
      throw new ApiError(
        503,
        "Registration service is unavailable. Please check server configuration.",
        "REGISTRATION_SERVICE_UNAVAILABLE"
      );
    }

    const { data: existingUsers } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const duplicateUser = existingUsers?.users.find(
      (user) => user.email?.trim().toLowerCase() === data.email.trim().toLowerCase()
    );

    if (duplicateUser) {
      throw new ApiError(
        409,
        "This email is already registered in the current Xophal database. Please use a different email address or remove the stale user from Supabase Auth > Users.",
        "EMAIL_ALREADY_REGISTERED"
      );
    }

    // Create users unconfirmed so they receive a verification email. We
    // will attempt to trigger Supabase's resend flow below. In staging the
    // team previously auto-confirmed users; keep behavior configurable later.
    const { data: userData, error: createUserError } = await adminClient.auth.admin.createUser({
      email: data.email,
      password: data.password,
      // do NOT auto-confirm here so the user must verify their email
      // through the provider's verification workflow.
      email_confirm: false,
      user_metadata: { full_name: data.fullName },
    });

    if (createUserError || !userData?.user) {
      const supabaseMessage = formatSupabaseError(createUserError) || "We could not create your account.";
      const message = /already registered|already exists|email.*registered/i.test(supabaseMessage)
        ? "This email is already registered in the current Xophal database. Please use a different email address or remove the stale user from Supabase Auth > Users."
        : supabaseMessage;
      console.error("Supabase account creation failed", createUserError);
      throw new ApiError(409, message, "REGISTRATION_FAILED");
    }

    const { data: roleRow } = await adminClient
      .from("roles")
      .select("id")
      .eq("code", selectedRole)
      .maybeSingle();

    const cleanedBoardId = !isAdminRequest && studentData?.boardId ? studentData.boardId : null;
    const cleanedClassId = !isAdminRequest && studentData?.classId ? studentData.classId : null;

    const validBoardId = cleanedBoardId
      ? ((await adminClient.from("boards").select("id").eq("id", cleanedBoardId).maybeSingle()).data?.id ?? null)
      : null;
    const validClassId = cleanedClassId
      ? ((await adminClient.from("classes").select("id").eq("id", cleanedClassId).maybeSingle()).data?.id ?? null)
      : null;

    const profilePayload = buildProfileUpsertPayload(userData.user.id, {
      fullName: data.fullName,
      email: data.email,
      phone: isAdminRequest && "phone" in data ? (data.phone || null) : null,
      boardId: validBoardId,
      classId: validClassId,
      roleId: roleRow?.id ?? null,
      emailVerified: Boolean(userData.user.email_confirmed_at),
    });

    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("id", userData.user.id)
      .maybeSingle();

    const { error: profileError } = existingProfile
      ? await adminClient.from("profiles").update(profilePayload).eq("id", userData.user.id)
      : await adminClient.from("profiles").insert(profilePayload);

    if (profileError) {
      console.error("Supabase profile write error:", profileError);
      throw new ApiError(
        500,
        "Your account was created but your profile details could not be saved.",
        "PROFILE_CREATE_FAILED"
      );
    }

    let approvalEmailSent = true;
    if (isAdminRequest && !isMainAdmin) {
      const { error: requestError } = await adminClient.from("admin_signup_requests").insert({
        user_id: userData.user.id,
        email: data.email,
        full_name: data.fullName,
        phone: "phone" in data ? data.phone || null : null,
        requested_role: adminData!.role,
      });

      if (requestError) {
        console.error("Admin signup request write error:", requestError);
        throw new ApiError(500, "Your account was created but the admin approval request could not be saved.", "ADMIN_REQUEST_CREATE_FAILED");
      }

      try {
        await sendAdminApprovalRequest({ email: data.email, fullName: data.fullName, requestedRole: adminData!.role ?? "admin" });
      } catch (error) {
        approvalEmailSent = false;
        console.error("Admin approval notification failed after signup was created:", error);
      }
    }

    // Send a 6-digit verification OTP code so the user can confirm their
    // email address in the verify-email flow. This matches the OTP-based
    // verification used by login and sign-up OTP flows. `signInWithOtp`
    // with `shouldCreateUser: false` sends a code to an existing user
    // without attempting to create a new session.
    try {
      const { createRouteHandlerClient } = await import("@/lib/supabase/route-handler");
      const routeClient = await createRouteHandlerClient();
      const { error: otpError } = await routeClient.auth.signInWithOtp({
        email: data.email,
        options: { shouldCreateUser: false },
      });
      if (otpError) {
        console.warn("Failed to send verification OTP after signup:", otpError);
      }
    } catch (err) {
      // Non-fatal: log and continue. The UI guides users to "Check your
      // inbox" on the verify-email page regardless.
      console.warn("Failed to trigger verification OTP:", err);
    }

    return apiSuccess({
      message: isAdminRequest && !isMainAdmin
        ? approvalEmailSent
          ? "Your admin request was sent to the two main administrators for approval."
          : "Your admin account was created and is pending approval. The administrators should review it from the admin portal."
        : "Account created successfully.",
      pendingApproval: isAdminRequest && !isMainAdmin,
      approvalEmailSent,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

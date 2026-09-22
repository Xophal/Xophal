import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminAuth } from "@/lib/auth";
import { normalizeRoleCode } from "@/lib/roles";
import { apiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const adminCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  role: z.enum(["admin", "content_manager", "reviewer", "super_admin"]).default("admin"),
});

export async function POST(request: NextRequest) {
  try {
    const { user, profile } = await requireAdminAuth();
    const body = await request.json();
    const payload = await validateBody(adminCreateSchema, body);

    // Provisioning privileged identities is intentionally restricted to the
    // highest role. A client-supplied role must never be sufficient.
    if (normalizeRoleCode(profile) !== "super_admin") {
      return apiError("Forbidden", 403, "FORBIDDEN");
    }

    const adminClient = createAdminClient();
    const { data: authUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: { full_name: payload.fullName },
    });

    if (createUserError || !authUser?.user) {
      throw new Error(createUserError?.message || "Unable to create admin user");
    }

    const { data: roleRow } = await adminClient
      .from("roles")
      .select("id")
      .eq("code", payload.role)
      .maybeSingle();

    const { error: profileError } = await adminClient.from("profiles").upsert(
      {
        id: authUser.user.id,
        email: payload.email,
        full_name: payload.fullName,
        role_id: roleRow?.id ?? null,
        email_verified: true,
        board_id: null,
        class_id: null,
      },
      { onConflict: "id" }
    );

    if (profileError) {
      throw new Error(profileError.message || "Profile creation failed");
    }

    return apiSuccess({
      email: payload.email,
      role: payload.role,
      createdBy: user.id,
      message: "Admin account created successfully.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

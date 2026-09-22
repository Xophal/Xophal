import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { normalizeRoleCode } from "@/lib/roles";

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  role: z.string().optional(),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const admin = createAdminClient();
    const { data, error } = await admin.from("profiles").select("*, roles(code, name)").eq("id", id).maybeSingle();
    if (error) throw error;

    // attach attempt counts
    const { count } = await admin.from("test_attempts").select("id", { count: "exact" }).eq("user_id", id);

    return apiSuccess({ profile: data, attemptsCount: count ?? 0 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, profile: adminProfile } = await requireAdminAuth();
    const { id } = await params;
    const body = await request.json();
    const payload = await validateBody(patchSchema, body);
    const admin = createAdminClient();

    const updates: any = {};
    if (payload.isActive !== undefined) updates.is_active = payload.isActive;

    if (payload.role) {
      // only super_admin may change roles
      if (normalizeRoleCode(adminProfile) !== "super_admin") {
        return apiSuccess({ message: "Forbidden" }, 403);
      }
      const { data: roleRow } = await admin.from("roles").select("id").eq("code", payload.role).maybeSingle();
      updates.role_id = roleRow?.id ?? null;
    }

    if (Object.keys(updates).length) {
      const { error } = await admin.from("profiles").update(updates).eq("id", id);
      if (error) throw error;
    }

    const { data, error } = await admin.from("profiles").select("*, roles(code, name)").eq("id", id).maybeSingle();
    if (error) throw error;
    return apiSuccess({ profile: data });
  } catch (error) {
    return handleApiError(error);
  }
}

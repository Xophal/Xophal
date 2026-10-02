import { NextRequest } from "next/server";
import { apiSuccess, handleApiError, getPaginationParams, paginatedResponse } from "@/lib/api-utils";
import { requireAdminAuth, requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/api-utils";
import { deliverNotificationToUsers } from "@/lib/notification-delivery";
import { z } from "zod";

const createNotificationSchema = z.object({
  title: z.string().trim().min(1).max(500),
  message: z.string().trim().min(1).max(10_000),
  type: z.enum(["info", "success", "warning", "announcement"]).default("info"),
  link_url: z.string().trim().max(2048).nullable().optional(),
  user_ids: z.array(z.string().uuid()).max(500).default([]),
  is_global: z.boolean().default(false),
  send_email: z.boolean().default(false),
  send_push: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    const { searchParams } = request.nextUrl;
    const { page, limit, offset } = getPaginationParams(searchParams);
    const scope = searchParams.get("scope");

    let query = createAdminClient()
      .from("notifications")
      .select("id, title, message, type, link_url, is_global, is_read, created_at, profiles(full_name, email)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (scope === "global") query = query.eq("is_global", true);
    if (scope === "targeted") query = query.eq("is_global", false);

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    return apiSuccess(paginatedResponse(data ?? [], count ?? 0, page, limit));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminRole(["super_admin", "admin"]);
    const { title, message, type, link_url, user_ids, is_global, send_email, send_push } =
      createNotificationSchema.parse(await request.json());
    const admin = createAdminClient();
    const rows: Array<Record<string, unknown>> = [];
    if (is_global) {
      rows.push({ title, message, type, link_url, is_global: true });
    }
    if (Array.isArray(user_ids) && user_ids.length > 0) {
      for (const uid of user_ids) rows.push({ user_id: uid, title, message, type, link_url });
    }
    if (rows.length === 0) throw new ApiError(400, "Choose at least one recipient.", "NO_RECIPIENTS");
    const { error } = await admin.from("notifications").insert(rows);
    if (error) throw error;

    let recipientIds = user_ids;
    if (is_global && (send_email || send_push)) {
      const { data: studentRole, error: roleError } = await admin.from("roles").select("id").eq("code", "student").maybeSingle();
      if (roleError) throw roleError;
      if (!studentRole) throw new ApiError(500, "Student role is not configured.", "STUDENT_ROLE_MISSING");
      recipientIds = [];
      for (let offset = 0; ; offset += 500) {
        const { data: students, error: studentsError } = await admin
          .from("profiles")
          .select("id")
          .eq("role_id", studentRole.id)
          .eq("is_active", true)
          .range(offset, offset + 499);
        if (studentsError) throw studentsError;
        recipientIds.push(...(students || []).map(({ id }) => id));
        if (!students || students.length < 500) break;
      }
    }

    const delivery = await deliverNotificationToUsers(
      recipientIds,
      { title, message, link_url },
      { email: send_email, push: send_push }
    );
    return apiSuccess({ created: rows.length, delivery });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return handleApiError(new ApiError(400, err.errors[0]?.message || "Invalid notification details.", "VALIDATION_ERROR"));
    }
    return handleApiError(err);
  }
}

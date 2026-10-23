import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, assertTrustedOrigin, handleApiError, getPaginationParams, paginatedResponse, validateBody } from "@/lib/api-utils";
import { requireAdminAuth, requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const notificationSchema = z.object({
  title: z.string().trim().min(1).max(500),
  message: z.string().trim().min(1).max(10_000),
  type: z.enum(["info", "success", "warning", "announcement"]).default("info"),
  link_url: z.string().trim().max(2048).nullable().default(null).refine((value) => {
    if (!value) return true;
    if (value.startsWith("/")) return !value.startsWith("//") && !value.includes("\\");
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Link must be a safe internal path or an HTTP(S) URL."),
  user_ids: z.array(z.string().uuid()).max(500).default([]),
  is_global: z.boolean().default(false),
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
    assertTrustedOrigin(request);
    await requireAdminRole(["super_admin", "admin"]);
    const payload = await validateBody(notificationSchema, await request.json());
    const userIds = [...new Set(payload.user_ids)];
    if (!payload.is_global && userIds.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Choose a global broadcast or at least one recipient." }), { status: 400 });
    }

    const admin = createAdminClient();
    const rows: Array<Record<string, unknown>> = [];
    if (payload.is_global) {
      rows.push({ title: payload.title, message: payload.message, type: payload.type, link_url: payload.link_url, is_global: true });
    }
    for (const userId of userIds) {
      rows.push({
        user_id: userId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        link_url: payload.link_url,
      });
    }

    const { error } = await admin.from("notifications").insert(rows);
    if (error) throw error;
    return apiSuccess({ created: rows.length });
  } catch (err) {
    return handleApiError(err);
  }
}

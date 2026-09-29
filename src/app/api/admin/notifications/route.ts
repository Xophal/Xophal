import { NextRequest } from "next/server";
import { apiSuccess, handleApiError, getPaginationParams, paginatedResponse } from "@/lib/api-utils";
import { requireAdminAuth, requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

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
    const body = await request.json();
    const { title, message, type = "info", link_url = null, user_ids = [], is_global = false } = body;
    if (!title || !message) return new Response(JSON.stringify({ success: false, error: "Missing title or message" }), { status: 400 });
    const admin = createAdminClient();
    const rows: Array<Record<string, unknown>> = [];
    if (is_global) {
      rows.push({ title, message, type, link_url, is_global: true });
    }
    if (Array.isArray(user_ids) && user_ids.length > 0) {
      for (const uid of user_ids) rows.push({ user_id: uid, title, message, type, link_url });
    }
    if (rows.length === 0) return new Response(JSON.stringify({ success: false, error: "No recipients" }), { status: 400 });
    const { error } = await admin.from("notifications").insert(rows);
    if (error) throw error;
    return apiSuccess({ created: rows.length });
  } catch (err) {
    return handleApiError(err);
  }
}

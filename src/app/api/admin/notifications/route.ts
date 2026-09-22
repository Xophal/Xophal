import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api-utils";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();
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

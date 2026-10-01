import { NextRequest } from "next/server";
import slugify from "slugify";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    await requireAdminRole(["super_admin", "admin", "content_manager", "reviewer"]);
    const { data, error } = await createAdminClient().from("ebook_categories").select("id, name, slug, description, is_active, sort_order").order("sort_order");
    if (error) throw error;
    return apiSuccess(data ?? []);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    await requireAdminRole(["super_admin", "admin", "content_manager"]);
    const input = await validateBody(z.object({ name: z.string().trim().min(2).max(120), description: z.string().trim().max(1000).optional().default("") }), await request.json());
    const slug = slugify(input.name, { lower: true, strict: true }).slice(0, 140);
    const { data, error } = await createAdminClient().from("ebook_categories").insert({ name: input.name, slug, description: input.description || null }).select().single();
    if (error) throw error;
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
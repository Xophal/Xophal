import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const uploadSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  bucket: z.string().optional(),
  path: z.string().optional(),
  size: z.number().optional(),
  contentType: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = await validateBody(uploadSchema, body);
    const session = await requireAuth();
    if (!session) return apiError("Authentication required", 401, "UNAUTHORIZED");

    const adminClient = createAdminClient();
    const { data, error } = await adminClient.from("media_assets").insert([
      {
        file_name: payload.name,
        file_url: payload.url,
        file_size: payload.size ?? null,
        mime_type: payload.contentType ?? null,
        uploaded_by: session.user.id,
        metadata: { ...(payload.metadata ?? {}), bucket: payload.bucket ?? "public", path: payload.path ?? null },
      },
    ]).select().single();
    if (error) throw error;
    return apiSuccess({ record: data, message: "Upload completed." });
  } catch (error) {
    return handleApiError(error);
  }
}

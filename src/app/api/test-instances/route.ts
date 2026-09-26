import { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { startAttempt } from "@/lib/engine/attempt-service";

/**
 * POST /api/test-instances
 * Body: { blueprintId } or { blueprintSlug }, plus optional { seed } / { dateISO }.
 *
 * Freezes a paper from a blueprint and opens an attempt for the signed-in
 * student. Calling it again while an attempt is still live resumes that same
 * frozen paper rather than generating a new one, so a refresh or a dropped
 * connection is harmless.
 */

const bodySchema = z
  .object({
    blueprintId: z.string().uuid().optional(),
    blueprintSlug: z.string().trim().min(1).max(300).optional(),
    seed: z.number().int().optional(),
    dateISO: z.string().trim().max(20).optional(),
  })
  .refine((b) => b.blueprintId || b.blueprintSlug, {
    message: "Provide blueprintId or blueprintSlug",
    path: ["blueprintId"],
  });

type StartBody = z.infer<typeof bodySchema>;

/** Resolves a slug to its id so the caller can work with a single identifier. */
async function resolveBlueprintId(admin: ReturnType<typeof createAdminClient>, body: StartBody) {
  if (body.blueprintId) return body.blueprintId;
  const { data, error } = await admin.from("blueprints").select("id").eq("slug", body.blueprintSlug!).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "Blueprint not found", "BLUEPRINT_NOT_FOUND");
  return data.id as string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required", "UNAUTHORIZED");

    const body = await validateBody(bodySchema, await request.json().catch(() => ({})));
    const admin = createAdminClient();
    const blueprintId = await resolveBlueprintId(admin, body);

    const attempt = await startAttempt(admin, session.user.id, blueprintId, {
      seed: body.seed,
      dateISO: body.dateISO,
    });

    // 200 when resuming, 201 when a new paper was frozen.
    return apiSuccess({ attempt }, attempt.resumed ? 200 : 201);
  } catch (error) {
    return handleApiError(error);
  }
}

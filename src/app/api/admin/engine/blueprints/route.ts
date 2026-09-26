import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, apiSuccess, handleApiError, paginatedResponse, validateBody } from "@/lib/api-utils";
import {
  blueprintQuerySchema,
  blueprintSectionInputSchema,
  createBlueprintSchema,
  withSectionDefaults,
} from "@/lib/engine/blueprint-schema";
import { checkAvailability, createBlueprint, listBlueprints, loadPool } from "@/lib/engine/blueprint-service";

/** Admin blueprint CRUD. Phase 3: the visual builder writes through this router. */

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    const query = blueprintQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const admin = createAdminClient();
    const { rows, total, page, limit } = await listBlueprints(admin, query);
    return apiSuccess(paginatedResponse(rows, total, page, limit));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAdminAuth();
    const payload = await validateBody(createBlueprintSchema, await request.json());
    const admin = createAdminClient();
    return apiSuccess(await createBlueprint(admin, user.id, payload), 201);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/admin/engine/blueprints/availability
 * Body: { sections: BlueprintSectionInput[] }
 *
 * The builder's live "can this be filled?" check. Returns, per section, the
 * exact published-question match count, the best reachable count, and which
 * constraints would have to be relaxed. Read-only: nothing is persisted.
 */
export async function PUT(request: NextRequest) {
  try {
    await requireAdminAuth();
    const body = (await request.json()) as { sections?: unknown };
    if (!Array.isArray(body.sections) || body.sections.length === 0) {
      throw new ApiError(400, "Provide a non-empty `sections` array.", "VALIDATION_ERROR");
    }
    if (body.sections.length > 30) {
      throw new ApiError(400, "At most 30 sections can be checked at once.", "VALIDATION_ERROR");
    }
    const sections = body.sections.map((s) => withSectionDefaults(blueprintSectionInputSchema.parse(s)));
    const admin = createAdminClient();
    const pool = await loadPool(admin);
    return apiSuccess({ sections: checkAvailability(sections, pool), poolSize: pool.length });
  } catch (error) {
    return handleApiError(error);
  }
}

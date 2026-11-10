import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { updateBlueprintSchema, withSectionDefaults } from "@/lib/engine/blueprint-schema";
import {
  assertBlueprintCanBePublic,
  deleteBlueprint,
  getBlueprint,
  loadPool,
  updateBlueprint,
} from "@/lib/engine/blueprint-service";
import { generateInstance } from "@/lib/engine/test-generator";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const admin = createAdminClient();
    return apiSuccess(await getBlueprint(admin, id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const payload = await validateBody(updateBlueprintSchema, await request.json());
    const admin = createAdminClient();
    const current = await getBlueprint(admin, id);
    if (payload.is_public ?? current.is_public) {
      const sections = payload.sections?.map((section) => withSectionDefaults(section)) ?? current.sections;
      const expectedCount = sections.reduce((total, section) => total + section.count, 0);
      if (current.source_mock_test_id) {
        if (expectedCount === 0 || current.fixedQuestions.length !== expectedCount) {
          throw new ApiError(
            409,
            "This fixed mock test does not have a complete question snapshot and cannot be published.",
            "FIXED_PAPER_INCOMPLETE"
          );
        }
      } else {
        const pool = await loadPool(admin);
        assertBlueprintCanBePublic(sections, pool, payload.shuffle_questions ?? current.shuffle_questions);
      }
    }
    return apiSuccess(await updateBlueprint(admin, id, payload));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const admin = createAdminClient();
    return apiSuccess(await deleteBlueprint(admin, id));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/admin/engine/blueprints/:id/preview
 * Freezes a real test instance so an admin can see the exact paper a student
 * would receive. Returns the seed and any shortfall warnings alongside the
 * frozen question list.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { seed?: unknown; dateISO?: unknown };
    const admin = createAdminClient();
    const instance = await generateInstance(admin, id, {
      seed: typeof body.seed === "number" ? body.seed : undefined,
      dateISO: typeof body.dateISO === "string" ? body.dateISO : undefined,
      allowRepeat: true,
    });
    return apiSuccess(instance, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { updateBlueprintSchema } from "@/lib/engine/blueprint-schema";
import { deleteBlueprint, getBlueprint, updateBlueprint } from "@/lib/engine/blueprint-service";
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

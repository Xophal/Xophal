import { NextRequest } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";
import { apiSuccess, handleApiError, validateBody, ApiError } from "@/lib/api-utils";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { profileUpdateSchema } from "@/lib/validations";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = await validateBody(profileUpdateSchema, body);

    const supabase = await createRouteHandlerClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
    }

    const { data: profile } = await supabase.from("profiles").select("*, roles(code)").eq("id", user.id).maybeSingle();
    try {
      requireVerifiedSession(profile, user, { allowRoles: ["student"] });
    } catch (error) {
      throw new ApiError(403, error instanceof Error ? error.message : "Authentication required", "FORBIDDEN");
    }

    if (payload.board_id) {
      const { data: board, error: boardError } = await supabase
        .from("boards")
        .select("id")
        .eq("id", payload.board_id)
        .eq("is_active", true)
        .maybeSingle();
      if (boardError) throw boardError;
      if (!board) throw new ApiError(400, "That board is not available.", "INVALID_BOARD");
    }

    if (payload.class_id) {
      const classQuery = supabase
        .from("classes")
        .select("id, board_id")
        .eq("id", payload.class_id)
        .eq("is_active", true);
      const { data: classRow, error: classError } = await classQuery.maybeSingle();
      if (classError) throw classError;
      if (!classRow) throw new ApiError(400, "That class is not available.", "INVALID_CLASS");
      if (payload.board_id && classRow.board_id !== payload.board_id) {
        throw new ApiError(400, "The selected class does not belong to that board.", "CLASS_BOARD_MISMATCH");
      }
    }

    // Only allow updating the authenticated user's profile. Do not trust client-provided IDs.
    const updates = { ...payload } as Record<string, unknown>;

    const { data, error } = await supabase.from("profiles").update(updates).eq("id", user.id).select().maybeSingle();
    if (error) throw error;

    return apiSuccess(data);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return apiSuccess({ profile: null });
    }

    const { data: profile } = await supabase.from("profiles").select("*, roles(code)").eq("id", user.id).maybeSingle();
    try {
      requireVerifiedSession(profile, user, { allowRoles: ["student"] });
    } catch {
      return apiSuccess({ profile: null });
    }

    return apiSuccess({ profile });
  } catch (err) {
    return handleApiError(err);
  }
}

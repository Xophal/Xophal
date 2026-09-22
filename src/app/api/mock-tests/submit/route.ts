import { NextRequest } from "next/server";
import { apiSuccess, handleApiError, ApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalTestSubmissionSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    if (!(await requireAuth())) throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
    const body = await validateBody(finalTestSubmissionSchema, await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("submit_test_attempt", {
      p_attempt_id: body.attempt_id,
      p_expired: body.expired,
      p_responses: body.responses,
    });

    if (error) {
      if (error.message.includes("not found")) throw new ApiError(404, "Attempt not found", "ATTEMPT_NOT_FOUND");
      if (error.message.includes("forbidden")) throw new ApiError(403, "Forbidden", "FORBIDDEN");
      throw new ApiError(400, error.message, "SUBMISSION_REJECTED");
    }

    // Create an in-app notification for the user about submission/result
    try {
      const admin = createAdminClient();
      await admin.from("notifications").insert([{ user_id: (await supabase.auth.getUser()).data.user?.id, title: "Test submitted", message: `Your test submission (${body.attempt_id}) has been received. View result.`, link_url: `/test/result/${body.attempt_id}` }]);
    } catch {
      // non-fatal: notification failure should not block submission
    }

    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}


import { NextRequest } from "next/server";
import { apiSuccess, handleApiError, ApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalTestSubmissionSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
    const body = await validateBody(finalTestSubmissionSchema, await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("submit_test_attempt", {
      p_attempt_id: body.attempt_id,
      p_expired: false,
      p_responses: body.responses,
    });

    if (error) {
      if (error.message.includes("not found")) throw new ApiError(404, "Attempt not found", "ATTEMPT_NOT_FOUND");
      if (error.message.includes("forbidden")) throw new ApiError(403, "Forbidden", "FORBIDDEN");
      if (error.message.includes("expired")) throw new ApiError(409, "This attempt has reached its time limit", "ATTEMPT_EXPIRED");
      throw new ApiError(400, error.message, "SUBMISSION_REJECTED");
    }

    // Create an in-app notification for the user about submission/result
    try {
      const admin = createAdminClient();
      const { error: notificationError } = await admin.from("notifications").insert([{
        user_id: session.user.id,
        title: "Test submitted",
        message: `Your test submission (${body.attempt_id}) has been received. View result.`,
        link_url: `/test/result/${body.attempt_id}`,
      }]);
      if (notificationError) {
        console.error("Test submission notification could not be created", notificationError);
      }
    } catch (notificationError) {
      console.error("Test submission notification could not be created", notificationError);
    }

    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

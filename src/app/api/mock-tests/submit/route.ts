import { NextRequest } from "next/server";
import { apiSuccess, handleApiError, ApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalTestSubmissionSchema } from "@/lib/validations";
import { deliverNotificationToUsers } from "@/lib/notification-delivery";

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
      if (error.message.includes("expired")) throw new ApiError(409, "This attempt has reached its time limit", "ATTEMPT_EXPIRED");
      throw new ApiError(400, error.message, "SUBMISSION_REJECTED");
    }

    // Submission success must not depend on notification providers being available.
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (userId) {
        const notification = {
          user_id: userId,
          title: "Test submitted",
          message: "Your test submission has been received. View your result.",
          link_url: `/test/result/${body.attempt_id}`,
        };
        const { error: notificationError } = await createAdminClient().from("notifications").insert(notification);
        if (notificationError) throw notificationError;
        await deliverNotificationToUsers([userId], notification, { email: true, push: true });
      }
    } catch {
      // Notification failure should not block the completed test submission.
    }

    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}


import { NextRequest } from "next/server";
import { apiSuccess, handleApiError, getPaginationParams, paginatedResponse, ApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type NotificationPage = {
  items: Array<{
    id: string;
    title: string;
    message: string;
    type: string;
    link_url: string | null;
    is_read: boolean;
    is_global: boolean;
    created_at: string;
  }>;
  total: number;
  unread: number;
};

function parseNotificationPage(data: unknown): NotificationPage {
  if (!data || typeof data !== "object") {
    throw new ApiError(500, "Notification service returned an invalid response.", "INVALID_NOTIFICATION_RESPONSE");
  }
  const page = data as Partial<NotificationPage>;
  if (
    !Array.isArray(page.items) ||
    !Number.isInteger(page.total) ||
    !Number.isInteger(page.unread)
  ) {
    throw new ApiError(500, "Notification service returned an invalid response.", "INVALID_NOTIFICATION_RESPONSE");
  }
  return page as NotificationPage;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required", "UNAUTHORIZED");

    const { page, limit } = getPaginationParams(request.nextUrl.searchParams);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_user_notifications", {
      p_page: page,
      p_limit: limit,
    });
    if (error) throw error;

    const notificationPage = parseNotificationPage(data);
    return apiSuccess({
      ...paginatedResponse(notificationPage.items, notificationPage.total, page, limit),
      unread: notificationPage.unread,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

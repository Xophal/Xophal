import { NextRequest } from "next/server";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ebookEventSchema } from "@/lib/ebooks/schema";
import { checkRateLimit } from "@/lib/rate-limit";

const browserEvents = new Set(["ebook_page_view", "ebook_search", "ebook_filter_used", "ebook_category_view", "ebook_author_view", "ebook_share", "ebook_share_clicked", "ebook_external_click", "mock_test_view", "mock_test_from_ebook", "ebook_from_mock_test", "author_profile_view", "seller_profile_view"]);
const sharePlatforms = new Set(["whatsapp", "facebook", "x", "copy_link", "web_share"]);

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    await checkRateLimit(request);
    const event = await validateBody(ebookEventSchema, await request.json());
    if (!browserEvents.has(event.eventName)) throw new ApiError(400, "Unsupported event.", "INVALID_EVENT");
    if (event.metadata?.sharePlatform && !sharePlatforms.has(String(event.metadata.sharePlatform))) {
      throw new ApiError(400, "Unsupported share platform.", "INVALID_SHARE_PLATFORM");
    }

    const session = await requireAuth();
    const admin = createAdminClient();
    if (event.ebookId) {
      const { data: listing, error } = await admin.from("ebook_listings").select("id").eq("id", event.ebookId).eq("status", "PUBLISHED").maybeSingle();
      if (error) throw error;
      if (!listing) throw new ApiError(404, "Book not found.", "NOT_FOUND");
    }
    if (event.mockTestId) {
      const { data: test, error } = await admin.from("mock_tests").select("id").eq("id", event.mockTestId).eq("is_published", true).eq("is_active", true).maybeSingle();
      if (error) throw error;
      if (!test) throw new ApiError(404, "Mock test not found.", "NOT_FOUND");
    }
    if (event.eventName === "mock_test_view" && !event.mockTestId) {
      throw new ApiError(400, "Mock test id is required for this event.", "MISSING_MOCK_TEST_ID");
    }
    if (!["ebook_search", "ebook_filter_used", "ebook_category_view", "ebook_author_view", "author_profile_view", "seller_profile_view", "mock_test_view"].includes(event.eventName) && !event.ebookId) {
      throw new ApiError(400, "Book id is required for this event.", "MISSING_EBOOK_ID");
    }

    const { error } = await admin.from("ebook_events").insert({
      event_name: event.eventName,
      ebook_id: event.ebookId ?? null,
      mock_test_id: event.mockTestId ?? null,
      user_id: session?.user.id ?? null,
      source: event.source ?? null,
      metadata: event.metadata,
    });
    if (error) throw error;
    return apiSuccess({ recorded: true }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") return new Response(null, { status: 429 });
    return handleApiError(error);
  }
}

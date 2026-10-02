import { NextRequest } from "next/server";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ebookEventSchema } from "@/lib/ebooks/schema";
import { checkRateLimit } from "@/lib/rate-limit";

const browserEvents = new Set(["ebook_view", "ebook_search", "mock_test_from_ebook", "author_profile_view", "seller_profile_view"]);

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    await checkRateLimit(request);
    const event = await validateBody(ebookEventSchema, await request.json());
    if (!browserEvents.has(event.eventName)) throw new ApiError(400, "Unsupported event.", "INVALID_EVENT");

    const session = await requireAuth();
    const admin = createAdminClient();
    if (event.ebookId) {
      const { data: listing } = await admin.from("ebook_listings").select("id").eq("id", event.ebookId).eq("status", "PUBLISHED").maybeSingle();
      if (!listing) throw new ApiError(404, "Book not found.", "NOT_FOUND");
    }
    if (event.eventName !== "ebook_search" && !event.ebookId) {
      throw new ApiError(400, "Book id is required for this event.", "MISSING_EBOOK_ID");
    }

    const { error } = await admin.from("ebook_events").insert({
      event_name: event.eventName,
      ebook_id: event.ebookId ?? null,
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

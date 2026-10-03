import { NextRequest } from "next/server";
import { z } from "zod";
import {
  ApiError,
  apiSuccess,
  assertTrustedOrigin,
  handleApiError,
  validateBody,
} from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const discoveryEventSchema = z.object({
  eventName: z.enum([
    "ebook_view",
    "mock_test_view",
    "ebook_mock_test_impression",
    "mock_test_ebook_impression",
    "mock_test_from_ebook",
    "ebook_from_mock_test",
  ]),
  ebookId: z.string().uuid().optional(),
  mockTestId: z.string().uuid().optional(),
  source: z.string().trim().min(1).max(100),
});

/** Pair events require both ids; single-resource views require only their own id. */
const pairEvents = new Set([
  "ebook_mock_test_impression",
  "mock_test_ebook_impression",
  "mock_test_from_ebook",
  "ebook_from_mock_test",
]);

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    await checkRateLimit(request);
    const event = await validateBody(discoveryEventSchema, await request.json());
    if (pairEvents.has(event.eventName)) {
      if (!event.ebookId || !event.mockTestId) {
        throw new ApiError(400, "Both resource ids are required for this event.", "RESOURCE_IDS_REQUIRED");
      }
    } else if (event.eventName === "ebook_view" && !event.ebookId) {
      throw new ApiError(400, "Book id is required for this event.", "RESOURCE_IDS_REQUIRED");
    } else if (event.eventName === "mock_test_view" && !event.mockTestId) {
      throw new ApiError(400, "Mock test id is required for this event.", "RESOURCE_IDS_REQUIRED");
    }

    const admin = createAdminClient();
    const resourceChecks = await Promise.all([
      event.ebookId
        ? admin.from("ebook_listings").select("id, exam_id, subject_id").eq("id", event.ebookId).eq("status", "PUBLISHED").maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      event.mockTestId
        ? admin.from("mock_tests").select("id, exam_id, subject_id").eq("id", event.mockTestId).eq("is_published", true).eq("is_active", true).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    for (const check of resourceChecks) if (check.error) throw check.error;
    if ((event.ebookId && !resourceChecks[0].data) || (event.mockTestId && !resourceChecks[1].data)) {
      throw new ApiError(404, "Published resource not found.", "RESOURCE_NOT_FOUND");
    }

    if (event.ebookId && event.mockTestId) {
      const { data: relation, error: relationError } = await admin
        .from("ebook_mock_test_relations")
        .select("id, relation_type")
        .eq("ebook_id", event.ebookId)
        .eq("mock_test_id", event.mockTestId)
        .maybeSingle();
      if (relationError) throw relationError;
      if (relation?.relation_type === "EXCLUDED") {
        throw new ApiError(400, "This resource pair is not recommended.", "INVALID_RECOMMENDATION");
      }
      const ebook = resourceChecks[0].data;
      const test = resourceChecks[1].data;
      const sharesTaxonomy = Boolean(
        (ebook?.exam_id && ebook.exam_id === test?.exam_id) ||
        (ebook?.subject_id && ebook.subject_id === test?.subject_id),
      );
      if (!sharesTaxonomy && !relation) {
        throw new ApiError(400, "This resource pair is not a current recommendation.", "INVALID_RECOMMENDATION");
      }
    }

    const session = await requireAuth();
    const { error } = await admin.from("ebook_events").insert({
      event_name: event.eventName,
      ebook_id: event.ebookId ?? null,
      mock_test_id: event.mockTestId ?? null,
      user_id: session?.user.id ?? null,
      source: event.source,
    });
    if (error) throw error;
    return apiSuccess({ recorded: true }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") return new Response(null, { status: 429 });
    return handleApiError(error);
  }
}

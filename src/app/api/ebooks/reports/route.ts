import { NextRequest } from "next/server";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ebookReportSchema } from "@/lib/ebooks/schema";
import { checkRateLimit } from "@/lib/rate-limit";

/** Anyone (signed in or not) may report a published listing for review. */
export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    await checkRateLimit(request);
    const report = await validateBody(ebookReportSchema, await request.json());
    const session = await requireAuth();
    const admin = createAdminClient();

    const { data: ebook, error: ebookError } = await admin
      .from("ebook_listings")
      .select("id")
      .eq("id", report.ebookId)
      .eq("status", "PUBLISHED")
      .maybeSingle();
    if (ebookError) throw ebookError;
    if (!ebook) throw new ApiError(404, "Published eBook not found.", "NOT_FOUND");

    const { error } = await admin.from("ebook_reports").insert({
      ebook_id: ebook.id,
      reporter_user_id: session?.user.id ?? null,
      reason: report.reason,
      details: report.details,
    });
    if (error) throw error;
    return apiSuccess({ submitted: true }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") {
      return new Response(JSON.stringify({ success: false, error: "Too many reports. Try again later.", code: "RATE_LIMIT" }), {
        status: 429,
        headers: { "content-type": "application/json" },
      });
    }
    return handleApiError(error);
  }
}

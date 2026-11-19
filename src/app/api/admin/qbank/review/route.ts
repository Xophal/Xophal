import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, handleApiError } from "@/lib/api-utils";
import { z } from "zod";
import { transitionReviewStatus } from "@/lib/qbank/question-service";
import { BulkReviewSchema } from "@/lib/qbank/validation";

const SingleReviewSchema = z.object({
  question_id: z.string().uuid(),
  action: z.enum(["approve", "reject", "archive"]),
  review_notes: z.string().max(4000).optional().default(""),
});

// POST /api/admin/qbank/review - bulk or single review
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAdminAuth();
    const body = await request.json();

    const admin = createAdminClient();

    // Support both single and bulk
    if (body.question_id) {
      const parsed = SingleReviewSchema.parse(body);
      const status = parsed.action === "approve" ? "approved" : parsed.action === "reject" ? "rejected" : "archived";
      const question = await transitionReviewStatus(
        admin,
        parsed.question_id,
        status,
        user.id,
        parsed.review_notes
      );
      return apiSuccess({ question });
    }

    const parsed = BulkReviewSchema.parse(body);
    const results = [];
    for (const qid of parsed.question_ids) {
      try {
        const status = parsed.action === "approve" ? "approved" : parsed.action === "reject" ? "rejected" : "archived";
        const q = await transitionReviewStatus(
          admin, qid, status, user.id, parsed.review_notes
        );
        results.push({ question_id: qid, success: true, question: q });
      } catch (error) {
        results.push({ question_id: qid, success: false, error: error instanceof Error ? error.message : "Review action failed" });
      }
    }
    return apiSuccess({ results });
  } catch (error) {
    return handleApiError(error);
  }
}
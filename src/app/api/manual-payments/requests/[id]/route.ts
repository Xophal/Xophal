import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { createAdminClient } from "@/lib/supabase/admin";

const submitReferenceSchema = z.object({
  reference_code: z.string().trim().min(3).max(160),
  evidence_url: z.string().url().max(2048).refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
    message: "Evidence URL must use HTTP or HTTPS.",
  }).optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    assertTrustedOrigin(request);
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Please sign in before submitting payment details.", "UNAUTHORIZED");
    requireVerifiedSession(session.profile, session.user, { allowRoles: ["student"] });

    const payload = await validateBody(submitReferenceSchema, await request.json());
    const { id } = await params;
    const admin = createAdminClient();
    const { data: existing, error: readError } = await admin
      .from("manual_payment_requests")
      .select("id, user_id, status")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    if (!existing || existing.user_id !== session.user.id) {
      return apiError("Payment request not found.", 404, "NOT_FOUND");
    }
    if (existing.status === "pending_verification") {
      return apiSuccess(existing);
    }
    if (existing.status !== "pending_payment") {
      return apiError("This payment request can no longer be changed.", 409, "REQUEST_NOT_PENDING");
    }

    const { data, error } = await admin
      .from("manual_payment_requests")
      .update({
        reference_code: payload.reference_code,
        evidence_url: payload.evidence_url ?? null,
        status: "pending_verification",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", session.user.id)
      .eq("status", "pending_payment")
      .select("id, status, reference_code, submitted_at")
      .maybeSingle();

    if (error?.code === "23505") {
      return apiError("This UPI transaction reference has already been submitted.", 409, "DUPLICATE_PAYMENT_REFERENCE");
    }
    if (error) throw error;
    if (!data) return apiError("This payment request was already updated.", 409, "REQUEST_NOT_PENDING");
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

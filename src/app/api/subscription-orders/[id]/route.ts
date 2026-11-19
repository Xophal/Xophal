import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const evidencePathSchema = z.string().max(512).regex(
  /^[0-9a-f-]{36}\/subscription-evidence\/[0-9a-f-]{36}\.(jpg|png|webp)$/i,
  "Upload the screenshot using the private payment-evidence uploader."
);

const submitPaymentSchema = z.object({
  reference_code: z.string().trim().min(3).max(255),
  payment_paid_at: z.string().datetime({ offset: true }),
  evidence_url: evidencePathSchema.optional().nullable(),
  payment_note: z.string().trim().max(1000).optional().nullable(),
});

const additionalInformationSchema = z.object({
  additional_information: z.string().trim().min(3).max(1000),
  evidence_url: evidencePathSchema.optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    assertTrustedOrigin(request);
    await checkRateLimit(request);

    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Please sign in before submitting payment details.", "UNAUTHORIZED");
    requireVerifiedSession(session.profile, session.user, { allowRoles: ["student"] });

    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new ApiError(400, "A valid subscription order is required.", "INVALID_ORDER_ID");
    }

    const body = await request.json();
    const additionalInformation = additionalInformationSchema.safeParse(body);
    if (additionalInformation.success) {
      const { data, error } = await createAdminClient().rpc("submit_manual_subscription_information", {
        p_submission_id: id,
        p_user_id: session.user.id,
        p_additional_information: additionalInformation.data.additional_information,
        p_evidence_path: additionalInformation.data.evidence_url ?? null,
      });

      if (error) {
        if (error.message.includes("not found")) throw new ApiError(404, "Subscription order not found.", "ORDER_NOT_FOUND");
        if (error.message.includes("not requesting additional information")) {
          throw new ApiError(409, "This order is not requesting additional information.", "ORDER_NOT_UNDER_REVIEW");
        }
        throw error;
      }
      return apiSuccess(data);
    }

    const payload = await validateBody(submitPaymentSchema, body);
    const { data, error } = await createAdminClient().rpc("submit_manual_subscription_payment", {
      p_submission_id: id,
      p_user_id: session.user.id,
      p_reference_code: payload.reference_code,
      p_payment_paid_at: payload.payment_paid_at,
      p_evidence_url: payload.evidence_url ?? null,
      p_payment_note: payload.payment_note ?? null,
    });

    if (error) {
      if (error.message.includes("already been submitted")) {
        throw new ApiError(409, "This UPI transaction reference has already been submitted.", "DUPLICATE_PAYMENT_REFERENCE");
      }
      if (error.message.includes("no longer awaiting")) {
        throw new ApiError(409, "This order is no longer awaiting payment details.", "ORDER_ALREADY_SUBMITTED");
      }
      if (error.message.includes("not found")) {
        throw new ApiError(404, "Subscription order not found.", "ORDER_NOT_FOUND");
      }
      throw error;
    }

    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") {
      return new Response(JSON.stringify({ success: false, error: "Too many requests.", code: "RATE_LIMIT" }), {
        status: 429,
        headers: { "content-type": "application/json" },
      });
    }
    return handleApiError(error);
  }
}

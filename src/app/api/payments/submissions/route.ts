import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProductPrice, type ProductCatalogRecord } from "@/lib/subscription-pricing";

const createSubmissionSchema = z.object({
  product_id: z.string().uuid().optional(),
  product_code: z.string().min(3).max(80).optional(),
  school_id: z.string().uuid().nullable().optional(),
  payment_method: z.enum(["upi_manual", "bulk_school_payment", "other"]).default("upi_manual"),
  amount_minor: z.number().int().nonnegative().optional(),
  reference_code: z.string().min(3).max(255).optional().nullable(),
  evidence_url: z.string().url().max(2048).optional().nullable(),
  metadata: z.record(z.any()).optional().default({}),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) {
      return apiError("Please sign in before submitting a payment request.", 401, "UNAUTHORIZED");
    }

    try {
      requireVerifiedSession(session.profile, session.user, { allowRoles: ["student"] });
    } catch (error) {
      return apiError(error instanceof Error ? error.message : "Authentication required", 403, "FORBIDDEN");
    }

    const payload = await validateBody(createSubmissionSchema, await request.json());
    if (!payload.product_id && !payload.product_code) {
      return apiError("A product ID or product code is required.", 400, "MISSING_PRODUCT");
    }

    if (!payload.reference_code && !payload.evidence_url) {
      return apiError("Provide either a payment reference code or a screenshot / evidence URL.", 400, "MISSING_PAYMENT_EVIDENCE");
    }

    const admin = createAdminClient();
    const productLookup = payload.product_id
      ? admin.from("product_catalog").select("id, code, product_type, board_code, class_number, name, price_paise, early_bird_price_paise, school_price_paise, is_active").eq("id", payload.product_id)
      : admin.from("product_catalog").select("id, code, product_type, board_code, class_number, name, price_paise, early_bird_price_paise, school_price_paise, is_active").eq("code", payload.product_code);

    const { data: product, error: productError } = await productLookup.eq("is_active", true).maybeSingle();
    if (productError) throw productError;
    if (!product) {
      return apiError("The selected product is not available for purchase.", 404, "PRODUCT_NOT_FOUND");
    }

    let isSchoolEligible = false;
    if (payload.school_id) {
      const { data: eligibility, error: eligibilityError } = await admin
        .from("school_student_eligibility")
        .select("id")
        .eq("school_id", payload.school_id)
        .eq("student_id", session.user.id)
        .eq("is_eligible", true)
        .or(`product_id.is.null,product_id.eq.${product.id}`)
        .not("verified_at", "is", null)
        .maybeSingle();

      if (eligibilityError) throw eligibilityError;
      if (!eligibility) {
        return apiError("Verified school eligibility is required for this price.", 403, "SCHOOL_ELIGIBILITY_REQUIRED");
      }

      const { data: school, error: schoolError } = await admin
        .from("school_records")
        .select("is_verified")
        .eq("id", payload.school_id)
        .maybeSingle();

      if (schoolError) throw schoolError;
      if (!school?.is_verified) {
        return apiError("The selected school is not verified.", 403, "SCHOOL_NOT_VERIFIED");
      }

      isSchoolEligible = true;
    }

    const priceDecision = resolveProductPrice(product as ProductCatalogRecord, {
      now: new Date(),
      isSchoolEligible,
    });
    const expectedAmountMinor = priceDecision.pricePaise;
    const amountMinor = payload.amount_minor ?? expectedAmountMinor;

    if (amountMinor !== expectedAmountMinor) {
      return apiError("The submitted amount does not match the active product price.", 400, "PRICE_MISMATCH");
    }

    const { data: existingSubmission, error: duplicateError } = await admin
      .from("payment_submissions")
      .select("id, status")
      .eq("user_id", session.user.id)
      .eq("product_id", product.id)
      .in("status", ["pending_verification", "approved", "duplicate_flagged"])
      .maybeSingle();

    if (duplicateError) throw duplicateError;
    if (existingSubmission) {
      return apiError("A payment verification request already exists for this product. Please wait for review or contact support.", 409, "DUPLICATE_SUBMISSION");
    }

    const { data, error } = await admin
      .from("payment_submissions")
      .insert([{
        user_id: session.user.id,
        product_id: product.id,
        school_id: payload.school_id ?? null,
        payment_method: payload.payment_method,
        amount_minor: amountMinor,
        discount_minor: Math.max(0, Number(product.price_paise ?? 0) - amountMinor),
        final_amount_minor: amountMinor,
        currency: "INR",
        reference_code: payload.reference_code ?? null,
        evidence_url: payload.evidence_url ?? null,
        status: "pending_verification",
        metadata: payload.metadata ?? {},
      }])
      .select("id, status, product_id, amount_minor, final_amount_minor, reference_code, evidence_url, created_at")
      .single();

    if (error) throw error;

    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

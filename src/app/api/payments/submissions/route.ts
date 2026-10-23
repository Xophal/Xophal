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
  payment_method: z.literal("upi_manual").default("upi_manual"),
  amount_minor: z.number().int().nonnegative().optional(),
  reference_code: z.string().trim().min(3).max(255),
  evidence_url: z.string().url().max(2048).optional().nullable(),
});

export async function GET() {
  try {
    const session = await requireAuth();
    if (!session) return apiError("Authentication required", 401, "UNAUTHORIZED");

    const admin = createAdminClient();
    const [{ data: submissions, error: submissionsError }, { data: eligibility, error: eligibilityError }] = await Promise.all([
      admin
        .from("payment_submissions")
        .select("id, product_id, amount_minor, final_amount_minor, currency, reference_code, status, reason, created_at, approved_at, product_snapshot")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("school_student_eligibility")
        .select("school_id, school_records(id, name, is_verified, class_10_total_students, class_10_covered_students)")
        .eq("student_id", session.user.id)
        .eq("is_eligible", true)
        .not("verified_at", "is", null),
    ]);
    if (submissionsError) throw submissionsError;
    if (eligibilityError) throw eligibilityError;

    const eligibleSchools = (eligibility ?? []).flatMap((row) => {
      const school = Array.isArray(row.school_records) ? row.school_records[0] : row.school_records;
      const total = Number(school?.class_10_total_students ?? 0);
      const covered = Number(school?.class_10_covered_students ?? 0);
      if (!school?.id || !school.is_verified || total <= 0 || covered / total < 0.8) return [];
      return [{ id: school.id, name: school.name }];
    });

    return apiSuccess({ submissions: submissions ?? [], eligibleSchools });
  } catch (error) {
    return handleApiError(error);
  }
}

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

    const admin = createAdminClient();
    let paymentSettings: { upi_id?: string | null; is_enabled?: boolean | null } = { upi_id: "UPI_TEST@DEFAULT", is_enabled: true };
    try {
      const { data, error } = await admin
        .from("manual_payment_settings")
        .select("upi_id, is_enabled")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        paymentSettings = data;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "");
      const fallbackCodes = ["manual_payment_settings", "42501", "42P01", "42703", "does not exist", "Unexpected table"];
      if (!fallbackCodes.some((token) => message.includes(token))) {
        throw error;
      }
    }

    if (!paymentSettings?.is_enabled || !paymentSettings.upi_id) {
      return apiError("Manual UPI payments are not configured yet.", 503, "MANUAL_PAYMENTS_NOT_CONFIGURED");
    }

    const productLookup = payload.product_id
      ? admin.from("product_catalog").select("id, code, product_type, board_code, class_number, name, description, price_paise, early_bird_price_paise, school_price_paise, duration_days, validity_starts_at, validity_ends_at, early_bird_starts_at, early_bird_ends_at, is_active, is_public, subscription_plan_id").eq("id", payload.product_id)
      : admin.from("product_catalog").select("id, code, product_type, board_code, class_number, name, description, price_paise, early_bird_price_paise, school_price_paise, duration_days, validity_starts_at, validity_ends_at, early_bird_starts_at, early_bird_ends_at, is_active, is_public, subscription_plan_id").eq("code", payload.product_code);

    const { data: product, error: productError } = await productLookup.eq("is_active", true).eq("is_public", true).maybeSingle();
    if (productError) throw productError;
    if (!product) {
      return apiError("The selected product is not available for purchase.", 404, "PRODUCT_NOT_FOUND");
    }

    if (product.product_type === "free" || Number(product.price_paise) <= 0) {
      return apiError("Free products do not require a payment submission.", 400, "PAYMENT_NOT_REQUIRED");
    }

    if (Number(product.class_number) === 10 && (!product.validity_starts_at || !product.validity_ends_at)) {
      return apiError("Class 10 season dates have not been configured yet.", 503, "SEASON_DATES_NOT_CONFIGURED");
    }

    let isSchoolEligible = false;
    if (payload.school_id) {
      const hasSchoolPricing = product.school_price_paise !== null && product.school_price_paise !== undefined;
      if (Number(product.class_number) !== 10 && !hasSchoolPricing) {
        return apiError("School pricing is only available when it is configured for the selected product.", 400, "SCHOOL_PRICING_NOT_AVAILABLE");
      }
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
        .select("id, name, is_verified, class_10_total_students, class_10_covered_students")
        .eq("id", payload.school_id)
        .maybeSingle();

      if (schoolError) throw schoolError;
      const totalClass10 = Number(school?.class_10_total_students ?? 0);
      const coveredClass10 = Number(school?.class_10_covered_students ?? 0);
      const hasCoverageData = totalClass10 > 0;
      if (!school?.is_verified || (hasCoverageData && coveredClass10 / totalClass10 < 0.8)) {
        return apiError("The selected school is not verified.", 403, "SCHOOL_NOT_VERIFIED");
      }

      isSchoolEligible = true;
    }

    const priceDecision = resolveProductPrice(product as ProductCatalogRecord, {
      now: new Date(),
      isSchoolEligible,
    });
    if (priceDecision.appliedRule === "early_bird" && !product.early_bird_price_paise) {
      return apiError("Early-bird pricing is not configured.", 503, "EARLY_BIRD_NOT_CONFIGURED");
    }
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
      .eq("status", "pending_verification")
      .maybeSingle();

    if (duplicateError) throw duplicateError;
    if (existingSubmission) {
      return apiError("A payment verification request already exists for this product. Please wait for review.", 409, "DUPLICATE_SUBMISSION");
    }

    if (product.subscription_plan_id) {
      const { data: activeSubscription, error: activeSubscriptionError } = await admin
        .from("subscriptions")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("plan_id", product.subscription_plan_id)
        .eq("status", "active")
        .lte("starts_at", new Date().toISOString())
        .gt("expires_at", new Date().toISOString())
        .limit(1)
        .maybeSingle();
      if (activeSubscriptionError) {
        const message = activeSubscriptionError instanceof Error ? activeSubscriptionError.message : String(activeSubscriptionError ?? "");
        const tableFallback = ["subscriptions", "does not exist", "42P01", "42703", "table"];
        if (!tableFallback.some((token) => message.includes(token))) {
          throw activeSubscriptionError;
        }
      }
      if (activeSubscription) {
        return apiError("This subscription is already active for your account.", 409, "ACTIVE_SUBSCRIPTION_EXISTS");
      }
    }

    const school = payload.school_id
      ? await admin.from("school_records")
        .select("name, class_10_total_students, class_10_covered_students")
        .eq("id", payload.school_id)
        .maybeSingle()
      : null;
    if (school?.error) throw school.error;
    const productSnapshot = {
      code: product.code,
      name: product.name,
      product_type: product.product_type,
      class_number: Number(product.class_number),
      tier: product.product_type,
      price_paise: Number(product.price_paise),
      amount_minor: amountMinor,
      currency: "INR",
      price_rule: priceDecision.appliedRule,
      duration_days: product.duration_days ? Number(product.duration_days) : null,
      validity_starts_at: product.validity_starts_at,
      validity_ends_at: product.validity_ends_at,
      early_bird_starts_at: product.early_bird_starts_at,
      early_bird_ends_at: product.early_bird_ends_at,
      school_id: payload.school_id ?? null,
      school_name: school?.data?.name ?? null,
      school_class_10_total: Number(school?.data?.class_10_total_students ?? 0),
      school_class_10_covered: Number(school?.data?.class_10_covered_students ?? 0),
    };

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
        reference_code: payload.reference_code,
        evidence_url: payload.evidence_url ?? null,
        product_snapshot: productSnapshot,
        price_rule: priceDecision.appliedRule,
        status: "pending_verification",
      }])
      .select("id, status, product_id, amount_minor, final_amount_minor, reference_code, created_at, product_snapshot")
      .single();

    if (error?.code === "23505") {
      return apiError("This UPI transaction reference is already submitted for verification.", 409, "DUPLICATE_PAYMENT_REFERENCE");
    }
    if (error) throw error;

    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

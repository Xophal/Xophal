import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProductPrice, type ProductCatalogRecord } from "@/lib/subscription-pricing";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_RECEIPT_SIZE = 3 * 1024 * 1024;
const MAX_FORM_SIZE = MAX_RECEIPT_SIZE + 64 * 1024;
const RECEIPT_BUCKET = "upi-receipts";

const createSubmissionSchema = z.object({
  payment_request_id: z.string().uuid(),
  product_id: z.string().uuid().optional(),
  product_code: z.string().min(3).max(80).optional(),
  school_id: z.string().uuid().nullable().optional(),
  claimed_amount: z.string().regex(/^\d{1,7}(?:\.\d{1,2})?$/, "Enter the amount paid in rupees."),
  payment_paid_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Enter the payment date and time."),
  reference_code: z.string().trim().min(3).max(255),
});

type ReceiptType = "image/jpeg" | "image/png" | "image/webp";

function amountToPaise(value: string): number {
  const [rupees, paise = ""] = value.split(".");
  return Number(rupees) * 100 + Number(paise.padEnd(2, "0"));
}

function parsePaidAtInIndia(value: string): Date | null {
  const paidAt = new Date(`${value}:00+05:30`);
  if (!Number.isFinite(paidAt.getTime())) return null;

  const localIndiaTime = new Date(paidAt.getTime() + 330 * 60 * 1000);
  const [year, month, day, hour, minute] = value.split(/[-T:]/).map(Number);
  if (
    localIndiaTime.getUTCFullYear() !== year
    || localIndiaTime.getUTCMonth() + 1 !== month
    || localIndiaTime.getUTCDate() !== day
    || localIndiaTime.getUTCHours() !== hour
    || localIndiaTime.getUTCMinutes() !== minute
  ) {
    return null;
  }

  return paidAt;
}

async function validateReceipt(file: FormDataEntryValue | null): Promise<{ file: File; type: ReceiptType; extension: string } | null> {
  if (!(file instanceof File)) return null;
  if (file.size === 0 || file.size > MAX_RECEIPT_SIZE) return null;

  const signatures: Record<ReceiptType, { extension: string; matches(bytes: Uint8Array): boolean }> = {
    "image/jpeg": {
      extension: "jpg",
      matches: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    },
    "image/png": {
      extension: "png",
      matches: (bytes) => bytes.length >= 8
        && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
        && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a,
    },
    "image/webp": {
      extension: "webp",
      matches: (bytes) => bytes.length >= 12
        && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
        && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP",
    },
  };

  const signature = signatures[file.type as ReceiptType];
  if (!signature) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  return signature.matches(bytes)
    ? { file, type: file.type as ReceiptType, extension: signature.extension }
    : null;
}

async function removeReceipt(admin: ReturnType<typeof createAdminClient>, path: string) {
  const { error } = await admin.storage.from(RECEIPT_BUCKET).remove([path]);
  if (error) console.error("Failed to clean up an unlinked UPI receipt", error);
}

export async function GET() {
  try {
    const session = await requireAuth();
    if (!session) return apiError("Authentication required", 401, "UNAUTHORIZED");

    const admin = createAdminClient();
    const [{ data: submissions, error: submissionsError }, { data: eligibility, error: eligibilityError }] = await Promise.all([
      admin
        .from("payment_submissions")
        .select("id, product_id, amount_minor, claimed_amount_minor, payment_paid_at, currency, reference_code, status, reason, created_at, approved_at, product_snapshot")
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
    assertTrustedOrigin(request);

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_FORM_SIZE) {
      return apiError("The payment form exceeds the 3 MB receipt limit.", 413, "PAYMENT_FORM_TOO_LARGE");
    }

    const session = await requireAuth();
    if (!session) {
      return apiError("Please sign in before submitting a payment request.", 401, "UNAUTHORIZED");
    }

    try {
      requireVerifiedSession(session.profile, session.user, { allowRoles: ["student"] });
    } catch (error) {
      return apiError(error instanceof Error ? error.message : "Authentication required", 403, "FORBIDDEN");
    }

    await checkRateLimit(request);

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return apiError("Submit payment details and a receipt image.", 400, "INVALID_PAYMENT_FORM");
    }

    const getString = (key: string) => {
      const value = formData.get(key);
      return typeof value === "string" ? value : undefined;
    };
    const payload = await validateBody(createSubmissionSchema, {
      payment_request_id: getString("payment_request_id"),
      product_id: getString("product_id"),
      product_code: getString("product_code"),
      school_id: getString("school_id") || null,
      claimed_amount: getString("claimed_amount"),
      payment_paid_at: getString("payment_paid_at"),
      reference_code: getString("reference_code"),
    });
    if (!payload.product_id && !payload.product_code) {
      return apiError("A product ID or product code is required.", 400, "MISSING_PRODUCT");
    }

    const claimedAmountMinor = amountToPaise(payload.claimed_amount);
    if (!Number.isSafeInteger(claimedAmountMinor) || claimedAmountMinor <= 0) {
      return apiError("Enter a valid amount paid in rupees.", 400, "INVALID_CLAIMED_AMOUNT");
    }

    const paidAt = parsePaidAtInIndia(payload.payment_paid_at);
    if (!paidAt || paidAt.getTime() > Date.now() + 5 * 60 * 1000) {
      return apiError("Enter a valid payment date and time in India Standard Time.", 400, "INVALID_PAYMENT_DATE");
    }

    const receipt = await validateReceipt(formData.get("receipt"));
    if (!receipt) {
      return apiError("Upload a valid JPEG, PNG, or WebP receipt image of 3 MB or less.", 400, "INVALID_RECEIPT");
    }

    const admin = createAdminClient();
    const { data: paymentSettings, error: paymentSettingsError } = await admin
      .from("manual_payment_settings")
      .select("upi_id, is_enabled")
      .eq("id", 1)
      .maybeSingle();
    if (paymentSettingsError) throw paymentSettingsError;

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
      if (Number(product.class_number) !== 10 || product.school_price_paise === null || product.school_price_paise === undefined) {
        return apiError("School pricing is only available for configured Class 10 season plans.", 400, "SCHOOL_PRICING_NOT_AVAILABLE");
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
      if (!school?.is_verified || totalClass10 <= 0 || coveredClass10 / totalClass10 < 0.8) {
        return apiError("The selected school does not meet the verified 80% Class 10 coverage requirement.", 403, "SCHOOL_NOT_VERIFIED");
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

    const { data: priorRequest, error: priorRequestError } = await admin
      .from("payment_submissions")
      .select("id, status, product_id, school_id, amount_minor, claimed_amount_minor, payment_paid_at, final_amount_minor, reference_code, created_at, product_snapshot")
      .eq("id", payload.payment_request_id)
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (priorRequestError) throw priorRequestError;
    if (priorRequest) {
      const sameRequest = priorRequest.product_id === product.id
        && priorRequest.school_id === payload.school_id
        && priorRequest.reference_code === payload.reference_code
        && Number(priorRequest.claimed_amount_minor) === claimedAmountMinor
        && priorRequest.payment_paid_at === paidAt.toISOString();
      if (sameRequest) return apiSuccess(priorRequest);
      return apiError("This payment request identifier is already in use.", 409, "PAYMENT_REQUEST_ID_IN_USE");
    }

    const { data: existingSubmission, error: duplicateError } = await admin
      .from("payment_submissions")
      .select("id")
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
      if (activeSubscriptionError) throw activeSubscriptionError;
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
      amount_minor: expectedAmountMinor,
      claimed_amount_minor: claimedAmountMinor,
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
    const receiptPath = `${session.user.id}/${payload.payment_request_id}-${crypto.randomUUID()}.${receipt.extension}`;
    const receiptBytes = new Uint8Array(await receipt.file.arrayBuffer());
    const { error: uploadError } = await admin.storage.from(RECEIPT_BUCKET).upload(receiptPath, receiptBytes, {
      contentType: receipt.type,
      cacheControl: "0",
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data, error } = await admin
      .from("payment_submissions")
      .insert([{
        id: payload.payment_request_id,
        user_id: session.user.id,
        product_id: product.id,
        school_id: payload.school_id ?? null,
        payment_method: "upi_manual",
        amount_minor: expectedAmountMinor,
        discount_minor: Math.max(0, Number(product.price_paise ?? 0) - expectedAmountMinor),
        final_amount_minor: expectedAmountMinor,
        claimed_amount_minor: claimedAmountMinor,
        payment_paid_at: paidAt.toISOString(),
        currency: "INR",
        reference_code: payload.reference_code,
        receipt_path: receiptPath,
        product_snapshot: productSnapshot,
        price_rule: priceDecision.appliedRule,
        status: "pending_verification",
      }])
      .select("id, status, product_id, amount_minor, claimed_amount_minor, payment_paid_at, final_amount_minor, reference_code, created_at, product_snapshot")
      .single();

    if (error) {
      await removeReceipt(admin, receiptPath);

      if (error.code === "23505") {
        const { data: priorRequest, error: priorRequestError } = await admin
          .from("payment_submissions")
          .select("id, status, product_id, school_id, amount_minor, claimed_amount_minor, payment_paid_at, final_amount_minor, reference_code, created_at, product_snapshot")
          .eq("id", payload.payment_request_id)
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (priorRequestError) throw priorRequestError;
        if (priorRequest) {
          const sameRequest = priorRequest.product_id === product.id
            && priorRequest.school_id === payload.school_id
            && priorRequest.reference_code === payload.reference_code
            && Number(priorRequest.claimed_amount_minor) === claimedAmountMinor
            && priorRequest.payment_paid_at === paidAt.toISOString();
          if (sameRequest) return apiSuccess(priorRequest);
          return apiError("This payment request identifier is already in use.", 409, "PAYMENT_REQUEST_ID_IN_USE");
        }
        return apiError("This UPI transaction reference is already submitted for verification.", 409, "DUPLICATE_PAYMENT_REFERENCE");
      }
      throw error;
    }

    return apiSuccess(data, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") {
      return apiError("Too many payment requests. Please wait and try again.", 429, "RATE_LIMIT");
    }
    return handleApiError(error);
  }
}

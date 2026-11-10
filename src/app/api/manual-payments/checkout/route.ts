import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { getUserEntitlement, isProductEntitled } from "@/lib/entitlements";
import { getMarketplaceConfig } from "@/lib/ebooks/config";
import { loadPurchasableEbook, hasVerifiedEbookPurchase } from "@/lib/ebooks/orders";
import { splitVerifiedSale } from "@/lib/ebooks/pricing";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const checkoutSchema = z.object({
  resourceType: z.enum(["ebook", "mock_test"]),
  resourceId: z.string().uuid(),
});

type ManualPaymentRequest = {
  id: string;
  resource_type: "ebook" | "mock_test";
  title_snapshot: string;
  amount_minor: number;
  currency: string;
  status: string;
};

async function loadExistingRequest(userId: string, resourceType: "ebook" | "mock_test", resourceId: string) {
  let query = createAdminClient()
    .from("manual_payment_requests")
    .select("id, resource_type, title_snapshot, amount_minor, currency, status")
    .eq("user_id", userId)
    .in("status", ["pending_payment", "pending_verification", "approved"]);
  query = resourceType === "ebook" ? query.eq("ebook_id", resourceId) : query.eq("mock_test_id", resourceId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as ManualPaymentRequest | null;
}

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    await checkRateLimit(request);

    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Please sign in before starting checkout.", "UNAUTHORIZED");
    requireVerifiedSession(session.profile, session.user, { allowRoles: ["student"] });

    const payload = await validateBody(checkoutSchema, await request.json());
    const admin = createAdminClient();
    const { data: settings, error: settingsError } = await admin
      .from("manual_payment_settings")
      .select("upi_id, payee_name, instructions, is_enabled")
      .eq("id", 1)
      .maybeSingle();
    if (settingsError) throw settingsError;
    if (!settings?.is_enabled || !settings.upi_id) {
      throw new ApiError(503, "Manual UPI payments are not configured yet.", "MANUAL_PAYMENTS_NOT_CONFIGURED");
    }

    let title: string;
    let amountMinor: number;
    let metadata: Record<string, unknown> = {};

    if (payload.resourceType === "mock_test") {
      const { data: test, error } = await admin
        .from("mock_tests")
        .select("id, title, access_price, is_premium, is_published, is_active")
        .eq("id", payload.resourceId)
        .maybeSingle();
      if (error) throw error;
      if (!test?.is_active || !test.is_published || !test.is_premium) {
        throw new ApiError(404, "Paid mock test not found.", "TEST_NOT_FOUND");
      }

      const price = Number(test.access_price);
      amountMinor = Math.round(price * 100);
      if (!Number.isFinite(price) || price <= 0 || !Number.isSafeInteger(amountMinor)) {
        throw new ApiError(503, "This mock test is not configured for a one-time purchase.", "PAYMENT_NOT_CONFIGURED");
      }

      const [{ data: grant, error: grantError }, entitlement] = await Promise.all([
        admin
          .from("test_access_grants")
          .select("id")
          .eq("user_id", session.user.id)
          .eq("mock_test_id", test.id)
          .maybeSingle(),
        getUserEntitlement(session.user.id),
      ]);
      if (grantError) throw grantError;
      if (grant || (entitlement.isPaid && isProductEntitled(entitlement.productType, "premium"))) {
        throw new ApiError(409, "You already have access to this mock test.", "ALREADY_PURCHASED");
      }
      title = test.title;
    } else {
      const ebook = await loadPurchasableEbook(payload.resourceId);
      if (!ebook) throw new ApiError(404, "eBook not found.", "NOT_FOUND");
      if (ebook.user_id === session.user.id) {
        throw new ApiError(400, "You cannot buy your own listing.", "SELF_PURCHASE");
      }
      if (Number(ebook.price) <= 0) throw new ApiError(400, "This eBook is free to access.", "PAYMENT_NOT_REQUIRED");
      if (ebook.currency.toUpperCase() !== "INR") {
        throw new ApiError(503, "Manual UPI checkout only supports INR listings.", "CURRENCY_NOT_SUPPORTED");
      }
      if (await hasVerifiedEbookPurchase(session.user.id, ebook.id)) {
        throw new ApiError(409, "You already own this eBook.", "ALREADY_PURCHASED");
      }

      const price = Number(ebook.price);
      amountMinor = Math.round(price * 100);
      if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
        throw new ApiError(503, "This eBook is not configured for payment.", "PAYMENT_NOT_CONFIGURED");
      }
      const config = await getMarketplaceConfig();
      const split = splitVerifiedSale(price, config.commissionPercent);
      title = ebook.title;
      metadata = {
        seller_user_id: ebook.user_id,
        ebook_slug: ebook.slug,
        commission_percent: config.commissionPercent,
        commission_amount: split.commissionAmount,
        seller_amount: split.sellerAmount,
        seller_settlement: "manual_outside_site",
      };
    }

    const existing = await loadExistingRequest(session.user.id, payload.resourceType, payload.resourceId);
    if (existing?.status === "approved") {
      throw new ApiError(409, "You already have access to this purchase.", "ALREADY_PURCHASED");
    }
    if (existing) {
      return apiSuccess({
        request: existing,
        payment: {
          upi_id: settings.upi_id,
          payee_name: settings.payee_name || "Xophol",
          instructions: settings.instructions,
        },
      });
    }

    const { data: createdRequest, error: createError } = await admin
      .from("manual_payment_requests")
      .insert({
        user_id: session.user.id,
        resource_type: payload.resourceType,
        ebook_id: payload.resourceType === "ebook" ? payload.resourceId : null,
        mock_test_id: payload.resourceType === "mock_test" ? payload.resourceId : null,
        title_snapshot: title,
        amount_minor: amountMinor,
        currency: "INR",
        status: "pending_payment",
        metadata,
      })
      .select("id, resource_type, title_snapshot, amount_minor, currency, status")
      .single();

    if (createError?.code === "23505") {
      const concurrent = await loadExistingRequest(session.user.id, payload.resourceType, payload.resourceId);
      if (concurrent && concurrent.status !== "approved") {
        return apiSuccess({
          request: concurrent,
          payment: {
            upi_id: settings.upi_id,
            payee_name: settings.payee_name || "Xophol",
            instructions: settings.instructions,
          },
        });
      }
      throw new ApiError(409, "This purchase has already been completed.", "ALREADY_PURCHASED");
    }
    if (createError) throw createError;

    return apiSuccess({
      request: createdRequest,
      payment: {
        upi_id: settings.upi_id,
        payee_name: settings.payee_name || "Xophol",
        instructions: settings.instructions,
      },
    }, 201);
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

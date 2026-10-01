import { NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidRazorpayWebhookSignature } from "@/lib/ebooks/payments";

type RouteWebhookPayload = {
  event?: string;
  account_id?: string;
  payload?: {
    transfer?: { entity?: {
      id?: string;
      status?: string;
      fees?: number;
      tax?: number;
      notes?: Record<string, string>;
      error?: { description?: string; reason?: string };
    } };
    merchant_product?: { entity?: { merchant_id?: string; activation_status?: string } };
  };
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const secret = serverEnv.RAZORPAY_ROUTE_WEBHOOK_SECRET;

  if (!secret) return NextResponse.json({ success: false, error: "Route webhook secret is not configured." }, { status: 503 });
  if (!signature || !isValidRazorpayWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ success: false, error: "Invalid webhook signature." }, { status: 400 });
  }

  let body: RouteWebhookPayload;
  try {
    body = JSON.parse(rawBody) as RouteWebhookPayload;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid webhook body." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (body.event === "transfer.processed" || body.event === "transfer.failed") {
    const transfer = body.payload?.transfer?.entity;
    if (!transfer?.id) return NextResponse.json({ success: true });

    let payoutId = transfer.notes?.payout_id;
    if (!payoutId) {
      const { data } = await admin.from("ebook_payouts")
        .select("id")
        .eq("provider", "razorpay_route")
        .eq("provider_reference", transfer.id)
        .maybeSingle();
      payoutId = data?.id;
    }

    if (payoutId) {
      const { error } = await admin.rpc("finalize_ebook_payout", {
        p_payout_id: payoutId,
        p_provider_reference: transfer.id,
        p_provider_status: body.event === "transfer.processed" ? "processed" : "failed",
        p_provider_fee: Number(transfer.fees ?? 0) / 100,
        p_provider_tax: Number(transfer.tax ?? 0) / 100,
        p_failure_reason: transfer.error?.description ?? transfer.error?.reason ?? null,
      });
      if (error) return NextResponse.json({ success: false, error: "Payout status could not be saved." }, { status: 500 });
    }
  }

  if (["product.route.under_review", "product.route.needs_clarification", "product.route.activated"].includes(body.event ?? "")) {
    const accountId = body.payload?.merchant_product?.entity?.merchant_id ?? body.account_id;
    const activationStatus = body.payload?.merchant_product?.entity?.activation_status
      ?? (body.event === "product.route.activated" ? "activated" : "under_review");
    if (accountId) {
      const { error } = await admin.from("ebook_seller_payout_accounts")
        .update({
          activation_status: activationStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("provider_account_id", accountId);
      if (error) return NextResponse.json({ success: false, error: "Seller account status could not be saved." }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
import { createAdminClient } from "@/lib/supabase/admin";
import { roundMoney, splitVerifiedSale, type MarketplacePricingRules } from "@/lib/ebooks/pricing";

export type EbookOrderRow = {
  id: string;
  order_number: string | null;
  ebook_id: string;
  buyer_user_id: string | null;
  seller_user_id: string;
  provider: string | null;
  provider_order_id: string | null;
  provider_transaction_id: string | null;
  status: "PENDING" | "VERIFIED" | "REFUNDED" | "FAILED";
  order_status: string;
  refund_status: string;
  currency: string;
  gross_amount: number | string;
  commission_percent: number | string | null;
  commission_amount: number | string | null;
  seller_amount: number | string | null;
  payment_fee: number | string | null;
  tax_amount: number | string | null;
  seller_net_amount: number | string | null;
  payout_status: string;
  verified_at: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
  provider_metadata?: Record<string, unknown> | null;
};

export type PurchasableEbook = {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  price: number | string;
  currency: string;
  status: string;
  external_product_url: string;
};

function orderNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `XB-${stamp}-${random}`;
}

/**
 * Creates a PENDING order row. An order only becomes payable once a signed
 * provider callback has been verified server-side; the buyer's browser can never
 * move this row to VERIFIED.
 */
export async function createPendingEbookOrder(input: {
  ebook: PurchasableEbook;
  buyerUserId: string;
  providerOrderId: string | null;
  config: MarketplacePricingRules;
  provider: string;
  metadata?: Record<string, unknown>;
}): Promise<EbookOrderRow> {
  const admin = createAdminClient();
  const settlement = splitVerifiedSale(Number(input.ebook.price), input.config.commissionPercent);

  const { data, error } = await admin
    .from("ebook_transactions")
    .insert({
      order_number: orderNumber(),
      ebook_id: input.ebook.id,
      buyer_user_id: input.buyerUserId,
      seller_user_id: input.ebook.user_id,
      provider: input.provider,
      provider_order_id: input.providerOrderId,
      status: "PENDING",
      order_status: "CREATED",
      currency: (input.ebook.currency || "INR").toUpperCase(),
      gross_amount: settlement.grossAmount,
      commission_percent: input.config.commissionPercent,
      commission_amount: settlement.commissionAmount,
      seller_amount: settlement.sellerAmount,
      payment_fee: null,
      tax_amount: null,
      seller_net_amount: null,
      payout_status: "NOT_AVAILABLE",
      provider_metadata: {
        ...(input.metadata ?? {}),
        ebook_title: input.ebook.title,
        ebook_slug: input.ebook.slug,
        price_snapshot: roundMoney(Number(input.ebook.price)),
      },
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as EbookOrderRow;
}

/** Idempotently finalises an order after server-side payment verification. */
export async function markEbookOrderPaid(input: {
  orderId: string;
  providerTransactionId: string;
  providerSignature?: string;
}): Promise<{ order: EbookOrderRow | null; alreadyPaid: boolean }> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: existing, error: readError } = await admin
    .from("ebook_transactions")
    .select("*")
    .eq("id", input.orderId)
    .maybeSingle();
  if (readError) throw readError;
  if (!existing) return { order: null, alreadyPaid: false };

  const existingOrder = existing as EbookOrderRow;
  if (existingOrder.status === "VERIFIED") return { order: existingOrder, alreadyPaid: true };

  const { data, error } = await admin
    .from("ebook_transactions")
    .update({
      status: "VERIFIED",
      order_status: "PAID",
      payout_status: "PENDING",
      provider_transaction_id: input.providerTransactionId,
      verified_at: now,
      paid_at: now,
      updated_at: now,
      provider_metadata: {
        ...(existingOrder.provider_metadata ?? {}),
        ...(input.providerSignature ? { provider_signature_verified: true } : {}),
      },
    })
    .eq("id", input.orderId)
    .eq("status", "PENDING")
    .select("*")
    .maybeSingle();
  if (error) throw error;

  if (!data) {
    const { data: current } = await admin.from("ebook_transactions").select("*").eq("id", input.orderId).maybeSingle();
    return { order: (current as EbookOrderRow) ?? null, alreadyPaid: true };
  }
  return { order: data as EbookOrderRow, alreadyPaid: false };
}

export async function markEbookOrderFulfilled(orderId: string) {
  const admin = createAdminClient();
  await admin
    .from("ebook_transactions")
    .update({ order_status: "FULFILLED", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("order_status", "PAID");
}

export async function recordVerifiedEbookPaymentCosts(input: {
  orderId: string;
  paymentFee: number;
  taxAmount: number;
}) {
  if (!Number.isFinite(input.paymentFee) || !Number.isFinite(input.taxAmount) || input.paymentFee < 0 || input.taxAmount < 0) {
    throw new Error("Provider fee and tax values must be non-negative numbers.");
  }
  const { error } = await createAdminClient().rpc("record_ebook_payment_costs", {
    p_transaction_id: input.orderId,
    p_payment_fee: roundMoney(input.paymentFee),
    p_tax_amount: roundMoney(input.taxAmount),
  });
  if (error) throw error;
}

/** Records a refund. Refunded orders stop counting toward seller earnings. */
export async function refundEbookOrder(orderId: string, reason: string) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("ebook_transactions")
    .update({
      status: "REFUNDED",
      order_status: "REFUNDED",
      refund_status: "REFUNDED",
      payout_status: "FAILED",
      refunded_at: now,
      updated_at: now,
      provider_metadata: { refund_reason: reason.slice(0, 500) },
    })
    .eq("id", orderId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as EbookOrderRow | null;
}

/**
 * Moves verified seller balances from PENDING to AVAILABLE once the configured
 * refund/dispute window has elapsed. Idempotent and safe to call repeatedly.
 */
export async function releaseDueEbookBalances(holdDays: number) {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - Math.max(0, holdDays) * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await admin
    .from("ebook_transactions")
    .update({ payout_status: "AVAILABLE", updated_at: new Date().toISOString() })
    .eq("status", "VERIFIED")
    .eq("payout_status", "PENDING")
    .lt("verified_at", cutoff);
  if (error) throw error;
}

/** Loads a published listing together with the fields needed to sell it. */
export async function loadPurchasableEbook(ebookId: string): Promise<PurchasableEbook | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ebook_listings")
    .select("id, user_id, title, slug, price, currency, status, external_product_url")
    .eq("id", ebookId)
    .eq("status", "PUBLISHED")
    .maybeSingle();
  if (error) throw error;
  return (data as PurchasableEbook) ?? null;
}

/** True when the buyer has a server-verified (paid) order for this eBook. */
export async function hasVerifiedEbookPurchase(userId: string, ebookId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ebook_transactions")
    .select("id")
    .eq("buyer_user_id", userId)
    .eq("ebook_id", ebookId)
    .eq("status", "VERIFIED")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function findOrderByProviderOrderId(providerOrderId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ebook_transactions")
    .select("*")
    .eq("provider_order_id", providerOrderId)
    .maybeSingle();
  if (error) throw error;
  return (data as EbookOrderRow) ?? null;
}
export async function findOrderById(orderId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("ebook_transactions").select("*").eq("id", orderId).maybeSingle();
  if (error) throw error;
  return (data as EbookOrderRow) ?? null;
}



\n
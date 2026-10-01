import "server-only";
import { serverEnv } from "@/lib/env.server";

export function isRazorpayRouteConfigured() {
  return serverEnv.RAZORPAY_ROUTE_ENABLED === "true"
    && Boolean(serverEnv.RAZORPAY_KEY_ID && serverEnv.RAZORPAY_KEY_SECRET && serverEnv.RAZORPAY_ROUTE_WEBHOOK_SECRET);
}

type SettlementAccount = {
  verification_status?: string;
  bank_account?: { account_number?: string };
  upi?: { vpa?: string };
};

type LinkedAccountResponse = {
  id?: string;
  status?: string;
  product_config?: {
    activation_status?: string;
    active_configuration?: { settlement_accounts?: SettlementAccount[] };
  };
};

type TransferResponse = {
  id?: string;
  status?: string;
  transfer_status?: string;
  fees?: number | string | null;
  tax?: number | string | null;
  error?: { description?: string; reason?: string } | null;
};

export class RazorpayRouteError extends Error {
  constructor(readonly status: number, message = "Razorpay Route request failed.") {
    super(message);
    this.name = "RazorpayRouteError";
  }
}

function routeHeaders(idempotencyKey?: string, idempotencyHeader = "Idempotency-Key"): HeadersInit {
  const keyId = serverEnv.RAZORPAY_KEY_ID;
  const keySecret = serverEnv.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new RazorpayRouteError(503, "Razorpay Route credentials are not configured.");

  return {
    Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
    "Content-Type": "application/json",
    ...(idempotencyKey ? { [idempotencyHeader]: idempotencyKey } : {}),
  };
}

async function requestRoute<T>(path: string, body: unknown, idempotencyKey?: string, idempotencyHeader?: string): Promise<T> {
  const response = await fetch(`https://api.razorpay.com${path}`, {
    method: "POST",
    headers: routeHeaders(idempotencyKey, idempotencyHeader),
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => null) as T | null;
  if (!response.ok || !payload) throw new RazorpayRouteError(response.ok ? 502 : response.status);
  return payload;
}

async function fetchRoute<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.razorpay.com${path}`, {
    method: "GET",
    headers: routeHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => null) as T | null;
  if (!response.ok || !payload) throw new RazorpayRouteError(response.ok ? 502 : response.status);
  return payload;
}

export async function fetchRazorpayRouteAccount(accountId: string) {
  const account = await fetchRoute<LinkedAccountResponse>(`/v2/accounts/${encodeURIComponent(accountId)}`);
  const settlementStatus = account.product_config?.active_configuration?.settlement_accounts?.[0];
  return {
    accountStatus: account.status ?? "created",
    activationStatus: account.product_config?.activation_status ?? "under_review",
    settlementVerificationStatus: settlementStatus?.verification_status ?? "pending",
  };
}

export async function createRazorpayRouteAccount(input: {
  sellerUserId: string;
  idempotencyKey: string;
  legalBusinessName: string;
  businessType: string;
  pan: string;
  gst?: string;
  email: string;
  phone: string;
  settlementAccount:
    | { method: "bank_account"; accountNumber: string; beneficiaryName: string; ifsc: string }
    | { method: "upi"; vpa: string; beneficiaryName: string };
}) {
  const settlement = input.settlementAccount.method === "bank_account"
    ? {
        method: "bank_account",
        bank_account: {
          account_number: input.settlementAccount.accountNumber,
          beneficiary_name: input.settlementAccount.beneficiaryName,
          code_type: "ifsc",
          code: input.settlementAccount.ifsc,
          currency: "INR",
          is_default: true,
        },
      }
    : {
        method: "upi",
        upi: {
          vpa: input.settlementAccount.vpa,
          beneficiary_name: input.settlementAccount.beneficiaryName,
          currency: "INR",
          is_default: true,
        },
      };

  const account = await requestRoute<LinkedAccountResponse>("/v2/accounts", {
    type: "route",
    tnc_accepted: true,
    reference_id: `xophol_${input.sellerUserId}`,
    legal_business_name: input.legalBusinessName,
    business_type: input.businessType,
    email: input.email,
    phone: input.phone,
    legal_info: { pan: input.pan, ...(input.gst ? { gst: input.gst } : {}) },
    settlement_accounts: [settlement],
  }, input.idempotencyKey);

  if (!account.id) throw new RazorpayRouteError(502);
  const settlementStatus = account.product_config?.active_configuration?.settlement_accounts?.[0];
  const accountNumber = settlementStatus?.bank_account?.account_number ?? "";
  const lastFour = accountNumber.replace(/\D/g, "").slice(-4);

  return {
    providerAccountId: account.id,
    accountStatus: account.status ?? "created",
    activationStatus: account.product_config?.activation_status ?? "under_review",
    settlementVerificationStatus: settlementStatus?.verification_status ?? "pending",
    settlementAccountLast4: lastFour,
  };
}

export async function createRazorpayRouteTransfer(input: {
  accountId: string;
  amountMinor: number;
  payoutId: string;
}) {
  const response = await requestRoute<TransferResponse>("/v1/transfers", {
    account: input.accountId,
    amount: input.amountMinor,
    currency: "INR",
    notes: { marketplace: "xophol_ebooks", payout_id: input.payoutId },
  }, input.payoutId, "X-Transfer-Idempotency");

  if (!response.id) throw new RazorpayRouteError(502);
  return {
    transferId: response.id,
    status: response.status ?? response.transfer_status ?? "pending",
    fee: Number(response.fees ?? 0) / 100,
    tax: Number(response.tax ?? 0) / 100,
    failureReason: response.error?.description ?? response.error?.reason ?? null,
  };
}
"use client";

import { useState, type FormEvent } from "react";
import { ExternalLink, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPaiseAsInr } from "@/lib/subscription-pricing";

type ResourceType = "ebook" | "mock_test";
type CheckoutData = {
  request: {
    id: string;
    title_snapshot: string;
    amount_minor: number;
    currency: string;
    status: string;
  };
  payment: { upi_id: string; payee_name: string; instructions: string | null };
};
type ApiResult<T> = { success?: boolean; data?: T; error?: string };

async function readData<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json().catch(() => null) as ApiResult<T> | null;
  if (!response.ok || !result?.success || !result.data) {
    throw new Error(result?.error || fallback);
  }
  return result.data;
}

export default function ManualUpiPurchase({
  resourceType,
  resourceId,
  buttonLabel = "Pay with UPI QR",
}: {
  resourceType: ResourceType;
  resourceId: string;
  buttonLabel?: string;
}) {
  const [checkout, setCheckout] = useState<CheckoutData | null>(null);
  const [referenceCode, setReferenceCode] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const upiUri = checkout
    ? `upi://pay?${new URLSearchParams({
      pa: checkout.payment.upi_id,
      pn: checkout.payment.payee_name || "Xophol",
      am: (checkout.request.amount_minor / 100).toFixed(2),
      cu: checkout.request.currency,
      tn: checkout.request.title_snapshot,
    }).toString()}`
    : null;

  async function startCheckout() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/manual-payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceType, resourceId }),
      });
      if (response.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      const data = await readData<CheckoutData>(response, "Unable to start manual UPI checkout.");
      setCheckout(data);
      setReferenceCode("");
      setEvidenceUrl("");
      if (data.request.status === "pending_verification") {
        setNotice("Your payment reference is already under review. We will unlock access after verification.");
      } else {
        setNotice(null);
      }
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Unable to start manual UPI checkout.");
    } finally {
      setLoading(false);
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!checkout) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/manual-payments/requests/${checkout.request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference_code: referenceCode.trim(),
          evidence_url: evidenceUrl.trim() || null,
        }),
      });
      await readData(response, "Unable to submit your payment for verification.");
      setCheckout({ ...checkout, request: { ...checkout.request, status: "pending_verification" } });
      setNotice("Payment submitted. Access will be enabled after staff verifies your UPI transaction.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit your payment for verification.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      {!checkout ? (
        <Button type="button" className="w-full" onClick={() => void startCheckout()} disabled={loading}>
          <QrCode aria-hidden="true" />
          {loading ? "Preparing QR…" : buttonLabel}
        </Button>
      ) : checkout.request.status === "pending_verification" ? (
        <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          {notice || "Payment is awaiting staff verification."}
        </p>
      ) : (
        <div className="space-y-4 rounded-xl border border-border p-4">
          <div>
            <p className="text-sm font-semibold">Scan to pay {formatPaiseAsInr(checkout.request.amount_minor)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Pay {checkout.payment.payee_name} using any UPI app.</p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="w-fit rounded-xl bg-white p-3" role="img" aria-label={`UPI payment QR for ${formatPaiseAsInr(checkout.request.amount_minor)}`}>
              <QRCodeSVG value={upiUri ?? ""} size={192} level="M" includeMargin />
            </div>
            <div className="space-y-3">
              <p className="text-sm">UPI ID: <code className="rounded bg-muted px-2 py-1">{checkout.payment.upi_id}</code></p>
              <a
                href={upiUri ?? undefined}
                className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ExternalLink aria-hidden="true" /> Open UPI app
              </a>
              {checkout.payment.instructions ? <p className="text-sm text-muted-foreground">{checkout.payment.instructions}</p> : null}
            </div>
          </div>

          <form onSubmit={submitPayment} className="space-y-3 border-t border-border pt-4">
            <div className="space-y-2">
              <Label htmlFor={`upi-reference-${checkout.request.id}`}>UPI transaction/reference ID</Label>
              <Input
                id={`upi-reference-${checkout.request.id}`}
                value={referenceCode}
                onChange={(event) => setReferenceCode(event.target.value)}
                minLength={3}
                maxLength={160}
                autoComplete="off"
                required
                placeholder="Enter the reference from your UPI app"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`upi-evidence-${checkout.request.id}`}>Payment evidence URL (optional)</Label>
              <Input
                id={`upi-evidence-${checkout.request.id}`}
                type="url"
                value={evidenceUrl}
                onChange={(event) => setEvidenceUrl(event.target.value)}
                maxLength={2048}
                placeholder="https://…"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit for verification"}
            </Button>
          </form>
        </div>
      )}
      {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      {notice && checkout?.request.status !== "pending_verification" ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
    </div>
  );
}

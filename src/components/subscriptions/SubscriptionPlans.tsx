"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, Copy, ExternalLink, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatPaiseAsInr,
  type ProductCatalogRecord,
} from "@/lib/subscription-pricing";

type Product = Pick<
  ProductCatalogRecord,
  | "code"
  | "product_type"
  | "board_code"
  | "class_number"
  | "name"
  | "description"
  | "price_paise"
  | "early_bird_price_paise"
  | "school_price_paise"
  | "duration_days"
  | "validity_starts_at"
  | "validity_ends_at"
  | "early_bird_starts_at"
  | "early_bird_ends_at"
> & {
  id: string;
  features: string[];
  current_price_paise: number;
  current_price_rule: "regular" | "early_bird" | "school_pricing";
};
type School = { id: string; name: string };
type PaymentSettings = {
  enabled: boolean;
  upi_id: string | null;
  payee_name: string | null;
  instructions: string | null;
  qr_code_url: string | null;
};
type Submission = {
  id: string;
  product_id: string;
  amount_minor: number;
  claimed_amount_minor?: number | null;
  payment_paid_at?: string | null;
  status: string;
  reference_code?: string;
  reason?: string | null;
  created_at?: string;
  product_snapshot?: { name?: string } | null;
};
type ApiResult<T> = { success?: boolean; data?: T; error?: string };
type CatalogData = { products: Product[]; payment: PaymentSettings };
type StudentData = { submissions: Submission[]; eligibleSchools: School[] };

async function readApiData<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json().catch(() => null) as ApiResult<T> | null;
  if (!response.ok || !result?.success || !result.data) {
    throw new Error(result?.error || fallback);
  }
  return result.data;
}

function productPrice(product: Product, isSchoolEligible = false) {
  return isSchoolEligible && product.school_price_paise !== null && product.school_price_paise !== undefined
    ? product.school_price_paise
    : product.current_price_paise;
}

function statusLabel(status: string) {
  switch (status) {
    case "pending_verification":
      return "Pending verification";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "duplicate_flagged":
      return "Flagged for review";
    case "cancelled":
      return "Cancelled";
    default:
      return "Status unavailable";
  }
}

export default function SubscriptionPlans({ isStudent = false }: { isStudent?: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [payment, setPayment] = useState<PaymentSettings | null>(null);
  const [eligibleSchools, setEligibleSchools] = useState<School[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [paymentRequestId, setPaymentRequestId] = useState("");
  const [upiSelected, setUpiSelected] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [referenceCode, setReferenceCode] = useState("");
  const [claimedAmount, setClaimedAmount] = useState("");
  const [paymentPaidAt, setPaymentPaidAt] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPlans() {
      try {
        const catalogResponse = await fetch("/api/payment-products", { cache: "no-store" });
        const catalog = await readApiData<CatalogData>(catalogResponse, "Unable to load subscription plans.");
        let studentData: StudentData | null = null;

        if (isStudent) {
          const studentResponse = await fetch("/api/payments/submissions", { cache: "no-store" });
          studentData = await readApiData<StudentData>(studentResponse, "Unable to load your payment history.");
        }

        if (!active) return;
        setProducts(catalog.products);
        setPayment(catalog.payment);
        setSubmissions(studentData?.submissions ?? []);
        setEligibleSchools(studentData?.eligibleSchools ?? []);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load subscription plans.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPlans();
    return () => {
      active = false;
    };
  }, [isStudent]);

  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? null;
  const selectedSchool = eligibleSchools.find((school) => school.id === selectedSchoolId) ?? null;
  const selectedPrice = selectedProduct
    ? productPrice(selectedProduct, Boolean(selectedSchool))
    : 0;
  const pendingProductIds = useMemo(
    () => new Set(submissions.filter((submission) => submission.status === "pending_verification").map((submission) => submission.product_id)),
    [submissions]
  );
  const upiUri = selectedProduct && payment?.upi_id
    ? `upi://pay?${new URLSearchParams({
      pa: payment.upi_id,
      pn: payment.payee_name || "Xophol",
      am: (selectedPrice / 100).toFixed(2),
      cu: "INR",
      tn: `Xophol ${paymentRequestId}`,
    }).toString()}`
    : null;

  async function copyUpiId() {
    if (!payment?.upi_id) return;
    try {
      await navigator.clipboard.writeText(payment.upi_id);
      setCopyNotice("UPI ID copied.");
    } catch {
      setCopyNotice("Could not copy the UPI ID. Please copy it manually.");
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProduct || !paymentRequestId || !receiptFile) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const formData = new FormData();
      formData.set("payment_request_id", paymentRequestId);
      formData.set("product_id", selectedProduct.id);
      if (selectedSchool) formData.set("school_id", selectedSchool.id);
      formData.set("claimed_amount", claimedAmount);
      formData.set("payment_paid_at", paymentPaidAt);
      formData.set("reference_code", referenceCode.trim());
      formData.set("receipt", receiptFile);

      const response = await fetch("/api/payments/submissions", {
        method: "POST",
        body: formData,
      });
      const submission = await readApiData<Submission>(response, "Unable to submit your payment for verification.");
      setSubmissions((current) => [submission, ...current.filter((item) => item.id !== submission.id)]);
      setReferenceCode("");
      setClaimedAmount("");
      setPaymentPaidAt("");
      setReceiptFile(null);
      setSelectedProductId(null);
      setSelectedSchoolId("");
      setPaymentRequestId("");
      setUpiSelected(false);
      setShowQrCode(false);
      setNotice(`Payment request ${submission.id} submitted. Admin review is normally completed within 24 hours. Your subscription will be activated only after the received payment is verified.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit your payment for verification.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-10 space-y-8">
      {loading ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading plans…
        </p>
      ) : null}
      {error && !selectedProduct ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      ) : null}
      {!loading && !error && products.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          No subscription plans are currently available. Please check back later.
        </p>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => {
          const price = productPrice(product);
          const pending = isStudent && pendingProductIds.has(product.id);
          const isFree = product.product_type === "free" || Number(product.price_paise) <= 0;
          const seasonDatesMissing = product.class_number === 10 && (!product.validity_starts_at || !product.validity_ends_at);

          return (
            <Card key={product.id} className={selectedProductId === product.id ? "border-primary shadow-lg" : ""}>
              <CardHeader>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Class {product.class_number}
                </p>
                <CardTitle>{product.name}</CardTitle>
                <CardDescription>{product.description || "Build confidence with focused exam preparation."}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="text-3xl font-semibold">{formatPaiseAsInr(price)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {product.duration_days ? `${product.duration_days} days of access` : "Subscription access"}
                    {selectedSchoolId && product.school_price_paise !== null && product.school_price_paise !== undefined
                      ? " · Verified school price"
                      : product.current_price_rule === "early_bird" ? " · Early-bird price" : ""}
                  </p>
                  {product.class_number === 10 && product.validity_starts_at && product.validity_ends_at ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Season access: {new Date(product.validity_starts_at).toLocaleDateString()}–{new Date(product.validity_ends_at).toLocaleDateString()}
                    </p>
                  ) : null}
                  {product.early_bird_price_paise !== null && product.early_bird_price_paise !== undefined && price < product.price_paise ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      <span className="sr-only">Regular price </span><s>{formatPaiseAsInr(product.price_paise)}</s>
                    </p>
                  ) : null}
                </div>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {product.features.length > 0
                    ? product.features.map((feature) => <li key={feature}>{feature}</li>)
                    : <li>Plan benefits will appear here when configured.</li>}
                </ul>
                {pending ? (
                  <Button type="button" variant="secondary" className="w-full" disabled>
                    Payment under review
                  </Button>
                ) : isFree ? (
                  isStudent ? (
                    <Button type="button" variant="secondary" className="w-full" disabled>Free plan</Button>
                  ) : (
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/register">Start free</Link>
                    </Button>
                  )
                ) : isStudent ? (
                  <Button
                    type="button"
                    className="w-full"
                    disabled={seasonDatesMissing}
                    onClick={() => {
                      setError(null);
                      setNotice(null);
                      setSelectedProductId(product.id);
                      setSelectedSchoolId("");
                      setPaymentRequestId(crypto.randomUUID());
                      setUpiSelected(false);
                      setShowQrCode(false);
                    }}
                  >
                    {seasonDatesMissing ? "Season dates pending" : "Continue to Payment"}
                  </Button>
                ) : (
                  <Button asChild className="w-full">
                    <Link href="/login?redirect=%2Fsubscriptions">Sign in to subscribe</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {isStudent && notice ? (
        <p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          {notice}
        </p>
      ) : null}

      {isStudent && selectedProduct ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-xl">Payment for {selectedProduct.name}</CardTitle>
            <CardDescription>Review the plan and exact price before choosing a payment method.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedProduct.school_price_paise !== null && selectedProduct.school_price_paise !== undefined ? (
              <div className="space-y-2">
                <Label htmlFor="eligible-school">Verified school discount</Label>
                <select
                  id="eligible-school"
                  value={selectedSchoolId}
                  onChange={(event) => setSelectedSchoolId(event.target.value)}
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Use standard pricing</option>
                  {eligibleSchools.map((school) => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </select>
                {eligibleSchools.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No verified school discount is linked to your account.</p>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">Amount due</p>
              <p className="mt-1 text-3xl font-semibold">{formatPaiseAsInr(selectedPrice)}</p>
              {selectedSchool ? <p className="mt-1 text-sm text-muted-foreground">Verified school pricing for {selectedSchool.name}</p> : null}
              <p className="mt-2 text-xs text-muted-foreground">Payment request ID: <code>{paymentRequestId}</code></p>
            </div>

            {!payment?.enabled || !payment.upi_id ? (
              <p role="alert" className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
                Manual UPI payments are not configured right now. Please try again later.
              </p>
            ) : !upiSelected ? (
              <Button type="button" onClick={() => setUpiSelected(true)}>Pay using UPI</Button>
            ) : (
              <div className="space-y-4 rounded-xl border border-border p-4">
                <div>
                  <p className="text-sm font-semibold">Pay using UPI</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pay exactly {formatPaiseAsInr(selectedPrice)} to {payment.payee_name || "Xophol"} using a supported UPI app.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <code className="rounded-lg bg-muted px-3 py-2 text-sm">{payment.upi_id}</code>
                  <Button type="button" variant="outline" size="sm" onClick={() => void copyUpiId()}>
                    <Copy aria-hidden="true" /> Copy UPI ID
                  </Button>
                  {upiUri ? (
                    <a
                      href={upiUri}
                      className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ExternalLink aria-hidden="true" /> Open UPI app
                    </a>
                  ) : null}
                </div>
                {copyNotice ? <p role="status" className="text-xs text-muted-foreground">{copyNotice}</p> : null}
                {payment.instructions ? <p className="text-sm text-muted-foreground">{payment.instructions}</p> : null}
                <p className="text-sm text-muted-foreground">
                  Include request ID <code>{paymentRequestId}</code> as the payment note when your UPI app supports it.
                  A fixed QR code does not guarantee the amount is correct; check the exact amount before confirming payment.
                </p>
                <Button type="button" variant="outline" onClick={() => setShowQrCode((shown) => !shown)}>
                  {showQrCode ? "Hide QR Code" : "Show QR Code"}
                </Button>
                {showQrCode ? (
                  payment.qr_code_url ? (
                    <div className="w-fit rounded-xl border border-border bg-white p-3">
                      <Image src={payment.qr_code_url} alt="Xophol UPI payment QR code" width={280} height={280} unoptimized />
                    </div>
                  ) : (
                    <p role="status" className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
                      The administrator has not configured a QR code. You can still pay to the UPI ID above.
                    </p>
                  )
                ) : null}
              </div>
            )}

            {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

            {payment?.enabled && upiSelected ? <form onSubmit={submitPayment} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payment-reference">UPI transaction/reference ID</Label>
                <Input
                  id="payment-reference"
                  required
                  minLength={3}
                  maxLength={255}
                  value={referenceCode}
                  onChange={(event) => setReferenceCode(event.target.value)}
                  placeholder="Enter the reference from your UPI app"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="claimed-amount">Amount paid (₹)</Label>
                <Input
                  id="claimed-amount"
                  type="text"
                  inputMode="decimal"
                  required
                  value={claimedAmount}
                  onChange={(event) => setClaimedAmount(event.target.value)}
                  placeholder="Enter the amount from your UPI receipt"
                />
                {claimedAmount && Number(claimedAmount) * 100 !== selectedPrice ? (
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Your claimed amount differs from the expected {formatPaiseAsInr(selectedPrice)}. An administrator will verify the actual received amount.
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-paid-at">Payment date and time (India Standard Time)</Label>
                <Input
                  id="payment-paid-at"
                  type="datetime-local"
                  required
                  value={paymentPaidAt}
                  onChange={(event) => setPaymentPaidAt(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-receipt">Payment receipt screenshot (JPEG, PNG, or WebP; max 3 MB)</Label>
                <Input
                  id="payment-receipt"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required
                  onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
                />
                {receiptFile ? <p className="text-xs text-muted-foreground">{receiptFile.name}</p> : null}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={submitting || !payment?.enabled || !payment.upi_id || !receiptFile}>
                  {submitting ? "Submitting…" : "Submit for verification"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setSelectedProductId(null)} disabled={submitting}>
                  Cancel
                </Button>
              </div>
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Your receipt and claims do not activate access. An administrator must verify the actual received payment; review is normally completed within 24 hours.
              </p>
            </form> : null}
          </CardContent>
        </Card>
      ) : null}

      {isStudent && submissions.length > 0 ? (
        <section className="space-y-3" aria-labelledby="payment-history-title">
          <h2 id="payment-history-title" className="text-xl font-semibold">Payment requests</h2>
          <div className="grid gap-3">
            {submissions.map((submission) => (
              <div key={submission.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
                <div>
                  <p className="font-medium">{submission.product_snapshot?.name || products.find((product) => product.id === submission.product_id)?.name || "Subscription plan"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Expected {formatPaiseAsInr(submission.amount_minor)}
                    {submission.claimed_amount_minor !== null && submission.claimed_amount_minor !== undefined
                      ? ` · Claimed ${formatPaiseAsInr(submission.claimed_amount_minor)}`
                      : ""}
                    {" · "}
                    {submission.created_at ? new Date(submission.created_at).toLocaleDateString() : "Recently submitted"}
                  </p>
                  {submission.payment_paid_at ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Claimed payment time: {new Date(submission.payment_paid_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">Request ID: <code>{submission.id}</code></p>
                  {submission.status === "rejected" && submission.reason ? (
                    <p className="mt-1 text-sm text-destructive">Reason: {submission.reason}</p>
                  ) : null}
                </div>
                <span className="rounded-full border border-border px-3 py-1 text-xs font-medium">
                  {statusLabel(submission.status)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {isStudent && submissions.length === 0 && !loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Check className="h-4 w-4" aria-hidden="true" /> No payment requests yet.
        </p>
      ) : null}
    </div>
  );
}

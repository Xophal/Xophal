"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatPaiseAsInr,
  resolveProductPrice,
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
> & { id: string };
type School = { id: string; name: string };
type PaymentSettings = {
  enabled: boolean;
  upi_id: string | null;
  payee_name: string | null;
  instructions: string | null;
};
type Submission = {
  id: string;
  product_id: string;
  amount_minor: number;
  status: string;
  reference_code?: string;
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
  return resolveProductPrice(product, { isSchoolEligible });
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
  const [referenceCode, setReferenceCode] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
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
    ? productPrice(selectedProduct, Boolean(selectedSchool)).pricePaise
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
      tn: selectedProduct.name,
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
    if (!selectedProduct) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/payments/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          school_id: selectedSchool?.id ?? null,
          amount_minor: selectedPrice,
          reference_code: referenceCode.trim(),
          evidence_url: evidenceUrl.trim() || null,
        }),
      });
      const submission = await readApiData<Submission>(response, "Unable to submit your payment for verification.");
      setSubmissions((current) => [submission, ...current.filter((item) => item.id !== submission.id)]);
      setReferenceCode("");
      setEvidenceUrl("");
      setSelectedProductId(null);
      setSelectedSchoolId("");
      setNotice("Payment submitted. Your subscription will be activated after verification.");
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
          const price = productPrice(product).pricePaise;
          const pending = isStudent && pendingProductIds.has(product.id);
          const isFree = product.product_type === "free" || Number(product.price_paise) <= 0;

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
                    {productPrice(product).appliedRule === "early_bird" ? " · Early-bird price" : ""}
                  </p>
                  {product.early_bird_price_paise !== null && product.early_bird_price_paise !== undefined && price < product.price_paise ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      <span className="sr-only">Regular price </span><s>{formatPaiseAsInr(product.price_paise)}</s>
                    </p>
                  ) : null}
                </div>
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
                    onClick={() => {
                      setError(null);
                      setNotice(null);
                      setSelectedProductId(product.id);
                      setSelectedSchoolId("");
                    }}
                  >
                    Choose plan
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
            <CardTitle className="text-xl">Complete payment for {selectedProduct.name}</CardTitle>
            <CardDescription>Pay the exact amount shown and submit the UPI transaction reference.</CardDescription>
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
            </div>

            {payment?.enabled && payment.upi_id && upiUri ? (
              <div className="space-y-3 rounded-xl border border-border p-4">
                <div>
                  <p className="text-sm font-semibold">Pay using UPI</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pay {formatPaiseAsInr(selectedPrice)} to {payment.payee_name || "Xophol"}.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <code className="rounded-lg bg-muted px-3 py-2 text-sm">{payment.upi_id}</code>
                  <Button type="button" variant="outline" size="sm" onClick={() => void copyUpiId()}>
                    <Copy aria-hidden="true" /> Copy UPI ID
                  </Button>
                  <a
                    href={upiUri}
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ExternalLink aria-hidden="true" /> Open UPI app
                  </a>
                </div>
                {copyNotice ? <p role="status" className="text-xs text-muted-foreground">{copyNotice}</p> : null}
                {payment.instructions ? <p className="text-sm text-muted-foreground">{payment.instructions}</p> : null}
              </div>
            ) : (
              <p role="alert" className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
                Manual UPI payments are not configured right now. Please try again later.
              </p>
            )}

            {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

            <form onSubmit={submitPayment} className="space-y-4">
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
                <Label htmlFor="payment-evidence">Payment evidence URL (optional)</Label>
                <Input
                  id="payment-evidence"
                  type="url"
                  maxLength={2048}
                  value={evidenceUrl}
                  onChange={(event) => setEvidenceUrl(event.target.value)}
                  placeholder="https://…"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={submitting || !payment?.enabled || !payment.upi_id}>
                  {submitting ? "Submitting…" : "Submit for verification"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setSelectedProductId(null)} disabled={submitting}>
                  Cancel
                </Button>
              </div>
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Access is activated only after payment verification. Do not submit a request until your UPI payment is complete.
              </p>
            </form>
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
                    {formatPaiseAsInr(submission.amount_minor)} · {submission.created_at ? new Date(submission.created_at).toLocaleDateString() : "Recently submitted"}
                  </p>
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

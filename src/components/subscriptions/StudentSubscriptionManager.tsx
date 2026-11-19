"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Clock3, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  duration_value: number;
  duration_unit: "days" | "months" | "years";
  features: string[] | null;
  applicable_board_codes: string[];
  applicable_class_numbers: number[];
  applicable_subject_ids: string[];
  included_mock_test_ids: string[];
  test_categories: string[];
  access_limitations: Record<string, unknown> | null;
};

type PaymentSettings = {
  enabled: boolean;
  upi_id: string | null;
  payee_name: string | null;
  instructions: string | null;
};

type Order = {
  id: string;
  subscription_plan_id: string;
  order_reference: string;
  amount_minor: number;
  final_amount_minor: number;
  currency: string;
  status: string;
  product_snapshot: { name?: string; code?: string } | null;
};

type Subscription = {
  id: string;
  status: string;
  effective_status: string;
  starts_at: string;
  expires_at: string;
  created_at: string;
  is_current: boolean;
  days_remaining: number;
  subscription_plans?: {
    name?: string;
    code?: string;
    applicable_board_codes?: string[] | null;
    applicable_class_numbers?: number[] | null;
    applicable_subject_ids?: string[] | null;
  } | null;
};

type PaymentHistory = Order & {
  reference_code: string | null;
  payment_paid_at: string | null;
  reason: string | null;
  created_at: string;
  approved_at: string | null;
  verified_at: string | null;
};

type SubscriptionHistory = {
  id: string;
  subscription_id: string;
  action: string;
  previous_status: string | null;
  new_status: string;
  notes: string | null;
  created_at: string;
  subscription_plans?: { name?: string; code?: string } | null;
};

type RefundHistory = {
  id: string;
  subscription_id: string;
  amount_minor: number;
  status: "pending" | "verified" | "rejected";
  refund_reference: string | null;
  refund_date: string | null;
  reason: string;
  created_at: string;
};

type AvailableTest = {
  id: string;
  title: string;
  slug: string;
  access_category: string;
};

type ApiEnvelope<T> = { success?: boolean; data?: T; error?: string };
type PaymentApiData = { plans: Plan[]; payment: PaymentSettings };
type SubscriptionApiData = {
  subscriptions: Subscription[];
  paymentHistory: PaymentHistory[];
  subscriptionHistory: SubscriptionHistory[];
  refundHistory: RefundHistory[];
  subjects: { id: string; name: string }[];
};
type AvailableTestsApiData = { data: AvailableTest[] };

async function fetchSubscriptionData() {
  const [plansResponse, subscriptionsResponse, testsResponse] = await Promise.all([
    fetch("/api/subscription-plans", { cache: "no-store" }),
    fetch("/api/subscriptions", { cache: "no-store" }),
    fetch("/api/mock-tests?limit=100", { cache: "no-store" }),
  ]);
  const plansData = await readApiData<PaymentApiData>(plansResponse, "Unable to load subscription plans.");
  const subscriptionsData = await readApiData<SubscriptionApiData>(subscriptionsResponse, "Unable to load your subscription history.");
  const testsData = await readApiData<AvailableTestsApiData>(testsResponse, "Unable to load available mock tests.");
  return { plansData, subscriptionsData, testsData };
}

async function readApiData<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json().catch(() => null) as ApiEnvelope<T> | null;
  if (!response.ok || !result?.success || !result.data) {
    throw new Error(result?.error || fallback);
  }
  return result.data;
}

function formatAmount(amountMinor: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

function paymentStatusMessage(status: string) {
  switch (status) {
    case "pending_payment":
      return "Order created. Complete the UPI payment and submit its transaction reference.";
    case "pending_verification":
      return "Payment verification is pending. Access will begin only after an administrator verifies the incoming payment.";
    case "under_review":
      return "Your payment is under review. Check the note below for any additional information requested.";
    case "approved":
      return "Payment verified. Your subscription is active or queued until the current subscription expires.";
    case "rejected":
      return "Payment was not approved. Review the reason below and contact support if needed.";
    case "cancelled":
      return "This payment order was cancelled.";
    default:
      return status.replaceAll("_", " ");
  }
}

function statusTone(status: string) {
  if (status === "active" || status === "approved" || status === "verified") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  if (status === "pending_payment" || status === "pending_verification" || status === "under_review") return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-100";
  if (status === "rejected" || status === "suspended" || status === "refunded") return "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-100";
  return "border-border bg-muted/40 text-muted-foreground";
}

function subscriptionStatusMessage(status: string) {
  switch (status) {
    case "expired":
      return "Your subscription has expired. Renew to restore premium test access.";
    case "suspended":
      return "Your subscription is suspended and premium test access is paused. Contact support if you need help.";
    case "cancelled":
      return "Your subscription was revoked. Choose a plan below to purchase access again.";
    case "refunded":
      return "This subscription was refunded and is no longer available for test access.";
    case "rejected":
      return "This subscription was not activated. Review the related payment status for details.";
    default:
      return "You do not currently have active access. Choose a plan below to renew.";
  }
}

export default function StudentSubscriptionManager() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payment, setPayment] = useState<PaymentSettings | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionHistory[]>([]);
  const [refundHistory, setRefundHistory] = useState<RefundHistory[]>([]);
  const [subjectNames, setSubjectNames] = useState<Record<string, string>>({});
  const [availablePremiumTests, setAvailablePremiumTests] = useState<AvailableTest[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [activePayment, setActivePayment] = useState<PaymentSettings | null>(null);
  const [referenceCode, setReferenceCode] = useState("");
  const [paymentPaidAt, setPaymentPaidAt] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [evidencePath, setEvidencePath] = useState("");
  const [reviewEvidencePath, setReviewEvidencePath] = useState("");
  const [additionalInformation, setAdditionalInformation] = useState<Record<string, string>>({});
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [submittingInformationFor, setSubmittingInformationFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingOrderFor, setStartingOrderFor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    try {
      const { plansData, subscriptionsData, testsData } = await fetchSubscriptionData();
      setPlans(plansData.plans);
      setPayment(plansData.payment);
      setSubscriptions(subscriptionsData.subscriptions);
      setPaymentHistory(subscriptionsData.paymentHistory);
      setSubscriptionHistory(subscriptionsData.subscriptionHistory);
      setRefundHistory(subscriptionsData.refundHistory);
      setSubjectNames(Object.fromEntries(subscriptionsData.subjects.map((subject) => [subject.id, subject.name])));
      setAvailablePremiumTests(testsData.data.filter((test) => test.access_category !== "free"));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load subscriptions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void fetchSubscriptionData()
      .then(({ plansData, subscriptionsData, testsData }) => {
        if (cancelled) return;
        setPlans(plansData.plans);
        setPayment(plansData.payment);
        setSubscriptions(subscriptionsData.subscriptions);
        setPaymentHistory(subscriptionsData.paymentHistory);
        setSubscriptionHistory(subscriptionsData.subscriptionHistory);
        setRefundHistory(subscriptionsData.refundHistory);
        setSubjectNames(Object.fromEntries(subscriptionsData.subjects.map((subject) => [subject.id, subject.name])));
        setAvailablePremiumTests(testsData.data.filter((test) => test.access_category !== "free"));
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load subscriptions.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingPlanIds = useMemo(
    () => new Set(paymentHistory
      .filter((order) => ["pending_payment", "pending_verification", "under_review"].includes(order.status))
      .map((order) => order.subscription_plan_id)),
    [paymentHistory]
  );
  const visiblePlans = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return plans;
    return plans.filter((plan) =>
      `${plan.name} ${plan.code} ${plan.description ?? ""}`.toLowerCase().includes(query)
    );
  }, [plans, search]);

  async function beginOrder(plan: Plan) {
    setStartingOrderFor(plan.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/subscription-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: plan.id }),
      });
      const data = await readApiData<{ order: Order; payment: PaymentSettings }>(response, "Unable to create your subscription order.");
      setActiveOrder(data.order);
      setActivePayment(data.payment);
      setReferenceCode("");
      setPaymentPaidAt("");
      setPaymentNote("");
      setEvidencePath("");
      document.getElementById("subscription-checkout")?.scrollIntoView({ behavior: "smooth" });
    } catch (orderError) {
      setError(orderError instanceof Error ? orderError.message : "Unable to create your subscription order.");
    } finally {
      setStartingOrderFor(null);
    }
  }

  async function uploadEvidence(file: File | undefined, setUploadedPath: (path: string) => void = setEvidencePath) {
    if (!file) return;
    setUploadingEvidence(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/subscription-evidence", { method: "POST", body: formData });
      const data = await readApiData<{ evidencePath: string }>(response, "Unable to upload the payment screenshot.");
      setUploadedPath(data.evidencePath);
      setNotice("Payment screenshot uploaded privately.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload the payment screenshot.");
    } finally {
      setUploadingEvidence(false);
    }
  }

  async function submitAdditionalInformation(order: PaymentHistory) {
    const note = additionalInformation[order.id]?.trim();
    if (!note || note.length < 3) {
      setError("Enter the additional payment information requested by the administrator.");
      return;
    }
    setSubmittingInformationFor(order.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/subscription-orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          additional_information: note,
          evidence_url: reviewEvidencePath || null,
        }),
      });
      await readApiData(response, "Unable to submit the additional payment information.");
      setAdditionalInformation((current) => ({ ...current, [order.id]: "" }));
      setReviewEvidencePath("");
      setNotice("Additional information submitted. Your payment is back in the verification queue; access remains locked.");
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit the additional payment information.");
    } finally {
      setSubmittingInformationFor(null);
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeOrder) return;
    setSubmittingPayment(true);
    setError(null);
    setNotice(null);
    try {
      const paidAt = new Date(paymentPaidAt);
      if (!Number.isFinite(paidAt.getTime())) throw new Error("Enter a valid payment date and time.");
      const response = await fetch(`/api/subscription-orders/${activeOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference_code: referenceCode.trim(),
          payment_paid_at: paidAt.toISOString(),
          evidence_url: evidencePath || null,
          payment_note: paymentNote.trim() || null,
        }),
      });
      await readApiData(response, "Unable to submit your payment for verification.");
      setNotice("Payment submitted for manual verification. Subscription access remains locked until an administrator confirms the actual incoming payment.");
      setActiveOrder(null);
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit your payment for verification.");
    } finally {
      setSubmittingPayment(false);
    }
  }

  function upiUri(order: Order, settings: PaymentSettings) {
    if (!settings.upi_id) return "";
    const amount = (order.final_amount_minor ?? order.amount_minor) / 100;
    return `upi://pay?${new URLSearchParams({
      pa: settings.upi_id,
      pn: settings.payee_name || "Xophal",
      am: amount.toFixed(2),
      cu: order.currency || "INR",
      tr: order.order_reference,
      tn: `Xophol subscription ${order.order_reference}`,
    }).toString()}`;
  }

  const activeSubscriptions = subscriptions.filter((subscription) => subscription.is_current);
  const mostRecentActive = activeSubscriptions[0] ?? null;
  const queuedSubscription = subscriptions.find((subscription) => subscription.effective_status === "queued");
  const latestSubscription = subscriptions[0] ?? null;

  return (
    <div className="space-y-8">
      {error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}
      {notice ? <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-100">{notice}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>My subscription</CardTitle>
          <CardDescription>Your access is derived from server-verified subscriptions and expires automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your subscription…
            </p>
          ) : mostRecentActive ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{mostRecentActive.subscription_plans?.name || "Active subscription"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Starts {formatDate(mostRecentActive.starts_at)} · Expires {formatDate(mostRecentActive.expires_at)}
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone("active")}`}>Active</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {mostRecentActive.days_remaining} days remaining
              </p>
              {mostRecentActive.days_remaining <= 7 ? (
                <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-200">Your subscription is expiring soon. Renew to keep premium access.</p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                Boards: {mostRecentActive.subscription_plans?.applicable_board_codes?.length ? mostRecentActive.subscription_plans.applicable_board_codes.join(", ") : "All"} ·
                Classes: {mostRecentActive.subscription_plans?.applicable_class_numbers?.length ? mostRecentActive.subscription_plans.applicable_class_numbers.join(", ") : "All"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Subjects: {mostRecentActive.subscription_plans?.applicable_subject_ids?.length
                  ? mostRecentActive.subscription_plans.applicable_subject_ids.map((id) => subjectNames[id] || id).join(", ")
                  : "All"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" asChild><a href="#subscription-plans">View plans</a></Button>
                <Button type="button" size="sm" asChild><a href="#subscription-plans">Renew subscription</a></Button>
              </div>
            </div>
          ) : queuedSubscription ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="font-semibold">{queuedSubscription.subscription_plans?.name || "Queued subscription"}</p>
              <p className="mt-1 text-sm text-muted-foreground">Queued access begins {formatDate(queuedSubscription.starts_at)} and expires {formatDate(queuedSubscription.expires_at)}.</p>
            </div>
          ) : subscriptions.length > 0 ? (
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
              <p>{subscriptionStatusMessage(latestSubscription?.effective_status ?? "expired")}</p>
              {latestSubscription ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {latestSubscription.subscription_plans?.name || "Subscription"} · {latestSubscription.effective_status.replaceAll("_", " ")}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              You do not have an active subscription yet. Free mock tests remain available.
            </p>
          )}
          {!mostRecentActive ? (
            <Button type="button" size="sm" variant="outline" asChild><a href="#subscription-plans">View plans</a></Button>
          ) : null}
          {mostRecentActive ? (
            <div className="space-y-2">
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Premium tests are checked against your active plan, test availability, and board/class/subject eligibility on the server.
              </p>
              <div>
                <h3 className="text-sm font-semibold">Available premium tests ({availablePremiumTests.length})</h3>
                {availablePremiumTests.length ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {availablePremiumTests.map((test) => (
                      <li key={test.id}><a className="text-primary underline-offset-4 hover:underline" href={`/test/${test.slug}`}>{test.title}</a></li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">No eligible premium tests are currently published.</p>
                )}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <section id="subscription-plans" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Available plans</h2>
            <p className="mt-1 text-sm text-muted-foreground">Select a plan to create a pending order and view its exact UPI QR amount.</p>
          </div>
          <Input
            aria-label="Search subscription plans"
            className="max-w-xs"
            placeholder="Search plans"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {loading ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading plans…
          </p>
        ) : visiblePlans.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            {plans.length ? "No plans match your search." : "No subscription plans are currently available."}
          </p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visiblePlans.map((plan) => {
              const pending = pendingPlanIds.has(plan.id);
              return (
                <Card key={plan.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription>{plan.description || "Focused mock-test preparation."}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-4">
                    <p className="text-3xl font-semibold">{formatAmount(Math.round(Number(plan.price) * 100), plan.currency)}</p>
                    <p className="text-sm text-muted-foreground">{plan.duration_value} {plan.duration_unit} of access</p>
                    <p className="text-xs text-muted-foreground">
                      Boards: {plan.applicable_board_codes.length ? plan.applicable_board_codes.join(", ") : "All"} ·
                      Classes: {plan.applicable_class_numbers.length ? plan.applicable_class_numbers.join(", ") : "All"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Subjects: {plan.applicable_subject_ids.length
                        ? plan.applicable_subject_ids.map((id) => subjectNames[id] || id).join(", ")
                        : "All"}
                    </p>
                    {plan.test_categories.length ? (
                      <p className="text-xs text-muted-foreground">Test categories: {plan.test_categories.join(", ")}</p>
                    ) : null}
                    {typeof plan.access_limitations?.max_attempts_per_test === "number" ? (
                      <p className="text-xs text-muted-foreground">Up to {plan.access_limitations.max_attempts_per_test} attempts per included test.</p>
                    ) : null}
                    {plan.features?.length ? (
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {plan.features.map((feature) => <li key={feature}>• {feature}</li>)}
                      </ul>
                    ) : null}
                    <Button
                      className="mt-auto w-full"
                      disabled={pending || startingOrderFor === plan.id || !payment?.enabled}
                      onClick={() => void beginOrder(plan)}
                    >
                      {startingOrderFor === plan.id ? "Creating order…" : pending ? "Payment verification pending" : mostRecentActive ? "Renew subscription" : "Subscribe"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {activeOrder && activePayment ? (
        <Card id="subscription-checkout" className="border-primary/40">
          <CardHeader>
            <CardTitle>Complete payment for {activeOrder.product_snapshot?.name || "your plan"}</CardTitle>
            <CardDescription>Pay only the order amount shown. Access stays locked until an administrator verifies the incoming payment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Exact amount due</p>
                <p className="mt-1 text-2xl font-semibold">{formatAmount(activeOrder.final_amount_minor, activeOrder.currency)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unique order reference</p>
                <code className="mt-1 block font-semibold">{activeOrder.order_reference}</code>
              </div>
            </div>

            {activeOrder.status === "pending_payment" && activePayment.upi_id ? (
              <>
                <div className="flex flex-col gap-4 rounded-xl border border-border p-4 sm:flex-row sm:items-center">
                  <div className="w-fit rounded-xl bg-white p-3" role="img" aria-label={`UPI QR for ${formatAmount(activeOrder.final_amount_minor, activeOrder.currency)}`}>
                    <QRCodeSVG value={upiUri(activeOrder, activePayment)} size={192} level="M" includeMargin />
                  </div>
                  <div className="space-y-2 text-sm">
                    <p>Scan with your UPI app and pay {formatAmount(activeOrder.final_amount_minor, activeOrder.currency)} to {activePayment.payee_name || "Xophal"}.</p>
                    <p>Use order reference <code>{activeOrder.order_reference}</code> as the payment note.</p>
                    <p className="font-medium">UPI ID: {activePayment.upi_id}</p>
                    {activePayment.instructions ? <p className="text-muted-foreground">{activePayment.instructions}</p> : null}
                  </div>
                </div>
                <form onSubmit={submitPayment} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="subscription-utr">UPI transaction ID / UTR</Label>
                    <Input id="subscription-utr" minLength={3} maxLength={255} required value={referenceCode} onChange={(event) => setReferenceCode(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subscription-paid-at">Payment date and time</Label>
                    <Input id="subscription-paid-at" type="datetime-local" required value={paymentPaidAt} onChange={(event) => setPaymentPaidAt(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subscription-evidence">Payment screenshot (optional)</Label>
                    <Input
                      id="subscription-evidence"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => void uploadEvidence(event.target.files?.[0])}
                      disabled={uploadingEvidence}
                    />
                    {uploadingEvidence ? <p className="text-xs text-muted-foreground">Uploading privately…</p> : null}
                    {evidencePath ? <p className="text-xs text-emerald-700 dark:text-emerald-300">Screenshot securely uploaded.</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subscription-payment-note">Optional note</Label>
                    <Input id="subscription-payment-note" maxLength={1000} value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} />
                  </div>
                  <Button type="submit" disabled={submittingPayment || uploadingEvidence}>
                    {submittingPayment ? "Submitting…" : "Submit for payment verification"}
                  </Button>
                </form>
              </>
            ) : (
              <p role="status" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {paymentStatusMessage(activeOrder.status)}
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Payment history</h2>
        {paymentHistory.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> No subscription payment orders yet.</p>
        ) : (
          <div className="space-y-3">
            {paymentHistory.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4">
                  <div>
                    <p className="font-semibold">{entry.product_snapshot?.name || "Subscription order"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatAmount(entry.final_amount_minor, entry.currency)} · {entry.order_reference} · {formatDate(entry.created_at)}
                    </p>
                    {entry.reference_code ? <p className="mt-1 text-xs text-muted-foreground">UTR: {entry.reference_code}</p> : null}
                    {entry.payment_paid_at ? <p className="text-xs text-muted-foreground">Paid: {new Date(entry.payment_paid_at).toLocaleString()}</p> : null}
                    <p className="mt-2 text-sm">{paymentStatusMessage(entry.status)}</p>
                    {entry.reason ? <p className="mt-1 text-sm text-rose-600">{entry.reason}</p> : null}
                    {entry.status === "under_review" ? (
                      <div className="mt-3 space-y-2">
                        <Label htmlFor={`payment-additional-${entry.id}`}>Additional information</Label>
                        <Input
                          id={`payment-additional-${entry.id}`}
                          maxLength={1000}
                          value={additionalInformation[entry.id] ?? ""}
                          onChange={(event) => setAdditionalInformation((current) => ({ ...current, [entry.id]: event.target.value }))}
                          placeholder="Reply to the administrator's request"
                        />
                        <Input
                          aria-label="Optional additional payment screenshot"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(event) => void uploadEvidence(event.target.files?.[0], setReviewEvidencePath)}
                          disabled={uploadingEvidence}
                        />
                        {reviewEvidencePath ? <p className="text-xs text-emerald-700 dark:text-emerald-300">Additional screenshot securely uploaded.</p> : null}
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void submitAdditionalInformation(entry)}
                          disabled={submittingInformationFor === entry.id || uploadingEvidence}
                        >
                          {submittingInformationFor === entry.id ? "Submitting…" : "Submit additional information"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone(entry.status)}`}>{entry.status.replaceAll("_", " ")}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Refund history</h2>
        {refundHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subscription refunds have been recorded.</p>
        ) : (
          <div className="space-y-3">
            {refundHistory.map((refund) => (
              <Card key={refund.id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4">
                  <div>
                    <p className="font-semibold">{formatAmount(refund.amount_minor)} · {refund.status}</p>
                    {refund.status === "verified" ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Verified on {refund.refund_date ? new Date(refund.refund_date).toLocaleString() : formatDate(refund.created_at)}
                        {refund.refund_reference ? ` · Ref: ${refund.refund_reference}` : ""}
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm text-muted-foreground">{refund.reason}</p>
                    {refund.status === "pending" ? (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-200">The refund is not marked complete until Xophal verifies the outgoing payment.</p>
                    ) : null}
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone(refund.status)}`}>{refund.status}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Subscription history</h2>
        {subscriptionHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subscription changes have been recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {subscriptionHistory.map((entry) => (
              <div key={entry.id} className="flex flex-wrap justify-between gap-3 rounded-xl border border-border bg-card p-4 text-sm">
                <div>
                  <p className="font-medium">{entry.subscription_plans?.name || "Subscription"} · {entry.action.replaceAll("_", " ")}</p>
                  <p className="text-muted-foreground">{entry.previous_status ? `${entry.previous_status} → ` : ""}{entry.new_status}</p>
                  {entry.notes ? <p className="mt-1 text-muted-foreground">{entry.notes}</p> : null}
                </div>
                <time className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</time>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Banknote, CheckCircle2, ExternalLink, RefreshCw, Save, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AdminChip,
  AdminEmpty,
  AdminLoading,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  AdminPagination,
  AdminToolbar,
  readList,
} from "@/components/admin/ui";
import { formatPaiseAsInr } from "@/lib/subscription-pricing";

type PaymentSettings = {
  upi_id: string;
  payee_name: string;
  instructions: string;
  qr_code_url: string;
  is_enabled: boolean;
};

type Submission = {
  id: string;
  user_id: string;
  product_id: string | null;
  amount_minor: number;
  final_amount_minor: number;
  claimed_amount_minor: number | null;
  payment_paid_at: string | null;
  currency: string;
  status: string;
  reference_code: string | null;
  receipt_url: string | null;
  created_at: string;
  approved_at: string | null;
  reason: string | null;
  product_snapshot: { name?: string } | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
  product_catalog?: { name?: string | null; code?: string | null } | null;
};

type CatalogProduct = {
  id: string;
  name: string;
  code: string;
  class_number: number;
  price_paise: number;
  validity_starts_at: string | null;
  validity_ends_at: string | null;
};

type EditableSeasonProduct = CatalogProduct & {
  validity_starts_input: string;
  validity_ends_input: string;
};

type ApiResult<T> = { success?: boolean; data?: T; error?: string };

const PAGE_SIZE = 20;

async function readData<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json().catch(() => null) as ApiResult<T> | null;
  if (!response.ok || !result?.success || result.data === undefined) {
    throw new Error(result?.error || fallback);
  }
  return result.data;
}

function toIndiaDateTimeInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function fromIndiaDateTimeInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}:00+05:30`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export default function ManualPaymentsPanel({
  canConfigure,
  canReview,
}: {
  canConfigure: boolean;
  canReview: boolean;
}) {
  const [settings, setSettings] = useState<PaymentSettings>({
    upi_id: "",
    payee_name: "",
    instructions: "",
    qr_code_url: "",
    is_enabled: false,
  });
  const [settingsLoading, setSettingsLoading] = useState(canConfigure);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const [products, setProducts] = useState<EditableSeasonProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(canConfigure);
  const [productSavingId, setProductSavingId] = useState<string | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [productNotice, setProductNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("pending_verification");
  const [page, setPage] = useState(1);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [total, setTotal] = useState(0);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    async function loadQueue() {
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        if (statusFilter !== "all") params.set("status", statusFilter);
        const response = await fetch(`/api/admin/payment-submissions?${params.toString()}`, { cache: "no-store" });
        const result = await response.json().catch(() => null) as ApiResult<unknown> | null;
        if (!response.ok || !result?.success) {
          throw new Error(result?.error || "Unable to load payment submissions.");
        }
        const parsed = readList<Submission>(result);
        if (!active) return;
        setQueueError(null);
        setSubmissions(parsed.items);
        setTotal(parsed.total);
      } catch (error) {
        if (active) setQueueError(error instanceof Error ? error.message : "Unable to load payment submissions.");
      } finally {
        if (active) setQueueLoading(false);
      }
    }

    void loadQueue();
    return () => {
      active = false;
    };
  }, [page, statusFilter]);

  useEffect(() => {
    if (!canConfigure) return;
    let active = true;
    async function loadConfiguration() {
      try {
        const [settingsResponse, productsResponse] = await Promise.all([
          fetch("/api/admin/manual-payment-settings", { cache: "no-store" }),
          fetch("/api/admin/products", { cache: "no-store" }),
        ]);
        const savedSettings = await readData<PaymentSettings | null>(settingsResponse, "Unable to load UPI settings.");
        const catalog = await readData<CatalogProduct[]>(productsResponse, "Unable to load subscription products.");
        if (!active) return;
        setSettings(savedSettings ? {
          upi_id: savedSettings.upi_id ?? "",
          payee_name: savedSettings.payee_name ?? "",
          instructions: savedSettings.instructions ?? "",
          qr_code_url: savedSettings.qr_code_url ?? "",
          is_enabled: Boolean(savedSettings.is_enabled),
        } : {
          upi_id: "",
          payee_name: "",
          instructions: "",
          qr_code_url: "",
          is_enabled: false,
        });
        setProducts(catalog.filter((product) => product.class_number === 10).map((product) => ({
          ...product,
          validity_starts_input: toIndiaDateTimeInput(product.validity_starts_at),
          validity_ends_input: toIndiaDateTimeInput(product.validity_ends_at),
        })));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load payment configuration.";
        if (active) {
          setSettingsError(message);
          setProductError(message);
        }
      } finally {
        if (active) {
          setSettingsLoading(false);
          setProductsLoading(false);
        }
      }
    }

    void loadConfiguration();
    return () => {
      active = false;
    };
  }, [canConfigure]);

  async function loadQueue() {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const response = await fetch(`/api/admin/payment-submissions?${params.toString()}`, { cache: "no-store" });
      const result = await response.json().catch(() => null) as ApiResult<unknown> | null;
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to load payment submissions.");
      }
      const parsed = readList<Submission>(result);
      setQueueError(null);
      setSubmissions(parsed.items);
      setTotal(parsed.total);
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Unable to load payment submissions.");
    } finally {
      setQueueLoading(false);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsSaving(true);
    setSettingsError(null);
    setSettingsNotice(null);
    try {
      const response = await fetch("/api/admin/manual-payment-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upi_id: settings.upi_id.trim(),
          payee_name: settings.payee_name.trim(),
          instructions: settings.instructions.trim() || null,
          qr_code_url: settings.qr_code_url.trim() || null,
          is_enabled: settings.is_enabled,
        }),
      });
      const saved = await readData<PaymentSettings>(response, "Unable to save UPI settings.");
      setSettings((current) => ({ ...current, ...saved }));
      setSettingsNotice("Manual UPI settings saved.");
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Unable to save UPI settings.");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function saveSeasonDates(product: EditableSeasonProduct) {
    setProductSavingId(product.id);
    setProductError(null);
    setProductNotice(null);
    const startsAt = fromIndiaDateTimeInput(product.validity_starts_input);
    const endsAt = fromIndiaDateTimeInput(product.validity_ends_input);
    if (!startsAt || !endsAt || new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      setProductError("Set valid Class 10 season start and end dates in India Standard Time; the end must be after the start.");
      setProductSavingId(null);
      return;
    }

    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          validity_starts_at: startsAt,
          validity_ends_at: endsAt,
        }),
      });
      const saved = await readData<CatalogProduct>(response, "Unable to save Class 10 season dates.");
      setProducts((current) => current.map((item) => item.id === saved.id ? {
        ...item,
        validity_starts_at: saved.validity_starts_at,
        validity_ends_at: saved.validity_ends_at,
        validity_starts_input: toIndiaDateTimeInput(saved.validity_starts_at),
        validity_ends_input: toIndiaDateTimeInput(saved.validity_ends_at),
      } : item));
      setProductNotice(`${product.name} season dates saved.`);
    } catch (error) {
      setProductError(error instanceof Error ? error.message : "Unable to save Class 10 season dates.");
    } finally {
      setProductSavingId(null);
    }
  }

  async function reviewSubmission(submission: Submission, status: "approved" | "rejected") {
    const reason = rejectionReasons[submission.id]?.trim() ?? "";
    if (status === "rejected" && !reason) {
      setQueueError("Enter a reason before rejecting a payment.");
      return;
    }
    setWorkingId(submission.id);
    setQueueError(null);
    try {
      const response = await fetch(`/api/admin/payment-submissions/${submission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason: reason || null }),
      });
      await readData<{ status: string }>(response, "Unable to review this payment.");
      setQueueLoading(true);
      await loadQueue();
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Unable to review this payment.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Commerce"
        title="Manual UPI payments"
        description="Configure the receiving account, verify UPI receipts, and grant subscription access only after payment is confirmed."
        actions={<AdminChip tone={canReview ? "success" : "info"}>{canReview ? "Payment review access" : "Read-only review access"}</AdminChip>}
      />

      {canConfigure ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <AdminPanel eyebrow="Payment collection" title="UPI account" icon={Banknote}>
            {settingsLoading ? <AdminLoading label="Loading UPI settings…" /> : (
              <form onSubmit={saveSettings} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="manual-upi-id">UPI ID</Label>
                  <Input id="manual-upi-id" value={settings.upi_id} onChange={(event) => setSettings({ ...settings, upi_id: event.target.value })} required placeholder="merchant@bank" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-upi-payee">Payee name</Label>
                  <Input id="manual-upi-payee" value={settings.payee_name} onChange={(event) => setSettings({ ...settings, payee_name: event.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-upi-instructions">Student instructions</Label>
                  <textarea id="manual-upi-instructions" value={settings.instructions} onChange={(event) => setSettings({ ...settings, instructions: event.target.value })} maxLength={2000} rows={3} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-upi-qr">QR image path (optional)</Label>
                  <Input id="manual-upi-qr" value={settings.qr_code_url} onChange={(event) => setSettings({ ...settings, qr_code_url: event.target.value })} placeholder="/images/payment-qr.png" />
                  <p className="text-xs text-slate-400">Use a same-site path, for example an image placed under the public directory. Verify the QR points to this payee before enabling payments.</p>
                </div>
                <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                  <input type="checkbox" checked={settings.is_enabled} onChange={(event) => setSettings({ ...settings, is_enabled: event.target.checked })} className="mt-1" />
                  <span><span className="font-semibold">Accept manual UPI payment submissions</span><br /><span className="text-xs text-slate-400">Only enable this after verifying the UPI ID and payee details.</span></span>
                </label>
                {settingsError ? <p role="alert" className="text-sm text-rose-300">{settingsError}</p> : null}
                {settingsNotice ? <p role="status" className="text-sm text-emerald-300">{settingsNotice}</p> : null}
                <Button type="submit" disabled={settingsSaving} isLoading={settingsSaving} loadingText="Saving settings…">
                  <Save aria-hidden /> Save UPI settings
                </Button>
              </form>
            )}
          </AdminPanel>

          <AdminPanel eyebrow="Access configuration" title="Class 10 season dates" icon={ShieldCheck}>
            {productsLoading ? <AdminLoading label="Loading subscription products…" /> : products.length === 0 ? (
              <AdminEmpty title="No Class 10 products found" hint="Apply the product catalog migrations before configuring season access." />
            ) : (
              <div className="space-y-5">
                <p className="text-sm text-slate-400">Class 10 plans stay unavailable to students until both dates are configured. All dates are entered in India Standard Time.</p>
                {products.map((product) => (
                  <div key={product.id} className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-white">{product.name}</p>
                      <AdminChip>{formatPaiseAsInr(product.price_paise)}</AdminChip>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`season-start-${product.id}`}>Season starts</Label>
                        <Input id={`season-start-${product.id}`} type="datetime-local" value={product.validity_starts_input} onChange={(event) => setProducts((current) => current.map((item) => item.id === product.id ? { ...item, validity_starts_input: event.target.value } : item))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`season-end-${product.id}`}>Season ends</Label>
                        <Input id={`season-end-${product.id}`} type="datetime-local" value={product.validity_ends_input} onChange={(event) => setProducts((current) => current.map((item) => item.id === product.id ? { ...item, validity_ends_input: event.target.value } : item))} />
                      </div>
                    </div>
                    <Button type="button" size="sm" disabled={productSavingId === product.id} onClick={() => void saveSeasonDates(product)}>
                      <Save aria-hidden /> {productSavingId === product.id ? "Saving…" : "Save season dates"}
                    </Button>
                  </div>
                ))}
                {productError ? <p role="alert" className="text-sm text-rose-300">{productError}</p> : null}
                {productNotice ? <p role="status" className="text-sm text-emerald-300">{productNotice}</p> : null}
              </div>
            )}
          </AdminPanel>
        </div>
      ) : null}

      <div className="mt-6">
        <AdminPanel eyebrow="Manual settlement" title="Payment submissions" icon={ShieldCheck} flush>
          <AdminToolbar>
            <label htmlFor="submission-status" className="sr-only">Filter payment submissions</label>
            <select
              id="submission-status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
                setQueueLoading(true);
              }}
              className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="pending_verification">Pending verification</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="duplicate_flagged">Flagged</option>
              <option value="cancelled">Cancelled</option>
              <option value="all">All statuses</option>
            </select>
            <Button type="button" variant="outline" size="sm" onClick={() => {
              setQueueLoading(true);
              void loadQueue();
            }} disabled={queueLoading}>
              <RefreshCw aria-hidden /> Refresh
            </Button>
          </AdminToolbar>

          {queueError ? <p role="alert" className="mx-4 mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{queueError}</p> : null}
          {queueLoading ? <AdminLoading label="Loading payment submissions…" /> : submissions.length === 0 ? (
            <AdminEmpty title="No payment submissions found" hint="New student UPI submissions will appear here for review." />
          ) : (
            <div className="grid gap-3 p-4">
              {submissions.map((submission) => {
                const profile = Array.isArray(submission.profiles) ? submission.profiles[0] : submission.profiles;
                const product = Array.isArray(submission.product_catalog) ? submission.product_catalog[0] : submission.product_catalog;
                const name = submission.product_snapshot?.name || product?.name || "Subscription plan";
                const pending = submission.status === "pending_verification";
                return (
                  <article key={submission.id} className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{name}</p>
                        <p className="mt-1 text-sm text-slate-300">{profile?.full_name || "Student"} · {profile?.email || submission.user_id}</p>
                        <p className="mt-1 text-xs text-slate-400">Submitted {new Date(submission.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>
                      </div>
                      <AdminChip tone={submission.status === "approved" ? "success" : pending ? "warning" : submission.status === "rejected" ? "danger" : "neutral"}>
                        {submission.status.replaceAll("_", " ")}
                      </AdminChip>
                    </div>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div><dt className="text-xs text-slate-400">Expected</dt><dd className="font-semibold text-white">{formatPaiseAsInr(submission.final_amount_minor)}</dd></div>
                      <div><dt className="text-xs text-slate-400">Student claims paid</dt><dd className="font-semibold text-white">{submission.claimed_amount_minor ? formatPaiseAsInr(submission.claimed_amount_minor) : "Not provided"}</dd></div>
                      <div><dt className="text-xs text-slate-400">UPI reference</dt><dd className="break-all font-mono text-white">{submission.reference_code || "Not provided"}</dd></div>
                      <div><dt className="text-xs text-slate-400">Claimed payment time</dt><dd className="text-white">{submission.payment_paid_at ? `${new Date(submission.payment_paid_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST` : "Not provided"}</dd></div>
                    </dl>
                    <div className="flex flex-wrap items-center gap-3">
                      {submission.receipt_url ? (
                        <a href={submission.receipt_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/15 px-3 text-sm font-medium text-cyan-200 hover:bg-white/10">
                          <ExternalLink aria-hidden /> Open private receipt
                        </a>
                      ) : <p className="text-sm text-amber-200">{canReview ? "No receipt file is attached." : "Receipt access is limited to payment reviewers."}</p>}
                      {submission.reason ? <p className="text-sm text-slate-300">Review note: {submission.reason}</p> : null}
                    </div>
                    {pending && canReview ? (
                      <div className="flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-end">
                        <div className="min-w-0 flex-1 space-y-2">
                          <Label htmlFor={`rejection-reason-${submission.id}`}>Rejection reason (required to reject)</Label>
                          <Input
                            id={`rejection-reason-${submission.id}`}
                            value={rejectionReasons[submission.id] ?? ""}
                            onChange={(event) => setRejectionReasons((current) => ({ ...current, [submission.id]: event.target.value }))}
                            maxLength={1000}
                            placeholder="For example, payment reference could not be verified"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" variant="destructive" size="sm" disabled={workingId === submission.id || !(rejectionReasons[submission.id] ?? "").trim()} onClick={() => void reviewSubmission(submission, "rejected")}>
                            <XCircle aria-hidden /> Reject
                          </Button>
                          <Button type="button" variant="success" size="sm" disabled={workingId === submission.id} onClick={() => void reviewSubmission(submission, "approved")}>
                            <CheckCircle2 aria-hidden /> {workingId === submission.id ? "Reviewing…" : "Verify & activate"}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
              <AdminPagination page={page} total={total} limit={PAGE_SIZE} onPage={(nextPage) => {
                setQueueLoading(true);
                setPage(nextPage);
              }} busy={queueLoading} />
            </div>
          )}
        </AdminPanel>
      </div>
    </AdminPage>
  );
}

"use client";

import { useEffect, useState } from "react";
import { CreditCard, Layers3, QrCode, Search, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminChip, AdminEmpty, AdminLoading, AdminPage, AdminPageHeader, AdminPanel, AdminPagination, AdminToolbar, readList } from "@/components/admin/ui";

type Plan = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  duration_days: number;
  duration_value: number;
  duration_unit: "days" | "months" | "years";
  features?: string[] | null;
  applicable_board_codes?: string[] | null;
  applicable_class_numbers?: number[] | null;
  applicable_subject_ids?: string[] | null;
  included_mock_test_ids?: string[] | null;
  test_categories?: string[] | null;
  access_limitations?: Record<string, unknown> | null;
  is_active: boolean;
  sort_order: number;
};

type Subscription = {
  id: string;
  status: string;
  effective_status: string;
  starts_at: string;
  expires_at: string;
  auto_renew: boolean;
  created_at: string;
  subscription_refunds?: SubscriptionRefund[];
  profiles?: { full_name?: string | null; email?: string | null } | null;
  subscription_plans?: { name?: string | null; code?: string | null; price?: number | null; currency?: string | null } | null;
};

type SubscriptionRefund = {
  id: string;
  amount_minor: number;
  status: "pending" | "verified" | "rejected";
  refund_reference: string | null;
  refund_date: string | null;
  reason: string;
  revoke_access: boolean;
  created_at: string;
};

const blankPlan = {
  code: "",
  name: "",
  description: "",
  price: 0,
  duration_value: 1,
  duration_unit: "months" as Plan["duration_unit"],
  applicable_board_codes: "",
  applicable_class_numbers: "",
  applicable_subject_ids: "",
  included_mock_test_ids: "",
  test_categories: "",
  max_attempts_per_test: "",
  sort_order: "",
  features: "",
};
const blankPaymentSettings = { upi_id: "", payee_name: "", instructions: "", is_enabled: false };

type ManualPaymentSettings = typeof blankPaymentSettings;

const SUB_TONES: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  active: "success",
  expired: "neutral",
  cancelled: "warning",
  past_due: "danger",
  trialing: "info",
};

export default function AdminSubscriptionsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planForm, setPlanForm] = useState(blankPlan);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<ManualPaymentSettings>(blankPaymentSettings);
  const [savingPaymentSettings, setSavingPaymentSettings] = useState(false);

  const [subs, setSubs] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const limit = 10;

  useEffect(() => {
    loadPlans();
    loadPaymentSettings();
  }, []);

  useEffect(() => {
    loadSubs(page, query, status);
  }, [page, query, status]);

  async function loadPlans() {
    try {
      const res = await fetch("/api/admin/plans", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load plans");
      const { items } = readList<Plan>(json);
      setPlans(items);
    } catch (error) {
      toast({ title: "Load failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  }

  async function loadPaymentSettings() {
    try {
      const res = await fetch("/api/admin/manual-payment-settings", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load UPI settings");
      const settings = json.data as Partial<ManualPaymentSettings> | null;
      setPaymentSettings({
        upi_id: settings?.upi_id ?? "",
        payee_name: settings?.payee_name ?? "",
        instructions: settings?.instructions ?? "",
        is_enabled: settings?.is_enabled ?? false,
      });
    } catch (error) {
      toast({ title: "UPI settings unavailable", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  }

  async function onSavePaymentSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingPaymentSettings(true);
    try {
      const res = await fetch("/api/admin/manual-payment-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentSettings),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not save UPI settings");
      const settings = json.data as Partial<ManualPaymentSettings>;
      setPaymentSettings({
        upi_id: settings.upi_id ?? "",
        payee_name: settings.payee_name ?? "",
        instructions: settings.instructions ?? "",
        is_enabled: settings.is_enabled ?? false,
      });
      toast({ title: "UPI settings saved", description: "Students will see a QR for each plan's exact amount." });
    } catch (error) {
      toast({ title: "Save failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setSavingPaymentSettings(false);
    }
  }

  async function loadSubs(current: number, q: string, statusFilter: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(current), limit: String(limit) });
      if (q) params.set("q", q);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/subscriptions?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load subscriptions");
      const parsed = readList<Subscription>(json);
      setSubs(parsed.items);
      setTotal(parsed.total);
    } catch (error) {
      toast({ title: "Load failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function changeSubscriptionStatus(subscription: Subscription, nextStatus: "active" | "suspended" | "cancelled") {
    const action = nextStatus === "active" ? "restore" : nextStatus === "suspended" ? "suspend" : "revoke";
    if (!window.confirm(`${action[0].toUpperCase()}${action.slice(1)} access for ${subscription.profiles?.email || "this student"}?`)) return;
    const notes = window.prompt("Add an internal note for the audit history:");
    if (notes === null) return;
    try {
      const response = await fetch(`/api/admin/subscriptions/${subscription.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, notes }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not update subscription access.");
      toast({ title: "Subscription updated", description: `Access is now ${nextStatus}.` });
      await loadSubs(page, query, status);
    } catch (error) {
      toast({ title: "Subscription update failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  }

  async function recordRefund(subscription: Subscription, pendingRefund?: SubscriptionRefund) {
    const amountInput = window.prompt(
      "Enter the actual refund amount in INR:",
      pendingRefund ? (pendingRefund.amount_minor / 100).toFixed(2) : ""
    );
    if (amountInput === null) return;
    const amountParts = amountInput.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
    if (!amountParts) {
      toast({ title: "Invalid refund amount", description: "Enter an INR amount with up to two decimal places.", variant: "destructive" });
      return;
    }
    const amountMinor = Number(amountParts[1]) * 100 + Number((amountParts[2] || "").padEnd(2, "0"));
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      toast({ title: "Invalid refund amount", description: "Enter a positive amount.", variant: "destructive" });
      return;
    }

    const reason = window.prompt("Enter the refund reason:", pendingRefund?.reason || "");
    if (reason === null || !reason.trim()) return;
    const verified = window.confirm(
      pendingRefund
        ? "Confirm only if you verified this outgoing refund in the receiving account."
        : "Has this refund already been sent and verified in the receiving account?"
    );
    const statusValue = verified ? "verified" : "pending";
    let refundReference: string | null = null;
    let refundDate: string | null = null;
    if (verified) {
      refundReference = window.prompt("Enter the actual refund reference:")?.trim() || null;
      if (!refundReference) return;
      const enteredDate = window.prompt("Enter the actual refund date and time (ISO 8601):", new Date().toISOString());
      if (!enteredDate) return;
      const parsedDate = new Date(enteredDate);
      if (!Number.isFinite(parsedDate.getTime())) {
        toast({ title: "Invalid refund date", description: "Enter a valid ISO 8601 date and time.", variant: "destructive" });
        return;
      }
      refundDate = parsedDate.toISOString();
    }
    const revokeAccess = window.confirm("Revoke this subscription's access when the refund is verified?");

    try {
      const response = await fetch(`/api/admin/subscriptions/${subscription.id}/refunds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refund_id: pendingRefund?.id ?? null,
          amount_minor: amountMinor,
          status: statusValue,
          refund_reference: refundReference,
          refund_date: refundDate,
          reason: reason.trim(),
          revoke_access: revokeAccess,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not record refund.");
      toast({
        title: verified ? "Refund verified" : "Refund recorded as pending",
        description: verified
          ? revokeAccess ? "The refund is recorded and subscription access was revoked." : "The refund is recorded; subscription access remains unchanged."
          : "The refund remains pending and is not shown as completed.",
      });
      await loadSubs(page, query, status);
    } catch (error) {
      toast({ title: "Refund update failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  }

  async function onCreatePlan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingPlan(true);
    try {
      const payload = {
        code: planForm.code,
        name: planForm.name,
        description: planForm.description,
        price: Number(planForm.price),
        duration_value: Number(planForm.duration_value),
        duration_unit: planForm.duration_unit,
        features: planForm.features.split(",").map((f) => f.trim()).filter(Boolean),
        applicable_board_codes: planForm.applicable_board_codes.split(",").map((value) => value.trim()).filter(Boolean),
        applicable_class_numbers: planForm.applicable_class_numbers.split(",").map((value) => Number(value.trim())).filter(Number.isInteger),
        applicable_subject_ids: planForm.applicable_subject_ids.split(",").map((value) => value.trim()).filter(Boolean),
        included_mock_test_ids: planForm.included_mock_test_ids.split(",").map((value) => value.trim()).filter(Boolean),
        test_categories: planForm.test_categories.split(",").map((value) => value.trim()).filter(Boolean),
        access_limitations: planForm.max_attempts_per_test
          ? { max_attempts_per_test: Number(planForm.max_attempts_per_test) }
          : {},
        sort_order: planForm.sort_order ? Number(planForm.sort_order) : plans.length,
      };
      const res = await fetch(editingPlanId ? `/api/admin/plans/${editingPlanId}` : "/api/admin/plans", {
        method: editingPlanId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not create plan");
      toast({ title: editingPlanId ? "Plan updated" : "Plan created", description: `${planForm.name} was saved.` });
      setPlanForm(blankPlan);
      setEditingPlanId(null);
      await loadPlans();
    } catch (error) {
      toast({ title: "Creation failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setSavingPlan(false);
    }
  }

  async function togglePlan(plan: Plan) {
    const res = await fetch(`/api/admin/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !plan.is_active }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) return toast({ title: "Update failed", description: json.error || "Could not update plan", variant: "destructive" });
    setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, is_active: !plan.is_active } : p)));
  }

  function editPlan(plan: Plan) {
    setEditingPlanId(plan.id);
    setPlanForm({
      code: plan.code,
      name: plan.name,
      description: plan.description ?? "",
      price: plan.price,
      duration_value: plan.duration_value,
      duration_unit: plan.duration_unit,
      applicable_board_codes: (plan.applicable_board_codes ?? []).join(", "),
      applicable_class_numbers: (plan.applicable_class_numbers ?? []).join(", "),
      applicable_subject_ids: (plan.applicable_subject_ids ?? []).join(", "),
      included_mock_test_ids: (plan.included_mock_test_ids ?? []).join(", "),
      test_categories: (plan.test_categories ?? []).join(", "),
      max_attempts_per_test: String(plan.access_limitations?.max_attempts_per_test ?? ""),
      sort_order: String(plan.sort_order),
      features: (plan.features ?? []).join(", "),
    });
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  const activePlans = plans.filter((p) => p.is_active).length;

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Commerce"
        title="Subscriptions"
        description="Define the plans students can buy and monitor every subscription lifecycle from one screen."
        actions={<AdminChip tone="info">{plans.length} plans · {activePlans} live</AdminChip>}
      />

      <div className="mt-6">
        <AdminPanel eyebrow="Checkout" title="Manual UPI payment" icon={QrCode}>
          <form onSubmit={onSavePaymentSettings} className="space-y-4">
            <p className="text-sm text-slate-400">
              Configure the UPI account students pay to. Their QR code includes the selected plan and exact amount; access stays pending until an admin verifies the transaction reference.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manual-upi-id">UPI ID</Label>
                <Input
                  id="manual-upi-id"
                  value={paymentSettings.upi_id}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, upi_id: e.target.value })}
                  placeholder="merchant@bank"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-upi-payee">Payee name</Label>
                <Input
                  id="manual-upi-payee"
                  value={paymentSettings.payee_name}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, payee_name: e.target.value })}
                  placeholder="Xophal"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-upi-instructions">Student instructions (optional)</Label>
              <textarea
                id="manual-upi-instructions"
                rows={3}
                maxLength={2000}
                value={paymentSettings.instructions}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, instructions: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="After payment, enter the UPI transaction reference to request verification."
              />
            </div>
            <label className="flex items-center gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={paymentSettings.is_enabled}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, is_enabled: e.target.checked })}
                className="h-4 w-4 rounded border-input accent-cyan-500"
              />
              Accept manual UPI payments
            </label>
            <Button type="submit" disabled={savingPaymentSettings}>
              {savingPaymentSettings ? "Saving…" : "Save UPI settings"}
            </Button>
          </form>
        </AdminPanel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <AdminPanel eyebrow="Monetization" title="Plans" icon={CreditCard}>
          <form onSubmit={onCreatePlan} className="mb-5 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="admin-eyebrow">{editingPlanId ? "Edit plan" : "New plan"}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plan-code">Code</Label>
                <Input id="plan-code" value={planForm.code} onChange={(e) => setPlanForm({ ...planForm, code: e.target.value.toUpperCase() })} placeholder="PREMIUM" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-name">Name</Label>
                <Input id="plan-name" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} placeholder="Premium monthly" required />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plan-price">Price (₹)</Label>
                <Input id="plan-price" type="number" min={0.01} max={21474836.47} step="0.01" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: Number(e.target.value) })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-duration-value">Duration</Label>
                <Input
                  id="plan-duration-value"
                  type="number"
                  min={1}
                  value={planForm.duration_value}
                  onChange={(e) => setPlanForm({ ...planForm, duration_value: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-duration-unit">Duration unit</Label>
                <select
                  id="plan-duration-unit"
                  value={planForm.duration_unit}
                  onChange={(e) => setPlanForm({ ...planForm, duration_unit: e.target.value as Plan["duration_unit"] })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="plan-boards">Applicable board codes</Label>
                <Input id="plan-boards" value={planForm.applicable_board_codes} onChange={(e) => setPlanForm({ ...planForm, applicable_board_codes: e.target.value })} placeholder="seba, cbse (blank = all)" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-classes">Applicable class numbers</Label>
                <Input id="plan-classes" value={planForm.applicable_class_numbers} onChange={(e) => setPlanForm({ ...planForm, applicable_class_numbers: e.target.value })} placeholder="9, 10 (blank = all)" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-subjects">Applicable subject IDs</Label>
                <Input id="plan-subjects" value={planForm.applicable_subject_ids} onChange={(e) => setPlanForm({ ...planForm, applicable_subject_ids: e.target.value })} placeholder="Comma-separated UUIDs; blank = all" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-tests">Included test IDs</Label>
                <Input id="plan-tests" value={planForm.included_mock_test_ids} onChange={(e) => setPlanForm({ ...planForm, included_mock_test_ids: e.target.value })} placeholder="Comma-separated UUIDs; blank = all" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-categories">Test categories</Label>
              <Input id="plan-categories" value={planForm.test_categories} onChange={(e) => setPlanForm({ ...planForm, test_categories: e.target.value })} placeholder="premium, subscription_exclusive (blank = all paid categories)" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-features">Features (comma separated)</Label>
              <Input id="plan-features" value={planForm.features} onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })} placeholder="Unlimited tests, Priority support" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-max-attempts">Maximum attempts per test per subscription</Label>
              <Input
                id="plan-max-attempts"
                type="number"
                min={1}
                max={1000000}
                step={1}
                value={planForm.max_attempts_per_test}
                onChange={(e) => setPlanForm({ ...planForm, max_attempts_per_test: e.target.value })}
                placeholder="Blank = unlimited"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-sort-order">Display order</Label>
              <Input
                id="plan-sort-order"
                type="number"
                step={1}
                value={planForm.sort_order}
                onChange={(e) => setPlanForm({ ...planForm, sort_order: e.target.value })}
                placeholder={`Defaults to ${plans.length}`}
              />
            </div>
            <Button type="submit" className="w-full" size="sm" disabled={savingPlan}>
              {savingPlan ? "Saving…" : editingPlanId ? "Save plan" : "Create plan"}
            </Button>
            {editingPlanId ? (
              <Button type="button" className="w-full" size="sm" variant="outline" onClick={() => { setEditingPlanId(null); setPlanForm(blankPlan); }}>
                Cancel editing
              </Button>
            ) : null}
          </form>

          {plans.length === 0 ? (
            <AdminEmpty icon={Layers3} title="No plans yet" hint="Create your first subscription plan above." />
          ) : (
            <div className="space-y-3">
              {plans.map((plan) => (
                <div key={plan.id} className="admin-row">
                  <div className="min-w-0">
                    <p className="admin-row-title">{plan.name}</p>
                    <p className="admin-row-meta">
                      ₹{Number(plan.price)} · {plan.duration_value} {plan.duration_unit} · <span className="font-mono">{plan.code}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <AdminChip tone={plan.is_active ? "success" : "neutral"}>{plan.is_active ? "Live" : "Hidden"}</AdminChip>
                    <Button type="button" size="sm" variant="outline" onClick={() => editPlan(plan)}>
                      Edit
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void togglePlan(plan)}>
                      {plan.is_active ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminPanel>

        <AdminPanel eyebrow="Members" title="Subscriptions" icon={Users} flush>
          <div className="px-5 pt-5">
            <AdminToolbar>
              <form onSubmit={onSearch} className="admin-toolbar-grow flex gap-2">
                <Input placeholder="Search member name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
                <Button type="submit" variant="outline" size="sm">
                  <Search className="h-4 w-4" /> Search
                </Button>
              </form>
              <select
                className="h-10 rounded-md px-3 text-sm"
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value);
                }}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="verification_pending">Verification pending</option>
                <option value="under_review">Under review</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
                <option value="suspended">Suspended</option>
                <option value="refunded">Refunded</option>
                <option value="past_due">Past due</option>
              </select>
            </AdminToolbar>
          </div>

          <div className="admin-panel-body mt-4">
            {loading ? (
              <AdminLoading label="Loading subscriptions…" />
            ) : subs.length === 0 ? (
              <AdminEmpty icon={Users} title="No subscriptions found" hint={query || status ? "Try a different filter." : "Student subscriptions will appear here after checkout."} />
            ) : (
              <>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Plan</th>
                        <th>Status</th>
                        <th>Period</th>
                        <th>Renewal</th>
                        <th>Admin actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subs.map((sub) => (
                        <tr key={sub.id}>
                          <td>
                            <p className="font-semibold text-white">{sub.profiles?.full_name || "—"}</p>
                            <p className="text-xs text-slate-500">{sub.profiles?.email || "No email"}</p>
                          </td>
                          <td className="text-slate-300">
                            {sub.subscription_plans?.name || "—"}
                            {typeof sub.subscription_plans?.price === "number" ? (
                              <span className="ml-2 text-xs text-slate-500">₹{sub.subscription_plans.price}</span>
                            ) : null}
                          </td>
                          <td>
                            <AdminChip tone={SUB_TONES[sub.effective_status] || "neutral"}>{sub.effective_status}</AdminChip>
                          </td>
                          <td className="text-slate-400">
                            {new Date(sub.starts_at).toLocaleDateString()} → {new Date(sub.expires_at).toLocaleDateString()}
                          </td>
                          <td>
                            <AdminChip tone={sub.auto_renew ? "info" : "neutral"}>{sub.auto_renew ? "Auto" : "Manual"}</AdminChip>
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-2">
                              {sub.status === "active" ? (
                                <>
                                  <Button type="button" size="sm" variant="outline" onClick={() => void changeSubscriptionStatus(sub, "suspended")}>Suspend</Button>
                                  <Button type="button" size="sm" variant="outline" onClick={() => void changeSubscriptionStatus(sub, "cancelled")}>Revoke</Button>
                                </>
                              ) : null}
                              {sub.status === "suspended" ? (
                                <>
                                  <Button type="button" size="sm" variant="outline" onClick={() => void changeSubscriptionStatus(sub, "active")}>Restore</Button>
                                  <Button type="button" size="sm" variant="outline" onClick={() => void changeSubscriptionStatus(sub, "cancelled")}>Revoke</Button>
                                </>
                              ) : null}
                              {sub.status !== "refunded" && sub.status !== "rejected" ? (
                                <Button type="button" size="sm" variant="outline" onClick={() => void recordRefund(sub)}>Record refund</Button>
                              ) : null}
                            </div>
                            {sub.subscription_refunds?.length ? (
                              <div className="mt-2 space-y-2">
                                {sub.subscription_refunds.map((refund) => (
                                  <div key={refund.id} className="rounded border border-white/10 p-2 text-xs">
                                    <p>
                                      ₹{(refund.amount_minor / 100).toFixed(2)} · {refund.status}
                                      {refund.refund_reference ? ` · ${refund.refund_reference}` : ""}
                                    </p>
                                    <p className="text-slate-400">{refund.reason}</p>
                                    {refund.status === "pending" ? (
                                      <Button type="button" size="sm" variant="outline" className="mt-1" onClick={() => void recordRefund(sub, refund)}>
                                        Verify actual refund
                                      </Button>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <AdminPagination page={page} total={total} limit={limit} onPage={setPage} busy={loading} />
              </>
            )}
          </div>
        </AdminPanel>
      </div>
    </AdminPage>
  );
}

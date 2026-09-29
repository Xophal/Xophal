"use client";

import { useEffect, useState } from "react";
import { CreditCard, Layers3, Plus, Search, Users } from "lucide-react";
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
  features?: string[] | null;
  is_active: boolean;
  sort_order: number;
};

type Subscription = {
  id: string;
  status: string;
  starts_at: string;
  expires_at: string;
  auto_renew: boolean;
  created_at: string;
  profiles?: { full_name?: string | null; email?: string | null } | null;
  subscription_plans?: { name?: string | null; code?: string | null; price?: number | null; currency?: string | null } | null;
};

const blankPlan = { code: "", name: "", description: "", price: 0, duration_days: 30, features: "" };

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
  const [savingPlan, setSavingPlan] = useState(false);

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
  }, []);

  useEffect(() => {
    loadSubs(page, query, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function onCreatePlan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingPlan(true);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: planForm.code,
          name: planForm.name,
          description: planForm.description,
          price: Number(planForm.price),
          duration_days: Number(planForm.duration_days),
          features: planForm.features.split(",").map((f) => f.trim()).filter(Boolean),
          sort_order: plans.length,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not create plan");
      toast({ title: "Plan created", description: `${planForm.name} is live.` });
      setPlanForm(blankPlan);
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

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <AdminPanel eyebrow="Monetization" title="Plans" icon={CreditCard}>
          <form onSubmit={onCreatePlan} className="mb-5 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="admin-eyebrow">New plan</p>
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
                <Input id="plan-price" type="number" min={0} step="0.01" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: Number(e.target.value) })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-days">Duration (days)</Label>
                <Input
                  id="plan-days"
                  type="number"
                  min={1}
                  value={planForm.duration_days}
                  onChange={(e) => setPlanForm({ ...planForm, duration_days: Number(e.target.value) })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-features">Features (comma separated)</Label>
              <Input id="plan-features" value={planForm.features} onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })} placeholder="Unlimited tests, Priority support" />
            </div>
            <Button type="submit" className="w-full" size="sm" disabled={savingPlan}>
              {savingPlan ? "Creating…" : "Create plan"}
            </Button>
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
                      ₹{Number(plan.price)} · {plan.duration_days} days · <span className="font-mono">{plan.code}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <AdminChip tone={plan.is_active ? "success" : "neutral"}>{plan.is_active ? "Live" : "Hidden"}</AdminChip>
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
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
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
                            <AdminChip tone={SUB_TONES[sub.status] || "neutral"}>{sub.status}</AdminChip>
                          </td>
                          <td className="text-slate-400">
                            {new Date(sub.starts_at).toLocaleDateString()} → {new Date(sub.expires_at).toLocaleDateString()}
                          </td>
                          <td>
                            <AdminChip tone={sub.auto_renew ? "info" : "neutral"}>{sub.auto_renew ? "Auto" : "Manual"}</AdminChip>
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

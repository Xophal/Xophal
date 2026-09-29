"use client";

import { useEffect, useState } from "react";
import { Percent, Plus, Search, Ticket } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminChip, AdminEmpty, AdminLoading, AdminPage, AdminPageHeader, AdminPanel, AdminPagination, AdminToolbar, readList } from "@/components/admin/ui";

type Coupon = {
  id: string;
  code: string;
  description?: string | null;
  discount_type: "percentage" | "flat";
  discount_value: number;
  max_uses: number;
  used_count: number;
  min_order_amount: number;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active: boolean;
  created_at: string;
};

const blank = {
  code: "",
  description: "",
  discount_type: "percentage" as "percentage" | "flat",
  discount_value: 10,
  max_uses: 0,
  min_order_amount: 0,
  valid_until: "",
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const limit = 10;

  useEffect(() => {
    load(page, query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query]);

  async function load(current: number, q: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(current), limit: String(limit) });
      if (q) params.set("q", q);
      const res = await fetch(`/api/admin/coupons?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load coupons");
      const parsed = readList<Coupon>(json);
      setCoupons(parsed.items);
      setTotal(parsed.total);
    } catch (error) {
      toast({ title: "Load failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          description: form.description,
          discount_type: form.discount_type,
          discount_value: Number(form.discount_value),
          max_uses: Number(form.max_uses),
          min_order_amount: Number(form.min_order_amount),
          valid_until: form.valid_until || "",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not create coupon");
      toast({ title: "Coupon created", description: `${form.code.toUpperCase()} is ready to redeem.` });
      setForm(blank);
      await load(page, query);
    } catch (error) {
      toast({ title: "Creation failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleCoupon(coupon: Coupon) {
    const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !coupon.is_active }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) return toast({ title: "Update failed", description: json.error || "Could not update coupon", variant: "destructive" });
    setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? { ...c, is_active: !coupon.is_active } : c)));
  }

  function usagePct(coupon: Coupon) {
    if (!coupon.max_uses) return 0;
    return Math.min(100, Math.round((coupon.used_count / coupon.max_uses) * 100));
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Commerce"
        title="Coupons"
        description="Create discount codes for campaigns and keep an eye on redemption limits in real time."
        actions={<AdminChip tone="info">{total} coupons</AdminChip>}
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <AdminPanel eyebrow="Create" title="New coupon" icon={Plus}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="coupon-code">Code</Label>
              <Input id="coupon-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="DIWALI25" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-desc">Description</Label>
              <Input id="coupon-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Festival offer for premium plans" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="coupon-type">Discount type</Label>
                <select
                  id="coupon-type"
                  className="flex h-10 w-full rounded-md px-3 py-2 text-sm"
                  value={form.discount_type}
                  onChange={(e) => setForm({ ...form, discount_type: e.target.value as "percentage" | "flat" })}
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="flat">Flat (₹)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="coupon-value">Value</Label>
                <Input
                  id="coupon-value"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })}
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="coupon-max">Max uses (0 = unlimited)</Label>
                <Input id="coupon-max" type="number" min={0} value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coupon-min">Min order (₹)</Label>
                <Input
                  id="coupon-min"
                  type="number"
                  min={0}
                  value={form.min_order_amount}
                  onChange={(e) => setForm({ ...form, min_order_amount: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-until">Valid until</Label>
              <Input id="coupon-until" type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Creating…" : "Create coupon"}
            </Button>
          </form>
        </AdminPanel>

        <AdminPanel eyebrow="Redemptions" title="All coupons" icon={Ticket} flush>
          <div className="px-5 pt-5">
            <AdminToolbar>
              <form onSubmit={onSearch} className="admin-toolbar-grow flex gap-2">
                <Input placeholder="Search code or description" value={search} onChange={(e) => setSearch(e.target.value)} />
                <Button type="submit" variant="outline" size="sm">
                  <Search className="h-4 w-4" /> Search
                </Button>
              </form>
            </AdminToolbar>
          </div>

          <div className="admin-panel-body mt-4">
            {loading ? (
              <AdminLoading label="Loading coupons…" />
            ) : coupons.length === 0 ? (
              <AdminEmpty icon={Ticket} title="No coupons yet" hint={query ? "No coupons match your search." : "Create your first discount code with the form."} />
            ) : (
              <>
                <div className="space-y-3">
                  {coupons.map((coupon) => (
                    <div key={coupon.id} className="admin-row flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="admin-stat-icon admin-stat-icon--amber">
                          <Percent className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="admin-row-title font-mono tracking-wider">{coupon.code}</p>
                          <p className="admin-row-meta">{coupon.description || "No description"}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                            <AdminChip tone={coupon.discount_type === "percentage" ? "info" : "violet"}>
                              {coupon.discount_type === "percentage" ? `${coupon.discount_value}% off` : `₹${coupon.discount_value} off`}
                            </AdminChip>
                            <span>Min ₹{Number(coupon.min_order_amount || 0)}</span>
                            {coupon.valid_until ? <span>Until {new Date(coupon.valid_until).toLocaleDateString()}</span> : <span>No expiry</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col gap-2 sm:w-52">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>
                            {coupon.used_count} / {coupon.max_uses || "∞"} uses
                          </span>
                          <AdminChip tone={coupon.is_active ? "success" : "neutral"}>{coupon.is_active ? "Active" : "Paused"}</AdminChip>
                        </div>
                        <div className="admin-progress">
                          <span style={{ width: `${coupon.max_uses ? usagePct(coupon) : 100}%` }} />
                        </div>
                        <Button type="button" size="sm" variant="outline" onClick={() => void toggleCoupon(coupon)}>
                          {coupon.is_active ? "Pause" : "Activate"}
                        </Button>
                      </div>
                    </div>
                  ))}
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

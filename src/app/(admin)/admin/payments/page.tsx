"use client";

import { useEffect, useState } from "react";
import { Banknote, CheckCircle2, Clock, Search, Wallet, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminChip, AdminEmpty, AdminLoading, AdminPage, AdminPageHeader, AdminPanel, AdminPagination, AdminStat, AdminToolbar, readList } from "@/components/admin/ui";

type Payment = {
  id: string;
  amount: number;
  discount_amount: number;
  final_amount: number;
  currency: string;
  status: string;
  invoice_number?: string | null;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  created_at: string;
  profiles?: { full_name?: string | null; email?: string | null } | null;
  subscription_plans?: { name?: string | null; code?: string | null } | null;
  coupons?: { code?: string | null } | null;
};

type Summary = { revenue: number; paid: number; pending: number; failed: number; refunded: number };

const STATUSES = ["", "paid", "pending", "failed", "refunded"] as const;

const STATUS_TONES: Record<string, "success" | "warning" | "danger" | "violet" | "neutral"> = {
  paid: "success",
  pending: "warning",
  failed: "danger",
  refunded: "violet",
  cancelled: "neutral",
};

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const limit = 12;

  useEffect(() => {
    load(page, query, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query, status]);

  async function load(current: number, q: string, statusFilter: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(current), limit: String(limit) });
      if (q) params.set("q", q);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/payments?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load payments");
      const parsed = readList<Payment>(json);
      setPayments(parsed.items);
      setTotal(parsed.total);
      setSummary(json.data?.summary ?? null);
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

  async function markStatus(payment: Payment, next: string) {
    setWorkingId(payment.id);
    try {
      const res = await fetch(`/api/admin/payments/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not update payment");
      toast({ title: "Payment updated", description: `Marked as ${next}.` });
      await load(page, query, status);
    } catch (error) {
      toast({ title: "Update failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setWorkingId(null);
    }
  }

  function formatMoney(value: number, currency = "INR") {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value) || 0);
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Commerce"
        title="Payments"
        description="Track every Razorpay order from creation to settlement and correct statuses when needed."
        actions={
          <AdminToolbar>
            {STATUSES.map((it) => (
              <button
                key={it || "all"}
                type="button"
                onClick={() => {
                  setPage(1);
                  setStatus(it);
                }}
                className={
                  status === it
                    ? "rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs font-semibold capitalize text-cyan-200"
                    : "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold capitalize text-slate-300 transition hover:border-cyan-400/30 hover:text-white"
                }
              >
                {it || "all"}
              </button>
            ))}
          </AdminToolbar>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <AdminStat label="Collected revenue" value={summary ? formatMoney(summary.revenue) : "…"} hint="Paid payments" icon={Banknote} tone="emerald" />
        <AdminStat label="Paid" value={summary ? summary.paid : "…"} hint="Successful payments" icon={CheckCircle2} tone="cyan" />
        <AdminStat label="Pending" value={summary ? summary.pending : "…"} hint="Awaiting confirmation" icon={Clock} tone="amber" />
        <AdminStat
          label="Failed / refunded"
          value={summary ? `${summary.failed} / ${summary.refunded}` : "…"}
          hint="Needs attention"
          icon={XCircle}
          tone="rose"
        />
      </div>

      <div className="mt-6">
        <AdminPanel eyebrow="Ledger" title="All payments" icon={Wallet} flush>
          <div className="px-5 pt-5">
            <AdminToolbar>
              <form onSubmit={onSearch} className="admin-toolbar-grow flex gap-2">
                <Input placeholder="Search customer, order ID or invoice" value={search} onChange={(e) => setSearch(e.target.value)} />
                <Button type="submit" variant="outline" size="sm">
                  <Search className="h-4 w-4" /> Search
                </Button>
              </form>
            </AdminToolbar>
          </div>

          <div className="admin-panel-body mt-4">
            {loading ? (
              <AdminLoading label="Loading payments…" />
            ) : payments.length === 0 ? (
              <AdminEmpty icon={Wallet} title="No payments found" hint={query || status ? "Try a different filter." : "Payments will appear here once students start subscribing."} />
            ) : (
              <>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Plan</th>
                        <th className="text-right">Amount</th>
                        <th>Status</th>
                        <th>Order</th>
                        <th>Date</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id}>
                          <td>
                            <p className="font-semibold text-white">{payment.profiles?.full_name || "—"}</p>
                            <p className="text-xs text-slate-500">{payment.profiles?.email || "No email"}</p>
                          </td>
                          <td className="text-slate-300">
                            {payment.subscription_plans?.name || "—"}
                            {payment.coupons?.code ? <span className="ml-2 text-xs text-cyan-300">({payment.coupons.code})</span> : null}
                          </td>
                          <td className="is-num font-semibold text-white">{formatMoney(payment.final_amount, payment.currency || "INR")}</td>
                          <td>
                            <AdminChip tone={STATUS_TONES[payment.status] || "neutral"}>{payment.status}</AdminChip>
                          </td>
                          <td className="max-w-[10rem] truncate font-mono text-xs text-slate-400">{payment.razorpay_order_id || payment.invoice_number || "—"}</td>
                          <td className="text-slate-400">{new Date(payment.created_at).toLocaleDateString()}</td>
                          <td>
                            <div className="flex justify-end gap-2">
                              {payment.status !== "paid" && (
                                <Button type="button" size="sm" variant="outline" disabled={workingId === payment.id} onClick={() => void markStatus(payment, "paid")}>
                                  Mark paid
                                </Button>
                              )}
                              {payment.status !== "refunded" && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={workingId === payment.id}
                                  onClick={() => void markStatus(payment, "refunded")}
                                >
                                  Refund
                                </Button>
                              )}
                            </div>
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

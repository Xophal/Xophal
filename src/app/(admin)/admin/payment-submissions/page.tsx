"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, ExternalLink, QrCode, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { AdminChip, AdminEmpty, AdminLoading, AdminPage, AdminPageHeader, AdminPanel, AdminPagination, AdminToolbar, readList } from "@/components/admin/ui";

type PaymentSubmission = {
  id: string;
  amount_minor: number;
  currency: string;
  status: string;
  submissionType: "subscription" | "one_time";
  title_snapshot?: string;
  reference_code: string;
  evidence_url?: string | null;
  created_at: string;
  reason?: string | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
  product_catalog?: { name?: string | null; code?: string | null } | null;
};

const STATUSES = ["", "pending_verification", "approved", "rejected", "duplicate_flagged"] as const;
const ONE_TIME_STATUSES = ["", "pending_payment", "pending_verification", "approved", "rejected"] as const;
const STATUS_TONES: Record<string, "success" | "warning" | "danger" | "violet" | "neutral"> = {
  pending_verification: "warning",
  approved: "success",
  rejected: "danger",
  duplicate_flagged: "violet",
};

export default function AdminPaymentSubmissionsPage() {
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("pending_verification");
  const [submissionType, setSubmissionType] = useState<"subscription" | "one_time">("subscription");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const limit = 12;
  const statuses = submissionType === "subscription" ? STATUSES : ONE_TIME_STATUSES;

  useEffect(() => {
    void load(page, status, submissionType);
  }, [page, status, submissionType]);

  async function load(currentPage: number, statusFilter: string, type: "subscription" | "one_time") {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: String(limit) });
      if (statusFilter) params.set("status", statusFilter);
      const endpoint = type === "subscription" ? "/api/admin/payment-submissions" : "/api/admin/manual-payment-requests";
      const response = await fetch(`${endpoint}?${params.toString()}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Failed to load UPI payment submissions");
      const result = readList<PaymentSubmission>(json);
      setSubmissions(result.items.map((item) => ({ ...item, submissionType: type })));
      setTotal(result.total);
    } catch (error) {
      toast({ title: "Load failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function resolveSubmission(submission: PaymentSubmission, nextStatus: "approved" | "rejected") {
    if (nextStatus === "approved" && !window.confirm("Approve this payment and activate the student's access?")) return;

    let reason: string | null = null;
    if (nextStatus === "rejected") {
      const enteredReason = window.prompt("Enter a reason for rejecting this payment:");
      if (enteredReason === null) return;
      reason = enteredReason.trim();
      if (!reason) {
        toast({ title: "Reason required", description: "Provide a reason so the student knows what to correct.", variant: "destructive" });
        return;
      }
    }

    setWorkingId(submission.id);
    try {
      const endpoint = submission.submissionType === "subscription"
        ? `/api/admin/payment-submissions/${submission.id}`
        : `/api/admin/manual-payment-requests/${submission.id}`;
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, reason }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not update this payment submission");
      toast({
        title: nextStatus === "approved" ? "Payment approved" : "Payment rejected",
        description: nextStatus === "approved" ? "The purchased access has been enabled." : "The student can now review the rejection reason.",
      });
      await load(page, status, submissionType);
    } catch (error) {
      toast({ title: "Update failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setWorkingId(null);
    }
  }

  function formatAmount(amountMinor: number, currency = "INR") {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2 }).format(amountMinor / 100);
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Commerce"
        title="UPI payment verification"
        description="Verify each student's UPI transaction reference before granting the purchased access."
        actions={<AdminChip tone="info">{total} submissions</AdminChip>}
      />

      <div className="mt-6">
        <AdminPanel eyebrow="Manual checkout" title="Payment submissions" icon={QrCode} flush>
          <div className="px-5 pt-5">
            <AdminToolbar>
              <div className="flex flex-wrap gap-2">
                {([
                  ["subscription", "Subscriptions"],
                  ["one_time", "eBooks & mock tests"],
                ] as const).map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setPage(1);
                      setSubmissionType(type);
                    }}
                    className={submissionType === type
                      ? "rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200"
                      : "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/30 hover:text-white"}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="text-sm text-slate-300">
                Status
                <select
                  className="ml-3 h-10 rounded-md px-3 text-sm text-slate-950"
                  value={status}
                  onChange={(event) => {
                    setPage(1);
                    setStatus(event.target.value);
                  }}
                >
                  {statuses.map((value) => (
                    <option key={value || "all"} value={value}>{value ? value.replaceAll("_", " ") : "All statuses"}</option>
                  ))}
                </select>
              </label>
            </AdminToolbar>
          </div>

          <div className="admin-panel-body mt-4">
            {loading ? (
              <AdminLoading label="Loading UPI submissions…" />
            ) : submissions.length === 0 ? (
              <AdminEmpty icon={Clock3} title="No payment submissions found" hint={status ? "There are no submissions with this status." : "Student UPI payments will appear here after submission."} />
            ) : (
              <>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Product</th>
                        <th>Amount</th>
                        <th>UPI reference</th>
                        <th>Status</th>
                        <th>Submitted</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((submission) => (
                        <tr key={submission.id}>
                          <td>
                            <p className="font-semibold text-white">{submission.profiles?.full_name || "—"}</p>
                            <p className="text-xs text-slate-500">{submission.profiles?.email || "No email"}</p>
                          </td>
                          <td className="text-slate-300">{submission.product_catalog?.name || submission.title_snapshot || "—"}</td>
                          <td className="is-num font-semibold text-white">{formatAmount(submission.amount_minor, submission.currency)}</td>
                          <td>
                            <code className="text-xs text-cyan-200">{submission.reference_code}</code>
                            {submission.evidence_url ? (
                              <a href={submission.evidence_url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200">
                                Evidence <ExternalLink className="h-3 w-3" aria-hidden="true" />
                              </a>
                            ) : null}
                            {submission.reason ? <p className="mt-1 text-xs text-rose-300">{submission.reason}</p> : null}
                          </td>
                          <td>
                            <AdminChip tone={STATUS_TONES[submission.status] || "neutral"}>{submission.status.replaceAll("_", " ")}</AdminChip>
                          </td>
                          <td className="text-slate-400">{new Date(submission.created_at).toLocaleString()}</td>
                          <td className="text-right">
                            {submission.status === "pending_verification" ? (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" onClick={() => void resolveSubmission(submission, "approved")} disabled={workingId === submission.id}>
                                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                  {workingId === submission.id ? "Saving…" : "Approve"}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => void resolveSubmission(submission, "rejected")} disabled={workingId === submission.id}>
                                  <XCircle className="h-4 w-4" aria-hidden="true" /> Reject
                                </Button>
                              </div>
                            ) : <span className="text-xs text-slate-500">Reviewed</span>}
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

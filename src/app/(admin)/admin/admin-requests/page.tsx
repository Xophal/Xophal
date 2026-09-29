"use client";

import { useEffect, useState } from "react";
import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { AdminChip, AdminEmpty, AdminLoading, AdminPage, AdminPageHeader, AdminPanel } from "@/components/admin/ui";

type AdminRequest = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  requested_role: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  async function loadRequests() {
    try {
      const response = await fetch("/api/admin/admin-requests", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not load admin requests.");
      setRequests(result.data || []);
    } catch (error) {
      toast({ title: "Could not load requests", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRequests(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function decide(id: string, action: "approve" | "reject") {
    setWorkingId(id);
    try {
      const response = await fetch("/api/admin/admin-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not update request.");
      toast({ title: action === "approve" ? "Admin approved" : "Request rejected" });
      await loadRequests();
    } catch (error) {
      toast({ title: "Action failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setWorkingId(null);
    }
  }

  async function resendNotification(id: string) {
    setWorkingId(id);
    try {
      const response = await fetch("/api/admin/admin-requests/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not send notification.");
      toast({ title: "Notification sent", description: "The main administrators were notified." });
    } catch (error) {
      toast({ title: "Notification failed", description: error instanceof Error ? error.message : "Please verify Resend configuration.", variant: "destructive" });
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="People"
        title="Admin requests"
        description="Only the two configured main administrators can approve privileged accounts."
        actions={<AdminChip tone={requests.some((r) => r.status === "pending") ? "warning" : "info"}>{requests.filter((r) => r.status === "pending").length} pending</AdminChip>}
      />
      <div className="mt-6 mx-auto max-w-5xl">
        <AdminPanel eyebrow="Approvals" title="Signup approvals" icon={UserCheck} flush>
          <div className="admin-panel-body">
            {loading ? (
              <AdminLoading label="Loading requests…" />
            ) : requests.length === 0 ? (
              <AdminEmpty icon={UserCheck} title="No admin signup requests" hint="New privileged signups will appear here for review." />
            ) : (
              <div className="space-y-3">
                {requests.map((request) => (
                  <div key={request.id} className="admin-row flex-col items-stretch gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="admin-row-title">{request.full_name}</p>
                      <p className="admin-row-meta">
                        {request.email} · {request.requested_role.replaceAll("_", " ")}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">Submitted {new Date(request.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <AdminChip tone={request.status === "approved" ? "success" : request.status === "rejected" ? "danger" : "warning"}>{request.status}</AdminChip>
                      {request.status === "pending" && (
                        <>
                          <Button size="sm" disabled={workingId === request.id} onClick={() => void decide(request.id, "approve")}>Approve</Button>
                          <Button size="sm" variant="destructive" disabled={workingId === request.id} onClick={() => void decide(request.id, "reject")}>Reject</Button>
                          <Button size="sm" variant="outline" disabled={workingId === request.id} onClick={() => void resendNotification(request.id)}>Resend email</Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </AdminPanel>
      </div>
    </AdminPage>
  );
}
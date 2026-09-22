"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

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
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Admin requests</h1>
        <p className="mt-2 text-sm text-muted-foreground">Only the two configured main administrators can approve privileged accounts.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Signup approvals</CardTitle>
          <CardDescription>Approved applicants receive their requested admin role. Rejected applicants remain regular users.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Loading requests...</p>}
          {!loading && requests.length === 0 && <p className="text-sm text-muted-foreground">No admin signup requests.</p>}
          {requests.map((request) => (
            <div key={request.id} className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">{request.full_name}</p>
                <p className="text-sm text-muted-foreground">{request.email} · {request.requested_role.replaceAll("_", " ")}</p>
                <p className="text-xs text-muted-foreground">Submitted {new Date(request.created_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border px-2 py-1 text-xs capitalize">{request.status}</span>
                {request.status === "pending" && (
                  <>
                    <Button disabled={workingId === request.id} onClick={() => void decide(request.id, "approve")}>Approve</Button>
                    <Button variant="destructive" disabled={workingId === request.id} onClick={() => void decide(request.id, "reject")}>Reject</Button>
                    <Button variant="outline" disabled={workingId === request.id} onClick={() => void resendNotification(request.id)}>Resend email</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
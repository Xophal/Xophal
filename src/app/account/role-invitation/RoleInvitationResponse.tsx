"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type InvitationView = {
  status: string;
  roleName: string | null;
  expiresAt: string;
};

export default function RoleInvitationResponse({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<InvitationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/account/role-invitation?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || "This invitation link is unavailable.");
        if (!cancelled) setInvitation(json.data as InvitationView);
      })
      .catch((error: unknown) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "This invitation link is unavailable.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function respond(decision: "accept" | "reject") {
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/role-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, decision }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not submit your response.");
      setInvitation((current) => current ? { ...current, status: json.data.status } : current);
      setMessage(decision === "accept"
        ? "You accepted the role invitation. Your account role has been updated."
        : "You rejected the role invitation. Your current role has not changed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not submit your response.");
    } finally {
      setSubmitting(false);
    }
  }

  const pending = invitation?.status === "PENDING";
  const resolvedMessage = invitation?.status === "ACCEPTED"
    ? "This role invitation has already been accepted."
    : invitation?.status === "REJECTED"
      ? "This role invitation has already been rejected."
      : invitation?.status === "EXPIRED"
        ? "This role invitation has expired. Ask a super administrator to send a new one."
        : invitation?.status === "CANCELLED"
          ? "This role invitation was cancelled. Ask a super administrator to send a new one."
          : invitation?.status === "EMAIL_FAILED"
            ? "This role invitation could not be delivered. Ask a super administrator to send a new one."
            : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-12">
      <section className="w-full rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">Xophol account</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Role invitation</h1>
        {loading ? <p className="mt-4 text-sm text-muted-foreground" role="status">Checking this invitation…</p> : null}
        {!loading && invitation ? (
          <>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              A super administrator invited you to use the <strong className="text-foreground">{invitation.roleName ?? "requested"}</strong> role.
              Your current role will remain unchanged unless you accept.
            </p>
            {pending ? (
              <>
                <p className="mt-3 text-xs text-muted-foreground">
                  This invitation expires {new Date(invitation.expiresAt).toLocaleString()}.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Button type="button" disabled={submitting} onClick={() => void respond("accept")}>
                    {submitting ? "Submitting…" : "Accept invitation"}
                  </Button>
                  <Button type="button" variant="outline" disabled={submitting} onClick={() => void respond("reject")}>
                    Reject invitation
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground" role="status">{resolvedMessage}</p>
            )}
          </>
        ) : null}
        {!loading && message ? <p className="mt-4 text-sm text-destructive" role="alert">{message}</p> : null}
        {invitation?.status === "ACCEPTED" ? (
          <Link href="/login" className="mt-5 inline-flex min-h-10 items-center font-semibold text-primary hover:underline">
            Sign in to Xophol
          </Link>
        ) : null}
      </section>
    </main>
  );
}

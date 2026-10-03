"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Mail, ShieldCheck, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { normalizeRoleCode } from "@/lib/roles";
import {
  AdminChip,
  AdminEmpty,
  AdminLoading,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  AdminStat,
} from "@/components/admin/ui";

type Role = { id: string; code: string; name: string };

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  is_active: boolean | null;
  email_verified: boolean | null;
  created_at: string | null;
  roles: { code: string; name: string } | null;
};

type PendingRoleInvitation = {
  id: string;
  role: Pick<Role, "code" | "name">;
  created_at: string;
  expires_at: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="admin-stat-label">{label}</p>
      <div className="mt-1 text-sm text-slate-200">{children}</div>
    </div>
  );
}

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [attemptsCount, setAttemptsCount] = useState(0);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState(false);
  const [savingActive, setSavingActive] = useState(false);
  const [cancellingInvitation, setCancellingInvitation] = useState(false);
  const [canManageAccounts, setCanManageAccounts] = useState(false);
  const [pendingRoleInvitation, setPendingRoleInvitation] = useState<PendingRoleInvitation | null>(null);

  const applyPayload = useCallback((json: { data?: {
    profile?: Profile | null;
    attemptsCount?: number;
    canManageAccounts?: boolean;
    pendingRoleInvitation?: PendingRoleInvitation | null;
  } | null }) => {
    const next: Profile | null = json?.data?.profile ?? null;
    setProfile(next);
    setAttemptsCount(Number(json?.data?.attemptsCount ?? 0) || 0);
    setSelectedRole(normalizeRoleCode(next?.roles) ?? "");
    setCanManageAccounts(json.data?.canManageAccounts === true);
    setPendingRoleInvitation(json.data?.pendingRoleInvitation ?? null);
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load user");
      applyPayload(json);
    } catch (err) {
      toast({ title: "Load failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [id, applyPayload]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/users/${id}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Failed to load user");
        if (!cancelled) applyPayload(json);
      } catch (err) {
        if (!cancelled) {
          toast({ title: "Load failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, applyPayload]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/roles", { cache: "no-store" });
        const json = await res.json();
        if (res.ok && json.success && Array.isArray(json.data)) setRoles(json.data as Role[]);
      } catch {
        // The role picker degrades to a plain select if this fails.
      }
    })();
  }, []);

  async function patch(body: { isActive: boolean }) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || "Update failed");
    return json;
  }

  async function toggleActive() {
    if (!profile) return;
    const next = !profile.is_active;
    if (!confirm(next ? `Reactivate ${profile.email || "this account"}?` : `Deactivate ${profile.email || "this account"}?`)) return;
    setSavingActive(true);
    try {
      await patch({ isActive: next });
      toast({
        title: next ? "Account reactivated" : "Account deactivated",
        description: "The user has been emailed about the account status change.",
      });
      await load();
      router.refresh();
    } catch (err) {
      toast({ title: "Action failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      await load();
    } finally {
      setSavingActive(false);
    }
  }

  async function saveRole() {
    if (!profile || !selectedRole) return;
    if (!confirm(`Email a role invitation to ${profile.email || "this user"}? Their role changes only if they accept.`)) return;
    setSavingRole(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/role-invitation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not send role invitation");
      toast({ title: "Role invitation sent", description: "The user's current role stays unchanged until they accept." });
      await load();
    } catch (err) {
      toast({ title: "Invitation failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSavingRole(false);
    }
  }

  async function cancelRoleInvitation() {
    if (!profile || !pendingRoleInvitation) return;
    if (!confirm(`Cancel the pending ${pendingRoleInvitation.role.name} invitation for ${profile.email || "this user"}?`)) return;
    setCancellingInvitation(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/role-invitation`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not cancel role invitation");
      toast({ title: "Invitation cancelled" });
      await load();
    } catch (err) {
      toast({ title: "Cancellation failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setCancellingInvitation(false);
    }
  }

  const roleCode = normalizeRoleCode(profile?.roles) ?? "student";
  const isActive = profile?.is_active !== false;
  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="People"
        title={profile?.full_name || profile?.email || "User"}
        description="Account status, role invitations and activity for this user."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/users">
              <ArrowLeft className="h-4 w-4" /> Back to users
            </Link>
          </Button>
        }
      />

      {loading ? (
        <div className="mt-6">
          <AdminPanel>
            <AdminLoading label="Loading user…" />
          </AdminPanel>
        </div>
      ) : !profile ? (
        <div className="mt-6">
          <AdminPanel>
            <AdminEmpty
              icon={UserCog}
              title="User not found"
              hint="This account may have been removed, or the link is out of date."
              action={
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link href="/admin/users">Back to users</Link>
                </Button>
              }
            />
          </AdminPanel>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AdminStat label="Role" value={profile.roles?.name || "Student"} icon={ShieldCheck} tone="violet" />
            <AdminStat
              label="Status"
              value={isActive ? "Active" : "Inactive"}
              hint={isActive ? "Can sign in and use the platform" : "Sign-in is blocked"}
              tone={isActive ? "emerald" : "rose"}
            />
            <AdminStat label="Attempts" value={attemptsCount} hint="Mock test attempts" tone="cyan" />
            <AdminStat
              label="Verified"
              value={profile.email_verified ? "Yes" : "No"}
              tone={profile.email_verified ? "emerald" : "amber"}
            />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
            <AdminPanel eyebrow="Account" title="Profile details" icon={UserCog}>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name">{profile.full_name || "—"}</Field>
                <Field label="Email">
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                    {profile.email || "(no email)"}
                  </span>
                </Field>
                <Field label="User ID">
                  <span className="break-all font-mono text-xs text-slate-400">{profile.id}</span>
                </Field>
                <Field label="Registered">{formatDate(profile.created_at)}</Field>
                <Field label="Role code">
                  <AdminChip tone={roleCode !== "student" ? "violet" : "neutral"}>{roleCode}</AdminChip>
                </Field>
                <Field label="Status">
                  <AdminChip tone={isActive ? "success" : "danger"}>{isActive ? "Active" : "Inactive"}</AdminChip>
                </Field>
              </dl>
            </AdminPanel>

            <div className="grid gap-4">
              <AdminPanel eyebrow="Access" title="Role assignment" icon={ShieldCheck}>
                {canManageAccounts ? (
                  <>
                    <label className="admin-stat-label" htmlFor="user-role">
                      Invite to role
                    </label>
                    <select
                      id="user-role"
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400/50"
                    >
                      <option value="">Choose a role</option>
                      {roles.filter((r) => r.code !== "super_admin").map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-slate-500">The user will receive an email and must accept before their role changes. Invitations expire after 7 days.</p>
                    <Button onClick={saveRole} disabled={savingRole || !selectedRole || (selectedRole === roleCode && !pendingRoleInvitation)} className="mt-4 w-full">
                      {savingRole ? "Sending invitation…" : pendingRoleInvitation ? "Replace pending invitation" : "Send role invitation"}
                    </Button>
                    {pendingRoleInvitation ? (
                      <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
                        <p className="text-sm font-semibold text-amber-200">Awaiting response: {pendingRoleInvitation.role.name}</p>
                        <p className="mt-1 text-xs text-slate-400">Expires {formatDate(pendingRoleInvitation.expires_at)}</p>
                        <Button type="button" variant="outline" disabled={cancellingInvitation} onClick={cancelRoleInvitation} className="mt-3 w-full">
                          {cancellingInvitation ? "Cancelling…" : "Cancel invitation"}
                        </Button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Only a super administrator can send role invitations.</p>
                )}
              </AdminPanel>

              <AdminPanel eyebrow="Access" title="Account status">
                <p className="text-sm text-slate-400">
                  {isActive
                    ? "This account can sign in and use the platform. Deactivating blocks sign-in without deleting history."
                    : "This account is deactivated and cannot sign in."}
                </p>
                {canManageAccounts ? (
                  <Button
                    onClick={toggleActive}
                    disabled={savingActive}
                    variant={isActive ? "destructive" : "default"}
                    className="mt-4 w-full"
                  >
                    {savingActive ? "Working…" : isActive ? "Deactivate account" : "Reactivate account"}
                  </Button>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">Only a super administrator can change account status.</p>
                )}
              </AdminPanel>
            </div>
          </div>
        </>
      )}
    </AdminPage>
  );
}

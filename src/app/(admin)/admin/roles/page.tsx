"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, UserCog, Users } from "lucide-react";
import { AdminChip, AdminEmpty, AdminLoading, AdminPage, AdminPageHeader, AdminPanel } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";

type Role = { id: string; code: string; name: string };

const ROLE_DETAILS: Record<string, { description: string; tone: "violet" | "info" | "success" | "warning" | "neutral" }> = {
  super_admin: { description: "Full platform control including provisioning new administrators.", tone: "violet" },
  admin: { description: "Day-to-day operations across academics, content and users.", tone: "info" },
  content_manager: { description: "Creates and publishes notes, blogs, imports and mock tests.", tone: "success" },
  reviewer: { description: "Reviews questions and content before publication.", tone: "warning" },
  student: { description: "Standard learner account with access to tests and study material.", tone: "neutral" },
};

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/roles", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Failed to load roles");
        setRoles(json.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load roles");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="People & access"
        title="Roles"
        description="The role catalogue that drives authorization across the platform. Assign roles from the user management screen."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/users">
                <Users className="h-4 w-4" /> Manage users
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/admin-requests">
                <UserCog className="h-4 w-4" /> Admin requests
              </Link>
            </Button>
          </>
        }
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminPanel eyebrow="Catalogue" title="Platform roles" icon={ShieldCheck}>
          {loading ? (
            <AdminLoading label="Loading roles…" />
          ) : error ? (
            <AdminEmpty icon={ShieldCheck} title="Could not load roles" hint={error} />
          ) : roles.length === 0 ? (
            <AdminEmpty icon={ShieldCheck} title="No roles found" hint="Run the database seed migration to create the base role catalogue." />
          ) : (
            <div className="space-y-3">
              {roles.map((role) => {
                const details = ROLE_DETAILS[role.code] || { description: "Custom platform role.", tone: "neutral" as const };
                return (
                  <div key={role.id} className="admin-row">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="admin-stat-icon admin-stat-icon--violet">
                        <ShieldCheck className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="admin-row-title">{role.name}</p>
                        <p className="admin-row-meta">{details.description}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <code className="rounded-md border border-white/10 bg-slate-950/50 px-2 py-1 text-[11px] text-slate-300">{role.code}</code>
                      <AdminChip tone={details.tone}>{role.code === "student" ? "Learner" : "Privileged"}</AdminChip>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AdminPanel>

        <AdminPanel eyebrow="How it works" title="Authorization model" icon={UserCog}>
          <div className="space-y-4 text-sm leading-6 text-slate-300">
            <p>
              Every request is checked twice: middleware (<code className="text-cyan-300">src/proxy.ts</code>) guards the{" "}
              <code className="text-cyan-300">/admin/*</code> surface, and each API route re-validates the session with{" "}
              <code className="text-cyan-300">requireAdminAuth()</code>.
            </p>
            <hr className="admin-divider" />
            <ul className="space-y-3">
              <li className="admin-row">
                <div>
                  <p className="admin-row-title">Provisioning</p>
                  <p className="admin-row-meta">Only super admins can create privileged accounts.</p>
                </div>
                <AdminChip tone="violet">super_admin</AdminChip>
              </li>
              <li className="admin-row">
                <div>
                  <p className="admin-row-title">Approvals</p>
                  <p className="admin-row-meta">Admin signup requests are reviewed by the main administrators.</p>
                </div>
                <AdminChip tone="info">admin</AdminChip>
              </li>
              <li className="admin-row">
                <div>
                  <p className="admin-row-title">Content pipeline</p>
                  <p className="admin-row-meta">Content managers and reviewers keep the catalogue moving.</p>
                </div>
                <AdminChip tone="success">content</AdminChip>
              </li>
            </ul>
          </div>
        </AdminPanel>
      </div>
    </AdminPage>
  );
}

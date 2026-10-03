import Link from "next/link";
import { KeyRound, ShieldCheck, UserCog, Users } from "lucide-react";
import { requireAdminAuth } from "@/lib/auth";
import { normalizeRoleCode } from "@/lib/roles";
import { AdminChip, AdminPage, AdminPageHeader, AdminPanel } from "@/components/admin/ui";
import ChangePasswordForm from "@/components/auth/ChangePasswordForm";

export default async function AdminSettingsPage() {
  const { profile } = await requireAdminAuth();
  const role = normalizeRoleCode(profile) ?? "admin";

  return (
    <AdminPage className="mx-auto max-w-4xl">
      <AdminPageHeader
        eyebrow="System"
        title="Settings"
        description="Review your administrator account and manage privileged access."
        actions={<AdminChip tone={role === "super_admin" ? "violet" : "info"}>{role.replaceAll("_", " ")}</AdminChip>}
      />

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <AdminPanel eyebrow="Identity" title="Administrator profile" icon={ShieldCheck}>
          <div className="space-y-3 text-sm">
            <div className="admin-row">
              <span className="text-slate-400">Name</span>
              <span className="font-semibold text-white">{profile.full_name || "Not set"}</span>
            </div>
            <div className="admin-row">
              <span className="text-slate-400">Email</span>
              <span className="font-semibold text-white">{profile.email}</span>
            </div>
            <div className="admin-row">
              <span className="text-slate-400">Role</span>
              <span className="font-semibold capitalize text-white">{role.replaceAll("_", " ")}</span>
            </div>
          </div>
        </AdminPanel>

        <AdminPanel eyebrow="Access" title="Access management" icon={UserCog}>
          <div className="flex flex-col gap-3">
            <Link href="/admin/users" className="admin-row">
              <span className="admin-row-title">Manage users</span>
              <Users className="h-4 w-4 text-cyan-300" aria-hidden />
            </Link>
            <Link href="/admin/roles" className="admin-row">
              <span className="admin-row-title">Role catalogue</span>
              <KeyRound className="h-4 w-4 text-cyan-300" aria-hidden />
            </Link>
            {role === "super_admin" && (
              <Link href="/admin/create-admin" className="admin-row">
                <span className="admin-row-title">Create administrator</span>
                <UserCog className="h-4 w-4 text-cyan-300" aria-hidden />
              </Link>
            )}
            <p className="text-xs text-slate-500">Only super administrators can provision new privileged accounts.</p>
          </div>
        </AdminPanel>

        <AdminPanel eyebrow="Security" title="Change password" icon={KeyRound}>
          <ChangePasswordForm />
        </AdminPanel>
      </div>
    </AdminPage>
  );
}
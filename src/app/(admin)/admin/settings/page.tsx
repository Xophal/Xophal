import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminAuth } from "@/lib/auth";
import { normalizeRoleCode } from "@/lib/roles";

export default async function AdminSettingsPage() {
  const { profile } = await requireAdminAuth();
  const role = normalizeRoleCode(profile) ?? "admin";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Review your administrator account and manage privileged access.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Administrator profile</CardTitle>
            <CardDescription>Your current identity and access level.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4 border-b pb-3">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{profile.full_name || "Not set"}</span>
            </div>
            <div className="flex items-center justify-between gap-4 border-b pb-3">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{profile.email}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Role</span>
              <span className="font-medium capitalize">{role.replaceAll("_", " ")}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Access management</CardTitle>
            <CardDescription>Use the existing protected tools for account administration.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Link href="/admin/users" className="rounded-md border px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5">
              Manage users
            </Link>
            {role === "super_admin" && (
              <Link href="/admin/create-admin" className="rounded-md border px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5">
                Create administrator
              </Link>
            )}
            <p className="text-xs text-muted-foreground">Only super administrators can provision new privileged accounts.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
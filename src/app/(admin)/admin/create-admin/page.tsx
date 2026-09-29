"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminPage, AdminPageHeader, AdminPanel } from "@/components/admin/ui";

export default function CreateAdminPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
      fullName: String(form.get("fullName") || ""),
      role: String(form.get("role") || "admin"),
    };

    try {
      const res = await fetch("/api/admin/create-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Admin creation failed");
      }

      setMessage(`Admin account created for ${payload.email}`);
      e.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin creation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminPage className="mx-auto max-w-lg">
      <AdminPageHeader
        eyebrow="People"
        title="Create admin account"
        description="Private admin-only account creation helper. Super administrators only."
      />
      <div className="mt-6">
        <AdminPanel eyebrow="Provisioning" title="New privileged account" icon={ShieldCheck}>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" name="fullName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required minLength={8} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select id="role" name="role" className="flex h-10 w-full px-3 py-2 text-sm glass-input" defaultValue="admin">
                <option value="admin">Admin</option>
                <option value="content_manager">Content Manager</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Create admin"}
            </Button>
            {message && <p className="text-sm text-emerald-400">{message}</p>}
            {error && <p className="text-sm text-rose-400">{error}</p>}
          </form>
        </AdminPanel>
      </div>
    </AdminPage>
  );
}

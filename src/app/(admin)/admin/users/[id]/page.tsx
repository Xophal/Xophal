"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

export default function AdminUserDetail({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  useEffect(() => { load(); loadRoles(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed");
      setProfile(json.data?.profile ?? json.data?.profile ?? json.profile ?? json);
      setSelectedRole((json.data?.profile?.roles?.code) || (json.profile?.roles?.code) || null);
    } catch (err) {
      toast({ title: "Load failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function loadRoles() {
    try {
      const res = await fetch(`/api/admin/roles`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.success) setRoles(json.data || []);
    } catch (e) {
      // ignore
    }
  }

  async function toggleActive() {
    if (!profile) return;
    const confirmMsg = profile.is_active ? "Deactivate this account?" : "Reactivate this account?";
    if (!confirm(confirmMsg)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !profile.is_active }) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed");
      toast({ title: profile.is_active ? "Deactivated" : "Reactivated" });
      await load();
      router.refresh();
    } catch (err) {
      toast({ title: "Action failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  }

  async function saveRole() {
    if (!selectedRole) return;
    if (!confirm("Change role for this user?")) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: selectedRole }) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed");
      toast({ title: "Role updated" });
      await load();
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  }

  if (loading) return <div className="p-6">Loading...</div>;
  if (!profile) return <div className="p-6">User not found</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{profile.full_name || profile.email || 'User'}</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Email</div>
          <div className="font-medium">{profile.email || '—'}</div>
          <div className="text-sm text-muted-foreground mt-2">Registered: {profile.created_at ? new Date(profile.created_at).toLocaleString() : '—'}</div>
          <div className="text-sm text-muted-foreground mt-1">Active: {profile.is_active ? 'Yes' : 'No'}</div>
          <div className="text-sm text-muted-foreground mt-1">Attempts: {profile.attemptsCount ?? '—'}</div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Role</div>
          <div className="mt-2">
            <select value={selectedRole || ''} onChange={(e) => setSelectedRole(e.target.value)} className="w-full px-2 py-1 glass-input">
              <option value="">(none)</option>
              {roles.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={saveRole}>Save role</Button>
            <Button variant="destructive" onClick={toggleActive}>{profile.is_active ? 'Deactivate' : 'Reactivate'}</Button>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Metadata</div>
          <pre className="mt-2 text-xs">{JSON.stringify(profile.metadata || {}, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}

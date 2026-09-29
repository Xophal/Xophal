"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { AdminChip, AdminEmpty, AdminLoading, AdminPage, AdminPageHeader, AdminPanel, AdminPagination, AdminToolbar, readList } from "@/components/admin/ui";

export default function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, [page]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (query) params.set("q", query);
      const res = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed");
      const parsed = readList<(typeof users)[number]>(json);
      setUsers(parsed.items);
      setTotal(parsed.total);
    } catch (err) {
      toast({ title: "Load failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setLoading(false); }
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="People"
        title="Users"
        description="Manage application users. Sensitive data is protected."
        actions={<AdminChip tone="info">{total} accounts</AdminChip>}
      />

      <div className="mt-6">
        <AdminPanel eyebrow="Directory" title="All users" icon={Users} flush>
          <div className="px-5 pt-5">
            <AdminToolbar>
              <form onSubmit={onSearch} className="admin-toolbar-grow flex gap-2">
                <Input placeholder="Search name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
                <Button type="submit" variant="outline" size="sm">Search</Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setPage(1);
                    load();
                  }}
                >
                  Reset
                </Button>
              </form>
            </AdminToolbar>
          </div>

          <div className="admin-panel-body mt-4">
            {loading ? (
              <AdminLoading label="Loading users…" />
            ) : users.length === 0 ? (
              <AdminEmpty icon={Users} title="No users found" hint="Try a different search or clear the query." />
            ) : (
              <>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Role</th>
                        <th>Joined</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <p className="font-semibold text-white">{u.full_name || "—"}</p>
                            <p className="text-xs text-slate-500">{u.email || "(no email)"}</p>
                          </td>
                          <td>
                            <AdminChip tone={u.roles?.code && u.roles.code !== "student" ? "violet" : "neutral"}>{u.roles?.code || "user"}</AdminChip>
                          </td>
                          <td className="text-slate-400">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                          <td>
                            <div className="flex justify-end">
                              <Button asChild size="sm" variant="outline">
                                <Link href={`/admin/users/${u.id}`}>Manage</Link>
                              </Button>
                            </div>
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

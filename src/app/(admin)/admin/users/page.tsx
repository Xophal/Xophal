"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { AdminChip, AdminEmpty, AdminLoading, AdminPage, AdminPageHeader, AdminPanel, AdminPagination, AdminToolbar, readList } from "@/components/admin/ui";

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string | null;
  roles: { code: string; name: string } | null;
};

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [result, setResult] = useState<{ query: string; page: number; users: UserRow[]; total: number } | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const loading = result?.query !== activeQuery || result?.page !== page;
  const users = result?.query === activeQuery && result.page === page ? result.users : [];
  const total = result?.query === activeQuery && result.page === page ? result.total : 0;

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (activeQuery) params.set("q", activeQuery);
        const res = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Failed");
        const parsed = readList<UserRow>(json);
        if (active) setResult({ query: activeQuery, page, users: parsed.items, total: parsed.total });
      } catch (err) {
        if (active) {
          toast({ title: "Load failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
          setResult({ query: activeQuery, page, users: [], total: 0 });
        }
      }
    })();
    return () => { active = false; };
  }, [activeQuery, limit, page]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setActiveQuery(search);
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
                <Input placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
                <Button type="submit" variant="outline" size="sm">Search</Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setActiveQuery("");
                    setPage(1);
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

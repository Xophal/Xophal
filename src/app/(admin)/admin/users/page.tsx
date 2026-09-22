"use client";

import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import Link from "next/link";

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
      setUsers(json.data || []);
      setTotal(json.pagination?.total ?? (json.data?.length ?? 0));
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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Users</h1>
        <p className="mt-2 text-sm text-muted-foreground">Manage application users. Sensitive data is protected.</p>
      </div>

      <form onSubmit={onSearch} className="flex gap-2">
        <Input placeholder="Search name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button type="submit">Search</Button>
        <Button type="button" onClick={() => { setQuery(""); setPage(1); load(); }}>Reset</Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <div>Loading...</div>}
          {!loading && users.length === 0 && <div className="text-sm text-muted-foreground">No users found</div>}
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded border p-3">
                <div>
                  <div className="font-medium">{u.full_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{u.email || "(no email)"} • {u.roles?.code || 'user'}</div>
                </div>
                <div className="flex items-center gap-3"><div className="text-sm text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</div><Button asChild size="sm" variant="outline"><Link href={`/admin/users/${u.id}`}>Manage</Link></Button></div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div>Showing {(page-1)*limit + 1}–{Math.min(page*limit, total)} of {total}</div>
            <div className="flex gap-2">
              <Button onClick={() => { if (page>1) setPage(page-1); }}>Prev</Button>
              <Button onClick={() => { if (page*limit < total) setPage(page+1); }}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

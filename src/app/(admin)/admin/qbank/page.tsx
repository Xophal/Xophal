import Link from "next/link";
import { AlertTriangle, BarChart3, Check, Clock, FileText, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

async function getCount(admin: ReturnType<typeof createAdminClient>, status?: string) {
  let query = admin.from("questions").select("id", { count: "exact", head: true });
  if (status) query = query.eq("status", status);
  const { count, error } = await query;
  if (error) throw new ApiError(500, error.message, "DB_ERROR");
  return count ?? 0;
}

export default async function QuestionBankDashboard() {
  const admin = createAdminClient();
  const [total, approved, pending, drafts, rejected, imports] = await Promise.all([
    getCount(admin),
    getCount(admin, "approved"),
    getCount(admin, "review"),
    getCount(admin, "draft"),
    getCount(admin, "rejected"),
    admin.from("import_batches").select("id, filename, status, total_rows, imported_rows, created_at").order("created_at", { ascending: false }).limit(5),
  ]);
  if (imports.error) throw new ApiError(500, imports.error.message, "DB_ERROR");

  const cards = [
    { title: "Total questions", value: total, icon: BarChart3 },
    { title: "Approved", value: approved, icon: Check },
    { title: "Pending review", value: pending, icon: Clock },
    { title: "Drafts", value: drafts, icon: FileText },
    { title: "Rejected", value: rejected, icon: AlertTriangle },
    { title: "Import batches", value: imports.data?.length ?? 0, icon: RefreshCw },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Question Bank</h1>
          <p className="text-muted-foreground">Manage and review questions across the academic catalog.</p>
        </div>
        <Button asChild><Link href="/admin/qbank/import">Bulk import</Link></Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map(({ title, value, icon: Icon }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <Icon size={18} className="text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{value.toLocaleString()}</div></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Quick actions</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild variant="outline"><Link href="/admin/questions">Create or review questions</Link></Button>
            <Button asChild variant="outline"><Link href="/admin/qbank/questions">Browse question bank</Link></Button>
            <Button asChild variant="outline"><Link href="/admin/qbank/import">Bulk import and history</Link></Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent imports</CardTitle></CardHeader>
          <CardContent>
            {(imports.data ?? []).length ? (
              <ul className="space-y-3">
                {(imports.data ?? []).map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-4 border-b pb-2 text-sm last:border-0">
                    <span className="truncate">{item.filename}</span>
                    <span className="shrink-0 text-muted-foreground">{item.status} · {item.imported_rows}/{item.total_rows}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No import batches yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

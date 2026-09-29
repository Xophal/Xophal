"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Download, FileSpreadsheet, Target, TrendingUp } from "lucide-react";
import { AdminChip, AdminEmpty, AdminLoading, AdminPage, AdminPageHeader, AdminPanel, AdminStat } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";

type RangeKey = "today" | "7d" | "30d" | "90d";

type Analytics = {
  users?: { total: number; active: number };
  tests?: { total: number; published: number };
  attempts?: { total: number; completed: number };
  averages?: { averageScore: number; averagePercentage: number; averageAccuracy: number };
  trends?: Array<{ date: string; completed_count: number }> | null;
  topTests?: Array<{ id?: string; title?: string; attempts?: number }> | null;
};

const RANGES: Array<{ key: RangeKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
];

const AXIS_STYLE = { fontSize: 11, fill: "#94a3b8" } as const;

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number | string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/95 px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-slate-100">{label}</p>
      <p className="mt-0.5 text-slate-400">
        Completed: <span className="font-semibold text-cyan-300">{payload[0]?.value}</span>
      </p>
    </div>
  );
}

export default function AdminReportsPage() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/analytics?range=${range}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Failed to load report");
        if (!cancelled) setData(json.data);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const trends = useMemo(() => {
    if (!Array.isArray(data?.trends)) return [];
    return data!.trends!.map((point) => ({ date: String(point.date ?? ""), completed: Number(point.completed_count ?? 0) }));
  }, [data]);

  function exportCsv() {
    if (!data) return;
    setExporting(true);
    try {
      const rows = [
        ["Metric", "Value"],
        ["Range", range],
        ["Total users", String(data.users?.total ?? 0)],
        ["Active users", String(data.users?.active ?? 0)],
        ["Total tests", String(data.tests?.total ?? 0)],
        ["Published tests", String(data.tests?.published ?? 0)],
        ["Total attempts", String(data.attempts?.total ?? 0)],
        ["Completed attempts", String(data.attempts?.completed ?? 0)],
        ["Average score", String(data.averages?.averageScore ?? 0)],
        ["Average percentage", String(data.averages?.averagePercentage ?? 0)],
        ["Average accuracy", String(data.averages?.averageAccuracy ?? 0)],
        [],
        ["Date", "Completed attempts"],
        ...trends.map((point) => [point.date, String(point.completed)]),
      ];
      const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `xophol-report-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Insights"
        title="Reports"
        description="Operational snapshots of growth, engagement and assessment performance — ready to export."
        actions={
          <>
            {RANGES.map((it) => (
              <button
                key={it.key}
                type="button"
                onClick={() => setRange(it.key)}
                className={
                  range === it.key
                    ? "rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200"
                    : "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/30 hover:text-white"
                }
              >
                {it.label}
              </button>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={exportCsv} disabled={loading || !data || exporting}>
              <Download className="h-4 w-4" /> {exporting ? "Exporting…" : "Export CSV"}
            </Button>
          </>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <AdminStat label="Total users" value={loading ? "…" : data?.users?.total ?? "—"} hint={`${data?.users?.active ?? 0} active`} icon={BarChart3} tone="cyan" />
        <AdminStat label="Mock tests" value={loading ? "…" : data?.tests?.total ?? "—"} hint={`${data?.tests?.published ?? 0} published`} icon={Target} tone="violet" />
        <AdminStat
          label="Attempts"
          value={loading ? "…" : data?.attempts?.total ?? "—"}
          hint={`${data?.attempts?.completed ?? 0} completed`}
          icon={TrendingUp}
          tone="emerald"
        />
        <AdminStat
          label="Avg percentage"
          value={loading ? "…" : `${Number(data?.averages?.averagePercentage ?? 0).toFixed(1)}%`}
          hint={`${Number(data?.averages?.averageAccuracy ?? 0).toFixed(1)}% accuracy`}
          icon={FileSpreadsheet}
          tone="amber"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <AdminPanel eyebrow="Trend" title="Completed attempts per day" icon={TrendingUp}>
          {loading ? (
            <AdminLoading label="Building report…" />
          ) : trends.length === 0 ? (
            <AdminEmpty
              icon={BarChart3}
              title="No data for this range"
              hint="Pick a wider range or wait for students to start completing tests."
            />
          ) : (
            <div className="h-72 w-full" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={AXIS_STYLE} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
                  <YAxis allowDecimals={false} tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(34,211,238,0.06)" }} />
                  <Bar dataKey="completed" name="Completed" fill="rgba(34,211,238,0.85)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </AdminPanel>

        <AdminPanel eyebrow="Breakdown" title="Summary" icon={FileSpreadsheet}>
          {loading ? (
            <AdminLoading label="Crunching numbers…" />
          ) : (
            <ul className="space-y-3 text-sm">
              {[
                ["Conversion (completed / started)", data?.attempts?.total ? `${Math.round(((data?.attempts?.completed ?? 0) / data.attempts.total) * 100)}%` : "—"],
                ["Published test ratio", data?.tests?.total ? `${Math.round(((data?.tests?.published ?? 0) / data.tests.total) * 100)}%` : "—"],
                ["Active user ratio", data?.users?.total ? `${Math.round(((data?.users?.active ?? 0) / data.users.total) * 100)}%` : "—"],
                ["Average score", data?.averages ? `${Number(data.averages.averageScore).toFixed(1)}` : "—"],
                ["Data points in trend", String(trends.length)],
              ].map(([label, value]) => (
                <li key={label} className="admin-row">
                  <span className="text-slate-400">{label}</span>
                  <span className="font-semibold text-white">{value}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-400">
            <span>Exports include every metric and trend row shown above.</span>
            <AdminChip tone="info">CSV</AdminChip>
          </div>
        </AdminPanel>
      </div>
    </AdminPage>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Target, TrendingUp, UserCheck } from "lucide-react";
import { AdminChip, AdminEmpty, AdminLoading, AdminStat } from "@/components/admin/ui";

type RangeKey = "7d" | "30d" | "90d";

type AnalyticsPayload = {
  users?: { total: number; active: number };
  tests?: { total: number; published: number };
  attempts?: { total: number; completed: number };
  averages?: { averageScore: number; averagePercentage: number; averageAccuracy: number };
  trends?: Array<{ date: string; completed_count: number }> | null;
};

const RANGES: Array<{ key: RangeKey; label: string }> = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
];

const AXIS_STYLE = { fontSize: 11, fill: "#94a3b8" } as const;

function InsightTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number | string }>; label?: string }) {
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

export default function OverviewInsights() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/analytics?range=${range}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Failed to load analytics");
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

  const trends = Array.isArray(data?.trends)
    ? data!.trends!.map((point) => ({
        date: String(point.date ?? "").slice(5),
        completed_count: Number(point.completed_count ?? 0),
      }))
    : [];

  return (
    <div className="space-y-5">
      <div className="admin-toolbar justify-between">
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
        <AdminChip tone="info">Live data</AdminChip>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <AdminStat
          label="Active users"
          value={loading ? "…" : data?.users?.active ?? "—"}
          hint={loading ? "Syncing" : `of ${data?.users?.total ?? 0} total`}
          icon={UserCheck}
          tone="emerald"
        />
        <AdminStat
          label="Completed attempts"
          value={loading ? "…" : data?.attempts?.completed ?? "—"}
          hint={loading ? "Syncing" : `${data?.attempts?.total ?? 0} started in range`}
          icon={Activity}
          tone="cyan"
        />
        <AdminStat
          label="Avg score"
          value={loading ? "…" : `${Number(data?.averages?.averagePercentage ?? 0).toFixed(1)}%`}
          hint="Across completed attempts"
          icon={Target}
          tone="violet"
        />
        <AdminStat
          label="Avg accuracy"
          value={loading ? "…" : `${Number(data?.averages?.averageAccuracy ?? 0).toFixed(1)}%`}
          hint="Correct vs attempted"
          icon={TrendingUp}
          tone="amber"
        />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="admin-eyebrow">Momentum</p>
            <h3 className="mt-1 text-sm font-semibold text-white">Completed attempts per day</h3>
          </div>
        </div>

        {loading ? (
          <AdminLoading label="Loading trends…" />
        ) : trends.length === 0 ? (
          <AdminEmpty
            icon={TrendingUp}
            title="No attempt data in this range"
            hint="Once students start completing mock tests, the daily activity trend will render here automatically."
          />
        ) : (
          <div className="h-56 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trends} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={AXIS_STYLE} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
                <YAxis allowDecimals={false} tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                <Tooltip content={<InsightTooltip />} cursor={{ fill: "rgba(34,211,238,0.06)" }} />
                <Bar dataKey="completed_count" name="Completed" fill="rgba(34,211,238,0.85)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

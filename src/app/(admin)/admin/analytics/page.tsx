"use client";

import React, { useEffect, useState } from "react";
import { BarChart3, Target, TrendingUp, Users, type LucideIcon } from "lucide-react";
import { AdminChip, AdminEmpty, AdminLoading, AdminPage, AdminPageHeader, AdminPanel, AdminStat } from "@/components/admin/ui";


type RangeKey = "today" | "7d" | "30d" | "90d" | "all";
type AnalyticsData = {
  users: { total: number; active: number };
  tests: { total: number; published: number };
  attempts: { total: number; completed: number };
  averages: { averageScore: number; averagePercentage: number; averageAccuracy: number };
  discovery: {
    ebookViewers: number;
    ebookToMockTestUsers: number;
    ebookToMockTestConversion: number;
    mockTestUsers: number;
    mockTestToEbookUsers: number;
    mockTestToEbookDiscovery: number;
  };
  topTests: Array<{ id: string; title: string; attempts: number }>;
  trends: Array<{ date: string; completed_count: number }> | null;
};

const RANGES: Array<{ key: RangeKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "all", label: "All time" },
];

export default function AdminAnalyticsPage() {
  const [result, setResult] = useState<{ range: RangeKey; data: AnalyticsData | null } | null>(null);
  const [range, setRange] = useState<RangeKey>("30d");
  const loading = result?.range !== range;
  const data = result?.range === range ? result.data : null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/analytics?range=${range}`, { cache: "no-store" });
        const json = (await res.json()) as { success: boolean; data?: AnalyticsData; error?: string };
        if (!res.ok || !json.success || !json.data) throw new Error(json.error || "Failed to load analytics");
        if (!cancelled) setResult({ range, data: json.data });
      } catch {
        if (!cancelled) setResult({ range, data: null });
      }
    })();
    return () => { cancelled = true; };
  }, [range]);

  const stats: Array<{ label: string; value: React.ReactNode; icon: LucideIcon; tone: "cyan" | "emerald" | "violet" | "amber" }> = [
    { label: "Total users", value: data?.users?.total, icon: Users, tone: "cyan" },
    { label: "Active users", value: data?.users?.active, icon: Users, tone: "emerald" },
    { label: "Total tests", value: data?.tests?.total, icon: Target, tone: "violet" },
    { label: "Published tests", value: data?.tests?.published, icon: Target, tone: "emerald" },
    { label: "Total attempts", value: data?.attempts?.total, icon: TrendingUp, tone: "cyan" },
    { label: "Completed attempts", value: data?.attempts?.completed, icon: TrendingUp, tone: "amber" },
    { label: "Average score", value: data?.averages?.averageScore != null ? Number(data.averages.averageScore).toFixed(1) : "—", icon: BarChart3, tone: "violet" },
    { label: "Average percentage", value: data?.averages?.averagePercentage != null ? `${Number(data.averages.averagePercentage).toFixed(1)}%` : "—", icon: BarChart3, tone: "cyan" },
    { label: "Average accuracy", value: data?.averages?.averageAccuracy != null ? `${Number(data.averages.averageAccuracy).toFixed(1)}%` : "—", icon: Target, tone: "amber" },
    { label: "eBook → mock test", value: data?.discovery ? `${Number(data.discovery.ebookToMockTestConversion).toFixed(1)}%` : "—", icon: TrendingUp, tone: "emerald" },
    { label: "eBook → test users", value: data?.discovery?.ebookToMockTestUsers ?? "—", icon: Users, tone: "cyan" },
    { label: "Mock test → eBook", value: data?.discovery ? `${Number(data.discovery.mockTestToEbookDiscovery).toFixed(1)}%` : "—", icon: TrendingUp, tone: "violet" },
    { label: "Mock → eBook users", value: data?.discovery?.mockTestToEbookUsers ?? "—", icon: Users, tone: "amber" },
  ];

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Command center"
        title="Platform analytics"
        description="Live usage, engagement and assessment performance across the platform."
        actions={
          <div className="flex flex-wrap gap-2">
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
            <AdminChip tone="info">Range: {RANGES.find((r) => r.key === range)?.label}</AdminChip>
          </div>
        }
      />

      {loading ? (
        <div className="mt-6">
          <AdminLoading label="Loading analytics…" />
        </div>
      ) : !data ? (
        <div className="mt-6">
          <AdminEmpty icon={BarChart3} title="Analytics unavailable" hint="We could not load analytics for this range. Please try again." />
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {stats.map((stat) => (
              <AdminStat key={stat.label} label={stat.label} value={stat.value ?? "—"} icon={stat.icon} tone={stat.tone} />
            ))}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <AdminPanel eyebrow="Deep dive" title="Top tests by attempts" icon={Target}>
              {!data?.topTests || data.topTests.length === 0 ? (
                <AdminEmpty icon={Target} title="No ranked tests yet" hint="Once students attempt tests, popularity rankings appear here." />
              ) : (
                <ol className="space-y-3">
                  {data.topTests.map((t) => (
                    <li key={t.id} className="admin-row">
                      <span className="admin-row-title">{t.title}</span>
                      <AdminChip tone="info">{t.attempts} attempts</AdminChip>
                    </li>
                  ))}
                </ol>
              )}
            </AdminPanel>

            <AdminPanel eyebrow="Deep dive" title="Completion trend" icon={TrendingUp}>
              {!data?.trends || !Array.isArray(data.trends) || data.trends.length === 0 ? (
                <AdminEmpty icon={TrendingUp} title="No trend data" hint="Daily completion trends appear once attempts exist in this range." />
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.trends.slice(-10).map((point) => (
                    <li key={point.date} className="admin-row">
                      <span className="text-slate-400">{new Date(point.date).toLocaleDateString()}</span>
                      <span className="font-semibold text-white">{point.completed_count} completed</span>
                    </li>
                  ))}
                </ul>
              )}
            </AdminPanel>
          </div>
        </>
      )}
    </AdminPage>
  );
}

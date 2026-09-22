"use client";

import React, { useEffect, useState } from "react";

function Card({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [range, setRange] = useState("30d");
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, [range]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?range=${range}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed');
      setData(json.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Platform Analytics</h1>
      <div className="mt-4 flex gap-2">
        <select value={range} onChange={(e) => setRange(e.target.value)} className="px-2 py-1 glass-input">
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      {loading && <div className="mt-6">Loading…</div>}

      {data && (
        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card title="Total users" value={data.users?.total ?? '—'} />
          <Card title="Active users" value={data.users?.active ?? '—'} />
          <Card title="Total tests" value={data.tests?.total ?? '—'} />
          <Card title="Published tests" value={data.tests?.published ?? '—'} />
          <Card title="Total attempts" value={data.attempts?.total ?? '—'} />
          <Card title="Completed attempts" value={data.attempts?.completed ?? '—'} />
          <Card title="Average score" value={data.averages?.averageScore ?? '—'} />
          <Card title="Average percentage" value={data.averages?.averagePercentage ?? '—'} />
          <Card title="Average accuracy" value={data.averages?.averageAccuracy ?? '—'} />
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Top tests (by attempts)</h2>
        {!data?.topTests || data.topTests.length === 0 ? <div className="mt-3 text-sm text-muted-foreground">No data</div> : (
          <ol className="mt-3 space-y-2">
            {data.topTests.map((t:any) => <li key={t.id} className="rounded border p-3"><div className="font-medium">{t.title}</div><div className="text-sm text-muted-foreground">Attempts: {t.attempts}</div></li>)}
          </ol>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Trends</h2>
        {!data?.trends ? <div className="mt-3 text-sm text-muted-foreground">No trend data available.</div> : (
          <div className="mt-3 text-sm">
            {Array.isArray(data.trends) ? data.trends.map((d:any) => <div key={d.date}>{d.date}: {d.completed_count} completed</div>) : <div>No data</div>}
          </div>
        )}
      </section>
    </div>
  );
}

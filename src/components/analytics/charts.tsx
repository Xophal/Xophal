"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AttemptPoint, StudyPoint } from "@/lib/analytics";

const AXIS_STYLE = { fontSize: 11, fill: "hsl(var(--muted-foreground))" } as const;

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="mt-0.5 text-muted-foreground">
          {entry.name}: <span className="font-semibold text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Score trend across the student's most recent attempts. */
export function ScoreTrendChart({ data }: { data: AttemptPoint[] }) {
  if (data.length < 2) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Take one more mock test to unlock your score trend.
      </p>
    );
  }

  return (
    <div className="h-60 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={AXIS_STYLE} tickLine={false} axisLine={false} unit="%" />
          <Tooltip content={<ChartTooltip />} />
          <Line
            type="monotone"
            dataKey="score"
            name="Score"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Daily study minutes for the last week. */
export function StudyTimeChart({ data }: { data: StudyPoint[] }) {
  if (!data.some((point) => point.minutes > 0)) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No study time recorded in the last 7 days.
      </p>
    );
  }

  return (
    <div className="h-48 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
          <Bar dataKey="minutes" name="Minutes" radius={[6, 6, 0, 0]} isAnimationActive={false}>
            {data.map((point) => (
              <Cell key={point.key} fill={point.minutes > 0 ? "hsl(var(--primary))" : "hsl(var(--muted))"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
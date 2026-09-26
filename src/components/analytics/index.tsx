"use client";

import dynamic from "next/dynamic";

/**
 * Charts are loaded client-side only. Recharts needs the DOM, and keeping it
 * out of the server bundle means the analytics route ships no chart code until
 * the chart module is actually needed.
 */
const ScoreTrendChart = dynamic(() => import("@/components/analytics/charts").then((mod) => mod.ScoreTrendChart), {
  ssr: false,
  loading: () => <div className="h-60 w-full animate-pulse rounded-lg bg-muted" aria-hidden="true" />,
});

const StudyTimeChart = dynamic(() => import("@/components/analytics/charts").then((mod) => mod.StudyTimeChart), {
  ssr: false,
  loading: () => <div className="h-48 w-full animate-pulse rounded-lg bg-muted" aria-hidden="true" />,
});

export { ScoreTrendChart, StudyTimeChart };
export { OutcomeBar } from "@/components/analytics/OutcomeBar";
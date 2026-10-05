"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Student dashboard failed to load.", error);
  }, [error]);

  return (
    <section
      role="alert"
      className="mx-auto max-w-2xl rounded-2xl border border-rose-400/20 bg-rose-400/5 p-6 text-center sm:p-8"
    >
      <h1 className="text-xl font-semibold text-white">Dashboard unavailable</h1>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        We couldn&apos;t load your learning data. Your progress has not been replaced with empty or zero values.
        Please try again.
      </p>
      {error.digest ? <p className="mt-3 text-xs text-slate-500">Reference: {error.digest}</p> : null}
      <button
        type="button"
        onClick={() => retry()}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-cyan-300 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        Try again
      </button>
    </section>
  );
}

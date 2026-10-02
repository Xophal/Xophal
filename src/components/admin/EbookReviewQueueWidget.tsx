"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

/**
 * Moderation-priority banner on the admin overview (§25): surfaces the live
 * pending-review count so reviewers see action items before anything else.
 */
export default function EbookReviewQueueWidget() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/ebooks?status=PENDING_REVIEW&limit=1", { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => {
        if (!cancelled && json.success) setCount(Number(json.data?.counts?.PENDING_REVIEW ?? 0));
      })
      .catch(() => {
        if (!cancelled) setCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (count === null) return null;

  return (
    <section
      className={`mt-6 flex flex-col gap-3 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
        count > 0 ? "border-amber-400/30 bg-amber-500/10" : "border-white/10 bg-white/5"
      }`}
      aria-label="eBook review queue"
    >
      <div className="flex items-center gap-3">
        <span className={`admin-stat-icon ${count > 0 ? "admin-stat-icon--amber" : ""}`} style={{ width: "2.5rem", height: "2.5rem" }}>
          <BookOpen className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-white">
            {count > 0 ? `${count} eBook${count === 1 ? "" : "s"} awaiting review` : "eBook review queue is clear"}
          </p>
          <p className="text-xs text-slate-400">
            {count > 0 ? "Seller submissions are waiting for a moderation decision." : "New seller submissions will appear here."}
          </p>
        </div>
      </div>
      <Link
        href="/admin/ebooks"
        className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
          count > 0
            ? "bg-xophol-orange text-xophol-ink hover:brightness-95"
            : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
        }`}
      >
        {count > 0 ? "Review pending eBooks" : "Open eBook management"}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  );
}

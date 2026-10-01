"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, BookOpen, Eye, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import EbookPayoutControls from "@/components/ebooks/EbookPayoutControls";

type EbookListing = {
  id: string;
  title: string;
  slug: string;
  cover_image_url: string;
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "SUSPENDED";
  price: number | string;
  currency: string;
  author_name: string;
  rejection_reason: string | null;
  view_count: number;
  created_at: string;
};

type Earnings = {
  sales_count: number | string;
  gross_sales: number | string;
  commission_total: number | string;
  seller_gross: number | string;
  payment_fees: number | string;
  tax_total: number | string;
  refunds_total: number | string;
  pending_amount: number | string;
  available_amount: number | string;
  paid_amount: number | string;
};

type DashboardData = {
  data: EbookListing[];
  pagination: { page: number; total: number; totalPages: number; hasMore: boolean };
  counts: Record<string, number>;
  sales: { transaction_count: number | string; gross_sales: number | string; xophol_commission: number | string; seller_earnings: number | string };
  earnings: Earnings;
  commissionPercent: number;
};

const emptyEarnings: Earnings = {
  sales_count: 0,
  gross_sales: 0,
  commission_total: 0,
  seller_gross: 0,
  payment_fees: 0,
  tax_total: 0,
  refunds_total: 0,
  pending_amount: 0,
  available_amount: 0,
  paid_amount: 0,
};

const statusLabels: Record<EbookListing["status"], string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending review",
  PUBLISHED: "Published",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

function money(value: number | string, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatStatus(status: EbookListing["status"]) {
  const styles: Record<EbookListing["status"], string> = {
    DRAFT: "border-border text-muted-foreground",
    PENDING_REVIEW: "border-amber-500/30 bg-amber-500/5 text-amber-700",
    PUBLISHED: "border-emerald-600/30 bg-emerald-600/5 text-emerald-700",
    REJECTED: "border-destructive/30 bg-destructive/5 text-destructive",
    SUSPENDED: "border-destructive/30 bg-destructive/5 text-destructive",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>{statusLabels[status]}</span>;
}

export default function EbookSellerDashboard() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/ebooks/mine?page=${page}&limit=20`, { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || "Could not load your eBooks.");
        return json.data as DashboardData;
      })
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load your eBooks.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page]);

  const earnings = result?.earnings ?? emptyEarnings;

  return (
    <main className="mx-auto max-w-6xl space-y-7">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />Dashboard
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-foreground">My eBooks</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your listings and review their marketplace status.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/ebooks/new"><Plus aria-hidden="true" />Add eBook</Link>
        </Button>
      </header>

      <section aria-label="Sales and earnings" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Gross sales", value: money(earnings.gross_sales) },
          { label: "Xophol commission", value: money(earnings.commission_total) },
          { label: "Seller gross before deductions", value: money(earnings.seller_gross) },
          { label: "Transactions", value: String(Number(earnings.sales_count) || 0) },
        ].map((metric) => (
          <div key={metric.label} className="rounded-md border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{metric.value}</p>
          </div>
        ))}
      </section>

      <dl className="grid gap-3 border-y border-border py-4 sm:grid-cols-3">
        <div><dt className="text-xs font-medium text-muted-foreground">Payment-provider fees</dt><dd className="mt-1 font-semibold text-foreground">{money(earnings.payment_fees)}</dd></div>
        <div><dt className="text-xs font-medium text-muted-foreground">Tax deductions</dt><dd className="mt-1 font-semibold text-foreground">{money(earnings.tax_total)}</dd></div>
        <div><dt className="text-xs font-medium text-muted-foreground">Refunded gross sales</dt><dd className="mt-1 font-semibold text-foreground">{money(earnings.refunds_total)}</dd></div>
      </dl>

      <section className="grid gap-3 border-y border-border py-5 sm:grid-cols-3" aria-label="Payout lifecycle">
        {[
          { label: "Pending during refund hold", value: money(earnings.pending_amount) },
          { label: "Available for transfer", value: money(earnings.available_amount) },
          { label: "Transferred to Razorpay account", value: money(earnings.paid_amount) },
        ].map((balance) => (
          <div key={balance.label}>
            <p className="text-xs font-medium text-muted-foreground">{balance.label}</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{balance.value}</p>
          </div>
        ))}
        <p className="text-xs leading-5 text-muted-foreground sm:col-span-3">
          Balances include captured payment fees and tax. Razorpay Route transfer fees are shown separately; a completed transfer may still be awaiting bank settlement.
        </p>
      </section>

      <EbookPayoutControls />

      <section>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Listings</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {result ? `${result.pagination.total} total · ${result.counts.PENDING_REVIEW ?? 0} awaiting review` : "Your drafts, submissions, and published books."}
            </p>
          </div>
          {result ? <span className="text-sm text-muted-foreground">Page {result.pagination.page} of {Math.max(1, result.pagination.totalPages)}</span> : null}
        </div>

        {error ? (
          <div role="alert" className="mt-4 flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}
          </div>
        ) : null}

        {loading ? <p role="status" className="mt-5 text-sm text-muted-foreground">Loading listings…</p> : null}

        {!loading && !error && result?.data.length === 0 ? (
          <div className="mt-5 border-y border-border py-10 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <h3 className="mt-3 font-semibold text-foreground">No eBooks listed yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Your first listing is free and will be reviewed before publication.</p>
            <Button asChild className="mt-4"><Link href="/dashboard/ebooks/new"><Plus aria-hidden="true" />Add your first eBook</Link></Button>
          </div>
        ) : null}

        {!loading && !error && result?.data.length ? (
          <div className="mt-4 divide-y divide-border border-y border-border">
            {result.data.map((book) => (
              <article key={book.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground">{book.title}</h3>
                    {formatStatus(book.status)}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {money(book.price, book.currency)} <span aria-hidden="true">·</span> {Number(book.view_count) || 0} views
                  </p>
                  {book.rejection_reason ? <p className="mt-2 text-sm text-destructive">Review note: {book.rejection_reason}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {book.status === "PUBLISHED" ? (
                    <Button asChild size="sm" variant="outline"><Link href={`/ebooks/${book.slug}`}><Eye aria-hidden="true" />View</Link></Button>
                  ) : null}
                  <Button asChild size="sm" variant="outline"><Link href={`/dashboard/ebooks/${book.id}/edit`}><Pencil aria-hidden="true" />Edit</Link></Button>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {result && result.pagination.totalPages > 1 ? (
          <nav className="mt-4 flex items-center justify-between" aria-label="Listing pages">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => { setError(""); setLoading(true); setPage((current) => current - 1); }}><ArrowLeft aria-hidden="true" />Previous</Button>
            <Button variant="outline" size="sm" disabled={!result.pagination.hasMore || loading} onClick={() => { setError(""); setLoading(true); setPage((current) => current + 1); }}>Next<ArrowRight aria-hidden="true" /></Button>
          </nav>
        ) : null}
      </section>
    </main>
  );
}
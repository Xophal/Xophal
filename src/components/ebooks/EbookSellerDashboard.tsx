"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, BookOpen, CopyPlus, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EbookListingStatus } from "@/lib/ebooks/status";

type EbookListing = {
  id: string;
  title: string | null;
  slug: string;
  cover_image_url: string | null;
  status: EbookListingStatus;
  price: number | string;
  currency: string;
  author_name: string;
  rejection_reason: string | null;
  seller_feedback?: string | null;
  view_count: number;
  created_at: string;
  published_at: string | null;
  ebook_categories?: { name: string } | { name: string }[] | null;
};

type DashboardData = {
  data: EbookListing[];
  pagination: { page: number; total: number; totalPages: number; hasMore: boolean };
  counts: Record<string, number>;
};

const statusLabels: Record<EbookListing["status"], string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending review",
  PUBLISHED: "Published",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
  NEEDS_CHANGES: "Changes requested",
  UNPUBLISHED: "Unpublished",
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
    NEEDS_CHANGES: "border-amber-500/30 bg-amber-500/5 text-amber-700",
    UNPUBLISHED: "border-border text-muted-foreground",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>{statusLabels[status]}</span>;
}

/** Statuses the API allows a seller to edit and resubmit. */
const EDITABLE_STATUSES: EbookListing["status"][] = ["DRAFT", "REJECTED", "NEEDS_CHANGES", "PUBLISHED"];

function editHint(status: EbookListing["status"]) {
  return status === "PENDING_REVIEW"
    ? "Editing is locked while this listing is under review."
    : "This listing is locked by Xophol Admin. Contact support to change it.";
}

export default function EbookSellerDashboard() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

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
  }, [page, refreshKey]);

  async function manageListing(book: EbookListing, action: "duplicate" | "delete") {
    if (action === "delete" && !window.confirm("Delete this draft? This cannot be undone.")) return;
    setBusyId(book.id);
    setError("");
    try {
      const response = await fetch(`/api/ebooks/mine/${book.id}`, { method: action === "duplicate" ? "POST" : "DELETE" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not update this listing.");
      setRefreshKey((current) => current + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not update this listing.");
    } finally {
      setBusyId(null);
    }
  }

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

      <section aria-label="Listing status overview" className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {[
          { label: "Total eBooks", value: result?.pagination.total ?? 0 },
          { label: "Published", value: result?.counts.PUBLISHED ?? 0 },
          { label: "Pending review", value: result?.counts.PENDING_REVIEW ?? 0 },
          { label: "Rejected", value: result?.counts.REJECTED ?? 0 },
          { label: "Drafts", value: result?.counts.DRAFT ?? 0 },
          { label: "Changes requested", value: result?.counts.NEEDS_CHANGES ?? 0 },
          { label: "Suspended", value: result?.counts.SUSPENDED ?? 0 },
          { label: "Unpublished", value: result?.counts.UNPUBLISHED ?? 0 },
        ].map((metric) => (
          <div key={metric.label} className="rounded-md border border-border bg-card p-3">
            <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{metric.value}</p>
          </div>
        ))}
      </section>

      <p className="border-y border-border py-3 text-sm text-muted-foreground">
        Sales &amp; earnings will be available after marketplace payments are enabled.
      </p>

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
              <article key={book.id} className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 py-4 sm:grid-cols-[48px_minmax(0,1fr)_auto] sm:items-center">
                {book.cover_image_url ? (
                  <Image src={book.cover_image_url} alt={`Cover of ${book.title || "untitled eBook"}`} width={48} height={64} className="h-16 w-12 rounded-sm border border-border object-cover" />
                ) : <div aria-hidden="true" className="h-16 w-12 border border-border bg-muted" />}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground">{book.title || "Untitled eBook"}</h3>
                    {formatStatus(book.status)}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {money(book.price, book.currency)} <span aria-hidden="true">·</span> {book.ebook_categories ? (Array.isArray(book.ebook_categories) ? book.ebook_categories[0]?.name ?? "Uncategorized" : book.ebook_categories.name) : "Uncategorized"}
                    {` · Created ${new Date(book.created_at).toLocaleDateString()}`}
                    {book.published_at ? ` · Published ${new Date(book.published_at).toLocaleDateString()}` : ""}
                  </p>
                  {book.rejection_reason ? <p className="mt-2 text-sm text-destructive">Review note: {book.rejection_reason}</p> : null}
                  {book.status === "NEEDS_CHANGES" && book.seller_feedback ? (
                    <p className="mt-2 text-sm text-amber-700">Changes requested by Xophol Admin: {book.seller_feedback}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {book.status === "PUBLISHED" ? (
                    <Button asChild size="sm" variant="outline"><Link href={`/ebooks/${book.slug}`}><Eye aria-hidden="true" />View</Link></Button>
                  ) : null}
                  {EDITABLE_STATUSES.includes(book.status) ? (
                    <Button asChild size="sm" variant="outline"><Link href={`/dashboard/ebooks/${book.id}/edit`}><Pencil aria-hidden="true" />{book.status === "NEEDS_CHANGES" || book.status === "REJECTED" ? "Fix and resubmit" : "Edit"}</Link></Button>
                  ) : (
                    <p className="text-xs text-muted-foreground sm:text-right">{editHint(book.status)}</p>
                  )}
                  {!(["PENDING_REVIEW", "SUSPENDED", "UNPUBLISHED"].includes(book.status)) ? (
                    <Button type="button" size="sm" variant="outline" disabled={busyId === book.id} onClick={() => void manageListing(book, "duplicate")} title="Duplicate as draft">
                      <CopyPlus aria-hidden="true" />Duplicate
                    </Button>
                  ) : null}
                  {book.status === "DRAFT" ? (
                    <Button type="button" size="sm" variant="outline" disabled={busyId === book.id} onClick={() => void manageListing(book, "delete")} title="Delete draft">
                      <Trash2 aria-hidden="true" />Delete
                    </Button>
                  ) : null}
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
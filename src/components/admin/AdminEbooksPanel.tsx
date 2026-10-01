"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Coins, Eye, Flag, LayoutGrid, Search, Settings2, Star } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AdminChip,
  AdminEmpty,
  AdminLoading,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  AdminPagination,
  AdminStat,
  AdminToolbar,
  readList,
  type AdminChipTone,
} from "@/components/admin/ui";
import { formatEbookPrice } from "@/components/ebooks/EbookCard";
import type { MarketplacePricingRules } from "@/lib/ebooks/pricing";

type Relation<T> = T | T[] | null | undefined;

type Listing = {
  id: string;
  title: string;
  slug: string;
  cover_image_url?: string | null;
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "SUSPENDED";
  price: number | string;
  currency: string;
  author_name?: string | null;
  is_featured?: boolean | null;
  rejection_reason?: string | null;
  admin_review_note?: string | null;
  view_count?: number | null;
  external_click_count?: number | null;
  submitted_at?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  ebook_categories?: Relation<{ name?: string | null; slug?: string | null }>;
  profiles?: Relation<{ full_name?: string | null; email?: string | null }>;
};

type Report = {
  id: string;
  reason: string;
  details: string;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";
  admin_note?: string | null;
  created_at: string;
  ebook_id: string;
  ebook_listings?: Relation<{ title?: string | null; slug?: string | null; status?: string | null }>;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean | null;
  sort_order?: number | null;
};

type Revenue = {
  transaction_count: number | string;
  gross_sales: number | string;
  xophol_commission: number | string;
  seller_earnings: number | string;
  refunds_total: number | string;
  net_marketplace_revenue: number | string;
  average_order_value: number | string;
} | null;

type Tab = "listings" | "reports" | "categories" | "settings";

const STATUS_TONES: Record<Listing["status"], AdminChipTone> = {
  DRAFT: "neutral",
  PENDING_REVIEW: "warning",
  PUBLISHED: "success",
  REJECTED: "danger",
  SUSPENDED: "violet",
};

const REPORT_TONES: Record<Report["status"], AdminChipTone> = {
  OPEN: "warning",
  IN_REVIEW: "info",
  RESOLVED: "success",
  DISMISSED: "neutral",
};

/** Supabase returns to-one relations as either an object or a single-item array. */
function one<T>(value: Relation<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function money(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

export default function AdminEbooksPanel() {
  const [tab, setTab] = useState<Tab>("listings");
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsTotal, setListingsTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [revenue, setRevenue] = useState<Revenue>(null);
  const [commissionPercent, setCommissionPercent] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const limit = 10;

  const [reports, setReports] = useState<Report[]>([]);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [reportCounts, setReportCounts] = useState<Record<string, number>>({});
  const [reportStatus, setReportStatus] = useState("OPEN");
  const [reportPage, setReportPage] = useState(1);

  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState({ name: "", description: "" });

  const [config, setConfig] = useState<MarketplacePricingRules | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tab !== "listings") return;
    void loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, status, query]);

  useEffect(() => {
    if (tab !== "reports") return;
    void loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, reportPage, reportStatus]);

  useEffect(() => {
    if (tab !== "categories") return;
    void loadCategories();
  }, [tab]);

  useEffect(() => {
    if (tab !== "settings") return;
    void loadConfig();
  }, [tab]);

  async function loadListings() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (status) params.set("status", status);
      if (query) params.set("q", query);
      const response = await fetch(`/api/admin/ebooks?${params.toString()}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Failed to load listings");
      setListings(json.data?.data ?? []);
      setListingsTotal(Number(json.data?.pagination?.total ?? 0));
      setCounts(json.data?.counts ?? {});
      setRevenue(json.data?.revenue ?? null);
      setCommissionPercent(Number(json.data?.commissionPercent ?? 0));
    } catch (error) {
      toast({ title: "Load failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function loadReports() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(reportPage), limit: String(limit) });
      if (reportStatus) params.set("status", reportStatus);
      const response = await fetch(`/api/admin/ebooks/reports?${params.toString()}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Failed to load reports");
      setReports(json.data?.data ?? []);
      setReportsTotal(Number(json.data?.pagination?.total ?? 0));
      setReportCounts(json.data?.counts ?? {});
    } catch (error) {
      toast({ title: "Load failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/ebooks/categories", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Failed to load categories");
      setCategories(readList<Category>(json).items);
    } catch (error) {
      toast({ title: "Load failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function loadConfig() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/ebooks/settings", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Failed to load marketplace settings");
      setConfig(json.data.config);
    } catch (error) {
      toast({ title: "Load failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  /** Moderation transitions are applied server-side; the UI only mirrors the response. */
  async function moderate(listing: Listing, action: "approve" | "reject" | "suspend" | "reinstate" | "feature" | "unfeature") {
    let reason: string | undefined;
    if (action === "reject" || action === "suspend") {
      const input = window.prompt(
        action === "reject"
          ? "Why is this listing being rejected? (shared with the seller)"
          : "Internal reason for suspending this listing"
      );
      if (!input || input.trim().length < 3) return;
      reason = input.trim();
    }
    setBusyId(listing.id);
    try {
      const response = await fetch(`/api/admin/ebooks/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Action failed");
      toast({ title: "Listing updated", description: `${listing.title} → ${json.data?.book?.status ?? action}` });
      await loadListings();
    } catch (error) {
      toast({ title: "Action failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function updateReport(report: Report, nextStatus: Report["status"]) {
    setBusyId(report.id);
    try {
      const response = await fetch(`/api/admin/ebooks/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not update the report");
      toast({ title: "Report updated", description: `Marked as ${nextStatus.replace("_", " ").toLowerCase()}.` });
      await loadReports();
    } catch (error) {
      toast({ title: "Update failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function createCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await fetch("/api/admin/ebooks/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategory.name.trim(), description: newCategory.description.trim() }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not create the category");
      setNewCategory({ name: "", description: "" });
      toast({ title: "Category created" });
      await loadCategories();
    } catch (error) {
      toast({ title: "Create failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  }

  async function toggleCategory(category: Category) {
    setBusyId(category.id);
    try {
      const response = await fetch(`/api/admin/ebooks/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !category.is_active }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not update the category");
      await loadCategories();
    } catch (error) {
      toast({ title: "Update failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function saveConfig(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config) return;
    setSavingConfig(true);
    try {
      const response = await fetch("/api/admin/ebooks/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not save marketplace settings");
      setConfig(json.data.config);
      toast({ title: "Settings saved", description: `Commission is now ${json.data.config.commissionPercent}% per sale.` });
    } catch (error) {
      toast({ title: "Save failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setSavingConfig(false);
    }
  }

  function patchConfig<K extends keyof MarketplacePricingRules>(key: K, value: MarketplacePricingRules[K]) {
    setConfig((current) => (current ? { ...current, [key]: value } : current));
  }

  const verifiedRevenue = useMemo(() => money(revenue?.net_marketplace_revenue), [revenue]);

  const tabs: { id: Tab; label: string; icon: typeof BookOpen }[] = [
    { id: "listings", label: "Listings", icon: LayoutGrid },
    { id: "reports", label: "Reports", icon: Flag },
    { id: "categories", label: "Categories", icon: BookOpen },
    { id: "settings", label: "Commission & rules", icon: Settings2 },
  ];

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Marketplace"
        title="eBook management"
        description="Review seller submissions, act on reader reports, curate categories and set the commission Xophol keeps on each verified sale."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat label="Awaiting review" value={counts.PENDING_REVIEW ?? 0} hint="Submitted and not yet published" icon={BookOpen} tone="amber" />
        <AdminStat label="Published" value={counts.PUBLISHED ?? 0} hint="Visible on the public marketplace" icon={Eye} tone="emerald" />
        <AdminStat
          label="Marketplace revenue"
          value={formatEbookPrice(verifiedRevenue, "INR")}
          hint={`Verified sales only · commission ${commissionPercent}%`}
          icon={Coins}
          tone="cyan"
        />
        <AdminStat
          label="Verified sales"
          value={revenue?.transaction_count ?? 0}
          hint={revenue ? `Gross ${formatEbookPrice(money(revenue.gross_sales), "INR")} · refunds ${formatEbookPrice(money(revenue.refunds_total), "INR")}` : "No settled transactions yet"}
          icon={Star}
          tone="violet"
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <Button key={id} type="button" size="sm" variant={tab === id ? "default" : "outline"} onClick={() => setTab(id)}>
            <Icon className="mr-2 h-4 w-4" aria-hidden />
            {label}
          </Button>
        ))}
      </div>

      <div className="mt-6 grid gap-6">
        {tab === "listings" ? (
          <AdminPanel eyebrow="Moderation queue" title="Listings" icon={LayoutGrid} flush>
            <div className="px-5 pt-5">
              <AdminToolbar>
                <select
                  value={status}
                  onChange={(event) => {
                    setPage(1);
                    setStatus(event.target.value);
                  }}
                  className="h-10 rounded-md border border-white/10 bg-slate-900/60 px-3 text-sm text-slate-200"
                  aria-label="Filter by status"
                >
                  <option value="">All statuses ({listingsTotal})</option>
                  {Object.entries(counts).map(([value, total]) => (
                    <option key={value} value={value}>
                      {value.replace("_", " ")} ({total})
                    </option>
                  ))}
                </select>
                <form
                  className="admin-toolbar-grow flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setPage(1);
                    setQuery(search.trim());
                  }}
                >
                  <Input placeholder="Search title or author" value={search} onChange={(event) => setSearch(event.target.value)} />
                  <Button type="submit" variant="outline" size="sm">
                    <Search className="h-4 w-4" aria-hidden /> Search
                  </Button>
                </form>
              </AdminToolbar>
            </div>

            <div className="admin-panel-body mt-4">
              {loading ? (
                <AdminLoading label="Loading listings…" />
              ) : listings.length === 0 ? (
                <AdminEmpty icon={BookOpen} title="No listings found" hint={query || status ? "Try a different filter or search." : "Seller submissions appear here for review."} />
              ) : (
                <>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Listing</th>
                          <th>Seller</th>
                          <th>Price</th>
                          <th>Engagement</th>
                          <th>Status</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listings.map((listing) => {
                          const category = one(listing.ebook_categories);
                          const seller = one(listing.profiles);
                          const busy = busyId === listing.id;
                          return (
                            <tr key={listing.id}>
                              <td>
                                <div className="flex items-center gap-3">
                                  {listing.cover_image_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={listing.cover_image_url} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
                                  ) : null}
                                  <div className="min-w-0">
                                    <p className="font-semibold text-white">
                                      {listing.title}
                                      {listing.is_featured ? (
                                        <AdminChip tone="info" className="ml-2">
                                          Featured
                                        </AdminChip>
                                      ) : null}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      /ebooks/{listing.slug}
                                      {category?.name ? ` · ${category.name}` : ""} · submitted {formatDate(listing.submitted_at ?? listing.created_at)}
                                    </p>
                                    {listing.rejection_reason ? <p className="text-xs text-rose-300">Rejected: {listing.rejection_reason}</p> : null}
                                  </div>
                                </div>
                              </td>
                              <td className="text-slate-400">{seller?.full_name || seller?.email || listing.author_name || "—"}</td>
                              <td className="text-slate-300">{formatEbookPrice(listing.price, listing.currency)}</td>
                              <td className="text-xs text-slate-400">
                                {listing.view_count ?? 0} views · {listing.external_click_count ?? 0} clicks
                              </td>
                              <td>
                                <AdminChip tone={STATUS_TONES[listing.status] ?? "neutral"}>{listing.status.replace("_", " ")}</AdminChip>
                              </td>
                              <td>
                                <div className="flex flex-wrap justify-end gap-2">
                                  {listing.status === "PENDING_REVIEW" || listing.status === "DRAFT" ? (
                                    <>
                                      <Button type="button" size="sm" disabled={busy} onClick={() => void moderate(listing, "approve")}>
                                        Approve
                                      </Button>
                                      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void moderate(listing, "reject")}>
                                        Reject
                                      </Button>
                                    </>
                                  ) : null}
                                  {listing.status === "PUBLISHED" ? (
                                    <>
                                      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void moderate(listing, listing.is_featured ? "unfeature" : "feature")}>
                                        {listing.is_featured ? "Unfeature" : "Feature"}
                                      </Button>
                                      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void moderate(listing, "suspend")}>
                                        Suspend
                                      </Button>
                                    </>
                                  ) : null}
                                  {listing.status === "SUSPENDED" || listing.status === "REJECTED" ? (
                                    <Button type="button" size="sm" disabled={busy} onClick={() => void moderate(listing, "reinstate")}>
                                      Reinstate
                                    </Button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <AdminPagination page={page} total={listingsTotal} limit={limit} onPage={setPage} busy={loading} />
                </>
              )}
            </div>
          </AdminPanel>
        ) : null}

        {tab === "reports" ? (
          <AdminPanel eyebrow="Moderation" title="Reader reports" icon={Flag} flush>
            <div className="px-5 pt-5">
              <AdminToolbar>
                <select
                  value={reportStatus}
                  onChange={(event) => {
                    setReportPage(1);
                    setReportStatus(event.target.value);
                  }}
                  className="h-10 rounded-md border border-white/10 bg-slate-900/60 px-3 text-sm text-slate-200"
                  aria-label="Filter reports by status"
                >
                  <option value="">All reports ({reportsTotal})</option>
                  {["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"].map((value) => (
                    <option key={value} value={value}>
                      {value.replace("_", " ")} ({reportCounts[value] ?? 0})
                    </option>
                  ))}
                </select>
                <Button type="button" size="sm" variant="outline" onClick={() => void loadReports()} disabled={loading}>
                  Refresh
                </Button>
              </AdminToolbar>
            </div>

            <div className="admin-panel-body mt-4">
              {loading ? (
                <AdminLoading label="Loading reports…" />
              ) : reports.length === 0 ? (
                <AdminEmpty icon={Flag} title="No reports" hint="Reader reports about listings will show up here." />
              ) : (
                <>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Report</th>
                          <th>Listing</th>
                          <th>Raised</th>
                          <th>Status</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reports.map((report) => {
                          const book = one(report.ebook_listings);
                          const busy = busyId === report.id;
                          return (
                            <tr key={report.id}>
                              <td>
                                <p className="font-semibold text-white">{report.reason.replace("_", " ")}</p>
                                <p className="max-w-md text-xs text-slate-400">{report.details}</p>
                              </td>
                              <td className="text-slate-400">{book?.title ?? "Removed listing"}</td>
                              <td className="text-xs text-slate-400">{formatDate(report.created_at)}</td>
                              <td>
                                <AdminChip tone={REPORT_TONES[report.status] ?? "neutral"}>{report.status.replace("_", " ")}</AdminChip>
                              </td>
                              <td>
                                <div className="flex flex-wrap justify-end gap-2">
                                  {report.status !== "IN_REVIEW" && report.status !== "RESOLVED" ? (
                                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void updateReport(report, "IN_REVIEW")}>
                                      Review
                                    </Button>
                                  ) : null}
                                  {report.status !== "RESOLVED" ? (
                                    <Button type="button" size="sm" disabled={busy} onClick={() => void updateReport(report, "RESOLVED")}>
                                      Resolve
                                    </Button>
                                  ) : null}
                                  {report.status !== "DISMISSED" ? (
                                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void updateReport(report, "DISMISSED")}>
                                      Dismiss
                                    </Button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <AdminPagination page={reportPage} total={reportsTotal} limit={limit} onPage={setReportPage} busy={loading} />
                </>
              )}
            </div>
          </AdminPanel>
        ) : null}

        {tab === "categories" ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
            <AdminPanel eyebrow="Catalogue" title="New category" icon={BookOpen}>
              <form onSubmit={createCategory} className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="ebook-category-name">Name</Label>
                  <Input
                    id="ebook-category-name"
                    required
                    minLength={2}
                    maxLength={120}
                    value={newCategory.name}
                    onChange={(event) => setNewCategory((current) => ({ ...current, name: event.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ebook-category-description">Description</Label>
                  <textarea
                    id="ebook-category-description"
                    rows={3}
                    maxLength={1000}
                    value={newCategory.description}
                    onChange={(event) => setNewCategory((current) => ({ ...current, description: event.target.value }))}
                    className="rounded-md border border-input bg-background p-3 text-sm"
                  />
                </div>
                <Button type="submit" disabled={newCategory.name.trim().length < 2}>
                  Create category
                </Button>
              </form>
            </AdminPanel>

            <AdminPanel eyebrow="Catalogue" title="Categories" icon={LayoutGrid} flush>
              <div className="admin-panel-body mt-4">
                {loading ? (
                  <AdminLoading label="Loading categories…" />
                ) : categories.length === 0 ? (
                  <AdminEmpty icon={BookOpen} title="No categories yet" hint="Create the first category so sellers can submit listings." />
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Slug</th>
                          <th>Status</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map((category) => (
                          <tr key={category.id}>
                            <td>
                              <p className="font-semibold text-white">{category.name}</p>
                              {category.description ? <p className="text-xs text-slate-500">{category.description}</p> : null}
                            </td>
                            <td className="text-xs text-slate-400">/ebooks/category/{category.slug}</td>
                            <td>
                              <AdminChip tone={category.is_active ? "success" : "neutral"}>{category.is_active ? "Active" : "Hidden"}</AdminChip>
                            </td>
                            <td>
                              <div className="flex justify-end">
                                <Button type="button" size="sm" variant="outline" disabled={busyId === category.id} onClick={() => void toggleCategory(category)}>
                                  {category.is_active ? "Hide" : "Activate"}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </AdminPanel>
          </div>
        ) : null}

        {tab === "settings" ? (
          <AdminPanel eyebrow="Commerce" title="Commission & pricing rules" icon={Settings2}>
            {loading || !config ? (
              <AdminLoading label="Loading marketplace settings…" />
            ) : (
              <form onSubmit={saveConfig} className="grid gap-6">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="ebook-commission">Xophol commission (%)</Label>
                    <Input
                      id="ebook-commission"
                      type="number"
                      min={0}
                      max={100}
                      step="0.5"
                      required
                      value={config.commissionPercent}
                      onChange={(event) => patchConfig("commissionPercent", Number(event.target.value))}
                    />
                    <p className="text-xs text-slate-500">Snapshot onto every order at checkout; existing orders keep their original percentage.</p>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="ebook-min-price">Minimum listing price</Label>
                    <Input
                      id="ebook-min-price"
                      type="number"
                      min={0}
                      step="1"
                      required
                      value={config.minPrice}
                      onChange={(event) => patchConfig("minPrice", Number(event.target.value))}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="ebook-max-price">Maximum listing price</Label>
                    <Input
                      id="ebook-max-price"
                      type="number"
                      min={0}
                      step="1"
                      required
                      value={config.maxPrice}
                      onChange={(event) => patchConfig("maxPrice", Number(event.target.value))}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="ebook-payment-fee">Payment-provider fee (% of gross)</Label>
                    <Input
                      id="ebook-payment-fee"
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      required
                      value={config.paymentFeePercent}
                      onChange={(event) => patchConfig("paymentFeePercent", Number(event.target.value))}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="ebook-tax">Tax withheld (% of gross)</Label>
                    <Input
                      id="ebook-tax"
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      required
                      value={config.taxPercent}
                      onChange={(event) => patchConfig("taxPercent", Number(event.target.value))}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="ebook-payout-hold">Refund/dispute hold (days)</Label>
                    <Input
                      id="ebook-payout-hold"
                      type="number"
                      min={0}
                      max={365}
                      step="1"
                      required
                      value={config.payoutHoldDays}
                      onChange={(event) => patchConfig("payoutHoldDays", Number(event.target.value))}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="ebook-currencies">Allowed currencies</Label>
                    <Input
                      id="ebook-currencies"
                      value={config.allowedCurrencies.join(", ")}
                      onChange={(event) =>
                        patchConfig(
                          "allowedCurrencies",
                          event.target.value
                            .split(",")
                            .map((code) => code.trim().toUpperCase())
                            .filter((code) => code.length === 3)
                        )
                      }
                      placeholder="INR"
                    />
                    <p className="text-xs text-slate-500">Comma-separated ISO codes. At least one currency is required.</p>
                  </div>
                  <label className="flex items-start gap-2 pt-6 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={config.allowFree}
                      onChange={(event) => patchConfig("allowFree", event.target.checked)}
                    />
                    <span>Allow free listings (price 0) alongside paid books.</span>
                  </label>
                </div>

                <div className="grid gap-3 border-t border-white/10 pt-5">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Suggested price ranges</p>
                      <p className="text-xs text-slate-500">Guidance only — shown to sellers while they price a listing. Sellers are never forced into these bands.</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => patchConfig("suggestedRanges", [...config.suggestedRanges, { label: "New range", min: 0, max: 0 }])}
                    >
                      Add range
                    </Button>
                  </div>
                  {config.suggestedRanges.length === 0 ? (
                    <p className="text-xs text-slate-500">No guidance bands configured.</p>
                  ) : (
                    <div className="grid gap-3">
                      {config.suggestedRanges.map((range, index) => (
                        <div key={`range-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_120px_auto] sm:items-end">
                          <div className="grid gap-1.5">
                            <Label htmlFor={`ebook-range-label-${index}`}>Label</Label>
                            <Input
                              id={`ebook-range-label-${index}`}
                              value={range.label}
                              onChange={(event) =>
                                patchConfig(
                                  "suggestedRanges",
                                  config.suggestedRanges.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, label: event.target.value } : item
                                  )
                                )
                              }
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`ebook-range-min-${index}`}>Min</Label>
                            <Input
                              id={`ebook-range-min-${index}`}
                              type="number"
                              min={0}
                              value={range.min}
                              onChange={(event) =>
                                patchConfig(
                                  "suggestedRanges",
                                  config.suggestedRanges.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, min: Number(event.target.value) } : item
                                  )
                                )
                              }
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`ebook-range-max-${index}`}>Max</Label>
                            <Input
                              id={`ebook-range-max-${index}`}
                              type="number"
                              min={0}
                              value={range.max}
                              onChange={(event) =>
                                patchConfig(
                                  "suggestedRanges",
                                  config.suggestedRanges.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, max: Number(event.target.value) } : item
                                  )
                                )
                              }
                            />
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => patchConfig("suggestedRanges", config.suggestedRanges.filter((_, itemIndex) => itemIndex !== index))}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 border-t border-white/10 pt-5">
                  <Button type="submit" disabled={savingConfig || config.allowedCurrencies.length === 0}>
                    {savingConfig ? "Saving…" : "Save settings"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void loadConfig()} disabled={savingConfig}>
                    Reload saved values
                  </Button>
                </div>

              </form>
            )}
          </AdminPanel>
        ) : null}




      </div>
    </AdminPage>
  );
}

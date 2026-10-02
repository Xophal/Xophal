"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Flag,
  FileEdit,
  History,
  Image as ImageIcon,
  Link2,
  ScrollText,
  ShieldCheck,
  User,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import {
  AdminChip,
  AdminEmpty,
  AdminLoading,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  type AdminChipTone,
} from "@/components/admin/ui";
import { formatEbookPrice } from "@/components/ebooks/EbookCard";
import { REJECTION_REASONS, type EbookStatus, type ModerationAction } from "@/lib/ebooks/moderation";

type Relation<T> = T | T[] | null | undefined;

type Book = {
  id: string;
  title: string;
  slug: string;
  cover_image_url?: string | null;
  short_description?: string | null;
  full_description?: string | null;
  author_name?: string | null;
  language?: string | null;
  page_count?: number | null;
  price: number | string;
  currency: string;
  publication_date?: string | null;
  status: EbookStatus;
  external_product_url?: string | null;
  preview_url?: string | null;
  subject?: string | null;
  exam?: string | null;
  rights_confirmed?: boolean | null;
  rights_confirmed_at?: string | null;
  rejection_reason?: string | null;
  seller_feedback?: string | null;
  admin_review_note?: string | null;
  submitted_at?: string | null;
  published_at?: string | null;
  reviewed_at?: string | null;
  is_featured?: boolean | null;
  user_id?: string | null;
  ebook_categories?: Relation<{ name?: string | null }>;
  profiles?: Relation<{ full_name?: string | null }>;
};

type HistoryRow = {
  id: string;
  previous_status?: string | null;
  new_status?: string | null;
  action: string;
  reason?: string | null;
  note?: string | null;
  created_at: string;
  profiles?: Relation<{ full_name?: string | null }>;
};

type ReportRow = {
  id: string;
  reason: string;
  details: string;
  status: string;
  admin_note?: string | null;
  created_at: string;
};

type Payload = {
  book: Book;
  history: HistoryRow[];
  reports: ReportRow[];
  sellerStats: { previousApproved: number; previousRejected: number };
};

type PendingDialog = {
  action: ModerationAction;
  heading: string;
  body: string;
  /** Free-text message required from the reviewer (suspend / request changes). */
  requireReason?: boolean;
  reasonLabel?: string;
  /** Predefined rejection reason select (spec §11). */
  requireReasonCode?: boolean;
};

const STATUS_TONES: Record<EbookStatus, AdminChipTone> = {
  DRAFT: "neutral",
  PENDING_REVIEW: "warning",
  PUBLISHED: "success",
  REJECTED: "danger",
  SUSPENDED: "violet",
  NEEDS_CHANGES: "info",
  UNPUBLISHED: "neutral",
};

const ACTION_TITLES: Record<string, string> = {
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CHANGES_REQUESTED: "Changes requested",
  SUSPENDED: "Suspended",
  UNPUBLISHED: "Unpublished",
  RESTORED: "Restored",
  FEATURED: "Featured",
  UNFEATURED: "Unfeatured",
  NOTE: "Internal note",
  SUBMITTED: "Submitted",
  RESUBMITTED: "Resubmitted",
};

function one<T>(value: Relation<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatDate(value?: string | null, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return withTime ? date.toLocaleString() : date.toLocaleDateString();
}

export default function AdminEbookReview({ ebookId }: { ebookId: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<PendingDialog | null>(null);
  const [reasonCode, setReasonCode] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [internalNote, setInternalNote] = useState("");

  const fetchPayload = useCallback(async () => {
    const response = await fetch(`/api/admin/ebooks/${ebookId}`, { cache: "no-store" });
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.error || "Failed to load the listing");
    return json.data as Payload;
  }, [ebookId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPayload();
        if (!cancelled) setPayload(data);
      } catch (error) {
        if (!cancelled) {
          toast({ title: "Load failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPayload]);

  /** Manual reload used after a moderation action. */
  const load = useCallback(async () => {
    try {
      setPayload(await fetchPayload());
    } catch (error) {
      toast({ title: "Load failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  }, [fetchPayload]);

  function openDialog(config: PendingDialog) {
    setReasonCode("");
    setReason("");
    setNote("");
    setDialog(config);
  }

  /** Applies a moderation action through the shared PATCH endpoint (§10). */
  async function act(action: ModerationAction, fields: { reason?: string; reasonCode?: string; note?: string } = {}) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/ebooks/${ebookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...fields }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Action failed");
      toast({
        title: "Moderation applied",
        description: `${payload?.book.title ?? "Listing"} → ${String(json.data?.book?.status ?? action).replace("_", " ")}`,
      });
      setDialog(null);
      await load();
    } catch (error) {
      toast({ title: "Action failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  function confirmDialog() {
    if (!dialog) return;
    const trimmedReason = reason.trim();
    if (dialog.requireReason && trimmedReason.length < 3) {
      toast({ title: "Reason required", description: "Provide a short explanation for the seller.", variant: "destructive" });
      return;
    }
    if (dialog.requireReasonCode && !reasonCode) {
      toast({ title: "Reason required", description: "Select a rejection reason.", variant: "destructive" });
      return;
    }
    if (dialog.requireReasonCode && reasonCode === "Other" && trimmedReason.length < 3) {
      toast({ title: "Details required", description: 'Describe the issue when using the "Other" reason.', variant: "destructive" });
      return;
    }
    void act(dialog.action, {
      reason: trimmedReason || undefined,
      reasonCode: dialog.requireReasonCode ? reasonCode : undefined,
      note: note.trim() || undefined,
    });
  }

  async function addInternalNote() {
    if (internalNote.trim().length < 3) return;
    await act("note", { note: internalNote.trim() });
    setInternalNote("");
  }

  if (loading) {
    return (
      <AdminPage>
        <AdminLoading label="Loading listing…" />
      </AdminPage>
    );
  }

  if (!payload) {
    return (
      <AdminPage>
        <AdminPageHeader eyebrow="Marketplace" title="Listing not found" description="This eBook may have been removed." />
        <div className="mt-6">
          <AdminEmpty
            icon={BookOpen}
            title="Listing not found"
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/ebooks">Back to eBooks</Link>
              </Button>
            }
          />
        </div>
      </AdminPage>
    );
  }

  const { book, history, reports, sellerStats } = payload;
  const category = one(book.ebook_categories);
  const seller = one(book.profiles);
  const status = book.status;
  const canReview = status === "PENDING_REVIEW";
  const canPublishActions = status === "PUBLISHED";
  const canRestore = status === "SUSPENDED" || status === "UNPUBLISHED";
  const rightsOk = Boolean(book.rights_confirmed);

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Marketplace · Review"
        title={book.title}
        description={`Submitted ${formatDate(book.submitted_at)} · last reviewed ${formatDate(book.reviewed_at, true)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminChip tone={STATUS_TONES[status] ?? "neutral"}>{status.replace("_", " ")}</AdminChip>
            {book.is_featured ? <AdminChip tone="info">Featured</AdminChip> : null}
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/ebooks">
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden /> Back
              </Link>
            </Button>
          </div>
        }
      />

      {/* Action bar (§10, §23: every decision goes through a confirmation dialog) */}
      <div className="mt-6">
        <AdminPanel eyebrow="Decision" title="Moderation actions" icon={ShieldCheck}>
          <div className="flex flex-wrap gap-3">
            {canReview ? (
              <>
                <Button
                  type="button"
                  disabled={busy || !rightsOk}
                  onClick={() =>
                    openDialog({
                      action: "approve",
                      heading: "Publish this eBook?",
                      body: "Are you sure you want to publish this eBook? It will become publicly visible on Xophol immediately.",
                    })
                  }
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden /> Approve
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    openDialog({
                      action: "reject",
                      heading: "Reject this eBook?",
                      body: "Please provide a reason for rejection. The seller sees the reason and your optional note.",
                      requireReasonCode: true,
                      reasonLabel: "Additional admin note (optional)",
                    })
                  }
                >
                  Reject
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    openDialog({
                      action: "request_changes",
                      heading: "Request changes?",
                      body: "The seller edits the listing and resubmits; it then returns to Pending Review.",
                      requireReason: true,
                      reasonLabel: "Message to the seller",
                    })
                  }
                >
                  <FileEdit className="mr-2 h-4 w-4" aria-hidden /> Request changes
                </Button>
              </>
            ) : null}

            {canPublishActions ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    openDialog({
                      action: "suspend",
                      heading: "Suspend this eBook?",
                      body: "Are you sure you want to suspend this eBook? It disappears from public discovery until restored.",
                      requireReason: true,
                      reasonLabel: "Internal reason (also shared with the seller)",
                    })
                  }
                >
                  Suspend
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    openDialog({
                      action: "unpublish",
                      heading: "Unpublish this eBook?",
                      body: "Are you sure you want to remove this eBook from public discovery?",
                    })
                  }
                >
                  Unpublish
                </Button>
              </>
            ) : null}

            {canRestore ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  openDialog({
                    action: "reinstate",
                    heading: "Restore this eBook?",
                    body: "Make this listing publicly available on Xophol again?",
                  })
                }
              >
                Restore
              </Button>
            ) : null}

            {!canReview && !canPublishActions && !canRestore ? (
              <p className="text-sm text-slate-400">
                No actions available while the listing is {status.replace("_", " ").toLowerCase()} — the seller must act.
              </p>
            ) : null}

            {canReview && !rightsOk ? (
              <p className="w-full text-sm text-amber-300">
                Approval is blocked: the copyright declaration is missing (§9).
              </p>
            ) : null}
          </div>
        </AdminPanel>
      </div>

      {/* Full listing (§6) */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminPanel eyebrow="Listing" title="Book information" icon={BookOpen}>
          <div className="flex flex-col gap-5 sm:flex-row">
            {book.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={book.cover_image_url} alt={`Cover of ${book.title}`} className="h-56 w-40 shrink-0 rounded-lg object-cover shadow-lg" />
            ) : (
              <span className="flex h-56 w-40 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-500">
                <ImageIcon className="h-8 w-8" aria-hidden />
              </span>
            )}
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="admin-eyebrow">Title</p>
                <p className="text-lg font-semibold text-white">{book.title}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="admin-eyebrow">Author</p>
                  <p className="text-sm text-slate-200">{book.author_name || "—"}</p>
                </div>
                <div>
                  <p className="admin-eyebrow">Category</p>
                  <p className="text-sm text-slate-200">{category?.name || "—"}</p>
                </div>
                <div>
                  <p className="admin-eyebrow">Exam</p>
                  <p className="text-sm text-slate-200">{book.exam || "—"}</p>
                </div>
                <div>
                  <p className="admin-eyebrow">Subject</p>
                  <p className="text-sm text-slate-200">{book.subject || "—"}</p>
                </div>
                <div>
                  <p className="admin-eyebrow">Language</p>
                  <p className="text-sm text-slate-200">{book.language || "—"}</p>
                </div>
                <div>
                  <p className="admin-eyebrow">Pages</p>
                  <p className="text-sm text-slate-200">{book.page_count ?? "—"}</p>
                </div>
                <div>
                  <p className="admin-eyebrow">Price</p>
                  <p className="text-sm text-slate-200">{formatEbookPrice(book.price, book.currency)}</p>
                </div>
                <div>
                  <p className="admin-eyebrow">Publication date</p>
                  <p className="text-sm text-slate-200">{formatDate(book.publication_date)}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
            <div>
              <p className="admin-eyebrow">Short description</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">{book.short_description || "—"}</p>
            </div>
            <div>
              <p className="admin-eyebrow">Full description</p>
              <p className="mt-1 max-h-56 overflow-y-auto whitespace-pre-line text-sm leading-6 text-slate-300">{book.full_description || "—"}</p>
            </div>
          </div>
        </AdminPanel>

        <div className="space-y-6">
          {/* External destination + preview (§7, §8) */}
          <AdminPanel eyebrow="Destinations" title="External links" icon={Link2}>
            <div className="space-y-4">
              <div>
                <p className="admin-eyebrow">External URL</p>
                {book.external_product_url ? (
                  <>
                    <p className="mt-1 break-all rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">{book.external_product_url}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button asChild size="sm" variant="outline">
                        <a href={book.external_product_url} target="_blank" rel="noopener noreferrer nofollow">
                          <ExternalLink className="mr-2 h-4 w-4" aria-hidden /> Open URL
                        </a>
                      </Button>
                      <span className="text-xs text-slate-500">Inspect the destination before approving.</span>
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-slate-400">No external URL provided</p>
                )}
              </div>
              <div className="border-t border-white/10 pt-4">
                <p className="admin-eyebrow">Preview</p>
                {book.preview_url ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <AdminChip tone="success">Preview available</AdminChip>
                    <Button asChild size="sm" variant="outline">
                      <a href={book.preview_url} target="_blank" rel="noopener noreferrer nofollow">
                        <ExternalLink className="mr-2 h-4 w-4" aria-hidden /> Open preview
                      </a>
                    </Button>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-slate-400">No preview provided</p>
                )}
              </div>
            </div>
          </AdminPanel>

          {/* Copyright declaration (§9) */}
          <AdminPanel eyebrow="Rights" title="Copyright declaration" icon={ScrollText}>
            <div className="space-y-3">
              <p className="text-sm italic leading-6 text-slate-300">
                &laquo;I confirm that I own this content or have the necessary rights and permission to sell or distribute this eBook.&raquo;
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <AdminChip tone={rightsOk ? "success" : "danger"}>{rightsOk ? "Confirmed" : "Missing"}</AdminChip>
                <span className="text-xs text-slate-400">Confirmed on {formatDate(book.rights_confirmed_at)}</span>
              </div>
              {!rightsOk ? <p className="text-xs text-amber-300">Approval is blocked until the declaration is present.</p> : null}
            </div>
          </AdminPanel>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {/* Seller context (§6: minimum information necessary for moderation) */}
        <AdminPanel eyebrow="People" title="Seller" icon={User}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="admin-eyebrow">Seller name</p>
              <p className="text-sm text-slate-200">{seller?.full_name || "—"}</p>
            </div>
            <div>
              <p className="admin-eyebrow">Author profile</p>
              <p className="text-sm text-slate-200">{book.author_name || "—"}</p>
            </div>
            <div>
              <p className="admin-eyebrow">Seller ID</p>
              <p className="font-mono text-xs text-slate-300">{(book.user_id ?? "—").slice(0, 8)}</p>
            </div>
            <div>
              <p className="admin-eyebrow">Submission date</p>
              <p className="text-sm text-slate-200">{formatDate(book.submitted_at, true)}</p>
            </div>
            <div>
              <p className="admin-eyebrow">Previously approved eBooks</p>
              <p className="text-sm font-semibold text-emerald-300">{sellerStats.previousApproved}</p>
            </div>
            <div>
              <p className="admin-eyebrow">Previously rejected eBooks</p>
              <p className="text-sm font-semibold text-rose-300">{sellerStats.previousRejected}</p>
            </div>
          </div>
          {book.rejection_reason || book.seller_feedback ? (
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="admin-eyebrow">Current seller-facing feedback</p>
              <p className="mt-1 text-sm text-slate-300">{book.seller_feedback || book.rejection_reason}</p>
            </div>
          ) : null}
        </AdminPanel>

        {/* Reader reports for this listing (§27, §28) */}
        <AdminPanel eyebrow="Trust & safety" title={`Reader reports (${reports.length})`} icon={Flag}>
          {reports.length === 0 ? (
            <AdminEmpty icon={Flag} title="No reports" hint="Readers have not reported this eBook." />
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div key={report.id} className="admin-row">
                  <div className="min-w-0">
                    <p className="admin-row-title capitalize">{report.reason.replace("_", " ")}</p>
                    <p className="admin-row-meta">{report.details}</p>
                    <p className="mt-1 text-xs text-slate-500">Reported {formatDate(report.created_at, true)}</p>
                  </div>
                  <AdminChip
                    tone={report.status === "OPEN" ? "warning" : report.status === "RESOLVED" ? "success" : report.status === "IN_REVIEW" ? "info" : "neutral"}
                  >
                    {report.status.replace("_", " ")}
                  </AdminChip>
                </div>
              ))}
            </div>
          )}
        </AdminPanel>
      </div>

      {/* Audit trail (§13, §14, §30) */}
      <div className="mt-6">
        <AdminPanel eyebrow="Audit" title="Moderation history" icon={History}>
          {history.length === 0 ? (
            <AdminEmpty icon={History} title="No moderation events yet" hint="Every decision and internal note is recorded here." />
          ) : (
            <div className="space-y-3">
              {history.map((row) => {
                const admin = one(row.profiles);
                const isNote = row.action === "NOTE";
                return (
                  <div key={row.id} className="admin-row">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="admin-stat-icon" style={{ width: "2.4rem", height: "2.4rem" }}>
                        {isNote ? <FileEdit className="h-4 w-4" aria-hidden /> : <History className="h-4 w-4" aria-hidden />}
                      </span>
                      <div className="min-w-0">
                        <p className="admin-row-title">
                          {ACTION_TITLES[row.action] ?? row.action}
                          {row.previous_status && row.new_status && row.previous_status !== row.new_status ? (
                            <span className="ml-2 font-normal text-slate-400">
                              {row.previous_status.replace("_", " ")} → {row.new_status.replace("_", " ")}
                            </span>
                          ) : null}
                        </p>
                        {row.reason ? <p className="admin-row-meta">Reason: {row.reason}</p> : null}
                        {row.note ? <p className="admin-row-meta italic">Note: {row.note}</p> : null}
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDate(row.created_at, true)}
                          {admin?.full_name ? ` · ${admin.full_name}` : ""}
                        </p>
                      </div>
                    </div>
                    <AdminChip tone={isNote ? "info" : "neutral"}>{isNote ? "Internal" : "Decision"}</AdminChip>
                  </div>
                );
              })}
            </div>
          )}

          {/* Internal notes are admin-only: sellers never receive these rows (§14). */}
          <div className="mt-5 border-t border-white/10 pt-4">
            <Label htmlFor="admin-internal-note">Add internal note</Label>
            <Textarea
              id="admin-internal-note"
              value={internalNote}
              onChange={(event) => setInternalNote(event.target.value)}
              placeholder="Checked copyright declaration. External URL verified. Seller contacted…"
              className="mt-2"
              rows={2}
            />
            <Button type="button" size="sm" variant="outline" className="mt-2" disabled={busy || internalNote.trim().length < 3} onClick={() => void addInternalNote()}>
              Save note
            </Button>
          </div>
        </AdminPanel>
      </div>

      {/* Confirmation dialog (§23): approve / reject / suspend / unpublish / restore */}
      <Dialog open={Boolean(dialog)} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        <DialogContent className="border-white/10 bg-slate-950/95 text-slate-100 sm:max-w-lg">
          <DialogHeader>
            <p className="admin-eyebrow">Confirm action</p>
            <h2 className="text-lg font-semibold text-white">{dialog?.heading}</h2>
            <p className="text-sm leading-6 text-slate-400">{dialog?.body}</p>
          </DialogHeader>

          <div className="space-y-4">
            {dialog?.requireReasonCode ? (
              <div className="space-y-1.5">
                <Label htmlFor="rejection-reason-code">Rejection reason (required)</Label>
                <select
                  id="rejection-reason-code"
                  value={reasonCode}
                  onChange={(event) => setReasonCode(event.target.value)}
                  className="h-10 w-full rounded-md border border-white/10 bg-slate-900/60 px-3 text-sm text-slate-200"
                >
                  <option value="">Select a reason…</option>
                  {REJECTION_REASONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {dialog?.requireReason || dialog?.requireReasonCode ? (
              <div className="space-y-1.5">
                <Label htmlFor="action-reason">
                  {dialog.reasonLabel ?? (dialog.requireReasonCode ? "Additional admin note (optional)" : "Reason (required)")}
                </Label>
                <Textarea
                  id="action-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  placeholder={dialog.requireReasonCode ? "Explain what the seller should fix…" : "Explain this decision…"}
                />
              </div>
            ) : null}

            {!dialog?.requireReason && !dialog?.requireReasonCode ? (
              <div className="space-y-1.5">
                <Label htmlFor="action-note">Admin note (optional, internal)</Label>
                <Textarea id="action-note" value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Recorded in the audit trail only." />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="action-internal-note">Admin note (optional, internal)</Label>
                <Textarea id="action-internal-note" value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Recorded in the audit trail only." />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 border-t border-white/10 pt-4">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={confirmDialog}>
              {busy ? "Working…" : dialog?.heading?.replace("?", "") ?? "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}


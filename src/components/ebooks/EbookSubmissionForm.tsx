"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import type { MarketplacePricingRules } from "@/lib/ebooks/pricing";
import { clientErrorMessage, readApiData } from "@/lib/client-api";

type FormOptions = {
  categories: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  exams: { id: string; name: string }[];
  config: MarketplacePricingRules;
};

type ExistingBook = {
  id: string;
  title: string | null;
  author_name: string | null;
  short_description: string | null;
  full_description: string | null;
  category_id: string | null;
  subject_id?: string | null;
  exam_id?: string | null;
  language: string | null;
  page_count?: number | null;
  price: number;
  currency: string;
  cover_image_url: string | null;
  external_product_url: string | null;
  preview_url?: string | null;
  publication_date?: string | null;
  contributor_bio?: string | null;
  contributor_expertise?: string[] | null;
  contributor_qualification?: string | null;
  contributor_teaching_experience?: string | null;
  contributor_profile_image_url?: string | null;
  contributor_website_url?: string | null;
  contributor_location?: string | null;
  contributor_social_links?: Record<string, string> | null;
  status?: string | null;
  seller_feedback?: string | null;
  rejection_reason?: string | null;
};

const blank = {
  title: "",
  authorName: "",
  shortDescription: "",
  fullDescription: "",
  categoryId: "",
  subjectId: "",
  examId: "",
  language: "English",
  pageCount: "",
  price: "",
  currency: "INR",
  coverImageUrl: "",
  externalProductUrl: "",
  previewUrl: "",
  publicationDate: "",
  contributorBio: "",
  contributorExpertise: "",
  contributorQualification: "",
  contributorTeachingExperience: "",
  contributorProfileImageUrl: "",
  contributorWebsiteUrl: "",
  contributorLocation: "",
  contributorSocialLinks: "",
  rightsConfirmed: false,
};

/**
 * Free listing submission for sellers. The cover is uploaded through the
 * managed endpoint first; sellers may save partial drafts before review.
 */
export default function EbookSubmissionForm({ listingId }: { listingId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState(blank);
  const [data, setData] = useState<FormOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [listingStatus, setListingStatus] = useState<string | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState<{ status: "NEEDS_CHANGES" | "REJECTED"; message: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [formResponse, bookResponse] = await Promise.all([
          fetch("/api/ebooks/form-data", { cache: "no-store" }),
          listingId ? fetch(`/api/ebooks/mine/${listingId}`, { cache: "no-store" }) : Promise.resolve(null),
        ]);
        const formJson = await formResponse.json();
        if (!formResponse.ok || !formJson.success) throw new Error(formJson.error || "Could not load form options.");
        if (!cancelled) setData(formJson.data);

        if (bookResponse?.ok) {
          const bookJson = await bookResponse.json();
          const book: ExistingBook | undefined = bookJson?.data?.book;
          if (book && !cancelled) {
            setListingStatus(book.status ?? null);
            // Surface the moderator's requested changes so the seller knows what to fix.
            if (book.status === "NEEDS_CHANGES" || book.status === "REJECTED") {
              setReviewFeedback({ status: book.status, message: book.seller_feedback || book.rejection_reason || "" });
            }
            setForm({
              title: book.title ?? "",
              authorName: book.author_name ?? "",
              shortDescription: book.short_description ?? "",
              fullDescription: book.full_description ?? "",
              categoryId: book.category_id ?? "",
              subjectId: book.subject_id ?? "",
              examId: book.exam_id ?? "",
              language: book.language ?? "",
              pageCount: book.page_count ? String(book.page_count) : "",
              price: String(book.price),
              currency: book.currency || "INR",
              coverImageUrl: book.cover_image_url ?? "",
              externalProductUrl: book.external_product_url ?? "",
              previewUrl: book.preview_url ?? "",
              publicationDate: book.publication_date ? String(book.publication_date).slice(0, 10) : "",
              contributorBio: book.contributor_bio ?? "",
              contributorExpertise: (book.contributor_expertise ?? []).join(", "),
              contributorQualification: book.contributor_qualification ?? "",
              contributorTeachingExperience: book.contributor_teaching_experience ?? "",
              contributorProfileImageUrl: book.contributor_profile_image_url ?? "",
              contributorWebsiteUrl: book.contributor_website_url ?? "",
              contributorLocation: book.contributor_location ?? "",
              contributorSocialLinks: Object.entries(book.contributor_social_links ?? {}).map(([key, value]) => `${key}=${value}`).join("\n"),
              rightsConfirmed: false,
            });
          }
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load the form.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  function update<K extends keyof typeof blank>(key: K, value: (typeof blank)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const listingLocked = ["PENDING_REVIEW", "SUSPENDED", "UNPUBLISHED"].includes(listingStatus ?? "");
  const canSaveDraft = !listingId || ["DRAFT", "REJECTED", "NEEDS_CHANGES"].includes(listingStatus ?? "");

  async function uploadCover(file: File) {
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/ebooks/cover", { method: "POST", body });
      const result = await readApiData<{ coverImageUrl: string }>(response, "Cover upload failed.");
      update("coverImageUrl", result.coverImageUrl);
      toast({ title: "Cover uploaded", description: "Your cover image is ready for the listing." });
    } catch (uploadError) {
      setError(clientErrorMessage(uploadError, "Cover upload failed."));
    } finally {
      setUploading(false);
    }
  }

  /**
   * Persists the listing. `/api/ebooks/mine` expects `{ action, payload }`:
   * `submit` validates against the full submission schema and queues the book
   * for review (clearing any previous seller feedback), while `save_draft`
   * keeps it private to the seller.
   */
  async function save(action: "save_draft" | "submit") {
    setSaving(true);
    setError("");
    try {
      const payload = {
        title: form.title.trim(),
        authorName: form.authorName.trim(),
        shortDescription: form.shortDescription.trim(),
        fullDescription: form.fullDescription.trim(),
        categoryId: form.categoryId,
        subjectId: form.subjectId || undefined,
        examId: form.examId || undefined,
        language: form.language.trim(),
        pageCount: form.pageCount ? Number(form.pageCount) : undefined,
        price: Number(form.price) || 0,
        currency: form.currency,
        coverImageUrl: form.coverImageUrl,
        externalProductUrl: form.externalProductUrl.trim(),
        previewUrl: form.previewUrl.trim(),
        publicationDate: form.publicationDate,
        contributorBio: form.contributorBio.trim(),
        contributorExpertise: form.contributorExpertise.split(",").map((item) => item.trim()).filter(Boolean),
        contributorQualification: form.contributorQualification.trim(),
        contributorTeachingExperience: form.contributorTeachingExperience.trim(),
        contributorProfileImageUrl: form.contributorProfileImageUrl.trim(),
        contributorWebsiteUrl: form.contributorWebsiteUrl.trim(),
        contributorLocation: form.contributorLocation.trim(),
        contributorSocialLinks: Object.fromEntries(form.contributorSocialLinks.split("\n").map((line) => {
          const separator = line.indexOf("=");
          return separator > 0 ? [line.slice(0, separator).trim(), line.slice(separator + 1).trim()] : ["", ""];
        }).filter(([key, value]) => key && value)),
        rightsConfirmed: form.rightsConfirmed,
      };
      const response = await fetch(listingId ? `/api/ebooks/mine/${listingId}` : "/api/ebooks/mine", {
        method: listingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      await readApiData<{ listing: { id: string } }>(response, "Could not save this listing.");
      toast({
        title: action === "submit" ? (listingId ? "Listing resubmitted" : "Listing submitted") : "Draft saved",
        description: action === "submit"
          ? "Your book is queued for admin review."
          : "This draft stays private until you submit it for review.",
      });
      router.push("/dashboard/ebooks");
      router.refresh();
    } catch (submitError) {
      setError(clientErrorMessage(submitError, "Could not save this listing."));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading form…
      </p>
    );
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void save("submit"); }} className="grid gap-6 rounded-lg border border-border bg-card p-5 sm:p-6">
      {listingLocked ? (
        <p role="status" className="border-y border-border py-3 text-sm text-muted-foreground">
          {listingStatus === "PENDING_REVIEW" ? "This eBook is under review. Editing is locked until the review is complete." : "This listing is locked by Xophol Admin."}
        </p>
      ) : null}
      {reviewFeedback ? (
        <div
          role="status"
          className={`rounded-md border p-4 text-sm ${reviewFeedback.status === "NEEDS_CHANGES" ? "border-amber-500/30 bg-amber-500/5 text-amber-700" : "border-destructive/30 bg-destructive/5 text-destructive"}`}
        >
          <p className="font-semibold">
            {reviewFeedback.status === "NEEDS_CHANGES" ? "Changes requested by Xophol Admin" : "This listing was rejected"}
          </p>
          {reviewFeedback.message ? <p className="mt-1">{reviewFeedback.message}</p> : null}
          <p className="mt-1 text-xs">Update the details below, then choose &ldquo;Save and resubmit&rdquo; to send it back for review.</p>
        </div>
      ) : null}
      <fieldset className="grid gap-4 sm:grid-cols-2" disabled={saving || uploading || listingLocked}>
        <legend className="text-sm font-bold uppercase text-primary">Book details</legend>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="ebook-title">Title</Label>
          <Input id="ebook-title" required minLength={3} maxLength={240} value={form.title} onChange={(event) => update("title", event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ebook-author">Author / pen name</Label>
          <Input id="ebook-author" required minLength={2} maxLength={160} value={form.authorName} onChange={(event) => update("authorName", event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ebook-language">Language</Label>
          <Input id="ebook-language" required minLength={2} maxLength={80} value={form.language} onChange={(event) => update("language", event.target.value)} />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="ebook-short">Short description</Label>
          <textarea id="ebook-short" required minLength={20} maxLength={500} rows={2} value={form.shortDescription} onChange={(event) => update("shortDescription", event.target.value)} className="rounded-md border border-input bg-background p-3 text-sm" />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="ebook-full">Full description</Label>
          <textarea id="ebook-full" required minLength={30} maxLength={12000} rows={8} value={form.fullDescription} onChange={(event) => update("fullDescription", event.target.value)} className="rounded-md border border-input bg-background p-3 text-sm" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ebook-category">Category</Label>
          <select id="ebook-category" required value={form.categoryId} onChange={(event) => update("categoryId", event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Select a category</option>
            {data?.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ebook-pages">Page count (optional)</Label>
          <Input id="ebook-pages" type="number" min={1} max={10000} value={form.pageCount} onChange={(event) => update("pageCount", event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ebook-subject">Related subject (optional)</Label>
          <select id="ebook-subject" value={form.subjectId} onChange={(event) => update("subjectId", event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">None</option>
            {data?.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ebook-exam">Related exam (optional)</Label>
          <select id="ebook-exam" value={form.examId} onChange={(event) => update("examId", event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">None</option>
            {data?.exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ebook-publication">Publication date (optional)</Label>
          <Input id="ebook-publication" type="date" value={form.publicationDate} onChange={(event) => update("publicationDate", event.target.value)} />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2" disabled={saving || uploading || listingLocked}>
        <legend className="text-sm font-bold uppercase text-primary">Links and cover</legend>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="ebook-destination">External fulfilment link (where the book is hosted)</Label>
          <Input id="ebook-destination" type="url" required placeholder="https://your-store.example/book" value={form.externalProductUrl} onChange={(event) => update("externalProductUrl", event.target.value)} />
          <p className="text-xs text-muted-foreground">The original file never uploads to Xophol. Buyers open your destination here after access is granted.</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ebook-cover">Cover image (JPEG/PNG/WebP, max 5 MB)</Label>
          <Input id="ebook-cover" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCover(file); }} />
          {uploading ? <p className="text-xs text-muted-foreground">Uploading cover…</p> : null}
          {form.coverImageUrl ? <Image src={form.coverImageUrl} alt="Selected cover preview" width={112} height={149} unoptimized className="mt-1 h-28 w-auto rounded-md border border-border object-cover" /> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ebook-preview">Preview link (optional)</Label>
          <Input id="ebook-preview" type="url" value={form.previewUrl} onChange={(event) => update("previewUrl", event.target.value)} />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2" disabled={saving || uploading || listingLocked}>
        <legend className="text-sm font-bold uppercase text-primary">Pricing</legend>
        <div className="grid gap-1.5">
          <Label htmlFor="ebook-price">Price ({form.currency})</Label>
          <Input id="ebook-price" type="number" min={0} step="0.01" required value={form.price} onChange={(event) => update("price", event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ebook-currency">Currency</Label>
          <select id="ebook-currency" value={form.currency} onChange={(event) => update("currency", event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            {(data?.config.allowedCurrencies ?? ["INR"]).map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 border-t border-border pt-5" disabled={saving || uploading || listingLocked}>
        <legend className="text-sm font-bold uppercase text-primary">Contributor profile and rights</legend>
        <div className="grid gap-1.5">
          <Label htmlFor="ebook-bio">Short bio (optional)</Label>
          <textarea id="ebook-bio" maxLength={2000} rows={3} value={form.contributorBio} onChange={(event) => update("contributorBio", event.target.value)} className="rounded-md border border-input bg-background p-3 text-sm" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ebook-expertise">Expertise (comma-separated, optional)</Label>
          <Input id="ebook-expertise" value={form.contributorExpertise} onChange={(event) => update("contributorExpertise", event.target.value)} placeholder="Assam Board, Mathematics, NEET" />
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2 sm:col-span-2">
          <label className="grid gap-1.5 text-sm font-medium">Qualification (optional)
            <Input maxLength={240} value={form.contributorQualification} onChange={(event) => update("contributorQualification", event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">Teaching experience (optional)
            <Input maxLength={500} value={form.contributorTeachingExperience} onChange={(event) => update("contributorTeachingExperience", event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">Profile image URL (optional)
            <Input type="url" value={form.contributorProfileImageUrl} onChange={(event) => update("contributorProfileImageUrl", event.target.value)} placeholder="https://..." />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">Website URL (optional)
            <Input type="url" value={form.contributorWebsiteUrl} onChange={(event) => update("contributorWebsiteUrl", event.target.value)} placeholder="https://..." />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">General location (optional)
            <Input maxLength={120} value={form.contributorLocation} onChange={(event) => update("contributorLocation", event.target.value)} placeholder="City or region" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">Social links (optional, one `name=https://...` per line)
            <textarea rows={3} value={form.contributorSocialLinks} onChange={(event) => update("contributorSocialLinks", event.target.value)} className="rounded-md border border-input bg-background p-3 text-sm font-normal" />
          </label>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" required checked={form.rightsConfirmed} onChange={(event) => update("rightsConfirmed", event.target.checked)} className="mt-1" />
          <span>I own the rights to this content or have permission to sell it. I understand listings are reviewed before publication.</span>
        </label>
      </fieldset>

      <section aria-labelledby="ebook-preview-heading" className="grid gap-4 border-t border-border pt-5 sm:grid-cols-[120px_minmax(0,1fr)]">
        <h2 id="ebook-preview-heading" className="text-sm font-bold uppercase text-primary sm:col-span-2">eBook preview</h2>
        {form.coverImageUrl ? (
          <Image src={form.coverImageUrl} alt={`Cover preview for ${form.title || "your eBook"}`} width={120} height={160} unoptimized className="h-40 w-30 rounded-sm border border-border object-cover" />
        ) : <div className="flex h-40 w-[120px] items-center justify-center border border-border bg-muted text-xs text-muted-foreground">No cover yet</div>}
        <div className="min-w-0 space-y-2">
          <h3 className="text-lg font-semibold text-foreground">{form.title || "Your book title"}</h3>
          <p className="text-sm text-muted-foreground">By {form.authorName || "Author name"}</p>
          <p className="text-sm font-semibold text-foreground">
            {new Intl.NumberFormat("en-IN", { style: "currency", currency: form.currency, maximumFractionDigits: 2 }).format(Number(form.price) || 0)}
            {` · ${data?.categories.find((category) => category.id === form.categoryId)?.name || "Category"}`}
            {form.examId ? ` · ${data?.exams.find((exam) => exam.id === form.examId)?.name || "Exam"}` : ""}
            {` · ${form.language || "Language"}`}
          </p>
          <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">{form.shortDescription || "Your short description will appear here."}</p>
          <div className="flex flex-wrap gap-3 text-sm">
            {form.previewUrl ? <a href={form.previewUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">Open preview link</a> : null}
            {form.externalProductUrl ? <a href={form.externalProductUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">Open external destination</a> : null}
          </div>
        </div>
        <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground sm:col-span-2">{form.fullDescription || "Your full description will appear here."}</p>
      </section>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={saving || uploading || listingLocked || !form.rightsConfirmed}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Saving…</> : listingId ? "Save and resubmit" : "Submit for review"}
        </Button>
        {canSaveDraft ? (
          <Button type="button" variant="outline" onClick={() => void save("save_draft")} disabled={saving || uploading || listingLocked}>
            Save draft
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={() => router.push("/dashboard/ebooks")} disabled={saving || uploading}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

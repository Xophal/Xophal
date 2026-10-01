"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { formatEbookPrice } from "@/components/ebooks/EbookCard";
import { estimateSellerEarnings, type MarketplacePricingRules } from "@/lib/ebooks/pricing";

type FormOptions = {
  categories: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  exams: { id: string; name: string }[];
  config: MarketplacePricingRules;
};

type ExistingBook = {
  id: string;
  title: string;
  author_name: string;
  short_description: string;
  full_description: string;
  category_id: string;
  subject_id?: string | null;
  exam_id?: string | null;
  language: string;
  page_count?: number | null;
  price: number;
  currency: string;
  cover_image_url: string;
  external_product_url: string;
  preview_url?: string | null;
  publication_date?: string | null;
  contributor_bio?: string | null;
  contributor_expertise?: string[] | null;
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
  rightsConfirmed: false,
};

/**
 * Free listing submission for sellers. The cover is uploaded through the
 * managed endpoint first; the price preview uses the live marketplace rules so
 * the commission estimate matches what the order ledger will snapshot.
 */
export default function EbookSubmissionForm({ listingId }: { listingId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState(blank);
  const [data, setData] = useState<FormOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
            setForm({
              title: book.title,
              authorName: book.author_name,
              shortDescription: book.short_description,
              fullDescription: book.full_description,
              categoryId: book.category_id,
              subjectId: book.subject_id ?? "",
              examId: book.exam_id ?? "",
              language: book.language,
              pageCount: book.page_count ? String(book.page_count) : "",
              price: String(book.price),
              currency: book.currency || "INR",
              coverImageUrl: book.cover_image_url,
              externalProductUrl: book.external_product_url,
              previewUrl: book.preview_url ?? "",
              publicationDate: book.publication_date ? String(book.publication_date).slice(0, 10) : "",
              contributorBio: book.contributor_bio ?? "",
              contributorExpertise: (book.contributor_expertise ?? []).join(", "),
              rightsConfirmed: true,
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

  const priceNumber = Number(form.price);
  const estimate = useMemo(() => {
    if (!data?.config || !Number.isFinite(priceNumber) || priceNumber <= 0) return null;
    return estimateSellerEarnings(priceNumber, data.config);
  }, [data, priceNumber]);

  function update<K extends keyof typeof blank>(key: K, value: (typeof blank)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function uploadCover(file: File) {
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/ebooks/cover", { method: "POST", body });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Cover upload failed.");
      update("coverImageUrl", json.data.coverImageUrl);
      toast({ title: "Cover uploaded", description: "Your cover image is ready for the listing." });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Cover upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
        rightsConfirmed: true,
      };
      const response = await fetch(listingId ? `/api/ebooks/mine/${listingId}` : "/api/ebooks/mine", {
        method: listingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not save this listing.");
      toast({
        title: listingId ? "Listing updated" : "Listing submitted",
        description: "Your book is queued for admin review.",
      });
      router.push("/dashboard/ebooks");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save this listing.");
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
    <form onSubmit={onSubmit} className="grid gap-6 rounded-lg border border-border bg-card p-5 sm:p-6">
      <fieldset className="grid gap-4 sm:grid-cols-2" disabled={saving || uploading}>
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

      <fieldset className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2" disabled={saving || uploading}>
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

      <fieldset className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2" disabled={saving || uploading}>
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
        {estimate ? (
          <div className="rounded-md border border-border bg-muted/40 p-4 text-sm sm:col-span-2">
            <p className="font-semibold text-foreground">Estimated earnings (per sale)</p>
            <ul className="mt-2 grid gap-1 text-muted-foreground">
              <li>Sale price: {formatEbookPrice(estimate.price, form.currency)}</li>
              <li>Xophol commission ({estimate.commissionPercent}%): {formatEbookPrice(estimate.commissionAmount, form.currency)}</li>
              <li>Your estimated gross: {formatEbookPrice(estimate.sellerGrossAmount, form.currency)}</li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">Estimate only. Payment-provider fees, tax and refunds are finalised per order.</p>
          </div>
        ) : null}
      </fieldset>

      <fieldset className="grid gap-4 border-t border-border pt-5" disabled={saving || uploading}>
        <legend className="text-sm font-bold uppercase text-primary">Contributor profile and rights</legend>
        <div className="grid gap-1.5">
          <Label htmlFor="ebook-bio">Short bio (optional)</Label>
          <textarea id="ebook-bio" maxLength={2000} rows={3} value={form.contributorBio} onChange={(event) => update("contributorBio", event.target.value)} className="rounded-md border border-input bg-background p-3 text-sm" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ebook-expertise">Expertise (comma-separated, optional)</Label>
          <Input id="ebook-expertise" value={form.contributorExpertise} onChange={(event) => update("contributorExpertise", event.target.value)} placeholder="Assam Board, Mathematics, NEET" />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" required checked={form.rightsConfirmed} onChange={(event) => update("rightsConfirmed", event.target.checked)} className="mt-1" />
          <span>I own the rights to this content or have permission to sell it. I understand listings are reviewed before publication.</span>
        </label>
      </fieldset>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={saving || uploading || !form.rightsConfirmed}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Saving…</> : listingId ? "Save and resubmit" : "Submit for review"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/dashboard/ebooks")} disabled={saving || uploading}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

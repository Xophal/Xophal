"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, BookOpen, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type LibraryRow = {
  id: string;
  product_id: string;
  granted_at: string;
  ebook_listings: {
    title: string;
    slug: string;
    cover_image_url: string;
    subject?: string | null;
    exam?: string | null;
    ebook_transactions?: { order_number?: string | null; status?: string; paid_at?: string | null } | null;
  } | null;
};

export default function LibraryClient() {
  const [rows, setRows] = useState<LibraryRow[]>([]);
  const [query, setQuery] = useState("");
  const [board, setBoard] = useState("");
  const [className, setClassName] = useState("");
  const [subject, setSubject] = useState("");
  const [from, setFrom] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ q: query });
      if (board) params.set("board", board);
      if (className) params.set("class", className);
      if (subject) params.set("subject", subject);
      if (from) params.set("from", from);
      fetch(`/api/ebooks/library?${params.toString()}`, { cache: "no-store" })
        .then(async (response) => {
          const json = await response.json();
          if (!response.ok || !json.success) throw new Error(json.error || "Could not load your library.");
          return json.data.data as LibraryRow[];
        })
        .then((data) => { if (active) setRows(data); })
        .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Could not load your library."); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, board, className, subject, from]);

  return (
    <main className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Student account</p>
        <h1 className="mt-2 text-3xl font-bold">My Library</h1>
        <p className="mt-1 text-muted-foreground">Your verified ebook purchases.</p>
      </header>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input className="pl-9" placeholder="Search your library" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Input value={board} onChange={(event) => setBoard(event.target.value)} placeholder="Board" aria-label="Filter by board" />
        <Input value={className} onChange={(event) => setClassName(event.target.value)} placeholder="Class" aria-label="Filter by class" />
        <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" aria-label="Filter by subject" />
        <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Purchase date from" />
      </div>
      {error ? <div role="alert" className="flex items-center gap-2 rounded-md border border-destructive/30 p-4 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{error}</div> : null}
      {loading ? <p role="status" className="text-sm text-muted-foreground">Loading your library…</p> : null}
      {!loading && !error && rows.length === 0 ? <div className="rounded-lg border border-dashed p-10 text-center"><BookOpen className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-semibold">Your library is empty</p><p className="mt-1 text-sm text-muted-foreground">Verified ebook purchases will appear here automatically.</p><Button asChild className="mt-4"><Link href="/ebooks">Browse ebooks</Link></Button></div> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => {
          const book = row.ebook_listings;
          if (!book) return null;
          const transaction = book.ebook_transactions;
          return <article key={row.id} className="overflow-hidden rounded-lg border bg-card">
            <div className="relative aspect-[3/2] bg-muted"><Image src={book.cover_image_url} alt={`Cover of ${book.title}`} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" /></div>
            <div className="space-y-3 p-4">
              <h2 className="font-semibold">{book.title}</h2>
              <p className="text-sm text-muted-foreground">{book.subject || book.exam || "Ebook"} · Paid · {transaction?.order_number || "Verified purchase"}</p>
              <div className="flex gap-2"><Button asChild size="sm"><a href={`/api/ebooks/library/${row.product_id}/download`}><Download className="h-4 w-4" />Download PDF</a></Button><Button asChild size="sm" variant="outline"><Link href={`/ebooks/${book.slug}`}>Details</Link></Button></div>
            </div>
          </article>;
        })}
      </div>
    </main>
  );
}

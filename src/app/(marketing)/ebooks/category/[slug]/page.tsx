import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import EbookCard from "@/components/ebooks/EbookCard";
import { createClient } from "@/lib/supabase/server";
import { listPublishedEbooks } from "@/lib/ebooks/data";

type Props = { params: Promise<{ slug: string }> };

async function getCategory(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("ebook_categories").select("id, name, slug, description").eq("slug", slug).eq("is_active", true).maybeSingle();
  // Render active categories even with zero published books: the sitemap lists
  // every category hub, and the page ships an empty state for this case.
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return { title: "Study eBooks" };
  return {
    title: `${category.name} eBooks | Xophol`,
    description: category.description || `Explore published ${category.name.toLowerCase()} study books from educators on Xophol.`,
    alternates: { canonical: `/ebooks/category/${slug}` },
    openGraph: { title: `${category.name} eBooks | Xophol`, description: category.description || `Educational books in ${category.name}.`, type: "website" },
  };
}

export default async function EbookCategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();
  const { books } = await listPublishedEbooks({ category: slug, limit: 24 });
  return <main className="min-h-screen bg-background"><section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <p className="text-xs font-bold uppercase text-primary"><Link href="/ebooks">eBooks</Link> / Category</p>
    <h1 className="mt-2 text-3xl font-bold text-foreground">{category.name} eBooks</h1>
    {category.description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{category.description}</p> : null}
    <div className="mt-6 grid gap-x-8 md:grid-cols-2">{books.map((book) => <EbookCard key={book.id} book={book} />)}</div>
    {!books.length ? <p className="mt-8 text-sm text-muted-foreground">No books are currently published in this category.</p> : null}
  </section></main>;
}

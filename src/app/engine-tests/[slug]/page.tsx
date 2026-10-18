import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function EngineTestDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: blueprint, error } = await supabase
    .from("blueprints")
    .select("id,name,slug,description,duration_sec,total_marks,blueprint_sections(count)")
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();
  if (error) throw error;
  if (!blueprint) notFound();

  const sections = Array.isArray(blueprint.blueprint_sections)
    ? blueprint.blueprint_sections.reduce((total, section) => total + Number(section.count || 0), 0)
    : 0;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">Practice test</p>
      <h1 className="mt-2 text-3xl font-bold">{blueprint.name}</h1>
      {blueprint.description && <p className="mt-4 text-muted-foreground">{blueprint.description}</p>}
      <dl className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border p-4"><dt className="text-xs text-muted-foreground">Questions</dt><dd className="mt-1 font-semibold">{sections}</dd></div>
        <div className="rounded-lg border border-border p-4"><dt className="text-xs text-muted-foreground">Duration</dt><dd className="mt-1 font-semibold">{Math.ceil(blueprint.duration_sec / 60)} min</dd></div>
        <div className="rounded-lg border border-border p-4"><dt className="text-xs text-muted-foreground">Marks</dt><dd className="mt-1 font-semibold">{blueprint.total_marks}</dd></div>
      </dl>
      <p className="mt-5 text-sm text-muted-foreground">Your test paper and timer are fixed when you start. You can resume the same attempt if you leave the page.</p>
      <Link href={`/engine-tests/${encodeURIComponent(slug)}/attempt`} className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground">
        Start test
      </Link>
    </main>
  );
}

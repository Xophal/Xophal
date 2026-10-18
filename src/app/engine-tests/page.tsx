import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function EngineTestsPage() {
  const supabase = await createClient();
  const { data: tests, error } = await supabase
    .from("blueprints")
    .select("name,slug,description,duration_sec,total_marks")
    .eq("is_public", true)
    .order("name", { ascending: true });
  if (error) throw error;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">Question bank</p>
      <h1 className="mt-2 text-3xl font-bold">Practice tests</h1>
      {!tests?.length ? (
        <p className="mt-5 text-muted-foreground">No public practice tests are available yet.</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {tests.map((test) => (
            <li key={test.slug} className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold">{test.name}</h2>
              {test.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{test.description}</p>}
              <p className="mt-3 text-xs text-muted-foreground">{Math.ceil(test.duration_sec / 60)} min · {test.total_marks} marks</p>
              <Link href={`/engine-tests/${encodeURIComponent(test.slug)}`} className="mt-4 inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
                View test
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

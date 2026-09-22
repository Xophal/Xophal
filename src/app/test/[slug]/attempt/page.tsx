import MockRunnerClient from "@/components/mock/MockRunnerClient";

export default async function TestAttemptPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <main className="min-h-screen bg-background"><section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8"><div className="rounded-[2rem] border border-border bg-card p-4 shadow-sm sm:p-8"><MockRunnerClient slug={slug} /></div></section></main>;
}

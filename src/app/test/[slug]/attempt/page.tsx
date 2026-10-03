import MockRunnerClient from "@/components/mock/MockRunnerClient";

export default async function TestAttemptPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sourceEbookId?: string }>;
}) {
  const { slug } = await params;
  const { sourceEbookId } = await searchParams;
  return (
    <main className="min-h-screen bg-background">
      <MockRunnerClient slug={slug} sourceEbookId={sourceEbookId} />
    </main>
  );
}

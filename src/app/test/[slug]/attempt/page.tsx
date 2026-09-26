import MockRunnerClient from "@/components/mock/MockRunnerClient";

export default async function TestAttemptPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className="min-h-screen bg-background">
      <MockRunnerClient slug={slug} />
    </main>
  );
}

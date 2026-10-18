import EngineTestRunner from "@/components/mock/EngineTestRunner";

export default async function EngineTestAttemptPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className="min-h-screen bg-background">
      <EngineTestRunner blueprintSlug={slug} />
    </main>
  );
}

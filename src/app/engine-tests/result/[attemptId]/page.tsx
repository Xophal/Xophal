import EngineTestResult from "@/components/mock/EngineTestResult";

export default async function EngineTestResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return <EngineTestResult attemptId={attemptId} />;
}

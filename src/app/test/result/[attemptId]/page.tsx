import ResultPageClient from "@/components/mock/ResultPageClient";
export default async function ResultPage({ params }: { params: Promise<{ attemptId: string }> }) { const { attemptId } = await params; return <ResultPageClient attemptId={attemptId} />; }

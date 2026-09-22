import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";
import { APP_NAME } from "@/constants";

export const metadata = {
  title: `Previous Year Papers - ${APP_NAME}`,
  description: `Access previous year papers and practice sets on ${APP_NAME}.`,
};

export default function PreviousYearPapersPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-8">
        <div className="mb-10 space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Previous Year Papers</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Practice with real exam patterns.</h1>
          <p className="max-w-2xl text-lg text-muted-foreground">Prepare with curated papers from recent exam cycles and topic-based practice sets.</p>
        </div>

        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <h2 className="text-2xl font-semibold">Paper library coming soon</h2>
          </div>
          <p className="mb-6 text-muted-foreground">The paper repository is being expanded with board-wise and exam-wise collections.</p>
          <Link href="/mock-tests" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
            Try mock tests <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";
import { APP_NAME } from "@/constants";

export const metadata = {
  title: `Courses - ${APP_NAME}`,
  description: `Explore study courses and learning programs on ${APP_NAME}.`,
};

export default function CoursesPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-8">
        <div className="mb-10 space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Courses</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Structured learning for every student stage.</h1>
          <p className="max-w-2xl text-lg text-muted-foreground">Choose board-specific courses, topic-based lessons, and exam-focused practice paths.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <GraduationCap className="mb-4 h-8 w-8 text-primary" />
            <h2 className="mb-2 text-xl font-semibold">Class 9 & 10 Programs</h2>
            <p className="mb-4 text-sm text-muted-foreground">Aligned to SEBA and CBSE concepts with notes, practice questions, and revision tools.</p>
            <Link href="/notes" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
              Explore notes <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <GraduationCap className="mb-4 h-8 w-8 text-primary" />
            <h2 className="mb-2 text-xl font-semibold">Exam Preparation Paths</h2>
            <p className="mb-4 text-sm text-muted-foreground">Targeted mock tests and previous year paper practice for competitive success.</p>
            <Link href="/previous-year-papers" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
              See papers <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

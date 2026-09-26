import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  FileQuestion,
  GraduationCap,
  ListChecks,
  ShieldCheck,
  Target,
  Trophy,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ slug: string }> };

export default async function TestDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: test } = await supabase
    .from("mock_tests")
    .select(
      "title, slug, description, total_questions, total_marks, duration_minutes, passing_marks, negative_marking, negative_marks_ratio, max_attempts, instructions, test_types(name), subjects(name), chapters(name)"
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .eq("is_active", true)
    .maybeSingle();
  if (!test) notFound();

  const testType = (Array.isArray(test.test_types) ? test.test_types[0] : test.test_types)?.name;
  const subject = (Array.isArray(test.subjects) ? test.subjects[0] : test.subjects)?.name;
  const chapter = (Array.isArray(test.chapters) ? test.chapters[0] : test.chapters)?.name;
  const validDuration = test.duration_minutes > 0;
  const available = test.total_questions > 0 && validDuration;
  const averageMinutes = test.total_questions > 0 ? test.duration_minutes / test.total_questions : 0;

  const facts = [
    { label: "Duration", value: validDuration ? `${test.duration_minutes} min` : "Not configured", icon: Clock3 },
    { label: "Questions", value: test.total_questions, icon: FileQuestion },
    { label: "Total marks", value: test.total_marks, icon: Trophy },
    { label: "Subject", value: subject || "General", icon: GraduationCap, hint: chapter ?? undefined },
  ];
  return (
    <main className="min-h-screen bg-background pt-20">
      <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
        <Link
          href="/mock-tests"
          className="inline-flex min-h-10 items-center gap-2 rounded-md text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to mock tests
        </Link>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_0.85fr]">
          <div>
            <p className="exam-eyebrow">{testType || "Mock test"}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{test.title}</h1>
            {test.description && (
              <p className="mt-4 max-w-prose text-base leading-7 text-muted-foreground">
                {test.description}
              </p>
            )}

            <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {facts.map((fact) => {
                const Icon = fact.icon;
                return (
                  <div key={fact.label} className="exam-stat">
                    <dt className="flex items-center gap-1.5 exam-stat__label">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {fact.label}
                    </dt>
                    <dd className="exam-stat__value text-xl">{fact.value}</dd>
                    {fact.hint && <dd className="exam-stat__hint">{fact.hint}</dd>}
                  </div>
                );
              })}
            </dl>

            {validDuration && averageMinutes > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                About {averageMinutes.toFixed(1)} minutes per question at this pace.
              </p>
            )}
          </div>

          <aside className="exam-panel h-fit p-6 lg:sticky lg:top-24">
            <h2 className="exam-section-title">Ready to begin?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The timer starts as soon as the test opens and keeps running if you leave the page.
            </p>

            {available ? (
              <Link
                href={`/test/${test.slug}/attempt`}
                className="exam-cta mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Start test
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <div className="mt-6 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
                <p className="font-semibold text-foreground">This test is currently unavailable.</p>
                <p className="mt-1 text-muted-foreground">
                  It needs valid questions and a duration before it can be started.
                </p>
              </div>
            )}

            {test.max_attempts > 0 && (
              <p className="mt-4 text-sm text-muted-foreground">Maximum attempts: {test.max_attempts}</p>
            )}

            <ul className="mt-6 space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Your answers save automatically as you move between questions.
              </li>
              <li className="flex items-start gap-2">
                <Target className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                You can change any answer until you submit or time runs out.
              </li>
            </ul>
          </aside>
        </div>
        <section aria-labelledby="instructions-heading" className="exam-panel mt-6 p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            <ListChecks className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 id="instructions-heading" className="exam-section-title">
              Instructions
            </h2>
          </div>

          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              Total questions: <strong className="text-foreground">{test.total_questions}</strong>.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              Time allowed:{" "}
              <strong className="text-foreground">
                {validDuration ? `${test.duration_minutes} minutes` : "not configured"}
              </strong>
              .
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              Total marks: <strong className="text-foreground">{test.total_marks}</strong>.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              {test.negative_marking ? (
                <>
                  Negative marking applies: <strong className="text-foreground">{test.negative_marks_ratio} marks</strong>{" "}
                  are deducted where configured.
                </>
              ) : (
                <>No negative marking is configured for this test.</>
              )}
            </li>
            {test.passing_marks != null && (
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                Passing marks: <strong className="text-foreground">{test.passing_marks}</strong>.
              </li>
            )}
          </ul>

          {test.instructions && (
            <div className="mt-5 rounded-lg border border-border bg-muted/40 p-4">
              <h3 className="exam-eyebrow">Notes from your teacher</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground">
                {test.instructions}
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
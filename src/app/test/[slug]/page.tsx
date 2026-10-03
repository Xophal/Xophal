import type { Metadata } from "next";
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
import { APP_NAME } from "@/constants";
import EbookCard, { type EbookCardData } from "@/components/ebooks/EbookCard";
import LearningDiscoveryTracker from "@/components/ebooks/LearningDiscoveryTracker";
import EbookTelemetry from "@/components/ebooks/EbookTelemetry";
import { getRelatedPublishedEbooks } from "@/lib/ebooks/data";
import { getAppUrl, getPublicSocialImage, getSeoDescription } from "@/lib/ebooks/seo";

type PageProps = { params: Promise<{ slug: string }> };

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: test, error } = await supabase
    .from("mock_tests")
    .select("id, title, slug, description, subjects(name), exams(name)")
    .eq("slug", slug)
    .eq("is_published", true)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!test) return { title: "Mock test not found", robots: { index: false, follow: false } };

  const subject = firstRelation(test.subjects)?.name;
  const exam = firstRelation(test.exams)?.name;
  const context = [exam, subject].filter(Boolean).join(" · ");
  const title = context ? `${test.title} — ${context}` : `${test.title} Mock Test`;
  const description = getSeoDescription(
    test.description,
    `Practice ${context || test.title} with this ${APP_NAME} mock test.`,
  );
  const url = getAppUrl(`/test/${encodeURIComponent(test.slug)}`);
  const image = getPublicSocialImage();
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: APP_NAME, url, title, description, images: [{ url: image, alt: `${test.title} mock test` }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function TestDetailPage({ params, searchParams }: PageProps & {
  searchParams: Promise<{ sourceEbookId?: string }>;
}) {
  const { slug } = await params;
  const source = await searchParams;
  const supabase = await createClient();
  const { data: test } = await supabase
    .from("mock_tests")
    .select(
      "id, title, slug, description, total_questions, total_marks, duration_minutes, passing_marks, negative_marking, negative_marks_ratio, max_attempts, instructions, subject_id, exam_id, test_types(name), subjects(name), chapters(name)"
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .eq("is_active", true)
    .maybeSingle();
  if (!test) notFound();

  const testType = (Array.isArray(test.test_types) ? test.test_types[0] : test.test_types)?.name;
  const subject = (Array.isArray(test.subjects) ? test.subjects[0] : test.subjects)?.name;
  const chapter = (Array.isArray(test.chapters) ? test.chapters[0] : test.chapters)?.name;
  const relatedEbooks = await getRelatedPublishedEbooks({ mockTestId: test.id, subjectId: test.subject_id, examId: test.exam_id });
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
      <EbookTelemetry eventName="mock_test_view" mockTestId={test.id} source="mock_test_detail" />
      <LearningDiscoveryTracker />
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
                href={`/test/${test.slug}/attempt${source.sourceEbookId ? `?sourceEbookId=${encodeURIComponent(source.sourceEbookId)}` : ""}`}
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
        {relatedEbooks.length ? (
          <section aria-labelledby="related-ebooks-heading" className="mt-8">
            <div className="border-b border-border pb-3">
              <h2 id="related-ebooks-heading" className="text-xl font-bold text-foreground">Recommended Study Resources</h2>
              <p className="mt-1 text-sm text-muted-foreground">Want to strengthen your preparation? Explore related eBooks and study resources.</p>
            </div>
            <div className="mt-3 grid gap-x-8 md:grid-cols-2">
              {(relatedEbooks as EbookCardData[]).map((book) => <EbookCard key={book.id} book={book} sourceMockTestId={test.id} />)}
            </div>
            <Link href={`/ebooks?q=${encodeURIComponent(subject || test.title)}`} className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-primary hover:underline">
              Explore all eBooks
            </Link>
          </section>
        ) : (
          <section aria-labelledby="related-ebooks-heading" className="mt-8 border-t border-border pt-5">
            <h2 id="related-ebooks-heading" className="text-xl font-bold text-foreground">Recommended Study Resources</h2>
            <p className="mt-1 text-sm text-muted-foreground">Want to strengthen your preparation? Explore related eBooks and study resources.</p>
            <p className="mt-3 text-sm text-muted-foreground">No related eBooks available yet.</p>
            <Link href="/ebooks" className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-primary hover:underline">
              Explore all eBooks
            </Link>
          </section>
        )}
      </section>
    </main>
  );
}
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileQuestion,
  Lightbulb,
  PlayCircle,
  Target,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type MockTest = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  total_questions: number;
  duration_minutes: number;
  test_types: { name: string; code: string } | { name: string; code: string }[] | null;
};

type ApiResponse = {
  success: boolean;
  data?: { data?: MockTest[]; pagination?: { total: number } };
};

const features = [
  { icon: PlayCircle, title: "Practice tests", text: "Take board-focused practice tests at your own pace." },
  { icon: BarChart3, title: "Performance tracking", text: "Review your progress and identify the topics to revisit." },
  { icon: CheckCircle2, title: "Instant results", text: "See your result as soon as an available test is submitted." },
  { icon: Lightbulb, title: "Question explanations", text: "Learn from explanations where they are provided with a question." },
];

const faqs: [string, string][] = [
  ["Who can use Xophal?", "Xophal is built for Class 9 and 10 students preparing for CBSE and Assam Board exams."],
  ["How do I start a mock test?", "Choose a test from the featured section or the mock-tests page, then select Start test."],
  ["Can I use Xophal on my phone?", "Yes. The learning and test discovery experience is designed to work across phones, tablets, and desktops."],
];

function getTestType(test: MockTest) {
  const value = Array.isArray(test.test_types) ? test.test_types[0] : test.test_types;
  return value?.name || "Practice test";
}

export function HomePage() {
  const [tests, setTests] = useState<MockTest[]>([]);
  const [testCount, setTestCount] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTests() {
      try {
        const response = await fetch("/api/mock-tests?limit=3", { signal: controller.signal });
        if (!response.ok) throw new Error("Unable to load tests");

        const payload = (await response.json()) as ApiResponse;
        if (!payload.success) throw new Error("Unable to load tests");

        setTests(payload.data?.data || []);
        setTestCount(payload.data?.pagination?.total ?? 0);
        setStatus("ready");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setStatus("error");
      }
    }

    loadTests();
    return () => controller.abort();
  }, []);

  return (
    <main className="flex-1 overflow-x-clip pt-20">
      <section className="relative">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:px-8 lg:py-28">
          <div>
            <p className="inline-flex rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-semibold text-primary">
              CBSE & Assam Board · Classes 9–10
            </p>
            <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              Practice with purpose. <span className="text-primary">Prepare with confidence.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              Discover board-focused mock tests and build a stronger exam routine, one attempt at a time.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/mock-tests"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Explore Tests <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-border bg-card px-6 py-3 font-semibold transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                How it works
              </Link>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {status === "loading" &&
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="rounded-3xl border bg-card p-6">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="mt-6 h-7 w-4/5" />
                    <Skeleton className="mt-4 h-5 w-2/3" />
                    <Skeleton className="mt-8 h-11 w-full" />
                  </div>
                ))}
              {tests.map((test) => (
                <article key={test.id} className="flex h-full flex-col rounded-3xl border bg-card p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {getTestType(test)}
                    </span>
                    <span className="text-sm text-muted-foreground">{test.total_questions} questions</span>
                  </div>
                  <h3 className="mt-5 text-xl font-bold">{test.title}</h3>
                  {test.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{test.description}</p>}
                  <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock3 className="h-4 w-4" />
                    {test.duration_minutes} minutes
                  </div>
                  <Link
                    href={`/test/${test.slug}`}
                    className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    Start test <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              ))}
            </div>

            <dl className="mt-10 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border bg-card p-4">
                <dt className="text-sm text-muted-foreground">Boards supported</dt>
                <dd className="mt-1 text-2xl font-bold">2</dd>
              </div>
              <div className="rounded-2xl border bg-card p-4">
                <dt className="text-sm text-muted-foreground">Classes covered</dt>
                <dd className="mt-1 text-2xl font-bold">9–10</dd>
              </div>
              <div className="rounded-2xl border bg-card p-4">
                <dt className="text-sm text-muted-foreground">Available tests</dt>
                <dd className="mt-1 text-2xl font-bold">{testCount === null ? "—" : testCount}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[2rem] border border-border bg-gradient-to-br from-primary/10 via-card to-accent/10 p-5 shadow-xl shadow-primary/5">
            <div className="rounded-[1.5rem] border bg-card p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <FileQuestion className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Your study flow</p>
                  <p className="text-xl font-bold">From practice to progress</p>
                </div>
              </div>
              <ol className="mt-8 space-y-5">
                {[
                  "Choose a board-style test",
                  "Attempt questions with focus",
                  "Review your available results",
                ].map((item, index) => (
                  <li key={item} className="flex items-center gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {index + 1}
                    </span>
                    <span className="font-medium">{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section id="featured-tests" aria-labelledby="featured-heading" className="border-y bg-muted/30 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Available now</p>
              <h2 id="featured-heading" className="mt-3 text-3xl font-bold sm:text-4xl">Featured mock tests</h2>
            </div>
            <Link href="/mock-tests" className="inline-flex items-center gap-2 font-semibold text-primary hover:underline">
              View all tests <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {status === "loading" &&
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-3xl border bg-card p-6">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="mt-6 h-7 w-4/5" />
                  <Skeleton className="mt-4 h-5 w-2/3" />
                  <Skeleton className="mt-8 h-11 w-full" />
                </div>
              ))}
            {status === "error" && (
              <div className="rounded-3xl border border-destructive/30 bg-card p-8 text-center md:col-span-2 xl:col-span-3">
                <h3 className="text-lg font-semibold">Tests could not be loaded</h3>
                <p className="mt-2 text-muted-foreground">Please try again, or browse the mock-test catalogue.</p>
                <Link href="/mock-tests" className="mt-5 inline-flex font-semibold text-primary hover:underline">
                  Browse mock tests
                </Link>
              </div>
            )}
            {status === "ready" && tests.length === 0 && (
              <div className="rounded-3xl border bg-card p-8 text-center md:col-span-2 xl:col-span-3">
                <h3 className="text-lg font-semibold">No published tests yet</h3>
                <p className="mt-2 text-muted-foreground">Please check back soon for new practice opportunities.</p>
              </div>
            )}
            {tests.map((test) => (
              <article key={test.id} className="flex h-full flex-col rounded-3xl border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {getTestType(test)}
                  </span>
                  <span className="text-sm text-muted-foreground">{test.total_questions} questions</span>
                </div>
                <h3 className="mt-5 text-xl font-bold">{test.title}</h3>
                {test.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{test.description}</p>}
                <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock3 className="h-4 w-4" />
                  {test.duration_minutes} minutes
                </div>
                <Link
                  href={`/test/${test.slug}`}
                  className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Start test <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="categories-heading" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Choose your path</p>
          <h2 id="categories-heading" className="mt-3 text-3xl font-bold sm:text-4xl">Practice by board</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">Start with the board that matches your school preparation.</p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Link href="/mock-tests" className="group rounded-3xl border bg-card p-7 shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <BookOpen className="h-8 w-8 text-primary" />
            <h3 className="mt-5 text-xl font-bold">CBSE</h3>
            <p className="mt-2 text-muted-foreground">Mock-test practice for Class 9 and Class 10.</p>
            <span className="mt-6 inline-flex items-center gap-2 font-semibold text-primary">
              Browse tests <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </Link>
          <Link href="/mock-tests" className="group rounded-3xl border bg-card p-7 shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Target className="h-8 w-8 text-primary" />
            <h3 className="mt-5 text-xl font-bold">Assam Board (SEBA)</h3>
            <p className="mt-2 text-muted-foreground">Mock-test practice for Class 9 and Class 10.</p>
            <span className="mt-6 inline-flex items-center gap-2 font-semibold text-primary">
              Browse tests <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </Link>
        </div>
      </section>

      <section id="features" aria-labelledby="features-heading" className="bg-muted/30 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Built for focused practice</p>
            <h2 id="features-heading" className="mt-3 text-3xl font-bold sm:text-4xl">The tools behind your preparation</h2>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-3xl border bg-card p-6">
                <Icon className="h-7 w-7 text-primary" />
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" aria-labelledby="how-heading" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">How it works</p>
          <h2 id="how-heading" className="mt-3 text-3xl font-bold sm:text-4xl">Four simple steps to start</h2>
        </div>
        <ol className="mt-10 grid gap-5 md:grid-cols-4">
          {[
            "Choose a test",
            "Attempt questions",
            "Submit the test",
            "Review your performance",
          ].map((step, index) => (
            <li key={step} className="rounded-3xl border bg-card p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {index + 1}
              </span>
              <h3 className="mt-5 text-lg font-bold">{step}</h3>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="faq-heading" className="border-y bg-muted/30 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">FAQ</p>
            <h2 id="faq-heading" className="mt-3 text-3xl font-bold sm:text-4xl">Questions, answered</h2>
          </div>
          <div className="mt-10 divide-y rounded-2xl border bg-card">
            {faqs.map(([question, answer], index) => (
              <div key={question}>
                <button
                  type="button"
                  aria-expanded={openFaq === index}
                  aria-controls={`faq-answer-${index}`}
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span>{question}</span>
                  <ChevronDown className={`h-5 w-5 shrink-0 transition ${openFaq === index ? "rotate-180" : ""}`} />
                </button>
                {openFaq === index && (
                  <div id={`faq-answer-${index}`} className="px-5 pb-5 text-muted-foreground">
                    {answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="rounded-[2rem] border bg-gradient-to-r from-primary/10 via-card to-accent/10 p-8 text-center sm:p-12">
          <h2 className="text-3xl font-bold sm:text-4xl">Ready to begin your next practice session?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Explore the available tests and take the next step in your exam preparation.
          </p>
          <Link
            href="/mock-tests"
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Explore mock tests <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}

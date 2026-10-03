import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import TeamSection from "@/components/about/TeamSection";
import { APP_NAME, APP_URL } from "@/constants";

export const TAGLINE = "Learn, Explore, and Grow";

const description =
  "Meet Xophol, a student-friendly learning platform where students learn, explore and grow, and educators share their knowledge and experience.";

export const metadata: Metadata = {
  title: { absolute: `About ${APP_NAME}` },
  description,
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: `About ${APP_NAME}`,
    description,
    siteName: APP_NAME,
    locale: "en_IN",
    type: "website",
    url: new URL("/about", APP_URL).toString(),
  },
};

export default function AboutPage() {
  return (
    <main className="bg-background text-foreground">
      <section
        aria-labelledby="about-heading"
        className="mx-auto max-w-7xl px-4 pb-14 pt-8 sm:px-6 sm:pb-20 lg:px-8 lg:pt-12"
      >
        <div className="animate-fade-in rounded-3xl bg-xophol-ink px-6 py-12 text-white motion-reduce:animate-none sm:px-10 sm:py-16 lg:px-16 lg:py-20">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-xophol-orange">
              About Xophol
            </p>
            <h1
              id="about-heading"
              className="mt-5 max-w-4xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
            >
              Making quality learning accessible to every student.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/80 sm:text-lg sm:leading-8">
              Xophol is a student-friendly platform where students learn, explore and grow, and
              educators share their knowledge and experience.
            </p>
            <p className="mt-8 border-l-2 border-xophol-orange pl-4 text-lg font-medium text-white sm:text-xl">
              {TAGLINE}
            </p>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="mission-heading"
        className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8"
      >
        <div className="grid gap-4 rounded-3xl border border-border bg-card p-6 sm:p-9 lg:grid-cols-[0.7fr_1.3fr] lg:gap-12 lg:p-12">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-xophol-blue dark:text-sky-300">
              Our mission
            </p>
            <h2 id="mission-heading" className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Learning should be within reach.
            </h2>
          </div>
          <div className="max-w-3xl space-y-4 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            <p>
              Xophol is a student-friendly platform where students learn, explore and grow, and
              educators share their knowledge and experience.
            </p>
            <p>We believe quality learning should be within every student&apos;s reach.</p>
          </div>
        </div>
      </section>

      <TeamSection />

      <section
        aria-labelledby="about-cta-heading"
        className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pb-24 lg:px-8"
      >
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-border bg-card p-6 sm:p-9 md:flex-row md:items-center lg:p-12">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-xophol-blue dark:text-sky-300">
              Your next step
            </p>
            <h2 id="about-cta-heading" className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Ready to learn, explore, and grow?
            </h2>
          </div>
          <Link
            href="/learn"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-xophol-orange px-5 py-3 text-sm font-semibold text-xophol-ink transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xophol-orange focus-visible:ring-offset-2 focus-visible:ring-offset-card motion-reduce:transition-none"
          >
            Start learning
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Icon from "@/components/icons/Icon";
import { ROUTES } from "@/constants";
import { Reveal, RevealGroup, RevealItem, SpotlightCard } from "./Reveal";

type Feature = {
  icon: string;
  title: string;
  description: string;
  span?: "hx-span-4" | "hx-span-6" | "hx-span-8";
  accent?: boolean;
};

const features: Feature[] = [
  {
    icon: "BookOpen",
    title: "Structured learning paths",
    description:
      "Board to class to subject to chapter to topic — loaded live from your syllabus, so nothing is ever out of order.",
    span: "hx-span-4",
  },
  {
    icon: "Target",
    title: "Real mock test engine",
    description:
      "Chapter tests, unit tests and full syllabus mocks with negative marking, a strict timer and auto-save.",
    span: "hx-span-4",
    accent: true,
  },
  {
    icon: "Brain",
    title: "AI study planner",
    description:
      "Personalised daily plans that adapt to your weak topics and recommend exactly what to revise next.",
    span: "hx-span-4",
  },
  {
    icon: "BarChart3",
    title: "Analytics you can act on",
    description:
      "Topic-wise accuracy, streaks and time management trends, benchmarked against every previous attempt.",
    span: "hx-span-6",
  },
  {
    icon: "Trophy",
    title: "Streaks, XP and certificates",
    description:
      "Keep a daily streak alive, climb the leaderboard and download a certificate for every milestone you finish.",
    span: "hx-span-6",
  },
];

const subjectPills = [
  "Mathematics",
  "Science",
  "English",
  "Social Science",
  "Assamese",
  "General Knowledge",
  "Reasoning",
  "Current Affairs",
];

export default function BentoFeatures() {
  return (
    <section id="features" className="hx-section hx-mesh" aria-labelledby="features-title">
      <div className="hx-grid-lines" aria-hidden="true" />

      <div className="hx-shell">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="hx-kicker">One focused workspace</span>
          <h2 id="features-title" className="hx-title">
            Less hunting. <span className="hx-grad">More learning.</span>
          </h2>
          <p className="hx-subtitle mx-auto">
            Everything you need to move from a chapter you have not started yet to a score you can actually trust.
          </p>
        </Reveal>

        <RevealGroup className="hx-bento mt-12">
          {features.map((feature) => (
            <RevealItem key={feature.title} className={feature.span}>
              <SpotlightCard as="article" className="hx-glass hx-ring hx-bento-card h-full">
                {feature.accent ? <span className="hx-bento-card--accent absolute inset-0 -z-10 rounded-[inherit]" aria-hidden="true" /> : null}
                <span className="hx-chip">
                  <Icon name={feature.icon} className="h-5 w-5" />
                </span>
                <h3 className="hx-bento-card__title">{feature.title}</h3>
                <p className="hx-bento-card__body">{feature.description}</p>
              </SpotlightCard>
            </RevealItem>
          ))}

          <RevealItem className="hx-span-8">
            <div className="hx-glass hx-ring flex h-full flex-col gap-4 p-6 sm:p-7">
              <div>
                <h3 className="hx-bento-card__title">Every subject, one syllabus</h3>
                <p className="hx-bento-card__body mt-1.5">
                  Practice across the full Class 9 and 10 range without switching tabs or accounts.
                </p>
              </div>
              <div className="hx-marquee mt-1" aria-hidden="true">
                <div className="hx-marquee__track">
                  {[...subjectPills, ...subjectPills].map((subject, index) => (
                    <span key={`${subject}-${index}`} className="hx-marquee__pill">
                      <Icon name="CheckCircle2" className="h-3.5 w-3.5 text-primary" />
                      {subject}
                    </span>
                  ))}
                </div>
              </div>
              <Link
                href={ROUTES.learn}
                className="inline-flex w-fit items-center gap-1 text-sm font-bold text-primary hover:underline"
              >
                Browse the full library
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </RevealItem>

          <RevealItem className="hx-span-4">
            <SpotlightCard as="article" className="hx-glass hx-ring flex h-full flex-col justify-between gap-5 p-6 sm:p-7">
              <div>
                <span className="hx-chip hx-chip--lg">
                  <Icon name="Sparkles" className="h-6 w-6" />
                </span>
                <h3 className="hx-bento-card__title mt-4">Previous year papers</h3>
                <p className="hx-bento-card__body mt-1.5">
                  PYQs, sample papers and worked solutions so you walk into the exam having already seen the pattern.
                </p>
              </div>
              <Link
                href={ROUTES.tests}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-5 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/16"
              >
                Start a practice test
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </SpotlightCard>
          </RevealItem>
        </RevealGroup>
      </div>
    </section>
  );
}

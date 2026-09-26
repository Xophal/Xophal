"use client";

import { Reveal, RevealGroup, RevealItem } from "./Reveal";

const steps = [
  {
    icon: "UserPlus",
    title: "Create your free account",
    description: "Pick your board and class in under a minute. No card, no trial timer, no surprises.",
  },
  {
    icon: "ListChecks",
    title: "Pick a test that fits today",
    description: "Jump into a chapter test, a unit test or a full syllabus mock — all in the same interface.",
  },
  {
    icon: "TrendingUp",
    title: "Learn from the analysis",
    description: "Get question-by-question explanations, topic accuracy and a plan for what to revise next.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="hx-section" aria-labelledby="how-it-works-title">
      <div className="hx-shell">
        <Reveal className="max-w-2xl">
          <span className="hx-kicker">How it works</span>
          <h2 id="how-it-works-title" className="hx-title">
            Three steps to your <span className="hx-grad">first score</span>
          </h2>
          <p className="hx-subtitle">
            No setup lectures, no configuration. Sign up, attempt a test, and let the analysis point you at the next
            thing to fix.
          </p>
        </Reveal>

        <RevealGroup as="ol" className="mt-12 grid gap-4 md:grid-cols-3" stagger={0.12}>
          {steps.map((step, index) => (
            <RevealItem as="li" key={step.title}>
              <article className="hx-step">
                <span className="hx-step__index">{index + 1}</span>
                <h3 className="hx-bento-card__title">{step.title}</h3>
                <p className="hx-bento-card__body">{step.description}</p>
              </article>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";
import { RevealGroup, RevealItem } from "./Reveal";

type Stat = {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
};

const stats: Stat[] = [
  { value: 1200, suffix: "+", label: "Practice questions" },
  { value: 40, suffix: "+", label: "Chapter & mock tests" },
  { value: 12, suffix: "k+", label: "Students learning" },
  { value: 4.9, suffix: "/5", label: "Average learner rating" },
];

function formatValue(value: number) {
  return value % 1 === 0 ? value.toLocaleString("en-IN") : value.toFixed(1);
}

function Counter({ stat, active }: { stat: Stat; active: boolean }) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!active || reduceMotion) return;

    const duration = 1400;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplay(stat.value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, reduceMotion, stat.value]);

  // When motion is reduced the count-up is skipped entirely.
  const value = reduceMotion ? stat.value : display;

  return (
    <span className="hx-stat__value hx-grad">
      {stat.prefix}
      {formatValue(value)}
      {stat.suffix}
    </span>
  );
}

export default function StatsBand() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  return (
    <section className="hx-section" aria-label="Xophal by the numbers">
      <div className="hx-shell">
        <div ref={ref}>
          <RevealGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" stagger={0.1}>
            {stats.map((stat) => (
              <RevealItem key={stat.label} className="hx-glass hx-ring hx-stat">
                <Counter stat={stat} active={inView} />
                <span className="hx-stat__label">{stat.label}</span>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </div>
    </section>
  );
}

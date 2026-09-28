"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight, BarChart3, BookOpen, Check, Rocket, ShieldCheck, Star, Timer } from "lucide-react";

const trustPoints = ["Free to start", "No card needed", "CBSE & SEBA syllabus"];

const featureHighlights = [
  { icon: ShieldCheck, title: "Real Exam\nPattern" },
  { icon: BarChart3, title: "Detailed\nAnalysis" },
  { icon: Star, title: "Track Your\nProgress" },
  { icon: Rocket, title: "Achieve\nYour Goals" },
];

export function HeroSection() {
  const reduceMotion = useReducedMotion();

  const rise = (delay: number) => ({
    initial: { opacity: 0, y: reduceMotion ? 0 : 24, filter: reduceMotion ? "none" : "blur(8px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: { duration: reduceMotion ? 0 : 0.7, delay: reduceMotion ? 0 : delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <section className="xophol-hero hx-hero-premium" aria-label="Xophol exam preparation">
      <div className="hx-shell hx-hero-premium__shell">
        <div className="hx-hero-topline">
          <span>Focused preparation for Class 9 &amp; 10</span>
          <span className="hx-hero-topline__right">CBSE <i /> Assam Board</span>
        </div>

        <div className="hx-hero-grid">
          <div className="hx-hero-copy">
            <motion.p className="hx-hero-eyebrow" {...rise(0)}>
              <span aria-hidden="true" /> A clearer way to prepare
            </motion.p>

            <motion.h1 className="hx-hero-title" {...rise(0.08)}>
              <span>Make your next</span>
              <span>score your <em>best.</em></span>
            </motion.h1>

            <motion.p className="hx-hero-description" {...rise(0.16)}>
              Board-aligned practice, calm exam-day simulations, and useful feedback that tells you what to do next.
            </motion.p>

            <motion.div className="hx-hero-actions" {...rise(0.24)}>
              <Link href="/mock-tests" className="hx-hero-primary">
                Explore mock tests <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/register" className="hx-hero-secondary">
                Create your free account <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </motion.div>

            <motion.ul className="hx-hero-trust" aria-label="Platform benefits" {...rise(0.32)}>
              {trustPoints.map((point) => (
                <li key={point}><Check aria-hidden="true" />{point}</li>
              ))}
            </motion.ul>
          </div>

          <motion.aside className="hx-prep-path" aria-label="Your preparation path" {...rise(0.18)}>
            <div className="hx-prep-path__head">
              <span className="hx-prep-path__overline">The Xophol method</span>
              <span className="hx-prep-path__index">01 — 03</span>
            </div>
            <h2>A good prep rhythm.</h2>
            <ol>
              <li>
                <span className="hx-prep-path__icon"><BookOpen aria-hidden="true" /></span>
                <span className="hx-prep-path__step"><small>01 / FIND YOUR FOCUS</small><strong>Start with your board</strong></span>
                <Link href="#boards" aria-label="Choose your board"><ArrowUpRight aria-hidden="true" /></Link>
              </li>
              <li>
                <span className="hx-prep-path__icon"><Timer aria-hidden="true" /></span>
                <span className="hx-prep-path__step"><small>02 / PRACTISE WITH PURPOSE</small><strong>Take a timed mock</strong></span>
                <Link href="/mock-tests" aria-label="Browse timed mock tests"><ArrowUpRight aria-hidden="true" /></Link>
              </li>
              <li>
                <span className="hx-prep-path__icon"><BarChart3 aria-hidden="true" /></span>
                <span className="hx-prep-path__step"><small>03 / KNOW WHAT&apos;S NEXT</small><strong>Learn from every result</strong></span>
                <Link href="/register" aria-label="Create an account to track results"><ArrowUpRight aria-hidden="true" /></Link>
              </li>
            </ol>
            <div className="hx-prep-path__foot"><span>Built around your syllabus</span><span>Made for steady progress</span></div>

            <div className="hx-prep-path__pulse" aria-label="Current performance pulse">
              <div className="hx-prep-path__pulse-top">
                <span>Score pulse</span>
                <strong>84%</strong>
              </div>

              <div className="hx-prep-path__meter" aria-hidden="true">
                <span style={{ width: "84%" }} />
              </div>

              <div className="hx-prep-path__mini-grid">
                <div>
                  <small>Accuracy</small>
                  <strong>88%</strong>
                </div>
                <div>
                  <small>Streak</small>
                  <strong>12 days</strong>
                </div>
              </div>
            </div>
          </motion.aside>
        </div>

        <motion.div className="hx-hero-capabilities" aria-label="Learning platform highlights" {...rise(0.36)}>
          {featureHighlights.map(({ icon: Icon, title }, index) => (
            <div key={title} className="hx-hero-capability">
              <span className="hx-hero-capability__index">0{index + 1}</span>
              <Icon aria-hidden="true" />
              <span>{title.replace("\n", " ")}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

export default HeroSection;

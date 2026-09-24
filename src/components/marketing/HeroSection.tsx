import Link from "next/link";
import { ArrowRight, BarChart3, Check, Play, Rocket, ShieldCheck, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants";

const featureHighlights = [
  { icon: ShieldCheck, title: "Real Exam\nPattern" },
  { icon: BarChart3, title: "Detailed\nAnalysis" },
  { icon: Star, title: "Track Your\nProgress" },
  { icon: Rocket, title: "Achieve\nYour Goals" },
];

const leaderRows = [
  { rank: 1, name: "You", value: "98%" },
  { rank: 2, name: "Aisha", value: "95%" },
  { rank: 3, name: "Rohit", value: "93%" },
  { rank: 4, name: "Neha", value: "91%" },
  { rank: 5, name: "Arjun", value: "89%" },
];

export function HeroSection() {
  return (
    <section className="xophal-hero" aria-label="Xophal hero section">
      <div className="xophal-hero__backdrop" aria-hidden="true" />

      <div className="container relative mx-auto max-w-7xl px-4 pb-14 pt-28 sm:px-6 lg:px-8 lg:pb-20 lg:pt-24">
        <div className="xophal-hero__grid">
          <div className="xophal-hero__content">
            <div className="xophal-hero__brand" aria-label="Xophal">
              <div className="xophal-hero__brand-wordmark">
                <span>Xophal</span>
                <small>MOCK TESTS</small>
              </div>
            </div>

            <div className="xophal-hero__eyebrow">PRACTICE • IMPROVE • ACHIEVE</div>

            <h1 className="xophal-hero__heading">
              Your Success
              <span>Starts with</span>
              <em>Xophal</em>
            </h1>

            <p className="xophal-hero__description">
              Take smart mock tests, track your progress and get one step closer to your dream career.
            </p>

            <div className="xophal-hero__actions">
              <Button asChild size="lg" className="xophal-hero__primary-btn">
                <Link href={ROUTES.tests}>
                  Start Practicing
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Button asChild variant="secondary" size="lg" className="xophal-hero__secondary-btn">
                <Link href={ROUTES.learn}>
                  <span className="xophal-hero__play-badge">
                    <Play className="h-4 w-4 fill-current" />
                  </span>
                  Watch Video
                </Link>
              </Button>
            </div>

            <div className="xophal-hero__features" aria-label="Platform highlights">
              {featureHighlights.map(({ icon: Icon, title }) => (
                <div key={title} className="xophal-hero__feature-item">
                  <span className="xophal-hero__feature-icon">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>{title}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="xophal-hero__visual" aria-label="Xophal dashboard illustration">
            <div className="xophal-hero__visual-shell">
              <div className="xophal-hero__x xophal-hero__x--large" aria-hidden="true" />
              <div className="xophal-hero__x xophal-hero__x--small" aria-hidden="true" />

              <div className="xophal-hero__card xophal-hero__card--mock">
                <div className="xophal-hero__card-header">
                  <div className="xophal-hero__mini-icon">
                    <Check className="h-4 w-4" />
                  </div>
                  <span>Mock Test</span>
                </div>
                <div className="xophal-hero__card-body">
                  <div className="xophal-hero__list-lines" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="xophal-hero__card-cta">
                    <span>Attempt • Improve • Succeed</span>
                    <button type="button" aria-label="Start test">
                      Start Test <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="xophal-hero__card xophal-hero__card--accuracy">
                <div className="xophal-hero__accuracy-circle">
                  <span>85%</span>
                </div>
                <div className="xophal-hero__accuracy-legend">
                  <div><span className="dot dot--correct" />Correct <strong>42</strong></div>
                  <div><span className="dot dot--wrong" />Wrong <strong>6</strong></div>
                  <div><span className="dot dot--skipped" />Skipped <strong>2</strong></div>
                </div>
              </div>

              <div className="xophal-hero__card xophal-hero__card--progress">
                <div className="xophal-hero__progress-head">
                  <span>Your Progress</span>
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="xophal-hero__progress-bars" aria-hidden="true">
                  <span style={{ height: "30%" }} />
                  <span style={{ height: "42%" }} />
                  <span style={{ height: "52%" }} />
                  <span style={{ height: "70%" }} />
                  <span style={{ height: "86%" }} />
                  <span style={{ height: "100%" }} />
                </div>
              </div>

              <div className="xophal-hero__card xophal-hero__card--leaderboard">
                <div className="xophal-hero__leaderboard-head">
                  <span>Top Performers</span>
                </div>
                <div className="xophal-hero__leaderboard-list">
                  {leaderRows.map((item) => (
                    <div key={item.rank} className="xophal-hero__leaderboard-row">
                      <span>{item.rank}</span>
                      <span>{item.name}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="xophal-hero__student" aria-label="Student illustration">
                <div className="xophal-hero__student-head" />
                <div className="xophal-hero__student-body" />
                <div className="xophal-hero__student-laptop">
                  <div className="xophal-hero__laptop-screen">
                    <div className="xophal-hero__laptop-mark" aria-hidden="true" />
                  </div>
                  <div className="xophal-hero__laptop-base" />
                </div>
              </div>

              <div className="xophal-hero__book-stack" aria-hidden="true">
                <span>MATHS</span>
                <span>REASONING</span>
                <span>ENGLISH</span>
                <span>CURRENT AFFAIRS</span>
              </div>

              <div className="xophal-hero__cup" aria-hidden="true" />
              <div className="xophal-hero__plant" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;

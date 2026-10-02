import Link from "next/link";
import { Flame, Play, Sparkles, Target, type LucideIcon, Zap } from "lucide-react";
import { createTranslator, type TextKey } from "@/lib/i18n";
import type { DashboardData } from "@/lib/dashboard/types";

const t = createTranslator("en");
const numberFormat = new Intl.NumberFormat("en-IN");

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * The student product is India-first, so the greeting follows IST instead of the
 * server's timezone. Deterministic for a given instant, which keeps server and
 * client render in agreement.
 */
export function greetingKey(now: Date = new Date()): TextKey {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  if (!Number.isFinite(hour)) return "hero.greetingMorning";
  if (hour < 12) return "hero.greetingMorning";
  if (hour < 17) return "hero.greetingAfternoon";
  if (hour < 21) return "hero.greetingEvening";
  return "hero.greetingNight";
}

/** Decorative progress dial; the value is always also written as text. */
function HeroRing({ percent, tone }: { percent: number; tone?: "blue" | "ice" }) {
  const size = 64;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (clampPercent(percent) / 100) * circumference;

  return (
    <svg className="sx-ring" viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
      <circle className="sx-ring__track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
      <circle
        className={`sx-ring__value${tone ? ` sx-ring__value--${tone}` : ""}`}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference - filled}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

function Vital({
  icon: Icon,
  label,
  figure,
  note,
  percent,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  figure: string;
  note: string;
  percent: number;
  tone?: "blue" | "ice";
}) {
  return (
    <div className="sx-vital">
      <div className="sx-vital__dial">
        <HeroRing percent={percent} tone={tone} />
        <span className="sx-vital__figure">{figure}</span>
      </div>
      <div className="sx-vital__meta">
        <span className="sx-vital__label">
          <Icon aria-hidden="true" />
          {label}
        </span>
        {note ? <span className="sx-vital__note">{note}</span> : null}
      </div>
    </div>
  );
}

/**
 * The dashboard focus hero: greeting, the two primary entry points and a
 * three-dial vitals rail. Every number comes from `DashboardData`, so the hero
 * never shows a placeholder metric.
 */
export default function DashboardHero({
  data,
  fullName,
  now = new Date(),
}: {
  data: DashboardData;
  fullName: string | null;
  now?: Date;
}) {
  const firstName = fullName?.trim().split(/\s+/)[0] ?? "";
  const { streak, level, todayGoal: goal } = data;
  const resumeHref = data.continuation?.href ?? "/learn";

  /* How close the current run sits to the learner's personal best. */
  const streakPercent = streak.hasActivity
    ? clampPercent((streak.current / Math.max(streak.longest, 1)) * 100)
    : 0;
  const xpToNextLevel = Math.max(0, level.nextLevelXp - level.xp);

  return (
    <section className="premium-hero sx-hero" aria-labelledby="hero-title">
      <div className="dashboard-hero-grid" aria-hidden="true" />
      <div className="sx-hero__aura" aria-hidden="true" />
      <div className="sx-hero__inner">
        <div>
          <p className="sx-hero__eyebrow">
            <Sparkles aria-hidden="true" />
            {t("hero.eyebrow")}
          </p>
          <h1 id="hero-title" className="sx-hero__title">
            {firstName ? (
              <>
                {t(greetingKey(now))} <span className="sx-hero__name">{firstName}</span>
              </>
            ) : (
              t("hero.welcomeAnon")
            )}
          </h1>
          <p className="sx-hero__subtitle">{t("hero.subtitle")}</p>
          <div className="sx-hero__ctas">
            <Link href={resumeHref} className="sx-hero__cta sx-hero__cta--primary">
              <Play aria-hidden="true" />
              {t("hero.continuePractice")}
            </Link>
            <Link href="/mock-tests" className="sx-hero__cta sx-hero__cta--ghost">
              <Target aria-hidden="true" />
              {t("hero.takeMockTest")}
            </Link>
          </div>
        </div>

        <div className="sx-hero__rail" role="group" aria-label={t("hero.vitalsLabel")}>
          <Vital
            icon={Flame}
            label={t("hero.vitalStreak")}
            figure={streak.hasActivity ? t("chrome.streakValue", { count: streak.current }) : "—"}
            note={streak.hasActivity ? t("hero.vitalStreakNote", { count: streak.longest }) : t("hero.vitalStreakEmpty")}
            percent={streakPercent}
          />
          <Vital
            icon={Zap}
            label={t("hero.vitalLevel")}
            figure={level.available ? numberFormat.format(level.level) : "—"}
            note={level.available ? t("hero.vitalLevelNote", { xp: numberFormat.format(xpToNextLevel), next: level.level + 1 }) : t("hero.vitalLevelEmpty")}
            percent={level.available ? level.percent : 0}
            tone="ice"
          />
          <Vital
            icon={Target}
            label={t("hero.vitalGoal")}
            figure={goal.hasSignal ? `${clampPercent(goal.percent)}%` : "—"}
            note={goal.hasSignal ? t("hero.vitalGoalNote", { done: goal.completed, total: goal.total }) : t("hero.vitalGoalEmpty")}
            percent={goal.hasSignal ? goal.percent : 0}
            tone="blue"
          />
        </div>
      </div>
    </section>
  );
}

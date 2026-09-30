import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { createTranslator, type TextKey, type TextParams } from "@/lib/i18n";

export const dashboardTranslator = createTranslator("en");

type TFunction = (key: TextKey, params?: TextParams) => string;

/** Readable section shell: eyebrow + title + optional action, with honest source note. */
export function DashboardSection({
  eyebrow,
  title,
  subtitle,
  action,
  source,
  children,
  labelledBy,
  className,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  source?: string;
  children: ReactNode;
  labelledBy: string;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cn(
        "premium-panel dashboard-surface overflow-hidden",
        className
      )}
    >
      <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="min-w-0">
          <p className="dashboard-eyebrow">{eyebrow}</p>
          <h2 id={labelledBy} className="mt-1 text-xl font-semibold text-white">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 max-w-prose text-sm leading-6 text-slate-400">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="p-4 sm:p-6">
        {children}
        {source ? (
          <p className="mt-4 border-t border-white/10 pt-3 text-xs leading-5 text-slate-500">
            {source}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function DashboardEmpty({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="dashboard-empty-state">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
        {description}
      </p>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-cyan-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

/** Accessible progress bar with a text fallback for screen readers. */
export function ProgressBar({
  value,
  label,
  tone = "cyan",
}: {
  value: number;
  label: string;
  tone?: "cyan" | "emerald" | "amber" | "rose" | "violet";
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const tones: Record<string, string> = {
    cyan: "bg-gradient-to-r from-cyan-400 to-sky-500",
    emerald: "bg-gradient-to-r from-emerald-400 to-teal-500",
    amber: "bg-gradient-to-r from-amber-300 to-orange-400",
    rose: "bg-gradient-to-r from-rose-400 to-red-500",
    violet: "bg-gradient-to-r from-violet-400 to-purple-500",
  };
  return (
    <div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-label={label}
        className="h-2 overflow-hidden rounded-full bg-white/10"
      >
        <div
          className={cn("h-full rounded-full transition-[width]", tones[tone])}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="sr-only">
        {label}: {clamped}%
      </span>
    </div>
  );
}

export function TrendGlyph({ trend }: { trend: "up" | "down" | "flat" | "none" }) {
  if (trend === "up") return <span aria-hidden="true">▲</span>;
  if (trend === "down") return <span aria-hidden="true">▼</span>;
  if (trend === "flat") return <span aria-hidden="true">●</span>;
  return <span aria-hidden="true">—</span>;
}

export function DashboardSearchForm({
  action,
  placeholder,
  buttonLabel,
}: {
  action: string;
  placeholder: string;
  buttonLabel: string;
}) {
  return (
    <form action={action} method="get" className="flex flex-col gap-2 sm:flex-row">
      <label htmlFor={`dashboard-search-${action}`} className="sr-only">
        {placeholder}
      </label>
      <input
        id={`dashboard-search-${action}`}
        name="search"
        type="search"
        placeholder={placeholder}
        className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none"
      />
      <button
        type="submit"
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
      >
        {buttonLabel}
      </button>
    </form>
  );
}

export function DashboardFormShell({
  children,
  onSubmitHint,
}: {
  children: ReactNode;
  onSubmitHint?: string;
}) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (onSubmitHint) event.preventDefault();
  }
  return <form onSubmit={onSubmit}>{children}</form>;
}

export { type TFunction };

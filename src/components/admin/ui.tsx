import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type AdminTone = "emerald" | "cyan" | "violet" | "amber" | "rose";

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

/** Root wrapper for every admin screen: shell animation + design-system scope. */
export function AdminPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("admin-page admin-dashboard-shell min-h-screen p-4 md:p-6 lg:p-8", className)}>{children}</div>;
}

/** Consistent page heading: eyebrow, title, description and trailing actions. */
export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="admin-page-header">
      <div className="min-w-0">
        {eyebrow ? <p className="admin-eyebrow">{eyebrow}</p> : null}
        <h1 className="admin-page-title">{title}</h1>
        {description ? <p className="admin-page-desc">{description}</p> : null}
      </div>
      {actions ? <div className="admin-page-actions">{actions}</div> : null}
    </header>
  );
}

/** Premium glass panel with an optional eyebrow/title/icon header row. */
export function AdminPanel({
  eyebrow,
  title,
  icon: Icon,
  actions,
  children,
  className,
  flush,
  bodyClassName,
}: {
  eyebrow?: string;
  title?: string;
  icon?: IconComponent;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
  bodyClassName?: string;
}) {
  const head = title || actions ? (
    <div className="admin-panel-head">
      <div className="min-w-0">
        {eyebrow ? <p className="admin-eyebrow">{eyebrow}</p> : null}
        {title ? <h2 className="admin-panel-title">{title}</h2> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        {Icon ? <Icon className="h-5 w-5 text-cyan-300" aria-hidden /> : null}
      </div>
    </div>
  ) : null;

  return (
    <section className={cn("admin-panel", flush && "admin-panel--flush", className)}>
      {head}
      <div className={cn("admin-panel-body", bodyClassName)}>{children}</div>
    </section>
  );
}

/** KPI stat card built on the premium stat-card surface. */
export function AdminStat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "cyan",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: IconComponent;
  tone?: AdminTone;
  className?: string;
}) {
  return (
    <div className={cn("premium-stat-card admin-stat-card", className)}>
      <div className="min-w-0">
        <p className="admin-stat-label">{label}</p>
        <p className="admin-stat-value">{value}</p>
        {hint ? <p className="admin-stat-hint">{hint}</p> : null}
      </div>
      {Icon ? (
        <span className={cn("admin-stat-icon", `admin-stat-icon--${tone}`)}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      ) : null}
    </div>
  );
}

export type AdminChipTone = "neutral" | "success" | "warning" | "danger" | "info" | "violet";

/**
 * Normalizes list payloads across admin APIs. Some routes return a bare array
 * via `apiSuccess([])` while paginated routes return
 * `apiSuccess({ data: [...], pagination: { total } })`.
 */
export function readList<T>(json: unknown): { items: T[]; total: number } {
  if (Array.isArray(json)) {
    return { items: json as T[], total: json.length };
  }
  const value = json as { data?: unknown; pagination?: { total?: number } } | null;
  const payload = value?.data;
  if (Array.isArray(payload)) {
    return { items: payload as T[], total: Number(value?.pagination?.total ?? payload.length) || 0 };
  }
  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) {
    const nested = (payload as { data: T[]; pagination?: { total?: number } }).data;
    return { items: nested, total: Number((payload as { pagination?: { total?: number } }).pagination?.total ?? nested.length) || 0 };
  }
  return { items: [], total: 0 };
}


/** Status pill used across tables, lists and cards. */
export function AdminChip({ tone = "neutral", children, className }: { tone?: AdminChipTone; children: ReactNode; className?: string }) {
  return <span className={cn("admin-chip", tone !== "neutral" && `admin-chip--${tone}`, className)}>{children}</span>;
}

/** Consistent empty state with icon, title and guidance. */
export function AdminEmpty({
  icon: Icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: IconComponent;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("admin-empty", className)}>
      {Icon ? (
        <span className="admin-empty-icon">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      ) : null}
      <p className="admin-empty-title">{title}</p>
      {hint ? <p className="admin-empty-hint">{hint}</p> : null}
      {action}
    </div>
  );
}

/** Horizontal toolbar for search boxes, filters and primary actions. */
export function AdminToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("admin-toolbar", className)}>{children}</div>;
}

/** Inline loading indicator matching the admin design language. */
export function AdminLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="admin-loading" role="status">
      <span className="dt-spinner" aria-hidden />
      {label}
    </div>
  );
}

/** Shared pagination footer for list pages. */
export function AdminPagination({
  page,
  total,
  limit,
  onPage,
  busy,
}: {
  page: number;
  total: number;
  limit: number;
  onPage: (next: number) => void;
  busy?: boolean;
}) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-400">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={page <= 1 || busy} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={page * limit >= total || busy} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}


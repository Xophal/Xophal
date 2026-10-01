import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  BookOpen,
  Boxes,
  ClipboardList,
  FileText,
  GraduationCap,
  Layers3,
  Newspaper,
  School,
  Settings,
  ShieldCheck,
  Sparkles,
  Ticket,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { AdminPage, AdminPanel } from "@/components/admin/ui";
import AdminMetrics from "@/components/admin/AdminMetrics";
import RecentActivity from "@/components/admin/RecentActivity";
import OverviewInsights from "@/components/admin/OverviewInsights";

const adminModules = [
  { title: "Boards", description: "Add and manage boards like CBSE and SEBA", href: "/admin/boards", icon: School },
  { title: "Classes", description: "Manage classes and board-specific grade tracks", href: "/admin/classes", icon: GraduationCap },
  { title: "Subjects", description: "Organize the subject tree for each class", href: "/admin/subjects", icon: BookOpen },
  { title: "Chapters", description: "Structure chapters inside every subject", href: "/admin/chapters", icon: Layers3 },
  { title: "Topics", description: "Maintain the topic layer under each chapter", href: "/admin/topics", icon: Boxes },
  { title: "Questions", description: "Author, review and publish the question bank", href: "/admin/questions", icon: ShieldCheck },
  { title: "Mock tests", description: "Create and manage timed practice exams", href: "/admin/mock-tests", icon: ClipboardList },
  { title: "Notes", description: "Publish revision notes and study guides", href: "/admin/notes", icon: FileText },
  { title: "eBooks", description: "Review marketplace listings, reports, and settings", href: "/admin/ebooks", icon: BookOpen },
  { title: "Content hub", description: "Manage posts, lessons, and content drafts", href: "/admin/content", icon: Newspaper },
  { title: "Blogs", description: "Write, schedule and publish SEO articles", href: "/admin/blogs", icon: Newspaper },
  { title: "Imports", description: "Validate bulk CSV imports before publishing", href: "/admin/content/imports", icon: Zap },
  { title: "Users", description: "Review accounts, roles, and account activity", href: "/admin/users", icon: Users },
  { title: "Admin requests", description: "Approve or reject new administrator signups", href: "/admin/admin-requests", icon: UserCheck },
  { title: "Roles", description: "Inspect the role catalogue and permissions", href: "/admin/roles", icon: ShieldCheck },
  { title: "Results", description: "Audit mock test results and attempt detail", href: "/admin/results", icon: BarChart3 },
  { title: "Payments", description: "Track orders, refunds and payment status", href: "/admin/payments", icon: Wallet },
  { title: "Subscriptions", description: "Manage plans and member subscriptions", href: "/admin/subscriptions", icon: Layers3 },
  { title: "Coupons", description: "Create discount codes and monitor redemptions", href: "/admin/coupons", icon: Ticket },
  { title: "Notifications", description: "Broadcast announcements to your students", href: "/admin/notifications", icon: BellRing },
  { title: "Reports", description: "Export performance and growth reports", href: "/admin/reports", icon: BarChart3 },
  { title: "Analytics", description: "Track platform usage and test performance", href: "/admin/analytics", icon: BarChart3 },
  { title: "Settings", description: "Review your administrator account and access", href: "/admin/settings", icon: Settings },
];

const quickActions: Array<[string, string]> = [
  ["/admin/content/imports", "Upload import"],
  ["/admin/mock-tests", "Create mock test"],
  ["/admin/blogs", "Write a blog post"],
  ["/admin/notifications", "Send announcement"],
];

export default function AdminDashboardPage() {
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <AdminPage>
      <section className="premium-hero admin-hero relative overflow-hidden rounded-lg border border-white/10 px-5 py-7 sm:px-8 sm:py-9">
        <div className="dashboard-hero-grid" />
        <div className="premium-hero-glow premium-hero-glow--admin" />

        <div className="relative z-10 flex flex-col justify-between gap-8 xl:flex-row xl:items-end">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" /> Executive command center
            </div>
            <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              Run the learning platform like a premium brand.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300 sm:text-base">
              Track growth, monitor operations, and keep every academic workflow moving with clarity and control.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/admin/content/imports"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-xophol-orange px-5 py-2.5 text-sm font-semibold text-xophol-ink transition hover:brightness-95"
              >
                Import content <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/admin/reports"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                View reports
              </Link>
            </div>
          </div>

          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-950/45 p-5 backdrop-blur-xl">
            <p className="dashboard-eyebrow">Today</p>
            <p className="mt-1 text-sm font-semibold text-white">{today}</p>
            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Workspace</span>
                <span className="font-semibold text-white">Xophol control room</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Modules live</span>
                <span className="font-semibold text-white">{adminModules.length}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <AdminPanel eyebrow="Overview" title="Platform snapshot" icon={BarChart3} actions={<span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 sm:inline-flex">All time</span>}>
          <AdminMetrics />
        </AdminPanel>

        <AdminPanel eyebrow="Quick actions" title="Get moving" icon={Zap}>
          <div className="space-y-3">
            {quickActions.map(([href, label]) => (
              <Link
                key={label}
                href={href}
                className="group flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-200 transition hover:border-cyan-400/30 hover:bg-cyan-500/5"
              >
                <span className="font-medium">{label}</span>
                <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" />
              </Link>
            ))}
          </div>
        </AdminPanel>
      </div>

      <div className="mt-6">
        <AdminPanel eyebrow="Intelligence" title="Performance pulse" icon={TrendingUp}>
          <OverviewInsights />
        </AdminPanel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <AdminPanel eyebrow="Operations" title="Recent activity" icon={ClipboardList}>
          <RecentActivity />
        </AdminPanel>

        <AdminPanel eyebrow="Control room" title="Modules" icon={Layers3}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {adminModules.map((module) => (
              <Link
                key={module.title}
                href={module.href}
                className="group premium-module-card rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-cyan-400/30 hover:bg-cyan-500/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="admin-stat-icon" style={{ width: "2.2rem", height: "2.2rem" }}>
                      <module.icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{module.title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-400">{module.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" />
                </div>
              </Link>
            ))}
          </div>
        </AdminPanel>
      </div>
    </AdminPage>
  );
}

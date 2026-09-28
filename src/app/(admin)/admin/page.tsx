import Link from "next/link";
import { ArrowRight, BarChart3, BellRing, BrainCircuit, CalendarRange, Gauge, Layers3, ShieldCheck, Sparkles, TrendingUp, Users, Zap } from "lucide-react";
import AdminMetrics from "@/components/admin/AdminMetrics";
import RecentActivity from "@/components/admin/RecentActivity";

const adminModules = [
  { title: "Create admin", description: "Create a private admin or content-manager account", href: "/admin/create-admin" },
  { title: "Boards", description: "Add and manage boards like CBSE and SEBA", href: "/admin/boards" },
  { title: "Classes", description: "Manage classes and board-specific grade track", href: "/admin/classes" },
  { title: "Subjects", description: "Organize the subject tree for each class", href: "/admin/subjects" },
  { title: "Notes", description: "Publish revision notes and study guides", href: "/admin/notes" },
  { title: "Mock tests", description: "Create and manage timed practice exams", href: "/admin/mock-tests" },
  { title: "Content imports", description: "Validate bulk CSV imports before publishing", href: "/admin/content/imports" },
  { title: "Content hub", description: "Manage posts, lessons, and content drafts", href: "/admin/content" },
  { title: "Users", description: "Review accounts, roles, and account activity", href: "/admin/users" },
  { title: "Admin requests", description: "Approve or reject new administrator signups", href: "/admin/admin-requests" },
  { title: "Analytics", description: "Track platform usage and test performance", href: "/admin/analytics" },
  { title: "Settings", description: "Review your administrator account and access", href: "/admin/settings" },
];

const statCards = [
  { label: "Platform health", value: "98.4%", icon: Gauge, tone: "emerald" },
  { label: "New enrollments", value: "+214", icon: Users, tone: "cyan" },
  { label: "Active tests", value: "18", icon: TrendingUp, tone: "violet" },
  { label: "System alerts", value: "02", icon: BellRing, tone: "amber" },
];

export default function AdminDashboardPage() {
  return (
    <div className="admin-dashboard-shell min-h-screen p-4 md:p-6 lg:p-8">
      <section className="premium-hero admin-hero relative overflow-hidden rounded-[30px] border border-white/10 px-5 py-7 sm:px-8 sm:py-9">
        <div className="dashboard-hero-grid" />
        <div className="premium-hero-glow premium-hero-glow--admin" />

        <div className="relative z-10 flex flex-col justify-between gap-8 xl:flex-row xl:items-end">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" /> Executive command center
            </div>
            <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">Run the learning platform like a premium brand.</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300 sm:text-base">Track growth, monitor operations, and keep every academic workflow moving with clarity and control.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/admin/content/imports" className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
                Import content <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/admin/mock-tests" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">
                Open mock tests <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="w-full max-w-md rounded-[24px] border border-white/10 bg-slate-950/20 p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-slate-300">
              <span>Live pulse</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> online
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Admissions</p>
                <p className="mt-2 text-2xl font-semibold text-white">1,284</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Conversion</p>
                <p className="mt-2 text-2xl font-semibold text-white">34.8%</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-3 text-sm text-slate-200">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan-300" /> Verification backlog</span>
                <span className="font-semibold text-cyan-200">7 items</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className={`premium-stat-card premium-stat-card--${tone}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</span>
              <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-5 text-3xl font-semibold tracking-tight text-white">{value}</div>
            <p className="mt-2 text-xs text-slate-300">Live data updated in real time</p>
          </div>
        ))}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="premium-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="dashboard-eyebrow">Overview</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Platform snapshot</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200">
              <CalendarRange className="h-3.5 w-3.5 text-cyan-300" /> This month
            </div>
          </div>
          <div className="mt-5">
            <AdminMetrics />
          </div>
        </div>

        <div className="premium-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="dashboard-eyebrow">Quick actions</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Get moving</h2>
            </div>
            <Zap className="h-5 w-5 text-amber-300" />
          </div>
          <div className="mt-5 space-y-3">
            {[
              ["/admin/boards", "Create board"],
              ["/admin/classes", "Create class"],
              ["/admin/content/imports", "Upload import"],
              ["/admin/content", "Create content"],
            ].map(([href, label]) => (
              <Link key={label} href={href} className="group flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-200 transition hover:border-cyan-400/30 hover:bg-cyan-500/5">
                <span className="font-medium">{label}</span>
                <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="premium-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="dashboard-eyebrow">Operations</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Recent activity</h2>
            </div>
            <BrainCircuit className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="mt-5">
            <RecentActivity />
          </div>
        </div>

        <div className="premium-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="dashboard-eyebrow">Control room</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Modules</h2>
            </div>
            <Layers3 className="h-5 w-5 text-violet-300" />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {adminModules.map((module) => (
              <Link key={module.title} href={module.href} className="group premium-module-card rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-cyan-400/30 hover:bg-cyan-500/5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{module.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{module.description}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

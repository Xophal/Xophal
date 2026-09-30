import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import Sidenav from "@/components/layout/sidenav";
import StudentBottomNav from "@/components/layout/StudentBottomNav";
import { requireAuth } from "@/lib/auth";
import { assertAccess } from "@/lib/auth-policy";
import { isAdminRole } from "@/lib/roles";
import { ROUTES } from "@/constants";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import StudentHeaderActions from "@/components/layout/StudentHeaderActions";
import { createTranslator } from "@/lib/i18n";

const t = createTranslator("en");

const navItems = [
  { href: ROUTES.dashboard, icon: "LayoutDashboard", label: t("nav.dashboard"), group: t("nav.group.home") },
  { href: "/subjects", icon: "GraduationCap", label: t("nav.exams"), group: t("nav.group.prepare") },
  { href: "/mock-tests", icon: "Target", label: t("nav.mockTests"), group: t("nav.group.prepare") },
  { href: ROUTES.learn, icon: "BookOpen", label: t("nav.practice"), group: t("nav.group.prepare") },
  { href: "/previous-year-papers", icon: "FileText", label: t("nav.pyqs"), group: t("nav.group.prepare") },
  { href: ROUTES.analytics, icon: "BarChart3", label: t("nav.performance"), group: t("nav.group.progress") },
  { href: "/dashboard#mastery-title", icon: "ChartNoAxesCombined", label: t("nav.topicMastery"), group: t("nav.group.progress") },
  { href: "/dashboard#wrong-answers", icon: "RotateCcw", label: t("nav.wrongAnswers"), group: t("nav.group.progress") },
  { href: ROUTES.leaderboard, icon: "Medal", label: t("nav.leaderboard"), group: t("nav.group.compete") },
  { href: ROUTES.achievements, icon: "Trophy", label: t("nav.achievements"), group: t("nav.group.compete") },
  { href: ROUTES.profile, icon: "UserRound", label: t("nav.profile"), group: t("nav.group.account") },
  { href: ROUTES.notifications, icon: "Bell", label: t("menu.notifications"), group: t("nav.group.account") },
  { href: ROUTES.settings, icon: "Settings", label: t("nav.settings"), group: t("nav.group.account") },
];

const topNavItems = [
  { href: ROUTES.dashboard, label: t("nav.dashboard") },
  { href: "/subjects", label: t("nav.exams") },
  { href: "/mock-tests", label: t("nav.mockTests") },
  { href: ROUTES.learn, label: t("nav.practice") },
  { href: "/previous-year-papers", label: t("nav.pyqs") },
  { href: ROUTES.leaderboard, label: t("nav.leaderboard") },
];

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuth();
  if (!session) redirect(ROUTES.login);
  if (isAdminRole(session.profile)) redirect("/admin");

  try {
    assertAccess(session.profile, session.user, {
      requireAuth: true,
      requireActive: true,
      requireEmailVerified: true,
      allowRoles: ["student"],
    });
  } catch {
    notFound();
  }

  const firstName = session.profile?.full_name?.split(" ")[0] || "Student";

  return (
    <div className="min-h-screen overflow-x-clip bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.12),transparent_22%),hsl(var(--background))] text-foreground">
      <div className="mx-auto flex max-w-[1600px] gap-4 p-0 lg:p-5">
        {/* Desktop rail. Hidden below lg, where the bottom nav takes over. */}
        <div className="hidden lg:block">
          <Sidenav items={navItems} profile={session.profile} />
        </div>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:min-h-[calc(100vh-2.5rem)]">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border border-border/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.82),rgba(15,23,42,0.68))] px-4 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:h-20 lg:rounded-t-[28px] lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex min-w-0 items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200 lg:text-[11px]">
                <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Student app</span>
                <span className="sm:hidden">Xophol</span>
              </div>
              <span className="hidden truncate text-sm font-medium text-slate-300 md:inline">
                {firstName}&apos;s learning hub
              </span>
            </div>

            <nav className="hidden min-w-0 flex-1 items-center justify-center gap-3 overflow-x-auto px-2 xl:flex 2xl:gap-5" aria-label={t("nav.primary")}>
              {topNavItems.map((item) => (
                <Link key={item.href} href={item.href} className="shrink-0 rounded-md px-1 py-2 text-xs font-medium text-slate-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 2xl:text-sm">
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-2">
              <StudentHeaderActions />
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 pb-20 lg:pb-0">
            <div className="mx-auto w-full max-w-[1500px] p-3 sm:p-4 md:p-6 lg:p-8">{children}</div>
          </main>

          <StudentBottomNav />
        </div>
      </div>
    </div>
  );
}

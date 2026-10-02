import { notFound, redirect } from "next/navigation";
import Sidenav from "@/components/layout/sidenav";
import StudentBottomNav from "@/components/layout/StudentBottomNav";
import { requireAuth } from "@/lib/auth";
import { assertAccess } from "@/lib/auth-policy";
import { getDashboardRoute } from "@/lib/roles";
import { ROUTES } from "@/constants";
import StudentCommandBar from "@/components/layout/StudentCommandBar";
import { createTranslator } from "@/lib/i18n";

const t = createTranslator("en");

const navItems = [
  { href: ROUTES.dashboard, icon: "LayoutDashboard", label: t("nav.dashboard"), group: t("nav.group.home") },
  { href: "/subjects", icon: "GraduationCap", label: t("nav.exams"), group: t("nav.group.prepare") },
  { href: "/mock-tests", icon: "Target", label: t("nav.mockTests"), group: t("nav.group.prepare") },
  { href: "/dashboard/ebooks", icon: "BookOpen", label: "My eBooks", group: t("nav.group.account") },
  { href: ROUTES.learn, icon: "BookOpen", label: t("nav.practice"), group: t("nav.group.prepare") },
  { href: "/previous-year-papers", icon: "FileText", label: t("nav.pyqs"), group: t("nav.group.prepare") },
  { href: "/dashboard#challenge-title", icon: "Flame", label: t("nav.dailyChallenge"), group: t("nav.group.prepare") },
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
  { href: "/dashboard#challenge-title", label: t("nav.dailyChallenge") },
  { href: ROUTES.leaderboard, label: t("nav.leaderboard") },
];

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuth();
  if (!session) redirect(ROUTES.login);
  if (!session.profile) redirect("/verify-email");
  const dashboardRoute = getDashboardRoute(session.profile);
  if (dashboardRoute === "/admin") redirect(dashboardRoute);

  if (!session.profile.email_verified && !session.user.email_confirmed_at) {
    redirect("/verify-email");
  }

  if (dashboardRoute !== ROUTES.dashboard) redirect(dashboardRoute);

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
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <div className="mx-auto flex max-w-[1600px] gap-4 p-0 lg:p-5">
        {/* Desktop rail. Hidden below lg, where the bottom nav takes over. */}
        <div className="hidden lg:block">
          <Sidenav items={navItems} profile={session.profile} />
        </div>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:min-h-[calc(100vh-2.5rem)]">
          <StudentCommandBar
            items={topNavItems}
            fullName={session.profile?.full_name ?? null}
            email={session.profile?.email ?? null}
            firstName={firstName}
            totalXp={session.profile?.total_xp ?? 0}
            currentStreak={session.profile?.current_streak ?? 0}
          />

          <main className="flex-1 pb-20 lg:pb-0">
            <div className="mx-auto w-full max-w-[1500px] p-3 sm:p-4 md:p-6 lg:p-8">{children}</div>
          </main>

          <StudentBottomNav />
        </div>
      </div>
    </div>
  );
}

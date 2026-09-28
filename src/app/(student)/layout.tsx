import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import Sidenav from "@/components/layout/sidenav";
import StudentBottomNav from "@/components/layout/StudentBottomNav";
import { requireAuth } from "@/lib/auth";
import { assertAccess } from "@/lib/auth-policy";
import { ROUTES } from "@/constants";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import StudentHeaderActions from "@/components/layout/StudentHeaderActions";

const navItems = [
  { href: ROUTES.dashboard, icon: "LayoutDashboard", label: "Dashboard" },
  { href: ROUTES.learn, icon: "BookOpen", label: "Learn" },
  { href: "/mock-tests", icon: "Target", label: "Mock Tests" },
  { href: ROUTES.analytics, icon: "BarChart3", label: "Analytics" },
  { href: ROUTES.bookmarks, icon: "Bookmark", label: "Bookmarks" },
  { href: ROUTES.studyPlanner, icon: "Brain", label: "Study Planner" },
  { href: ROUTES.achievements, icon: "Trophy", label: "Achievements" },
  { href: ROUTES.settings, icon: "Settings", label: "Settings" },
];

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuth();
  if (!session) redirect(ROUTES.login);

  try {
    assertAccess(session.profile, session.user, {
      requireAuth: true,
      requireActive: true,
      requireEmailVerified: true,
      allowRoles: ["student"],
    });
  } catch {
    redirect(ROUTES.dashboard);
  }

  if (
    session.profile &&
    session.profile.roles &&
    Array.isArray(session.profile.roles) &&
    session.profile.roles.some((role) => role?.code === "admin" || role?.code === "super_admin" || role?.code === "content_manager")
  ) {
    redirect("/admin");
  }

  const firstName = session.profile?.full_name?.split(" ")[0] || "Student";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.12),transparent_22%),hsl(var(--background))] text-foreground">
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

            <div className="flex shrink-0 items-center gap-2">
              <StudentHeaderActions />
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 pb-24 lg:pb-0">
            <div className="mx-auto w-full max-w-[1500px] p-4 md:p-6 lg:p-8">{children}</div>
          </main>

          <StudentBottomNav />
        </div>
      </div>
    </div>
  );
}

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
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-[1600px] gap-4 p-0 lg:p-5">
        {/* Desktop rail. Hidden below lg, where the bottom nav takes over. */}
        <div className="hidden lg:block">
          <Sidenav items={navItems} profile={session.profile} />
        </div>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:min-h-[calc(100vh-2.5rem)]">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 backdrop-blur-md lg:h-20 lg:rounded-t-[28px] lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex min-w-0 items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary lg:text-[11px]">
                <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Student app</span>
                <span className="sm:hidden">Xophal</span>
              </div>
              <span className="hidden truncate text-sm font-medium text-muted-foreground md:inline">
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

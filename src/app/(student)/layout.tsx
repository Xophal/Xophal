import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import Sidenav from "@/components/layout/sidenav";
import { requireAuth } from "@/lib/auth";
import { assertAccess } from "@/lib/auth-policy";
import { ROUTES } from "@/constants";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import StudentHeaderActions from "@/components/layout/StudentHeaderActions";

const navItems = [
  { href: ROUTES.dashboard, icon: "LayoutDashboard", label: "Dashboard" },
  { href: ROUTES.learn, icon: "BookOpen", label: "Learn" },
  { href: ROUTES.tests, icon: "Target", label: "Tests" },
  { href: ROUTES.analytics, icon: "BarChart3", label: "Analytics" },
  { href: ROUTES.bookmarks, icon: "Bookmark", label: "Bookmarks" },
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

  if (session.profile && session.profile.roles && Array.isArray(session.profile.roles) && session.profile.roles.some((role) => role?.code === "admin" || role?.code === "super_admin" || role?.code === "content_manager")) {
    redirect("/admin");
  }

  const firstName = session.profile?.full_name?.split(" ")[0] || "Student";

  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.10),transparent_25%),radial-gradient(circle_at_bottom_right,_rgba(96,165,250,0.10),transparent_28%),linear-gradient(180deg,#f5f7f4_0%,#edf2f1_100%)] text-foreground dark:bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),transparent_22%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.16),transparent_28%),linear-gradient(180deg,#06130f_0%,#090f17_100%)]">
      <div className="mx-auto flex max-w-[1600px] gap-4 p-3 md:p-5">
        <Sidenav items={navItems} profile={session.profile} />

        <div className="flex min-h-[calc(100vh-1.5rem)] flex-1 flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/70 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/65 dark:shadow-[0_30px_80px_rgba(2,6,23,0.55)]">
          <header className="flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/40 px-4 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/20 md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" />
                Student app
              </div>
              <div className="hidden items-center gap-2 md:flex">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{firstName}&apos;s learning hub</span>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2 md:gap-3">
              <StudentHeaderActions />
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 overflow-auto bg-[linear-gradient(180deg,transparent_0%,rgba(15,23,42,0.02)_100%)]">
            <div className="mx-auto w-full max-w-[1500px] p-4 md:p-6 lg:p-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

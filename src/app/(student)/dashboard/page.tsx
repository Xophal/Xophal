import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, RefreshCw } from "lucide-react";
import { createTranslator } from "@/lib/i18n";
import StudentDashboard from "@/components/dashboard/StudentDashboard";
import { resolveLeaderboardPeriod, loadDashboardData } from "@/lib/dashboard/queries";
import { requireAuth } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { ROUTES } from "@/constants";

export const metadata = { title: "Student Dashboard" };
const t = createTranslator("en");

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string }>;
}) {
  const session = await requireAuth();
  if (!session?.profile) redirect(ROUTES.login);
  if (isAdminRole(session.profile)) redirect("/admin");

  const params = await searchParams;
  const period = resolveLeaderboardPeriod(params?.period);
  const profile = session.profile;

  let data: Awaited<ReturnType<typeof loadDashboardData>>;
  try {
    data = await loadDashboardData(
      {
        id: profile.id,
        full_name: profile.full_name,
        total_xp: profile.total_xp,
        daily_goal_minutes: profile.daily_goal_minutes,
        board_id: profile.board_id,
        class_id: profile.class_id,
      },
      { leaderboardPeriod: period }
    );

  } catch (error) {
    console.error("[dashboard] data load failed", error instanceof Error ? error.message : error);
    return (
      <section className="premium-panel dashboard-surface mx-auto max-w-2xl p-6 text-center sm:p-8" aria-labelledby="dashboard-error-title">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-400/10 text-rose-200">
          <RefreshCw className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 id="dashboard-error-title" className="mt-4 text-xl font-semibold text-white">{t("dashboard.errorTitle")}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">{t("dashboard.errorDescription")}</p>
        <Link href="/dashboard" className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-bold text-slate-950 hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          {t("state.retry")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    );
  }

  return <StudentDashboard data={data} fullName={profile.full_name} period={period} />;
}
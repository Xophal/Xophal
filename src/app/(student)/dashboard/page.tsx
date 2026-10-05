import { redirect } from "next/navigation";
import StudentDashboard from "@/components/dashboard/StudentDashboard";
import { requireAuth } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { loadDashboardData, resolveLeaderboardPeriod } from "@/lib/dashboard/queries";
import type { DashboardProfile } from "@/lib/dashboard/queries";
import { ROUTES } from "@/constants";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const session = await requireAuth();
  if (!session?.profile) redirect(ROUTES.login);

  if (isAdminRole(session.profile)) {
    redirect("/admin");
  }

  const profile: DashboardProfile = {
    id: session.profile.id,
    full_name: session.profile.full_name,
    total_xp: session.profile.total_xp,
    daily_goal_minutes: session.profile.daily_goal_minutes,
    board_id: session.profile.board_id,
    class_id: session.profile.class_id,
  };
  const params = await searchParams;
  const periodValue = Array.isArray(params.period) ? params.period[0] : params.period;
  const period = resolveLeaderboardPeriod(periodValue);
  const data = await loadDashboardData(profile, { leaderboardPeriod: period });
  const isLocalPreview = process.env.NODE_ENV !== "production" && profile.id.startsWith("local-dev-");

  return <StudentDashboard data={data} fullName={profile.full_name} period={period} isLocalPreview={isLocalPreview} />;
}

import { redirect } from "next/navigation";
import StudentDashboard from "@/components/dashboard/StudentDashboard";
import { requireAuth } from "@/lib/auth";
import { loadDashboardData, resolveLeaderboardPeriod } from "@/lib/dashboard/queries";
import { isAdminRole } from "@/lib/roles";
import { ROUTES } from "@/constants";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await requireAuth();
  if (!session?.profile) redirect(ROUTES.login);

  if (isAdminRole(session.profile)) {
    redirect("/admin");
  }

  const params = await searchParams;
  const periodValue = typeof params.period === "string"
    ? params.period
    : Array.isArray(params.period)
      ? params.period[0]
      : undefined;

  const leaderboardPeriod = resolveLeaderboardPeriod(periodValue);

  const data = await loadDashboardData(
    {
      id: session.profile.id,
      full_name: session.profile.full_name,
      total_xp: session.profile.total_xp ?? 0,
      daily_goal_minutes: session.profile.daily_goal_minutes ?? 0,
      board_id: session.profile.board_id,
      class_id: session.profile.class_id,
    },
    { leaderboardPeriod }
  );

  return <StudentDashboard data={data} fullName={session.profile.full_name} period={leaderboardPeriod} />;
}

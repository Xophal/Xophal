import Link from "next/link";
import { Award, ArrowRight, CalendarDays } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildAchievementSummary } from "@/lib/dashboard/metrics";

export const metadata = { title: "Achievements" };

export default async function AchievementsPage() {
  const session = await requireAuth();

  if (!session?.profile) {
    return <div className="p-8 text-sm text-muted-foreground">Please sign in to view achievements.</div>;
  }

  const supabase = await createClient();
  const [catalogResult, earnedResult] = await Promise.all([
    supabase
      .from("achievements")
      .select("id, code, name, description, xp_reward")
      .eq("is_active", true)
      .order("xp_reward", { ascending: true }),
    supabase
      .from("user_achievements")
      .select("achievement_id, earned_at")
      .eq("user_id", session.profile.id),
  ]);

  const loadError = catalogResult.error || earnedResult.error;
  const achievements = loadError
    ? null
    : buildAchievementSummary({
        catalog: catalogResult.data ?? [],
        earned: earnedResult.data ?? [],
      });
  const earnedAchievements = achievements?.items.filter((item) => item.unlocked) ?? [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase text-xophol-orange">Your progress</p>
        <h1 className="mt-2 text-3xl font-semibold text-xophol-blue">Achievements</h1>
        <p className="mt-2 text-sm text-muted-foreground">Celebrate your progress and milestones.</p>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-destructive/30 bg-card p-6" role="alert">
          <h2 className="font-semibold">Achievements are unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">Your progress is safe. Try again later.</p>
        </div>
      ) : (
        <>
          <section className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5" aria-label="Achievement progress">
            <div>
              <p className="text-sm text-muted-foreground">Earned badges</p>
              <p className="mt-1 text-3xl font-bold text-xophol-blue">{achievements?.unlocked ?? 0}<span className="text-base font-medium text-muted-foreground"> / {achievements?.total ?? 0}</span></p>
            </div>
            <Link href="/mock-tests" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-xophol-orange px-4 text-sm font-semibold text-xophol-ink hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Practice for your next badge <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>

          {earnedAchievements.length ? (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {earnedAchievements.map((achievement) => (
                <li key={achievement.id} className="flex min-h-32 gap-4 rounded-lg border border-border bg-card p-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-xophol-lightBlue text-xophol-blue">
                    <Award className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-foreground">{achievement.name}</h2>
                    {achievement.description ? <p className="mt-1 text-sm text-muted-foreground">{achievement.description}</p> : null}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {achievement.earnedAt ? <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />Earned {new Date(achievement.earnedAt).toLocaleDateString("en-IN")}</span> : null}
                      <span>{achievement.xpReward} XP</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center" role="status">
              <Award className="mx-auto h-9 w-9 text-xophol-blue" aria-hidden="true" />
              <h2 className="mt-3 font-semibold">No badges earned yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">Your earned achievements will appear here as you progress.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

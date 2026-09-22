import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Leaderboard" };

export default async function LeaderboardPage() {
  const session = await requireAuth();

  if (!session?.profile) {
    return <div className="p-8 text-sm text-muted-foreground">Please sign in to view the leaderboard.</div>;
  }

  const supabase = await createClient();
  const { data: entries } = await supabase.from("leaderboard_entries").select("rank, total_xp, tests_completed, profiles(full_name)").order("rank", { ascending: true }).limit(20);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Leaderboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">See top performers and track your position.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top learners</CardTitle>
          <CardDescription>Rankings update as students complete more tests and lessons.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {entries && entries.length > 0 ? entries.map((item) => {
              const profile = item.profiles as unknown as { full_name?: string | null } | { full_name?: string | null }[] | null;
              const name = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;
              return (
              <div key={item.rank} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">#{item.rank} {name || "Learner"}</p>
                </div>
                <span className="text-sm text-muted-foreground">{item.total_xp} XP</span>
              </div>
              );
            }) : <p className="text-sm text-muted-foreground">Leaderboard results will appear after students complete tests.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

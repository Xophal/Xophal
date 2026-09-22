import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";

export const metadata = { title: "Achievements" };

export default async function AchievementsPage() {
  const session = await requireAuth();

  if (!session?.profile) {
    return <div className="p-8 text-sm text-muted-foreground">Please sign in to view achievements.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Achievements</h1>
        <p className="mt-2 text-sm text-muted-foreground">Celebrate your progress and milestones.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>Your unlocked badges and rank milestones will appear here.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No achievements unlocked yet. Keep learning to earn your first badge.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

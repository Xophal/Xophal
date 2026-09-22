import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";
import { buildFallbackStudyPlan, type StudyPlanDay } from "@/lib/ai-planner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function StudyPlannerPage() {
  const session = await requireAuth();
  if (!session?.user) {
    return <div className="p-8 text-sm text-muted-foreground">Please sign in to view your study planner.</div>;
  }

  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("ai_study_plans")
    .select("id, title, plan_data, created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const plan = plans?.[0]?.plan_data ?? buildFallbackStudyPlan({
    goal: "Improve exam readiness",
    board: session.profile?.board_id ? "Board-based" : "CBSE",
    className: "Current class",
    topics: ["Core concepts", "Practice questions"],
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold">AI study planner</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          This starter planner generates a simple 7-day roadmap and stores it for the signed-in student.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{plan.title}</CardTitle>
          <CardDescription>{plan.summary}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan.days.map((day: StudyPlanDay, index: number) => (
            <div key={index} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{day.day}</p>
                <span className="text-sm text-muted-foreground">{day.durationMinutes} min</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{day.theme}</p>
              <p className="text-sm">{day.focus}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

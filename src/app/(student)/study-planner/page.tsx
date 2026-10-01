import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";
import { buildFallbackStudyPlan, studyPlanSchema } from "@/lib/ai-planner";
import StudyPlanGenerator from "@/components/study-planner/StudyPlanGenerator";

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
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1);

  const storedPlan = studyPlanSchema.safeParse(plans?.[0]?.plan_data);
  const plan = storedPlan.success ? storedPlan.data : buildFallbackStudyPlan({
    goal: "Improve exam readiness",
    board: session.profile?.board_id ? "Board-based" : "CBSE",
    className: "Current class",
    topics: ["Core concepts", "Practice questions"],
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold">Study planner</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Build a seven-day plan around the subjects and goals you want to work on.
        </p>
      </div>
      <StudyPlanGenerator initialPlan={plan} />
    </div>
  );
}

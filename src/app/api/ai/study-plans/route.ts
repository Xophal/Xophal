import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError, validateBody } from "@/lib/api-utils";
import { z } from "zod";
import { buildFallbackStudyPlan } from "@/lib/ai-planner";

const studyPlanSchema = z.object({
  goal: z.string().min(3),
  board: z.string().optional(),
  className: z.string().optional(),
  topics: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = await validateBody(studyPlanSchema, body);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email_confirmed_at) {
      return apiError("Authentication required", 401, "UNAUTHORIZED");
    }

    const plan = buildFallbackStudyPlan(payload);
    const { data, error } = await supabase
      .from("ai_study_plans")
      .insert([
        {
          user_id: user.id,
          title: plan.title,
          plan_data: plan,
          start_date: new Date().toISOString().slice(0, 10),
          end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          is_active: true,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return apiSuccess({ plan, record: data });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from "next/server";
import { ApiError, apiSuccess, apiError, handleApiError, validateBody, assertTrustedOrigin } from "@/lib/api-utils";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { isStudentRole } from "@/lib/roles";
import { aiRateLimit } from "@/lib/redis";
import { createClient } from "@/lib/supabase/server";
import { generateStudyPlan } from "@/lib/ai-planner";

const studyPlanSchema = z.object({
  goal: z.string().trim().min(3).max(300),
  board: z.string().trim().max(80).optional(),
  className: z.string().trim().max(40).optional(),
  topics: z.array(z.string().trim().min(1).max(100)).max(8).optional(),
}).strict();

const MAX_BODY_BYTES = 8 * 1024;

async function readLimitedJson(request: NextRequest): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    throw new ApiError(413, "Request body is too large.", "PAYLOAD_TOO_LARGE");
  }

  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "A JSON request body is required.", "INVALID_JSON");

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new ApiError(413, "Request body is too large.", "PAYLOAD_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.", "INVALID_JSON");
  }
}

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const session = await requireAuth();

    if (!session?.profile) {
      return apiError("Authentication required", 401, "UNAUTHORIZED");
    }
    if (!isStudentRole(session.profile)) {
      return apiError("Student access is required.", 403, "FORBIDDEN");
    }

    if (!aiRateLimit && process.env.NODE_ENV === "production") {
      throw new ApiError(503, "Study plan generation is temporarily unavailable.", "RATE_LIMIT_NOT_CONFIGURED");
    }
    if (aiRateLimit) {
      const { success } = await aiRateLimit.limit(`study-plan:${session.user.id}`);
      if (!success) throw new ApiError(429, "You have reached the study plan limit. Try again later.", "RATE_LIMIT");
    }

    const payload = await validateBody(studyPlanSchema, await readLimitedJson(request));
    const plan = await generateStudyPlan(payload);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ai_study_plans")
      .insert({
        user_id: session.user.id,
        title: plan.title,
        plan_data: plan,
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    const { error: archiveError } = await supabase
      .from("ai_study_plans")
      .update({ is_active: false })
      .eq("user_id", session.user.id)
      .eq("is_active", true)
      .neq("id", data.id);
    if (archiveError) console.warn("[ai-study-planner] Could not archive older active plans.");

    return apiSuccess({ plan, source: plan.source, record: data });
  } catch (error) {
    return handleApiError(error);
  }
}

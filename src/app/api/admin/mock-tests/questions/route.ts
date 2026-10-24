import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { ApiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { createAdminClient } from "@/lib/supabase/admin";

const querySchema = z.object({
  boardId: z.string().uuid(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  chapterId: z.string().uuid().optional(),
  topicId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional().default(""),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdminRole(["super_admin", "admin", "content_manager"]);
    const params = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const admin = createAdminClient();

    const { data: classRow, error: classError } = await admin
      .from("classes")
      .select("id,board_id")
      .eq("id", params.classId)
      .maybeSingle();
    if (classError) throw classError;
    if (!classRow || classRow.board_id !== params.boardId) {
      throw new ApiError(400, "The selected class does not belong to that board.", "INVALID_CURRICULUM");
    }

    const { data: subject, error: subjectError } = await admin
      .from("subjects")
      .select("id,class_id")
      .eq("id", params.subjectId)
      .maybeSingle();
    if (subjectError) throw subjectError;
    if (!subject || subject.class_id !== params.classId) {
      throw new ApiError(400, "The selected subject does not belong to that class.", "INVALID_CURRICULUM");
    }

    if (params.chapterId) {
      const { data: chapter, error } = await admin
        .from("chapters")
        .select("id,subject_id")
        .eq("id", params.chapterId)
        .maybeSingle();
      if (error) throw error;
      if (!chapter || chapter.subject_id !== params.subjectId) {
        throw new ApiError(400, "The selected chapter does not belong to that subject.", "INVALID_CURRICULUM");
      }
    }

    if (params.topicId) {
      if (!params.chapterId) throw new ApiError(400, "Choose a chapter before selecting a topic.", "INVALID_CURRICULUM");
      const { data: topic, error } = await admin
        .from("topics")
        .select("id,chapter_id")
        .eq("id", params.topicId)
        .maybeSingle();
      if (error) throw error;
      if (!topic || topic.chapter_id !== params.chapterId) {
        throw new ApiError(400, "The selected topic does not belong to that chapter.", "INVALID_CURRICULUM");
      }
    }

    let query = admin
      .from("questions")
      .select("id,stem,question_text,engine_type,marks,negative_marks,time_seconds,est_time_sec,subject_id,chapter_id,topic_id,question_type:question_types(code,name),question_options(id,label,body,option_text,is_correct,position,sort_order)")
      .eq("subject_id", params.subjectId)
      .eq("status", "published")
      .eq("is_active", true)
      .not("topic_id", "is", null)
      .gte("time_seconds", 1)
      .lte("time_seconds", 60)
      .gte("est_time_sec", 1)
      .lte("est_time_sec", 60)
      .order("created_at", { ascending: false })
      .limit(500);
    if (params.chapterId) query = query.eq("chapter_id", params.chapterId);
    if (params.topicId) query = query.eq("topic_id", params.topicId);
    if (params.search) query = query.ilike("question_text", `%${params.search.replace(/[%_,()]/g, "")}%`);

    const { data, error } = await query;
    if (error) throw error;
    return apiSuccess(data ?? []);
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPaginationParams, paginatedResponse, apiSuccess, apiError, handleApiError, validateBody, ApiError } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const mockTestCreateSchema = z.object({
  test_type_id: z.string().uuid().optional(),
  scope_type: z.enum(["topic_test", "chapter_test", "subject_test", "full_mock"]).optional(),
  title: z.string().min(2).max(500),
  slug: z.string().min(2).max(500),
  description: z.string().optional().or(z.literal("")),
  subject_id: z.string().uuid().nullable().optional(),
  chapter_id: z.string().uuid().nullable().optional(),
  topic_id: z.string().uuid().nullable().optional(),
  board_id: z.string().uuid().optional(),
  class_id: z.string().uuid().optional(),
  question_ids: z.array(z.string().uuid()).min(1).max(500).optional(),
  duration_minutes: z.number().int().positive().optional().default(45),
  duration_minutes_override: z.number().int().positive().optional(),
  total_marks_override: z.number().min(0).finite().optional(),
  access_price: z.number().min(0).finite().optional().default(0),
  passing_marks: z.number().optional(),
  negative_marking: z.boolean().optional().default(false),
  negative_marks_ratio: z.number().min(0).max(1).optional().default(0.25),
  shuffle_questions: z.boolean().optional().default(true),
  shuffle_options: z.boolean().optional().default(true),
  is_premium: z.boolean().optional().default(false),
  is_published: z.boolean().optional().default(false),
  year: z.number().int().optional(),
  instructions: z.string().optional().or(z.literal("")),
  is_active: z.boolean().optional().default(true),
});

export async function GET(request: NextRequest) {
  try {
    await checkRateLimit(request);

    const { searchParams } = request.nextUrl;
    const { page, limit, offset } = getPaginationParams(searchParams);
    const boardSlug = searchParams.get("boardSlug");
    const classSlug = searchParams.get("classSlug");
    const subjectSlug = searchParams.get("subjectSlug");
    const testTypeCode = searchParams.get("testType");
    const search = searchParams.get("search")?.trim().replace(/[%_,()]/g, "") || "";
    const sort = searchParams.get("sort") || "newest";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let hasPremiumAccess = false;
    const grantedTestIds = new Set<string>();

    if (user?.email_confirmed_at) {
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .limit(1)
        .maybeSingle();
      hasPremiumAccess = !!subscription;
      if (!hasPremiumAccess) {
        const { data: grants } = await supabase
          .from("test_access_grants")
          .select("mock_test_id")
          .eq("user_id", user.id);
        for (const grant of grants ?? []) grantedTestIds.add(grant.mock_test_id);
      }
    }

    let query = supabase
      .from("mock_tests")
      .select(
        "id, test_type_id, title, slug, description, subject_id, chapter_id, total_questions, total_marks, duration_minutes, is_premium, year, test_types(code, name), subjects(name), chapters(name)",
        { count: "exact" }
      )
      .eq("is_published", true)
      .eq("is_active", true)
      .gt("total_questions", 0)
      .gt("duration_minutes", 0);

    if (!hasPremiumAccess && grantedTestIds.size === 0) query = query.eq("is_premium", false);
    if (!hasPremiumAccess && grantedTestIds.size > 0) {
      query = query.or(`is_premium.eq.false,id.in.(${Array.from(grantedTestIds).join(",")})`);
    }

    if (testTypeCode) {
      const { data: testType } = await supabase
        .from("test_types")
        .select("id")
        .eq("code", testTypeCode)
        .single();
      if (testType) query = query.eq("test_type_id", testType.id);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (subjectSlug && boardSlug && classSlug) {
      const { data: subject } = await supabase
        .from("subjects")
        .select("id, classes!inner(slug, boards!inner(slug))")
        .eq("slug", subjectSlug)
        .eq("classes.slug", classSlug)
        .eq("classes.boards.slug", boardSlug)
        .single();
      if (subject) query = query.eq("subject_id", subject.id);
    }

    const sortColumn = sort === "oldest" ? "created_at" : sort === "alphabetical" ? "title" : "created_at";
    const { data, error, count } = await query
      .order(sortColumn, { ascending: sort === "oldest" || sort === "alphabetical" })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return apiSuccess(paginatedResponse(data || [], count || 0, page, limit));
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") {
      return apiError("Too many requests", 429, "RATE_LIMIT");
    }
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminRole(["super_admin", "admin", "content_manager"]);
    const body = await request.json();
    const payload = await validateBody(mockTestCreateSchema, body);
    const adminClient = createAdminClient();

    const { data: duplicateSlug } = await adminClient
      .from("mock_tests")
      .select("id")
      .eq("slug", payload.slug)
      .maybeSingle();
    if (duplicateSlug) {
      throw new ApiError(409, "A mock test with this slug already exists.", "DUPLICATE_SLUG");
    }

    const questionIds = payload.question_ids ? [...new Set(payload.question_ids)] : [];
    if (payload.question_ids && questionIds.length !== payload.question_ids.length) {
      throw new ApiError(400, "A question can only be selected once.", "DUPLICATE_QUESTION");
    }

    let totalQuestions = 0;
    let totalMarks = 0;
    let durationMinutes = payload.duration_minutes;
    const questionMarks = new Map<string, number>();
    let curriculumMetadata: Record<string, unknown> | null = null;
    if (questionIds.length) {
      if (!payload.board_id || !payload.class_id || !payload.subject_id || !payload.scope_type) {
        throw new ApiError(400, "Choose a board, class, subject, test scope, and questions.", "MISSING_TEST_SCOPE");
      }

      const { data: classRow, error: classError } = await adminClient
        .from("classes")
        .select("id,board_id")
        .eq("id", payload.class_id)
        .maybeSingle();
      if (classError) throw classError;
      if (!classRow || classRow.board_id !== payload.board_id) {
        throw new ApiError(400, "The selected class does not belong to that board.", "INVALID_CURRICULUM");
      }
      const { data: subject, error: subjectError } = await adminClient
        .from("subjects")
        .select("id,class_id")
        .eq("id", payload.subject_id)
        .maybeSingle();
      if (subjectError) throw subjectError;
      if (!subject || subject.class_id !== payload.class_id) {
        throw new ApiError(400, "The selected subject does not belong to that class.", "INVALID_CURRICULUM");
      }
      if (payload.scope_type === "chapter_test" || payload.scope_type === "topic_test") {
        if (!payload.chapter_id) throw new ApiError(400, "Choose a chapter for this test type.", "MISSING_CHAPTER");
        const { data: chapter, error: chapterError } = await adminClient
          .from("chapters")
          .select("id,subject_id")
          .eq("id", payload.chapter_id)
          .maybeSingle();
        if (chapterError) throw chapterError;
        if (!chapter || chapter.subject_id !== payload.subject_id) {
          throw new ApiError(400, "The selected chapter does not belong to that subject.", "INVALID_CURRICULUM");
        }
      }
      if (payload.scope_type === "topic_test") {
        if (!payload.topic_id) throw new ApiError(400, "Choose a topic for this test type.", "MISSING_TOPIC");
        const { data: topic, error: topicError } = await adminClient
          .from("topics")
          .select("id,chapter_id")
          .eq("id", payload.topic_id)
          .maybeSingle();
        if (topicError) throw topicError;
        if (!topic || topic.chapter_id !== payload.chapter_id) {
          throw new ApiError(400, "The selected topic does not belong to that chapter.", "INVALID_CURRICULUM");
        }
      }

      let selectedQuery = adminClient
        .from("questions")
        .select("id,marks,time_seconds,est_time_sec")
        .in("id", questionIds)
        .eq("subject_id", payload.subject_id)
        .eq("status", "published")
        .eq("is_active", true)
        .not("topic_id", "is", null)
        .gte("time_seconds", 1)
        .lte("time_seconds", 60)
        .gte("est_time_sec", 1)
        .lte("est_time_sec", 60);
      if (payload.chapter_id) selectedQuery = selectedQuery.eq("chapter_id", payload.chapter_id);
      if (payload.topic_id) selectedQuery = selectedQuery.eq("topic_id", payload.topic_id);
      const { data: selectedQuestions, error: questionsError } = await selectedQuery;
      if (questionsError) throw questionsError;
      if ((selectedQuestions ?? []).length !== questionIds.length) {
        throw new ApiError(
          400,
          "Every selected question must be published, classified under this subject, and have a time limit of at most 60 seconds.",
          "INVALID_QUESTION_SELECTION"
        );
      }

      const selectedById = new Map((selectedQuestions ?? []).map((question) => [question.id, question]));
      const orderedQuestions = questionIds.map((id) => {
        const question = selectedById.get(id);
        if (!question) throw new ApiError(409, "A selected question is no longer available.", "QUESTION_CHANGED");
        return question;
      });
      totalQuestions = questionIds.length;
      const totalSeconds = orderedQuestions.reduce(
        (sum, question) => sum + Number(question.est_time_sec ?? question.time_seconds ?? 60),
        0
      );
      const calculatedMarks = orderedQuestions.reduce((sum, question) => sum + Number(question.marks ?? 0), 0);
      totalMarks = Math.round((payload.total_marks_override ?? calculatedMarks) * 100) / 100;
      durationMinutes = payload.duration_minutes_override ?? Math.max(1, Math.ceil(totalSeconds / 60));
      if (payload.total_marks_override !== undefined) {
        let allocated = 0;
        orderedQuestions.forEach((question, index) => {
          const marks = index === orderedQuestions.length - 1
            ? Math.round((totalMarks - allocated) * 100) / 100
            : Math.round(
              (totalMarks * (calculatedMarks > 0 ? Number(question.marks ?? 0) / calculatedMarks : 1 / totalQuestions)) *
              100
            ) / 100;
          questionMarks.set(question.id, marks);
          allocated = Math.round((allocated + marks) * 100) / 100;
        });
      }
      curriculumMetadata = {
        curriculum: {
          board_id: payload.board_id,
          class_id: payload.class_id,
          subject_id: payload.subject_id,
          chapter_id: payload.chapter_id ?? null,
          topic_id: payload.topic_id ?? null,
        },
        calculated_total_marks: Math.round(calculatedMarks * 100) / 100,
        calculated_duration_seconds: totalSeconds,
        totals_overridden: Boolean(payload.total_marks_override !== undefined || payload.duration_minutes_override !== undefined),
      };
    }

    let testTypeId = payload.test_type_id;
    if (questionIds.length && payload.scope_type) {
      const { data: scopedType, error: scopedTypeError } = await adminClient
        .from("test_types")
        .select("id")
        .eq("code", payload.scope_type)
        .maybeSingle();
      if (scopedTypeError) throw scopedTypeError;
      testTypeId = scopedType?.id;
    }
    if (!testTypeId) {
      const { data: testType, error: testTypeError } = await adminClient
        .from("test_types")
        .select("id")
        .eq("code", "full_mock")
        .maybeSingle();
      if (testTypeError) throw testTypeError;
      testTypeId = testType?.id;
    }
    if (!testTypeId) {
      throw new ApiError(
        503,
        "The 'full_mock' test type is not configured. Check the database seed data before creating mock tests.",
        "TEST_TYPE_NOT_CONFIGURED"
      );
    }

    const { data, error } = await adminClient
      .from("mock_tests")
      .insert({
          test_type_id: testTypeId,
          title: payload.title,
          slug: payload.slug,
          description: payload.description || null,
          subject_id: payload.subject_id || null,
          chapter_id: payload.chapter_id || null,
          total_questions: totalQuestions,
          total_marks: totalMarks,
          duration_minutes: durationMinutes,
          access_price: payload.access_price,
          passing_marks: payload.passing_marks ?? 0,
          negative_marking: payload.negative_marking,
          negative_marks_ratio: payload.negative_marks_ratio,
          shuffle_questions: payload.shuffle_questions,
          shuffle_options: payload.shuffle_options,
          is_premium: payload.is_premium,
          is_active: payload.is_active,
          is_published: questionIds.length ? false : payload.is_published,
          year: payload.year ?? new Date().getFullYear(),
          instructions: payload.instructions || null,
          metadata: curriculumMetadata,
        })
      .select()
      .single();

    if (error) throw error;
    if (!questionIds.length) return apiSuccess(data, 201);

    try {
      const { error: attachError } = await adminClient.from("mock_test_questions").insert(
        questionIds.map((questionId, sortOrder) => ({
          mock_test_id: data.id,
          question_id: questionId,
          sort_order: sortOrder,
          marks_override: questionMarks.get(questionId) ?? null,
        }))
      );
      if (attachError) throw attachError;
      const { data: finalized, error: finalizeError } = await adminClient
        .from("mock_tests")
        .update({
          total_questions: totalQuestions,
          total_marks: totalMarks,
          duration_minutes: durationMinutes,
          is_published: payload.is_published,
          published_at: payload.is_published ? new Date().toISOString() : null,
        })
        .eq("id", data.id)
        .select()
        .single();
      if (finalizeError) throw finalizeError;
      return apiSuccess(finalized, 201);
    } catch (error) {
      const { error: cleanupError } = await adminClient.from("mock_tests").delete().eq("id", data.id);
      if (cleanupError) {
        console.error("Mock test creation rollback failed", { mockTestId: data.id, cleanupError });
        throw new Error("Test setup failed and cleanup was incomplete. Contact support before retrying.");
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}

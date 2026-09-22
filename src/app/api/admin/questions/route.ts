import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, handleApiError, validateBody, getPaginationParams, paginatedResponse } from "@/lib/api-utils";

const optionSchema = z.object({
  id: z.string().optional(),
  label: z.string().optional(),
  text: z.string().min(0).optional(),
  isCorrect: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional().default(0),
  mediaUrl: z.string().url().optional().or(z.literal(""))
});

const createQuestionSchema = z.object({
  mockTestId: z.string().uuid(),
  topicId: z.string().uuid().optional().or(z.literal("")),
  languageId: z.string().uuid().optional().or(z.literal("")),
  type: z.string(),
  difficulty: z.string().optional().or(z.literal("")),
  stem: z.string().min(1),
  stemHtml: z.string().optional().or(z.literal("")),
  explanation: z.string().optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1)).max(50).optional(),
  status: z.enum(["draft", "review", "approved", "published", "rejected", "archived"]).default("draft"),
  marks: z.number().optional().default(1),
  negativeMarks: z.number().optional().default(0),
  timeLimitSec: z.number().int().optional(),
  options: z.array(optionSchema).optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    const { searchParams } = request.nextUrl;
    const { page, limit, offset } = getPaginationParams(searchParams);
    const mockTestId = searchParams.get("mockTestId");
    const status = searchParams.get("status");
    const admin = createAdminClient();

    if (mockTestId) {
      // list questions for a specific test via mock_test_questions join
      let query = admin
        .from("mock_test_questions")
        .select("*, questions(*, question_options(*))", { count: "exact" })
        .eq("mock_test_id", mockTestId);
      if (status) query = query.eq("questions.status", status);
      const { data, error, count } = await query.order("sort_order", { ascending: true }).range(offset, offset + limit - 1);

      if (error) throw error;
      // transform to return questions with attached meta
      const rows = (data || []).map((r) => {
        const q = r.questions || null;
        if (!q) return null;
        return { ...q, _mock_test_meta: { sort_order: r.sort_order, marks: r.marks_override, section_id: r.section_id } };
      }).filter(Boolean);
      return apiSuccess(paginatedResponse(rows, count ?? 0, page, limit));
    }

    let query = admin.from("questions").select("*, question_options(*)", { count: "exact" });
    if (status) query = query.eq("status", status);
    const { data, error, count } = await query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    return apiSuccess(paginatedResponse(data ?? [], count ?? 0, page, limit));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();
    const body = await request.json();
    const payload = await validateBody(createQuestionSchema, body);
    const admin = createAdminClient();

    const { data: questionType } = await admin
      .from("question_types")
      .select("id")
      .ilike("code", payload.type)
      .maybeSingle();
    if (!questionType) throw new Error(`Question type '${payload.type}' is not configured.`);

    let difficultyLevelId: string | null = null;
    if (payload.difficulty) {
      const { data: difficulty } = await admin.from("difficulty_levels").select("id").ilike("code", payload.difficulty).maybeSingle();
      if (!difficulty) throw new Error(`Difficulty '${payload.difficulty}' is not configured.`);
      difficultyLevelId = difficulty.id;
    }

    // basic option validation for MCQ
    if (payload.options && payload.type.toUpperCase().includes("MCQ")) {
      const correctCount = payload.options.filter((o) => o.isCorrect).length;
      if (correctCount === 0) throw new Error("At least one correct option is required for MCQ");
      if (correctCount > 1 && !payload.type.toUpperCase().includes("MULTIPLE")) throw new Error("Only one correct option allowed for single-choice MCQ");
    }

    // insert question
    const { data: qdata, error: qerr } = await admin.from("questions").insert([
      {
        topic_id: payload.topicId || null,
        question_type_id: questionType.id,
        difficulty_level_id: difficultyLevelId,
        language_id: payload.languageId || null,
        question_text: payload.stem,
        question_html: payload.stemHtml || null,
        explanation: payload.explanation || null,
        tags: payload.tags ?? [],
        status: payload.status,
        marks: payload.marks,
        negative_marks: payload.negativeMarks,
        time_seconds: payload.timeLimitSec || 60,
      },
    ]).select().single();
    if (qerr) throw qerr;

    const questionId = qdata.id;

    // insert options
    if (payload.options && payload.options.length > 0) {
      const inserts = payload.options.map((o, idx) => ({
        question_id: questionId,
        option_text: o.text || "",
        option_html: null,
        is_correct: !!o.isCorrect,
        sort_order: o.sortOrder ?? idx + 1,
        image_url: o.mediaUrl || null,
      }));
      const { error: optErr } = await admin.from("question_options").insert(inserts);
      if (optErr) throw optErr;
    }

    // attach to mock test
    const { data: attach, error: attachErr } = await admin.from("mock_test_questions").insert([
      { mock_test_id: payload.mockTestId, question_id: questionId, sort_order: 0, marks_override: payload.marks },
    ]).select().single();
    if (attachErr) throw attachErr;

    return apiSuccess({ question: qdata, attached: attach }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

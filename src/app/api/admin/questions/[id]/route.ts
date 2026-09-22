import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const updateQuestionSchema = z.object({
  topicId: z.string().uuid().optional().or(z.literal("")),
  languageId: z.string().uuid().optional().or(z.literal("")),
  type: z.string().optional(),
  difficulty: z.string().optional().or(z.literal("")),
  stem: z.string().min(1).optional(),
  stemHtml: z.string().optional().or(z.literal("")),
  explanation: z.string().optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1)).max(50).optional(),
  status: z.enum(["draft", "review", "approved", "published", "rejected", "archived"]).optional(),
  marks: z.number().optional(),
  negativeMarks: z.number().optional(),
  timeLimitSec: z.number().int().optional(),
  options: z.array(z.object({ id: z.string().optional(), label: z.string().optional(), text: z.string().optional(), isCorrect: z.boolean().optional(), sortOrder: z.number().int().optional(), mediaUrl: z.string().optional().or(z.literal("") ) })).optional(),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const admin = createAdminClient();
    const { data, error } = await admin.from("questions").select("*, question_options(*)").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return apiSuccess(null, 404);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const body = await request.json();
    const payload = await validateBody(updateQuestionSchema, body);
    const admin = createAdminClient();

    const updates: Record<string, unknown> = {};
    if (payload.topicId !== undefined) updates.topic_id = payload.topicId || null;
    if (payload.languageId !== undefined) updates.language_id = payload.languageId || null;
    if (payload.type !== undefined) {
      const { data: questionType } = await admin.from("question_types").select("id").ilike("code", payload.type).maybeSingle();
      if (!questionType) throw new Error(`Question type '${payload.type}' is not configured.`);
      updates.question_type_id = questionType.id;
    }
    if (payload.difficulty !== undefined) {
      const { data: difficulty } = payload.difficulty ? await admin.from("difficulty_levels").select("id").ilike("code", payload.difficulty).maybeSingle() : { data: null };
      if (payload.difficulty && !difficulty) throw new Error(`Difficulty '${payload.difficulty}' is not configured.`);
      updates.difficulty_level_id = difficulty?.id || null;
    }
    if (payload.stem !== undefined) updates.question_text = payload.stem;
    if (payload.stemHtml !== undefined) updates.question_html = payload.stemHtml || null;
    if (payload.explanation !== undefined) updates.explanation = payload.explanation || null;
    if (payload.marks !== undefined) updates.marks = payload.marks;
    if (payload.negativeMarks !== undefined) updates.negative_marks = payload.negativeMarks;
    if (payload.timeLimitSec !== undefined) updates.time_seconds = payload.timeLimitSec || 60;
    if (payload.tags !== undefined) updates.tags = payload.tags;
    if (payload.status !== undefined) updates.status = payload.status;

    if (Object.keys(updates).length) {
      const { error } = await admin.from("questions").update(updates).eq("id", id);
      if (error) throw error;
    }

    // replace options if provided
    if (payload.options) {
      // delete existing options
      const { error: delErr } = await admin.from("question_options").delete().eq("question_id", id);
      if (delErr) throw delErr;
      const inserts = payload.options.map((o, idx) => ({
        question_id: id,
        option_text: o.text || "",
        option_html: null,
        is_correct: !!o.isCorrect,
        sort_order: o.sortOrder ?? idx + 1,
        image_url: o.mediaUrl || null,
      }));
      if (inserts.length) {
        const { error: optErr } = await admin.from("question_options").insert(inserts);
        if (optErr) throw optErr;
      }
    }

    const { data, error } = await admin.from("questions").select("*, question_options(*)").eq("id", id).maybeSingle();
    if (error) throw error;
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const admin = createAdminClient();

    // check for references in test_responses
    const { data: refs, error: refErr } = await admin.from("test_responses").select("id").eq("question_id", id).limit(1);
    if (refErr) throw refErr;
    if (refs && refs.length > 0) {
      // cannot hard-delete, archive instead
      const { error: updErr } = await admin.from("questions").update({ is_active: false }).eq("id", id);
      if (updErr) throw updErr;
      return apiSuccess({ archived: true });
    }

    // safe to delete: remove options, mock_test_questions links, and question
    const { error: delOpts } = await admin.from("question_options").delete().eq("question_id", id);
    if (delOpts) throw delOpts;
    const { error: delLinks } = await admin.from("mock_test_questions").delete().eq("question_id", id);
    if (delLinks) throw delLinks;
    const { error: delQ } = await admin.from("questions").delete().eq("id", id);
    if (delQ) throw delQ;

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}

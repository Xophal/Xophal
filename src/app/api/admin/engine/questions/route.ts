import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, apiSuccess, handleApiError, paginatedResponse, validateBody } from "@/lib/api-utils";
import {
  bulkEngineQuestionRowSchema,
  createEngineQuestionSchema,
  engineQuestionQuerySchema,
  parseCsvRows,
} from "@/lib/engine/question-schema";
import {
  bulkCreateEngineQuestions,
  createEngineQuestion,
  listEngineQuestions,
} from "@/lib/engine/question-service";

/**
 * Phase-2 engine question bank.
 * Legacy single-type routes remain at /api/admin/questions; this router is the
 * engine-aware CRUD surface (all 9 types, answers+options+tags, review queue).
 */

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    const query = engineQuestionQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const admin = createAdminClient();
    const { rows, total, page, limit } = await listEngineQuestions(admin, query);
    return apiSuccess(paginatedResponse(rows, total, page, limit));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAdminAuth();
    const payload = await validateBody(createEngineQuestionSchema, await request.json());
    const admin = createAdminClient();
    const row = await createEngineQuestion(admin, user.id, payload);
    return apiSuccess({ question: row }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/admin/engine/questions/import
 * Body: { csv: string, defaultStatus?: "draft" }
 * Validates every row first; inserts nothing when any row is invalid.
 */
export async function PUT(request: NextRequest) {
  try {
    const { user } = await requireAdminAuth();
    const body = (await request.json()) as { csv?: unknown; defaultStatus?: unknown };
    if (typeof body.csv !== "string" || !body.csv.trim()) {
      throw new ApiError(400, "Provide CSV text in { csv }.", "VALIDATION_ERROR");
    }
    const defaultStatus = body.defaultStatus === "reviewed" ? ("reviewed" as const) : ("draft" as const);
    const rawRows = parseCsvRows(body.csv);
    if (rawRows.length === 0) throw new ApiError(400, "No data rows found in CSV.", "VALIDATION_ERROR");
    if (rawRows.length > 500) throw new ApiError(400, "Import is limited to 500 rows per batch.", "VALIDATION_ERROR");
    const parsed = rawRows.map((r, i) => {
      const res = bulkEngineQuestionRowSchema.safeParse(r);
      if (!res.success) {
        throw new ApiError(400, `Row ${i + 2}: ${res.error.errors[0]?.message ?? "invalid row"}`, "VALIDATION_ERROR");
      }
      return res.data;
    });
    const admin = createAdminClient();
    const result = await bulkCreateEngineQuestions(admin, user.id, parsed, defaultStatus);
    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

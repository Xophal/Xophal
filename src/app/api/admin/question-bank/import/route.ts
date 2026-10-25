import { NextRequest } from "next/server";
import { requireAdminRole } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildQuestionImportLegacyId,
  parseQuestionImportFile,
  validateQuestionImportRows,
  type BankQuestionType,
} from "@/lib/admin/question-bank-import";

const ENGINE_TYPE_BY_BANK_TYPE: Record<BankQuestionType, string> = {
  single_correct: "mcq",
  multiple_correct: "mcq",
  assertion_reason: "assertion_reason",
  case_study: "case_based",
  diagram_based: "mcq",
  match_following: "match",
  true_false: "statement",
};

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAdminRole(["super_admin", "admin", "content_manager"]);
    const form = await request.formData();
    const file = form.get("file");
    const action = form.get("action");

    if (!(file instanceof File)) return apiError("Choose a CSV or XLSX file.", 400, "MISSING_FILE");
    if (file.size === 0) return apiError("The selected file is empty.", 400, "EMPTY_FILE");
    if (file.size > 10 * 1024 * 1024) return apiError("File must be 10 MB or smaller.", 413, "FILE_TOO_LARGE");
    if (action !== "preview" && action !== "import") {
      return apiError("Choose preview or import.", 400, "INVALID_ACTION");
    }

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".csv") && !lowerName.endsWith(".xlsx")) {
      return apiError("Use a .csv or .xlsx spreadsheet.", 400, "UNSUPPORTED_FILE_TYPE");
    }

    const rawRows = await parseQuestionImportFile(file);
    if (rawRows.length === 0) return apiError("The spreadsheet has no question rows.", 400, "EMPTY_IMPORT");
    if (rawRows.length > 500) return apiError("Import is limited to 500 questions at a time.", 400, "IMPORT_LIMIT");

    const preview = validateQuestionImportRows(rawRows);
    if (action === "preview") {
      return apiSuccess({
        totalRows: preview.totalRows,
        validRows: preview.validRows,
        invalidRows: preview.invalidRows,
        issues: preview.issues.slice(0, 100),
        sample: preview.rows.slice(0, 5).map(({ question, type, marks, time_seconds }) => ({
          question,
          type,
          marks,
          time_seconds,
        })),
      });
    }
    if (preview.issues.length) {
      return apiError(
        `Fix the ${preview.issues.length} spreadsheet issue(s) before importing.`,
        400,
        "INVALID_IMPORT",
        { issues: preview.issues.slice(0, 100) }
      );
    }

    const admin = createAdminClient();
    const neededTypes = [...new Set(preview.rows.map((row) => row.type))];
    const { data: questionTypes, error: typeError } = await admin
      .from("question_types")
      .select("id,code")
      .in("code", neededTypes);
    if (typeError) throw typeError;

    const typeIds = new Map((questionTypes ?? []).map((row) => [row.code, row.id]));
    const missingTypes = neededTypes.filter((type) => !typeIds.has(type));
    if (missingTypes.length) {
      return apiError(
        `Question type(s) are not configured: ${missingTypes.join(", ")}. Apply the question-type seed migration first.`,
        503,
        "QUESTION_TYPES_NOT_CONFIGURED"
      );
    }

    const createdIds: string[] = [];
    try {
      for (const row of preview.rows) {
        const questionTypeId = typeIds.get(row.type);
        if (!questionTypeId) throw new Error(`Question type '${row.type}' was not loaded.`);
        const legacyId = buildQuestionImportLegacyId(row);
        const options = [
          row.option_a,
          row.option_b,
          row.option_c,
          row.option_d,
        ].map((option_text, index) => ({
          option_text,
          label: String.fromCharCode(65 + index),
          body: option_text,
          sort_order: index + 1,
          position: index + 1,
          is_correct: row.correctAnswers.includes(String.fromCharCode(65 + index)),
        }));

        const { data: existing, error: existingError } = await admin
          .from("questions")
          .select("id")
          .eq("legacy_id", legacyId)
          .maybeSingle();
        if (existingError) throw existingError;

        const { data: question, error: questionError } = await admin
          .from("questions")
          .upsert({
            id: existing?.id,
            question_type_id: questionTypeId,
            question_text: row.question,
            stem: row.question,
            explanation: row.explanation || null,
            marks: row.marks,
            negative_marks: row.negative_marks,
            time_seconds: row.time_seconds,
            est_time_sec: row.time_seconds,
            engine_type: ENGINE_TYPE_BY_BANK_TYPE[row.type],
            engine_status: "draft",
            status: "draft",
            source: "import",
            skill: "recall",
            difficulty: 2,
            board_pattern: "OTHER",
            is_active: true,
            is_verified: false,
            created_by: user.id,
            legacy_id: legacyId,
            metadata: { question_format: row.type },
          }, { onConflict: "legacy_id" })
          .select("id")
          .single();
        if (questionError) throw questionError;
        createdIds.push(question.id);

        const { error: optionsError } = await admin
          .from("question_options")
          .delete()
          .eq("question_id", question.id);
        if (optionsError) throw optionsError;

        const { error: optionInsertError } = await admin
          .from("question_options")
          .insert(options.map((option) => ({ ...option, question_id: question.id })));
        if (optionInsertError) throw optionInsertError;

        const answerJson = row.type === "multiple_correct"
          ? { correct_options: row.correctAnswers }
          : { correct_option: row.correctAnswers[0] };
        const { error: answerError } = await admin
          .from("question_answers")
          .upsert({
            question_id: question.id,
            answer_json: answerJson,
            rubric_json: {},
            explanation: row.explanation || null,
          }, { onConflict: "question_id" });
        if (answerError) throw answerError;
      }
    } catch (error) {
      if (createdIds.length) {
        const { error: cleanupError } = await admin.from("questions").delete().in("id", createdIds);
        if (cleanupError) {
          console.error("Question import rollback failed", { createdIds, cleanupError });
          throw new Error("Import failed and cleanup was incomplete. Contact support before retrying.");
        }
      }
      throw error;
    }

    return apiSuccess({ imported: createdIds.length, questionIds: createdIds }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

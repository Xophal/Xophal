import { NextRequest } from "next/server";
import { requireAdminAuth, normalizeRoleCode } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import {
  autoDetectMapping,
  findDuplicates,
  MAX_FILE_SIZE_MB,
  parseFile,
  validateImportRow,
} from "@/lib/qbank/import-service";
import {
  ColumnMappingSchema,
  StartImportSchema,
} from "@/lib/qbank/validation";

export async function GET() {
  try {
    await requireAdminAuth();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("import_batches")
      .select("id, filename, format, user_id, board_id, class_id, subject_id, status, total_rows, valid_rows, invalid_rows, imported_rows, skipped_rows, duplicate_rows, created_at, completed_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new ApiError(500, error.message, "DB_ERROR");
    return apiSuccess({ batches: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, profile } = await requireAdminAuth();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "A CSV or XLSX file is required.", "MISSING_FILE");
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      throw new ApiError(413, `File exceeds the ${MAX_FILE_SIZE_MB} MB limit.`, "FILE_TOO_LARGE");
    }

    const settingsValue = form.get("settings");
    if (typeof settingsValue !== "string") throw new ApiError(400, "Import settings are required.", "MISSING_SETTINGS");
    let rawSettings: unknown;
    try {
      rawSettings = JSON.parse(settingsValue);
    } catch {
      throw new ApiError(400, "Import settings must be valid JSON.", "INVALID_SETTINGS");
    }
    const settings = await validateBody(StartImportSchema, rawSettings);
    if (settings.default_status === "approved" && !["admin", "super_admin"].includes(normalizeRoleCode(profile) ?? "")) {
      throw new ApiError(403, "Only administrators can auto-approve imported questions.", "FORBIDDEN");
    }

    const { rows, format, headers } = await parseFile(Buffer.from(await file.arrayBuffer()), file.name);
    const providedMapping = form.get("column_mapping");
    let mappingInput: unknown = settings.column_mapping;
    if (providedMapping !== null) {
      try {
        mappingInput = JSON.parse(String(providedMapping));
      } catch {
        throw new ApiError(400, "Column mapping must be valid JSON.", "INVALID_MAPPING");
      }
    }
    const completeMapping = await validateBody(
      ColumnMappingSchema,
      mappingInput && Object.values(mappingInput).some(Boolean) ? mappingInput : autoDetectMapping(headers)
    );
    if (!completeMapping.question || !completeMapping.correct_answer) {
      throw new ApiError(400, "Map both a question column and a correct-answer column before previewing.", "REQUIRED_MAPPING");
    }

    const validatedRows = rows.map((row, index) => validateImportRow(row, completeMapping, index + 2, {
      difficulty: settings.default_difficulty,
      language: settings.default_language,
    }));
    const admin = createAdminClient();
    const duplicates = await findDuplicates(
      admin,
      validatedRows,
      settings.subject_id,
      settings.chapter_id
    );
    const invalidCount = validatedRows.filter((row) => !row.valid).length;
    const { data: batch, error } = await admin
      .from("import_batches")
      .insert({
        user_id: user.id,
        filename: file.name.slice(0, 500),
        format,
        entity_type: "questions",
        board_id: settings.board_id,
        class_id: settings.class_id,
        subject_id: settings.subject_id,
        chapter_id: settings.chapter_id ?? null,
        topic_id: settings.topic_id ?? null,
        status: "validated",
        total_rows: validatedRows.length,
        valid_rows: validatedRows.length - invalidCount,
        invalid_rows: invalidCount,
        duplicate_rows: duplicates.size,
        validation_report: {
          headers,
          errors: validatedRows.filter((row) => !row.valid).map(({ rowNo, errors }) => ({ rowNo, errors })),
          duplicates: Array.from(duplicates, ([rowNo, duplicate]) => ({ rowNo, ...duplicate })),
        },
        error_log: [],
        preview_data: rows,
        column_mapping: completeMapping,
        import_options: settings,
      })
      .select("id, status, total_rows, valid_rows, invalid_rows, duplicate_rows")
      .single();
    if (error) throw new ApiError(500, error.message, "DB_ERROR");

    return apiSuccess({
      batch,
      headers,
      mapping: completeMapping,
      preview: validatedRows.slice(0, 50).map((row) => ({
        ...row,
        duplicate: duplicates.get(row.rowNo) ?? null,
      })),
      previewLimit: 50,
    }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from "next/server";
import { normalizeRoleCode, requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { executeImport, findDuplicates, type ValidatedRow, validateImportRow } from "@/lib/qbank/import-service";
import { ColumnMappingSchema, StartImportSchema, type ColumnMapping } from "@/lib/qbank/validation";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminAuth();
    const { id } = await context.params;
    const admin = createAdminClient();

    const { data: batch, error: bErr } = await admin
      .from("import_batches")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (bErr) throw new ApiError(500, bErr.message, "DB_ERROR");
    if (!batch) throw new ApiError(404, "Import batch not found", "NOT_FOUND");

    if (request.nextUrl.searchParams.get("format") === "errors") {
      const report = Array.isArray(batch.error_log) ? batch.error_log : [];
      const validationErrors = Array.isArray(batch.validation_report?.errors) ? batch.validation_report.errors : [];
      const records = [...validationErrors, ...report];
      const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const csv = [
        ["row", "errors"].map(csvCell).join(","),
        ...records.map((record: { rowNo?: number; errors?: string[]; message?: string; existingId?: string; similarity?: number }) => [
          csvCell(record.rowNo),
          csvCell(record.errors?.join("; ") ?? record.message ?? (record.existingId
            ? `Possible duplicate of ${record.existingId} (${Math.round((record.similarity ?? 0) * 100)}% match)`
            : "")),
        ].join(",")),
      ].join("\r\n");
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="import-${id}-errors.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return apiSuccess({ batch });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, profile } = await requireAdminAuth();
    const { id } = await context.params;
    const admin = createAdminClient();
    const { data: batch, error } = await admin.from("import_batches").select("*").eq("id", id).maybeSingle();
    if (error) throw new ApiError(500, error.message, "DB_ERROR");
    if (!batch) throw new ApiError(404, "Import batch not found.", "NOT_FOUND");
    if (batch.user_id !== user.id && normalizeRoleCode(profile) !== "super_admin") {
      throw new ApiError(403, "You cannot update this import batch.", "FORBIDDEN");
    }
    if (batch.status !== "validated") throw new ApiError(409, "Only a staged batch can be remapped.", "INVALID_IMPORT_STATE");

    const mapping = await validateBody(ColumnMappingSchema, await request.json());
    if (!mapping.question || !mapping.correct_answer) {
      throw new ApiError(400, "Question and correct-answer columns are required.", "REQUIRED_MAPPING");
    }
    const settings = StartImportSchema.parse(batch.import_options);
    const rawRows = batch.preview_data as Array<Record<string, string>>;
    if (!Array.isArray(rawRows)) throw new ApiError(400, "Staged import rows are invalid.", "INVALID_IMPORT");
    const rows = rawRows.map((row, index) => validateImportRow(row, mapping, index + 2, {
      difficulty: settings.default_difficulty,
      language: settings.default_language,
    }));
    const duplicates = await findDuplicates(admin, rows, batch.subject_id, batch.chapter_id);
    const invalidCount = rows.filter((row) => !row.valid).length;
    const { error: updateError } = await admin.from("import_batches").update({
      column_mapping: mapping,
      valid_rows: rows.length - invalidCount,
      invalid_rows: invalidCount,
      duplicate_rows: duplicates.size,
      validation_report: {
        headers: Object.values(mapping).filter(Boolean),
        errors: rows.filter((row) => !row.valid).map(({ rowNo, errors: rowErrors }) => ({ rowNo, errors: rowErrors })),
        duplicates: Array.from(duplicates, ([rowNo, duplicate]) => ({ rowNo, ...duplicate })),
      },
    }).eq("id", id).eq("status", "validated");
    if (updateError) throw new ApiError(500, updateError.message, "DB_ERROR");
    return apiSuccess({
      batch: { ...batch, column_mapping: mapping, valid_rows: rows.length - invalidCount, invalid_rows: invalidCount, duplicate_rows: duplicates.size },
      preview: rows.slice(0, 50).map((row) => ({ ...row, duplicate: duplicates.get(row.rowNo) ?? null })),
      previewLimit: 50,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let batchId = "";
  let admin: ReturnType<typeof createAdminClient> | null = null;
  try {
    const { user, profile } = await requireAdminAuth();
    const { id } = await context.params;
    batchId = id;
    admin = createAdminClient();
    const { data: batch, error: fetchError } = await admin
      .from("import_batches")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) throw new ApiError(500, fetchError.message, "DB_ERROR");
    if (!batch) throw new ApiError(404, "Import batch not found.", "NOT_FOUND");
    if (batch.user_id !== user.id && normalizeRoleCode(profile) !== "super_admin") {
      throw new ApiError(403, "You cannot process this import batch.", "FORBIDDEN");
    }
    if (batch.status !== "validated") {
      throw new ApiError(409, `This batch cannot be imported from status '${batch.status}'.`, "INVALID_IMPORT_STATE");
    }

    const { data: claimed, error: claimError } = await admin
      .from("import_batches")
      .update({ status: "importing", started_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "validated")
      .select("id")
      .maybeSingle();
    if (claimError) throw new ApiError(500, claimError.message, "DB_ERROR");
    if (!claimed) throw new ApiError(409, "This import batch is already being processed.", "IMPORT_ALREADY_STARTED");

    const rawRows = batch.preview_data as Array<Record<string, string>>;
    if (!Array.isArray(rawRows) || rawRows.length === 0) throw new ApiError(400, "The import batch has no staged rows.", "EMPTY_IMPORT");
    const settings = StartImportSchema.parse(batch.import_options);
    if (settings.default_status === "approved" && !["admin", "super_admin"].includes(normalizeRoleCode(profile) ?? "")) {
      throw new ApiError(403, "Only administrators can auto-approve imported questions.", "FORBIDDEN");
    }
    const mapping = ColumnMappingSchema.parse(batch.column_mapping) as ColumnMapping;
    const rows: ValidatedRow[] = rawRows.map((row, index) => validateImportRow(row, mapping, index + 2, {
      difficulty: settings.default_difficulty,
      language: settings.default_language,
    }));
    const duplicates = await findDuplicates(admin, rows, batch.subject_id, batch.chapter_id);
    const result = await executeImport(admin, user.id, id, rows, duplicates, settings);
    const finalStatus = "completed";
    const { error: finishError } = await admin.from("import_batches").update({
      status: finalStatus,
      imported_rows: result.imported,
      skipped_rows: result.skipped,
      duplicate_rows: result.duplicates,
      error_log: result.errors,
      completed_at: new Date().toISOString(),
    }).eq("id", id).eq("status", "importing");
    if (finishError) throw new ApiError(500, finishError.message, "IMPORT_FINALIZE_FAILED");
    return apiSuccess({ ...result, status: finalStatus });
  } catch (error) {
    if (batchId && admin) {
      const { error: updateError } = await admin.from("import_batches").update({
        status: "failed",
        error_log: [{ message: error instanceof Error ? error.message : "Import failed." }],
        completed_at: new Date().toISOString(),
      }).eq("id", batchId).eq("status", "importing");
      if (updateError) console.error("Failed to mark import batch as failed", updateError);
    }
    return handleApiError(error);
  }
}
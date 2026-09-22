import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminAuth } from "@/lib/auth";
import { validateBody, apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { importJobSchema } from "@/lib/validations";
import { parseCsvRows, validateImportRows } from "@/lib/cms-import";

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAdminAuth();
    const body = await request.json();
    const payload = await validateBody(importJobSchema, body);

    const rows =
      payload.format === "CSV"
        ? parseCsvRows(payload.csv ?? "")
        : Array.isArray(payload.rows)
        ? payload.rows
        : [];

    if (payload.format !== "CSV" && !Array.isArray(payload.rows)) {
      return apiError("rows is required for non-CSV import formats", 400, "MISSING_ROWS");
    }

    const preview = validateImportRows(payload.entity_type, rows);
    const adminClient = createAdminClient();

    const { data, error } = await adminClient.from("import_jobs").insert([
      {
        entity_type: payload.entity_type,
        format: payload.format,
        status: "VALIDATED",
        filename: payload.filename,
        file_path: payload.file_path ?? null,
        total_rows: preview.totalRows,
        valid_rows: preview.validRows,
        invalid_rows: preview.invalidRows,
        imported_rows: 0,
        skipped_rows: 0,
        validation_report: {
          issues: preview.issues,
          duplicateCount: preview.duplicateCount,
        },
        preview_data: rows,
        options: payload.options ?? null,
        user_id: user.id,
      },
    ]);

    if (error) throw error;
    return apiSuccess({ job: data?.[0] ?? null, preview });
  } catch (error) {
    return handleApiError(error);
  }
}

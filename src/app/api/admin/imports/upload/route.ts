import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminAuth } from "@/lib/auth";
import { validateBody, apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { parseCsvRows, validateImportRows } from "@/lib/cms-import";
import { importJobSchema } from "@/lib/validations";

async function parseXlsx(buffer: ArrayBuffer) {
  try {
    const ExcelJS = (await import("exceljs")).default ?? (await import("exceljs"));
    const workbook = new ExcelJS.Workbook();
    const nodeBuffer = Buffer.from(new Uint8Array(buffer as any));
    await workbook.xlsx.load(nodeBuffer as any);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];

    // Use first row as headers
    const headerRow = worksheet.getRow(1);
    const headerValues = Array.isArray(headerRow.values) ? headerRow.values.slice(1) : [];
    const headers = headerValues.map((h: any) => (h === null || h === undefined ? "" : String(h).trim()));

    const rows: any[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const obj: Record<string, any> = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const key = headers[colNumber - 1] || `col${colNumber}`;
        let val: any = cell.value;
        if (val === null || val === undefined) val = "";
        else if (typeof (val as any).toString === "function") val = (val as any).toString();
        else val = String(val);
        obj[key] = val;
      });
      rows.push(obj);
    });

    return rows as unknown[];
  } catch (err) {
    throw new Error("Excel parsing not available. Ensure `exceljs` is installed to enable Excel imports.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAdminAuth();

    const form = await request.formData();
    const file = form.get("file") as File | null;
    const entityType = String(form.get("entity_type") || "questions");
    const filename = file?.name || "";

    if (!file) return apiError("file is required", 400, "MISSING_FILE");
    if (file.size > 10 * 1024 * 1024) return apiError("File must be 10 MB or smaller", 413, "FILE_TOO_LARGE");

    const lower = filename.toLowerCase();
    let rows: unknown[] = [];

    if (lower.endsWith(".csv") || file.type === "text/csv") {
      const text = await file.text();
      rows = parseCsvRows(text);
    } else if (lower.endsWith(".json") || file.type === "application/json") {
      const text = await file.text();
      const parsed = JSON.parse(text);
      rows = Array.isArray(parsed) ? parsed : parsed.rows ?? [];
    } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
      const buffer = await file.arrayBuffer();
      rows = await parseXlsx(buffer);
    } else {
      return apiError("Unsupported file type. Use CSV, JSON, or XLSX.", 400, "UNSUPPORTED_FILE_TYPE");
    }

    // Validate rows with existing validator
    const preview = validateImportRows(entityType, rows);

    const adminClient = createAdminClient();

    const format = lower.endsWith(".xlsx") || lower.endsWith(".xls") ? "XLSX" : lower.endsWith(".json") ? "JSON" : "CSV";
    const { data, error } = await adminClient.from("import_jobs").insert([
      {
        entity_type: entityType,
        format,
        status: "VALIDATED",
        filename,
        file_path: null,
        total_rows: preview.totalRows,
        valid_rows: preview.validRows,
        invalid_rows: preview.invalidRows,
        imported_rows: 0,
        skipped_rows: 0,
        validation_report: {
          issues: preview.issues,
          duplicateCount: preview.duplicateCount,
        },
        // store full rows in preview_data so workers can process the import later
        preview_data: rows,
        options: null,
        user_id: user.id,
      },
    ]);

    if (error) throw error;
    return apiSuccess({ job: data?.[0] ?? null, preview });
  } catch (error) {
    return handleApiError(error);
  }
}

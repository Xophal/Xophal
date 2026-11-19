import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_PDF_SIZE = 50 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required.", "UNAUTHORIZED");
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Choose a PDF file.", "MISSING_FILE");
    if (file.size <= 0 || file.size > MAX_PDF_SIZE) {
      throw new ApiError(413, "PDF files must be 50 MB or smaller.", "FILE_TOO_LARGE");
    }
    if (file.type !== "application/pdf") {
      throw new ApiError(415, "Only PDF files are supported.", "UNSUPPORTED_FILE_TYPE");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const signature = new TextDecoder().decode(bytes.slice(0, 5));
    if (signature !== "%PDF-") throw new ApiError(415, "The file contents are not a valid PDF.", "INVALID_PDF");

    const path = `${session.user.id}/${randomUUID()}.pdf`;
    const admin = createAdminClient();
    const { error } = await admin.storage.from("ebook-pdfs").upload(path, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (error) throw error;
    return apiSuccess({ path, fileName: file.name, fileSize: file.size }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_COVER_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ["image/jpeg", { extension: "jpg", signature: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff }],
  ["image/png", { extension: "png", signature: (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 }],
  ["image/webp", { extension: "webp", signature: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" }],
]);

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required.", "UNAUTHORIZED");
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Choose a book cover image.", "MISSING_FILE");
    if (file.size <= 0 || file.size > MAX_COVER_SIZE) throw new ApiError(413, "Cover images must be 5 MB or smaller.", "FILE_TOO_LARGE");

    const imageType = IMAGE_TYPES.get(file.type);
    if (!imageType) throw new ApiError(415, "Use a JPEG, PNG, or WebP cover image.", "UNSUPPORTED_IMAGE_TYPE");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!imageType.signature(bytes)) throw new ApiError(415, "The file contents do not match its image type.", "INVALID_IMAGE");

    const admin = createAdminClient();
    const path = `${session.user.id}/ebook-covers/${randomUUID()}.${imageType.extension}`;
    const { error: uploadError } = await admin.storage.from("public").upload(path, bytes, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) throw uploadError;
    const { data } = admin.storage.from("public").getPublicUrl(path);
    const { error: mediaError } = await admin.from("media_assets").insert({
      file_name: `ebook-cover.${imageType.extension}`,
      file_url: data.publicUrl,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: session.user.id,
      metadata: { bucket: "public", path, purpose: "ebook_cover" },
    });
    if (mediaError) {
      await admin.storage.from("public").remove([path]);
      throw mediaError;
    }
    return apiSuccess({ coverImageUrl: data.publicUrl }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

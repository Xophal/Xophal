import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
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
    requireVerifiedSession(session.profile, session.user, { allowRoles: ["student"] });

    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Choose a payment screenshot.", "MISSING_FILE");
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      throw new ApiError(413, "Payment screenshots must be 5 MB or smaller.", "FILE_TOO_LARGE");
    }

    const imageType = IMAGE_TYPES.get(file.type);
    if (!imageType) throw new ApiError(415, "Use a JPEG, PNG, or WebP payment screenshot.", "UNSUPPORTED_IMAGE_TYPE");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!imageType.signature(bytes)) {
      throw new ApiError(415, "The file contents do not match the selected image type.", "INVALID_IMAGE");
    }

    const path = `${session.user.id}/subscription-evidence/${randomUUID()}.${imageType.extension}`;
    const { error } = await createAdminClient()
      .storage
      .from("subscription-payment-evidence")
      .upload(path, bytes, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });
    if (error) throw error;

    return apiSuccess({ evidencePath: path }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

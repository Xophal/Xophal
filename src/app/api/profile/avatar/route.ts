import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { authRateLimit } from "@/lib/redis";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const BUCKET = "public";

async function requireProfileSession() {
  const session = await requireAuth();
  if (!session?.profile) {
    throw new ApiError(401, "Sign in to manage your profile picture.", "UNAUTHORIZED");
  }
  requireVerifiedSession(session.profile, session.user, {});
  return session;
}

async function enforceRateLimit(userId: string) {
  try {
    if (!authRateLimit && process.env.NODE_ENV === "production") {
      throw new ApiError(503, "Profile picture uploads are temporarily unavailable.", "RATE_LIMIT_NOT_CONFIGURED");
    }
    if (authRateLimit) {
      const { success } = await authRateLimit.limit(`profile-avatar:${userId}`);
      if (!success) throw new ApiError(429, "Too many profile picture changes. Try again later.", "RATE_LIMIT");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error("Profile-avatar rate limiter failure", error);
    if (process.env.NODE_ENV === "production") {
      throw new ApiError(503, "Profile picture uploads are temporarily unavailable.", "RATE_LIMIT_UNAVAILABLE");
    }
  }
}

function managedAvatarPath(avatarUrl: string | null, userId: string): string | null {
  if (!avatarUrl) return null;
  try {
    const url = new URL(avatarUrl);
    const supabaseOrigin = new URL(publicEnv.NEXT_PUBLIC_SUPABASE_URL).origin;
    const prefix = `/storage/v1/object/public/${BUCKET}/`;
    if (url.origin !== supabaseOrigin || !url.pathname.startsWith(prefix)) return null;

    const path = decodeURIComponent(url.pathname.slice(prefix.length));
    return new RegExp(`^${userId}/profile-avatars/[0-9a-f-]{36}\\.webp$`, "i").test(path)
      ? path
      : null;
  } catch {
    return null;
  }
}

async function removeManagedAvatar(avatarUrl: string | null, userId: string) {
  const path = managedAvatarPath(avatarUrl, userId);
  if (!path) return;
  const { error } = await createAdminClient().storage.from(BUCKET).remove([path]);
  if (error) {
    console.error("Failed to remove old profile picture", { userId, error });
  }
}

export async function POST(request: NextRequest) {
  let uploadedPath: string | null = null;
  try {
    assertTrustedOrigin(request);
    const session = await requireProfileSession();
    await enforceRateLimit(session.user.id);

    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES + 64 * 1024) {
      throw new ApiError(400, "Profile pictures must be smaller than 4 MB.", "IMAGE_SIZE_INVALID");
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(400, "Choose a profile picture to upload.", "FILE_REQUIRED");
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      throw new ApiError(400, "Choose a JPEG, PNG, or WebP image.", "UNSUPPORTED_IMAGE_TYPE");
    }
    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
      throw new ApiError(400, "Profile pictures must be smaller than 4 MB.", "IMAGE_SIZE_INVALID");
    }

    const input = Buffer.from(await file.arrayBuffer());
    let optimized: Buffer;
    try {
      optimized = await sharp(input, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize(512, 512, { fit: "cover", position: "attention" })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw new ApiError(400, "This image could not be processed. Choose a valid image file.", "INVALID_IMAGE");
    }

    const admin = createAdminClient();
    const { data: currentProfile, error: profileReadError } = await admin
      .from("profiles")
      .select("avatar_url")
      .eq("id", session.user.id)
      .maybeSingle();
    if (profileReadError) throw profileReadError;

    uploadedPath = `${session.user.id}/profile-avatars/${randomUUID()}.webp`;
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(uploadedPath, optimized, {
      contentType: "image/webp",
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) {
      console.error("Profile picture upload failed", { userId: session.user.id, error: uploadError });
      throw new ApiError(503, "The profile picture could not be uploaded. Please try again.", "AVATAR_UPLOAD_FAILED");
    }

    const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(uploadedPath);
    const { data: updatedProfile, error: updateError } = await admin
      .from("profiles")
      .update({ avatar_url: publicData.publicUrl })
      .eq("id", session.user.id)
      .select("id")
      .maybeSingle();
    if (updateError || !updatedProfile) {
      const { error: cleanupError } = await admin.storage.from(BUCKET).remove([uploadedPath]);
      if (cleanupError) console.error("Failed to clean up profile picture after profile update failure", { userId: session.user.id, error: cleanupError });
      uploadedPath = null;
      if (updateError) throw updateError;
      throw new ApiError(404, "Your profile could not be found. Sign in again and retry.", "PROFILE_NOT_FOUND");
    }

    await removeManagedAvatar(currentProfile?.avatar_url ?? null, session.user.id);
    return apiSuccess({ avatarUrl: publicData.publicUrl });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const session = await requireProfileSession();
    await enforceRateLimit(session.user.id);

    const admin = createAdminClient();
    const { data: profile, error: readError } = await admin
      .from("profiles")
      .select("avatar_url")
      .eq("id", session.user.id)
      .maybeSingle();
    if (readError) throw readError;
    if (!profile?.avatar_url) return apiSuccess({ avatarUrl: null });

    const { error: updateError } = await admin
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", session.user.id);
    if (updateError) throw updateError;

    await removeManagedAvatar(profile.avatar_url, session.user.id);
    return apiSuccess({ avatarUrl: null });
  } catch (error) {
    return handleApiError(error);
  }
}

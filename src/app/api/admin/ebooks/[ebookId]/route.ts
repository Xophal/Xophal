import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type Context = { params: Promise<{ ebookId: string }> };

const actionSchema = z.object({
  action: z.enum(["approve", "reject", "suspend", "reinstate", "feature", "unfeature"]),
  reason: z.string().trim().min(3).max(1000).optional(),
  note: z.string().trim().max(2000).optional(),
});

const READ_ROLES = ["super_admin", "admin", "content_manager", "reviewer"];
const WRITE_ROLES = ["super_admin", "admin", "content_manager"];
const MERCH_ROLES = ["super_admin", "admin"];

export async function GET(_request: NextRequest, context: Context) {
  try {
    await requireAdminRole(READ_ROLES);
    const { ebookId } = await context.params;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ebook_listings")
      .select("*, ebook_categories(id, name, slug), profiles(full_name, email)")
      .eq("id", ebookId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Listing not found.", "NOT_FOUND");
    return apiSuccess({ book: data });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Moderation and merchandising actions. All transitions are server-side; the
 * reviewer identity and timestamp are stamped from the authenticated session.
 */
export async function PATCH(request: NextRequest, context: Context) {
  try {
    assertTrustedOrigin(request);
    const input = await validateBody(actionSchema, await request.json());
    const session = await requireAdminRole(
      input.action === "feature" || input.action === "unfeature" ? MERCH_ROLES : WRITE_ROLES.concat("reviewer")
    );
    const { ebookId } = await context.params;
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const reviewerId = session.user.id;

    const { data: existing } = await admin
      .from("ebook_listings")
      .select("id, status, title")
      .eq("id", ebookId)
      .maybeSingle();
    if (!existing) throw new ApiError(404, "Listing not found.", "NOT_FOUND");

    let patch: Record<string, unknown> = { updated_at: now };
    let eventName: "ebook_approved" | "ebook_rejected" | null = null;

    switch (input.action) {
      case "approve":
        patch = {
          ...patch,
          status: "PUBLISHED",
          approved_at: now,
          published_at: now,
          suspended_at: null,
          rejection_reason: null,
          admin_review_note: input.note?.slice(0, 2000) ?? null,
          reviewed_by: reviewerId,
          reviewed_at: now,
        };
        eventName = "ebook_approved";
        break;
      case "reject":
        if (!input.reason) throw new ApiError(400, "A rejection reason is required.", "REASON_REQUIRED");
        patch = {
          ...patch,
          status: "REJECTED",
          rejection_reason: input.reason.slice(0, 1000),
          admin_review_note: input.note?.slice(0, 2000) ?? null,
          published_at: null,
          reviewed_by: reviewerId,
          reviewed_at: now,
        };
        eventName = "ebook_rejected";
        break;
      case "suspend":
        if (!input.reason) throw new ApiError(400, "A suspension reason is required.", "REASON_REQUIRED");
        patch = {
          ...patch,
          status: "SUSPENDED",
          suspended_at: now,
          internal_moderation_reason: input.reason.slice(0, 1000),
          reviewed_by: reviewerId,
          reviewed_at: now,
        };
        break;
      case "reinstate":
        patch = {
          ...patch,
          status: "PUBLISHED",
          suspended_at: null,
          internal_moderation_reason: null,
          published_at: existing.status === "PUBLISHED" ? undefined : now,
          approved_at: existing.status === "PUBLISHED" ? undefined : now,
          reviewed_by: reviewerId,
          reviewed_at: now,
        };
        break;
      case "feature":
        patch = { ...patch, is_featured: true };
        break;
      case "unfeature":
        patch = { ...patch, is_featured: false };
        break;
    }

    const { data, error } = await admin
      .from("ebook_listings")
      .update(patch)
      .eq("id", ebookId)
      .select("id, status, is_featured")
      .single();
    if (error) throw error;

    if (eventName) {
      await admin.from("ebook_events").insert({
        event_name: eventName,
        ebook_id: ebookId,
        user_id: reviewerId,
        source: "admin_review",
        metadata: { reason: input.reason ?? null },
      });
    }

    return apiSuccess({ book: data, action: input.action });
  } catch (error) {
    return handleApiError(error);
  }
}
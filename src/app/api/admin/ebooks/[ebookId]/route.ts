import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ACTION_HISTORY_LABEL,
  ACTION_TARGET_STATUS,
  MODERATION_ACTIONS,
  REJECTION_REASONS,
  buildSellerFacingReason,
  canTransition,
  type EbookStatus,
} from "@/lib/ebooks/moderation";

type Context = { params: Promise<{ ebookId: string }> };

const actionSchema = z.object({
  action: z.enum(MODERATION_ACTIONS),
  /** Predefined reason code (spec §11); required for reject. */
  reasonCode: z.enum(REJECTION_REASONS).optional(),
  /** Free-text seller-facing reason; required for reject/suspend/request_changes. */
  reason: z.string().trim().min(3).max(1000).optional(),
  /** Admin-only note (spec §11/§14) stored in the audit trail. */
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
      .select("*, ebook_categories(id, name, slug), profiles(id, full_name, email)")
      .eq("id", ebookId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Listing not found.", "NOT_FOUND");

    const sellerId: string | undefined = data.user_id ?? data.profiles?.id;
    const [{ data: history, error: historyError }, { data: reports }, approvedCount, rejectedCount] = await Promise.all([
      admin
        .from("ebook_moderation_history")
        .select("id, admin_id, previous_status, new_status, action, reason, note, created_at, profiles:admin_id(full_name, email)")
        .eq("ebook_id", ebookId)
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("ebook_reports")
        .select("id, reason, details, status, admin_note, created_at, reviewed_at")
        .eq("ebook_id", ebookId)
        .order("created_at", { ascending: false })
        .limit(50),
      sellerId
        ? admin.from("ebook_listings").select("id", { count: "exact", head: true }).eq("user_id", sellerId).eq("status", "PUBLISHED")
        : Promise.resolve({ count: 0 }),
      sellerId
        ? admin.from("ebook_listings").select("id", { count: "exact", head: true }).eq("user_id", sellerId).eq("status", "REJECTED")
        : Promise.resolve({ count: 0 }),
    ]);
    if (historyError) throw historyError;

    return apiSuccess({
      book: data,
      history: history ?? [],
      reports: reports ?? [],
      // Moderation context only — no private seller data beyond display name (§6).
      sellerStats: {
        previousApproved: approvedCount.count ?? 0,
        previousRejected: rejectedCount.count ?? 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Moderation and merchandising actions. All transitions are server-side; the
 * reviewer identity and timestamp are stamped from the authenticated session.
 * Every decision is validated against the transition map, written to the
 * immutable audit trail, mirrored into analytics events, and notified to the
 * seller through the existing notifications table.
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
      .select("id, status, title, user_id, is_featured, rights_confirmed")
      .eq("id", ebookId)
      .maybeSingle();
    if (!existing) throw new ApiError(404, "Listing not found.", "NOT_FOUND");

    const fromStatus = existing.status as EbookStatus;
    const targetStatus = ACTION_TARGET_STATUS[input.action];

    // Rejection requires a predefined reason (spec §11); "Other" must be
    // explained. Seller-facing transitions always carry a reason message.
    if (input.action === "reject" && !input.reasonCode) {
      throw new ApiError(400, "Select a rejection reason.", "REASON_REQUIRED");
    }
    if (input.action === "reject" && input.reasonCode === "Other" && !input.reason) {
      throw new ApiError(400, 'Describe the issue when using the "Other" reason.', "REASON_REQUIRED");
    }
    if ((input.action === "suspend" || input.action === "request_changes") && !input.reason) {
      throw new ApiError(400, "A reason is required for this action.", "REASON_REQUIRED");
    }
    // §9: never approve a listing without its copyright declaration.
    if (input.action === "approve" && !existing.rights_confirmed) {
      throw new ApiError(400, "The copyright declaration is missing for this listing.", "RIGHTS_DECLARATION_MISSING");
    }

    // Server-side transition guard (mirrors the DB trigger; §22).
    if (targetStatus && !canTransition(fromStatus, targetStatus)) {
      throw new ApiError(409, `This listing cannot move from ${fromStatus} to ${targetStatus}.`, "INVALID_TRANSITION");
    }

    const sellerFacingReason =
      input.action === "reject"
        ? buildSellerFacingReason(input.reasonCode as string, input.reason)
        : input.reason?.slice(0, 1000) ?? null;
    const adminNote = input.note?.slice(0, 2000) ?? null;

    let patch: Record<string, unknown> = { updated_at: now };
    let notification: { title: string; message: string; type: "info" | "success" | "warning" } | null = null;

    switch (input.action) {
      case "approve":
        patch = {
          ...patch,
          status: "PUBLISHED",
          approved_at: now,
          published_at: now,
          suspended_at: null,
          rejection_reason: null,
          seller_feedback: null,
          admin_review_note: adminNote,
          reviewed_by: reviewerId,
          reviewed_at: now,
        };
        notification = {
          title: "Your eBook has been approved",
          message: `Your eBook "${existing.title}" has been approved and is now published on Xophol.`,
          type: "success",
        };
        break;
      case "reject":
        patch = {
          ...patch,
          status: "REJECTED",
          rejection_reason: sellerFacingReason,
          admin_review_note: adminNote,
          seller_feedback: null,
          published_at: null,
          reviewed_by: reviewerId,
          reviewed_at: now,
        };
        notification = {
          title: "Your eBook was not approved",
          message: `"${existing.title}" was rejected. Reason: ${sellerFacingReason} Please review the feedback and update your listing.`,
          type: "warning",
        };
        break;
      case "request_changes":
        patch = {
          ...patch,
          status: "NEEDS_CHANGES",
          seller_feedback: sellerFacingReason,
          admin_review_note: adminNote,
          reviewed_by: reviewerId,
          reviewed_at: now,
        };
        notification = {
          title: "Changes requested for your eBook",
          message: `Xophol Admin has requested changes to "${existing.title}": ${sellerFacingReason} Edit the listing and resubmit for review.`,
          type: "warning",
        };
        break;
      case "suspend":
        patch = {
          ...patch,
          status: "SUSPENDED",
          suspended_at: now,
          internal_moderation_reason: sellerFacingReason,
          admin_review_note: adminNote,
          reviewed_by: reviewerId,
          reviewed_at: now,
        };
        notification = {
          title: "Your eBook has been suspended",
          message: `Your eBook "${existing.title}" has been temporarily suspended from Xophol. Please review the administrator's message.`,
          type: "warning",
        };
        break;
      case "unpublish":
        patch = {
          ...patch,
          status: "UNPUBLISHED",
          internal_moderation_reason: sellerFacingReason,
          admin_review_note: adminNote,
          reviewed_by: reviewerId,
          reviewed_at: now,
        };
        notification = {
          title: "Your eBook is no longer public",
          message: `"${existing.title}" was removed from public discovery on Xophol. Contact Xophol Admin for details.`,
          type: "warning",
        };
        break;
      case "reinstate":
        patch = {
          ...patch,
          status: "PUBLISHED",
          suspended_at: null,
          internal_moderation_reason: null,
          rejection_reason: null,
          seller_feedback: null,
          published_at: now,
          approved_at: now,
          reviewed_by: reviewerId,
          reviewed_at: now,
        };
        notification = {
          title: "Your eBook is live again",
          message: `Your eBook "${existing.title}" has been restored and is publicly available on Xophol.`,
          type: "success",
        };
        break;
      case "feature":
        patch = { ...patch, is_featured: true };
        break;
      case "unfeature":
        patch = { ...patch, is_featured: false };
        break;
      case "note":
        // Internal note only: no listing columns change (spec §14).
        break;
    }

    const { data, error } = await admin
      .from("ebook_listings")
      .update(patch)
      .eq("id", ebookId)
      .select("id, status, is_featured")
      .single();
    if (error) throw error;

    // Immutable audit trail (spec §13/§30): one row per decision or note.
    await admin.from("ebook_moderation_history").insert({
      ebook_id: ebookId,
      admin_id: reviewerId,
      previous_status: fromStatus,
      new_status: data.status,
      action: ACTION_HISTORY_LABEL[input.action],
      reason: input.action === "note" ? null : sellerFacingReason,
      note: adminNote,
    });

    const eventByAction: Record<string, string> = {
      approve: "ebook_approved",
      reject: "ebook_rejected",
      request_changes: "ebook_changes_requested",
      suspend: "ebook_suspended",
      unpublish: "ebook_unpublished",
      reinstate: "ebook_restored",
    };
    const eventName = eventByAction[input.action];
    if (eventName) {
      await admin.from("ebook_events").insert({
        event_name: eventName,
        ebook_id: ebookId,
        user_id: reviewerId,
        source: "admin_review",
        metadata: { reason: sellerFacingReason, from: fromStatus, to: data.status },
      });
    }

    // Seller notification via the existing mechanism (spec §15). The seller
    // only ever sees seller-facing fields; internal notes stay in history.
    if (notification && existing.user_id) {
      await admin.from("notifications").insert({
        user_id: existing.user_id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        link_url: `/dashboard/ebooks/${ebookId}/edit`,
      });
    }

    return apiSuccess({ book: data, action: input.action });
  } catch (error) {
    return handleApiError(error);
  }
}
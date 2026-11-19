import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ productId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required.", "UNAUTHORIZED");
    const { productId } = await params;
    const admin = createAdminClient();
    const { data: entitlement, error: entitlementError } = await admin
      .from("user_library")
      .select("id, order_id")
      .eq("user_id", session.user.id)
      .eq("product_id", productId)
      .eq("access_status", "active")
      .maybeSingle();
    if (entitlementError) throw entitlementError;
    if (!entitlement) throw new ApiError(403, "You do not own this ebook.", "PURCHASE_REQUIRED");

    const { data: order, error: orderError } = await admin
      .from("ebook_transactions")
      .select("id, status, refund_status")
      .eq("id", entitlement.order_id)
      .eq("buyer_user_id", session.user.id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.status !== "VERIFIED" || ["REFUNDED", "DISPUTED"].includes(order.refund_status)) {
      throw new ApiError(403, "This ebook is no longer eligible for download.", "ACCESS_REVOKED");
    }

    const { data: file, error: fileError } = await admin
      .from("product_files")
      .select("id, storage_bucket, storage_path, file_name")
      .eq("product_id", productId)
      .eq("is_active", true)
      .maybeSingle();
    if (fileError) throw fileError;
    if (!file) throw new ApiError(404, "The ebook file is not available yet.", "FILE_NOT_AVAILABLE");

    const { data: signed, error: signedError } = await admin.storage
      .from(file.storage_bucket)
      .createSignedUrl(file.storage_path, 120, { download: file.file_name });
    if (signedError || !signed?.signedUrl) throw signedError ?? new Error("Unable to create download URL.");

    const { error: logError } = await admin.from("download_logs").insert({
      user_id: session.user.id,
      product_id: productId,
      order_id: entitlement.order_id,
      file_id: file.id,
      user_agent: request.headers.get("user-agent"),
    });
    if (logError) throw logError;

    return NextResponse.redirect(signed.signedUrl, { status: 302 });
  } catch (error) {
    return handleApiError(error);
  }
}

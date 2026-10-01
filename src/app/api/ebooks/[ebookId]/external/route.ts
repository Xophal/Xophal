import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@/lib/api-utils";
import { isAdmin, requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasVerifiedEbookPurchase } from "@/lib/ebooks/orders";

type Context = { params: Promise<{ ebookId: string }> };

/**
 * Post-purchase access to the seller's external fulfilment destination.
 *
 * The original eBook file is never stored on Xophol, and the destination URL is
 * never rendered into public pages. Free listings redirect for anyone; paid
 * listings require a server-verified purchase (or the owner / an admin). Every
 * successful redirect is counted through the record_ebook_external_click RPC,
 * which also verifies the listing is still PUBLISHED.
 */
export async function GET(request: NextRequest, context: Context) {
  try {
    const { ebookId } = await context.params;
    const admin = createAdminClient();

    const { data: listing, error } = await admin
      .from("ebook_listings")
      .select("id, user_id, price, status")
      .eq("id", ebookId)
      .maybeSingle();
    if (error) throw error;
    if (!listing || listing.status !== "PUBLISHED") {
      throw new ApiError(404, "This book is not available.", "NOT_FOUND");
    }

    const isFree = Number(listing.price) <= 0;
    if (!isFree) {
      const session = await requireAuth();
      if (!session) {
        throw new ApiError(401, "Sign in to open this book.", "UNAUTHORIZED");
      }
      const allowed =
        session.user.id === listing.user_id ||
        (await isAdmin(session.user.id)) ||
        (await hasVerifiedEbookPurchase(session.user.id, ebookId));
      if (!allowed) {
        throw new ApiError(402, "Purchase this book to open it.", "PURCHASE_REQUIRED");
      }
    }

    const { data: destination } = await admin.rpc("record_ebook_external_click", { p_ebook_id: ebookId });
    if (!destination) throw new ApiError(404, "This book is not available.", "NOT_FOUND");

    return NextResponse.redirect(destination, { status: 302 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: "Could not open this book." }, { status: 500 });
  }
}
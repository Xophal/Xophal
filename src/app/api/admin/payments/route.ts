import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, handleApiError, getPaginationParams, paginatedResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    const { searchParams } = request.nextUrl;
    const { page, limit, offset } = getPaginationParams(searchParams);
    const search = (searchParams.get("q") || "").trim();
    const status = searchParams.get("status");

    let query = createAdminClient()
      .from("payments")
      .select("id, amount, discount_amount, final_amount, currency, status, invoice_number, razorpay_order_id, razorpay_payment_id, created_at, updated_at, profiles(full_name, email), subscription_plans(name, code), coupons(code)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (search) query = query.or(`profiles.full_name.ilike.%${search}%,profiles.email.ilike.%${search}%,razorpay_order_id.ilike.%${search}%,invoice_number.ilike.%${search}%`);

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    // Summary cards: paid revenue + status counts for the current filter context.
    const admin = createAdminClient();
    const [paidCount, pendingCount, failedCount, refundedCount, revenueResp] = await Promise.all([
      admin.from("payments").select("id", { count: "exact", head: true }).eq("status", "paid"),
      admin.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("payments").select("id", { count: "exact", head: true }).eq("status", "failed"),
      admin.from("payments").select("id", { count: "exact", head: true }).eq("status", "refunded"),
      admin.from("payments").select("sum(final_amount)").eq("status", "paid"),
    ]);
    const revenue = Number((revenueResp.data as Array<{ sum: number | null }> | null)?.[0]?.sum ?? 0) || 0;

    return apiSuccess({
      ...paginatedResponse(data ?? [], count ?? 0, page, limit),
      summary: {
        revenue,
        paid: paidCount.count ?? 0,
        pending: pendingCount.count ?? 0,
        failed: failedCount.count ?? 0,
        refunded: refundedCount.count ?? 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

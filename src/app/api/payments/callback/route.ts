import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get("payment_id");
    const orderId = searchParams.get("order_id");

    if (!paymentId || !orderId) {
      return apiError("Missing callback parameters", 400, "INVALID_CALLBACK");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payments")
      .select("id, status")
      .eq("razorpay_order_id", orderId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return apiError("Payment not found", 404, "PAYMENT_NOT_FOUND");

    return apiSuccess({ paymentId, orderId, status: data.status });
  } catch (error) {
    return handleApiError(error);
  }
}

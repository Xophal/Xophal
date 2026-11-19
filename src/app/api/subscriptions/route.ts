import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { requireVerifiedSession } from "@/lib/auth-policy";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Authentication required", 401, "UNAUTHORIZED");
    }

    const { data: profile } = await supabase.from("profiles").select("*, roles(code)").eq("id", user.id).maybeSingle();
    try {
      requireVerifiedSession(profile, user, { allowRoles: ["student"] });
    } catch (error) {
      return apiError(error instanceof Error ? error.message : "Authentication required", 403, "FORBIDDEN");
    }

    const [{ data: subscriptions, error: subscriptionsError }, { data: payments, error: paymentsError }, { data: history, error: historyError }, { data: refunds, error: refundsError }] = await Promise.all([
      supabase
      .from("subscriptions")
      .select("id, status, starts_at, expires_at, plan_id, created_at, source_payment_submission_id, subscription_plans(id, code, name, price, currency, duration_value, duration_unit, features, applicable_board_codes, applicable_class_numbers, applicable_subject_ids, included_mock_test_ids, test_categories)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
      supabase
        .from("payment_submissions")
        .select("id, subscription_plan_id, subscription_id, order_reference, amount_minor, final_amount_minor, currency, reference_code, payment_paid_at, status, reason, created_at, approved_at, verified_at, product_snapshot")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("subscription_history")
        .select("id, subscription_id, plan_id, action, previous_status, new_status, notes, metadata, created_at, subscription_plans(name, code)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("subscription_refunds")
        .select("id, subscription_id, amount_minor, status, refund_reference, refund_date, reason, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (subscriptionsError) throw subscriptionsError;
    if (paymentsError) throw paymentsError;
    if (historyError) throw historyError;
    if (refundsError) throw refundsError;

    const now = Date.now();
    const subjectIds = [...new Set((subscriptions ?? []).flatMap((subscription) => {
      const plans = subscription.subscription_plans;
      const plan = Array.isArray(plans) ? plans[0] : plans;
      return plan?.applicable_subject_ids ?? [];
    }))];
    let subjectNames: { id: string; name: string }[] = [];
    if (subjectIds.length > 0) {
      const { data, error } = await supabase.from("subjects").select("id, name").in("id", subjectIds);
      if (error) throw error;
      subjectNames = data ?? [];
    }

    return apiSuccess({
      subscriptions: (subscriptions ?? []).map((subscription) => ({
        ...subscription,
        effective_status: subscription.status === "active"
          ? new Date(subscription.expires_at).getTime() <= now
            ? "expired"
            : new Date(subscription.starts_at).getTime() > now
              ? "queued"
              : "active"
          : subscription.status,
        is_current:
          subscription.status === "active" &&
          new Date(subscription.starts_at).getTime() <= now &&
          new Date(subscription.expires_at).getTime() > now,
        days_remaining: Math.max(0, Math.ceil((new Date(subscription.expires_at).getTime() - now) / 86400000)),
      })),
      paymentHistory: payments ?? [],
      subscriptionHistory: history ?? [],
      refundHistory: refunds ?? [],
      subjects: subjectNames,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

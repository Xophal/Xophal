import { apiSuccess, handleApiError } from "@/lib/api-utils";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const admin = createAdminClient();
    const [{ data: plans, error: plansError }, { data: settings, error: settingsError }] = await Promise.all([
      admin
        .from("subscription_plans")
        .select("id, code, name, description, price, currency, duration_days, duration_value, duration_unit, features, applicable_board_codes, applicable_class_numbers, applicable_subject_ids, included_mock_test_ids, test_categories, access_limitations, sort_order")
        .eq("is_active", true)
        .eq("currency", "INR")
        .gt("price", 0)
        .lte("price", 21474836.47)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      admin
        .from("manual_payment_settings")
        .select("upi_id, payee_name, instructions, is_enabled")
        .eq("id", 1)
        .maybeSingle(),
    ]);

    if (plansError) throw plansError;
    if (settingsError) throw settingsError;

    return apiSuccess({
      plans: plans ?? [],
      payment: {
        enabled: Boolean(settings?.is_enabled && settings.upi_id),
        upi_id: settings?.is_enabled ? settings.upi_id : null,
        payee_name: settings?.is_enabled ? settings.payee_name : null,
        instructions: settings?.is_enabled ? settings.instructions : null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

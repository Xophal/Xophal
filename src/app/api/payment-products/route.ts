import { apiSuccess, handleApiError } from "@/lib/api-utils";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const admin = createAdminClient();
    const [{ data: products, error: productsError }, { data: settings, error: settingsError }] = await Promise.all([
      admin
        .from("product_catalog")
        .select("id, code, product_type, board_code, class_number, name, description, price_paise, early_bird_price_paise, school_price_paise, duration_days, validity_starts_at, validity_ends_at, early_bird_starts_at, early_bird_ends_at")
        .eq("is_active", true)
        .eq("is_public", true)
        .order("class_number", { ascending: true })
        .order("product_type", { ascending: true }),
      admin
        .from("manual_payment_settings")
        .select("upi_id, payee_name, instructions, is_enabled")
        .eq("id", 1)
        .maybeSingle(),
    ]);
    if (productsError) throw productsError;
    if (settingsError) throw settingsError;
    return apiSuccess({
      products: products ?? [],
      payment: {
        method: "upi_manual",
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

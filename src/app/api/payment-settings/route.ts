import { createClient } from "@/lib/supabase/server";
import { apiSuccess, handleApiError } from "@/lib/api-utils";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("manual_payment_settings")
      .select("upi_id, payee_name, instructions, is_enabled, qr_code_url")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return apiSuccess({
      method: "upi_manual",
      enabled: Boolean(data?.is_enabled && data.upi_id),
      upi_id: data?.is_enabled ? data.upi_id : null,
      payee_name: data?.is_enabled ? data.payee_name : null,
      instructions: data?.is_enabled ? data.instructions : null,
      qr_code_url: data?.is_enabled ? data.qr_code_url : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const settingsSchema = z.object({
  upi_id: z.string().trim().min(5).max(255),
  payee_name: z.string().trim().min(2).max(200),
  instructions: z.string().trim().max(2000).optional().nullable(),
  qr_code_url: z.string().trim().regex(/^\/(?!\/)/, "QR code must be a same-site path.").optional().nullable(),
  is_enabled: z.boolean(),
});

export async function GET() {
  try {
    await requireAdminRole(["super_admin", "admin", "subscription_admin"]);
    const { data, error } = await createAdminClient()
      .from("manual_payment_settings")
      .select("upi_id, payee_name, instructions, qr_code_url, is_enabled, updated_at")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdminRole(["super_admin", "admin", "subscription_admin"]);
    const payload = await validateBody(settingsSchema, await request.json());
    const { data, error } = await createAdminClient()
      .from("manual_payment_settings")
      .upsert({
        id: 1,
        ...payload,
        updated_by: session.user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" })
      .select("upi_id, payee_name, instructions, qr_code_url, is_enabled, updated_at")
      .single();
    if (error?.code === "23514") {
      return apiError("Enter a valid UPI ID (for example, merchant@bank).", 400, "INVALID_UPI_ID");
    }
    if (error) throw error;
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

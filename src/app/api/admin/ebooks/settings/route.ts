import { NextRequest } from "next/server";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { configToSettingRows, getMarketplaceConfig } from "@/lib/ebooks/config";
import { ebookMarketplaceConfigSchema } from "@/lib/ebooks/schema";

/** Live marketplace configuration (commission, pricing rules, payout hold). */
export async function GET() {
  try {
    await requireAdminRole(["super_admin", "admin"]);
    const config = await getMarketplaceConfig();
    return apiSuccess({ config });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Persists new marketplace configuration. Commission changes are versioned by updated_by/updated_at. */
export async function PUT(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const session = await requireAdminRole(["super_admin", "admin"]);
    const input = await validateBody(ebookMarketplaceConfigSchema, await request.json());
    if (input.minPrice > input.maxPrice) {
      throw new ApiError(400, "Maximum price must be greater than or equal to the minimum price.", "INVALID_RANGE");
    }
    const admin = createAdminClient();
    const rows = configToSettingRows(input, session.user.id);
    const { error } = await admin.from("ebook_marketplace_settings").upsert(rows, { onConflict: "setting_key" });
    if (error) throw error;
    return apiSuccess({ config: await getMarketplaceConfig() });
  } catch (error) {
    return handleApiError(error);
  }
}
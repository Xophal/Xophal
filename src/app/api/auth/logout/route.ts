import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";
import { apiSuccess, handleApiError, assertTrustedOrigin } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const supabase = await createRouteHandlerClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return apiSuccess({ message: "Signed out" });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextResponse } from "next/server";

// Password-reset tokens are handled exclusively by the Supabase client recovery
// flow. Accepting a bearer token in an application request risks token leakage.
export async function POST() {
  return NextResponse.json(
    { success: false, error: "Use the password reset page to complete this request.", code: "RESET_FLOW_CHANGED" },
    { status: 410 }
  );
}

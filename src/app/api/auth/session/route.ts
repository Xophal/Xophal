import { NextResponse } from "next/server";

// Deliberately retired: raw access and refresh tokens must not be posted to an
// application endpoint. The SSR browser client maintains secure auth cookies.
export async function POST() {
  return NextResponse.json({ success: false, error: "This endpoint is no longer available." }, { status: 410 });
}

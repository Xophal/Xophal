import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import { cookies } from "next/headers";
import { isAdminRole } from "@/lib/roles";
import { ensureProfile, promoteMainAdminProfile } from "@/lib/auth";
import type { Profile } from "@/types";

function getSafeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) {
    return null;
  }

  return value;
}

function redirectWithError(origin: string, code: string, message: string, next: string | null) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", code);
  if (message) url.searchParams.set("message", message.slice(0, 300));
  if (next) url.searchParams.set("redirect", next);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = getSafeNext(requestUrl.searchParams.get("next"));
  const oauthError = requestUrl.searchParams.get("error");
  const oauthDescription = requestUrl.searchParams.get("error_description");

  // The OAuth provider rejected the request or the user denied access. Surface
  // the real reason instead of silently bouncing back to the auth form.
  if (oauthError) {
    const reason =
      oauthError === "access_denied"
        ? "You denied the Google sign-in request. Please try again and allow access."
        : oauthDescription || `Google sign-in failed (${oauthError}).`;
    return redirectWithError(requestUrl.origin, "oauth_denied", reason, next);
  }

  if (!code) {
    return redirectWithError(requestUrl.origin, "verification_failed", "Sign-in could not be completed. No authorization code was returned.", next);
  }

  const cookieStore = await cookies();
  const refreshedCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];
  const supabase = createServerClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        cookiesToSet.forEach((cookie: { name: string; value: string; options: CookieOptions }) => {
          refreshedCookies.push(cookie);
          try {
            cookieStore.set(cookie.name, cookie.value, cookie.options);
          } catch {
            // The redirect response below receives the cookies explicitly.
          }
        });
      },
    },
  });
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("[auth/callback] exchangeCodeForSession failed", {
      status: error?.status,
      code: error?.code,
      message: error?.message,
      hasUser: Boolean(data?.user),
    });
    return redirectWithError(requestUrl.origin, "verification_failed", error?.message || "Sign-in could not be completed. Please try again.", next);
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role_id, roles(code)")
    .eq("id", data.user.id)
    .maybeSingle();
  let profile: unknown = profileRow;

  if (!profile) {
    profile = await ensureProfile(data.user);
  }

  // A configured main administrator must be able to reach /admin even when
  // their account was previously created as a student (e.g. via Google/OAuth).
  if (data.user.email) {
    profile = await promoteMainAdminProfile({
      userId: data.user.id,
      email: data.user.email,
      profile: profile as Profile | null,
    });
  }

  const destination = next === "/admin" && !isAdminRole(profile)
    ? "/dashboard"
    : next || (isAdminRole(profile) ? "/admin" : "/dashboard");
  const response = NextResponse.redirect(new URL(destination, requestUrl.origin));
  refreshedCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}
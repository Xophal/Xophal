import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import { cookies } from "next/headers";
import { isAdminRole } from "@/lib/roles";
import { ensureProfile, promoteMainAdminProfile } from "@/lib/auth";
import type { Profile } from "@/types";
import { OAUTH_NEXT_COOKIE } from "@/lib/oauth-constants";

function getSafeNext(value: string | null) {
  if (!value || value === "/" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) {
    return null;
  }

  return value;
}

/** Clear the one-shot OAuth destination cookie on whichever response we send. */
function clearNextCookie(response: NextResponse) {
  response.cookies.set(OAUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

function applyRefreshedCookies(
  response: NextResponse,
  cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>
) {
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}

/** Decode the stored OAuth destination, tolerating malformed values. */
function readNextCookie(raw: string | undefined) {
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

function redirectWithError(origin: string, code: string, message: string, next: string | null) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", code);
  if (message) url.searchParams.set("message", message.slice(0, 300));
  if (next) url.searchParams.set("redirect", next);
  return clearNextCookie(NextResponse.redirect(url));
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  // The OAuth destination is carried in a short-lived cookie rather than the
  // query string: appending `?next=` to redirectTo breaks the Supabase
  // redirect allowlist match and silently lands users on the Site URL. The
  // query param is still honoured for flows that legitimately set it (e.g.
  // password reset), with the cookie as the fallback.
  const next =
    getSafeNext(requestUrl.searchParams.get("next")) ??
    getSafeNext(readNextCookie(request.cookies.get(OAUTH_NEXT_COOKIE)?.value));
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

  let profile: Profile;
  try {
    profile = await ensureProfile(data.user);
    if (profile.is_active !== true) {
      await supabase.auth.signOut();
      return applyRefreshedCookies(
        redirectWithError(requestUrl.origin, "account_deactivated", "This account has been deactivated.", next),
        refreshedCookies
      );
    }

    // A configured main administrator must be able to reach /admin even when
    // their account was previously created as a student (e.g. via Google/OAuth).
    if (data.user.email) {
      profile = (await promoteMainAdminProfile({
        userId: data.user.id,
        email: data.user.email,
        profile,
      })) ?? profile;
    }
  } catch (profileError) {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) console.error("[auth/callback] failed to clear incomplete session", signOutError);
    console.error("[auth/callback] account profile setup failed", profileError);
    return applyRefreshedCookies(
      redirectWithError(requestUrl.origin, "profile_setup_failed", "We couldn't finish setting up your account. Please try again.", next),
      refreshedCookies
    );
  }

  const destination = next === "/admin" && !isAdminRole(profile)
    ? "/dashboard"
    : next || (isAdminRole(profile) ? "/admin" : "/dashboard");
  return applyRefreshedCookies(
    clearNextCookie(NextResponse.redirect(new URL(destination, requestUrl.origin))),
    refreshedCookies
  );
}
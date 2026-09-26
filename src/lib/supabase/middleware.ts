import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { isAdminRole } from "@/lib/roles";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const publicPaths = [
    "/",
    "/login",
    "/register",
    "/admin/login",
    "/admin/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/auth/callback",
    "/about",
    "/pricing",
    "/blog",
    "/contact",
    "/faq",
    "/help-center",
    "/privacy-policy",
    "/terms-and-conditions",
    "/cookie-policy",
    "/refund-policy",
  ];
  // NOTE: the `/blog/` prefix test must be evaluated once for the pathname, not
  // inside the per-entry `some()` callback where it was OR-ed against every
  // public path (making any `/blog/*` URL public regardless of the list).
  const isPublicPath =
    pathname === "/blog" || pathname.startsWith("/blog/") || publicPaths.includes(pathname);
  // Exact/segment matching: the previous `startsWith` also matched unrelated
  // paths such as "/loginfoo" or "/registration-help".
  const isAuthPath = ["/login", "/register", "/admin/login", "/admin/register"].some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  const isVerificationPath = pathname === "/verify-email";
  const isAdminPath = pathname.startsWith("/admin");
  const isApiPath = pathname.startsWith("/api");

  if (!user && !isPublicPath && !isApiPath) {
    const url = request.nextUrl.clone();
    url.pathname = isAdminPath ? "/admin/login" : "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Unverified users must be sent to /verify-email before the auth-path
  // redirect below, otherwise they bounce /login -> /dashboard -> /verify-email.
  if (user && !user.email_confirmed_at && !isVerificationPath && !isApiPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/verify-email";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && isAuthPath) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role_id, roles(code)")
      .eq("id", user.id)
      .single();

    const url = request.nextUrl.clone();
    if (isAdminRole(profile)) {
      url.pathname = "/admin";
    } else {
      url.pathname = "/dashboard";
    }

    return NextResponse.redirect(url);
  }

  if (isAdminPath && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role_id, roles(code)")
      .eq("id", user.id)
      .single();

    if (!isAdminRole(profile)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

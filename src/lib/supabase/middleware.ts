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
  const isPublicPath = publicPaths.some((p) => pathname === p || pathname.startsWith("/blog/"));
  const isAuthPath = pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/admin/login") || pathname.startsWith("/admin/register");
  const isVerificationPath = pathname === "/verify-email";
  const isAdminPath = pathname.startsWith("/admin");
  const isApiPath = pathname.startsWith("/api");

  if (!user && !isPublicPath && !isApiPath) {
    const url = request.nextUrl.clone();
    url.pathname = isAdminPath ? "/admin/login" : "/login";
    url.searchParams.set("redirect", pathname);
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

  if (user && !user.email_confirmed_at && !isVerificationPath && !isAuthPath && !isApiPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/verify-email";
    url.search = "";
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

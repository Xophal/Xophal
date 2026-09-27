import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { isAdminRole } from "@/lib/roles";

function copySupabaseCookies(target: NextResponse, source: NextResponse) {
  for (const cookie of source.headers.getSetCookie()) {
    target.headers.append("set-cookie", cookie);
  }
}

export async function updateSession(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as { sub?: string } | null | undefined)?.sub ?? null;

  if (claimsError) {
    console.warn("[proxy] supabase auth claims check failed", claimsError.message);
  }

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
    "/mock-tests",
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
  const isPublicPath =
    pathname === "/blog" || pathname.startsWith("/blog/") || publicPaths.includes(pathname);
  const isAuthPath = ["/login", "/register", "/admin/login", "/admin/register"].some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  const isVerificationPath = pathname === "/verify-email";
  const isAdminPath = pathname.startsWith("/admin");
  const isApiPath = pathname.startsWith("/api");

  if (!userId && !isPublicPath && !isApiPath) {
    const url = request.nextUrl.clone();
    url.pathname = isAdminPath ? "/admin/login" : "/login";
    url.searchParams.set("redirect", pathname);
    const redirectResponse = NextResponse.redirect(url);
    copySupabaseCookies(redirectResponse, supabaseResponse);
    return redirectResponse;
  }

  if (userId && !isPublicPath && !isApiPath) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role_id, roles(code)")
      .eq("id", userId)
      .maybeSingle();

    if (!profile && !isVerificationPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/verify-email";
      url.search = "";
      const redirectResponse = NextResponse.redirect(url);
      copySupabaseCookies(redirectResponse, supabaseResponse);
      return redirectResponse;
    }
  }

  if (userId && !isVerificationPath && !isApiPath) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role_id, roles(code)")
      .eq("id", userId)
      .maybeSingle();

    if (profile && !profile.role_id && !isAuthPath && !isAdminPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/verify-email";
      url.search = "";
      const redirectResponse = NextResponse.redirect(url);
      copySupabaseCookies(redirectResponse, supabaseResponse);
      return redirectResponse;
    }
  }

  if (userId && isAuthPath) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role_id, roles(code)")
      .eq("id", userId)
      .maybeSingle();

    const url = request.nextUrl.clone();
    url.pathname = isAdminRole(profile) ? "/admin" : "/dashboard";
    const redirectResponse = NextResponse.redirect(url);
    copySupabaseCookies(redirectResponse, supabaseResponse);
    return redirectResponse;
  }

  if (isAdminPath && userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role_id, roles(code)")
      .eq("id", userId)
      .maybeSingle();

    if (!isAdminRole(profile)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      const redirectResponse = NextResponse.redirect(url);
      copySupabaseCookies(redirectResponse, supabaseResponse);
      return redirectResponse;
    }
  }

  return supabaseResponse;
}

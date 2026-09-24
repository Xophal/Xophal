"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
// Using server-side login endpoint to enforce rate-limits and protections
import { loginSchema, type LoginInput } from "@/lib/validations";
import { ROUTES } from "@/constants";
import { isAdminRole } from "@/lib/roles";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import { OtpForm } from "@/components/auth/otp-form";
import XophalLogo from "@/components/shared/xophal-logo";

type LoginFormProps = {
  mode?: "student" | "admin";
  onSuccess?: () => void;
  allowSelfRegistration?: boolean;
};

export function LoginForm({ mode = "student", onSuccess, allowSelfRegistration = false }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRedirect = searchParams.get("redirect");
  const redirect =
    requestedRedirect &&
    requestedRedirect.startsWith("/") &&
    !requestedRedirect.startsWith("//") &&
    !requestedRedirect.includes("\\") &&
    !requestedRedirect.includes("://")
      ? requestedRedirect
      : ROUTES.dashboard;
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authMethod, setAuthMethod] = useState<"otp" | "password">("password");

  // Surface OAuth/callback failures (e.g. "access_denied" on Google, an invalid
  // auth code, or a code-exchange error) instead of silently bouncing the user
  // back to the login/registration form with no explanation.
  useEffect(() => {
    const oauthError = searchParams.get("error");
    const oauthMessage = searchParams.get("message");
    if (oauthError) {
      toast({
        title: oauthError === "oauth_denied" ? "Google sign-in cancelled" : "Sign-in could not be completed",
        description: oauthMessage || "Please try again.",
        variant: "destructive",
      });
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        toast({
          title: "Login failed",
          description: result?.error || "Invalid email or password.",
          variant: "destructive",
        });
        return;
      }

      // The SSR browser client persists this session in the cookies read by
      // middleware and Server Components. Never forward raw tokens to an API.
      let destination = redirect;
      try {
        const meResponse = await fetch("/api/auth/me", { cache: "no-store" });
        const meResult = await meResponse.json();
        const isUserAdmin = meResponse.ok && meResult?.success && isAdminRole(meResult.data?.profile);

        if (isUserAdmin) {
          destination = "/admin";
        } else if (mode === "admin") {
          try {
            await createBrowserSupabaseClient().auth.signOut();
          } catch {
            // Intentionally ignore client sign-out issues while preserving the access gate.
          }

          toast({
            title: "Admin access required",
            description: "This sign-in is for administrators and content managers only.",
            variant: "destructive",
          });
          router.replace(ROUTES.adminLogin);
          router.refresh();
          return;
        }
      } catch {
        // Do not leak implementation details. The protected destination will
        // independently verify the session and role on the server.
      }

      onSuccess?.();
      router.push(destination);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const isAdminMode = mode === "admin";

  if (authMethod === "otp") {
    return (
      <OtpForm
        intent={isAdminMode ? "admin-login" : "login"}
        onUsePassword={() => setAuthMethod("password")}
      />
    );
  }

  return (
    <Card className={isAdminMode ? "glass w-full max-w-md admin-auth-card border-primary/30 bg-slate-950/50 text-slate-50 shadow-2xl shadow-primary/10" : "glass w-full max-w-md student-auth-card auth-panel-login text-white shadow-2xl"}>
      <CardHeader className="relative z-10 text-center py-8">
        <div className="mb-5 flex justify-center">
          <XophalLogo variant="stacked" size="lg" alt="Xophal" className="w-[220px]" />
        </div>
        <div className={isAdminMode ? "admin-auth-kicker mb-3" : "student-auth-kicker mb-3"}>
          {isAdminMode ? "XOPHAL CONTROL ROOM" : "XOPHAL LEARNING HUB"}
        </div>
        <CardTitle className={isAdminMode ? "text-2xl text-white" : "text-3xl font-semibold tracking-tight text-white"}>
          {isAdminMode ? "Admin portal" : "Welcome Back"}
        </CardTitle>
        <CardDescription className={isAdminMode ? "text-slate-300" : "text-slate-200/90 mt-1"}>
          {isAdminMode ? "Sign in to manage content" : "Sign in to continue your learning journey"}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4 card-content">
          <div className="space-y-2">
            <Label htmlFor="email" className={isAdminMode ? "text-slate-200" : "text-white/90"}>Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder={isAdminMode ? "admin@xophal.com" : "you@example.com"}
              className={isAdminMode ? "auth-input border-slate-700 text-white" : "auth-input"}
              aria-invalid={errors.email ? "true" : "false"}
              {...register("email")}
            />
            {errors.email && (
              <p role="alert" className="text-sm text-destructive mt-1">
                {errors.email.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className={isAdminMode ? "text-slate-200" : "text-white/90"}>Password</Label>
              <Link href="/forgot-password" className={isAdminMode ? "text-xs text-primary hover:underline" : "text-sm text-white/80 hover:underline"}>
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                className={isAdminMode ? "auth-input border-slate-700 pr-10 text-white" : "auth-input pr-10"}
                aria-invalid={errors.password ? "true" : "false"}
                {...register("password")}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((s) => !s)}
                className={isAdminMode ? "absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" : "absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-muted-foreground"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p role="alert" className="text-sm text-destructive mt-1">{errors.password.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-2">
          <Button type="submit" className={isAdminMode ? "w-full bg-primary text-white hover:bg-primary/90 px-8 py-3" : "w-full auth-login-btn px-8 py-3"} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign in
          </Button>
          <Button type="button" variant="link" onClick={() => setAuthMethod("otp")} className={isAdminMode ? "text-primary" : "text-white/80"}>
            Sign in with email code instead
          </Button>
          {!isAdminMode ? (
            <p className="text-center text-sm text-white/80">
              Are You New Member ? <Link href={ROUTES.register} className="text-white font-semibold hover:underline">Sign UP</Link>
            </p>
          ) : (
            <p className="text-center text-sm text-slate-300">
              {allowSelfRegistration ? (
                <>Need an account? <Link href={ROUTES.adminRegister} className="font-medium text-primary hover:underline">Create one</Link></>
              ) : (
                "Need admin access? Contact a super administrator."
              )}
            </p>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}

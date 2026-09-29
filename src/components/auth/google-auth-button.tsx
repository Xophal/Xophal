"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { OAUTH_CALLBACK_PATH, OAUTH_NEXT_COOKIE } from "@/lib/oauth-constants";

/** "or continue with" rule used to separate OAuth from password/email-code auth. */
export function AuthDivider({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)} aria-hidden="true">
      <span className="h-px flex-1 bg-current opacity-20" />
      <span className="text-xs uppercase tracking-wide opacity-70">or</span>
      <span className="h-px flex-1 bg-current opacity-20" />
    </div>
  );
}

export function GoogleAuthButton({ next = "/dashboard" }: { next?: string }) {
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    const safeNext = next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") && !next.includes("://") ? next : "/dashboard";
    // The destination travels in a cookie, not the query string. Appending
    // `?next=` to redirectTo makes the URL stop matching Supabase's redirect
    // allowlist, which silently falls back to the Site URL (the homepage).
    document.cookie = `${OAUTH_NEXT_COOKIE}=${encodeURIComponent(safeNext)}; path=/; max-age=600; samesite=lax`;
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${OAUTH_CALLBACK_PATH}` },
    });
    if (error) {
      setLoading(false);
      document.cookie = `${OAUTH_NEXT_COOKIE}=; path=/; max-age=0`;
      toast({ title: "Google sign-in unavailable", description: error.message, variant: "destructive" });
    }
  }

  return <Button type="button" variant="outline" className="w-full" onClick={signInWithGoogle} disabled={loading}>
    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <span className="mr-2 font-bold">G</span>}
    Continue with Google
  </Button>;
}
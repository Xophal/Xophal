"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";

export function GoogleAuthButton({ next = "/dashboard" }: { next?: string }) {
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    const safeNext = next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") && !next.includes("://") ? next : "/dashboard";
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}` },
    });
    if (error) {
      setLoading(false);
      toast({ title: "Google sign-in unavailable", description: error.message, variant: "destructive" });
    }
  }

  return <Button type="button" variant="outline" className="w-full" onClick={signInWithGoogle} disabled={loading}>
    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <span className="mr-2 font-bold">G</span>}
    Continue with Google
  </Button>;
}
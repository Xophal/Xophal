"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";

type Props = {
  className?: string;
};

export default function LogoutButton({ className }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Server logout failed");
      await createClient().auth.signOut();
      router.replace("/");
      router.refresh();
    } catch {
      try {
        await createClient().auth.signOut();
        router.replace("/");
        router.refresh();
      } catch {
        toast({ title: "Could not log out", description: "Please try again.", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={logout} disabled={loading} className={className}>
      <LogOut className="mr-2 h-4 w-4" />
      {loading ? "Signing out..." : "Log out"}
    </Button>
  );
}
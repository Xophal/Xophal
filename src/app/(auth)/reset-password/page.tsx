"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";

function ResetPasswordContent() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(Boolean(data.session));
      setSessionReady(true);
    });

    const { data: authState } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setHasSession(Boolean(session));
      setSessionReady(true);
    });

    return () => {
      mounted = false;
      authState.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasSession) {
      toast({ title: "Reset link required", description: "Open the password reset link from your email again.", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "Choose a stronger password", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      await createClient().auth.signOut();
      toast({ title: 'Password reset', description: 'You can now sign in with your new password.' });
      router.replace('/login');
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally { setLoading(false); }
  }

  return (
    <div className="container mx-auto py-12">
      <div className="max-w-md mx-auto">
        <h3 className="text-2xl mb-4">Reset password</h3>
        <p className="text-sm text-muted-foreground mb-6">Enter a new password to update your account. Open this page from the reset link in your email.</p>
        {!sessionReady ? (
          <p className="text-sm text-muted-foreground">Checking your reset link...</p>
        ) : !hasSession ? (
          <p role="alert" className="text-sm text-destructive">This reset link is missing or expired. Request a new one to continue.</p>
        ) : <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading} className="w-full">{loading ? 'Resetting...' : 'Reset password'}</Button>
        </form>}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}

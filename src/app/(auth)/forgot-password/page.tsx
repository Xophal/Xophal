"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to request password reset');
      toast({ title: 'Reset email sent', description: 'Check your inbox for the password reset link.' });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally { setLoading(false); }
  }

  return (
    <div className="container mx-auto py-12">
      <div className="max-w-md mx-auto">
        <h3 className="text-2xl mb-4">Forgot password</h3>
        <p className="text-sm text-muted-foreground mb-6">Enter your email and we&apos;ll send a link to reset your password.</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <Button type="submit" disabled={loading} className="w-full">{loading ? 'Sending...' : 'Send reset link'}</Button>
        </form>
      </div>
    </div>
  );
}

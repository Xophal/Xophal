"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { otpRequestSchema, otpVerifySchema } from "@/lib/validations";
import { getFallbackBoards, getFallbackClassesForBoard } from "@/lib/board-data";
import type { Board, Class } from "@/types";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";

type OtpIntent = "login" | "signup" | "admin-login";

type OtpFormProps = {
  intent: OtpIntent;
  initialEmail?: string;
  onUsePassword?: () => void;
};

export function OtpForm({ intent, initialEmail = "", onUsePassword }: OtpFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [fullName, setFullName] = useState("");
  const [boardId, setBoardId] = useState("");
  const [classId, setClassId] = useState("");
  const [boards, setBoards] = useState<Board[]>(() => intent === "signup" ? getFallbackBoards() as Board[] : []);
  const [classes, setClasses] = useState<Class[]>([]);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">(initialEmail ? "email" : "email");
  const [loading, setLoading] = useState(false);
  const isSignup = intent === "signup";
  const isAdmin = intent === "admin-login";

  useEffect(() => {
    if (!isSignup) return;
    fetch("/api/boards")
      .then((response) => response.json())
      .then((result) => {
        if (result?.success && Array.isArray(result.data) && result.data.length > 0) setBoards(result.data as Board[]);
        else setBoards(getFallbackBoards() as Board[]);
      })
      .catch(() => setBoards(getFallbackBoards() as Board[]));
  }, [isSignup]);

  useEffect(() => {
    if (!isSignup || !boardId) return;

    fetch(`/api/classes?boardId=${encodeURIComponent(boardId)}`)
      .then((response) => response.json())
      .then((result) => {
        if (result?.success && Array.isArray(result.data) && result.data.length > 0) setClasses(result.data as Class[]);
        else setClasses(getFallbackClassesForBoard(boardId) as Class[]);
      })
      .catch(() => setClasses(getFallbackClassesForBoard(boardId) as Class[]));
  }, [boardId, isSignup]);

  async function requestCode() {
    const parsed = otpRequestSchema.safeParse({
      email,
      intent,
      fullName: isSignup ? fullName : undefined,
      boardId: isSignup && boardId ? boardId : undefined,
      classId: isSignup && classId ? classId : undefined,
    });

    if (!parsed.success) {
      toast({ title: "Check your details", description: parsed.error.errors[0]?.message || "Enter a valid email address.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || "We could not send a code.");
      }
      setStep("code");
      toast({ title: "Check your inbox", description: "Enter the 6-digit code sent to your email." });
    } catch (error) {
      toast({ title: "Could not send code", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    const parsed = otpVerifySchema.safeParse({ email, token: code, intent });
    if (!parsed.success) {
      toast({ title: "Invalid code", description: parsed.error.errors[0]?.message || "Enter the 6-digit code.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || "That code is invalid or expired.");
      router.replace(result.data?.redirect || (isAdmin ? "/admin" : "/dashboard"));
      router.refresh();
    } catch (error) {
      toast({ title: "Verification failed", description: error instanceof Error ? error.message : "That code is invalid or expired.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className={isAdmin ? "glass w-full max-w-md admin-auth-card border-primary/30 bg-slate-950/50 text-slate-50 shadow-2xl shadow-primary/10" : "glass w-full max-w-xl student-auth-card auth-panel-login text-white shadow-2xl"}>
      <CardHeader className="relative z-10 space-y-2 text-center">
        <div className={isAdmin ? "admin-auth-kicker" : "student-auth-kicker"}>{isAdmin ? "XOPHAL CONTROL ROOM" : "XOPHAL LEARNING HUB"}</div>
        <CardTitle className={isAdmin ? "text-2xl text-white" : "text-3xl font-semibold tracking-tight text-white"}>
          {isSignup ? "Create your account" : isAdmin ? "Admin portal" : "Sign in with email"}
        </CardTitle>
        <CardDescription className={isAdmin ? "text-slate-300" : "text-slate-200/90"}>
          {step === "email" ? "We will send a one-time code to your email address." : `Enter the code sent to ${email}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="relative z-10 space-y-4">
        {step === "email" ? (
          <>
            {isSignup && (
              <div className="space-y-2">
                <Label htmlFor="otp-full-name">Full name</Label>
                <Input id="otp-full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="otp-email">Email address</Label>
              <Input id="otp-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            </div>
            {isSignup && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="otp-board">Board</Label>
                  <select id="otp-board" value={boardId} onChange={(event) => { const selectedBoardId = event.target.value; setBoardId(selectedBoardId); setClassId(""); setClasses(getFallbackClassesForBoard(selectedBoardId) as Class[]); }} className="flex h-10 w-full rounded-md px-3 py-2 text-sm glass-input">
                    <option value="">Select board</option>
                    {boards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="otp-class">Class</Label>
                  <select id="otp-class" value={classId} onChange={(event) => setClassId(event.target.value)} disabled={!boardId} className="flex h-10 w-full rounded-md px-3 py-2 text-sm glass-input">
                    <option value="">Select class</option>
                    {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </div>
              </div>
            )}
            <Button type="button" onClick={requestCode} disabled={loading} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Send verification code
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="otp-code">6-digit verification code</Label>
              <Input id="otp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" className="text-center text-xl tracking-[0.35em]" aria-label="6-digit verification code" />
            </div>
            <Button type="button" onClick={verifyCode} disabled={loading || code.length !== 6} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify and continue
            </Button>
            <Button type="button" variant="ghost" onClick={requestCode} disabled={loading} className="w-full text-white/80">
              <RefreshCw className="mr-2 h-4 w-4" />
              Resend code
            </Button>
            <Button type="button" variant="link" onClick={() => { setStep("email"); setCode(""); }} className="w-full text-white/80">Use a different email</Button>
          </>
        )}
      </CardContent>
      <CardFooter className="relative z-10 flex flex-col gap-3 text-center text-sm text-white/80">
        <div className="w-full"><GoogleAuthButton next={isAdmin ? "/admin" : "/dashboard"} /></div>
        {onUsePassword && <Button type="button" variant="link" onClick={onUsePassword} className="text-white/80">Use password instead</Button>}
      </CardFooter>
    </Card>
  );
}
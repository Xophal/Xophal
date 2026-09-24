"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Eye, EyeOff, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { registerSchema, type RegisterInput } from "@/lib/validations";
import { ROUTES } from "@/constants";
import { getFallbackBoards, getFallbackClassesForBoard } from "@/lib/board-data";
import type { Board, Class } from "@/types";
import { toast } from "@/hooks/use-toast";

type RegisterFormProps = {
  mode?: "student" | "admin";
  onSuccess?: () => void;
  allowAdminSignup?: boolean;
  onUseEmailCode?: () => void;
};

export function RegisterForm({ mode = "student", onSuccess, allowAdminSignup = false, onUseEmailCode }: RegisterFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const boardId = useWatch({
    control,
    name: "boardId",
  });

  useEffect(() => {
    const loadBoards = async () => {
      try {
        const response = await fetch("/api/boards");
        const result = await response.json();

        if (response.ok && result?.success && Array.isArray(result.data) && result.data.length > 0) {
          setBoards(result.data as Board[]);
          return;
        }
      } catch (error) {
        // ignore fetch errors and fallback below
      }

      try {
        const supabase = createClient();
        const { data, error } = await supabase.from("boards").select("id, name, slug, code").eq("is_active", true).order("sort_order");
        if (!error && data && data.length > 0) {
          setBoards(data as Board[]);
          return;
        }
      } catch (error) {
        // ignore fallback errors
      }

      setBoards(getFallbackBoards() as Board[]);
    };

    loadBoards();
  }, []);

  useEffect(() => {
    if (!boardId) {
      setValue("classId", undefined);
      return;
    }

    const loadClasses = async () => {
      try {
        const response = await fetch(`/api/classes?boardId=${boardId}`);
        const result = await response.json();

        if (response.ok && result?.success && Array.isArray(result.data) && result.data.length > 0) {
          setClasses(result.data as Class[]);
          return;
        }
      } catch (error) {
        // ignore fetch errors and fallback below
      }

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("classes")
          .select("id, board_id, code, name, slug, grade_number, is_active, sort_order")
          .eq("board_id", boardId)
          .eq("is_active", true)
          .order("sort_order");
        if (!error && data && data.length > 0) {
          setClasses(data as Class[]);
          return;
        }
      } catch (error) {
        // ignore fallback errors
      }

      const fallbackClasses = getFallbackClassesForBoard(boardId) as Class[];
      setClasses(fallbackClasses);
    };

    loadClasses();
  }, [boardId, setValue]);

  async function onSubmit(data: RegisterInput) {
    setLoading(true);
    try {
      const payload = {
        ...data,
        email: data.email.trim().toLowerCase(),
      };

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        toast({
          title: "Registration failed",
          description: result?.error || "We could not create your account. Check your details and try again.",
          variant: "destructive",
        });
        return;
      }

      const destination = `${ROUTES.verifyEmail}?email=${encodeURIComponent(payload.email)}`;

      toast({
        title: "Account created!",
        description:
          mode === "admin"
            ? "Check your email to verify the admin account before signing in."
            : "Check your email to verify your account before signing in.",
      });
      onSuccess?.();
      router.push(destination);
    } catch (error) {
      console.error("Registration error", error);
      toast({
        title: "Registration failed",
        description: error instanceof Error ? error.message : "We could not create your account. Check your details and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const isAdminMode = mode === "admin";

  return (
    <Card className="glass w-full max-w-md student-auth-card auth-panel-register">
      <CardHeader className="relative z-10 text-center">
        <div className="student-auth-kicker mb-3">
          XOPHAL LEARNING HUB
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
          {isAdminMode ? "Create admin account" : "Create your account"}
        </CardTitle>
        <CardDescription className="text-slate-600">
          {isAdminMode ? "Set up a content admin or manager account for the portal" : "Start preparing for SEBA & CBSE exams today"}
        </CardDescription>
        {!isAdminMode && (
          <div className="grid gap-2 pt-2 sm:grid-cols-2" aria-label="Choose account type">
            <Link
              href={ROUTES.register}
              aria-current="page"
              className="flex items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/15"
            >
              <UserRound className="h-4 w-4" />
              Student signup
            </Link>
            {allowAdminSignup ? (
              <Link href={ROUTES.adminRegister} className="flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary">
                <ShieldCheck className="h-4 w-4" />
                Admin signup
              </Link>
            ) : (
              <p className="flex items-center justify-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
                Admin signup by invitation
              </p>
            )}
          </div>
        )}
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" placeholder="Your name" aria-invalid={errors.fullName ? "true" : "false"} {...register("fullName")} />
            {errors.fullName && (
              <p role="alert" className="text-sm text-destructive mt-1">{errors.fullName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" aria-invalid={errors.email ? "true" : "false"} {...register("email")} />
            {errors.email && (
              <p role="alert" className="text-sm text-destructive mt-1">{errors.email.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="boardId">Board</Label>
                <select
                  id="boardId"
                  className="flex h-10 w-full px-3 py-2 text-sm glass-input"
                  {...register("boardId")}
                  aria-invalid={errors.boardId ? "true" : "false"}
                >
                <option value="">Select board</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="classId">Class</Label>
              <select
                id="classId"
                className="flex h-10 w-full px-3 py-2 text-sm glass-input"
                {...register("classId")}
                disabled={!boardId}
                aria-invalid={errors.classId ? "true" : "false"}
              >
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input id="password" type={showPassword ? "text" : "password"} aria-invalid={errors.password ? "true" : "false"} {...register("password")} />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-muted-foreground"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p role="alert" className="text-sm text-destructive mt-1">{errors.password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input id="confirmPassword" type={showPassword ? "text" : "password"} aria-invalid={errors.confirmPassword ? "true" : "false"} {...register("confirmPassword")} />
            {errors.confirmPassword && (
              <p role="alert" className="text-sm text-destructive mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full px-8 py-3" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Create account
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href={isAdminMode ? ROUTES.adminLogin : ROUTES.login} className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
          {onUseEmailCode && !isAdminMode && (
            <Button type="button" variant="link" onClick={onUseEmailCode} className="text-muted-foreground">
              Sign up with an email code instead
            </Button>
          )}
          {isAdminMode && (
            <p className="text-center text-sm text-muted-foreground">
              Signing up as a student?{" "}
              <Link href={ROUTES.register} className="text-primary hover:underline">Use student signup</Link>
            </p>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}

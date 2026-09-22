"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ROUTES } from "@/constants";
import { adminRegisterSchema, type AdminRegisterInput } from "@/lib/validations";

export function AdminRegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminRegisterInput>({
    resolver: zodResolver(adminRegisterSchema),
    defaultValues: {
      role: "admin",
    },
  });

  async function onSubmit(data: AdminRegisterInput) {
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

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "We could not create your admin account.");
      }

      toast({
        title: result.data?.pendingApproval ? "Approval request sent" : "Admin account created",
        description: result.data?.pendingApproval
          ? result.data?.approvalEmailSent
            ? "The two main administrators have been notified. You can sign in after they approve your request and you verify your email."
            : "Your request is pending approval. The administrators can review it from the admin portal, even if the notification email was delayed."
          : "Your portal admin account has been created. Verify your email, then sign in to continue.",
      });
      router.push(`${ROUTES.verifyEmail}?email=${encodeURIComponent(payload.email)}`);
    } catch (error) {
      console.error("Admin registration error", error);
      toast({
        title: "Admin registration failed",
        description: error instanceof Error ? error.message : "We could not create your admin account.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="glass w-full max-w-xl admin-auth-card border-primary/20 bg-slate-950/40 text-slate-50 shadow-2xl shadow-primary/10">
      <CardHeader className="space-y-4 text-center">
        <div className="admin-auth-kicker">
          XOPHAL CONTROL ROOM
        </div>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <CardTitle className="text-2xl font-bold">Create admin account</CardTitle>
          <CardDescription className="mt-2 text-sm text-slate-300">
            Create a portal admin, content manager, or super admin profile.
          </CardDescription>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="fullName" className="text-slate-200">Full name</Label>
              <Input
                id="fullName"
                placeholder="Enter full name"
                className="border-slate-700 bg-slate-900/80 text-white placeholder:text-slate-400"
                {...register("fullName")}
              />
              {errors.fullName && <p className="text-sm text-red-400">{errors.fullName.message}</p>}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="email" className="text-slate-200">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@xophal.com"
                className="border-slate-700 bg-slate-900/80 text-white placeholder:text-slate-400"
                {...register("email")}
              />
              {errors.email && <p className="text-sm text-red-400">{errors.email.message}</p>}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="phone" className="text-slate-200">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+91 9876543210"
                className="border-slate-700 bg-slate-900/80 text-white placeholder:text-slate-400"
                {...register("phone")}
              />
              {errors.phone && <p className="text-sm text-red-400">{errors.phone.message}</p>}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="role" className="text-slate-200">Admin role</Label>
              <select
                id="role"
                className="flex h-10 w-full px-3 py-2 text-sm glass-input text-white"
                {...register("role")}
              >
                <option value="admin">Admin</option>
                <option value="content_manager">Content Manager</option>
                <option value="reviewer">Reviewer</option>
                <option value="super_admin">Super Admin</option>
              </select>
              {errors.role && <p className="text-sm text-red-400">{errors.role.message}</p>}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="password" className="text-slate-200">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  className="border-slate-700 bg-slate-900/80 pr-10 text-white placeholder:text-slate-400"
                  {...register("password")}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-red-400">{errors.password.message}</p>}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="confirmPassword" className="text-slate-200">Confirm password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Re-enter password"
                className="border-slate-700 bg-slate-900/80 text-white placeholder:text-slate-400"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-400">{errors.confirmPassword.message}</p>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create admin account
          </Button>
          <p className="text-center text-sm text-slate-300">
            Already have an admin account?{" "}
            <Link href={ROUTES.adminLogin} className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
          <p className="text-center text-sm text-slate-300">
            Signing up as a student?{" "}
            <Link href={ROUTES.register} className="font-medium text-primary hover:underline">
              Use student signup
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

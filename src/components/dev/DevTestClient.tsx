"use client";

import React, { useState } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { AuthFooter } from "@/components/auth/auth-footer";
import { Button } from "@/components/ui/button";

export default function DevTestClient() {
  const [variant, setVariant] = useState<"login" | "register">("login");

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="p-6 border-b bg-white">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold">Dev Test — Auth Preview</h1>
          <div className="flex items-center gap-2">
            <Button variant={variant === "login" ? undefined : "ghost"} onClick={() => setVariant("login")}>Login</Button>
            <Button variant={variant === "register" ? undefined : "ghost"} onClick={() => setVariant("register")}>Register</Button>
          </div>
        </div>
      </div>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl">
          {variant === "login" ? <LoginForm /> : <RegisterForm />}
        </div>
      </main>

      <AuthFooter />
    </div>
  );
}

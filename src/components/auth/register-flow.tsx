"use client";

import { useState } from "react";
import { OtpForm } from "@/components/auth/otp-form";
import { RegisterForm } from "@/components/auth/register-form";

type RegisterMethod = "password" | "otp";

/**
 * Student signup flow with two available methods:
 *  - "password": email + password account creation (existing /api/auth/register)
 *  - "otp":      passwordless email verification code (existing OtpForm)
 * The user can switch between them without leaving the page.
 */
export function RegisterFlow() {
  const [method, setMethod] = useState<RegisterMethod>("password");

  if (method === "otp") {
    return <OtpForm intent="signup" onUsePassword={() => setMethod("password")} />;
  }

  return <RegisterForm mode="student" onUseEmailCode={() => setMethod("otp")} />;
}
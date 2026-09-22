"use client";

import { useSearchParams } from "next/navigation";
import { OtpForm } from "@/components/auth/otp-form";

export default function VerifyEmailForm() {
  const searchParams = useSearchParams();
  return <OtpForm intent="signup" initialEmail={searchParams.get("email") || ""} />;
}